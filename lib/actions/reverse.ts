"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { Prisma } from "@prisma/client";

export type ReversibleKind = "receipt" | "issue" | "adjustment" | "transfer" | "count";

type Tx = Prisma.TransactionClient;

function revalidateAll() {
  safeRevalidate([
    "/receive",
    "/pack",
    "/oee",
    "/silo",
    "/issue",
    "/adjust",
    "/transfer",
    "/count",
    "/dashboard",
    "/products",
    "/aging",
    "/locations",
    "/po",
    "/ship",
    "/reports",
    "/search",
  ]);
}

const ALREADY_REVERSED = "This document has already been reversed (เอกสารนี้ถูกถอยไปแล้ว)";

/** Undo the stock movement a document caused, without touching its reversedAt
 *  flag. If the document was already reversed, its stock effect is already
 *  undone, so this does nothing and reports `wasReversed`. Throws a bilingual
 *  error if the stock can no longer be safely undone (e.g. received stock has
 *  since been issued). Returns the document number for messaging. */
async function undoStock(
  tx: Tx,
  kind: ReversibleKind,
  id: string
): Promise<{ docNo: string; wasReversed: boolean }> {
  if (kind === "receipt") {
    const receipt = await tx.receipt.findUnique({
      where: { id },
      include: { lines: true, materialConsumption: true },
    });
    if (!receipt) throw new Error("Receipt not found");
    if (receipt.reversedAt) return { docNo: receipt.docNo, wasReversed: true };

    // Remove the received quantities from the lots they landed in.
    for (const line of receipt.lines) {
      if (!line.lotId || line.recvQty <= 0) continue;
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
      if (!lot) continue;
      if (lot.qty < line.recvQty) {
        throw new Error(
          `Cannot reverse — ${line.recvQty.toLocaleString()} of ${line.productCode} already left this lot (ถอยไม่ได้ เพราะสินค้าถูกใช้/ย้ายไปแล้ว)`
        );
      }
      await tx.lot.update({ where: { id: lot.id }, data: { qty: { decrement: line.recvQty } } });
    }

    // Production receipts also consumed raw materials — add them back exactly.
    for (const mc of receipt.materialConsumption) {
      const lot = await tx.lot.findUnique({ where: { id: mc.lotId } });
      if (!lot) continue;
      await tx.lot.update({ where: { id: lot.id }, data: { qty: { increment: mc.qty } } });
    }

    // Roll back PO received quantities / status if this was a PO receipt.
    if (receipt.poId) {
      for (const line of receipt.lines) {
        const poLine = await tx.purchaseOrderLine.findFirst({
          where: { poId: receipt.poId, productCode: line.productCode },
        });
        if (poLine) {
          await tx.purchaseOrderLine.update({
            where: { id: poLine.id },
            data: { received: Math.max(0, poLine.received - line.recvQty) },
          });
        }
      }
      const po = await tx.purchaseOrder.findUnique({
        where: { id: receipt.poId },
        include: { lines: true },
      });
      if (po) {
        const allDone = po.lines.every((l) => l.received >= l.ordered);
        const anyReceived = po.lines.some((l) => l.received > 0);
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: allDone ? "COMPLETE" : anyReceived ? "PENDING" : "OPEN" },
        });
      }
    }

    return { docNo: receipt.docNo, wasReversed: false };
  }

  if (kind === "issue") {
    const issue = await tx.issue.findUnique({ where: { id }, include: { lines: true } });
    if (!issue) throw new Error("Issue not found");
    if (issue.reversedAt) return { docNo: issue.docNo, wasReversed: true };

    // Put the issued quantities back — onto the lots they came from, or back into
    // the Non-Stock holding for Non-Stock lines.
    for (const line of issue.lines) {
      if (line.nonStockHoldingId) {
        const holding = await tx.nonStockHolding.findUnique({ where: { id: line.nonStockHoldingId } });
        if (holding) {
          await tx.nonStockHolding.update({
            where: { id: holding.id },
            data: { qty: { increment: line.qty } },
          });
        }
        continue;
      }
      if (!line.selectedLotId) continue;
      const lot = await tx.lot.findUnique({ where: { id: line.selectedLotId } });
      if (!lot) continue;
      await tx.lot.update({ where: { id: lot.id }, data: { qty: { increment: line.qty } } });
    }

    // If this issue fulfilled a ship order, roll the shipped quantities back so
    // the order reopens for those items, then recompute the order's status.
    if (issue.shipOrderId) {
      const soLines = await tx.shipOrderLine.findMany({ where: { soId: issue.shipOrderId } });
      const shippedByProduct = new Map<string, number>();
      for (const line of issue.lines) {
        shippedByProduct.set(
          line.productCode,
          (shippedByProduct.get(line.productCode) ?? 0) + line.qty
        );
      }
      for (const soLine of soLines) {
        const back = shippedByProduct.get(soLine.productCode);
        if (!back) continue;
        await tx.shipOrderLine.update({
          where: { id: soLine.id },
          data: { shipped: Math.max(0, soLine.shipped - back) },
        });
      }
      const fresh = await tx.shipOrderLine.findMany({ where: { soId: issue.shipOrderId } });
      const allShipped = fresh.length > 0 && fresh.every((l) => l.shipped >= l.ordered);
      const anyShipped = fresh.some((l) => l.shipped > 0);
      await tx.shipOrder.update({
        where: { id: issue.shipOrderId },
        data: { status: allShipped ? "COMPLETE" : anyShipped ? "PENDING" : "OPEN" },
      });
    }

    return { docNo: issue.docNo, wasReversed: false };
  }

  if (kind === "adjustment") {
    const adj = await tx.adjustment.findUnique({ where: { id }, include: { lines: true } });
    if (!adj) throw new Error("Adjustment not found");
    if (adj.reversedAt) return { docNo: adj.docNo, wasReversed: true };

    // Undo the delta each line applied (countedQty − sysQty).
    for (const line of adj.lines) {
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
      if (!lot) continue;
      const delta = line.countedQty - line.sysQty;
      const next = lot.qty - delta;
      if (next < 0) {
        throw new Error(
          `Cannot reverse — stock of ${lot.productCode} would go negative (ถอยไม่ได้ เพราะสต็อกจะติดลบ)`
        );
      }
      await tx.lot.update({ where: { id: lot.id }, data: { qty: next } });
    }

    return { docNo: adj.docNo, wasReversed: false };
  }

  if (kind === "count") {
    const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
    if (!count) throw new Error("Stock count not found");
    if (count.reversedAt) return { docNo: count.docNo, wasReversed: true };

    // A plain count doesn't move stock. Only "off-system found" lines added
    // stock (addedQty > 0) — remove exactly what they brought in.
    for (const line of count.lines) {
      if (line.addedQty <= 0) continue;
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
      if (!lot) continue;
      const next = lot.qty - line.addedQty;
      if (next < 0) {
        throw new Error(
          `Cannot reverse — stock of ${lot.productCode} would go negative (ถอยไม่ได้ เพราะสต็อกจะติดลบ)`
        );
      }
      await tx.lot.update({ where: { id: lot.id }, data: { qty: next } });
    }

    return { docNo: count.docNo, wasReversed: false };
  }

  // transfer
  const transfer = await tx.transfer.findUnique({
    where: { id },
    include: { lines: { include: { lot: true } } },
  });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.reversedAt) return { docNo: transfer.docNo, wasReversed: true };

  // Move each quantity back from its destination to its origin.
  for (const line of transfer.lines) {
    const { productCode, lotNo } = line.lot;
    const destLot = await tx.lot.findFirst({
      where: { productCode, lotNo, locationCode: line.toLocationCode },
    });
    if (!destLot || destLot.qty < line.qty) {
      throw new Error(
        `Cannot reverse — ${productCode} is no longer at ${line.toLocationCode} to move back (ถอยไม่ได้ เพราะสินค้าไม่ได้อยู่ที่ปลายทางแล้ว)`
      );
    }
    await tx.lot.update({ where: { id: destLot.id }, data: { qty: { decrement: line.qty } } });

    const originLot = await tx.lot.findFirst({
      where: { productCode, lotNo, locationCode: line.fromLocationCode },
    });
    if (originLot) {
      await tx.lot.update({
        where: { id: originLot.id },
        data: { qty: { increment: line.qty } },
      });
    } else {
      await tx.lot.create({
        data: {
          productCode,
          locationCode: line.fromLocationCode,
          lotNo,
          qty: line.qty,
          status: destLot.status,
          recvDate: destLot.recvDate,
          mfgDate: destLot.mfgDate,
          expDate: destLot.expDate,
        },
      });
    }
  }

  return { docNo: transfer.docNo, wasReversed: false };
}

/** Mark a document as reversed (sets reversedAt). */
async function markReversed(tx: Tx, kind: ReversibleKind, id: string) {
  const now = new Date();
  if (kind === "receipt") await tx.receipt.update({ where: { id }, data: { reversedAt: now } });
  else if (kind === "issue") await tx.issue.update({ where: { id }, data: { reversedAt: now } });
  else if (kind === "adjustment")
    await tx.adjustment.update({ where: { id }, data: { reversedAt: now } });
  else if (kind === "count")
    await tx.stockCount.update({ where: { id }, data: { reversedAt: now } });
  else await tx.transfer.update({ where: { id }, data: { reversedAt: now } });
}

/** Permanently remove the document and its lines (children cascade). */
async function deleteRecord(tx: Tx, kind: ReversibleKind, id: string) {
  if (kind === "receipt") await tx.receipt.delete({ where: { id } });
  else if (kind === "issue") await tx.issue.delete({ where: { id } });
  else if (kind === "adjustment") await tx.adjustment.delete({ where: { id } });
  else if (kind === "count") await tx.stockCount.delete({ where: { id } });
  else await tx.transfer.delete({ where: { id } });
}

/** Reverse (void) a stock-affecting document: undo its stock movement and mark
 *  the original as reversed. The original stays in history with a "Reversed"
 *  badge. Throws a bilingual error if the stock can no longer be safely undone
 *  (e.g. received stock has since been issued). */
export async function reverseDocumentAction(
  kind: ReversibleKind,
  id: string
): Promise<{ docNo?: string; error?: string }> {
  try {
    await requireWrite();
    const docNo = await db.$transaction(
      async (tx) => {
        const { docNo, wasReversed } = await undoStock(tx, kind, id);
        if (wasReversed) throw new Error(ALREADY_REVERSED);
        await markReversed(tx, kind, id);
        return docNo;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidateAll();
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reverse document." };
  }
}

/** Permanently delete a document. If it still affects stock (not yet reversed),
 *  its stock movement is undone first — exactly like a reverse — then the record
 *  and its lines are removed. Already-reversed documents are simply removed
 *  (their stock was already restored). Throws if the stock cannot be safely
 *  undone. */
export async function deleteDocumentAction(
  kind: ReversibleKind,
  id: string
): Promise<{ docNo?: string; error?: string }> {
  try {
    await requireWrite();
    const docNo = await db.$transaction(
      async (tx) => {
        const { docNo } = await undoStock(tx, kind, id);
        await deleteRecord(tx, kind, id);
        return docNo;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidateAll();
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete document." };
  }
}

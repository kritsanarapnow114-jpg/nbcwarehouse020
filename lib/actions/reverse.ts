"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type ReversibleKind = "receipt" | "issue" | "adjustment" | "transfer" | "count";

function revalidateAll() {
  safeRevalidate([
    "/receive",
    "/issue",
    "/adjust",
    "/transfer",
    "/count",
    "/dashboard",
    "/products",
    "/aging",
    "/locations",
    "/po",
  ]);
}

const ALREADY_REVERSED = "This document has already been reversed (เอกสารนี้ถูกถอยไปแล้ว)";

/** Reverse (void) a stock-affecting document: undo its stock movement and mark
 *  the original as reversed. The original stays in history with a "Reversed"
 *  badge. Throws a bilingual error if the stock can no longer be safely undone
 *  (e.g. received stock has since been issued). */
export async function reverseDocumentAction(
  kind: ReversibleKind,
  id: string
): Promise<{ docNo?: string; error?: string }> {
  let docNo = "";

  try {
    await db.$transaction(async (tx) => {
    if (kind === "receipt") {
      const receipt = await tx.receipt.findUnique({
        where: { id },
        include: { lines: true, materialConsumption: true },
      });
      if (!receipt) throw new Error("Receipt not found");
      if (receipt.reversedAt) throw new Error(ALREADY_REVERSED);
      docNo = receipt.docNo;

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
        await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - line.recvQty } });
      }

      // Production receipts also consumed raw materials — add them back exactly.
      for (const mc of receipt.materialConsumption) {
        const lot = await tx.lot.findUnique({ where: { id: mc.lotId } });
        if (!lot) continue;
        await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty + mc.qty } });
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

      await tx.receipt.update({ where: { id }, data: { reversedAt: new Date() } });
    } else if (kind === "issue") {
      const issue = await tx.issue.findUnique({ where: { id }, include: { lines: true } });
      if (!issue) throw new Error("Issue not found");
      if (issue.reversedAt) throw new Error(ALREADY_REVERSED);
      docNo = issue.docNo;

      // Put the issued quantities back onto the lots they came from.
      for (const line of issue.lines) {
        const lot = await tx.lot.findUnique({ where: { id: line.selectedLotId } });
        if (!lot) continue;
        await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty + line.qty } });
      }

      await tx.issue.update({ where: { id }, data: { reversedAt: new Date() } });
    } else if (kind === "adjustment") {
      const adj = await tx.adjustment.findUnique({ where: { id }, include: { lines: true } });
      if (!adj) throw new Error("Adjustment not found");
      if (adj.reversedAt) throw new Error(ALREADY_REVERSED);
      docNo = adj.docNo;

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

      await tx.adjustment.update({ where: { id }, data: { reversedAt: new Date() } });
    } else if (kind === "count") {
      const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
      if (!count) throw new Error("Stock count not found");
      if (count.reversedAt) throw new Error(ALREADY_REVERSED);
      docNo = count.docNo;

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

      await tx.stockCount.update({ where: { id }, data: { reversedAt: new Date() } });
    } else {
      // transfer
      const transfer = await tx.transfer.findUnique({
        where: { id },
        include: { lines: { include: { lot: true } } },
      });
      if (!transfer) throw new Error("Transfer not found");
      if (transfer.reversedAt) throw new Error(ALREADY_REVERSED);
      docNo = transfer.docNo;

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
        await tx.lot.update({ where: { id: destLot.id }, data: { qty: destLot.qty - line.qty } });

        const originLot = await tx.lot.findFirst({
          where: { productCode, lotNo, locationCode: line.fromLocationCode },
        });
        if (originLot) {
          await tx.lot.update({
            where: { id: originLot.id },
            data: { qty: originLot.qty + line.qty },
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

      await tx.transfer.update({ where: { id }, data: { reversedAt: new Date() } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidateAll();
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reverse document." };
  }
}

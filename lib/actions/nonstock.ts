"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";

export type ConvertInput = {
  holdingId: string;
  qty: number;
  docDate: string;
};

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Total quantity ever received into one lot identity (product+location+lotNo),
 * from non-reversed receipts. A Non-Stock holding for that lot can never
 * legitimately exceed this — it's the ceiling used to stop "pull"/"move" from
 * double-counting the same goods into a holding.
 */
async function receivedTotalForLot(
  tx: Tx,
  productCode: string,
  locationCode: string,
  lotNo: string
): Promise<number> {
  const agg = await tx.receiptLine.aggregate({
    where: { productCode, locationCode, lotNo, receipt: { reversedAt: null } },
    _sum: { recvQty: true },
  });
  return agg._sum.recvQty ?? 0;
}

/**
 * Directly correct a Non-Stock holding's stored quantity — for fixing figures
 * that were double-counted before the ceiling guard existed (e.g. a lot received
 * once as Non-Stock but stacked twice by "pull"/"move"). Non-Stock is not valued
 * inventory, so this is a straight correction and does not touch stock. Setting it
 * to 0 removes the holding from the list.
 */
export async function setHoldingQtyAction(input: {
  holdingId: string;
  qty: number;
}): Promise<{ error?: string }> {
  try {
    await requireWrite();
    const qty = Number(input.qty);
    if (!Number.isFinite(qty) || qty < 0) {
      return { error: "จำนวนต้องเป็นเลข 0 หรือมากกว่า (quantity must be ≥ 0)" };
    }
    await db.nonStockHolding.update({
      where: { id: input.holdingId },
      data: { qty: Math.round(qty) },
    });
    safeRevalidate(["/nonstock", "/dashboard", "/products", "/aging", "/locations", "/map"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "แก้ยอดไม่สำเร็จ (failed to adjust)" };
  }
}

/**
 * One-off cleanup: pull every receipt line marked Non-Stock (either the line or
 * its whole document) OUT of stock into a Non-Stock holding. Older Non-Stock
 * receipts were only *labelled* and their goods stayed in stock; this moves them
 * to holdings. Safe to run repeatedly — each line is processed once (guarded by
 * `movedToNonStockAt`) and never takes more than the lot currently holds.
 */
export async function pullNonStockDocsAction(): Promise<{
  movedLines?: number;
  movedQty?: number;
  error?: string;
}> {
  try {
    await requireWrite();
    const lines = await db.receiptLine.findMany({
      where: {
        movedToNonStockAt: null,
        lotId: { not: null },
        receipt: { reversedAt: null },
        OR: [{ stockType: "NON_STOCK" }, { receipt: { is: { stockType: "NON_STOCK" } } }],
      },
      include: { receipt: true },
    });

    let movedLines = 0;
    let movedQty = 0;

    await db.$transaction(async (tx) => {
      for (const line of lines) {
        if (!line.lotId) continue;
        const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
        // Re-read inside the tx so lines sharing a lot don't over-draw it.
        const avail = lot?.qty ?? 0;

        const existing = await tx.nonStockHolding.findFirst({
          where: { productCode: line.productCode, locationCode: line.locationCode, lotNo: line.lotNo },
        });
        // Ceiling guard: never let a holding exceed what was ever received into
        // this lot. This is what stops the same goods being stacked into a holding
        // twice (received-as-Non-Stock, then pulled again). Skip the cap only when
        // nothing was received here (0) — e.g. a lot relocated by a transfer.
        const received = await receivedTotalForLot(tx, line.productCode, line.locationCode, line.lotNo);
        const headroom = received > 0 ? Math.max(0, received - (existing?.qty ?? 0)) : avail;
        const moveQty = Math.min(line.recvQty, avail, headroom);

        if (lot && moveQty > 0) {
          await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - moveQty } });

          const holding = existing;
          if (holding) {
            await tx.nonStockHolding.update({ where: { id: holding.id }, data: { qty: holding.qty + moveQty } });
          } else {
            await tx.nonStockHolding.create({
              data: {
                productCode: line.productCode,
                locationCode: line.locationCode,
                lotNo: line.lotNo,
                qty: moveQty,
                recvDate: line.receipt.docDate,
                mfgDate: line.mfgDate,
                expDate: line.expDate,
                receiptId: line.receiptId,
              },
            });
          }

          const no = await nextDocNumber("CV", line.receipt.docDate);
          await tx.conversion.create({
            data: {
              docNo: no,
              productCode: line.productCode,
              lotNo: line.lotNo,
              locationCode: line.locationCode,
              qty: -moveQty, // moved OUT of stock
              docDate: line.receipt.docDate,
            },
          });
          movedLines += 1;
          movedQty += moveQty;
        }

        await tx.receiptLine.update({ where: { id: line.id }, data: { movedToNonStockAt: new Date() } });
      }
    });

    safeRevalidate(["/nonstock", "/dashboard", "/products", "/aging", "/locations", "/map", "/reports"]);
    return { movedLines, movedQty };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ดึงไม่สำเร็จ (failed)" };
  }
}

export type MoveToNonStockInput = {
  lotId: string;
  qty: number;
  docDate: string;
};

/**
 * Move a quantity of a Stock lot OUT of inventory into a Non-Stock holding — the
 * reverse of a conversion. Used to fix items that ended up in stock but should be
 * Non-Stock. Recorded as a negative Conversion so the Stock Card shows the outflow.
 */
export async function moveToNonStockAction(
  input: MoveToNonStockInput
): Promise<{ docNo?: string; error?: string }> {
  try {
    await requireWrite();
    const qty = Number(input.qty) || 0;
    if (qty <= 0) return { error: "จำนวนต้องมากกว่า 0 (quantity must be > 0)" };
    const docDate = new Date(input.docDate);

    const docNo = await db.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({ where: { id: input.lotId } });
      if (!lot) throw new Error("ไม่พบล็อตในสต็อก (stock lot not found)");
      if (qty > lot.qty) {
        throw new Error(`จำนวนเกินที่มี — มี ${lot.qty.toLocaleString()}, ขอย้าย ${qty.toLocaleString()}`);
      }

      const holding = await tx.nonStockHolding.findFirst({
        where: { productCode: lot.productCode, locationCode: lot.locationCode, lotNo: lot.lotNo },
      });
      // Ceiling guard: a lot's Non-Stock holding can't exceed what was ever
      // received into that lot (prevents double-counting). Skip when nothing was
      // received here (relocated lot).
      const received = await receivedTotalForLot(tx, lot.productCode, lot.locationCode, lot.lotNo);
      if (received > 0 && (holding?.qty ?? 0) + qty > received) {
        const room = Math.max(0, received - (holding?.qty ?? 0));
        throw new Error(
          `ย้ายเกินยอดที่รับเข้าล็อตนี้ — รับเข้ารวม ${received.toLocaleString()}, Non-Stock มีอยู่แล้ว ${(holding?.qty ?? 0).toLocaleString()}, ย้ายเพิ่มได้อีก ${room.toLocaleString()}`
        );
      }

      const no = await nextDocNumber("CV", docDate);
      await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - qty } });

      if (holding) {
        await tx.nonStockHolding.update({ where: { id: holding.id }, data: { qty: holding.qty + qty } });
      } else {
        await tx.nonStockHolding.create({
          data: {
            productCode: lot.productCode,
            locationCode: lot.locationCode,
            lotNo: lot.lotNo,
            qty,
            recvDate: docDate,
            mfgDate: lot.mfgDate,
            expDate: lot.expDate,
          },
        });
      }

      await tx.conversion.create({
        data: {
          docNo: no,
          productCode: lot.productCode,
          lotNo: lot.lotNo,
          locationCode: lot.locationCode,
          qty: -qty, // negative = moved OUT of stock into Non-Stock
          docDate,
        },
      });
      return no;
    });

    safeRevalidate(["/nonstock", "/dashboard", "/products", "/aging", "/locations", "/map", "/reports"]);
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ย้ายไม่สำเร็จ (failed to move)" };
  }
}

/**
 * Convert a quantity of a Non-Stock holding into real stock on a chosen date.
 * The quantity may be less than what's held (partial conversion). This moves the
 * qty out of the holding and into a Stock lot, and records a Conversion event
 * that shows up as an inbound in the product's Stock Card.
 */
export async function convertToStockAction(
  input: ConvertInput
): Promise<{ docNo?: string; error?: string }> {
  try {
    await requireWrite();
    const qty = Number(input.qty) || 0;
    if (qty <= 0) return { error: "จำนวนต้องมากกว่า 0 (quantity must be > 0)" };
    const docDate = new Date(input.docDate);

    const docNo = await db.$transaction(async (tx) => {
      const holding = await tx.nonStockHolding.findUnique({ where: { id: input.holdingId } });
      if (!holding) throw new Error("ไม่พบรายการ Non-Stock (holding not found)");
      if (qty > holding.qty) {
        throw new Error(
          `จำนวนเกินที่มี — มี ${holding.qty.toLocaleString()}, ขอแปลง ${qty.toLocaleString()}`
        );
      }

      const no = await nextDocNumber("CV", docDate);

      // Move qty from the holding into a matching Stock lot (create or increment).
      await tx.nonStockHolding.update({
        where: { id: holding.id },
        data: { qty: holding.qty - qty },
      });

      const lot = await tx.lot.findFirst({
        where: {
          productCode: holding.productCode,
          locationCode: holding.locationCode,
          lotNo: holding.lotNo,
        },
      });
      if (lot) {
        await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty + qty } });
      } else {
        await tx.lot.create({
          data: {
            productCode: holding.productCode,
            locationCode: holding.locationCode,
            lotNo: holding.lotNo,
            qty,
            status: "OK",
            recvDate: docDate, // stock life starts at the conversion date
            mfgDate: holding.mfgDate,
            expDate: holding.expDate,
          },
        });
      }

      await tx.conversion.create({
        data: {
          docNo: no,
          productCode: holding.productCode,
          lotNo: holding.lotNo,
          locationCode: holding.locationCode,
          qty,
          docDate,
        },
      });

      return no;
    });

    safeRevalidate([
      "/nonstock",
      "/dashboard",
      "/products",
      "/aging",
      "/locations",
      "/map",
      "/reports",
    ]);
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "แปลงไม่สำเร็จ (failed to convert)" };
  }
}

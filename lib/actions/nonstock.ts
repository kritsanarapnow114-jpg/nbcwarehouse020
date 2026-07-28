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
        const moveQty = Math.min(line.recvQty, avail);

        if (lot && moveQty > 0) {
          await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - moveQty } });

          const holding = await tx.nonStockHolding.findFirst({
            where: { productCode: line.productCode, locationCode: line.locationCode, lotNo: line.lotNo },
          });
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

      const no = await nextDocNumber("CV", docDate);
      await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - qty } });

      const holding = await tx.nonStockHolding.findFirst({
        where: { productCode: lot.productCode, locationCode: lot.locationCode, lotNo: lot.lotNo },
      });
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

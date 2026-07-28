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

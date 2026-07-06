"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { productLabel } from "@/lib/calc/productName";
import { Zone } from "@prisma/client";

export type CountLineInput = { lotId: string; countedQty: number };
export type OffSystemLineInput = {
  productCode: string;
  lotNo: string;
  locationCode: string;
  countedQty: number;
};
export type ConfirmCountInput = {
  pullZone: string;
  docDate: string;
  lines: CountLineInput[];
  offSystemLines?: OffSystemLineInput[];
};

const ZONE_LABEL_MAP: Record<string, Zone | null> = {
  "All zones": null,
  "Zone A — Raw Material": "A",
  "Zone B — Liquids": "B",
  "Zone C — Packaging": "C",
};

export async function getLotsByZoneAction(pullZone: string) {
  const zone = ZONE_LABEL_MAP[pullZone] ?? null;
  const lots = await db.lot.findMany({
    where: zone ? { location: { zone } } : {},
    include: { product: true },
    orderBy: [{ locationCode: "asc" }, { productCode: "asc" }],
  });
  return lots.map((l) => ({
    id: l.id,
    productCode: l.productCode,
    name: productLabel(l.product.nameEn, l.product.nameTh),
    lotNo: l.lotNo,
    locationCode: l.locationCode,
    sysQty: l.qty,
  }));
}

export async function confirmCountAction(input: ConfirmCountInput) {
  const docDate = new Date(input.docDate);
  const docNo = await nextDocNumber("CNT", docDate);

  await db.$transaction(async (tx) => {
    const count = await tx.stockCount.create({
      data: { docNo, pullZone: input.pullZone, docDate },
    });
    for (const line of input.lines) {
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
      if (!lot) continue;
      await tx.stockCountLine.create({
        data: {
          stockCountId: count.id,
          lotId: lot.id,
          sysQty: lot.qty,
          countedQty: line.countedQty,
        },
      });
    }

    // Off-system finds: physical stock with no existing lot record. Create the
    // lot so it enters inventory (system qty was 0), and log it in the count.
    for (const off of input.offSystemLines ?? []) {
      if (off.countedQty <= 0) continue;
      const location = await tx.location.findUnique({ where: { code: off.locationCode } });
      const product = await tx.product.findUnique({ where: { code: off.productCode } });
      if (!location || !product) continue;

      const lotNo = off.lotNo.trim() || "-";
      // Merge into an existing matching lot if one already exists at that spot.
      let lot = await tx.lot.findFirst({
        where: { productCode: off.productCode, locationCode: off.locationCode, lotNo },
      });
      const sysQty = lot?.qty ?? 0;
      if (lot) {
        lot = await tx.lot.update({
          where: { id: lot.id },
          data: { qty: lot.qty + off.countedQty },
        });
      } else {
        lot = await tx.lot.create({
          data: {
            productCode: off.productCode,
            locationCode: off.locationCode,
            lotNo,
            qty: off.countedQty,
            status: "OK",
            recvDate: docDate,
          },
        });
      }
      await tx.stockCountLine.create({
        data: {
          stockCountId: count.id,
          lotId: lot.id,
          sysQty,
          countedQty: sysQty + off.countedQty,
        },
      });
    }
  });

  revalidatePath("/count");
  revalidatePath("/dashboard");
  return { docNo };
}

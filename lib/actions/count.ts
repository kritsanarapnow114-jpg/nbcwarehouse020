"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { Zone } from "@prisma/client";

export type CountLineInput = { lotId: string; countedQty: number };
export type ConfirmCountInput = {
  pullZone: string;
  docDate: string;
  lines: CountLineInput[];
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
    name: `${l.product.nameEn} (${l.product.nameTh})`,
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
  });

  revalidatePath("/count");
  revalidatePath("/dashboard");
  return { docNo };
}

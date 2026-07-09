"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { productLabel } from "@/lib/calc/productName";
import { getLotQtyAsOf } from "@/lib/views/countAsOf";
import { Zone } from "@prisma/client";

export type CountLineInput = { lotId: string; countedQty: number; sysQty?: number };
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

export async function getLotsByZoneAction(pullZone: string, asOfDate?: string) {
  const zone = ZONE_LABEL_MAP[pullZone] ?? null;
  // With an as-of date we must consider every lot in the zone (some empty now may
  // have had stock then; some with stock now may not have existed yet), so we
  // don't pre-filter on current qty — we filter on the as-of quantity instead.
  const asOfMap = asOfDate ? await getLotQtyAsOf(asOfDate) : null;
  const lots = await db.lot.findMany({
    where: asOfMap
      ? { ...(zone ? { location: { zone } } : {}) }
      : { qty: { gt: 0 }, ...(zone ? { location: { zone } } : {}) },
    include: { product: true },
    orderBy: [{ locationCode: "asc" }, { productCode: "asc" }],
  });
  return lots
    .map((l) => ({
      id: l.id,
      productCode: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      sysQty: asOfMap ? Math.round((asOfMap.get(l.id) ?? 0) * 1000) / 1000 : l.qty,
    }))
    .filter((r) => r.sysQty > 0);
}

export async function confirmCountAction(input: ConfirmCountInput) {
  await requireWrite();
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
          // Use the system qty the counter actually saw. For a back-dated count
          // that's the balance as of the chosen date; for a normal count it's the
          // current qty. Falling back to current keeps older callers working.
          sysQty: line.sysQty ?? lot.qty,
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
          addedQty: off.countedQty, // stock brought in — undone if the count is reversed
        },
      });
    }
  });

  safeRevalidate(["/count", "/dashboard", "/products", "/aging", "/locations"]);
  return { docNo };
}

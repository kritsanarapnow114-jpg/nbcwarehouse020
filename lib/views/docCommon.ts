import "server-only";
import { db } from "@/lib/db";

export async function getLotOptions() {
  const lots = await db.lot.findMany({
    include: { product: true },
    orderBy: [{ productCode: "asc" }, { locationCode: "asc" }],
  });
  return lots.map((l) => ({
    id: l.id,
    productCode: l.productCode,
    name: `${l.product.nameEn} (${l.product.nameTh})`,
    unit: l.product.unit,
    price: l.product.price,
    lotNo: l.lotNo,
    locationCode: l.locationCode,
    qty: l.qty,
    status: l.status,
  }));
}

export type LotOption = Awaited<ReturnType<typeof getLotOptions>>[number];

export async function getLocationCodes() {
  const locs = await db.location.findMany({ orderBy: { code: "asc" } });
  return locs.map((l) => l.code);
}

export async function getRecentAdjustments(limit = 20) {
  const rows = await db.adjustment.findMany({
    include: { lines: { include: { lot: { include: { product: true } } } } },
    orderBy: { docDate: "desc" },
    take: limit,
  });
  return rows.map((a) => ({
    id: a.id,
    docNo: a.docNo,
    docDate: a.docDate.toISOString(),
    reason: a.reason,
    lineCount: a.lines.length,
    lines: a.lines.map((l) => ({
      code: l.lot.productCode,
      name: `${l.lot.product.nameEn} (${l.lot.product.nameTh})`,
      lotNo: l.lot.lotNo,
      locationCode: l.lot.locationCode,
      sysQty: l.sysQty,
      countedQty: l.countedQty,
      unit: l.lot.product.unit,
    })),
  }));
}

export async function getRecentTransfers(limit = 20) {
  const rows = await db.transfer.findMany({
    include: { lines: { include: { lot: { include: { product: true } } } } },
    orderBy: { docDate: "desc" },
    take: limit,
  });
  return rows.map((t) => ({
    id: t.id,
    docNo: t.docNo,
    docDate: t.docDate.toISOString(),
    operator: t.operator,
    lineCount: t.lines.length,
    lines: t.lines.map((l) => ({
      code: l.lot.productCode,
      name: `${l.lot.product.nameEn} (${l.lot.product.nameTh})`,
      lotNo: l.lot.lotNo,
      fromLocationCode: l.fromLocationCode,
      toLocationCode: l.toLocationCode,
      qty: l.qty,
      unit: l.lot.product.unit,
    })),
  }));
}

export async function getRecentCounts(limit = 20) {
  const rows = await db.stockCount.findMany({
    include: { lines: { include: { lot: { include: { product: true } } } } },
    orderBy: { docDate: "desc" },
    take: limit,
  });
  return rows.map((c) => ({
    id: c.id,
    docNo: c.docNo,
    docDate: c.docDate.toISOString(),
    pullZone: c.pullZone,
    lineCount: c.lines.length,
    lines: c.lines.map((l) => ({
      code: l.lot.productCode,
      name: `${l.lot.product.nameEn} (${l.lot.product.nameTh})`,
      lotNo: l.lot.lotNo,
      locationCode: l.lot.locationCode,
      sysQty: l.sysQty,
      countedQty: l.countedQty,
      unit: l.lot.product.unit,
    })),
  }));
}

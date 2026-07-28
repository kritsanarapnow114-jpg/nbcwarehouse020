import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";

export type NonStockHoldingRow = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  lotNo: string;
  locationCode: string;
  qty: number;
  recvDate: string;
  mfgDate: string | null;
  expDate: string | null;
};

/** Non-Stock goods held outside valued inventory, waiting to be converted. */
export async function getNonStockHoldings(): Promise<NonStockHoldingRow[]> {
  const holdings = await db.nonStockHolding.findMany({
    where: { qty: { gt: 0 } },
    include: { product: true },
    orderBy: [{ recvDate: "desc" }],
  });
  return holdings.map((h) => ({
    id: h.id,
    productCode: h.productCode,
    name: productLabel(h.product.nameEn, h.product.nameTh),
    unit: h.product.unit,
    lotNo: h.lotNo,
    locationCode: h.locationCode,
    qty: h.qty,
    recvDate: h.recvDate.toISOString(),
    mfgDate: h.mfgDate ? h.mfgDate.toISOString() : null,
    expDate: h.expDate ? h.expDate.toISOString() : null,
  }));
}

export type ConversionRow = {
  docNo: string;
  productCode: string;
  name: string;
  lotNo: string;
  locationCode: string;
  qty: number;
  docDate: string;
};

/** History of Non-Stock → Stock conversion events. */
export async function getConversions(limit = 200): Promise<ConversionRow[]> {
  const rows = await db.conversion.findMany({
    include: { product: true },
    orderBy: { docDate: "desc" },
    take: limit,
  });
  return rows.map((c) => ({
    docNo: c.docNo,
    productCode: c.productCode,
    name: productLabel(c.product.nameEn, c.product.nameTh),
    lotNo: c.lotNo,
    locationCode: c.locationCode,
    qty: c.qty,
    docDate: c.docDate.toISOString(),
  }));
}

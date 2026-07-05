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

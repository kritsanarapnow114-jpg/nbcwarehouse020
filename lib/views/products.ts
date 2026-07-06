import "server-only";
import { db } from "@/lib/db";
import { CATEGORY_LABEL } from "@/components/ui/tone";
import { productLabel } from "@/lib/calc/productName";

export type ProductRow = {
  code: string;
  nameEn: string;
  nameTh: string | null;
  category: string;
  categoryLabel: string;
  unit: string;
  price: number;
  pallet: number;
  onHand: number;
  totalValue: number;
  locations: string[];
  status: "ok" | "qc";
  lotCount: number;
};

export async function getProductRows(opts?: {
  q?: string;
  category?: string;
}): Promise<ProductRow[]> {
  const products = await db.product.findMany({
    where: {
      deletedAt: null,
      ...(opts?.category ? { category: opts.category as never } : {}),
      ...(opts?.q
        ? {
            OR: [
              { code: { contains: opts.q } },
              { nameEn: { contains: opts.q } },
              { nameTh: { contains: opts.q } },
            ],
          }
        : {}),
    },
    include: { lots: true },
    orderBy: { code: "asc" },
  });

  return products.map((p) => {
    const onHand = p.lots.reduce((s, l) => s + l.qty, 0);
    const locations = [...new Set(p.lots.map((l) => l.locationCode))];
    const status: "ok" | "qc" = p.lots.some((l) => l.status === "QC")
      ? "qc"
      : "ok";
    return {
      code: p.code,
      nameEn: p.nameEn,
      nameTh: p.nameTh,
      category: p.category,
      categoryLabel: `${CATEGORY_LABEL[p.category].en} (${CATEGORY_LABEL[p.category].th})`,
      unit: p.unit,
      price: p.price,
      pallet: p.pallet,
      onHand,
      totalValue: onHand * p.price,
      locations,
      status,
      lotCount: p.lots.length,
    };
  });
}

export type ProductDetail = ProductRow & {
  nameEnTh: string;
  width: number;
  length: number;
  stackLevels: number;
  lots: {
    id: string;
    locationCode: string;
    lotNo: string;
    qty: number;
    status: "OK" | "QC";
    expDate: string | null;
    mfgDate: string | null;
    recvDate: string;
  }[];
};

/** Raw material / packaging products eligible to appear as BOM material lines. */
export async function getBomMaterialOptions() {
  const products = await db.product.findMany({
    where: { deletedAt: null, category: { in: ["RAW_MATERIAL", "PACKAGING"] } },
    orderBy: { code: "asc" },
  });
  return products.map((p) => ({ code: p.code, name: productLabel(p.nameEn, p.nameTh), unit: p.unit }));
}

export async function getProductDetail(
  code: string
): Promise<ProductDetail | null> {
  const p = await db.product.findUnique({
    where: { code },
    include: { lots: { orderBy: { locationCode: "asc" } } },
  });
  if (!p) return null;
  const onHand = p.lots.reduce((s, l) => s + l.qty, 0);
  const status: "ok" | "qc" = p.lots.some((l) => l.status === "QC")
    ? "qc"
    : "ok";
  return {
    code: p.code,
    nameEn: p.nameEn,
    nameTh: p.nameTh,
    nameEnTh: productLabel(p.nameEn, p.nameTh),
    category: p.category,
    categoryLabel: `${CATEGORY_LABEL[p.category].en} (${CATEGORY_LABEL[p.category].th})`,
    unit: p.unit,
    price: p.price,
    pallet: p.pallet,
    width: p.width,
    length: p.length,
    stackLevels: p.stackLevels,
    onHand,
    totalValue: onHand * p.price,
    locations: [...new Set(p.lots.map((l) => l.locationCode))],
    status,
    lotCount: p.lots.length,
    lots: p.lots.map((l) => ({
      id: l.id,
      locationCode: l.locationCode,
      lotNo: l.lotNo,
      qty: l.qty,
      status: l.status,
      expDate: l.expDate ? l.expDate.toISOString() : null,
      mfgDate: l.mfgDate ? l.mfgDate.toISOString() : null,
      recvDate: l.recvDate.toISOString(),
    })),
  };
}

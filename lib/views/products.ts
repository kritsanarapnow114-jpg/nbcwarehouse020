import "server-only";
import { db } from "@/lib/db";
import { CATEGORY_LABEL } from "@/components/ui/tone";
import { productLabel } from "@/lib/calc/productName";
import { autoLevels, USAGE_WINDOW_DAYS } from "@/lib/calc/reorder";

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
  minQty: number; // manual override (0 = auto)
  maxQty: number; // manual override (0 = auto)
  autoMin: number; // suggested from usage + receiving
  autoMax: number;
  autoSafety: number; // suggested safety-stock buffer
};

/**
 * Auto reorder levels per product, derived from the last USAGE_WINDOW_DAYS of
 * real issuing (usage) and receiving. Recomputed on every call, so it always
 * reflects current activity. Reversed documents are excluded.
 */
export async function getAutoLevelsMap(
  codes?: string[]
): Promise<Map<string, { autoMin: number; autoMax: number; safety: number }>> {
  const windowStart = new Date(Date.now() - USAGE_WINDOW_DAYS * 86400000);
  const codeFilter = codes && codes.length ? { productCode: { in: codes } } : {};
  const [issued, recv, consumed, prods] = await Promise.all([
    db.issueLine.groupBy({
      by: ["productCode"],
      where: { ...codeFilter, issue: { docDate: { gte: windowStart }, reversedAt: null } },
      _sum: { qty: true },
    }),
    db.receiptLine.groupBy({
      by: ["productCode"],
      where: { ...codeFilter, receipt: { docDate: { gte: windowStart }, reversedAt: null } },
      _sum: { recvQty: true },
      _count: { _all: true },
    }),
    // Materials cut via BOM when producing finished goods count as usage too.
    db.receiptMaterialConsumption.findMany({
      where: {
        ...(codes && codes.length ? { lot: { productCode: { in: codes } } } : {}),
        receipt: { docDate: { gte: windowStart }, reversedAt: null },
      },
      select: { qty: true, lot: { select: { productCode: true } } },
    }),
    db.product.findMany({
      where: codes && codes.length ? { code: { in: codes } } : {},
      select: { code: true, pallet: true },
    }),
  ]);
  const issuedByCode = new Map(issued.map((r) => [r.productCode, r._sum.qty ?? 0]));
  const recvByCode = new Map(recv.map((r) => [r.productCode, { sum: r._sum.recvQty ?? 0, count: r._count._all }]));
  const consumedByCode = new Map<string, number>();
  for (const c of consumed) {
    consumedByCode.set(c.lot.productCode, (consumedByCode.get(c.lot.productCode) ?? 0) + c.qty);
  }
  const packByCode = new Map(prods.map((p) => [p.code, p.pallet]));
  const map = new Map<string, { autoMin: number; autoMax: number; safety: number }>();
  for (const code of new Set([...issuedByCode.keys(), ...recvByCode.keys(), ...consumedByCode.keys()])) {
    // Usage = issued (จ่ายออก) + consumed via BOM (ตัด BOM ตอนผลิต).
    const avgDaily = ((issuedByCode.get(code) ?? 0) + (consumedByCode.get(code) ?? 0)) / USAGE_WINDOW_DAYS;
    const rc = recvByCode.get(code);
    const avgReceipt = rc && rc.count > 0 ? rc.sum / rc.count : 0;
    map.set(code, autoLevels(avgDaily, avgReceipt, packByCode.get(code) ?? 0));
  }
  return map;
}

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

  const autoMap = await getAutoLevelsMap();

  return products.map((p) => {
    // Depleted lots (qty 0) are ignored for on-hand, location, QC and lot count.
    const activeLots = p.lots.filter((l) => l.qty > 0);
    const onHand = activeLots.reduce((s, l) => s + l.qty, 0);
    const locations = [...new Set(activeLots.map((l) => l.locationCode))];
    const status: "ok" | "qc" = activeLots.some((l) => l.status === "QC")
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
      lotCount: activeLots.length,
      minQty: p.minQty,
      maxQty: p.maxQty,
      autoMin: autoMap.get(p.code)?.autoMin ?? 0,
      autoMax: autoMap.get(p.code)?.autoMax ?? 0,
      autoSafety: autoMap.get(p.code)?.safety ?? 0,
    };
  });
}

export type ProductDetail = ProductRow & {
  nameEnTh: string;
  width: number;
  length: number;
  stackLevels: number;
  containerType: string;
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
  const auto = (await getAutoLevelsMap([code])).get(code);
  // Hide depleted lots (qty 0) from the drawer's "Stored by Location / Lot" list.
  const activeLots = p.lots.filter((l) => l.qty > 0);
  const onHand = activeLots.reduce((s, l) => s + l.qty, 0);
  const status: "ok" | "qc" = activeLots.some((l) => l.status === "QC")
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
    containerType: p.containerType,
    onHand,
    totalValue: onHand * p.price,
    locations: [...new Set(activeLots.map((l) => l.locationCode))],
    status,
    lotCount: activeLots.length,
    minQty: p.minQty,
    maxQty: p.maxQty,
    autoMin: auto?.autoMin ?? 0,
    autoMax: auto?.autoMax ?? 0,
    autoSafety: auto?.safety ?? 0,
    lots: activeLots.map((l) => ({
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

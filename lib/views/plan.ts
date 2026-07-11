import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { CATEGORY_LABEL } from "@/components/ui/tone";
import { getAppSetting } from "./settings";
import {
  PackagingType,
  ScheduleRow,
  PKG_TYPES_KEY,
  SCHEDULE_KEY,
} from "@/lib/planTypes";

export type PlanProduct = { code: string; name: string; unit: string };

export type MaterialReq = {
  code: string;
  name: string;
  category: string;
  categoryLabel: string;
  unit: string;
  required: number;
  onHand: number;
  incoming: number;
  toOrder: number;
  pallet: number;
};

export type DayTotal = { date: string; qty: number; lines: number };

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const j = JSON.parse(raw);
    return j ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getPackagingTypes(): Promise<PackagingType[]> {
  const arr = parseJson<PackagingType[]>(await getAppSetting(PKG_TYPES_KEY), []);
  return Array.isArray(arr) ? arr : [];
}

export async function getSchedule(): Promise<ScheduleRow[]> {
  const arr = parseJson<ScheduleRow[]>(await getAppSetting(SCHEDULE_KEY), []);
  return Array.isArray(arr) ? arr : [];
}

export async function getPlanData() {
  const [boms, allProducts, lots, poLines, packagingTypes, schedule] = await Promise.all([
    db.bom.findMany({
      include: { lines: { include: { materialProduct: true } }, finishedProduct: true },
    }),
    db.product.findMany({
      where: { deletedAt: null },
      select: { code: true, nameEn: true, nameTh: true, unit: true, category: true, pallet: true },
    }),
    db.lot.findMany({ where: { qty: { gt: 0 } }, select: { productCode: true, qty: true } }),
    db.purchaseOrderLine.findMany({
      where: { po: { status: { not: "COMPLETE" } } },
      select: { productCode: true, ordered: true, received: true },
    }),
    getPackagingTypes(),
    getSchedule(),
  ]);

  const prodInfo = new Map(allProducts.map((p) => [p.code, p]));
  const onHand = new Map<string, number>();
  for (const l of lots) onHand.set(l.productCode, (onHand.get(l.productCode) ?? 0) + l.qty);
  const incoming = new Map<string, number>();
  for (const l of poLines)
    incoming.set(l.productCode, (incoming.get(l.productCode) ?? 0) + Math.max(0, l.ordered - l.received));

  const fgs: PlanProduct[] = boms
    .map((b) => ({
      code: b.finishedProductCode,
      name: productLabel(b.finishedProduct.nameEn, b.finishedProduct.nameTh),
      unit: b.finishedProduct.unit,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const packagingProducts: PlanProduct[] = allProducts
    .filter((p) => p.category === "PACKAGING")
    .map((p) => ({ code: p.code, name: productLabel(p.nameEn, p.nameTh), unit: p.unit }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const bomByFg = new Map(boms.map((b) => [b.finishedProductCode, b]));
  const pkgById = new Map(packagingTypes.map((t) => [t.id, t]));

  // Aggregate material requirements across the whole schedule.
  const req = new Map<string, number>();
  const addReq = (code: string, qty: number) => req.set(code, (req.get(code) ?? 0) + qty);
  const dayTotals = new Map<string, { qty: number; lines: number }>();

  for (const row of schedule) {
    const qty = Number(row.qty) || 0;
    if (qty <= 0) continue;
    const dt = dayTotals.get(row.date) ?? { qty: 0, lines: 0 };
    dt.qty += qty;
    dt.lines += 1;
    dayTotals.set(row.date, dt);

    // Raw materials from the finished good's BOM (packaging handled separately).
    const bom = bomByFg.get(row.fgCode);
    if (bom) {
      for (const line of bom.lines) {
        if (line.materialProduct.category === "PACKAGING") continue;
        if (line.qtyPerUnit <= 0) continue;
        const perQty = line.perQty > 0 ? line.perQty : 1;
        addReq(line.materialProductCode, (qty / perQty) * line.qtyPerUnit);
      }
    }
    // Packaging from the chosen packaging type.
    const pkg = pkgById.get(row.pkgTypeId);
    if (pkg) {
      for (const pl of pkg.lines) {
        if (!pl.code || pl.qtyPerUnit <= 0) continue;
        addReq(pl.code, qty * pl.qtyPerUnit);
      }
    }
  }

  const roundUp = (v: number, pack: number) => (pack > 0 ? Math.ceil(v / pack) * pack : Math.ceil(v));
  const rows: MaterialReq[] = [];
  for (const [code, required] of req) {
    const info = prodInfo.get(code);
    if (!info) continue;
    const oh = onHand.get(code) ?? 0;
    const inc = incoming.get(code) ?? 0;
    const net = required - oh - inc;
    rows.push({
      code,
      name: productLabel(info.nameEn, info.nameTh),
      category: info.category,
      categoryLabel: `${CATEGORY_LABEL[info.category].en} (${CATEGORY_LABEL[info.category].th})`,
      unit: info.unit,
      required: Math.round(required),
      onHand: oh,
      incoming: inc,
      toOrder: net > 0 ? roundUp(net, info.pallet) : 0,
      pallet: info.pallet,
    });
  }
  rows.sort((a, b) => {
    if (a.category !== b.category)
      return a.category === "PACKAGING" ? -1 : b.category === "PACKAGING" ? 1 : a.category.localeCompare(b.category);
    return b.toOrder - a.toOrder || a.code.localeCompare(b.code);
  });

  const days: DayTotal[] = [...dayTotals.entries()]
    .map(([date, v]) => ({ date, qty: v.qty, lines: v.lines }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { fgs, packagingProducts, packagingTypes, schedule, rows, days };
}

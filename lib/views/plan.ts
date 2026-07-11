import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { CATEGORY_LABEL } from "@/components/ui/tone";
import { getAppSetting } from "./settings";
import {
  PackagingType,
  ScheduleRow,
  IncomingRow,
  PKG_TYPES_KEY,
  SCHEDULE_KEY,
  INCOMING_KEY,
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
  incoming: number; // total planned incoming ("เรียกเข้า")
  toOrder: number;
  pallet: number;
  shortageDate: string | null; // first day the warehouse stock runs short (yyyy-mm-dd)
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

export async function getIncoming(): Promise<IncomingRow[]> {
  const arr = parseJson<IncomingRow[]>(await getAppSetting(INCOMING_KEY), []);
  return Array.isArray(arr) ? arr : [];
}

export async function getPlanData() {
  const [allProducts, lots, packagingTypes, schedule, incomingRows] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null },
      select: { code: true, nameEn: true, nameTh: true, unit: true, category: true, pallet: true },
    }),
    db.lot.findMany({ where: { qty: { gt: 0 } }, select: { productCode: true, qty: true } }),
    getPackagingTypes(),
    getSchedule(),
    getIncoming(),
  ]);

  // Planned incoming ("เรียกเข้า") per material, by date + total.
  const incomingByDate = new Map<string, Map<string, number>>();
  const incomingTotal = new Map<string, number>();
  for (const r of incomingRows) {
    const qty = Number(r.qty) || 0;
    if (!r.code || qty <= 0) continue;
    incomingTotal.set(r.code, (incomingTotal.get(r.code) ?? 0) + qty);
    let m = incomingByDate.get(r.code);
    if (!m) {
      m = new Map();
      incomingByDate.set(r.code, m);
    }
    m.set(r.date, (m.get(r.date) ?? 0) + qty);
  }

  const prodInfo = new Map(allProducts.map((p) => [p.code, p]));
  const onHand = new Map<string, number>();
  for (const l of lots) onHand.set(l.productCode, (onHand.get(l.productCode) ?? 0) + l.qty);

  const packagingProducts: PlanProduct[] = allProducts
    .filter((p) => p.category === "PACKAGING")
    .map((p) => ({ code: p.code, name: productLabel(p.nameEn, p.nameTh), unit: p.unit }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const pkgById = new Map(packagingTypes.map((t) => [t.id, t]));

  // Aggregate material requirements across the schedule, tracked per production
  // date so we can work out which day the warehouse stock runs short.
  const reqTotal = new Map<string, number>();
  const reqByDate = new Map<string, Map<string, number>>();
  const addReq = (code: string, date: string, qty: number) => {
    reqTotal.set(code, (reqTotal.get(code) ?? 0) + qty);
    let m = reqByDate.get(code);
    if (!m) {
      m = new Map();
      reqByDate.set(code, m);
    }
    m.set(date, (m.get(date) ?? 0) + qty);
  };
  const dayTotals = new Map<string, { qty: number; lines: number }>();

  for (const row of schedule) {
    const qty = Number(row.qty) || 0;
    if (qty <= 0) continue;
    const dt = dayTotals.get(row.date) ?? { qty: 0, lines: 0 };
    dt.qty += qty;
    dt.lines += 1;
    dayTotals.set(row.date, dt);

    // Packaging needed = the chosen type's items × units produced that day.
    const pkg = pkgById.get(row.pkgTypeId);
    if (pkg) {
      for (const pl of pkg.lines) {
        if (!pl.code || pl.qtyPerUnit <= 0) continue;
        addReq(pl.code, row.date, qty * pl.qtyPerUnit);
      }
    }
  }

  const roundUp = (v: number, pack: number) => (pack > 0 ? Math.ceil(v / pack) * pack : Math.ceil(v));
  const rows: MaterialReq[] = [];
  for (const [code, required] of reqTotal) {
    const info = prodInfo.get(code);
    if (!info) continue;
    const oh = onHand.get(code) ?? 0;

    // Walk the days in order (both consumption and planned incoming), so the
    // first day the running balance goes negative is when stock runs out.
    const inc = incomingByDate.get(code);
    const incTotal = incomingTotal.get(code) ?? 0;
    let shortageDate: string | null = null;
    const byDate = reqByDate.get(code) ?? new Map<string, number>();
    const allDates = [...new Set([...byDate.keys(), ...(inc ? inc.keys() : [])])].sort();
    let running = oh;
    for (const d of allDates) {
      running += (inc?.get(d) ?? 0) - (byDate.get(d) ?? 0);
      if (running < 0 && !shortageDate) {
        shortageDate = d;
        break;
      }
    }

    const net = required - oh - incTotal; // warehouse stock + planned incoming; POs ignored
    rows.push({
      code,
      name: productLabel(info.nameEn, info.nameTh),
      category: info.category,
      categoryLabel: `${CATEGORY_LABEL[info.category].en} (${CATEGORY_LABEL[info.category].th})`,
      unit: info.unit,
      required: Math.round(required),
      onHand: oh,
      incoming: incTotal,
      toOrder: net > 0 ? roundUp(net, info.pallet) : 0,
      pallet: info.pallet,
      shortageDate,
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

  return { packagingProducts, packagingTypes, schedule, incoming: incomingRows, rows, days };
}

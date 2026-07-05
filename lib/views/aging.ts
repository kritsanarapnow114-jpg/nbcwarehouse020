import "server-only";
import { db } from "@/lib/db";
import { daysBetween } from "@/lib/calc/date";
import { AGE_BUCKETS, ageBucketIndex, expiryInfo, ExpKind } from "@/lib/calc/aging";
import { getValueByExpiry } from "./dashboard";

export async function getAgeBuckets(today: Date = new Date()) {
  const lots = await db.lot.findMany({ include: { product: true } });
  const buckets = AGE_BUCKETS.map((b) => ({ ...b, value: 0, count: 0 }));
  for (const l of lots) {
    const ageDays = daysBetween(today, l.recvDate);
    const idx = ageBucketIndex(ageDays);
    buckets[idx].value += l.qty * l.product.price;
    buckets[idx].count += 1;
  }
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return buckets.map((b) => ({ ...b, pct: (b.value / max) * 100 }));
}

/** Mirrors the Dashboard's "Value by Time-to-Expiry" widget exactly (fixed 30/90/180d buckets). */
export async function getExpiryBuckets(today: Date = new Date()) {
  return getValueByExpiry(today);
}

export type AgingRow = {
  lotId: string;
  code: string;
  nameEn: string;
  lotNo: string;
  locationCode: string;
  onHand: number;
  unit: string;
  value: number;
  recvDate: string;
  ageDays: number;
  mfgDate: string | null;
  expDate: string | null;
  expKind: ExpKind;
  expLabel: string;
  daysLeft: number | null;
};

export async function getAgingRows(opts: {
  filter?: "near" | "expired" | "all";
  thresholdDays: number;
  today?: Date;
}): Promise<AgingRow[]> {
  const today = opts.today ?? new Date();
  const lots = await db.lot.findMany({
    include: { product: true },
    orderBy: { recvDate: "asc" },
  });

  const rows: AgingRow[] = lots.map((l) => {
    const info = expiryInfo(l.expDate, today, opts.thresholdDays);
    return {
      lotId: l.id,
      code: l.productCode,
      nameEn: l.product.nameEn,
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      onHand: l.qty,
      unit: l.product.unit,
      value: l.qty * l.product.price,
      recvDate: l.recvDate.toISOString(),
      ageDays: daysBetween(today, l.recvDate),
      mfgDate: l.mfgDate ? l.mfgDate.toISOString() : null,
      expDate: l.expDate ? l.expDate.toISOString() : null,
      expKind: info.kind,
      expLabel: info.label,
      daysLeft: info.daysLeft,
    };
  });

  const filtered = rows.filter((r) => {
    if (opts.filter === "near") return r.expKind === "near";
    if (opts.filter === "expired") return r.expKind === "expired";
    return true;
  });

  return filtered.sort((a, b) => b.ageDays - a.ageDays);
}

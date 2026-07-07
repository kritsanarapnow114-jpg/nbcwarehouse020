import "server-only";
import { db } from "@/lib/db";
import {
  lotFloorArea,
  binCapacity,
  occupancyPct,
  occupancyBarTone,
  binStatusTone,
  BAR_TONE_COLOR,
  BinTone,
} from "@/lib/calc/storage";
import { ZONE_LABEL } from "@/components/ui/tone";
import { todayBangkok } from "@/lib/calc/date";

export type BinContent = {
  productCode: string;
  nameEn: string;
  lotNo: string;
  qty: number;
  unit: string;
  area: number;
  stackLevels: number;
  lotStatus: "OK" | "QC";
  expired: boolean;
};

export type LocationRow = {
  code: string;
  zone: string;
  zoneLabel: string;
  width: number;
  length: number;
  capArea: number;
  usedArea: number;
  pct: number;
  barColor: string;
  tone: BinTone;
  contents: BinContent[];
};

async function loadAllRows(): Promise<LocationRow[]> {
  const [locations, lots] = await Promise.all([
    db.location.findMany({ orderBy: { code: "asc" } }),
    // Depleted lots (qty 0) don't occupy the bin — leave them out of contents.
    db.lot.findMany({ where: { qty: { gt: 0 } }, include: { product: true } }),
  ]);

  const today = todayBangkok();
  const contentsByLoc = new Map<string, BinContent[]>();
  for (const l of lots) {
    const area = lotFloorArea(
      l.qty,
      l.product.width,
      l.product.length,
      l.product.stackLevels,
      l.product.pallet
    );
    const entry: BinContent = {
      productCode: l.product.code,
      nameEn: l.product.nameEn,
      lotNo: l.lotNo,
      qty: l.qty,
      unit: l.product.unit,
      area: Math.round(area * 100) / 100,
      stackLevels: l.product.stackLevels,
      lotStatus: l.status,
      expired: !!(l.expDate && l.expDate < today),
    };
    const arr = contentsByLoc.get(l.locationCode) ?? [];
    arr.push(entry);
    contentsByLoc.set(l.locationCode, arr);
  }

  return locations.map((loc) => {
    const contents = contentsByLoc.get(loc.code) ?? [];
    const capArea = binCapacity(loc.width, loc.length);
    const usedArea = contents.reduce((s, c) => s + c.area, 0);
    const pct = occupancyPct(usedArea, capArea);
    const tone = binStatusTone({
      empty: contents.length === 0,
      hasQcHold: contents.some((c) => c.lotStatus === "QC"),
      hasExpired: contents.some((c) => c.expired),
      pctOccupied: pct,
    });
    return {
      code: loc.code,
      zone: loc.zone,
      zoneLabel: ZONE_LABEL[loc.zone],
      width: loc.width,
      length: loc.length,
      capArea: Math.round(capArea * 100) / 100,
      usedArea: Math.round(usedArea * 100) / 100,
      pct: Math.round(pct * 10) / 10,
      barColor: BAR_TONE_COLOR[occupancyBarTone(pct)],
      tone,
      contents,
    };
  });
}

/** Bin-level rows, optionally filtered by zone (A-E). */
export async function getLocationRows(opts?: { zone?: string }): Promise<LocationRow[]> {
  const rows = await loadAllRows();
  return opts?.zone ? rows.filter((r) => r.zone === opts.zone) : rows;
}

/**
 * Locations page summary card: total storage used across ALL zones A-E.
 * (Unlike the Dashboard's Storage Utilization widget, which omits zone E,
 * this always includes every zone regardless of the page's zone filter.)
 */
export async function getLocationSummary(): Promise<{
  totalUsed: number;
  totalCap: number;
  totalPct: number;
  totalColor: string;
  binCount: number;
  avgOcc: number;
}> {
  const rows = await loadAllRows();
  const totalUsed = rows.reduce((s, r) => s + r.usedArea, 0);
  const totalCap = rows.reduce((s, r) => s + r.capArea, 0);
  const totalPct = occupancyPct(totalUsed, totalCap);
  const binCount = rows.length;
  const avgOcc = binCount > 0 ? rows.reduce((s, r) => s + r.pct, 0) / binCount : 0;
  return {
    totalUsed: Math.round(totalUsed * 100) / 100,
    totalCap: Math.round(totalCap * 100) / 100,
    totalPct: Math.round(totalPct * 10) / 10,
    totalColor: BAR_TONE_COLOR[occupancyBarTone(totalPct)],
    binCount,
    avgOcc: Math.round(avgOcc * 10) / 10,
  };
}

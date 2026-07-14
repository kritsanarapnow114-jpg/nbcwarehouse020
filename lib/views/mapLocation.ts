import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { todayBangkok, fmtDateBE } from "@/lib/calc/date";
import { binCapacity, lotFloorArea } from "@/lib/calc/storage";

// Default pallet footprint in m² (EUR 0.8×1.2) — only used to estimate the
// pallet capacity of an EMPTY bin, where the pallet size is not yet known.
const DEFAULT_PALLET_M2 = 0.96;

export type MapLot = {
  productCode: string;
  name: string;
  lotNo: string;
  pallets: number;
  qty: number;
  unit: string;
  status: "OK" | "QC";
  expired: boolean;
  containerType: string;
  inDate: string;
  expDate: string | null;
};

export type MapCell = {
  id: string; // location code (unique)
  code: string; // display code
  zone: string; // derived group: PACA / PACB / SEMA… / A / B
  kind: "rack" | "floor";
  bayCode: string; // rack: PACA01 ; floor: same as code
  level: number; // rack level (1..n); floor = 0
  width: number;
  length: number;
  areaCap: number; // bin floor area (m²)
  areaUsed: number; // area occupied by stored pallets (m²)
  capacity: number; // pallet capacity — depends on the pallet size stored
  pallets: number;
  stack: number; // how many pallets high the stored product stacks (ซ้อน 1-3)
  status: "free" | "partial" | "full";
  containerType: string; // dominant
  topLot: string | null;
  lots: MapLot[];
};

export type RackZone = {
  zone: string;
  kind: "rack";
  cap: number;
  used: number;
  bays: { bayCode: string; levels: MapCell[] }[]; // levels sorted high→low
};

export type FloorZone = {
  zone: string;
  kind: "floor";
  cap: number;
  used: number;
  tiles: MapCell[];
};

export type MapSummary = {
  positions: number;
  free: number;
  partial: number;
  full: number;
  pallets: number;
  areaUsed: number; // m²
  areaCap: number; // m²
  utilPct: number; // by area
};

const RACK_RE = /^(PAC[AB]|SEM[ABCD])[-_ ]*0*(\d+)[-_ ]*L0*(\d+)$/i;
const FLOOR_RE = /^([A-Z]+)[-_ ]*0*(\d+)$/;

function parseCode(code: string): { kind: "rack" | "floor"; zone: string; bayCode: string; level: number } | null {
  const c = code.trim().toUpperCase();
  const r = c.match(RACK_RE);
  if (r) {
    const zone = r[1];
    const bayNo = r[2].padStart(2, "0");
    return { kind: "rack", zone, bayCode: `${zone}${bayNo}`, level: parseInt(r[3], 10) };
  }
  const f = c.match(FLOOR_RE);
  if (f) {
    return { kind: "floor", zone: f[1], bayCode: c, level: 0 };
  }
  return null;
}

export async function getMapLocationData() {
  const [locations, lots] = await Promise.all([
    db.location.findMany({ orderBy: { code: "asc" } }),
    db.lot.findMany({ where: { qty: { gt: 0 } }, include: { product: true } }),
  ]);
  const today = todayBangkok();

  const lotsByLoc = new Map<string, MapLot[]>();
  const areaByLoc = new Map<string, number>(); // m² occupied per location
  const stackByLoc = new Map<string, number>(); // max pallets-high stored per location
  for (const l of lots) {
    const pallets = Math.max(1, Math.ceil(l.qty / Math.max(1, l.product.pallet)));
    const area = lotFloorArea(l.qty, l.product.width, l.product.length, l.product.stackLevels, l.product.pallet);
    areaByLoc.set(l.locationCode, (areaByLoc.get(l.locationCode) ?? 0) + area);
    stackByLoc.set(l.locationCode, Math.max(stackByLoc.get(l.locationCode) ?? 1, l.product.stackLevels || 1));
    const entry: MapLot = {
      productCode: l.product.code,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.lotNo,
      pallets,
      qty: l.qty,
      unit: l.product.unit,
      status: l.status,
      expired: !!(l.expDate && l.expDate < today),
      containerType: l.product.containerType || "OTHER",
      inDate: fmtDateBE(l.recvDate),
      expDate: l.expDate ? fmtDateBE(l.expDate) : null,
    };
    const arr = lotsByLoc.get(l.locationCode) ?? [];
    arr.push(entry);
    lotsByLoc.set(l.locationCode, arr);
  }

  const cells: MapCell[] = [];
  for (const loc of locations) {
    const parsed = parseCode(loc.code);
    if (!parsed) continue;
    const cellLots = (lotsByLoc.get(loc.code) ?? []).sort((a, b) => b.pallets - a.pallets);
    const pallets = cellLots.reduce((s, l) => s + l.pallets, 0);
    // Measure by real floor area (m²). How many pallets fit depends on the
    // pallet size actually stored — small pallets take less area, so more fit.
    const areaCap = binCapacity(loc.width, loc.length);
    const areaUsed = areaByLoc.get(loc.code) ?? 0;
    const footPerPallet = pallets > 0 ? areaUsed / pallets : DEFAULT_PALLET_M2;
    const freeArea = Math.max(0, areaCap - areaUsed);
    const freeSlots = footPerPallet > 0 ? Math.floor(freeArea / footPerPallet) : 0;
    const capacity = Math.max(1, pallets + freeSlots);
    // dominant container type = the one holding the most pallets
    const byType = new Map<string, number>();
    for (const l of cellLots) byType.set(l.containerType, (byType.get(l.containerType) ?? 0) + l.pallets);
    let dom = "OTHER";
    let best = -1;
    for (const [t, n] of byType) if (n > best) ((best = n), (dom = t));
    cells.push({
      id: loc.code,
      code: loc.code,
      zone: parsed.zone,
      kind: parsed.kind,
      bayCode: parsed.bayCode,
      level: parsed.level,
      width: loc.width,
      length: loc.length,
      areaCap: Math.round(areaCap * 10) / 10,
      areaUsed: Math.round(areaUsed * 10) / 10,
      capacity,
      pallets,
      stack: stackByLoc.get(loc.code) ?? 1,
      status: pallets === 0 ? "free" : freeArea < footPerPallet ? "full" : "partial",
      containerType: dom,
      topLot: cellLots[0]?.name ?? null,
      lots: cellLots,
    });
  }

  // Group racks by zone → bay → levels (high to low)
  const rackZones = new Map<string, MapCell[]>();
  const floorZones = new Map<string, MapCell[]>();
  for (const c of cells) {
    (c.kind === "rack" ? rackZones : floorZones).set(
      c.zone,
      [...((c.kind === "rack" ? rackZones : floorZones).get(c.zone) ?? []), c]
    );
  }

  const racks: RackZone[] = [...rackZones.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([zone, zcells]) => {
      const bayMap = new Map<string, MapCell[]>();
      for (const c of zcells) bayMap.set(c.bayCode, [...(bayMap.get(c.bayCode) ?? []), c]);
      const bays = [...bayMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([bayCode, lv]) => ({ bayCode, levels: lv.sort((a, b) => b.level - a.level) }));
      const cap = zcells.reduce((s, c) => s + c.capacity, 0);
      const used = zcells.reduce((s, c) => s + c.pallets, 0);
      return { zone, kind: "rack" as const, cap, used, bays };
    });

  const floors: FloorZone[] = [...floorZones.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([zone, zcells]) => ({
      zone,
      kind: "floor" as const,
      cap: zcells.reduce((s, c) => s + c.capacity, 0),
      used: zcells.reduce((s, c) => s + c.pallets, 0),
      tiles: zcells.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    }));

  let free = 0;
  let partial = 0;
  let full = 0;
  let pallets = 0;
  let areaUsed = 0;
  let areaCap = 0;
  for (const c of cells) {
    if (c.status === "free") free++;
    else if (c.status === "full") full++;
    else partial++;
    pallets += c.pallets;
    areaUsed += c.areaUsed;
    areaCap += c.areaCap;
  }
  const summary: MapSummary = {
    positions: cells.length,
    free,
    partial,
    full,
    pallets,
    areaUsed: Math.round(areaUsed),
    areaCap: Math.round(areaCap),
    utilPct: areaCap > 0 ? Math.round((areaUsed / areaCap) * 100) : 0,
  };

  const zones = [...new Set(cells.map((c) => c.zone))].sort();

  return { racks, floors, summary, zones };
}

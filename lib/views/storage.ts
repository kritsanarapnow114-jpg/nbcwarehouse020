import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { todayBangkok } from "@/lib/calc/date";
import { SLOT_BOXES } from "@/lib/storageLayout";

export type RackContent = {
  productCode: string;
  name: string;
  lotNo: string;
  qty: number;
  unit: string;
  locationCode: string;
  status: "OK" | "QC";
  expired: boolean;
};

export type RackInfo = {
  code: string;
  lotCount: number;
  totalQty: number;
  hasQc: boolean;
  hasExpired: boolean;
  topProduct: string | null; // main product code stored
  contents: RackContent[];
};

export type StorageSummary = {
  total: number; // total pallet positions on the map
  occupied: number; // positions holding something
  free: number; // empty positions
  qc: number; // positions with a QC hold
  expired: number; // positions with expired stock
  utilPct: number; // occupied / total
};

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Rack codes grouped by letter prefix → the set of numbers that exist, so we can
 *  match location codes that use ranges (B07-08), no leading zero (B7) or a level
 *  suffix (PACA01-L2). */
function buildPrefixIndex(rackCodes: string[]): Map<string, Set<number>> {
  const idx = new Map<string, Set<number>>();
  for (const r of rackCodes) {
    const m = r.match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const set = idx.get(m[1]) ?? new Set<number>();
    set.add(parseInt(m[2], 10));
    idx.set(m[1], set);
  }
  return idx;
}

/** All racks a location code occupies. Handles: exact (B07), no leading zero
 *  (B7), a level suffix (PACA01-L2), and ranges (B07-08 → B07 & B08). */
function racksForLocation(locCode: string, idx: Map<string, Set<number>>): string[] {
  // Drop a trailing level marker so it doesn't get read as a range end.
  const cleaned = locCode.toUpperCase().replace(/[-_. ]?L\d{1,2}$/i, "");
  const m = cleaned.match(/^([A-Z]+)[-_. ]?0*(\d+)(?:\s*-\s*(?:[A-Z]+[-_. ]?)?0*(\d+))?$/);
  if (!m) return [];
  const prefix = m[1];
  const nums = idx.get(prefix);
  if (!nums) return [];
  const n1 = parseInt(m[2], 10);
  const n2 = m[3] ? parseInt(m[3], 10) : n1;
  const out: string[] = [];
  for (let n = Math.min(n1, n2); n <= Math.max(n1, n2); n++) {
    if (nums.has(n)) out.push(prefix + String(n).padStart(2, "0"));
  }
  return out;
}

export async function getStorageMap(): Promise<{
  racks: Record<string, RackInfo>;
  summary: StorageSummary;
}> {
  const rackCodes = SLOT_BOXES.map((b) => norm(b.code));
  const prefixIdx = buildPrefixIndex(rackCodes);
  const lots = await db.lot.findMany({
    where: { qty: { gt: 0 } },
    include: { product: true },
  });
  const today = todayBangkok();

  const map: Record<string, RackInfo> = {};
  const productQty: Record<string, Map<string, number>> = {};

  for (const l of lots) {
    const matched = racksForLocation(l.locationCode, prefixIdx);
    if (matched.length === 0) continue;
    const expired = !!(l.expDate && l.expDate < today);
    for (const rack of matched) {
      if (!map[rack]) {
        map[rack] = {
          code: rack,
          lotCount: 0,
          totalQty: 0,
          hasQc: false,
          hasExpired: false,
          topProduct: null,
          contents: [],
        };
        productQty[rack] = new Map();
      }
      const info = map[rack];
      info.lotCount++;
      info.totalQty += l.qty;
      if (l.status === "QC") info.hasQc = true;
      if (expired) info.hasExpired = true;
      info.contents.push({
        productCode: l.product.code,
        name: productLabel(l.product.nameEn, l.product.nameTh),
        lotNo: l.lotNo,
        qty: l.qty,
        unit: l.product.unit,
        locationCode: l.locationCode,
        status: l.status,
        expired,
      });
      productQty[rack].set(
        l.product.code,
        (productQty[rack].get(l.product.code) ?? 0) + l.qty
      );
    }
  }

  // Pick the highest-quantity product per rack as its headline.
  for (const rack of Object.keys(map)) {
    let top: string | null = null;
    let best = -1;
    for (const [code, q] of productQty[rack]) {
      if (q > best) {
        best = q;
        top = code;
      }
    }
    map[rack].topProduct = top;
    map[rack].contents.sort((a, b) => b.qty - a.qty);
  }

  // Every rack cell on the map is one pallet position — free unless a lot sits there.
  const total = rackCodes.length;
  let occupied = 0;
  let qc = 0;
  let expired = 0;
  for (const code of rackCodes) {
    const info = map[code];
    if (info && info.lotCount > 0) {
      occupied++;
      if (info.hasQc) qc++;
      if (info.hasExpired) expired++;
    }
  }
  const summary: StorageSummary = {
    total,
    occupied,
    free: total - occupied,
    qc,
    expired,
    utilPct: total > 0 ? Math.round((occupied / total) * 100) : 0,
  };

  return { racks: map, summary };
}

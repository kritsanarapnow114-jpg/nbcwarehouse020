import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { todayBangkok } from "@/lib/calc/date";
import { MAP_BLOCKS } from "@/lib/warehouseMap";

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

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Which rack (if any) a location code belongs to: exact match, or the rack
 *  code followed by a level suffix (L1/L2/L3, "-L1", "L2", …). */
function rackOfLocation(locCode: string, rackCodes: string[]): string | null {
  const n = norm(locCode);
  for (const r of rackCodes) {
    if (n === r) return r;
    if (n.startsWith(r)) {
      const rest = n.slice(r.length);
      if (/^L?[0-9]{1,2}$/.test(rest)) return r; // level suffix
    }
  }
  return null;
}

export async function getRackMap(): Promise<Record<string, RackInfo>> {
  const rackCodes = MAP_BLOCKS.filter((b) => b.k === "rack").map((b) => norm(b.t));
  const lots = await db.lot.findMany({
    where: { qty: { gt: 0 } },
    include: { product: true },
  });
  const today = todayBangkok();

  const map: Record<string, RackInfo> = {};
  const productQty: Record<string, Map<string, number>> = {};

  for (const l of lots) {
    const rack = rackOfLocation(l.locationCode, rackCodes);
    if (!rack) continue;
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
    const expired = !!(l.expDate && l.expDate < today);
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

  return map;
}

import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { CATEGORY_LABEL } from "@/components/ui/tone";
import { getAppSetting } from "./settings";

export const PLAN_KEY = "productionPlan"; // JSON: { [finishedGoodCode]: plannedQty }

export type PlanFG = { code: string; name: string; unit: string; qty: number };
export type MaterialReq = {
  code: string;
  name: string;
  category: string;
  categoryLabel: string;
  unit: string;
  required: number; // total needed for the plan
  onHand: number; // current stock
  incoming: number; // open-PO quantities still to arrive
  toOrder: number; // shortfall rounded up to a whole pallet/pack
  pallet: number;
};

export async function getProductionPlan(): Promise<Record<string, number>> {
  const raw = await getAppSetting(PLAN_KEY);
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? (j as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/**
 * Explode the production plan through each finished good's BOM to work out how
 * much of every material (packaging + raw) is needed, then net off current
 * stock and open-PO incoming to suggest an order quantity.
 */
export async function getPackagingPlan(): Promise<{ fgs: PlanFG[]; rows: MaterialReq[] }> {
  const [boms, lots, poLines, plan] = await Promise.all([
    db.bom.findMany({
      include: { lines: { include: { materialProduct: true } }, finishedProduct: true },
    }),
    db.lot.findMany({ where: { qty: { gt: 0 } }, select: { productCode: true, qty: true } }),
    db.purchaseOrderLine.findMany({
      where: { po: { status: { not: "COMPLETE" } } },
      select: { productCode: true, ordered: true, received: true },
    }),
    getProductionPlan(),
  ]);

  const onHand = new Map<string, number>();
  for (const l of lots) onHand.set(l.productCode, (onHand.get(l.productCode) ?? 0) + l.qty);

  const incoming = new Map<string, number>();
  for (const l of poLines)
    incoming.set(l.productCode, (incoming.get(l.productCode) ?? 0) + Math.max(0, l.ordered - l.received));

  const fgs: PlanFG[] = boms
    .map((b) => ({
      code: b.finishedProductCode,
      name: productLabel(b.finishedProduct.nameEn, b.finishedProduct.nameTh),
      unit: b.finishedProduct.unit,
      qty: plan[b.finishedProductCode] ?? 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  type Prod = (typeof boms)[number]["lines"][number]["materialProduct"];
  const reqByCode = new Map<string, { req: number; prod: Prod }>();
  for (const b of boms) {
    const planned = plan[b.finishedProductCode] ?? 0;
    if (planned <= 0) continue;
    for (const line of b.lines) {
      if (line.qtyPerUnit <= 0) continue;
      const perQty = line.perQty > 0 ? line.perQty : 1;
      const need = (planned / perQty) * line.qtyPerUnit;
      const cur = reqByCode.get(line.materialProductCode) ?? { req: 0, prod: line.materialProduct };
      cur.req += need;
      reqByCode.set(line.materialProductCode, cur);
    }
  }

  const roundUp = (v: number, pack: number) => (pack > 0 ? Math.ceil(v / pack) * pack : Math.ceil(v));

  const rows: MaterialReq[] = [];
  for (const [code, { req, prod }] of reqByCode) {
    const oh = onHand.get(code) ?? 0;
    const inc = incoming.get(code) ?? 0;
    const net = req - oh - inc;
    rows.push({
      code,
      name: productLabel(prod.nameEn, prod.nameTh),
      category: prod.category,
      categoryLabel: `${CATEGORY_LABEL[prod.category].en} (${CATEGORY_LABEL[prod.category].th})`,
      unit: prod.unit,
      required: Math.round(req),
      onHand: oh,
      incoming: inc,
      toOrder: net > 0 ? roundUp(net, prod.pallet) : 0,
      pallet: prod.pallet,
    });
  }
  // Packaging first, then by shortfall (biggest order first).
  rows.sort((a, b) => {
    if (a.category !== b.category) return a.category === "PACKAGING" ? -1 : b.category === "PACKAGING" ? 1 : a.category.localeCompare(b.category);
    return b.toOrder - a.toOrder || a.code.localeCompare(b.code);
  });

  return { fgs, rows };
}

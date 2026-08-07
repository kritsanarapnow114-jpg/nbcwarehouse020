import "server-only";
import { db } from "@/lib/db";
import { eligibleLots, fefoLotFor } from "@/lib/calc/fefo";
import { peekNextDocNumber } from "@/lib/calc/docNumber";
import { productLabel } from "@/lib/calc/productName";

type EligibleLot = {
  id: string;
  lotNo: string;
  qty: number;
  status: "OK" | "QC";
  expDate: Date | null;
  locationCode: string;
};

/**
 * The same lot in the same location can exist as several stock records (received
 * more than once). It's one physical pile, so collapse them into ONE dropdown
 * option (summing on-hand). The option's id is the FEFO-first record of the group
 * (`eligible` is already FEFO-ordered, so the group's first element); confirming
 * an issue draws across every record of the group.
 */
function mergeLotOptions(eligible: EligibleLot[], fefoId: string | null) {
  const groups = new Map<string, EligibleLot[]>();
  for (const l of eligible) {
    const key = `${l.lotNo}||${l.locationCode}`;
    const g = groups.get(key);
    if (g) g.push(l);
    else groups.set(key, [l]);
  }
  return [...groups.values()].map((g) => ({
    id: g[0].id,
    lotNo: g[0].lotNo,
    locationCode: g[0].locationCode,
    qty: g.reduce((s, x) => s + x.qty, 0),
    expDate: g[0].expDate ? g[0].expDate.toISOString() : null,
    isFefo: g.some((x) => x.id === fefoId),
    nonStock: false,
  }));
}

export async function getIssueFormData() {
  const [products, holdings, docNo, customers] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null },
      include: { lots: true },
      orderBy: { code: "asc" },
    }),
    db.nonStockHolding.findMany({ where: { qty: { gt: 0 } } }),
    peekNextDocNumber("ISS"),
    db.customer.findMany({
      where: { active: true },
      include: { shipTos: { orderBy: [{ isDefault: "desc" }, { label: "asc" }] } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Non-Stock holdings, grouped by product — they're issuable too (decrement the
  // holding). Their option id is the holdingId, flagged nonStock.
  const holdingsByProduct = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const arr = holdingsByProduct.get(h.productCode) ?? [];
    arr.push(h);
    holdingsByProduct.set(h.productCode, arr);
  }

  const items = products
    .map((p) => {
      const eligible = eligibleLots(
        p.lots.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          qty: l.qty,
          status: l.status,
          expDate: l.expDate,
          mfgDate: l.mfgDate,
          recvDate: l.recvDate,
          locationCode: l.locationCode,
        }))
      );
      const fefo = fefoLotFor(
        p.lots.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          qty: l.qty,
          status: l.status,
          expDate: l.expDate,
          mfgDate: l.mfgDate,
          recvDate: l.recvDate,
          locationCode: l.locationCode,
        }))
      );
      const holdingOpts = (holdingsByProduct.get(p.code) ?? []).map((h) => ({
        id: h.id,
        lotNo: h.lotNo,
        locationCode: h.locationCode,
        qty: h.qty,
        expDate: h.expDate ? h.expDate.toISOString() : null,
        isFefo: false,
        nonStock: true,
      }));
      return {
        code: p.code,
        name: productLabel(p.nameEn, p.nameTh),
        unit: p.unit,
        price: p.price,
        fefoLotId: fefo?.id ?? null,
        lots: [...mergeLotOptions(eligible, fefo?.id ?? null), ...holdingOpts],
      };
    })
    .filter((p) => p.lots.length > 0);

  const customerOpts = customers.map((c) => ({
    id: c.id,
    code: c.code ?? "",
    name: c.name,
    shipTos: c.shipTos.map((s) => ({
      id: s.id,
      label: s.label,
      address: s.address,
      isDefault: s.isDefault,
    })),
  }));

  return { docNo, products: items, customers: customerOpts };
}

export type IssueFormData = Awaited<ReturnType<typeof getIssueFormData>>;

export async function getRecentIssues(limit = 400) {
  const issues = await db.issue.findMany({
    include: {
      lines: { include: { product: true, selectedLot: true, nonStockHolding: true } },
    },
    orderBy: { docDate: "desc" },
    take: limit,
  });

  return issues.map((i) => ({
    id: i.id,
    docNo: i.docNo,
    issueTo: i.issueTo,
    shipToName: i.shipToName ?? "",
    shipToAddress: i.shipToAddress ?? "",
    materialDoc: i.materialDoc ?? "",
    remark: i.remark ?? "",
    stockType: i.stockType,
    docDate: i.docDate.toISOString(),
    reversedAt: i.reversedAt ? i.reversedAt.toISOString() : null,
    lineCount: i.lines.length,
    totalQty: i.lines.reduce((s, l) => s + l.qty, 0),
    lines: i.lines.map((l) => ({
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.selectedLot?.lotNo ?? l.nonStockHolding?.lotNo ?? "-",
      locationCode: l.selectedLot?.locationCode ?? l.nonStockHolding?.locationCode ?? "-",
      qty: l.qty,
      unit: l.product.unit,
    })),
  }));
}

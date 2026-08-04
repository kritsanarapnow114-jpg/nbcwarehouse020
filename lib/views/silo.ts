import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { eligibleLots, fefoLotFor } from "@/lib/calc/fefo";
import { splitBags, r3 } from "@/lib/calc/siloBags";

/**
 * Products with stock, each with their eligible lots FEFO-ordered (the earliest-
 * expiry lot flagged), plus each product's standard pallet/bag size and the
 * operator names. Same shape spirit as the Issue form so staging can auto-FEFO.
 */
export async function getSiloFormData() {
  const [products, users] = await Promise.all([
    db.product.findMany({ where: { deletedAt: null }, include: { lots: true }, orderBy: { code: "asc" } }),
    db.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const items = products
    .map((p) => {
      const mapped = p.lots.map((l) => ({
        id: l.id,
        lotNo: l.lotNo,
        qty: l.qty,
        status: l.status,
        expDate: l.expDate,
        mfgDate: l.mfgDate,
        recvDate: l.recvDate,
        locationCode: l.locationCode,
      }));
      const eligible = eligibleLots(mapped);
      const fefo = fefoLotFor(mapped);

      const groups = new Map<string, typeof eligible>();
      for (const l of eligible) {
        const key = `${l.lotNo}||${l.locationCode}`;
        const g = groups.get(key);
        if (g) g.push(l);
        else groups.set(key, [l]);
      }
      const lots = [...groups.values()].map((g) => ({
        id: g[0].id,
        lotNo: g[0].lotNo,
        locationCode: g[0].locationCode,
        qty: g.reduce((s, x) => s + x.qty, 0),
        expDate: g[0].expDate ? g[0].expDate.toISOString() : null,
        isFefo: g.some((x) => x.id === fefo?.id),
      }));

      return {
        code: p.code,
        name: productLabel(p.nameEn, p.nameTh),
        unit: p.unit,
        pallet: p.pallet,
        fefoLotId: fefo?.id ?? null,
        lots,
      };
    })
    .filter((p) => p.lots.length > 0);

  return { products: items, operators: users.map((u) => u.name) };
}

export type SiloFormData = Awaited<ReturnType<typeof getSiloFormData>>;
export type BagStatus = "none" | "loading" | "done";
export type SiloBag = {
  bagNo: number;
  size: number;
  isPartial: boolean;
  status: BagStatus;
  loadId: string | null;
  silo: string;
  startedAt: string | null;
  loadedAt: string | null;
};

/** Items issued and waiting to be loaded, each split into bags with load state. */
export async function getStagingList() {
  const rows = await db.siloStaging.findMany({
    include: { product: true, loads: { orderBy: { bagNo: "asc" } } },
    orderBy: { stagedAt: "desc" },
  });
  return rows.map((s) => {
    const rawBags = splitBags(s.qtyStaged, s.palletSize);
    const byBag = new Map<number, (typeof s.loads)[number]>();
    for (const ld of s.loads) if (ld.bagNo != null) byBag.set(ld.bagNo, ld);
    const bags: SiloBag[] = rawBags.map((b) => {
      const ld = byBag.get(b.bagNo);
      const status: BagStatus = !ld ? "none" : ld.loadedAt ? "done" : "loading";
      return {
        bagNo: b.bagNo,
        size: b.size,
        isPartial: b.isPartial,
        status,
        loadId: ld?.id ?? null,
        silo: ld?.silo ?? "",
        startedAt: ld?.startedAt ? ld.startedAt.toISOString() : null,
        loadedAt: ld?.loadedAt ? ld.loadedAt.toISOString() : null,
      };
    });
    return {
      id: s.id,
      docNo: s.docNo,
      productCode: s.productCode,
      name: productLabel(s.product.nameEn, s.product.nameTh),
      unit: s.product.unit,
      lotNo: s.lotNo,
      sourceLoc: s.sourceLoc,
      palletSize: s.palletSize ?? null,
      machine: s.machine ?? "",
      plannedMin: s.plannedMin ?? 0,
      qtyStaged: s.qtyStaged,
      qtyLoaded: s.qtyLoaded,
      remaining: r3(s.qtyStaged - s.qtyLoaded),
      stagedBy: s.stagedBy ?? "",
      stagedAt: s.stagedAt.toISOString(),
      bags,
    };
  });
}

export type StagingRow = Awaited<ReturnType<typeof getStagingList>>[number];

/** Recent finished load events (across all staged items) for the history table. */
export async function getLoadHistory(limit = 200) {
  const loads = await db.siloLoad.findMany({
    where: { loadedAt: { not: null } },
    include: { staging: { include: { product: true } } },
    orderBy: { loadedAt: "desc" },
    take: limit,
  });
  return loads.map((ld) => ({
    id: ld.id,
    stagingId: ld.stagingId,
    productCode: ld.staging.productCode,
    name: productLabel(ld.staging.product.nameEn, ld.staging.product.nameTh),
    lotNo: ld.staging.lotNo,
    bagNo: ld.bagNo ?? null,
    qty: ld.qty,
    unit: ld.staging.product.unit,
    machine: ld.machine ?? "",
    silo: ld.silo ?? "",
    operator: ld.operator ?? "",
    startedAt: ld.startedAt ? ld.startedAt.toISOString() : null,
    loadedAt: ld.loadedAt ? ld.loadedAt.toISOString() : null,
    stagingDoc: ld.staging.docNo,
  }));
}

export type LoadHistoryRow = Awaited<ReturnType<typeof getLoadHistory>>[number];

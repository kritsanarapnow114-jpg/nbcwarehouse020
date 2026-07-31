import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";
import { eligibleLots, fefoLotFor } from "@/lib/calc/fefo";

/** Round to 3 decimals to avoid float dust in bag/remaining math. */
function r3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Products with stock, each with their eligible lots FEFO-ordered (the earliest-
 * expiry lot flagged), plus each product's standard pallet/bag size and the
 * operator names. Same shape spirit as the Issue form so staging can auto-FEFO.
 */
export async function getSiloFormData() {
  const [products, users] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null },
      include: { lots: true },
      orderBy: { code: "asc" },
    }),
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

      // Collapse the same lot+location (several stock records) into one option.
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
export type SiloBag = {
  bagNo: number;
  size: number;
  isPartial: boolean;
  loaded: boolean;
  load: { qty: number; machine: string; silo: string; operator: string; loadedAt: string } | null;
};

/** Split a staged qty into individual bags of pallet size, with a final partial bag. */
function splitBags(qtyStaged: number, palletSize: number | null): { bagNo: number; size: number; isPartial: boolean }[] {
  const p = palletSize && palletSize > 0 ? palletSize : 0;
  if (p <= 0) return [{ bagNo: 1, size: r3(qtyStaged), isPartial: true }];
  const full = Math.floor(r3(qtyStaged / p));
  const bags: { bagNo: number; size: number; isPartial: boolean }[] = [];
  for (let i = 0; i < full; i++) bags.push({ bagNo: i + 1, size: p, isPartial: false });
  const rem = r3(qtyStaged - full * p);
  if (rem > 0.0001) bags.push({ bagNo: full + 1, size: rem, isPartial: true });
  if (bags.length === 0) bags.push({ bagNo: 1, size: r3(qtyStaged), isPartial: true });
  return bags;
}

/** Items issued and waiting to be loaded (remaining qty > 0), with their bags & loads. */
export async function getStagingList() {
  const rows = await db.siloStaging.findMany({
    include: { product: true, loads: { orderBy: { loadedAt: "asc" } } },
    orderBy: { stagedAt: "desc" },
  });
  return rows.map((s) => {
    const rawBags = splitBags(s.qtyStaged, s.palletSize);
    const byBag = new Map<number, (typeof s.loads)[number]>();
    for (const ld of s.loads) if (ld.bagNo != null) byBag.set(ld.bagNo, ld);
    const bags: SiloBag[] = rawBags.map((b) => {
      const ld = byBag.get(b.bagNo);
      return {
        bagNo: b.bagNo,
        size: b.size,
        isPartial: b.isPartial,
        loaded: !!ld,
        load: ld
          ? {
              qty: ld.qty,
              machine: ld.machine ?? "",
              silo: ld.silo ?? "",
              operator: ld.operator ?? "",
              loadedAt: ld.loadedAt.toISOString(),
            }
          : null,
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

/** Recent load events (across all staged items) for the history table. */
export async function getLoadHistory(limit = 200) {
  const loads = await db.siloLoad.findMany({
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
    loadedAt: ld.loadedAt.toISOString(),
    stagingDoc: ld.staging.docNo,
  }));
}

export type LoadHistoryRow = Awaited<ReturnType<typeof getLoadHistory>>[number];

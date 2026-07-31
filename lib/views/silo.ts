import "server-only";
import { db } from "@/lib/db";
import { productLabel } from "@/lib/calc/productName";

/** Stock lots available to stage for the SILO, plus operator names for the picker. */
export async function getSiloFormData() {
  const [lots, users] = await Promise.all([
    db.lot.findMany({
      where: { qty: { gt: 0 } },
      include: { product: true },
      orderBy: [{ productCode: "asc" }, { locationCode: "asc" }],
    }),
    db.user.findMany({ orderBy: { name: "asc" } }),
  ]);
  return {
    lots: lots.map((l) => ({
      id: l.id,
      productCode: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      unit: l.product.unit,
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      qty: l.qty,
    })),
    operators: users.map((u) => u.name),
  };
}

export type SiloFormData = Awaited<ReturnType<typeof getSiloFormData>>;

/** Items issued and waiting to be loaded (remaining qty > 0), with their loads. */
export async function getStagingList() {
  const rows = await db.siloStaging.findMany({
    include: { product: true, loads: { orderBy: { loadedAt: "asc" } } },
    orderBy: { stagedAt: "desc" },
  });
  return rows
    .map((s) => ({
      id: s.id,
      docNo: s.docNo,
      productCode: s.productCode,
      name: productLabel(s.product.nameEn, s.product.nameTh),
      unit: s.product.unit,
      lotNo: s.lotNo,
      sourceLoc: s.sourceLoc,
      qtyStaged: s.qtyStaged,
      qtyLoaded: s.qtyLoaded,
      remaining: Math.round((s.qtyStaged - s.qtyLoaded) * 1000) / 1000,
      stagedBy: s.stagedBy ?? "",
      stagedAt: s.stagedAt.toISOString(),
      loads: s.loads.map((ld) => ({
        qty: ld.qty,
        machine: ld.machine ?? "",
        silo: ld.silo ?? "",
        operator: ld.operator ?? "",
        loadedAt: ld.loadedAt.toISOString(),
      })),
    }));
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
    productCode: ld.staging.productCode,
    name: productLabel(ld.staging.product.nameEn, ld.staging.product.nameTh),
    lotNo: ld.staging.lotNo,
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

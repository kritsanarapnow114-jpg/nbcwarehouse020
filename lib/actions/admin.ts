"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/** The exact starter catalog inserted by prisma/seed.ts's demo-data block. */
const DEMO_PRODUCT_CODES = [
  "RM-1001", "RM-1002", "RM-1003", "RM-1004",
  "PK-2001", "PK-2002", "PK-2003", "PK-2004",
  "FG-3001", "FG-3002", "FG-3003",
  "SP-4001", "SP-4002",
];
const DEMO_LOCATION_CODES = [
  "A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "A-07",
  "B-01", "B-02",
  "C-01", "C-02", "C-03",
  "D-01", "D-02", "D-03",
  "E-01",
];

/**
 * Wipes every piece of business data (products, lots, locations, all documents,
 * BOM, KPI logs, doc-number counters) so the app starts completely empty.
 * The User table is untouched so nobody gets logged out.
 */
/**
 * Clear only the movement documents (Receive incl. Production, Issue, Transfer)
 * plus Non-Stock holdings/conversions, zero every lot's quantity, and reset those
 * documents' running numbers so the next ones start at 0001. Purchase Orders are
 * kept but their received progress is reset to 0 (Open again). Products,
 * locations, Adjust, Count and BOM master are kept.
 */
export async function clearTransactionsAction(confirmText: string): Promise<{ error?: string }> {
  if (confirmText !== "CLEAR") {
    return { error: 'Type "CLEAR" exactly to confirm (พิมพ์ CLEAR ให้ตรงเพื่อยืนยัน)' };
  }

  try {
    // Core clear — these tables always exist. Kept in one transaction so it's
    // all-or-nothing.
    await db.$transaction([
      db.receiptBomLoss.deleteMany(),
      db.receiptMaterialConsumption.deleteMany(),
      db.receiptLine.deleteMany(),
      db.receipt.deleteMany(),
      db.issueLine.deleteMany(),
      db.issue.deleteMany(),
      db.transferLine.deleteMany(),
      db.transfer.deleteMany(),
      // Keep the Purchase Orders, but reset their received progress back to 0 so
      // the bars show 0% and they're Open again.
      db.purchaseOrderLine.updateMany({ data: { received: 0 } }),
      db.purchaseOrder.updateMany({ data: { status: "OPEN" } }),
      db.lot.updateMany({ data: { qty: 0 } }),
      db.docSequence.deleteMany({ where: { prefix: { in: ["RC", "ISS", "TRF"] } } }),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ล้างไม่สำเร็จ (failed to clear)" };
  }

  // Best-effort: the Non-Stock tables may not exist yet on an older DB — never
  // let a missing table roll back the core clear above.
  try { await db.conversion.deleteMany(); } catch {}
  try { await db.nonStockHolding.deleteMany(); } catch {}
  try { await db.docSequence.deleteMany({ where: { prefix: "CV" } }); } catch {}

  for (const p of [
    "/dashboard",
    "/products",
    "/aging",
    "/locations",
    "/map",
    "/receive",
    "/issue",
    "/transfer",
    "/po",
    "/reports",
    "/nonstock",
  ]) {
    revalidatePath(p);
  }
  return {};
}

export async function resetAllDataAction(confirmText: string): Promise<{ error?: string }> {
  if (confirmText !== "RESET") {
    return { error: 'Type "RESET" exactly to confirm (พิมพ์ RESET ให้ตรงเพื่อยืนยัน)' };
  }

  await db.$transaction([
    db.receiptBomLoss.deleteMany(),
    db.bomLine.deleteMany(),
    db.bom.deleteMany(),
    db.stockCountLine.deleteMany(),
    db.stockCount.deleteMany(),
    db.transferLine.deleteMany(),
    db.transfer.deleteMany(),
    db.adjustmentLine.deleteMany(),
    db.adjustment.deleteMany(),
    db.issueLine.deleteMany(),
    db.issue.deleteMany(),
    db.receiptLine.deleteMany(),
    db.receipt.deleteMany(),
    db.purchaseOrderLine.deleteMany(),
    db.purchaseOrder.deleteMany(),
    db.lot.deleteMany(),
    db.location.deleteMany(),
    db.product.deleteMany(),
    db.kpiLog.deleteMany(),
    db.docSequence.deleteMany(),
  ]);

  for (const p of [
    "/dashboard",
    "/products",
    "/aging",
    "/locations",
    "/receive",
    "/po",
    "/issue",
    "/adjust",
    "/transfer",
    "/count",
  ]) {
    revalidatePath(p);
  }

  return {};
}

/** Precise match for the demo KPI log rows created by prisma/seed.ts (not tied to a product code). */
const DEMO_KPI_LOG_WHERE = {
  OR: [
    { key: "SAFETY" as const, detail: "Year start · counter reset" },
    { key: "COST" as const, detail: "Switched pallet wrap supplier", amount: 42000 },
    { key: "COST" as const, detail: "Reduced BOPP scrap via die-cut retune", amount: 18500 },
    {
      key: "DELIVERY" as const,
      issueDocNo: { in: ["ISS-2569-0060", "ISS-2569-0063", "ISS-2569-0068", "ISS-2569-0071"] },
    },
  ],
};

/** Counts of demo data still present, for a confirmation prompt before clearing it. */
export async function getDemoDataSummary() {
  const [productCount, locationCount, lotCount, kpiLogCount] = await Promise.all([
    db.product.count({ where: { code: { in: DEMO_PRODUCT_CODES } } }),
    db.location.count({ where: { code: { in: DEMO_LOCATION_CODES } } }),
    db.lot.count({ where: { productCode: { in: DEMO_PRODUCT_CODES } } }),
    db.kpiLog.count({ where: DEMO_KPI_LOG_WHERE }),
  ]);
  return { productCount, locationCount, lotCount, kpiLogCount };
}

/**
 * Removes exactly the starter demo catalog (13 products, 16 bins) and every
 * document line referencing it — including any real transactions later
 * recorded against those demo products/lots, since the products themselves
 * are being removed. Document headers that still have at least one
 * remaining (real) line are kept; only ones left with zero lines are
 * deleted. Real products, real locations, and the SAP-imported catalog are
 * never touched. Demo bins are only deleted if they end up holding no stock.
 */
export async function clearDemoDataAction(confirmText: string): Promise<{ error?: string }> {
  if (confirmText !== "CLEAR DEMO") {
    return { error: 'Type "CLEAR DEMO" exactly to confirm (พิมพ์ CLEAR DEMO ให้ตรงเพื่อยืนยัน)' };
  }

  await db.$transaction(async (tx) => {
    const demoLots = await tx.lot.findMany({
      where: { productCode: { in: DEMO_PRODUCT_CODES } },
      select: { id: true },
    });
    const demoLotIds = demoLots.map((l) => l.id);

    const demoBomLines = await tx.bomLine.findMany({
      where: {
        OR: [
          { materialProductCode: { in: DEMO_PRODUCT_CODES } },
          { bom: { finishedProductCode: { in: DEMO_PRODUCT_CODES } } },
        ],
      },
      select: { id: true },
    });
    const demoBomLineIds = demoBomLines.map((l) => l.id);

    await tx.receiptBomLoss.deleteMany({ where: { bomLineId: { in: demoBomLineIds } } });
    await tx.bomLine.deleteMany({ where: { id: { in: demoBomLineIds } } });
    await tx.bom.deleteMany({ where: { finishedProductCode: { in: DEMO_PRODUCT_CODES } } });

    await tx.stockCountLine.deleteMany({ where: { lotId: { in: demoLotIds } } });
    await tx.stockCount.deleteMany({ where: { lines: { none: {} } } });

    await tx.transferLine.deleteMany({ where: { lotId: { in: demoLotIds } } });
    await tx.transfer.deleteMany({ where: { lines: { none: {} } } });

    await tx.adjustmentLine.deleteMany({ where: { lotId: { in: demoLotIds } } });
    await tx.adjustment.deleteMany({ where: { lines: { none: {} } } });

    await tx.issueLine.deleteMany({ where: { productCode: { in: DEMO_PRODUCT_CODES } } });
    await tx.issue.deleteMany({ where: { lines: { none: {} } } });

    await tx.receiptLine.deleteMany({ where: { productCode: { in: DEMO_PRODUCT_CODES } } });
    await tx.receipt.deleteMany({ where: { lines: { none: {} } } });

    await tx.purchaseOrderLine.deleteMany({ where: { productCode: { in: DEMO_PRODUCT_CODES } } });
    await tx.purchaseOrder.deleteMany({ where: { lines: { none: {} } } });

    await tx.kpiLog.deleteMany({ where: DEMO_KPI_LOG_WHERE });

    await tx.lot.deleteMany({ where: { id: { in: demoLotIds } } });
    await tx.location.deleteMany({
      where: { code: { in: DEMO_LOCATION_CODES }, lots: { none: {} } },
    });
    await tx.product.deleteMany({ where: { code: { in: DEMO_PRODUCT_CODES } } });
  });

  for (const p of [
    "/dashboard",
    "/products",
    "/aging",
    "/locations",
    "/receive",
    "/po",
    "/issue",
    "/adjust",
    "/transfer",
    "/count",
    "/reports",
  ]) {
    revalidatePath(p);
  }

  return {};
}

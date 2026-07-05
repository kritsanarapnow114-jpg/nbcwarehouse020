"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/**
 * Wipes every piece of business data (products, lots, locations, all documents,
 * BOM, KPI logs, doc-number counters) so the app starts completely empty.
 * The User table is untouched so nobody gets logged out.
 */
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

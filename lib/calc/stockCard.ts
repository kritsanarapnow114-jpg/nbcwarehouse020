import "server-only";
import { db } from "@/lib/db";

export type StockCardEntryType =
  | "Receive"
  | "Issue"
  | "Adjust"
  | "Transfer"
  | "BOM"
  | "Convert";

export type StockCardEntry = {
  date: Date;
  doc: string;
  type: StockCardEntryType;
  lot: string;
  in: number;
  out: number;
  balance: number;
  // Receive/Issue lines only: whether the line was Stock or Non-Stock, and when
  // it was converted Non-Stock → Stock (if ever).
  stockType?: "STOCK" | "NON_STOCK";
  convertedAt?: Date | null;
};

/**
 * Real chronological movement ledger for a product, built from the actual
 * Receipt/Issue/Adjustment/Transfer records that touched it (not synthesized).
 * Transfers move a lot between bins — they don't change the product's total
 * on-hand, so they net to zero but still appear as a row for traceability.
 */
export async function buildStockCard(
  productCode: string
): Promise<StockCardEntry[]> {
  const [receiptLines, issueLines, adjustmentLines, transferLines, bomConsumptions, conversions] =
    await Promise.all([
      db.receiptLine.findMany({
        // Non-Stock receipts aren't in stock yet — they enter via a Conversion.
        where: { productCode, stockType: "STOCK", receipt: { reversedAt: null } },
        include: { receipt: true },
      }),
      db.issueLine.findMany({
        // Non-Stock issues (no lot) don't affect stock — exclude them.
        where: { productCode, selectedLotId: { not: null }, issue: { reversedAt: null } },
        include: { issue: true, selectedLot: true },
      }),
      db.adjustmentLine.findMany({
        where: { lot: { productCode }, adjustment: { reversedAt: null } },
        include: { adjustment: true, lot: true },
      }),
      db.transferLine.findMany({
        where: { lot: { productCode }, transfer: { reversedAt: null } },
        include: { transfer: true, lot: true },
      }),
      // Raw material consumed by production runs (BOM). These deduct stock but
      // aren't Issue documents, so include them explicitly.
      db.receiptMaterialConsumption.findMany({
        where: { lot: { productCode }, receipt: { reversedAt: null } },
        include: { receipt: true, lot: true },
      }),
      // Non-Stock → Stock conversions bring quantity into stock on their date.
      db.conversion.findMany({ where: { productCode } }),
    ]);

  const entries: StockCardEntry[] = [];

  for (const r of receiptLines) {
    entries.push({
      date: r.receipt.docDate,
      doc: r.receipt.docNo,
      type: "Receive",
      lot: r.lotNo,
      in: r.recvQty,
      out: 0,
      balance: 0,
      stockType: r.stockType,
      convertedAt: r.stockConvertedAt,
    });
  }
  for (const i of issueLines) {
    entries.push({
      date: i.issue.docDate,
      doc: i.issue.docNo,
      type: "Issue",
      lot: i.selectedLot?.lotNo ?? "-",
      in: 0,
      out: i.qty,
      balance: 0,
      stockType: i.stockType,
      convertedAt: i.stockConvertedAt,
    });
  }
  for (const a of adjustmentLines) {
    const variance = a.countedQty - a.sysQty;
    entries.push({
      date: a.adjustment.docDate,
      doc: a.adjustment.docNo,
      type: "Adjust",
      lot: a.lot.lotNo,
      in: variance > 0 ? variance : 0,
      out: variance < 0 ? -variance : 0,
      balance: 0,
    });
  }
  for (const t of transferLines) {
    entries.push({
      date: t.transfer.docDate,
      doc: t.transfer.docNo,
      type: "Transfer",
      lot: t.lot.lotNo,
      in: 0,
      out: 0,
      balance: 0,
    });
  }
  for (const c of bomConsumptions) {
    entries.push({
      date: c.receipt.docDate,
      doc: c.receipt.docNo,
      type: "BOM",
      lot: c.lot.lotNo,
      in: 0,
      out: c.qty,
      balance: 0,
    });
  }
  for (const cv of conversions) {
    // Positive = Non-Stock → Stock (in); negative = Stock → Non-Stock (out).
    entries.push({
      date: cv.docDate,
      doc: cv.docNo,
      type: "Convert",
      lot: cv.lotNo,
      in: cv.qty > 0 ? cv.qty : 0,
      out: cv.qty < 0 ? -cv.qty : 0,
      balance: 0,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  for (const e of entries) {
    balance += e.in - e.out;
    e.balance = balance;
  }

  return entries;
}

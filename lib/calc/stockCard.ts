import "server-only";
import { db } from "@/lib/db";

export type StockCardEntryType =
  | "Receive"
  | "Issue"
  | "Adjust"
  | "Transfer";

export type StockCardEntry = {
  date: Date;
  doc: string;
  type: StockCardEntryType;
  lot: string;
  in: number;
  out: number;
  balance: number;
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
  const [receiptLines, issueLines, adjustmentLines, transferLines] =
    await Promise.all([
      db.receiptLine.findMany({
        where: { productCode },
        include: { receipt: true },
      }),
      db.issueLine.findMany({
        where: { productCode },
        include: { issue: true, selectedLot: true },
      }),
      db.adjustmentLine.findMany({
        where: { lot: { productCode } },
        include: { adjustment: true, lot: true },
      }),
      db.transferLine.findMany({
        where: { lot: { productCode } },
        include: { transfer: true, lot: true },
      }),
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
    });
  }
  for (const i of issueLines) {
    entries.push({
      date: i.issue.docDate,
      doc: i.issue.docNo,
      type: "Issue",
      lot: i.selectedLot.lotNo,
      in: 0,
      out: i.qty,
      balance: 0,
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

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  for (const e of entries) {
    balance += e.in - e.out;
    e.balance = balance;
  }

  return entries;
}

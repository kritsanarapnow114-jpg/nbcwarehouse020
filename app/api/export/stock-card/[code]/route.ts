import { buildStockCard } from "@/lib/calc/stockCard";
import { toExcelHtml, excelResponse } from "@/lib/calc/csv";
import { fmtDateBE } from "@/lib/calc/date";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const entries = await buildStockCard(code);

  // Non-Stock held for this product (not part of the stock balance).
  const holdings = await db.nonStockHolding.findMany({
    where: { productCode: code, qty: { gt: 0 } },
  });
  const nonStockTotal = holdings.reduce((s, h) => s + h.qty, 0);
  const balance = entries.length > 0 ? entries[entries.length - 1].balance : 0;

  const rows: (string | number)[][] = entries.map((e) => [
    fmtDateBE(e.date),
    e.doc,
    e.type,
    e.stockType === "NON_STOCK" ? "Non-Stock" : "Stock",
    e.lot,
    e.in,
    e.out,
    // Non-Stock movements aren't part of the running stock balance.
    e.stockType === "NON_STOCK" ? "" : e.balance,
  ]);

  // Summary block at the bottom: stock + Non-Stock + grand total.
  rows.push(["", "", "", "", "", "", "", ""]);
  rows.push(["", "", "", "", "", "", "ยอดในสต็อก", balance]);
  rows.push(["", "", "", "", "", "", "Non-Stock (ยังไม่เข้าสต็อก)", nonStockTotal]);
  rows.push(["", "", "", "", "", "", "รวมทั้งหมด", balance + nonStockTotal]);

  const html = toExcelHtml(
    "Stock Card",
    ["Date", "Doc", "Type", "Stock/Non-Stock", "Lot", "In", "Out", "Balance"],
    rows
  );
  return excelResponse(`stock-card-${code}.xls`, html);
}

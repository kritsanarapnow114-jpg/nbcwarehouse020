import { buildStockCard } from "@/lib/calc/stockCard";
import { toCsv, csvResponse } from "@/lib/calc/csv";
import { fmtDateBE } from "@/lib/calc/date";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const entries = await buildStockCard(code);
  const csv = toCsv(
    ["Date", "Doc", "Type", "Lot", "In", "Out", "Balance"],
    entries.map((e) => [
      fmtDateBE(e.date),
      e.doc,
      e.type,
      e.lot,
      e.in,
      e.out,
      e.balance,
    ])
  );
  return csvResponse(`stock-card-${code}.csv`, csv);
}

import { getRecentCounts, getLotOptions, getProductOptions, getLocationCodes } from "@/lib/views/docCommon";
import { CountForm } from "./CountForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function CountPage() {
  const [counts, lots, products, locations] = await Promise.all([
    getRecentCounts(),
    getLotOptions(),
    getProductOptions(),
    getLocationCodes(),
  ]);

  const rows: DocHistoryRow[] = counts.map((c) => ({
    id: c.id,
    docNo: c.docNo,
    docDate: c.docDate,
    summary: c.pullZone,
    reversedAt: c.reversedAt,
    lineCount: c.lineCount,
    lines: c.lines.map((l) => {
      const variance = l.countedQty - l.sysQty;
      return {
        code: l.code,
        name: l.name,
        qtyText: `${l.countedQty.toLocaleString()} ${l.unit}`,
        extra: `Lot ${l.lotNo} · ${l.locationCode} · var ${variance > 0 ? "+" : ""}${variance}`,
        lotNo: l.lotNo,
        location: l.locationCode,
        sysText: l.sysQty.toLocaleString(),
        countText: l.countedQty.toLocaleString(),
      };
    }),
  }));

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <CountForm lots={lots} products={products} locations={locations} />
      <DocHistory title="Recent Counts (ประวัติการนับสต็อก)" rows={rows} accentColor="#2f86cf" reverseKind="count" printSheet="count" />
    </div>
  );
}

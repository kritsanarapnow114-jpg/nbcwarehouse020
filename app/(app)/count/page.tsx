import { getRecentCounts } from "@/lib/views/docCommon";
import { CountForm } from "./CountForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function CountPage() {
  const counts = await getRecentCounts();

  const rows: DocHistoryRow[] = counts.map((c) => ({
    id: c.id,
    docNo: c.docNo,
    docDate: c.docDate,
    summary: c.pullZone,
    lineCount: c.lineCount,
    lines: c.lines.map((l) => {
      const variance = l.countedQty - l.sysQty;
      return {
        code: l.code,
        name: l.name,
        qtyText: `${l.countedQty.toLocaleString()} ${l.unit}`,
        extra: `Lot ${l.lotNo} · ${l.locationCode} · var ${variance > 0 ? "+" : ""}${variance}`,
      };
    }),
  }));

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <CountForm />
      <DocHistory title="Recent Counts (ประวัติการนับสต็อก)" rows={rows} accentColor="#3E9B6E" />
    </div>
  );
}

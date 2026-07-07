import { getReceiveFormData, getRecentReceipts } from "@/lib/views/receive";
import { ReceiveForm } from "./ReceiveForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function ReceivePage() {
  const [data, receipts] = await Promise.all([
    getReceiveFormData(),
    getRecentReceipts(),
  ]);

  const rows: DocHistoryRow[] = receipts.map((r) => ({
    id: r.id,
    docNo: r.docNo,
    docDate: r.docDate,
    summary:
      r.mode === "PO"
        ? r.poNo
          ? `By PO · ${r.poNo}`
          : "By PO · No PO"
        : "From Production",
    reversedAt: r.reversedAt,
    lineCount: r.lineCount,
    lines: r.lines.map((l) => ({
      code: l.code,
      name: l.name,
      qtyText: `${l.recvQty.toLocaleString()} ${l.unit}`,
      extra: `Lot ${l.lotNo} · ${l.locationCode}`,
    })),
  }));

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <ReceiveForm data={data} />
      <DocHistory title="Recent Receipts (ประวัติการรับสินค้า)" rows={rows} accentColor="#0e8ba1" reverseKind="receipt" />
    </div>
  );
}

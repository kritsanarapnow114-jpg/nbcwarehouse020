import { getReceiveFormData, getRecentReceipts } from "@/lib/views/receive";
import { ReceiveForm } from "./ReceiveForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function ReceivePage() {
  const [data, receipts] = await Promise.all([
    getReceiveFormData(),
    getRecentReceipts(),
  ]);

  // Production receiving lives on its own "Pack Order" page now — keep this to PO.
  const rows: DocHistoryRow[] = receipts
    .filter((r) => r.mode === "PO")
    .map((r) => ({
      id: r.id,
      docNo: r.docNo,
      docDate: r.docDate,
      summary: r.poNo ? `By PO · ${r.poNo}` : "By PO · No PO",
      reversedAt: r.reversedAt,
      materialDoc: r.materialDoc,
      remark: r.remark,
      stockType: r.stockType,
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
      <ReceiveForm data={data} lockMode="PO" />
      <DocHistory title="Recent Receipts (ประวัติการรับสินค้า)" rows={rows} accentColor="#1f66a6" reverseKind="receipt" />
    </div>
  );
}

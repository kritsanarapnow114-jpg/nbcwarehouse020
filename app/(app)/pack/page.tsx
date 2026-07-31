import { getReceiveFormData, getRecentReceipts, getPendingReceipts } from "@/lib/views/receive";
import { ReceiveForm } from "../receive/ReceiveForm";
import { PendingVerify } from "../receive/PendingVerify";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function PackOrderPage() {
  const [data, receipts, pending] = await Promise.all([
    getReceiveFormData(),
    getRecentReceipts(),
    getPendingReceipts(),
  ]);

  const rows: DocHistoryRow[] = receipts
    .filter((r) => r.mode === "PRODUCTION")
    .map((r) => ({
      id: r.id,
      docNo: r.docNo,
      docDate: r.docDate,
      summary: r.pending ? "รอตรวจสอบ" : "จากฝ่ายผลิต · เข้าสต็อกแล้ว",
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
      <ReceiveForm data={data} lockMode="PRODUCTION" />
      <PendingVerify receipts={pending} />
      <DocHistory title="ประวัติรับจากผลิต (Pack Order history)" rows={rows} accentColor="#8a6d1f" reverseKind="receipt" />
    </div>
  );
}

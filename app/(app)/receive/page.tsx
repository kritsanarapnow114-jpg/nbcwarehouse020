import { getReceiveFormData, getRecentReceipts, getPalletFillSummary } from "@/lib/views/receive";
import { ReceiveForm } from "./ReceiveForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function ReceivePage() {
  const [data, receipts, pallets] = await Promise.all([
    getReceiveFormData(),
    getRecentReceipts(),
    getPalletFillSummary(),
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

  const totalPallets = pallets.partial + pallets.full;
  const partialPct = totalPallets > 0 ? Math.round((pallets.partial / totalPallets) * 100) : 0;

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <ReceiveForm data={data} lockMode="PO" />

      {/* Full vs Partial pallets/boxes across all stock received (not reversed). */}
      <div className="mb-4 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <PalletTile
          label="พาเลท/กล่องไม่เต็ม (Partial)"
          value={pallets.partial}
          sub={`${partialPct}% ของที่รับเข้าทั้งหมด`}
          color="#c8891a"
        />
        <PalletTile label="พาเลท/กล่องเต็ม (Full)" value={pallets.full} sub="รับเข้าแบบเต็มพาเลท" color="#1f9d63" />
        <PalletTile label="รวมทั้งหมด" value={totalPallets} sub="พาเลท/กล่องที่รับเข้า (ไม่นับที่ยกเลิก)" color="#3a4658" />
      </div>

      <DocHistory title="Recent Receipts (ประวัติการรับสินค้า)" rows={rows} accentColor="#1f66a6" reverseKind="receipt" />
    </div>
  );
}

function PalletTile({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="rounded-[14px] border border-[#e7ebf1] bg-white p-[14px_16px] shadow-[0_1px_2px_rgba(20,30,48,.04)]">
      <div className="text-[11px] text-[#69748a]">{label}</div>
      <div className="font-num text-[26px] font-extrabold leading-tight" style={{ color }}>
        {value.toLocaleString()}
        <span className="ml-1 text-[12px] font-medium text-[#9aa4b4]">กล่อง</span>
      </div>
      <div className="text-[10.5px] text-[#9aa4b4]">{sub}</div>
    </div>
  );
}

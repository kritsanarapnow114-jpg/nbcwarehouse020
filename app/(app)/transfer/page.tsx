import { getLotOptions, getLocationCodes, getRecentTransfers } from "@/lib/views/docCommon";
import { getUsers } from "@/lib/views/users";
import { TransferForm } from "./TransferForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function TransferPage() {
  const [lots, locations, transfers, users] = await Promise.all([
    getLotOptions(),
    getLocationCodes(),
    getRecentTransfers(),
    getUsers(),
  ]);

  const operators = users.map((u) => u.name);

  const rows: DocHistoryRow[] = transfers.map((t) => ({
    id: t.id,
    docNo: t.docNo,
    docDate: t.docDate,
    summary: `Operator: ${t.operator}`,
    reversedAt: t.reversedAt,
    lineCount: t.lineCount,
    lines: t.lines.map((l) => ({
      code: l.code,
      name: l.name,
      qtyText: `${l.qty.toLocaleString()} ${l.unit}`,
      extra: `Lot ${l.lotNo} · ${l.fromLocationCode} → ${l.toLocationCode}`,
    })),
  }));

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <TransferForm lots={lots} locations={locations} operators={operators} />
      <DocHistory title="Recent Transfers (ประวัติการย้ายที่เก็บ)" rows={rows} accentColor="#12a08d" reverseKind="transfer" />
    </div>
  );
}

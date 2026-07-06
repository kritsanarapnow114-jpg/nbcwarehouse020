import { getIssueFormData, getRecentIssues } from "@/lib/views/issue";
import { IssueForm } from "./IssueForm";
import { DocHistory, DocHistoryRow } from "@/components/ui/DocHistory";

export default async function IssuePage() {
  const [data, issues] = await Promise.all([getIssueFormData(), getRecentIssues()]);

  const rows: DocHistoryRow[] = issues.map((i) => ({
    id: i.id,
    docNo: i.docNo,
    docDate: i.docDate,
    summary: i.issueTo,
    reversedAt: i.reversedAt,
    lineCount: i.lineCount,
    lines: i.lines.map((l) => ({
      code: l.code,
      name: l.name,
      qtyText: `${l.qty.toLocaleString()} ${l.unit}`,
      extra: `Lot ${l.lotNo} · ${l.locationCode}`,
    })),
  }));

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <IssueForm data={data} />
      <DocHistory title="Recent Issues (ประวัติการจ่ายสินค้า)" rows={rows} accentColor="#e5913a" reverseKind="issue" />
    </div>
  );
}

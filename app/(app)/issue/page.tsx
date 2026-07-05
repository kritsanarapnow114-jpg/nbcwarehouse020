import { getIssueFormData } from "@/lib/views/issue";
import { IssueForm } from "./IssueForm";

export default async function IssuePage() {
  const data = await getIssueFormData();
  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <IssueForm data={data} />
    </div>
  );
}

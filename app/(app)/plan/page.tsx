import { getPackagingPlan } from "@/lib/views/plan";
import { PlanForm } from "./PlanForm";

export default async function PlanPage() {
  const { fgs, rows } = await getPackagingPlan();
  return (
    <div className="max-w-[1180px] p-[22px_26px]">
      <PlanForm fgs={fgs} rows={rows} />
    </div>
  );
}

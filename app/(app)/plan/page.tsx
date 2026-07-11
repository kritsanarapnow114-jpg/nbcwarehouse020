import { getPackagingPlan, PlanPeriod } from "@/lib/views/plan";
import { PlanForm } from "./PlanForm";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: p } = await searchParams;
  const period: PlanPeriod = p === "day" || p === "year" ? p : "month";
  const { fgs, rows } = await getPackagingPlan(period);
  return (
    <div className="max-w-[1180px] p-[22px_26px]">
      <PlanForm fgs={fgs} rows={rows} period={period} />
    </div>
  );
}

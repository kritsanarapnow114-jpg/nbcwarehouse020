import { getPlanData } from "@/lib/views/plan";
import { PlanForm } from "./PlanForm";

export default async function PlanPage() {
  const data = await getPlanData();
  return (
    <div className="max-w-[1200px] p-[22px_26px]">
      <PlanForm
        packagingProducts={data.packagingProducts}
        packagingTypes={data.packagingTypes}
        schedule={data.schedule}
        rows={data.rows}
        days={data.days}
      />
    </div>
  );
}

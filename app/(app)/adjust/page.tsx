import { getLotOptions } from "@/lib/views/docCommon";
import { AdjustForm } from "./AdjustForm";

export default async function AdjustPage() {
  const lots = await getLotOptions();
  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <AdjustForm lots={lots} />
    </div>
  );
}

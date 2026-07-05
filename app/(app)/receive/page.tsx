import { getReceiveFormData } from "@/lib/views/receive";
import { ReceiveForm } from "./ReceiveForm";

export default async function ReceivePage() {
  const data = await getReceiveFormData();
  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <ReceiveForm data={data} />
    </div>
  );
}

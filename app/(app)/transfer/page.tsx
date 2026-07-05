import { getLotOptions, getLocationCodes } from "@/lib/views/docCommon";
import { TransferForm } from "./TransferForm";

export default async function TransferPage() {
  const [lots, locations] = await Promise.all([getLotOptions(), getLocationCodes()]);
  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <TransferForm lots={lots} locations={locations} />
    </div>
  );
}

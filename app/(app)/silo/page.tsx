import { getSiloFormData, getStagingList, getLoadHistory } from "@/lib/views/silo";
import { SiloFeed } from "./SiloFeed";

export default async function SiloPage() {
  const [data, staging, history] = await Promise.all([
    getSiloFormData(),
    getStagingList(),
    getLoadHistory(),
  ]);

  return (
    <div className="max-w-[1240px] p-[22px_26px]">
      <SiloFeed data={data} staging={staging} history={history} />
    </div>
  );
}

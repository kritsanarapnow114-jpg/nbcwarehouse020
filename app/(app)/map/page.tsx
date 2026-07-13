import { getStorageMap } from "@/lib/views/storage";
import { StorageMap } from "./StorageMap";

export default async function StorageMapPage() {
  const { racks, summary } = await getStorageMap();
  return (
    <div className="p-[22px_26px]">
      <StorageMap racks={racks} summary={summary} />
    </div>
  );
}

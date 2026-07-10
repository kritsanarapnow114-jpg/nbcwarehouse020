import { getRackMap } from "@/lib/views/map";
import { WarehouseMap } from "./WarehouseMap";

export default async function MapPage() {
  const racks = await getRackMap();
  return (
    <div className="max-w-[1320px] p-[22px_26px]">
      <WarehouseMap racks={racks} />
    </div>
  );
}

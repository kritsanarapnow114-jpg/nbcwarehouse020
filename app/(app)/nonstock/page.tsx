import { getNonStockHoldings, getConversions } from "@/lib/views/nonstock";
import { NonStockConvert } from "./NonStockConvert";

export default async function NonStockPage() {
  const [holdings, conversions] = await Promise.all([getNonStockHoldings(), getConversions()]);

  return (
    <div className="max-w-[1200px] p-[22px_26px]">
      <NonStockConvert holdings={holdings} conversions={conversions} />
    </div>
  );
}

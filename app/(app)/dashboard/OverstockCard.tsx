"use client";

import Link from "next/link";

type Item = { code: string; name: string; onHand: number; max: number; excess: number; unit: string };

/** Overstock chart: products above their Max, sorted by how much they exceed it. */
export function OverstockCard({
  counts,
  items,
}: {
  counts: { low: number; over: number; ok: number };
  items: Item[];
}) {
  const maxExcess = Math.max(1, ...items.map((i) => i.excess));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 text-[14px] font-semibold">
          Overstock — เกินเพดาน Max (ควรระบาย / หยุดสั่ง)
        </div>
        <span className="flex items-center gap-1.5 text-[11.5px] text-[#69748a]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e5793a]" /> เกิน Max {counts.over}
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-[#69748a]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d24141]" /> ต่ำกว่า Min {counts.low}
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-[#69748a]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#12b5d4]" /> ปกติ {counts.ok}
        </span>
        <Link href="/products" className="text-[12px] text-[#12a2bb]">
          Products →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-[12.5px] text-[#9aa4b4]">
          ไม่มีสินค้าเกินเพดาน Max 🎉 (No overstock)
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((it) => (
            <div
              key={it.code}
              title={`${it.name}: คงเหลือ ${it.onHand.toLocaleString()} / Max ${it.max.toLocaleString()} ${it.unit} · เกิน +${it.excess.toLocaleString()}`}
              className="flex items-center gap-3"
            >
              <div className="w-[210px] flex-none">
                <div className="truncate text-[12.5px] font-medium text-[#2a3444]">{it.name}</div>
                <div className="font-num text-[10.5px] text-[#9aa4b4]">
                  {it.code} · คงเหลือ {it.onHand.toLocaleString()} / Max {it.max.toLocaleString()}
                </div>
              </div>
              <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-[#f1f3f7]">
                <div
                  className="h-full rounded-full bg-[#e5793a]"
                  style={{ width: `${Math.max(4, (it.excess / maxExcess) * 100)}%` }}
                />
              </div>
              <div className="font-num w-[130px] flex-none text-right text-[12.5px] font-bold text-[#c9821f]">
                เกิน +{it.excess.toLocaleString()} {it.unit}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

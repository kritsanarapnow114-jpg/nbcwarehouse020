"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PeriodSelector({ start, end }: { start: string; end: string }) {
  const router = useRouter();
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);

  function go(ns: string, ne: string) {
    router.push(`/dashboard?start=${ns}&end=${ne}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#e7ebf1] bg-white p-3.5 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
      <span className="text-[13px] font-semibold">Period (ช่วงข้อมูล)</span>
      <input
        type="date"
        value={s}
        onChange={(e) => {
          setS(e.target.value);
          go(e.target.value, end);
        }}
        className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px]"
      />
      <span className="text-[#9aa4b4]">→</span>
      <input
        type="date"
        value={e}
        onChange={(ev) => {
          setE(ev.target.value);
          go(s, ev.target.value);
        }}
        className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px]"
      />
      <div className="flex-1" />
      <span className="font-num text-[12px] text-[#69748a]">
        {s} → {e}
      </span>
    </div>
  );
}

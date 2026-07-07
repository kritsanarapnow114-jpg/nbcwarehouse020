"use client";

import { MovementBucket } from "@/lib/views/dashboard";

/** Stacked daily bars: received (teal) + issued (purple) per day. Hover shows data. */
export function DailyBars({ buckets }: { buckets: MovementBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.recv + b.issue));
  const step = Math.max(1, Math.ceil(buckets.length / 12));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 text-[14px] font-semibold">Daily throughput (ปริมาณเข้า-ออกต่อวัน)</div>
        <span className="flex items-center gap-1.5 text-[11.5px]">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#12b5d4]" /> Received
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px]">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#6c5ce7]" /> Issued
        </span>
      </div>
      <div className="flex h-[160px] items-end gap-[3px]">
        {buckets.map((b, i) => (
          <div
            key={i}
            title={`${b.label}: รับ +${b.recv.toLocaleString()} · จ่าย −${b.issue.toLocaleString()}`}
            className="flex flex-1 cursor-default flex-col justify-end"
          >
            <div className="w-full rounded-t-[3px] bg-[#6c5ce7]" style={{ height: `${(b.issue / max) * 100}%` }} />
            <div className="w-full bg-[#12b5d4]" style={{ height: `${(b.recv / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10px] text-[#9aa4b4]">
        {buckets.map((b, i) => (
          <div key={i} className="font-num flex-1 text-center">
            {i % step === 0 || i === buckets.length - 1 ? b.label : ""}
          </div>
        ))}
      </div>
    </>
  );
}

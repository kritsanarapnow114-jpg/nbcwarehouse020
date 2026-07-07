"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";

const REPORT_TYPES = [
  { value: "receiving", label: "Receiving (รับสินค้า)" },
  { value: "issuing", label: "Issuing (จ่ายสินค้า)" },
  { value: "loss", label: "Loss (สูญเสีย)" },
  { value: "production", label: "Production (ผลิต)" },
  { value: "production_loss", label: "Production material loss (สูญเสียวัตถุดิบ)" },
  { value: "po", label: "Purchase Orders (ใบสั่งซื้อ)" },
  { value: "transfer", label: "Transfers (ย้ายที่เก็บ)" },
  { value: "count", label: "Stock Count (นับสต็อก)" },
] as const;

export function ExportBar({ start, end }: { start: string; end: string }) {
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]["value"]>("receiving");

  const href = `/api/export/reports?type=${type}&start=${start}&end=${end}`;

  return (
    <Card className="mb-4">
      <CardTitle>Export data (ดึงข้อมูล Excel)</CardTitle>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
        >
          {REPORT_TYPES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="font-num text-[12px] text-[#69748a]">
          {start} → {end}
        </span>
        <div className="flex-1" />
        <a
          href={href}
          className="flex items-center gap-1.5 rounded-[8px] border border-[#16a6bf] bg-[#e6f5fa] px-3.5 py-2 text-[12.5px] font-semibold text-[#0c7f93]"
        >
          ⤓ Export Excel
        </a>
      </div>
    </Card>
  );
}

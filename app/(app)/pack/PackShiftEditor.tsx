"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { setReceiptShiftAction } from "@/lib/actions/receive";
import { showToast } from "@/components/ui/Toast";

export type ShiftEditRow = { id: string; label: string; docDate: string; shift: string };

/** Set / change the production shift (กะ) on a Pack Order after the fact — for
 *  rounds keyed without a shift, or entered under the wrong one. */
export function PackShiftEditor({ rows, shifts }: { rows: ShiftEditRow[]; shifts: string[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (rows.length === 0) return null;

  async function save(id: string, shift: string) {
    setBusyId(id);
    const res = await setReceiptShiftAction({ receiptId: id, shift });
    setBusyId(null);
    if (res.error) showToast(res.error);
    else {
      showToast("บันทึกกะแล้ว (shift saved)");
      router.refresh();
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

  return (
    <Card className="mb-4">
      <CardTitle>ระบุกะย้อนหลัง (Set shift later) — Pack Order</CardTitle>
      <p className="mb-3 text-[12px] text-[#69748a]">
        เลือกกะให้ Pack Order ที่ยังไม่ระบุ หรือแก้กะที่คีย์ผิดได้ที่นี่ — มีผลกับรายงาน OEE ทันที
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#f7f9fb] text-left text-[11px] text-[#69748a]">
              <th className="p-[7px_12px] font-medium">Pack Order</th>
              <th className="p-[7px_12px] font-medium">วันที่</th>
              <th className="p-[7px_12px] font-medium">กะ (Shift)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#eef1f5]">
                <td className="font-num p-[7px_12px] text-[#2f86cf]">{r.label}</td>
                <td className="font-num p-[7px_12px] text-[#69748a]">{fmt(r.docDate)}</td>
                <td className="p-[7px_12px]">
                  <select
                    value={r.shift}
                    disabled={busyId === r.id}
                    onChange={(e) => save(r.id, e.target.value)}
                    className={`rounded-[7px] border px-2 py-1.5 text-[12px] outline-none focus:border-[#2f86cf] disabled:opacity-60 ${
                      r.shift ? "border-[#d7dce4]" : "border-[#e6b45a] bg-[#fdf6e8]"
                    }`}
                  >
                    <option value="">— ยังไม่ระบุกะ —</option>
                    {shifts.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

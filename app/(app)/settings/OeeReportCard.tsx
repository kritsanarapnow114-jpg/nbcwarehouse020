"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import {
  OEE_REPORT_KEY,
  OEE_REPORT_ROWS,
  OEE_PHASES,
  type OeeReport,
} from "@/lib/settingsKeys";

/** Edit the Trial-Run OEE monthly report inputs (phase + calc base: this month,
 *  target, last month). Stored as JSON in AppSetting — no schema change. */
export function OeeReportCard({ report }: { report: OeeReport }) {
  const router = useRouter();
  const [phase, setPhase] = useState(report.phase);
  const [rows, setRows] = useState(report.rows);
  const [busy, setBusy] = useState(false);

  function set(key: string, field: "cur" | "target" | "prev", v: string) {
    setRows((r) => ({ ...r, [key]: { ...r[key as keyof typeof r], [field]: v } }));
  }

  async function save() {
    setBusy(true);
    await saveAppSettingsAction({ [OEE_REPORT_KEY]: JSON.stringify({ phase, rows }) });
    setBusy(false);
    showToast("Saved (บันทึกรายงาน OEE แล้ว)");
    router.refresh();
  }

  const cell =
    "font-num w-full rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[12.5px] outline-none focus:border-[#2f86cf]";

  return (
    <Card>
      <CardTitle>OEE Report — Trial-Run inputs (ฐานคำนวณรายเดือน)</CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        กรอกฐานข้อมูลที่ใช้คำนวณ OEE ให้ผู้บริหารตรวจที่มาได้ — เดือนนี้ / เป้า / เดือนก่อน.
        ค่าเดือนก่อน (July) ใส่ให้แล้วจากรายงานเดิม.
      </p>

      <label className="mb-3 flex items-center gap-2 text-[12.5px]">
        <span className="font-medium text-[#3a4658]">Phase ปัจจุบัน:</span>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2f86cf]"
        >
          {OEE_PHASES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] text-[#69748a]">
              <th className="p-[6px_8px] font-medium">OEE Input</th>
              <th className="p-[6px_8px] text-right font-medium">This month</th>
              <th className="p-[6px_8px] text-right font-medium">Target</th>
              <th className="p-[6px_8px] text-right font-medium">Last month</th>
              <th className="p-[6px_8px] font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {OEE_REPORT_ROWS.map((r) => (
              <tr key={r.key} className="border-t border-[#eef1f5]">
                <td className="p-[6px_8px] text-[#3a4658]">{r.label}</td>
                <td className="p-[6px_8px]">
                  <input value={rows[r.key].cur} onChange={(e) => set(r.key, "cur", e.target.value)} className={cell} />
                </td>
                <td className="p-[6px_8px]">
                  {r.hasTarget ? (
                    <input value={rows[r.key].target} onChange={(e) => set(r.key, "target", e.target.value)} className={cell} />
                  ) : (
                    <span className="block text-center text-[#c9d0da]">–</span>
                  )}
                </td>
                <td className="p-[6px_8px]">
                  <input value={rows[r.key].prev} onChange={(e) => set(r.key, "prev", e.target.value)} className={cell} />
                </td>
                <td className="p-[6px_8px] text-[10.5px] text-[#9aa4b4]">{r.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save report (บันทึก)"}
        </button>
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import { OEE_STANDARDS_KEY, OEE_MACHINES } from "@/lib/settingsKeys";

/** Edit each machine/line's standard output rate (kg/hr) — unloading machines
 *  (fixed) plus the production lines defined in the pick-list above. Used to score
 *  the Performance component of OEE. Stored as JSON in AppSetting — no schema
 *  change. */
export function OeeStandardsCard({
  standards,
  prodLines,
}: {
  standards: Record<string, number>;
  prodLines: string[];
}) {
  const router = useRouter();
  const allNames = [...OEE_MACHINES, ...prodLines];
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(allNames.map((m) => [m, String(standards[m] ?? "")]))
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    const map: Record<string, number> = {};
    for (const m of allNames) {
      const n = Number(rates[m]);
      if (Number.isFinite(n) && n > 0) map[m] = n;
    }
    setBusy(true);
    await saveAppSettingsAction({ [OEE_STANDARDS_KEY]: JSON.stringify(map) });
    setBusy(false);
    showToast("Saved (บันทึกค่ามาตรฐานแล้ว)");
    router.refresh();
  }

  const rateInput = (m: string) => (
    <label key={m} className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-[#3a4658]">{m}</span>
      <div className="flex items-center gap-1.5">
        <input
          value={rates[m] ?? ""}
          onChange={(e) => setRates((r) => ({ ...r, [m]: e.target.value }))}
          inputMode="decimal"
          placeholder="0"
          className="font-num w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2f86cf]"
        />
        <span className="text-[11.5px] text-[#9aa4b4]">kg/hr</span>
      </div>
    </label>
  );

  return (
    <Card>
      <CardTitle>OEE — ค่ามาตรฐานเครื่อง (Unloading standards)</CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        กำลังโหลดมาตรฐานต่อชั่วโมงของแต่ละเครื่อง — ใช้คำนวณ <b>Performance</b> ของ OEE จากเวลาโหลดจริงในหน้า
        Feed to SILO (ไม่ต้องคีย์เพิ่ม ระบบดึงเวลาให้เอง).
      </p>
      <div className="mb-1 text-[11.5px] font-semibold text-[#69748a]">Unloading (SILO)</div>
      <div className="grid gap-3 sm:grid-cols-3">{OEE_MACHINES.map(rateInput)}</div>

      {prodLines.length > 0 && (
        <>
          <div className="mb-1 mt-4 text-[11.5px] font-semibold text-[#69748a]">
            สายการผลิต (Production lines)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">{prodLines.map(rateInput)}</div>
        </>
      )}

      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save (บันทึก)"}
        </button>
      </div>
    </Card>
  );
}

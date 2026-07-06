"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import {
  COUNT_PLAN_MONTHLY_KEY,
  COUNT_PLAN_WEEKLY_KEY,
} from "@/lib/settingsKeys";
import { showToast } from "@/components/ui/Toast";

export function CountPlanCard({
  monthly,
  weekly,
}: {
  monthly: string;
  weekly: string;
}) {
  const router = useRouter();
  const [m, setM] = useState(monthly);
  const [w, setW] = useState(weekly);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    await saveAppSettingsAction({
      [COUNT_PLAN_MONTHLY_KEY]: m,
      [COUNT_PLAN_WEEKLY_KEY]: w,
    });
    setBusy(false);
    showToast("Count plan saved");
    router.refresh();
  }

  return (
    <Card>
      <CardTitle>Stock Count Plan (แผนนับสต็อก)</CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        ตั้งเป้าจำนวน lot ที่ต้องนับต่อเดือน/ต่อสัปดาห์ — ใช้เป็นตัวตั้ง (แผน) ในกราฟ Count Progress
        บนแดชบอร์ด · เว้นว่าง = นับทุก lot (Leave blank to plan every lot.)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-[#69748a]">
            Per month (ต่อเดือน) — lots
          </span>
          <input
            value={m}
            onChange={(e) => setM(e.target.value)}
            type="number"
            min="0"
            placeholder="e.g. 84"
            className="w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#3E9B6E]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-[#69748a]">
            Per week (ต่อสัปดาห์) — lots
          </span>
          <input
            value={w}
            onChange={(e) => setW(e.target.value)}
            type="number"
            min="0"
            placeholder="e.g. 21"
            className="w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#3E9B6E]"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={handleSave} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save plan"}
        </button>
      </div>
    </Card>
  );
}

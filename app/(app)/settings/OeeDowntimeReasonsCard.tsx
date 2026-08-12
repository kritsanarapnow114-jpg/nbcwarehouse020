"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import {
  LOSS_CATEGORIES,
  OEE_DOWNTIME_REASONS_KEY,
  type DowntimeReasonDef,
} from "@/lib/settingsKeys";
import { showToast } from "@/components/ui/Toast";

/** Configure the downtime reasons shown on the Pack Order OEE capture, and the
 *  responsible loss category (ฝ่ายรับผิดชอบ) each reason maps to. On the capture
 *  form, picking a reason narrows the category dropdown to just its categories.
 *  A reason with no category ticked allows any category. */
export function OeeDowntimeReasonsCard({ reasons }: { reasons: DowntimeReasonDef[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<DowntimeReasonDef[]>(
    reasons.map((r) => ({ reason: r.reason, categories: [...r.categories] }))
  );
  const [busy, setBusy] = useState(false);

  function setReason(i: number, reason: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, reason } : r)));
  }
  function toggleCat(i: number, cat: string) {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const has = r.categories.includes(cat);
        return {
          ...r,
          categories: has ? r.categories.filter((c) => c !== cat) : [...r.categories, cat],
        };
      })
    );
  }
  function addRow() {
    setRows((rs) => [...rs, { reason: "", categories: [] }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const clean = rows
      .map((r) => ({ reason: r.reason.trim(), categories: r.categories }))
      .filter((r) => r.reason !== "");
    setBusy(true);
    await saveAppSettingsAction({
      [OEE_DOWNTIME_REASONS_KEY]: clean.length > 0 ? JSON.stringify(clean) : "",
    });
    setBusy(false);
    showToast("Downtime reasons saved (บันทึกเหตุหยุดเครื่องแล้ว)");
    router.refresh();
  }

  return (
    <Card>
      <CardTitle>OEE — เหตุหยุดเครื่อง (Downtime reasons)</CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        ตั้งรายการ &quot;เหตุที่หยุด&quot; ที่เลือกได้ตอนบันทึก Pack Order และเลือกหมวดฝ่ายรับผิดชอบของแต่ละเหตุ —
        เวลาเลือกเหตุ ช่องหมวดจะโชว์เฉพาะหมวดของเหตุนั้น (ไม่ติ๊กเลย = เลือกได้ทุกหมวด).
      </p>

      <div className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <div key={i} className="rounded-[10px] border border-[#e7ebf1] bg-[#fafbfc] p-2.5">
            <div className="flex items-center gap-2">
              <input
                value={r.reason}
                onChange={(e) => setReason(i, e.target.value)}
                placeholder="เหตุที่หยุด เช่น เครื่องเสีย"
                className="w-[190px] rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f86cf]"
              />
              <span className="text-[11.5px] text-[#9aa4b4]">→ หมวดฝ่ายรับผิดชอบ</span>
              <div className="flex-1" />
              <button
                onClick={() => removeRow(i)}
                title="ลบเหตุนี้"
                className="text-[16px] text-[#c2606f]"
              >
                ×
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LOSS_CATEGORIES.map((c) => {
                const on = r.categories.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCat(i, c)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      on
                        ? "border-[#2f86cf] bg-[#e8f2fb] text-[#1f66a6]"
                        : "border-[#e2e6ec] bg-white text-[#69748a]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {r.categories.length === 0 && (
              <div className="mt-1.5 text-[11px] text-[#9aa4b4]">
                * ไม่ได้เลือกหมวด — เหตุนี้จะเลือกได้ทุกหมวด (any category)
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={addRow}
          className="rounded-[8px] border border-dashed border-[#c4ccd8] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#3a4658] hover:bg-[#f7f9fb]"
        >
          ＋ เพิ่มเหตุ (add reason)
        </button>
        <button onClick={handleSave} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save reasons (บันทึก)"}
        </button>
      </div>
    </Card>
  );
}

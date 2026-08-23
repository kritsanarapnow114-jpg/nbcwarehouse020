"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import { OEE_DOWNTIME_REASONS_KEY, type DowntimeReasonDef } from "@/lib/settingsKeys";
import { showToast } from "@/components/ui/Toast";

/** Configure the downtime reasons shown on the Pack Order OEE capture. Each
 *  reason can carry a list of sub-items (e.g. machine names) that autocomplete
 *  the free-text "อธิบายเหตุ" box when recording downtime. */
export function OeeDowntimeReasonsCard({ reasons }: { reasons: DowntimeReasonDef[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<DowntimeReasonDef[]>(
    reasons.map((r) => ({ reason: r.reason, categories: [...r.categories], details: [...r.details] }))
  );
  const [busy, setBusy] = useState(false);

  function setReason(i: number, reason: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, reason } : r)));
  }
  // Keep raw lines (incl. blanks) while editing so typing newlines works; the
  // trim/blank-filter happens on save.
  function setDetails(i: number, text: string) {
    const details = text.split("\n");
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, details } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { reason: "", categories: [], details: [] }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const clean = rows
      .map((r) => ({
        reason: r.reason.trim(),
        categories: [],
        details: r.details.map((d) => d.trim()).filter((d) => d !== ""),
      }))
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
        ตั้งรายการ &quot;เหตุที่หยุด&quot; ที่เลือกได้ตอนบันทึก Pack Order · ใส่ตัวเลือกย่อยได้ เช่น
        &quot;เครื่องไหน&quot; เพื่อช่วยเติมช่อง &quot;อธิบายเหตุ&quot; ตอนบันทึก (พิมพ์เองก็ได้).
      </p>

      <div className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <div key={i} className="rounded-[10px] border border-[#e7ebf1] bg-[#fafbfc] p-2.5">
            <div className="flex items-center gap-2">
              <input
                value={r.reason}
                onChange={(e) => setReason(i, e.target.value)}
                placeholder="เหตุที่หยุด เช่น เครื่องเสีย"
                className="w-[220px] rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f86cf]"
              />
              <div className="flex-1" />
              <button
                onClick={() => removeRow(i)}
                title="ลบเหตุนี้"
                className="text-[16px] text-[#c2606f]"
              >
                ×
              </button>
            </div>
            <label className="mt-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-[#69748a]">
                ตัวเลือกย่อย เช่น &quot;เครื่องไหน&quot; — 1 บรรทัดต่อ 1 รายการ (เว้นว่าง = ไม่มีตัวช่วยเติม)
              </span>
              <textarea
                value={r.details.join("\n")}
                onChange={(e) => setDetails(i, e.target.value)}
                rows={2}
                placeholder={"เช่น\nเครื่องบรรจุ #1\nเครื่องซีล #2"}
                className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f86cf]"
              />
            </label>
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

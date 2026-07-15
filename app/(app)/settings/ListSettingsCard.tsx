"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import { ISSUE_TO_KEY, OPERATORS_KEY, BOM_SOURCE_KEY, ISSUE_TO_DEFAULTS } from "@/lib/settingsKeys";
import { showToast } from "@/components/ui/Toast";

/** Manage the editable pick-lists used by Issue ("จ่ายไปที่") and Transfer
 *  ("ผู้ปฏิบัติงาน"), plus the BOM source location(s). One entry per line. */
export function ListSettingsCard({
  issueTo,
  operators,
  bomSource,
}: {
  issueTo: string;
  operators: string;
  bomSource: string;
}) {
  const router = useRouter();
  const [issueToText, setIssueToText] = useState(
    issueTo || ISSUE_TO_DEFAULTS.join("\n")
  );
  const [opsText, setOpsText] = useState(operators);
  const [bomText, setBomText] = useState(bomSource);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    await saveAppSettingsAction({
      [ISSUE_TO_KEY]: issueToText,
      [OPERATORS_KEY]: opsText,
      [BOM_SOURCE_KEY]: bomText,
    });
    setBusy(false);
    showToast("Lists saved (บันทึกรายการแล้ว)");
    router.refresh();
  }

  return (
    <Card>
      <CardTitle>Pick-lists (รายการตัวเลือก)</CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        เพิ่ม/ลบตัวเลือก — พิมพ์บรรทัดละ 1 รายการ (one entry per line).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-[#3a4658]">
            Issue → จ่ายไปที่ (Issue To)
          </span>
          <textarea
            value={issueToText}
            onChange={(e) => setIssueToText(e.target.value)}
            rows={6}
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 font-num text-[12.5px] outline-none focus:border-[#2f8f5b]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-[#3a4658]">
            Transfer → ผู้ปฏิบัติงาน (Operators)
          </span>
          <textarea
            value={opsText}
            onChange={(e) => setOpsText(e.target.value)}
            rows={6}
            placeholder="ชื่อผู้ปฏิบัติงานเพิ่มเติม (นอกเหนือจากรายชื่อผู้ใช้)"
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 font-num text-[12.5px] outline-none focus:border-[#2f8f5b]"
          />
          <span className="text-[11px] text-[#9aa4b4]">
            * รายชื่อผู้ใช้ในระบบจะแสดงให้อยู่แล้ว ช่องนี้ไว้เพิ่มชื่อพิเศษ
          </span>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[12px] font-medium text-[#3a4658]">
            BOM ตัดวัตถุดิบจาก Location (Packing Line)
          </span>
          <textarea
            value={bomText}
            onChange={(e) => setBomText(e.target.value)}
            rows={2}
            placeholder="ใส่รหัส Location ที่ให้ตัด BOM เช่น A-01 (เว้นว่าง = ตัดจากทุกที่ FIFO)"
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 font-num text-[12.5px] outline-none focus:border-[#2f8f5b]"
          />
          <span className="text-[11px] text-[#9aa4b4]">
            ใส่รหัสที่เก็บของสายแพ็ค 1 บรรทัดต่อ 1 รหัส — ถ้าใส่แล้ว ระบบจะตัดวัตถุดิบเฉพาะจากที่นี่เท่านั้น
          </span>
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={handleSave} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save lists (บันทึก)"}
        </button>
      </div>
    </Card>
  );
}

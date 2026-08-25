"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import { ISSUE_TO_KEY, OPERATORS_KEY, BOM_SOURCE_KEY, PROD_LINES_KEY, PROD_SHIFTS_KEY, PROD_SHIFTS_DEFAULTS, ISSUE_TO_DEFAULTS } from "@/lib/settingsKeys";
import { showToast } from "@/components/ui/Toast";

/** Manage the editable pick-lists used by Issue ("จ่ายไปที่") and Transfer
 *  ("ผู้ปฏิบัติงาน"), the BOM source location(s), and the production lines shown
 *  on the Pack Order OEE capture. One entry per line. */
export function ListSettingsCard({
  issueTo,
  operators,
  bomSource,
  prodLines,
  prodShifts,
}: {
  issueTo: string;
  operators: string;
  bomSource: string;
  prodLines: string;
  prodShifts: string;
}) {
  const router = useRouter();
  const [issueToText, setIssueToText] = useState(
    issueTo || ISSUE_TO_DEFAULTS.join("\n")
  );
  const [opsText, setOpsText] = useState(operators);
  const [bomText, setBomText] = useState(bomSource);
  const [prodText, setProdText] = useState(prodLines);
  const [shiftText, setShiftText] = useState(prodShifts || PROD_SHIFTS_DEFAULTS.join("\n"));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    await saveAppSettingsAction({
      [ISSUE_TO_KEY]: issueToText,
      [OPERATORS_KEY]: opsText,
      [BOM_SOURCE_KEY]: bomText,
      [PROD_LINES_KEY]: prodText,
      [PROD_SHIFTS_KEY]: shiftText,
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
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 font-num text-[12.5px] outline-none focus:border-[#2f86cf]"
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
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 font-num text-[12.5px] outline-none focus:border-[#2f86cf]"
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
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 font-num text-[12.5px] outline-none focus:border-[#2f86cf]"
          />
          <span className="text-[11px] text-[#9aa4b4]">
            ใส่รหัสที่เก็บของสายแพ็ค 1 บรรทัดต่อ 1 รหัส — ถ้าใส่แล้ว ระบบจะตัดวัตถุดิบเฉพาะจากที่นี่เท่านั้น
          </span>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[12px] font-medium text-[#3a4658]">
            Pack Order → สายการผลิต (Production lines สำหรับ OEE)
          </span>
          <textarea
            value={prodText}
            onChange={(e) => setProdText(e.target.value)}
            rows={3}
            placeholder="ชื่อสายผลิต/เครื่อง 1 บรรทัดต่อ 1 รายการ เช่น&#10;สายผลิต 1&#10;สายผลิต 2"
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f86cf]"
          />
          <span className="text-[11px] text-[#9aa4b4]">
            แสดงเป็นตัวเลือกตอนบันทึก Pack Order เพื่อวัด OEE ฝั่งผลิต — ตั้งค่ามาตรฐาน kg/ชม. ได้ที่การ์ด OEE ด้านล่าง
          </span>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[12px] font-medium text-[#3a4658]">
            Pack Order → กะการผลิต (Shifts สำหรับ OEE)
          </span>
          <textarea
            value={shiftText}
            onChange={(e) => setShiftText(e.target.value)}
            rows={3}
            placeholder="ชื่อกะ 1 บรรทัดต่อ 1 รายการ เช่น&#10;กะ A (เช้า)&#10;กะ B (บ่าย)&#10;กะ C (ดึก)"
            className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#2f86cf]"
          />
          <span className="text-[11px] text-[#9aa4b4]">
            เลือกตอนบันทึก Pack Order แล้วรายงาน OEE จะแยกตามกะให้ — เว้นว่างจะใช้ค่าเริ่มต้น (กะ A/B/C)
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

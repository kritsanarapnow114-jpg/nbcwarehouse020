"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import {
  createOeeMachineAction,
  updateOeeMachineAction,
  deleteOeeMachineAction,
} from "@/lib/actions/oee";
import type { OeeMachineRow } from "@/lib/views/oee";

const OP_LABEL: Record<string, string> = {
  PRODUCTION: "การผลิต (Production)",
  UNLOADING: "Unloading เข้า SILO",
};

const blank = {
  name: "",
  operation: "PRODUCTION" as "PRODUCTION" | "UNLOADING",
  standardRate: "",
  rateUnit: "kg/hr",
};

/** Manage OEE machines + their standard output rate. These drive the Performance
 *  score on the Receive capture form and the OEE dashboard. */
export function OeeMachinesCard({ machines }: { machines: OeeMachineRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdd() {
    setEditingId("new");
    setForm(blank);
    setError(null);
  }
  function startEdit(m: OeeMachineRow) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      operation: m.operation,
      standardRate: String(m.standardRate),
      rateUnit: m.rateUnit,
    });
    setError(null);
  }
  function cancel() {
    setEditingId(null);
    setError(null);
  }

  async function save() {
    setError(null);
    const rate = Number(form.standardRate);
    if (!form.name.trim()) return setError("กรุณาตั้งชื่อเครื่อง");
    if (!(rate > 0)) return setError("ค่ามาตรฐานต้องมากกว่า 0");
    setBusy(true);
    const payload = {
      name: form.name,
      operation: form.operation,
      standardRate: rate,
      rateUnit: form.rateUnit,
    };
    const res =
      editingId === "new"
        ? await createOeeMachineAction(payload)
        : await updateOeeMachineAction(editingId!, payload);
    setBusy(false);
    if (res.error) return setError(res.error);
    showToast("Saved (บันทึกเครื่องแล้ว)");
    setEditingId(null);
    router.refresh();
  }

  async function remove(m: OeeMachineRow) {
    if (!confirm(`ลบเครื่อง "${m.name}"?\n(ถ้าเคยใช้บันทึก OEE แล้ว จะถูกปิดใช้งานแทนการลบ)`)) return;
    setBusy(true);
    const res = await deleteOeeMachineAction(m.id);
    setBusy(false);
    if (res.error) return showToast(res.error);
    showToast("Removed (ลบแล้ว)");
    router.refresh();
  }

  async function toggleActive(m: OeeMachineRow) {
    setBusy(true);
    const res = await updateOeeMachineAction(m.id, {
      name: m.name,
      operation: m.operation,
      standardRate: m.standardRate,
      rateUnit: m.rateUnit,
      active: !m.active,
    });
    setBusy(false);
    if (res.error) return showToast(res.error);
    router.refresh();
  }

  const inputCls =
    "rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2f86cf]";

  return (
    <Card>
      <CardTitle
        action={
          editingId === null ? (
            <button onClick={startAdd} className={buttonClass("primary")}>
              + Add machine (เพิ่มเครื่อง)
            </button>
          ) : undefined
        }
      >
        OEE Machines (เครื่องจักร &amp; ค่ามาตรฐาน)
      </CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        ตั้งค่ามาตรฐานกำลังผลิตต่อเครื่อง (เช่น 1,500 kg/ชม.) — ใช้คำนวณ Performance ของ OEE
        ตอนบันทึกรับสินค้า/ผลิต.
      </p>

      {editingId !== null && (
        <div className="mb-3 rounded-[10px] border border-[#cfe4f6] bg-[#f4f9fe] p-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#3a4658]">ชื่อเครื่อง</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น Super Sack Unloading #1"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#3a4658]">ประเภทงาน</span>
              <select
                value={form.operation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, operation: e.target.value as "PRODUCTION" | "UNLOADING" }))
                }
                className={inputCls}
              >
                <option value="PRODUCTION">{OP_LABEL.PRODUCTION}</option>
                <option value="UNLOADING">{OP_LABEL.UNLOADING}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#3a4658]">ค่ามาตรฐาน (ต่อชั่วโมง)</span>
              <input
                value={form.standardRate}
                onChange={(e) => setForm((f) => ({ ...f, standardRate: e.target.value }))}
                placeholder="1500"
                inputMode="decimal"
                className={`font-num ${inputCls}`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#3a4658]">หน่วย</span>
              <input
                value={form.rateUnit}
                onChange={(e) => setForm((f) => ({ ...f, rateUnit: e.target.value }))}
                placeholder="kg/hr"
                className={inputCls}
              />
            </label>
          </div>
          {error && <div className="mt-2 text-[12px] text-[#c53f3f]">{error}</div>}
          <div className="mt-2.5 flex justify-end gap-2">
            <button onClick={cancel} className={buttonClass("secondary")}>
              ยกเลิก
            </button>
            <button onClick={save} disabled={busy} className={buttonClass("primary")}>
              {busy ? "Saving…" : "บันทึก"}
            </button>
          </div>
        </div>
      )}

      {machines.length === 0 && editingId === null ? (
        <div className="rounded-[10px] bg-[#f7f9fb] p-4 text-center text-[12.5px] text-[#9aa4b4]">
          ยังไม่มีเครื่องจักร — กด “+ Add machine” เพื่อเพิ่มเครื่องแรก
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-[#eef1f5]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[11.5px] text-[#69748a]">
                <th className="p-[9px_12px] font-medium">เครื่อง</th>
                <th className="p-[9px_12px] font-medium">ประเภท</th>
                <th className="p-[9px_12px] text-right font-medium">มาตรฐาน</th>
                <th className="p-[9px_12px] font-medium">สถานะ</th>
                <th className="w-24 p-[9px_12px]"></th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className={`border-t border-[#eef1f5] ${m.active ? "" : "bg-[#f7f9fb] text-[#9aa4b4]"}`}>
                  <td className="p-[9px_12px] font-medium">{m.name}</td>
                  <td className="p-[9px_12px] text-[12px] text-[#69748a]">{OP_LABEL[m.operation]}</td>
                  <td className="font-num p-[9px_12px] text-right">
                    {m.standardRate.toLocaleString()} <span className="text-[11px] text-[#9aa4b4]">{m.rateUnit}</span>
                  </td>
                  <td className="p-[9px_12px]">
                    <button
                      onClick={() => toggleActive(m)}
                      disabled={busy}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        m.active ? "bg-[#e9f6ee] text-[#1f9d63]" : "bg-[#eef1f5] text-[#9aa4b4]"
                      }`}
                    >
                      {m.active ? "ใช้งาน" : "ปิดใช้"}
                    </button>
                  </td>
                  <td className="p-[9px_12px] text-right">
                    <button onClick={() => startEdit(m)} className="text-[12px] text-[#2f86cf]">
                      แก้ไข
                    </button>
                    <button onClick={() => remove(m)} className="ml-3 text-[12px] text-[#c2606f]">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

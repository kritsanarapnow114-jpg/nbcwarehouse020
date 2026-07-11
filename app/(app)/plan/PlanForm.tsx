"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlanFG, MaterialReq } from "@/lib/views/plan";
import { PlanPeriod, PLAN_PERIODS, PERIOD_WORD } from "@/lib/planPeriods";
import { savePlanAction } from "@/lib/actions/plan";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { downloadExcel } from "@/lib/calc/csvClient";

const CAT_COLOR: Record<string, string> = {
  PACKAGING: "#22c58e",
  RAW_MATERIAL: "#12b5d4",
  FINISHED_GOODS: "#f7a63b",
  SPARE_PARTS: "#7b6ef0",
};

export function PlanForm({
  fgs,
  rows,
  period,
}: {
  fgs: PlanFG[];
  rows: MaterialReq[];
  period: PlanPeriod;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<Record<string, string>>(() => {
    const p: Record<string, string> = {};
    for (const f of fgs) p[f.code] = f.qty > 0 ? String(f.qty) : "";
    return p;
  });
  const [saving, setSaving] = useState(false);
  const [onlyPkg, setOnlyPkg] = useState(false);

  async function handleSave() {
    setSaving(true);
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(plan)) payload[k] = Number(v) || 0;
    const res = await savePlanAction(period, payload);
    setSaving(false);
    if (res.error) {
      showToast(res.error);
      return;
    }
    showToast("บันทึกแผนแล้ว — คำนวณของที่ต้องสั่งใหม่");
    router.refresh();
  }

  const shown = onlyPkg ? rows.filter((r) => r.category === "PACKAGING") : rows;
  const toOrderCount = rows.filter((r) => r.toOrder > 0).length;

  function handleExport() {
    downloadExcel(
      "packaging-plan.xls",
      "Packaging Plan",
      ["SAP Material Master", "Material Description", "Category", "Required", "OnHand", "IncomingPO", "ToOrder", "Unit"],
      shown.map((r) => [r.code, r.name, r.categoryLabel, r.required, r.onHand, r.incoming, r.toOrder, r.unit])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Period tabs */}
      <div className="flex flex-wrap items-center gap-2.5">
        {PLAN_PERIODS.map((t) => (
          <Link
            key={t.value}
            href={`/plan?period=${t.value}`}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium ${
              period === t.value
                ? "bg-[#12a2bb] text-white"
                : "border border-[#e2e6ec] bg-white text-[#3a4658]"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <span className="text-[12px] text-[#9aa4b4]">— แผนแต่ละช่วงเก็บแยกกัน</span>
      </div>

      {/* Production plan input */}
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex items-center gap-3 border-b border-[#eef1f5] p-[16px_20px]">
          <div className="flex-1 text-[14px] font-semibold">
            แผนการผลิต ({PERIOD_WORD[period]}) — จะผลิตอะไรกี่หน่วย
          </div>
          <button onClick={handleSave} disabled={saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : "บันทึก & คำนวณ"}
          </button>
        </div>
        {fgs.length === 0 ? (
          <div className="p-6 text-center text-[12.5px] text-[#9aa4b4]">
            ยังไม่มีสินค้าที่ตั้งสูตร BOM — ไปตั้ง BOM ที่หน้า Products (สินค้าสำเร็จรูป) ก่อน
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {fgs.map((f) => (
              <label key={f.code} className="flex items-center gap-2 rounded-[10px] border border-[#eef1f5] p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{f.name}</div>
                  <div className="font-num text-[11px] text-[#9aa4b4]">{f.code}</div>
                </div>
                <input
                  value={plan[f.code] ?? ""}
                  onChange={(e) => setPlan((p) => ({ ...p, [f.code]: e.target.value }))}
                  placeholder="0"
                  className="font-num w-[92px] rounded-[8px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px] outline-none focus:border-[#12a2bb]"
                />
                <span className="w-8 flex-none text-[11px] text-[#9aa4b4]">{f.unit}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Material requirement / order plan */}
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#eef1f5] p-[14px_20px]">
          <div className="text-[14px] font-semibold">
            ต้องสั่งซื้อ ({PERIOD_WORD[period]}) —{" "}
            <span className="text-[#0e8ba1]">{toOrderCount}</span> รายการต้องสั่งเพิ่ม
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-[#69748a]">
            <input type="checkbox" checked={onlyPkg} onChange={(e) => setOnlyPkg(e.target.checked)} />
            เฉพาะบรรจุภัณฑ์ (packaging)
          </label>
          <div className="flex-1" />
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-[8px] border border-[#16a6bf] bg-[#e6f5fa] px-3.5 py-2 text-[12.5px] font-semibold text-[#0c7f93]">
            ⤓ Export Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">หมวด</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">ต้องใช้ (Required)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">คงเหลือ (OnHand)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">PO ค้าง (Incoming)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">ต้องสั่ง (To order)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.code} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[10px_16px] text-[12px] text-[#3a4658]">{r.code}</td>
                  <td className="p-[10px_16px] font-medium">{r.name}</td>
                  <td className="p-[10px_16px]">
                    <span
                      className="rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold text-white"
                      style={{ background: CAT_COLOR[r.category] ?? "#94a3b8" }}
                    >
                      {r.category === "PACKAGING" ? "บรรจุภัณฑ์" : r.category === "RAW_MATERIAL" ? "วัตถุดิบ" : r.category}
                    </span>
                  </td>
                  <td className="font-num p-[10px_16px] text-right">{r.required.toLocaleString()} {r.unit}</td>
                  <td className="font-num p-[10px_16px] text-right text-[#69748a]">{r.onHand.toLocaleString()}</td>
                  <td className="font-num p-[10px_16px] text-right text-[#69748a]">{r.incoming.toLocaleString()}</td>
                  <td className="p-[10px_16px] text-right">
                    {r.toOrder > 0 ? (
                      <span className="font-num rounded-[6px] bg-[#e6f5ee] px-2 py-0.5 text-[13px] font-bold text-[#0e8a4f]">
                        +{r.toOrder.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#9aa4b4]">พอ (ok)</span>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#9aa4b4]">
                    ใส่แผนการผลิตด้านบนแล้วกด &quot;บันทึก &amp; คำนวณ&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

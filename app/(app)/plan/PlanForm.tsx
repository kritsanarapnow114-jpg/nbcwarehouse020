"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialReq, PlanProduct, DayTotal } from "@/lib/views/plan";
import { PackagingType, ScheduleRow, IncomingRow } from "@/lib/planTypes";
import { savePackagingTypesAction, saveScheduleAction, saveIncomingAction } from "@/lib/actions/plan";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { downloadExcel } from "@/lib/calc/csvClient";
import { fmtDateISO, fmtDateBE } from "@/lib/calc/date";

const uid = () => Math.random().toString(36).slice(2, 9);

export function PlanForm({
  packagingProducts,
  packagingTypes,
  schedule,
  incoming,
  rows,
  days,
}: {
  packagingProducts: PlanProduct[];
  packagingTypes: PackagingType[];
  schedule: ScheduleRow[];
  incoming: IncomingRow[];
  rows: MaterialReq[];
  days: DayTotal[];
}) {
  const router = useRouter();
  const [types, setTypes] = useState<PackagingType[]>(
    packagingTypes.length
      ? packagingTypes
      : [
          { id: uid(), name: "Box", lines: [] },
          { id: uid(), name: "Supersack", lines: [] },
        ]
  );
  const [sched, setSched] = useState<ScheduleRow[]>(schedule);
  const [savingT, setSavingT] = useState(false);
  const [savingS, setSavingS] = useState(false);
  const [onlyPkg, setOnlyPkg] = useState(false);

  // ---- Packaging types ----
  async function saveTypes() {
    setSavingT(true);
    const res = await savePackagingTypesAction(types);
    setSavingT(false);
    if (res.error) return showToast(res.error);
    showToast("บันทึกแบบบรรจุภัณฑ์แล้ว");
    router.refresh();
  }
  function addType() {
    setTypes((t) => [...t, { id: uid(), name: `แบบ ${t.length + 1}`, lines: [] }]);
  }
  function delType(id: string) {
    setTypes((t) => t.filter((x) => x.id !== id));
  }
  function setTypeName(id: string, name: string) {
    setTypes((t) => t.map((x) => (x.id === id ? { ...x, name } : x)));
  }
  function addTypeLine(id: string) {
    setTypes((t) =>
      t.map((x) => (x.id === id ? { ...x, lines: [...x.lines, { code: "", qtyPerUnit: 1 }] } : x))
    );
  }
  function setTypeLine(id: string, i: number, patch: Partial<{ code: string; qtyPerUnit: number }>) {
    setTypes((t) =>
      t.map((x) =>
        x.id === id ? { ...x, lines: x.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : x
      )
    );
  }
  function delTypeLine(id: string, i: number) {
    setTypes((t) => t.map((x) => (x.id === id ? { ...x, lines: x.lines.filter((_, idx) => idx !== i) } : x)));
  }

  // ---- Schedule ----
  async function saveSchedule() {
    setSavingS(true);
    const res = await saveScheduleAction(sched);
    setSavingS(false);
    if (res.error) return showToast(res.error);
    showToast("บันทึกแผนผลิตแล้ว — คำนวณของที่ต้องสั่งใหม่");
    router.refresh();
  }
  function addRow() {
    setSched((s) => [
      ...s,
      { id: uid(), date: fmtDateISO(new Date()), qty: 0, pkgTypeId: types[0]?.id ?? "" },
    ]);
  }
  function setRow(id: string, patch: Partial<ScheduleRow>) {
    setSched((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function delRow(id: string) {
    setSched((s) => s.filter((r) => r.id !== id));
  }

  // ---- Incoming ("เรียกเข้า") ----
  const [inc, setInc] = useState<IncomingRow[]>(incoming);
  const [savingI, setSavingI] = useState(false);
  async function saveIncoming() {
    setSavingI(true);
    const res = await saveIncomingAction(inc);
    setSavingI(false);
    if (res.error) return showToast(res.error);
    showToast("บันทึกแผนของเข้าแล้ว — คำนวณใหม่");
    router.refresh();
  }
  function addInc() {
    setInc((s) => [
      ...s,
      { id: uid(), date: fmtDateISO(new Date()), code: packagingProducts[0]?.code ?? "", qty: 0 },
    ]);
  }
  function setIncRow(id: string, patch: Partial<IncomingRow>) {
    setInc((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function delInc(id: string) {
    setInc((s) => s.filter((r) => r.id !== id));
  }

  const [leadDays, setLeadDays] = useState(1);
  const shown = onlyPkg ? rows.filter((r) => r.category === "PACKAGING") : rows;
  const toOrderCount = rows.filter((r) => r.toOrder > 0).length;

  // Order-by date = the day stock runs short, minus the lead time.
  function orderByStr(shortage: string | null): string {
    if (!shortage) return "—";
    const d = new Date(shortage);
    d.setDate(d.getDate() - leadDays);
    return fmtDateBE(d);
  }
  const shortStr = (s: string | null) => (s ? fmtDateBE(new Date(s)) : "—");

  // Ready-to-use order list: only items that need ordering.
  function handleOrderList() {
    const toOrder = rows.filter((r) => r.toOrder > 0);
    downloadExcel(
      "order-list.xls",
      "Order List",
      ["SAP Material Master", "Material Description", "หน่วย (Unit)", "จำนวนที่ต้องสั่ง (Order Qty)", "วันจะขาด (Need date)", "ควรสั่งภายใน (Order by)"],
      toOrder.map((r) => [r.code, r.name, r.unit, r.toOrder, shortStr(r.shortageDate), orderByStr(r.shortageDate)])
    );
  }

  function handleExportAll() {
    downloadExcel(
      "packaging-plan.xls",
      "Order Plan",
      ["SAP Material Master", "Material Description", "Category", "Required", "OnHand", "Incoming", "ToOrder", "NeedDate", "OrderBy", "Unit"],
      shown.map((r) => [r.code, r.name, r.categoryLabel, r.required, r.onHand, r.incoming, r.toOrder, shortStr(r.shortageDate), orderByStr(r.shortageDate), r.unit])
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1) Packaging types */}
      <Card>
        <Header
          title="แบบบรรจุภัณฑ์ (Packaging types) — กำหนดเองว่าแต่ละแบบใช้อะไรบ้าง"
          action={
            <div className="flex gap-2">
              <button onClick={addType} className={buttonClass("secondary")}>＋ เพิ่มแบบ</button>
              <button onClick={saveTypes} disabled={savingT} className={buttonClass("primary")}>
                {savingT ? "Saving…" : "บันทึกแบบ"}
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
          {types.map((t) => (
            <div key={t.id} className="rounded-[11px] border border-[#e7ebf1] p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={t.name}
                  onChange={(e) => setTypeName(t.id, e.target.value)}
                  className="flex-1 rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-[#2f8f5b]"
                />
                <button onClick={() => delType(t.id)} className="text-[15px] text-[#c2606f]">🗑</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {t.lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <select
                      value={l.code}
                      onChange={(e) => setTypeLine(t.id, i, { code: e.target.value })}
                      className="font-num min-w-0 flex-1 rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    >
                      <option value="">— เลือกบรรจุภัณฑ์ —</option>
                      {packagingProducts.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code} · {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={String(l.qtyPerUnit)}
                      onChange={(e) => setTypeLine(t.id, i, { qtyPerUnit: Number(e.target.value) || 0 })}
                      title="จำนวนต่อ 1 หน่วยที่ผลิต"
                      className="font-num w-[70px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[12px]"
                    />
                    <span className="text-[10.5px] text-[#9aa4b4]">/หน่วย</span>
                    <button onClick={() => delTypeLine(t.id, i)} className="text-[14px] text-[#c2606f]">×</button>
                  </div>
                ))}
                <button
                  onClick={() => addTypeLine(t.id)}
                  className="mt-1 self-start rounded-[7px] border border-dashed border-[#bcd] px-2 py-1 text-[11.5px] text-[#0c7f93]"
                >
                  ＋ เพิ่มบรรจุภัณฑ์ในแบบนี้
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 2) Daily production schedule */}
      <Card>
        <Header
          title="แผนผลิตรายวัน (Production schedule) — ใส่วันที่ · จำนวน · แบบบรรจุภัณฑ์"
          action={
            <div className="flex gap-2">
              <button onClick={addRow} className={buttonClass("secondary")}>＋ เพิ่มวัน</button>
              <button onClick={saveSchedule} disabled={savingS} className={buttonClass("primary")}>
                {savingS ? "Saving…" : "บันทึก & คำนวณ"}
              </button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[9px_14px] text-[11.5px] font-medium">วันที่ (Date)</th>
                <th className="p-[9px_14px] text-[11.5px] font-medium">แบบบรรจุภัณฑ์ (Box / Supersack)</th>
                <th className="p-[9px_14px] text-right text-[11.5px] font-medium">จำนวนที่ผลิต (Qty)</th>
                <th className="w-8 p-[9px_14px]"></th>
              </tr>
            </thead>
            <tbody>
              {sched.map((r) => (
                <tr key={r.id} className="border-t border-[#eef1f5]">
                  <td className="p-[8px_14px]">
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => setRow(r.id, { date: e.target.value })}
                      className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    />
                  </td>
                  <td className="p-[8px_14px]">
                    <select
                      value={r.pkgTypeId}
                      onChange={(e) => setRow(r.id, { pkgTypeId: e.target.value })}
                      className="w-full min-w-[160px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    >
                      <option value="">— เลือกแบบ —</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-[8px_14px] text-right">
                    <input
                      value={String(r.qty)}
                      onChange={(e) => setRow(r.id, { qty: Number(e.target.value) || 0 })}
                      className="font-num w-[100px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                    />
                  </td>
                  <td className="p-[8px_14px] text-center">
                    <button onClick={() => delRow(r.id)} className="text-[15px] text-[#c2606f]">×</button>
                  </td>
                </tr>
              ))}
              {sched.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#9aa4b4]">
                    กด &quot;＋ เพิ่มวัน&quot; เพื่อใส่แผนผลิตรายวัน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {days.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-[#eef1f5] p-3 text-[11.5px] text-[#69748a]">
            <span className="font-semibold text-[#3a4658]">สรุปต่อวัน:</span>
            {days.map((d) => (
              <span key={d.date} className="font-num rounded-[6px] bg-[#f1f3f7] px-2 py-0.5">
                {fmtDateBE(new Date(d.date))}: {d.qty.toLocaleString()}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* 2b) Incoming schedule */}
      <Card>
        <Header
          title="แผนของเข้า / เรียกเข้า (Incoming) — วันไหน ของอะไร เข้ามาเท่าไร"
          action={
            <div className="flex gap-2">
              <button onClick={addInc} className={buttonClass("secondary")}>＋ เพิ่มของเข้า</button>
              <button onClick={saveIncoming} disabled={savingI} className={buttonClass("primary")}>
                {savingI ? "Saving…" : "บันทึก & คำนวณ"}
              </button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[9px_14px] text-[11.5px] font-medium">วันที่เข้า (Date)</th>
                <th className="p-[9px_14px] text-[11.5px] font-medium">บรรจุภัณฑ์ (Item)</th>
                <th className="p-[9px_14px] text-right text-[11.5px] font-medium">จำนวนเข้า (Qty)</th>
                <th className="w-8 p-[9px_14px]"></th>
              </tr>
            </thead>
            <tbody>
              {inc.map((r) => (
                <tr key={r.id} className="border-t border-[#eef1f5]">
                  <td className="p-[8px_14px]">
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => setIncRow(r.id, { date: e.target.value })}
                      className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    />
                  </td>
                  <td className="p-[8px_14px]">
                    <select
                      value={r.code}
                      onChange={(e) => setIncRow(r.id, { code: e.target.value })}
                      className="font-num w-full min-w-[200px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    >
                      {packagingProducts.map((pp) => (
                        <option key={pp.code} value={pp.code}>{pp.code} · {pp.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-[8px_14px] text-right">
                    <input
                      value={String(r.qty)}
                      onChange={(e) => setIncRow(r.id, { qty: Number(e.target.value) || 0 })}
                      className="font-num w-[100px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                    />
                  </td>
                  <td className="p-[8px_14px] text-center">
                    <button onClick={() => delInc(r.id)} className="text-[15px] text-[#c2606f]">×</button>
                  </td>
                </tr>
              ))}
              {inc.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#9aa4b4]">
                    ถ้ามีของที่สั่ง/เรียกเข้ามาแล้ว ใส่ตรงนี้ ระบบจะเอาไปเติมสต็อกตามวันที่
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3) Aggregate order plan */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[#eef1f5] p-[14px_20px]">
          <div className="text-[14px] font-semibold">
            เทียบของในคลัง · ต้องสั่งซื้อ —{" "}
            <span className="text-[#237a49]">{toOrderCount}</span> รายการต้องสั่งเพิ่ม
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-[#3a4658]">
            Lead time (วัน)
            <input
              value={String(leadDays)}
              onChange={(e) => setLeadDays(Math.max(0, Number(e.target.value) || 0))}
              className="font-num w-[52px] rounded-[7px] border border-[#d7dce4] px-2 py-1 text-right text-[12.5px]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-[#69748a]">
            <input type="checkbox" checked={onlyPkg} onChange={(e) => setOnlyPkg(e.target.checked)} />
            เฉพาะบรรจุภัณฑ์
          </label>
          <div className="flex-1" />
          <button onClick={handleOrderList} className="flex items-center gap-1.5 rounded-[8px] bg-[#0e8a4f] px-3.5 py-2 text-[12.5px] font-semibold text-white">
            ⤓ ใบสั่งของ (order list)
          </button>
          <button onClick={handleExportAll} className="flex items-center gap-1.5 rounded-[8px] border border-[#16a6bf] bg-[#e8f5ec] px-3.5 py-2 text-[12.5px] font-semibold text-[#0c7f93]">
            ⤓ ทั้งหมด
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">หมวด</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">ต้องใช้</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">คงเหลือในคลัง</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">ของเข้า</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">ต้องสั่ง</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">วันจะขาด</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">ควรสั่งภายใน</th>
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
                      style={{ background: r.category === "PACKAGING" ? "#22c58e" : r.category === "RAW_MATERIAL" ? "#12b5d4" : "#94a3b8" }}
                    >
                      {r.category === "PACKAGING" ? "บรรจุภัณฑ์" : r.category === "RAW_MATERIAL" ? "วัตถุดิบ" : r.category}
                    </span>
                  </td>
                  <td className="font-num p-[10px_16px] text-right">{r.required.toLocaleString()} {r.unit}</td>
                  <td className="font-num p-[10px_16px] text-right text-[#69748a]">{r.onHand.toLocaleString()}</td>
                  <td className="font-num p-[10px_16px] text-right text-[#237a49]">
                    {r.incoming > 0 ? `+${r.incoming.toLocaleString()}` : "—"}
                  </td>
                  <td className="p-[10px_16px] text-right">
                    {r.toOrder > 0 ? (
                      <span className="font-num rounded-[6px] bg-[#e6f5ee] px-2 py-0.5 text-[13px] font-bold text-[#0e8a4f]">
                        +{r.toOrder.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#9aa4b4]">พอ</span>
                    )}
                  </td>
                  <td className="font-num p-[10px_16px] text-[12px]" style={{ color: r.shortageDate ? "#c0453f" : "#9aa4b4" }}>
                    {shortStr(r.shortageDate)}
                  </td>
                  <td className="font-num p-[10px_16px] text-[12px] font-semibold" style={{ color: r.shortageDate ? "#b5790f" : "#9aa4b4" }}>
                    {orderByStr(r.shortageDate)}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#9aa4b4]">
                    ใส่แผนผลิตด้านบนแล้วกด &quot;บันทึก &amp; คำนวณ&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
      {children}
    </div>
  );
}
function Header({ title, action }: { title: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#eef1f5] p-[14px_20px]">
      <div className="flex-1 text-[14px] font-semibold">{title}</div>
      {action}
    </div>
  );
}

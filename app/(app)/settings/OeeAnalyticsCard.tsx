"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { saveAppSettingsAction } from "@/lib/actions/settings";
import {
  OEE_QUALITY_LOSS_KEY,
  OEE_LOSS_PARETO_KEY,
  OEE_KPIS_KEY,
  OEE_KPIS,
  LOSS_CATEGORIES,
  LOSS_STATUSES,
  QUALITY_LOSS_SEED,
  LOSS_PARETO_SEED,
  type QualityLossRow,
  type LossParetoRow,
} from "@/lib/settingsKeys";

const inp =
  "font-num w-full rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2f86cf]";
const sel = "rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px] outline-none focus:border-[#2f86cf]";

/** Editor for the monthly OEE analytics: Quality Loss Pareto, Loss Pareto, and
 *  the extra startup KPIs. All stored as JSON in AppSetting (no schema change). */
export function OeeAnalyticsCard({
  quality,
  loss,
  kpis,
}: {
  quality: QualityLossRow[];
  loss: LossParetoRow[];
  kpis: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(quality.length ? quality : QUALITY_LOSS_SEED);
  const [l, setL] = useState(loss.length ? loss : LOSS_PARETO_SEED);
  const [k, setK] = useState(kpis);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await saveAppSettingsAction({
      [OEE_QUALITY_LOSS_KEY]: JSON.stringify(q.filter((r) => r.reason.trim())),
      [OEE_LOSS_PARETO_KEY]: JSON.stringify(l.filter((r) => r.loss.trim())),
      [OEE_KPIS_KEY]: JSON.stringify(k),
    });
    setBusy(false);
    showToast("Saved (บันทึก Analytics แล้ว)");
    router.refresh();
  }

  const qTotal = q.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  return (
    <Card>
      <CardTitle>OEE Analytics — Quality Pareto · Loss Pareto · KPIs (รายเดือน)</CardTitle>
      <p className="mb-3 text-[12.5px] text-[#69748a]">
        กรอกตัวเลขที่ทีมสรุปรายเดือน — หน้า OEE จะเรนเดอร์เป็น Pareto + KPI ให้อัตโนมัติ.
      </p>

      {/* Quality Loss Pareto */}
      <div className="mb-2 text-[12.5px] font-semibold text-[#3a4658]">1) Quality Loss Pareto (อธิบาย 25.3% ที่ไม่ผ่าน)</div>
      <div className="mb-4 flex flex-col gap-1.5">
        {q.map((r, i) => {
          const pctLoss = qTotal > 0 ? ((Number(r.qty) || 0) / qTotal) * 100 : 0;
          return (
            <div key={i} className="grid grid-cols-[1fr_70px_90px_1fr_24px] items-center gap-1.5">
              <input value={r.reason} placeholder="สาเหตุ" onChange={(e) => setQ(upd(q, i, { reason: e.target.value }))} className={inp} />
              <input value={r.qty} placeholder="qty" onChange={(e) => setQ(upd(q, i, { qty: e.target.value }))} className={`${inp} text-right`} />
              <span className="font-num text-right text-[11.5px] text-[#9aa4b4]">{pctLoss.toFixed(1)}%</span>
              <input value={r.impact} placeholder="ผลกระทบ" onChange={(e) => setQ(upd(q, i, { impact: e.target.value }))} className={inp} />
              <button onClick={() => setQ(q.filter((_, x) => x !== i))} className="text-[15px] text-[#c2606f]">×</button>
            </div>
          );
        })}
        <button onClick={() => setQ([...q, { reason: "", qty: "", impact: "" }])} className="mt-1 w-fit text-[12px] font-semibold text-[#2f86cf]">
          ＋ เพิ่มสาเหตุ
        </button>
      </div>

      {/* Loss Pareto */}
      <div className="mb-2 text-[12.5px] font-semibold text-[#3a4658]">2) Loss Pareto (แยก Project/Vendor/Operator + Owner + สถานะ)</div>
      <div className="mb-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.4fr_1.2fr_55px_70px_70px_1.1fr_1fr_24px] gap-1.5 pb-1 text-[10.5px] text-[#9aa4b4]">
            <span>Top loss</span><span>Category</span><span className="text-right">Freq</span><span className="text-right">Lost min</span><span className="text-right">OEE −%</span><span>Owner</span><span>Status</span><span></span>
          </div>
          <div className="flex flex-col gap-1.5">
            {l.map((r, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_1.2fr_55px_70px_70px_1.1fr_1fr_24px] items-center gap-1.5">
                <input value={r.loss} placeholder="สาเหตุ" onChange={(e) => setL(upd(l, i, { loss: e.target.value }))} className={inp} />
                <select value={r.category} onChange={(e) => setL(upd(l, i, { category: e.target.value }))} className={sel}>
                  {LOSS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={r.freq} onChange={(e) => setL(upd(l, i, { freq: e.target.value }))} className={`${inp} text-right`} />
                <input value={r.lostMin} onChange={(e) => setL(upd(l, i, { lostMin: e.target.value }))} className={`${inp} text-right`} />
                <input value={r.oeeImpact} onChange={(e) => setL(upd(l, i, { oeeImpact: e.target.value }))} className={`${inp} text-right`} />
                <input value={r.owner} placeholder="Owner/function" onChange={(e) => setL(upd(l, i, { owner: e.target.value }))} className={inp} />
                <select value={r.status} onChange={(e) => setL(upd(l, i, { status: e.target.value }))} className={sel}>
                  {LOSS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setL(l.filter((_, x) => x !== i))} className="text-[15px] text-[#c2606f]">×</button>
              </div>
            ))}
          </div>
          <button onClick={() => setL([...l, { loss: "", category: LOSS_CATEGORIES[0], freq: "", lostMin: "", oeeImpact: "", owner: "", status: "Open" }])} className="mt-1.5 w-fit text-[12px] font-semibold text-[#2f86cf]">
            ＋ เพิ่มรายการ loss
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-2 text-[12.5px] font-semibold text-[#3a4658]">3) Startup KPIs (นอกเหนือจาก OEE)</div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {OEE_KPIS.map((def) => (
          <label key={def.key} className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-[#3a4658]">
              {def.label} {def.unit && <span className="text-[#9aa4b4]">({def.unit})</span>}
            </span>
            <input value={k[def.key] ?? ""} onChange={(e) => setK({ ...k, [def.key]: e.target.value })} className={inp} />
            <span className="text-[10px] text-[#9aa4b4]">{def.help}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={save} disabled={busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Save analytics (บันทึก)"}
        </button>
      </div>
    </Card>
  );
}

function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((r, x) => (x === i ? { ...r, ...patch } : r));
}

"use client";

import { useState } from "react";
import { scoreProduction, pct, oeeColor } from "@/lib/calc/oee";
import { LOSS_CATEGORIES, QUALITY_LOSS_SEED } from "@/lib/settingsKeys";

export type ProdDowntime = { minutes: number; reason: string; category: string; owner: string };
export type ProdQualityLoss = { reason: string; qty: number };

const REASONS = ["เครื่องเสีย", "รอวัตถุดิบ", "เปลี่ยนรุ่น", "ทำความสะอาด", "รอบรรจุภัณฑ์", "อื่น ๆ"];
const QUALITY_REASONS = QUALITY_LOSS_SEED.map((r) => r.reason);

const inputCls =
  "rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2f86cf]";
const sm = "rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px] outline-none focus:border-[#2f86cf]";

/** OEE capture for a production (Pack Order) run — one place to record line/time,
 *  downtime (with responsible function), quality-loss breakdown and repack/scrap.
 *  Controlled: the parent owns the values so they flow into the receipt payload. */
export function OeeProdCapture({
  prodLines,
  standards,
  line,
  onLine,
  plannedMin,
  onPlannedMin,
  breakMin,
  onBreakMin,
  downtimes,
  onDowntimes,
  qualityLosses,
  onQualityLosses,
  repack,
  onRepack,
  scrap,
  onScrap,
  produced,
  loss,
}: {
  prodLines: string[];
  standards: Record<string, number>;
  line: string;
  onLine: (v: string) => void;
  plannedMin: string;
  onPlannedMin: (v: string) => void;
  breakMin: string;
  onBreakMin: (v: string) => void;
  downtimes: ProdDowntime[];
  onDowntimes: (rows: ProdDowntime[]) => void;
  qualityLosses: ProdQualityLoss[];
  onQualityLosses: (rows: ProdQualityLoss[]) => void;
  repack: string;
  onRepack: (v: string) => void;
  scrap: string;
  onScrap: (v: string) => void;
  produced: number;
  loss: number;
}) {
  const [dtMin, setDtMin] = useState("");
  const [dtReason, setDtReason] = useState(REASONS[0]);
  const [dtCat, setDtCat] = useState<string>(LOSS_CATEGORIES[0]);
  const [dtOwner, setDtOwner] = useState("");
  const [qReason, setQReason] = useState(QUALITY_REASONS[0]);
  const [qQty, setQQty] = useState("");

  const standard = line ? standards[line] ?? 0 : 0;
  const downtimeTotal = downtimes.reduce((s, d) => s + d.minutes, 0);
  const result = line
    ? scoreProduction({
        plannedMin: Number(plannedMin) || 0,
        downtimeMin: downtimeTotal,
        good: produced,
        reject: loss,
        standardPerHour: standard,
      })
    : null;

  function addDowntime() {
    const m = Math.round(Number(dtMin) || 0);
    if (m <= 0) return;
    onDowntimes([...downtimes, { minutes: m, reason: dtReason, category: dtCat, owner: dtOwner.trim() }]);
    setDtMin("");
    setDtOwner("");
  }
  function addQuality() {
    const q = Number(qQty) || 0;
    if (q <= 0) return;
    onQualityLosses([...qualityLosses, { reason: qReason, qty: q }]);
    setQQty("");
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#eef1f5] p-[16px_22px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#e9f6ee] text-[14px] text-[#1f9d63]">⚡</span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">OEE — บันทึกที่เดียวจบ (ไม่บังคับ)</div>
          <div className="text-[11.5px] text-[#69748a]">
            เวลา + downtime (ใคร/ฝ่ายไหน) + ของเสียแยกสาเหตุ + repack/scrap → หน้า OEE สรุป Pareto ให้เอง
          </div>
        </div>
        {prodLines.length > 0 ? (
          <select value={line} onChange={(e) => onLine(e.target.value)} className={`${inputCls} min-w-[200px]`}>
            <option value="">— ไม่บันทึก OEE —</option>
            {prodLines.map((l) => (
              <option key={l} value={l}>
                {l}
                {standards[l] ? ` · ${standards[l].toLocaleString()} kg/hr` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[11.5px] text-[#c8891a]">ยังไม่มีสายผลิต — เพิ่มที่ Settings ก่อน</span>
        )}
      </div>

      {line && (
        <>
          <div className="flex flex-wrap items-end gap-4 p-[16px_22px]">
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[#69748a]">เวลาวางแผนเดินเครื่อง (นาที)</span>
              <input value={plannedMin} onChange={(e) => onPlannedMin(e.target.value)} inputMode="numeric" placeholder="480" className={`font-num w-[110px] ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[#69748a]">เวลาพัก (นาที)</span>
              <input value={breakMin} onChange={(e) => onBreakMin(e.target.value)} inputMode="numeric" placeholder="60" className={`font-num w-[90px] ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[#69748a]">Repack (units)</span>
              <input value={repack} onChange={(e) => onRepack(e.target.value)} inputMode="numeric" placeholder="0" className={`font-num w-[90px] ${inputCls}`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[#69748a]">Scrap (units)</span>
              <input value={scrap} onChange={(e) => onScrap(e.target.value)} inputMode="numeric" placeholder="0" className={`font-num w-[90px] ${inputCls}`} />
            </label>
            <div className="rounded-[8px] border border-[#cfe4f6] bg-[#e8f2fb] px-2.5 py-1.5 text-[11.5px] text-[#69748a]">
              ผลิตได้ <b className="font-num text-[#0c7f93]">{produced.toLocaleString()}</b> · ของเสีย{" "}
              <b className="font-num text-[#c53f3f]">{loss.toLocaleString()}</b>
            </div>
            {standard <= 0 && <div className="text-[11px] text-[#c8891a]">* ยังไม่ตั้งมาตรฐาน {line} → Performance = 0%</div>}
          </div>

          {/* Downtime with responsible function */}
          <div className="border-t border-[#eef1f5] p-[14px_22px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-[#3a4658]">หยุดเครื่อง (Downtime) + ฝ่ายรับผิดชอบ</span>
              <span className="text-[11.5px] text-[#9aa4b4]">รวม <b className="font-num text-[#c8891a]">{downtimeTotal}</b> นาที</span>
            </div>
            {downtimes.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {downtimes.map((d, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-[8px] bg-[#faf6ee] px-3 py-1.5 text-[12px]">
                    <span className="rounded-[5px] bg-[#fbf1de] px-2 py-0.5 text-[11px] font-semibold text-[#c8891a]">{d.reason}</span>
                    <span className="rounded-[5px] bg-[#eef1f5] px-2 py-0.5 text-[10.5px] text-[#69748a]">{d.category}</span>
                    {d.owner && <span className="text-[11px] text-[#69748a]">· {d.owner}</span>}
                    <span className="font-num flex-1 text-right text-[#3a4658]">{d.minutes} นาที</span>
                    <button onClick={() => onDowntimes(downtimes.filter((_, idx) => idx !== i))} className="text-[15px] text-[#c2606f]">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select value={dtReason} onChange={(e) => setDtReason(e.target.value)} className={sm}>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={dtCat} onChange={(e) => setDtCat(e.target.value)} className={sm} title="ฝ่ายรับผิดชอบ">
                {LOSS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={dtOwner} onChange={(e) => setDtOwner(e.target.value)} placeholder="Owner (เช่น Vendor)" className={`w-[130px] ${sm}`} />
              <input value={dtMin} onChange={(e) => setDtMin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDowntime()} inputMode="numeric" placeholder="นาที" className={`font-num w-[80px] ${sm}`} />
              <button onClick={addDowntime} className="rounded-[8px] border border-dashed border-[#c8891a] px-3 py-1.5 text-[12.5px] font-semibold text-[#c8891a] hover:bg-[#fbf1de]">＋ เพิ่ม</button>
            </div>
          </div>

          {/* Quality loss breakdown */}
          <div className="border-t border-[#eef1f5] p-[14px_22px]">
            <div className="mb-2 text-[12.5px] font-semibold text-[#3a4658]">
              Quality loss แยกสาเหตุ (อธิบายของเสีย → Quality Pareto)
            </div>
            {qualityLosses.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {qualityLosses.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-[8px] bg-[#fbeeee] px-3 py-1.5 text-[12px]">
                    <span className="flex-1 text-[#3a4658]">{q.reason}</span>
                    <span className="font-num text-[#c53f3f]">{q.qty.toLocaleString()}</span>
                    <button onClick={() => onQualityLosses(qualityLosses.filter((_, idx) => idx !== i))} className="text-[15px] text-[#c2606f]">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select value={qReason} onChange={(e) => setQReason(e.target.value)} className={sm}>
                {QUALITY_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={qQty} onChange={(e) => setQQty(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuality()} inputMode="numeric" placeholder="จำนวน" className={`font-num w-[90px] ${sm}`} />
              <button onClick={addQuality} className="rounded-[8px] border border-dashed border-[#c53f3f] px-3 py-1.5 text-[12.5px] font-semibold text-[#c53f3f] hover:bg-[#fbeeee]">＋ เพิ่มสาเหตุ</button>
            </div>
          </div>

          {result && (
            <div className="grid grid-cols-4 gap-px border-t border-[#eef1f5] bg-[#eef1f5]">
              <Cell k="Availability" v={pct(result.availability)} color="#2f86cf" />
              <Cell k="Performance" v={pct(result.performance)} color="#c8891a" />
              <Cell k="Quality" v={pct(result.quality)} color="#1f9d63" />
              <Cell k="OEE" v={pct(result.oee)} color={oeeColor(pct(result.oee))} main />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Cell({ k, v, color, main }: { k: string; v: number; color: string; main?: boolean }) {
  return (
    <div className={`p-[12px_10px] text-center ${main ? "bg-[#f2fbf6]" : "bg-white"}`}>
      <div className="text-[10.5px] tracking-wide text-[#9aa4b4]">{k}</div>
      <div className="font-num text-[21px] font-extrabold" style={{ color }}>{v}%</div>
    </div>
  );
}

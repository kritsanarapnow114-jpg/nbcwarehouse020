"use client";

import { useState } from "react";
import { computeOee, pct, oeeColor } from "@/lib/calc/oee";
import type { OeeMachineRow } from "@/lib/views/oee";

export type DowntimeRow = { minutes: number; reason: string };

const REASONS = [
  "รอวัตถุดิบ",
  "เครื่องเสีย",
  "เปลี่ยนรุ่น",
  "ทำความสะอาด",
  "รอคิว SILO",
  "อื่น ๆ",
];

const inputCls =
  "rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2f86cf]";

/** Controlled OEE capture card embedded in the Receive form. The parent owns the
 *  values (so they flow into the receipt payload); this card renders the inputs,
 *  the downtime list, and a live OEE readout. */
export function OeeCapture({
  machines,
  machineId,
  onMachineId,
  plannedMin,
  onPlannedMin,
  breakMin,
  onBreakMin,
  reject,
  onReject,
  downtimes,
  onDowntimes,
  good,
}: {
  machines: OeeMachineRow[];
  machineId: string;
  onMachineId: (v: string) => void;
  plannedMin: string;
  onPlannedMin: (v: string) => void;
  breakMin: string;
  onBreakMin: (v: string) => void;
  reject: string;
  onReject: (v: string) => void;
  downtimes: DowntimeRow[];
  onDowntimes: (rows: DowntimeRow[]) => void;
  good: number;
}) {
  const [dtMin, setDtMin] = useState("");
  const [dtReason, setDtReason] = useState(REASONS[0]);

  const machine = machines.find((m) => m.id === machineId) ?? null;
  const isUnloading = machine?.operation === "UNLOADING";
  const downtimeTotal = downtimes.reduce((s, d) => s + d.minutes, 0);
  const rejectNum = isUnloading ? Number(reject) || 0 : 0;

  const result = machine
    ? computeOee({
        plannedMin: Number(plannedMin) || 0,
        downtimeMin: downtimeTotal,
        good,
        reject: rejectNum,
        standardRatePerHour: machine.standardRate,
      })
    : null;

  function addDowntime() {
    const m = Math.round(Number(dtMin) || 0);
    if (m <= 0) return;
    onDowntimes([...downtimes, { minutes: m, reason: dtReason }]);
    setDtMin("");
  }

  if (machines.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#eef1f5] p-[16px_22px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#e9f6ee] text-[14px] text-[#1f9d63]">
          ⚡
        </span>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">OEE — วัดประสิทธิผลเครื่อง (ไม่บังคับ)</div>
          <div className="text-[11.5px] text-[#69748a]">
            เลือกเครื่องเพื่อบันทึกเวลาเดินเครื่อง + downtime — ระบบคำนวณ OEE ให้
          </div>
        </div>
        <select
          value={machineId}
          onChange={(e) => onMachineId(e.target.value)}
          className={`${inputCls} min-w-[220px]`}
        >
          <option value="">— ไม่บันทึก OEE —</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.standardRate.toLocaleString()} {m.rateUnit}
            </option>
          ))}
        </select>
      </div>

      {machine && (
        <>
          <div className="flex flex-wrap items-end gap-4 p-[16px_22px]">
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[#69748a]">เวลาวางแผนเดินเครื่อง (นาที)</span>
              <input
                value={plannedMin}
                onChange={(e) => onPlannedMin(e.target.value)}
                inputMode="numeric"
                placeholder="480"
                className={`font-num w-[110px] ${inputCls}`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-[#69748a]">เวลาพัก (นาที)</span>
              <input
                value={breakMin}
                onChange={(e) => onBreakMin(e.target.value)}
                inputMode="numeric"
                placeholder="60"
                className={`font-num w-[90px] ${inputCls}`}
              />
            </label>
            {isUnloading && (
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-[#69748a]">ของเสีย/หก (สำหรับ Quality)</span>
                <input
                  value={reject}
                  onChange={(e) => onReject(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className={`font-num w-[110px] ${inputCls}`}
                />
              </label>
            )}
            <div className="rounded-[8px] border border-[#cfe4f6] bg-[#e8f2fb] px-2.5 py-1.5 text-[11.5px] text-[#69748a]">
              ผลผลิตที่นับ: <b className="font-num text-[#0c7f93]">{good.toLocaleString()}</b>{" "}
              {machine.rateUnit.replace("/hr", "")}
            </div>
          </div>

          {/* Downtime */}
          <div className="border-t border-[#eef1f5] p-[14px_22px]">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-[#3a4658]">
                หยุดเครื่อง (Downtime)
              </span>
              <span className="text-[11.5px] text-[#9aa4b4]">
                รวม <b className="font-num text-[#c8891a]">{downtimeTotal}</b> นาที
              </span>
            </div>
            {downtimes.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {downtimes.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-[8px] bg-[#faf6ee] px-3 py-1.5 text-[12.5px]"
                  >
                    <span className="rounded-[5px] bg-[#fbf1de] px-2 py-0.5 text-[11px] font-semibold text-[#c8891a]">
                      {d.reason}
                    </span>
                    <span className="font-num flex-1 text-[#3a4658]">{d.minutes} นาที</span>
                    <button
                      onClick={() => onDowntimes(downtimes.filter((_, idx) => idx !== i))}
                      className="text-[15px] text-[#c2606f]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={dtReason}
                onChange={(e) => setDtReason(e.target.value)}
                className={inputCls}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                value={dtMin}
                onChange={(e) => setDtMin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDowntime()}
                inputMode="numeric"
                placeholder="นาที"
                className={`font-num w-[90px] ${inputCls}`}
              />
              <button
                onClick={addDowntime}
                className="rounded-[8px] border border-dashed border-[#c8891a] px-3 py-1.5 text-[12.5px] font-semibold text-[#c8891a] hover:bg-[#fbf1de]"
              >
                ＋ เพิ่มการหยุด
              </button>
            </div>
          </div>

          {/* Live OEE */}
          {result && (
            <div className="grid grid-cols-4 gap-px border-t border-[#eef1f5] bg-[#eef1f5]">
              <OeeCell k="Availability" v={pct(result.availability)} color="#2f86cf" />
              <OeeCell k="Performance" v={pct(result.performance)} color="#c8891a" />
              <OeeCell k="Quality" v={pct(result.quality)} color="#1f9d63" />
              <OeeCell k="OEE" v={pct(result.oee)} color={oeeColor(pct(result.oee))} main />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OeeCell({
  k,
  v,
  color,
  main,
}: {
  k: string;
  v: number;
  color: string;
  main?: boolean;
}) {
  return (
    <div className={`p-[12px_10px] text-center ${main ? "bg-[#f2fbf6]" : "bg-white"}`}>
      <div className="text-[10.5px] tracking-wide text-[#9aa4b4]">{k}</div>
      <div className="font-num text-[21px] font-extrabold" style={{ color }}>
        {v}%
      </div>
    </div>
  );
}

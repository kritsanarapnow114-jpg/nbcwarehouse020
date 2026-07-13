"use client";

import { useState } from "react";
import { SLOT_BOXES, PLAN_IMG_W, PLAN_IMG_H } from "@/lib/storageLayout";
import type { RackInfo, StorageSummary } from "@/lib/views/storage";

// Occupancy tint painted over each rack slot on the real floor-plan image.
// Free slots glow green so open pallet positions are easy to spot.
function slotTint(info: RackInfo | undefined): { bg: string; border: string } {
  if (!info || info.lotCount === 0)
    return { bg: "rgba(46,167,117,.55)", border: "#1f8a56" }; // ว่าง / free
  if (info.hasExpired) return { bg: "rgba(210,65,65,.72)", border: "#a52d2d" };
  if (info.hasQc) return { bg: "rgba(229,154,43,.72)", border: "#b5790f" };
  return { bg: "rgba(90,110,140,.72)", border: "#3b4a61" }; // มีของ / occupied
}

export function StorageMap({
  racks,
  summary,
}: {
  racks: Record<string, RackInfo>;
  summary: StorageSummary;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const selInfo = selected ? racks[selected] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary tiles — free positions headline the view */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="พาเลทว่าง · Free" value={summary.free} tone="green" big />
        <Tile label="มีของ · Occupied" value={summary.occupied} tone="slate" />
        <Tile label="ทั้งหมด · Positions" value={summary.total} tone="plain" />
        <Tile label="ใช้พื้นที่ · Utilization" value={`${summary.utilPct}%`} tone="plain" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[11.5px]">
            <Legend color="#2ea775" label="ว่าง (free)" />
            <Legend color="#5a6e8c" label="มีของ (occupied)" />
            <Legend color="#e59a2b" label="ติด QC" />
            <Legend color="#d24141" label="มีของหมดอายุ" />
            <div className="flex-1" />
            <button
              onClick={() => setFreeOnly((v) => !v)}
              className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
                freeOnly
                  ? "border-[#1f8a56] bg-[#dff4e6] text-[#1f8a56]"
                  : "border-[#d7dce4] bg-white text-[#69748a] hover:border-[#2ea775]"
              }`}
            >
              {freeOnly ? "✓ เน้นเฉพาะที่ว่าง" : "เน้นเฉพาะที่ว่าง"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-[14px] border border-[#e7ebf1] bg-white p-2 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
            <div
              className="relative"
              style={{
                width: "100%",
                minWidth: 900,
                aspectRatio: `${PLAN_IMG_W} / ${PLAN_IMG_H}`,
                backgroundImage: "url(/warehouse-plan.png)",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {SLOT_BOXES.map((s) => {
                const info = racks[s.code];
                const isFree = !info || info.lotCount === 0;
                const tint = slotTint(info);
                const active = selected === s.code;
                const dim = freeOnly && !isFree;
                return (
                  <button
                    key={s.code}
                    onClick={() => setSelected(s.code)}
                    title={
                      info
                        ? `${s.code}: ${info.lotCount} lots · ${info.topProduct ?? ""}`
                        : `${s.code}: ว่าง (free)`
                    }
                    style={{
                      position: "absolute",
                      left: `${s.l}%`,
                      top: `${s.t}%`,
                      width: `${s.w}%`,
                      height: `${s.h}%`,
                      background: tint.bg,
                      border: `1px solid ${active ? "#16202e" : tint.border}`,
                      borderRadius: 1.5,
                      cursor: "pointer",
                      opacity: dim ? 0.12 : 1,
                      boxShadow: active ? "0 0 0 2px rgba(22,32,46,.35)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#9aa4b4]">
            ผังตามไฟล์ BIN_LOCATION จริง · สีทับบนแร็คบอกสถานะ — เขียว = ว่าง, เทา = มีของ
          </p>
        </div>

        {/* Contents panel */}
        <div className="w-full flex-none lg:w-[320px]">
          <div className="sticky top-[74px] rounded-[14px] border border-[#e7ebf1] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
            {!selected ? (
              <div className="py-8 text-center text-[12.5px] text-[#9aa4b4]">
                คลิกช่องแร็คบนแผนผังเพื่อดูว่ามีอะไรวางอยู่ หรือช่องไหนว่าง
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-num text-[15px] font-bold text-[#16202e]">{selected}</span>
                  {selInfo && selInfo.lotCount > 0 ? (
                    <span className="font-num text-[11.5px] text-[#69748a]">
                      {selInfo.lotCount} lots · {selInfo.totalQty.toLocaleString()} รวม
                    </span>
                  ) : (
                    <span className="rounded-[5px] bg-[#dff4e6] px-1.5 py-0.5 text-[11px] font-semibold text-[#1f8a56]">
                      ว่าง (free)
                    </span>
                  )}
                </div>
                {selInfo && selInfo.contents.length > 0 ? (
                  <div className="flex max-h-[460px] flex-col gap-2 overflow-auto">
                    {selInfo.contents.map((c, i) => (
                      <div key={i} className="rounded-[9px] border border-[#eef1f5] p-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-medium">{c.name}</span>
                          {c.status === "QC" && (
                            <span className="rounded-[4px] bg-[#fbf1df] px-1 text-[9.5px] font-semibold text-[#b5790f]">
                              QC
                            </span>
                          )}
                          {c.expired && (
                            <span className="rounded-[4px] bg-[#fbe9e9] px-1 text-[9.5px] font-semibold text-[#c53f3f]">
                              หมดอายุ
                            </span>
                          )}
                        </div>
                        <div className="font-num mt-0.5 text-[11px] text-[#9aa4b4]">
                          {c.productCode} · Lot {c.lotNo} · {c.locationCode}
                        </div>
                        <div className="font-num text-[12px] font-semibold text-[#0e8ba1]">
                          {c.qty.toLocaleString()} {c.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-[12px] text-[#1f8a56]">
                    ช่องนี้ว่าง — วางพาเลทได้
                    <div className="mt-1 text-[11px] text-[#9aa4b4]">
                      (ตั้งรหัสที่เก็บให้ขึ้นต้นด้วย {selected} เช่น {selected}-L1)
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: number | string;
  tone: "green" | "slate" | "plain";
  big?: boolean;
}) {
  const toneCls =
    tone === "green"
      ? "border-[#bfe6cd] bg-[#eef9f2] text-[#1f8a56]"
      : tone === "slate"
        ? "border-[#d5deea] bg-[#eef2f8] text-[#3b4a61]"
        : "border-[#e7ebf1] bg-white text-[#16202e]";
  return (
    <div className={`rounded-[12px] border px-3.5 py-3 ${toneCls}`}>
      <div className="text-[11px] font-medium opacity-80">{label}</div>
      <div className={`font-num font-bold leading-none ${big ? "mt-1.5 text-[26px]" : "mt-1 text-[20px]"}`}>
        {value}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[#69748a]">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}

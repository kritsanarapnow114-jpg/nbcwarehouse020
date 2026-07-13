"use client";

import { useState } from "react";
import { SLOT_BOXES, PLAN_IMG_W, PLAN_IMG_H } from "@/lib/storageLayout";
import { CONTAINER_TYPES, containerDef } from "@/lib/containerTypes";
import type { RackInfo, StorageSummary } from "@/lib/views/storage";

const FREE = { bg: "rgba(46,167,117,.32)", border: "#1f8a56" };

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Top-view tint: free slots glow green; occupied slots take their container's
// colour so you can read what kind of unit sits where.
function slotStyle(info: RackInfo | undefined): { bg: string; border: string } {
  if (!info || info.lotCount === 0) return FREE;
  const c = containerDef(info.containerType);
  const border = info.hasExpired ? "#d24141" : info.hasQc ? "#e59a2b" : c.color;
  return { bg: hexA(c.color, 0.55), border };
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const BASE_W = 960; // px width of the plan at zoom = 1

export function StorageMap({
  racks,
  summary,
}: {
  racks: Record<string, RackInfo>;
  summary: StorageSummary;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const selInfo = selected ? racks[selected] : null;

  const step = (d: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + d) * 2) / 2)));
  const showLabels = zoom >= 2;
  const planW = BASE_W * zoom;

  const typeCount = new Map(summary.byType.map((t) => [t.code, t.count]));

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
          {/* Container-type legend with per-type counts */}
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px]">
            <Legend color="#2ea775" label={`ว่าง (free) · ${summary.free}`} />
            {CONTAINER_TYPES.map((t) => (
              <Legend
                key={t.code}
                color={t.color}
                label={`${t.en}${typeCount.get(t.code) ? ` · ${typeCount.get(t.code)}` : ""}`}
              />
            ))}
            <span className="text-[#9aa4b4]">| ขอบแดง = หมดอายุ, ขอบส้ม = QC</span>
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

          {/* Zoom controls */}
          <div className="mb-2 flex items-center gap-2 text-[12px]">
            <span className="text-[#69748a]">ซูม:</span>
            <div className="flex items-center overflow-hidden rounded-[8px] border border-[#d7dce4]">
              <button
                onClick={() => step(-0.5)}
                disabled={zoom <= ZOOM_MIN}
                className="px-2.5 py-1 text-[15px] font-bold text-[#3b4a61] hover:bg-[#f1f4f8] disabled:opacity-40"
              >
                −
              </button>
              <span className="font-num min-w-[46px] border-x border-[#e7ebf1] px-2 py-1 text-center text-[12px] text-[#16202e]">
                {zoom.toFixed(1)}×
              </span>
              <button
                onClick={() => step(0.5)}
                disabled={zoom >= ZOOM_MAX}
                className="px-2.5 py-1 text-[15px] font-bold text-[#3b4a61] hover:bg-[#f1f4f8] disabled:opacity-40"
              >
                +
              </button>
            </div>
            <button
              onClick={() => setZoom(1)}
              className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1 text-[11.5px] text-[#69748a] hover:bg-[#f1f4f8]"
            >
              รีเซ็ต
            </button>
            <span className="text-[11px] text-[#9aa4b4]">กด + เพื่อซูมเข้าแล้วเลื่อนดูได้</span>
          </div>

          <div
            className="rounded-[14px] border border-[#e7ebf1] bg-white p-2 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]"
            style={{ overflow: "auto", maxHeight: "74vh" }}
          >
            <div
              className="relative"
              style={{
                width: planW,
                height: (planW * PLAN_IMG_H) / PLAN_IMG_W,
                backgroundImage: "url(/warehouse-plan.png)",
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
              }}
            >
              {SLOT_BOXES.map((s) => {
                const info = racks[s.code];
                const isFree = !info || info.lotCount === 0;
                const st = slotStyle(info);
                const active = selected === s.code;
                const dim = freeOnly && !isFree;
                const stack = info?.stackCount ?? 0;
                const cLabel = isFree ? "ว่าง (free)" : containerDef(info!.containerType).en;
                return (
                  <button
                    key={s.code}
                    onClick={() => setSelected(s.code)}
                    title={
                      info
                        ? `${s.code} · ${cLabel} · ซ้อน ${stack} · ${info.lotCount} lots`
                        : `${s.code}: ว่าง (free)`
                    }
                    style={{
                      position: "absolute",
                      left: `${s.l}%`,
                      top: `${s.t}%`,
                      width: `${s.w}%`,
                      height: `${s.h}%`,
                      background: st.bg,
                      border: `${info && (info.hasExpired || info.hasQc) ? 1.6 : 1}px solid ${active ? "#16202e" : st.border}`,
                      borderRadius: 1.5,
                      cursor: "pointer",
                      opacity: dim ? 0.1 : 1,
                      boxShadow: active ? "0 0 0 2px rgba(22,32,46,.4)" : undefined,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      padding: 0,
                    }}
                  >
                    {showLabels && (
                      <span
                        style={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: Math.min(11, 5 + zoom),
                          fontWeight: 700,
                          lineHeight: 1,
                          color: "#10202f",
                          textShadow: "0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff",
                          whiteSpace: "nowrap",
                          letterSpacing: "-0.3px",
                        }}
                      >
                        {s.code}
                        {stack >= 2 ? ` ×${stack}` : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#9aa4b4]">
            ผังตามไฟล์ BIN_LOCATION จริง · สีบอกชนิดภาชนะ · ×N = จำนวนพาเลทที่ซ้อน · ซูม 2× จะเห็นรหัสช่อง
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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-num text-[15px] font-bold text-[#16202e]">{selected}</span>
                  {selInfo && selInfo.lotCount > 0 ? (
                    <>
                      <span
                        className="rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: containerDef(selInfo.containerType).color }}
                      >
                        {containerDef(selInfo.containerType).en}
                      </span>
                      <span className="font-num text-[11.5px] text-[#69748a]">
                        ซ้อน {selInfo.stackCount} · {selInfo.lotCount} lots
                      </span>
                    </>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12.5px] font-medium">{c.name}</span>
                          <span
                            className="rounded-[4px] px-1 text-[9.5px] font-semibold text-white"
                            style={{ background: containerDef(c.containerType).color }}
                          >
                            {containerDef(c.containerType).en}
                          </span>
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
                          {c.productCode} · Lot {c.lotNo} · {c.locationCode} · {c.pallets} พาเลท
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

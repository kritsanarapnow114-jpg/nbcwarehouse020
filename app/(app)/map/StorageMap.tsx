"use client";

import { useState } from "react";
import { MAP_BLOCKS, GRID_W, GRID_H } from "@/lib/warehouseMap";
import type { RackInfo, StorageSummary } from "@/lib/views/storage";

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Occupancy-first palette: an empty pallet position should pop (green) so it is
// easy to spot where there is room; occupied positions sit back in a calm slate.
function rackStyle(info: RackInfo | undefined): { bg: string; border: string; text: string } {
  if (!info || info.lotCount === 0)
    return { bg: "#dff4e6", border: "#54b579", text: "#2c7a4b" }; // ว่าง / free — green
  if (info.hasExpired) return { bg: "#fbe4e4", border: "#d24141", text: "#8f2f2f" };
  if (info.hasQc) return { bg: "#fbf1df", border: "#e59a2b", text: "#8a5a12" };
  return { bg: "#dbe3ee", border: "#8a9cb4", text: "#3b4a61" }; // มีของ / occupied — slate
}

const ROOM_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  room: { bg: "#eef1f5", text: "#69748a", border: "#dfe3ea" },
  dock: { bg: "#e2ecf7", text: "#3b6291", border: "#c5d6ea" },
  fire: { bg: "#fdecec", text: "#c0453f", border: "#f3c9c9" },
  small: { bg: "#eceff3", text: "#9aa4b4", border: "#e0e4ea" },
};

export function StorageMap({
  racks,
  summary,
}: {
  racks: Record<string, RackInfo>;
  summary: StorageSummary;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const selInfo = selected ? racks[selected] : null;

  const rackBlocks = MAP_BLOCKS.filter((b) => b.k === "rack");

  // Derive the main walkways: horizontal lanes in the vertical gaps between
  // banks of racks (racks that share a top row form one bank).
  const bandMap = new Map<number, { top: number; bot: number; minC: number; maxC: number }>();
  for (const b of rackBlocks) {
    const g = bandMap.get(b.r) ?? { top: b.r, bot: b.r + b.rs, minC: b.c, maxC: b.c + b.cs };
    g.bot = Math.max(g.bot, b.r + b.rs);
    g.minC = Math.min(g.minC, b.c);
    g.maxC = Math.max(g.maxC, b.c + b.cs);
    bandMap.set(b.r, g);
  }
  const bands = [...bandMap.values()].sort((a, b) => a.top - b.top);
  const aisles: { c: number; r: number; cs: number; rs: number }[] = [];
  for (let i = 0; i < bands.length - 1; i++) {
    const g1 = bands[i];
    const g2 = bands[i + 1];
    const gap = g2.top - g1.bot;
    if (gap < 3) continue;
    const minC = Math.min(g1.minC, g2.minC);
    const maxC = Math.max(g1.maxC, g2.maxC);
    aisles.push({ c: minC, r: g1.bot, cs: maxC - minC, rs: gap });
  }

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
            <Legend color="#54b579" label="ว่าง (free)" />
            <Legend color="#8a9cb4" label="มีของ (occupied)" />
            <Legend color="#e59a2b" label="ติด QC" />
            <Legend color="#d24141" label="มีของหมดอายุ" />
            <Legend color="#8fcf9f" label="ประตู (door)" />
            <div className="flex-1" />
            <button
              onClick={() => setFreeOnly((v) => !v)}
              className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
                freeOnly
                  ? "border-[#2c7a4b] bg-[#dff4e6] text-[#2c7a4b]"
                  : "border-[#d7dce4] bg-white text-[#69748a] hover:border-[#54b579]"
              }`}
            >
              {freeOnly ? "✓ เน้นเฉพาะที่ว่าง" : "เน้นเฉพาะที่ว่าง"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-[14px] border border-[#e7ebf1] bg-white p-3 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
            <div
              className="relative"
              style={{ width: 1600, aspectRatio: `${GRID_W} / ${GRID_H}`, background: "#f6f8fa" }}
            >
              {/* Walkways (aisles) — light lanes with a dashed centre line */}
              {aisles.map((a, i) => (
                <div
                  key={`aisle${i}`}
                  style={{
                    position: "absolute",
                    left: pct(a.c, GRID_W),
                    top: pct(a.r, GRID_H),
                    width: pct(a.cs, GRID_W),
                    height: pct(a.rs, GRID_H),
                    background: "#f7f4e3",
                    borderTop: "2px solid #f2c200",
                    borderBottom: "2px solid #f2c200",
                  }}
                  className="flex items-center justify-center"
                >
                  <div className="h-0 w-[94%] border-t-2 border-dashed border-[#2aa775]" />
                </div>
              ))}

              {MAP_BLOCKS.map((b, i) => {
                const pos: React.CSSProperties = {
                  position: "absolute",
                  left: pct(b.c, GRID_W),
                  top: pct(b.r, GRID_H),
                  width: pct(b.cs, GRID_W),
                  height: pct(b.rs, GRID_H),
                };
                if (b.k === "door") {
                  return (
                    <div
                      key={i}
                      title="ประตู / ทางเข้า-ออก (door)"
                      style={{ ...pos, background: "#8fcf9f", borderRadius: 1, opacity: 0.85 }}
                    />
                  );
                }
                if (b.k === "rack") {
                  const info = racks[norm(b.t)];
                  const isFree = !info || info.lotCount === 0;
                  const st = rackStyle(info);
                  const active = selected === norm(b.t);
                  const dim = freeOnly && !isFree;
                  const tall = b.rs > b.cs * 1.3; // narrow-tall rack → vertical label
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(norm(b.t))}
                      title={
                        info
                          ? `${b.t}: ${info.lotCount} lots · ${info.topProduct ?? ""}`
                          : `${b.t}: ว่าง (free)`
                      }
                      style={{
                        ...pos,
                        background: st.bg,
                        border: `1px solid ${active ? "#16202e" : st.border}`,
                        color: st.text,
                        borderRadius: 2,
                        overflow: "hidden",
                        cursor: "pointer",
                        opacity: dim ? 0.28 : 1,
                      }}
                      className="flex items-center justify-center"
                    >
                      <span
                        className="font-num font-bold"
                        style={{
                          fontSize: 8,
                          lineHeight: 1,
                          writingMode: tall ? "vertical-rl" : "horizontal-tb",
                          transform: tall ? "rotate(180deg)" : undefined,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.t}
                      </span>
                    </button>
                  );
                }
                const st = ROOM_STYLE[b.k] ?? ROOM_STYLE.room;
                return (
                  <div
                    key={i}
                    style={{
                      ...pos,
                      background: st.bg,
                      border: `1px solid ${st.border}`,
                      color: st.text,
                      borderRadius: 2,
                    }}
                    className="flex items-center justify-center overflow-hidden px-1 text-center text-[8px] font-medium leading-tight"
                  >
                    {b.t}
                  </div>
                );
              })}
            </div>
          </div>
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
                    <span className="rounded-[5px] bg-[#dff4e6] px-1.5 py-0.5 text-[11px] font-semibold text-[#2c7a4b]">
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
                  <div className="py-6 text-center text-[12px] text-[#2c7a4b]">
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
      ? "border-[#bfe6cd] bg-[#eef9f2] text-[#2c7a4b]"
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

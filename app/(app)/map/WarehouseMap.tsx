"use client";

import { useState } from "react";
import { MAP_BLOCKS, GRID_W, GRID_H } from "@/lib/warehouseMap";
import type { RackInfo } from "@/lib/views/map";

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function rackStyle(info: RackInfo | undefined): { bg: string; border: string; text: string } {
  if (!info || info.lotCount === 0)
    return { bg: "#f1f3f7", border: "#d7dce4", text: "#9aa4b4" };
  if (info.hasExpired) return { bg: "#fbe4e4", border: "#d24141", text: "#8f2f2f" };
  if (info.hasQc) return { bg: "#fbf1df", border: "#e59a2b", text: "#8a5a12" };
  return { bg: "#d4eef4", border: "#12a2bb", text: "#0b6072" };
}

const ROOM_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  room: { bg: "#eef1f5", text: "#69748a", border: "#dfe3ea" },
  dock: { bg: "#e2ecf7", text: "#3b6291", border: "#c5d6ea" },
  fire: { bg: "#fdecec", text: "#c0453f", border: "#f3c9c9" },
  small: { bg: "#eceff3", text: "#9aa4b4", border: "#e0e4ea" },
};

export function WarehouseMap({ racks }: { racks: Record<string, RackInfo> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const selInfo = selected ? racks[selected] : null;

  const rackBlocks = MAP_BLOCKS.filter((b) => b.k === "rack");
  const occupied = rackBlocks.filter((b) => (racks[norm(b.t)]?.lotCount ?? 0) > 0).length;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11.5px]">
          <Legend color="#12a2bb" label="มีของ (occupied)" />
          <Legend color="#e59a2b" label="ติด QC" />
          <Legend color="#d24141" label="มีของหมดอายุ" />
          <Legend color="#d7dce4" label="ว่าง (empty)" />
          <div className="flex-1" />
          <span className="text-[#69748a]">
            Rack ใช้งาน <b className="font-num text-[#16202e]">{occupied}</b>/{rackBlocks.length}
          </span>
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-[#e7ebf1] bg-white p-3 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
          <div
            className="relative"
            style={{ width: 1460, aspectRatio: `${GRID_W} / ${GRID_H}` }}
          >
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
                  <div key={i} style={{ ...pos, background: "#8b96a6", borderRadius: 1, opacity: 0.55 }} />
                );
              }
              if (b.k === "rack") {
                const info = racks[norm(b.t)];
                const st = rackStyle(info);
                const active = selected === norm(b.t);
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(norm(b.t))}
                    title={info ? `${b.t}: ${info.lotCount} lots · ${info.topProduct ?? ""}` : `${b.t}: ว่าง`}
                    style={{
                      ...pos,
                      background: st.bg,
                      border: `1.5px solid ${active ? "#16202e" : st.border}`,
                      color: st.text,
                      borderRadius: 3,
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                    className="flex flex-col items-center justify-center px-0.5 text-center leading-none"
                  >
                    <span className="font-num text-[8.5px] font-bold">{b.t}</span>
                    {info?.topProduct && (
                      <span className="font-num mt-[1px] text-[7px] opacity-80">{info.topProduct}</span>
                    )}
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
              คลิก Rack บนแผนผังเพื่อดูว่ามีอะไรวางอยู่
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
                  <span className="text-[11.5px] text-[#9aa4b4]">ว่าง (empty)</span>
                )}
              </div>
              {selInfo && selInfo.contents.length > 0 ? (
                <div className="flex max-h-[460px] flex-col gap-2 overflow-auto">
                  {selInfo.contents.map((c, i) => (
                    <div key={i} className="rounded-[9px] border border-[#eef1f5] p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[12.5px]">{c.name}</span>
                        {c.status === "QC" && (
                          <span className="rounded-[4px] bg-[#fbf1df] px-1 text-[9.5px] font-semibold text-[#b5790f]">QC</span>
                        )}
                        {c.expired && (
                          <span className="rounded-[4px] bg-[#fbe9e9] px-1 text-[9.5px] font-semibold text-[#c53f3f]">หมดอายุ</span>
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
                <div className="py-6 text-center text-[12px] text-[#9aa4b4]">
                  ยังไม่มีของในแร็คนี้
                  <div className="mt-1 text-[11px]">
                    (ตั้งรหัสที่เก็บให้ขึ้นต้นด้วย {selected} เช่น {selected}-L1)
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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

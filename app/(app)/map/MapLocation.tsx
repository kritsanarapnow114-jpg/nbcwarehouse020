"use client";

import { useMemo, useState } from "react";
import { containerDef } from "@/lib/containerTypes";
import type { RackZone, FloorZone, MapSummary, MapCell } from "@/lib/views/mapLocation";

type StatusKey = "free" | "partial" | "full";

const STATUS: Record<StatusKey, { label: string; color: string; bg: string; border: string }> = {
  free: { label: "ว่าง", color: "#1f9d63", bg: "#eaf7f0", border: "#bfe6cf" },
  partial: { label: "มีบางส่วน", color: "#c8781f", bg: "#fdf5ea", border: "#f4dcbb" },
  full: { label: "เต็ม", color: "#c0453f", bg: "#fdecec", border: "#f5cbc9" },
};
const ACCENT = "#4f5bd5";

function pct(used: number, cap: number) {
  return cap > 0 ? Math.round((used / cap) * 100) : 0;
}

export function MapLocation({
  racks,
  floors,
  summary,
  zones,
}: {
  racks: RackZone[];
  floors: FloorZone[];
  summary: MapSummary;
  zones: string[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | StatusKey>("all");
  const [zone, setZone] = useState<string>("all");
  const [selId, setSelId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const matchCell = useMemo(() => {
    return (c: MapCell) => {
      if (status !== "all" && c.status !== status) return false;
      if (zone !== "all" && c.zone !== zone) return false;
      if (q) {
        const hit =
          c.code.toLowerCase().includes(q) ||
          c.lots.some(
            (l) =>
              l.name.toLowerCase().includes(q) ||
              l.productCode.toLowerCase().includes(q) ||
              l.lotNo.toLowerCase().includes(q)
          );
        if (!hit) return false;
      }
      return true;
    };
  }, [q, status, zone]);

  // find selected cell across all zones
  const selCell = useMemo(() => {
    for (const r of racks) for (const b of r.bays) for (const c of b.levels) if (c.id === selId) return c;
    for (const f of floors) for (const c of f.tiles) if (c.id === selId) return c;
    return null;
  }, [selId, racks, floors]);

  const visRacks = racks
    .filter((r) => zone === "all" || r.zone === zone)
    .map((r) => ({
      ...r,
      bays: r.bays
        .map((b) => ({ ...b, levels: b.levels.filter(matchCell) }))
        .filter((b) => b.levels.length > 0),
    }))
    .filter((r) => r.bays.length > 0);
  const visFloors = floors
    .filter((f) => zone === "all" || f.zone === zone)
    .map((f) => ({ ...f, tiles: f.tiles.filter(matchCell) }))
    .filter((f) => f.tiles.length > 0);
  const noResults = visRacks.length === 0 && visFloors.length === 0;

  return (
    <div className="min-h-full bg-[#f4f6fb] text-[#1e2433]">
      {/* Sticky in-page header */}
      <div className="sticky top-0 z-20 flex flex-col gap-3.5 border-b border-[#e6e9f2] bg-white px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[16px] font-bold leading-none">คลังสินค้า · Map Location</div>
            <div className="mt-1 text-[11.5px] text-[#8a92a8]">เห็นของ · Lot · ขนาดพาเลท · ว่างตรงไหน</div>
          </div>
          <div className="relative ml-auto min-w-[200px] max-w-[420px] flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา สินค้า / Lot / ช่อง (เช่น PACA01, A37)"
              className="w-full rounded-[10px] border-[1.5px] border-[#e0e4f0] bg-[#f8f9fd] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#4f5bd5]"
            />
          </div>
        </div>

        {/* Stat cards */}
        <div className="flex flex-wrap items-stretch gap-2.5">
          <div className="min-w-[160px] flex-1 rounded-[12px] border border-[#eceff7] bg-[#f8f9fd] px-4 py-2.5">
            <div className="text-[11.5px] font-medium text-[#8a92a8]">การใช้งานคลังรวม (ตร.ม.)</div>
            <div className="my-0.5 flex items-baseline gap-1.5">
              <span className="font-num text-[22px] font-bold">{summary.utilPct}%</span>
              <span className="font-num text-[11.5px] text-[#8a92a8]">
                {summary.areaUsed.toLocaleString()} / {summary.areaCap.toLocaleString()} ตร.ม. · {summary.pallets.toLocaleString()} พาเลท
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-[20px] bg-[#e6e9f2]">
              <div className="h-full rounded-[20px]" style={{ width: `${summary.utilPct}%`, background: ACCENT }} />
            </div>
          </div>
          <StatCard dot={STATUS.free.color} label="ว่างทั้งช่อง" value={summary.free} />
          <StatCard dot={STATUS.partial.color} label="มีบางส่วน" value={summary.partial} />
          <StatCard dot={STATUS.full.color} label="เต็ม" value={summary.full} />
          <StatCard dot={ACCENT} label="ช่องทั้งหมด" value={summary.positions} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11.5px] font-semibold text-[#8a92a8]">สถานะ</span>
            <Chip active={status === "all"} onClick={() => setStatus("all")} label="ทั้งหมด" />
            <Chip active={status === "free"} onClick={() => setStatus("free")} label="ว่าง" tone={STATUS.free.color} />
            <Chip active={status === "partial"} onClick={() => setStatus("partial")} label="มีบางส่วน" tone={STATUS.partial.color} />
            <Chip active={status === "full"} onClick={() => setStatus("full")} label="เต็ม" tone={STATUS.full.color} />
          </div>
          <div className="h-[22px] w-px bg-[#e6e9f2]" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11.5px] font-semibold text-[#8a92a8]">โซน</span>
            <Chip active={zone === "all"} onClick={() => setZone("all")} label="ทั้งหมด" />
            {zones.map((z) => (
              <Chip key={z} active={zone === z} onClick={() => setZone(z)} label={z} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 pb-16 pt-5">
        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          <span className="font-semibold text-[#8a92a8]">
            Rack = มองด้านหน้า ชั้น L3(บน)→L1(ล่าง) · พื้น = วางซ้อนบล็อก · แต่ละจุด = 1 พาเลท
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-3.5">
            {(["free", "partial", "full"] as StatusKey[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[11.5px] text-[#5a6076]">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STATUS[k].color }} />
                {STATUS[k].label}
              </span>
            ))}
          </div>
        </div>

        {/* RACK ZONES */}
        {visRacks.map((r) => (
          <section key={r.zone} className="rounded-[16px] border border-[#eceff7] bg-white p-[18px_20px] shadow-[0_1px_3px_rgba(30,36,51,.04)]">
            <ZoneHeader tag={r.zone} title={`Rack ${r.zone}`} sub={`${r.bays.length} ช่อง (bay) · 3 ชั้น`} used={r.used} cap={r.cap} />
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start gap-2">
                <div className="flex flex-none flex-col gap-1.5">
                  {["L3", "L2", "L1"].map((lv) => (
                    <div key={lv} className="flex h-[56px] items-center text-[10.5px] font-semibold text-[#a2a9bd]">
                      {lv}
                    </div>
                  ))}
                  <div className="h-[22px]" />
                </div>
                {r.bays.map((bay) => (
                  <div key={bay.bayCode} className="flex flex-none flex-col gap-1.5">
                    {bay.levels.map((c) => (
                      <RackCell key={c.id} cell={c} onClick={() => setSelId(c.id)} />
                    ))}
                    <div className="flex h-[22px] items-center justify-center text-[10px] font-bold text-[#5a6076]">
                      {bay.bayCode}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* FLOOR ZONES */}
        {visFloors.map((f) => (
          <section key={f.zone} className="rounded-[16px] border border-[#eceff7] bg-white p-[18px_20px] shadow-[0_1px_3px_rgba(30,36,51,.04)]">
            <ZoneHeader tag={f.zone} title={`พื้นวางซ้อน · โซน ${f.zone}`} sub={`${f.tiles.length} บล็อก`} used={f.used} cap={f.cap} />
            <div className="mb-2 text-[10.5px] text-[#aeb4c6]">
              แต่ละแท่ง = 1 แถว · แถว = จุดวางบนพื้น · คอลัมน์ = ชั้นซ้อน (1→บนสุด) · สียิ่งเข้ม = ชั้นสูงขึ้น
            </div>
            <div
              className="grid items-start gap-2 overflow-x-auto pb-1"
              style={{ gridTemplateColumns: "repeat(30, minmax(34px, 1fr))" }}
            >
              {f.tiles.map((c) => (
                <FloorTile key={c.id} cell={c} onClick={() => setSelId(c.id)} />
              ))}
            </div>
          </section>
        ))}

        {noResults && (
          <div className="py-[50px] text-center text-[#9aa2b8]">
            <div className="mb-1 text-[15px] font-semibold">ไม่พบช่องที่ตรงกับเงื่อนไข</div>
            <div className="text-[13px]">ลองล้างตัวกรองหรือคำค้นหา</div>
          </div>
        )}
      </div>

      {selCell && <Drawer cell={selCell} onClose={() => setSelId(null)} />}
    </div>
  );
}

function StatCard({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="min-w-[128px] flex-1 rounded-[12px] border border-[#eceff7] bg-[#f8f9fd] px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        <span className="text-[12px] font-medium text-[#5a6076]">{label}</span>
      </div>
      <div className="font-num mt-0.5 text-[22px] font-bold">{value}</div>
    </div>
  );
}

function Chip({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[12.5px] font-semibold transition"
      style={{
        borderColor: active ? ACCENT : "#e4e7f1",
        background: active ? "#eef0fb" : "#fff",
        color: active ? ACCENT : "#5a6076",
      }}
    >
      {tone && <span className="h-2 w-2 rounded-full" style={{ background: tone }} />}
      {label}
    </button>
  );
}

function ZoneHeader({ tag, title, sub, used, cap }: { tag: string; title: string; sub: string; used: number; cap: number }) {
  const p = pct(used, cap);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-[46px] items-center justify-center rounded-[11px] bg-[#eef0fb] text-[13px] font-bold text-[#4f5bd5]">
          {tag}
        </div>
        <div>
          <div className="text-[15px] font-bold">{title}</div>
          <div className="text-[11.5px] text-[#8a92a8]">{sub}</div>
        </div>
      </div>
      <div className="ml-auto flex min-w-[180px] items-center gap-2">
        <div className="h-[7px] flex-1 overflow-hidden rounded-[20px] bg-[#eef0f5]">
          <div className="h-full rounded-[20px]" style={{ width: `${p}%`, background: p >= 100 ? STATUS.full.color : ACCENT }} />
        </div>
        <span className="font-num whitespace-nowrap text-[12px] font-semibold text-[#5a6076]">
          {used}/{cap} · {p}%
        </span>
      </div>
    </div>
  );
}

function Dots({ used, cap, color }: { used: number; cap: number; color: string }) {
  const max = Math.min(cap, 24);
  return (
    <div className="my-0.5 flex max-w-[54px] flex-wrap justify-center gap-[2.5px]">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{ background: i < used ? color : "#dfe3ef" }}
        />
      ))}
    </div>
  );
}

function RackCell({ cell, onClick }: { cell: MapCell; onClick: () => void }) {
  const s = STATUS[cell.status];
  return (
    <button
      onClick={onClick}
      title={`${cell.code} · ${cell.pallets}/${cell.capacity} พาเลท`}
      className="flex h-[56px] w-[62px] flex-col items-center justify-center rounded-[9px] border transition hover:brightness-95"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="rounded-[4px] px-1 text-[8.5px] font-bold" style={{ background: s.color, color: "#fff" }}>
        L{cell.level}
      </span>
      <Dots used={cell.pallets} cap={cell.capacity} color={s.color} />
      <span className="font-num text-[9px] font-bold" style={{ color: s.color }}>
        {cell.pallets}/{cell.capacity}
      </span>
    </button>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
// Darker shade for higher stack levels so each level reads differently.
const LEVEL_ALPHA = [0.5, 0.72, 0.9, 1, 1];

function FloorTile({ cell, onClick }: { cell: MapCell; onClick: () => void }) {
  const s = STATUS[cell.status];
  const c = containerDef(cell.containerType);
  // Grid = ground positions used (rows) × stack levels (cols). Pallets fill the
  // bottom level across the spots first, then stack up — so the filled columns
  // to the right mean pallets are stacked higher there.
  const S = Math.max(1, Math.min(cell.stack, 5));
  const groundUsed = cell.pallets > 0 ? Math.ceil(cell.pallets / S) : 0;
  const G = cell.pallets > 0 ? Math.min(groundUsed, 22) : 5; // empty → placeholder rows
  return (
    <button
      onClick={onClick}
      title={`${cell.code} · ${cell.pallets}/${cell.capacity} พาเลท · ซ้อนได้ ${cell.stack} ชั้น · ${cell.pallets > 0 ? c.en : "ว่าง"}`}
      className="flex w-full min-w-0 flex-col items-center gap-1 overflow-hidden rounded-[10px] border p-1.5 pt-2 transition hover:brightness-[.98]"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="font-num whitespace-nowrap text-[11px] font-bold leading-none" style={{ color: s.color }}>
        {cell.code}
      </span>
      <span
        className="max-w-full whitespace-nowrap rounded-[4px] px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white"
        style={{ background: cell.pallets > 0 ? c.color : "#aeb4c6" }}
        title={cell.pallets > 0 ? c.en : "ว่าง"}
      >
        {cell.pallets > 0 ? c.abbr : "ว่าง"}
      </span>
      {S > 1 && (
        <div className="flex gap-[3px] text-[7px] font-bold leading-none text-[#9aa2b8]">
          {Array.from({ length: S }).map((_, c2) => (
            <span key={c2} className="w-[8px] text-center">
              {c2 + 1}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-[3px] py-0.5">
        {Array.from({ length: G }).map((_, r) => (
          <div key={r} className="flex gap-[3px]">
            {Array.from({ length: cell.pallets > 0 ? S : 1 }).map((_, col) => {
              // level-major fill across the occupied ground spots
              const filled = cell.pallets > 0 && col * groundUsed + r < cell.pallets;
              return (
                <span
                  key={col}
                  className="h-[6px] w-[8px] rounded-[2px]"
                  style={{ background: filled ? hexA(s.color, LEVEL_ALPHA[col] ?? 1) : "#e0e4ee" }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <span className="font-num text-[9.5px] font-bold leading-none" style={{ color: s.color }}>
        {cell.pallets}/{cell.capacity}
      </span>
      {cell.stack > 1 && (
        <span className="rounded-[4px] bg-white/70 px-1 text-[8px] font-bold text-[#5a6076]">
          ซ้อน {cell.stack} ชั้น
        </span>
      )}
    </button>
  );
}

function StackMap({ cell, color }: { cell: MapCell; color: string }) {
  const S = Math.max(1, cell.stack);
  const P = cell.pallets;
  // ground positions the stored pallets sit on; each can stack up to S high
  const groundSpots = Math.max(1, Math.ceil(P / S));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] font-bold text-[#8a92a8]">
          ผังการวางซ้อน {S > 1 ? `(ซ้อนได้ ${S} ชั้น)` : "(แต่ละจุด = 1 พาเลท)"}
        </span>
        <span className="font-num text-[11px] text-[#aeb4c6]">แต่ละจุด = 1 พาเลท</span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[12px] border border-[#eef0f7] bg-[#fbfcfe] p-3">
        {S > 1 ? (
          Array.from({ length: S }).map((_, idx) => {
            const layer = S - idx; // render top layer first
            const filled = Math.min(groundSpots, Math.max(0, P - (layer - 1) * groundSpots));
            return (
              <div key={layer} className="flex items-center gap-2.5">
                <span className="w-[42px] flex-none text-[11px] font-bold text-[#5a6076]">ชั้น {layer}</span>
                <div className="flex flex-wrap gap-[4px]">
                  {Array.from({ length: groundSpots }).map((_, j) => (
                    <span
                      key={j}
                      className="h-[14px] w-[16px] rounded-[3px]"
                      style={{ background: j < filled ? color : "#e6e9f2" }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-wrap gap-[5px]">
            {Array.from({ length: Math.min(cell.capacity, 60) }).map((_, i) => (
              <span key={i} className="h-[14px] w-[14px] rounded-[3px]" style={{ background: i < P ? color : "#e6e9f2" }} />
            ))}
          </div>
        )}
      </div>
      {S > 1 && (
        <div className="font-num mt-1.5 text-[11.5px] text-[#8a92a8]">
          วาง {P} พาเลท บน {groundSpots} จุด · ซ้อนสูงสุด {S} ชั้น
        </div>
      )}
    </div>
  );
}

function Drawer({ cell, onClose }: { cell: MapCell; onClose: () => void }) {
  const s = STATUS[cell.status];
  const p = pct(cell.areaUsed, cell.areaCap);
  return (
    <div>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-[rgba(20,25,40,.28)]" />
      <aside className="fixed bottom-0 right-0 top-0 z-[41] flex w-[414px] max-w-[94vw] flex-col bg-white shadow-[-8px_0_30px_rgba(20,25,40,.14)]">
        <div className="flex items-start gap-3 border-b border-[#eceff7] px-[22px] py-[18px]">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-num text-[22px] font-bold tracking-[.3px]">{cell.code}</span>
              <span
                className="rounded-[6px] px-2 py-0.5 text-[11px] font-bold"
                style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
              >
                {s.label}
              </span>
            </div>
            <div className="mt-1 text-[12.5px] text-[#8a92a8]">
              โซน {cell.zone} · {cell.kind === "rack" ? `Rack ชั้น L${cell.level}` : "พื้นวางซ้อน"} · {cell.width}×{cell.length} ม.
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto h-[30px] w-[30px] rounded-[8px] bg-[#f2f4fa] text-[16px] text-[#6a7189] hover:bg-[#e6e9f2]"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto px-[22px] py-4">
          {/* capacity */}
          <div className="rounded-[14px] border border-[#eef0f7] bg-[#f8f9fd] px-[15px] py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#8a92a8]">ความจุ (คิดจากพื้นที่)</span>
              <span className="font-num text-[12px] font-semibold text-[#5a6076]">
                ว่างอีก {Math.max(0, Math.round((cell.areaCap - cell.areaUsed) * 10) / 10)} ตร.ม.
              </span>
            </div>
            <div className="mb-2 h-[8px] overflow-hidden rounded-[20px] bg-[#e6e9f2]">
              <div className="h-full rounded-[20px]" style={{ width: `${p}%`, background: p >= 100 ? STATUS.full.color : ACCENT }} />
            </div>
            <div className="text-[13px] text-[#5a6076]">
              <b className="font-num text-[18px] text-[#1e2433]">{cell.areaUsed}</b> / {cell.areaCap} ตร.ม. ({p}%)
            </div>
            <div className="font-num mt-1 text-[12px] text-[#8a92a8]">
              วางแล้ว {cell.pallets} พาเลท · ยังใส่ได้อีก ~{Math.max(0, cell.capacity - cell.pallets)} พาเลท (ตามขนาดที่วางอยู่)
            </div>
          </div>

          {/* position map — shows stacking layers (ซ้อน 1-2-3) */}
          <StackMap cell={cell} color={s.color} />

          {/* lots */}
          <div>
            <div className="mb-2 text-[12px] font-bold text-[#8a92a8]">ลอตที่จัดเก็บ ({cell.lots.length})</div>
            {cell.lots.length === 0 ? (
              <div className="rounded-[12px] border-[1.5px] border-dashed border-[#dfe3ef] p-4 text-center text-[13px] text-[#9aa2b8]">
                ช่องนี้ว่าง — รับเข้า/ย้ายของมาที่ช่องนี้ได้ที่หน้า Receive / Transfer
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {cell.lots.map((lot, i) => {
                  const c = containerDef(lot.containerType);
                  return (
                    <div key={i} className="rounded-[12px] border border-[#eceff7] p-[11px_13px]">
                      <div className="flex items-start gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold">{lot.name}</div>
                          <div className="font-num text-[11.5px] text-[#8a92a8]">{lot.productCode}</div>
                        </div>
                        <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-semibold text-white" style={{ background: c.color }}>
                          {c.en}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12px] text-[#5a6076]">
                        <span>
                          Lot: <b className="font-num">{lot.lotNo}</b>
                        </span>
                        <span className="font-num">{lot.pallets} พาเลท</span>
                        <span className="font-num">
                          {lot.qty.toLocaleString()} {lot.unit}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-[#8a92a8]">
                        <span>เข้า {lot.inDate}</span>
                        {lot.expDate && (
                          <span style={{ color: lot.expired ? "#c0453f" : undefined }}>หมดอายุ {lot.expDate}</span>
                        )}
                        {lot.status === "QC" && <span className="font-semibold text-[#b5790f]">ติด QC</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

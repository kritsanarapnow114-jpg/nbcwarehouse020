"use client";

import { useRef, useState } from "react";
import { oeeColor } from "@/lib/calc/oee";

// Smooth path through points (Catmull-Rom → cubic bezier), same feel as the
// dashboard's Stock Movement chart.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

const W = 720, H = 240, PADL = 14, PADR = 14, PADT = 16, PADB = 28;

const wd = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return wd[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

/** Packing-line OEE trend — a smooth filled area line (dashboard vibe) with a
 *  dashed target line. Null days (no production) leave a gap. */
export function PackingTrendChart({
  days,
  oee,
  goal = 85,
}: {
  days: string[];
  oee: (number | null)[];
  goal?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = days.length;
  const baseY = H - PADB;
  const plotH = baseY - PADT;
  const plotW = W - PADL - PADR;
  const xAt = (i: number) => (n > 1 ? PADL + (i / (n - 1)) * plotW : PADL + plotW / 2);
  const yAt = (v: number) => baseY - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  // Points that actually have a value (null days are skipped → gaps).
  const valued = oee
    .map((v, i) => (v == null ? null : { i, v, x: xAt(i), y: yAt(v) }))
    .filter((p): p is { i: number; v: number; x: number; y: number } => p !== null);

  // Split into runs of consecutive days so the line breaks over gaps.
  const segments: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  let prevI = -99;
  for (const p of valued) {
    if (p.i === prevI + 1) run.push({ x: p.x, y: p.y });
    else { if (run.length) segments.push(run); run = [{ x: p.x, y: p.y }]; }
    prevI = p.i;
  }
  if (run.length) segments.push(run);

  const grid = [0, 25, 50, 75, 100];
  const hp = hover != null ? valued.find((p) => p.i === hover) ?? null : null;
  const TW = 120, TH = 46;
  const tx = hp ? Math.max(PADL, Math.min(W - PADR - TW, hp.x - TW / 2)) : 0;

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg || valued.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    // nearest valued point
    let best = valued[0];
    for (const p of valued) if (Math.abs(p.x - svgX) < Math.abs(best.x - svgX)) best = p;
    setHover(best.i);
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="แนวโน้ม OEE สายผลิต">
      <defs>
        <linearGradient id="packGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12b5d4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#12b5d4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {grid.map((v) => (
        <g key={v}>
          <line x1={PADL} y1={yAt(v)} x2={W - PADR} y2={yAt(v)} stroke={v === 0 ? "#e2e6ec" : "#f1f3f7"} strokeWidth="1" />
          <text x={PADL - 2} y={yAt(v) - 3} fontSize="9" fill="#c4ccd8" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}

      {/* target line */}
      <line x1={PADL} y1={yAt(goal)} x2={W - PADR} y2={yAt(goal)} stroke="#9aa4b4" strokeWidth="1.3" strokeDasharray="5 5" />
      <text x={W - PADR} y={yAt(goal) - 4} fontSize="9.5" fill="#9aa4b4" textAnchor="end" fontFamily="IBM Plex Mono">เป้า {goal}%</text>

      {/* area + line per contiguous segment */}
      {segments.map((seg, si) => {
        const line = smoothPath(seg);
        const area = seg.length > 1 ? `${line} L ${seg[seg.length - 1].x.toFixed(1)},${baseY} L ${seg[0].x.toFixed(1)},${baseY} Z` : "";
        return (
          <g key={si}>
            {area && <path d={area} fill="url(#packGrad)" />}
            {seg.length > 1 && <path d={line} fill="none" stroke="#12b5d4" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        );
      })}

      {/* dots colored by OEE band */}
      {valued.map((p) => (
        <circle key={p.i} cx={p.x} cy={p.y} r={hp && hp.i === p.i ? 4.5 : 3.4} fill={oeeColor(p.v)} stroke="#fff" strokeWidth="1.6" />
      ))}

      {/* x labels (weekday) */}
      <g fontSize="10" fill="#9aa4b4" textAnchor="middle" fontFamily="IBM Plex Mono">
        {days.map((iso, i) => <text key={iso} x={xAt(i)} y={baseY + 18}>{dayLabel(iso)}</text>)}
      </g>

      {valued.length === 0 && (
        <text x={W / 2} y={H / 2} fontSize="12" fill="#9aa4b4" textAnchor="middle">ไม่มีการผลิตใน 7 วันนี้</text>
      )}

      {/* hover tooltip */}
      {hp && (
        <g>
          <line x1={hp.x} y1={PADT - 6} x2={hp.x} y2={baseY} stroke="#c4ccd8" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={tx} y="4" width={TW} height={TH} rx="7" fill="#ffffff" stroke="#e2e6ec" strokeWidth="1" />
          <text x={tx + 10} y="21" fontSize="11" fontWeight="700" fill="#16202e">{days[hp.i]}</text>
          <text x={tx + 10} y="37" fontSize="11" fill={oeeColor(hp.v)} fontFamily="IBM Plex Mono">OEE {hp.v}%</text>
        </g>
      )}

      <rect x="0" y="0" width={W} height={H} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
    </svg>
  );
}

"use client";

import { useState } from "react";
import { MovementBucket } from "@/lib/views/dashboard";
import { Modal, ModalHeader } from "@/components/ui/Modal";

const W = 720, H = 240, PADL = 12, PADR = 12, PADT = 16, PADB = 28;

// Smooth path through points using a Catmull-Rom → cubic-bezier conversion.
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

function buildGeometry(buckets: MovementBucket[]) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.recv, b.issue)));
  const n = buckets.length;
  const baseY = H - PADB;
  const plotH = baseY - PADT;
  const plotW = W - PADL - PADR;
  const xAt = (i: number) => (n > 1 ? PADL + (i / (n - 1)) * plotW : PADL + plotW / 2);
  const yAt = (v: number) => baseY - (v / max) * plotH;

  const recvPts = buckets.map((b, i) => ({ x: xAt(i), y: yAt(b.recv) }));
  const issuePts = buckets.map((b, i) => ({ x: xAt(i), y: yAt(b.issue) }));
  const recvLine = smoothPath(recvPts);
  const issueLine = smoothPath(issuePts);
  const recvArea = `${recvLine} L ${xAt(n - 1).toFixed(1)},${baseY} L ${xAt(0).toFixed(1)},${baseY} Z`;

  const step = Math.max(1, Math.ceil(n / 12));
  const labels = buckets.map((b, i) => ({
    x: xAt(i),
    text: b.label,
    show: i % step === 0 || i === n - 1,
  }));
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => baseY - f * plotH);
  return { recvLine, issueLine, recvArea, labels, grid, baseY, recvEnd: recvPts[n - 1], issueEnd: issuePts[n - 1] };
}

export function MovementChart({
  buckets,
  totalRecv,
  totalIssue,
}: {
  buckets: MovementBucket[];
  totalRecv: number;
  totalIssue: number;
}) {
  const [open, setOpen] = useState(false);
  const { recvLine, issueLine, recvArea, labels, grid, baseY, recvEnd, issueEnd } =
    buildGeometry(buckets);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div className="flex-1 text-[14px] font-semibold">
          Stock Movement (ความเคลื่อนไหว)
        </div>
        <button onClick={() => setOpen(true)} className="text-[12px] text-[#12a2bb]">
          Detail →
        </button>
        <div className="text-[11.5px] text-[#9aa4b4]">
          In {totalRecv.toLocaleString()} · Out {totalIssue.toLocaleString()}
        </div>
        <div className="flex w-full gap-3.5 text-[11.5px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#12a2bb]" />
            Received (รับเข้า)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#5b53d6]" />
            Issued (จ่ายออก)
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        <defs>
          <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12a2bb" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#12a2bb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((y, i) => (
          <line key={i} x1={PADL} y1={y} x2={W - PADR} y2={y} stroke={i === grid.length - 1 ? "#e2e6ec" : "#f1f3f7"} strokeWidth="1" />
        ))}
        <path d={recvArea} fill="url(#recvGrad)" />
        <path d={issueLine} fill="none" stroke="#5b53d6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={recvLine} fill="none" stroke="#12a2bb" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        {recvEnd && <circle cx={recvEnd.x} cy={recvEnd.y} r="3.5" fill="#12a2bb" stroke="#fff" strokeWidth="1.5" />}
        {issueEnd && <circle cx={issueEnd.x} cy={issueEnd.y} r="3.5" fill="#5b53d6" stroke="#fff" strokeWidth="1.5" />}
        <g fontSize="10" fill="#9aa4b4" fontFamily="IBM Plex Mono" textAnchor="middle">
          {labels.map((l, i) => (l.show ? <text key={i} x={l.x} y={baseY + 18}>{l.text}</text> : null))}
        </g>
      </svg>

      <Modal open={open} onClose={() => setOpen(false)} width={520}>
        <ModalHeader title="Stock Movement detail" onClose={() => setOpen(false)} />
        <div className="max-h-[400px] overflow-auto px-5 py-4">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[#9aa4b4]">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 text-right font-medium">Received</th>
                <th className="pb-2 text-right font-medium">Issued</th>
                <th className="pb-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={i} className="border-t border-[#eef1f5]">
                  <td className="font-num py-2">{b.label}</td>
                  <td className="font-num py-2 text-right text-[#0e8ba1]">
                    +{b.recv.toLocaleString()}
                  </td>
                  <td className="font-num py-2 text-right text-[#c9821f]">
                    −{b.issue.toLocaleString()}
                  </td>
                  <td className="font-num py-2 text-right font-semibold">
                    {(b.recv - b.issue).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}

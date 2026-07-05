"use client";

import { useState } from "react";
import { MovementBucket } from "@/lib/views/dashboard";
import { Modal, ModalHeader } from "@/components/ui/Modal";

function buildGeometry(buckets: MovementBucket[]) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.recv, b.issue)));
  const n = buckets.length;
  const xStep = n > 1 ? (650 - 40) / (n - 1) : 0;
  const points = buckets.map((b, i) => {
    const x = 40 + i * xStep;
    return {
      x,
      yRecv: 175 - (b.recv / max) * 160,
      yIssue: 175 - (b.issue / max) * 160,
      label: b.label,
      vRecv: b.recv,
      vIssue: b.issue,
    };
  });
  const recvLine = points.map((p) => `${p.x},${p.yRecv}`).join(" ");
  const issueLine = points.map((p) => `${p.x},${p.yIssue}`).join(" ");
  const recvArea = `40,175 ${recvLine} 650,175`;
  return { points, recvLine, issueLine, recvArea };
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
  const { points, recvLine, issueLine, recvArea } = buildGeometry(buckets);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div className="flex-1 text-[14px] font-semibold">
          Stock Movement (ความเคลื่อนไหว)
        </div>
        <button onClick={() => setOpen(true)} className="text-[12px] text-[#3E9B6E]">
          Detail →
        </button>
        <div className="text-[11.5px] text-[#9aa4b4]">
          In {totalRecv.toLocaleString()} · Out {totalIssue.toLocaleString()}
        </div>
        <div className="flex w-full gap-3.5 text-[11.5px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#3E9B6E]" />
            Received (รับเข้า)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#e59a2b]" />
            Issued (จ่ายออก)
          </span>
        </div>
      </div>
      <svg viewBox="0 0 660 210" className="block h-[210px] w-full">
        <line x1="40" y1="175" x2="650" y2="175" stroke="#e2e6ec" />
        <line x1="40" y1="120" x2="650" y2="120" stroke="#f1f3f7" />
        <line x1="40" y1="65" x2="650" y2="65" stroke="#f1f3f7" />
        <line x1="40" y1="15" x2="650" y2="15" stroke="#f1f3f7" />
        <polygon points={recvArea} fill="#3E9B6E" opacity="0.09" />
        <polyline points={recvLine} fill="none" stroke="#3E9B6E" strokeWidth="2.5" strokeLinejoin="round" />
        <polyline points={issueLine} fill="none" stroke="#e59a2b" strokeWidth="2.5" strokeLinejoin="round" />
        <g fontSize="9" fill="#3E9B6E" fontFamily="IBM Plex Mono" textAnchor="middle" fontWeight="600">
          {points.map((p, i) => (
            <text key={i} x={p.x} y={p.yRecv - 6}>
              {p.vRecv}
            </text>
          ))}
        </g>
        <g fontSize="9" fill="#e59a2b" fontFamily="IBM Plex Mono" textAnchor="middle" fontWeight="600">
          {points.map((p, i) => (
            <text key={i} x={p.x} y={p.yIssue + 12}>
              {p.vIssue}
            </text>
          ))}
        </g>
        <g fontSize="10" fill="#9aa4b4" fontFamily="IBM Plex Mono" textAnchor="middle">
          {points.map((p, i) => (
            <text key={i} x={p.x} y="205">
              {p.label}
            </text>
          ))}
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
                  <td className="font-num py-2 text-right text-[#17935a]">
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

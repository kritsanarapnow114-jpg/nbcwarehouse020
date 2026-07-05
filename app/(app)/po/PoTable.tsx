"use client";

import { useState } from "react";
import { PoRow } from "@/lib/views/po";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Currency";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { Tone } from "@/components/ui/tone";
import { fmtDateBE } from "@/lib/calc/date";

const STATUS_TONE: Record<PoRow["status"], Tone> = {
  COMPLETE: "ok",
  PENDING: "warn",
  OPEN: "accent",
};

const STATUS_LABEL: Record<PoRow["status"], string> = {
  COMPLETE: "Complete (เสร็จสิ้น)",
  PENDING: "Pending (รอดำเนินการ)",
  OPEN: "Open (เปิด)",
};

export function PoTable({ rows }: { rows: PoRow[] }) {
  const [selected, setSelected] = useState<PoRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
              <Th>PO No.</Th>
              <Th>Vendor</Th>
              <Th>Date</Th>
              <Th align="right">Amount</Th>
              <Th>Received</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((po) => (
              <tr
                key={po.id}
                onClick={() => setSelected(po)}
                className="cursor-pointer border-t border-[#eef1f5] hover:bg-[#f7f9fb]"
              >
                <Td className="font-num text-[12px] text-[#3a4658]">
                  {po.no}
                </Td>
                <Td className="font-medium">{po.vendor}</Td>
                <Td className="font-num text-[12px] text-[#69748a]">
                  {fmtDateBE(new Date(po.date))}
                </Td>
                <Td align="right" className="font-num font-semibold">
                  <Money value={po.amount} />
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-[110px]">
                      <ProgressBar pct={po.receivedPct} />
                    </div>
                    <span className="font-num w-[38px] text-[12px] text-[#69748a]">
                      {Math.round(po.receivedPct)}%
                    </span>
                  </div>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[po.status]}>
                    {STATUS_LABEL[po.status]}
                  </Badge>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[#9aa4b4]">
                  No purchase orders found (ไม่พบใบสั่งซื้อ)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} width={640}>
        {selected && (
          <>
            <ModalHeader
              title={
                <span>
                  <span className="font-num">{selected.no}</span>{" "}
                  <span className="text-[#69748a] font-normal">
                    · {selected.vendor}
                  </span>
                </span>
              }
              onClose={() => setSelected(null)}
            />
            <div className="p-5">
              <div className="mb-4 flex items-center gap-6 text-[12.5px] text-[#69748a]">
                <div>
                  Date:{" "}
                  <span className="font-num text-[#16202e]">
                    {fmtDateBE(new Date(selected.date))}
                  </span>
                </div>
                <div>
                  Amount:{" "}
                  <span className="font-num font-semibold text-[#16202e]">
                    <Money value={selected.amount} />
                  </span>
                </div>
                <div>
                  Status:{" "}
                  <Badge tone={STATUS_TONE[selected.status]}>
                    {STATUS_LABEL[selected.status]}
                  </Badge>
                </div>
              </div>

              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[#9aa4b4]">
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 text-right font-medium">Ordered</th>
                    <th className="pb-2 text-right font-medium">Received</th>
                    <th className="pb-2 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((l) => (
                    <tr key={l.id} className="border-t border-[#eef1f5]">
                      <td className="font-num py-2">{l.productCode}</td>
                      <td className="py-2">{l.productName}</td>
                      <td className="font-num py-2 text-right">
                        {l.ordered.toLocaleString()}
                      </td>
                      <td className="font-num py-2 text-right">
                        {l.received.toLocaleString()}
                      </td>
                      <td className="font-num py-2 text-right">
                        {l.remaining.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {selected.lines.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-4 text-center text-[#9aa4b4]"
                      >
                        No lines yet (ยังไม่มีรายการ)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`p-[11px_16px] text-[11.5px] font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`p-[12px_16px] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}

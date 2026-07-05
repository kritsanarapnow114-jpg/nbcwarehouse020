"use client";

import { useState } from "react";
import { Card, CardTitle } from "./Card";
import { Modal, ModalHeader } from "./Modal";
import { fmtDateBE } from "@/lib/calc/date";

export type DocHistoryLine = {
  code: string;
  name: string;
  qtyText: string;
  extra?: string;
};

export type DocHistoryRow = {
  id: string;
  docNo: string;
  docDate: string;
  summary: string;
  lineCount: number;
  lines: DocHistoryLine[];
};

export function DocHistory({
  title,
  rows,
  accentColor = "#3E9B6E",
}: {
  title: string;
  rows: DocHistoryRow[];
  accentColor?: string;
}) {
  const [selected, setSelected] = useState<DocHistoryRow | null>(null);

  return (
    <Card className="mt-4">
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <div className="p-4 text-center text-[12.5px] text-[#9aa4b4]">
          No documents yet
        </div>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="flex items-center gap-3 border-t border-[#eef1f5] py-2.5 text-left text-[13px] first:border-t-0 hover:bg-[#f7f9fb]"
            >
              <span
                className="font-num w-[130px] flex-none font-semibold"
                style={{ color: accentColor }}
              >
                {r.docNo}
              </span>
              <span className="font-num w-[92px] flex-none text-[#69748a]">
                {fmtDateBE(new Date(r.docDate))}
              </span>
              <span className="flex-1 truncate text-[#3a4658]">{r.summary}</span>
              <span className="font-num text-[11.5px] text-[#9aa4b4]">
                {r.lineCount} lines
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} width={560}>
        {selected && (
          <>
            <ModalHeader
              title={
                <span>
                  <span className="font-num">{selected.docNo}</span> ·{" "}
                  {fmtDateBE(new Date(selected.docDate))}
                </span>
              }
              onClose={() => setSelected(null)}
            />
            <div className="max-h-[420px] overflow-auto px-5 py-4">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[#9aa4b4]">
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 text-right font-medium">Qty</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((l, i) => (
                    <tr key={i} className="border-t border-[#eef1f5]">
                      <td className="font-num py-2 text-[#3a4658]">{l.code}</td>
                      <td className="py-2 font-medium">{l.name}</td>
                      <td className="font-num py-2 text-right">{l.qtyText}</td>
                      <td className="py-2 text-[11.5px] text-[#9aa4b4]">{l.extra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </Card>
  );
}

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printDoc(title: string, row: DocHistoryRow) {
  const w = window.open("", "_blank", "width=820,height=920");
  if (!w) return;
  w.document.write(`
    <html><head><title>${escapeHtml(row.docNo)}</title>
    <style>body{font-family:sans-serif;padding:32px}table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ccc;padding:8px;font-size:13px;text-align:left}</style></head><body>
    <h2>${escapeHtml(title)}</h2>
    <p>Doc No: ${escapeHtml(row.docNo)}<br/>Date: ${escapeHtml(fmtDateBE(new Date(row.docDate)))}<br/>${escapeHtml(row.summary)}</p>
    <table><thead><tr><th>Code</th><th>Product</th><th>Qty</th><th>Lot / Location</th></tr></thead>
    <tbody>${row.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.code)}</td><td>${escapeHtml(l.name)}</td><td>${escapeHtml(l.qtyText)}</td><td>${escapeHtml(l.extra ?? "")}</td></tr>`
      )
      .join("")}</tbody></table></body></html>
  `);
  w.document.close();
  w.print();
}

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
              action={
                <button
                  onClick={() => printDoc(title, selected)}
                  className="flex items-center gap-1.5 rounded-[8px] border border-[#d7dce4] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#3a4658] hover:bg-[#f7f9fb]"
                >
                  ⎙ Print
                </button>
              }
              onClose={() => setSelected(null)}
            />
            <div className="max-h-[420px] overflow-auto px-5 py-4">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[#9aa4b4]">
                    <th className="w-[90px] pb-2 pr-3 font-medium">Code</th>
                    <th className="pb-2 pr-3 font-medium">Product</th>
                    <th className="w-[100px] pb-2 pr-3 text-right font-medium">Qty</th>
                    <th className="w-[150px] pb-2 pl-3 font-medium">Lot / Location</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((l, i) => (
                    <tr key={i} className="border-t border-[#eef1f5]">
                      <td className="font-num py-2 pr-3 text-[#3a4658]">{l.code}</td>
                      <td className="py-2 pr-3 font-medium">{l.name}</td>
                      <td className="font-num py-2 pr-3 text-right">{l.qtyText}</td>
                      <td className="border-l border-[#eef1f5] py-2 pl-3 text-[11.5px] text-[#9aa4b4]">
                        {l.extra}
                      </td>
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

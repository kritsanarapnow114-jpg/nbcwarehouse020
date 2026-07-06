"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "./Card";
import { Modal, ModalHeader } from "./Modal";
import { buttonClass } from "./Button";
import { showToast } from "./Toast";
import { fmtDateBE } from "@/lib/calc/date";
import { reverseDocumentAction, ReversibleKind } from "@/lib/actions/reverse";

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
  reversedAt?: string | null;
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
  reverseKind,
}: {
  title: string;
  rows: DocHistoryRow[];
  accentColor?: string;
  reverseKind?: ReversibleKind;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DocHistoryRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);

  function closeModal() {
    setSelected(null);
    setConfirming(false);
    setReverseError(null);
  }

  async function handleReverse() {
    if (!selected || !reverseKind) return;
    setReversing(true);
    setReverseError(null);
    try {
      await reverseDocumentAction(reverseKind, selected.id);
      showToast(`Document ${selected.docNo} reversed (ถอยเอกสารแล้ว)`);
      closeModal();
      router.refresh();
    } catch (e) {
      setReverseError(e instanceof Error ? e.message : "Failed to reverse document.");
    } finally {
      setReversing(false);
    }
  }

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
              <span className="flex-1 truncate text-[#3a4658]">
                {r.summary}
                {r.reversedAt && (
                  <span className="ml-2 rounded-[5px] bg-[#f3d2d2] px-1.5 py-0.5 text-[10px] font-semibold text-[#b13c3c]">
                    ถอยแล้ว · Reversed
                  </span>
                )}
              </span>
              <span className="font-num text-[11.5px] text-[#9aa4b4]">
                {r.lineCount} lines
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={closeModal} width={560}>
        {selected && (
          <>
            <ModalHeader
              title={
                <span>
                  <span className="font-num">{selected.docNo}</span> ·{" "}
                  {fmtDateBE(new Date(selected.docDate))}
                  {selected.reversedAt && (
                    <span className="ml-2 rounded-[5px] bg-[#f3d2d2] px-1.5 py-0.5 text-[10px] font-semibold text-[#b13c3c]">
                      ถอยแล้ว · Reversed
                    </span>
                  )}
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
              onClose={closeModal}
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

            {reverseKind && !selected.reversedAt && (
              <div className="border-t border-[#eef1f5] bg-[#fafbfc] px-5 py-3">
                {reverseError && (
                  <div className="mb-2 rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">
                    {reverseError}
                  </div>
                )}
                {!confirming ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[#69748a]">
                      ถอยเอกสารนี้ = คืนสต็อกกลับ (undo this document&apos;s stock effect)
                    </span>
                    <button
                      onClick={() => setConfirming(true)}
                      className="flex-none rounded-[8px] border border-[#e2b4b4] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#c0453f] hover:bg-[#fbe9e9]"
                    >
                      ↩ ถอยเอกสาร (Reverse)
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-medium text-[#3a4658]">
                      ยืนยันถอยเอกสาร {selected.docNo}? สต็อกจะถูกคืนกลับ
                    </span>
                    <div className="flex flex-none gap-2">
                      <button
                        onClick={() => setConfirming(false)}
                        disabled={reversing}
                        className={buttonClass("secondary")}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReverse}
                        disabled={reversing}
                        className="rounded-[8px] bg-[#c0453f] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#a83b36] disabled:opacity-60"
                      >
                        {reversing ? "กำลังถอย…" : "ยืนยันถอย"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </Card>
  );
}

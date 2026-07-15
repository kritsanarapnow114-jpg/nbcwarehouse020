"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "./Card";
import { Modal, ModalHeader } from "./Modal";
import { buttonClass } from "./Button";
import { showToast } from "./Toast";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { reverseDocumentAction, ReversibleKind } from "@/lib/actions/reverse";
import { getRedoTemplateAction } from "@/lib/actions/redo";
import { stashRedo } from "@/lib/redoTemplate";
import { printTable, printCountSheet } from "@/lib/calc/printClient";

export type DocHistoryLine = {
  code: string;
  name: string;
  qtyText: string;
  extra?: string;
  // Optional structured fields — used when printing as a WEEKLY CYCLE COUNT sheet.
  lotNo?: string;
  location?: string;
  sysText?: string;
  countText?: string;
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


function printDoc(title: string, row: DocHistoryRow, sheet?: "count") {
  if (sheet === "count") {
    // Print the completed count as the WEEKLY CYCLE COUNT form (values filled in).
    printCountSheet({
      meta: [`${row.docNo}`, `Date: ${fmtDateBE(new Date(row.docDate))}`, row.summary],
      showSys: true,
      rows: row.lines.map((l) => [
        l.code,
        l.name,
        l.lotNo ?? "",
        l.location ?? "",
        l.sysText ?? "",
        l.countText ?? l.qtyText,
      ]),
    });
    return;
  }
  printTable({
    title: `${title} — ${row.docNo}`,
    meta: [`Date: ${fmtDateBE(new Date(row.docDate))}`, row.summary],
    headers: ["SAP Material Master", "Material Description", "Qty", "Lot / Location"],
    rows: row.lines.map((l) => [l.code, l.name, l.qtyText, l.extra ?? ""]),
  });
}

export function DocHistory({
  title,
  rows,
  accentColor = "#2f8f5b",
  reverseKind,
  printSheet,
}: {
  title: string;
  rows: DocHistoryRow[];
  accentColor?: string;
  reverseKind?: ReversibleKind;
  printSheet?: "count";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DocHistoryRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");

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
      const res = await reverseDocumentAction(reverseKind, selected.id);
      if (res.error) {
        setReverseError(res.error);
        return;
      }
      showToast(`Document ${selected.docNo} reversed (ถอยเอกสารแล้ว)`);
      closeModal();
      router.refresh();
    } catch (e) {
      setReverseError(e instanceof Error ? e.message : "Failed to reverse document.");
    } finally {
      setReversing(false);
    }
  }

  async function handleRedo() {
    if (!selected || !reverseKind) return;
    setReversing(true);
    setReverseError(null);
    const res = await getRedoTemplateAction(reverseKind, selected.id);
    setReversing(false);
    if ("error" in res) {
      setReverseError(res.error);
      return;
    }
    stashRedo(reverseKind, res.payload);
    closeModal();
    router.push(res.path);
  }

  const visibleRows = filterDate
    ? rows.filter((r) => fmtDateISO(new Date(r.docDate)) === filterDate)
    : rows;

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>{title}</CardTitle>
        <div className="flex-1" />
        <span className="text-[11.5px] text-[#9aa4b4]">ค้นหาวันที่:</span>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1 text-[12px] outline-none focus:border-[#2f8f5b]"
        />
        {filterDate && (
          <button
            onClick={() => setFilterDate("")}
            className="rounded-[7px] border border-[#d7dce4] bg-white px-2 py-1 text-[11.5px] text-[#69748a] hover:bg-[#f7f9fb]"
          >
            ล้าง
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="p-4 text-center text-[12.5px] text-[#9aa4b4]">
          No documents yet
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="p-4 text-center text-[12.5px] text-[#9aa4b4]">
          ไม่พบเอกสารของวันที่เลือก (no documents on this date)
        </div>
      ) : (
        <div className="flex flex-col">
          {visibleRows.map((r) => (
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
                  onClick={() => printDoc(title, selected, printSheet)}
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
                    <th className="w-[90px] pb-2 pr-3 font-medium">SAP Material Master</th>
                    <th className="pb-2 pr-3 font-medium">Material Description</th>
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

            {reverseKind && selected.reversedAt && (
              <div className="border-t border-[#eef1f5] bg-[#fafbfc] px-5 py-3">
                {reverseError && (
                  <div className="mb-2 rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">
                    {reverseError}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-[#69748a]">
                    ทำเอกสารนี้อีกครั้ง — เอาข้อมูลไปกรอกใหม่ (re-enter as a new document)
                  </span>
                  <button
                    onClick={handleRedo}
                    disabled={reversing}
                    className="flex-none rounded-[8px] border border-[#bfe0cd] bg-[#e8f5ec] px-3 py-1.5 text-[12.5px] font-semibold text-[#0c7f93] hover:bg-[#d6eef4] disabled:opacity-60"
                  >
                    {reversing ? "กำลังเตรียม…" : "↻ ทำซ้ำ (Redo)"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </Card>
  );
}

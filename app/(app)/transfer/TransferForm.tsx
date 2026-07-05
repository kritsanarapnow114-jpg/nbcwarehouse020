"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LotOption } from "@/lib/views/docCommon";
import { confirmTransferAction } from "@/lib/actions/transfer";
import { buttonClass } from "@/components/ui/Button";
import { CuteBoxPopup } from "@/components/ui/CuteBoxPopup";
import { downloadCsv } from "@/lib/calc/csvClient";
import { fmtDateISO } from "@/lib/calc/date";

const OPERATORS = ["Somchai K.", "Wipha S.", "Warehouse team"];

type Line = LotOption & { toLocationCode: string; moveQty: string };

export function TransferForm({ lots, locations }: { lots: LotOption[]; locations: string[] }) {
  const router = useRouter();
  const [operator, setOperator] = useState(OPERATORS[0]);
  const [docDate, setDocDate] = useState(fmtDateISO(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
  const [addId, setAddId] = useState("");
  const [popup, setPopup] = useState<{ kind: "transfer" | "draft"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = lots.filter((l) => !lines.some((x) => x.id === l.id));

  function addLine(id: string) {
    const lot = lots.find((l) => l.id === id);
    if (!lot) return;
    const otherLoc = locations.find((c) => c !== lot.locationCode) ?? lot.locationCode;
    setLines((ls) => [...ls, { ...lot, toLocationCode: otherLoc, moveQty: String(lot.qty) }]);
    setAddId("");
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await confirmTransferAction({
        operator,
        docDate,
        lines: lines.map((l) => ({
          lotId: l.id,
          toLocationCode: l.toLocationCode,
          qty: Number(l.moveQty) || 0,
        })),
      });
      setPopup({ kind: "transfer", message: `Transfer ${res.docNo} confirmed — locations updated.` });
      setLines([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm transfer.");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    const w = window.open("", "_blank", "width=820,height=920");
    if (!w) return;
    w.document.write(`
      <html><head><title>Transfer</title>
      <style>body{font-family:sans-serif;padding:32px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ccc;padding:8px;font-size:13px;text-align:left}</style></head><body>
      <h2>Transfer Slip</h2><p>Operator: ${operator}<br/>Date: ${docDate}</p>
      <table><thead><tr><th>Code</th><th>Product</th><th>Lot</th><th>From</th><th>To</th><th>Qty</th></tr></thead>
      <tbody>${lines
        .map(
          (l) =>
            `<tr><td>${l.productCode}</td><td>${l.name}</td><td>${l.lotNo}</td><td>${l.locationCode}</td><td>${l.toLocationCode}</td><td>${l.moveQty} ${l.unit}</td></tr>`
        )
        .join("")}</tbody></table></body></html>
    `);
    w.document.close();
    w.print();
  }

  function handleExport() {
    downloadCsv(
      "transfer-draft.csv",
      ["Code", "Product", "Lot", "From", "To", "Qty"],
      lines.map((l) => [l.productCode, l.name, l.lotNo, l.locationCode, l.toLocationCode, l.moveQty])
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] p-[18px_22px]">
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Transfer No. · auto</div>
            <div className="font-num text-[16px] font-semibold text-[#12a08d]">next on confirm</div>
          </div>
          <div className="h-[34px] w-px bg-[#e2e6ec]" />
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Operator (ผู้ปฏิบัติงาน)</div>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            >
              {OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-[8px] border border-[#1e9e5e] bg-[#eaf7f0] px-3.5 py-2 text-[12.5px] font-semibold text-[#12894f]">
            ⤓ Export Excel
          </button>
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Doc date</div>
            <input
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">Code</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Product</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">From</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">To</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Qty</th>
                <th className="w-10 p-[10px_16px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{l.productCode}</td>
                  <td className="p-[11px_16px] font-medium">{l.name}</td>
                  <td className="font-num p-[11px_16px] text-[12px]">{l.lotNo}</td>
                  <td className="font-num p-[11px_16px] text-[12px]">{l.locationCode}</td>
                  <td className="p-[11px_16px]">
                    <select
                      value={l.toLocationCode}
                      onChange={(e) => updateLine(i, { toLocationCode: e.target.value })}
                      className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    >
                      {locations.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-[11px_16px] text-right">
                    <input
                      value={l.moveQty}
                      onChange={(e) => updateLine(i, { moveQty: e.target.value })}
                      className="font-num w-[84px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                    />{" "}
                    <span className="text-[11px] text-[#9aa4b4]">/{l.qty} {l.unit}</span>
                  </td>
                  <td className="p-[11px_16px] text-center">
                    <button onClick={() => removeLine(i)} className="text-[16px] text-[#c2606f]">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#9aa4b4]">
                    No lines yet — add a lot below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-[#eef1f5] p-[12px_16px]">
          <select
            value={addId}
            onChange={(e) => addLine(e.target.value)}
            className="w-full rounded-[9px] border border-dashed border-[#c4ccd8] bg-[#f7f9fb] px-3 py-2 text-[13px] text-[#3a4658]"
          >
            <option value="">+ Add line (เพิ่มรายการ) — choose a lot…</option>
            {available.map((l) => (
              <option key={l.id} value={l.id}>
                {l.productCode} · {l.name} · {l.lotNo} · {l.locationCode}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="border-t border-[#f3d2d2] bg-[#fbe9e9] px-[22px] py-2.5 text-[12.5px] text-[#c53f3f]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-[#eef1f5] bg-[#fafbfc] p-[16px_22px]">
          <div className="text-[12.5px] text-[#69748a]">{lines.length} lines</div>
          <div className="flex-1" />
          <button onClick={handlePrint} className={buttonClass("secondary")}>
            ⎙ Print
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || lines.length === 0}
            className={buttonClass("primary", "!bg-[#12a08d]")}
          >
            {saving ? "Saving…" : "Confirm transfer (ยืนยันย้าย)"}
          </button>
        </div>
      </div>

      {popup && <CuteBoxPopup open kind={popup.kind} message={popup.message} onClose={() => setPopup(null)} />}
    </>
  );
}

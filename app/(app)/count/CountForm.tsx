"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getLotsByZoneAction, confirmCountAction } from "@/lib/actions/count";
import { LotOption } from "@/lib/views/docCommon";
import { buttonClass } from "@/components/ui/Button";
import { CuteBoxPopup } from "@/components/ui/CuteBoxPopup";
import { downloadCsv } from "@/lib/calc/csvClient";
import { fmtDateISO } from "@/lib/calc/date";

const ZONES = [
  "All zones",
  "Zone A — Raw Material",
  "Zone B — Liquids",
  "Zone C — Packaging",
  "Zone D — Finished",
];

type Row = Awaited<ReturnType<typeof getLotsByZoneAction>>[number] & { counted: string };

export function CountForm({ lots }: { lots: LotOption[] }) {
  const router = useRouter();
  const [pullZone, setPullZone] = useState(ZONES[0]);
  const [docDate, setDocDate] = useState(fmtDateISO(new Date()));
  const [lines, setLines] = useState<Row[]>([]);
  const [addId, setAddId] = useState("");
  const [popup, setPopup] = useState<{ kind: "count" | "draft"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const available = lots.filter((l) => !lines.some((x) => x.id === l.id));

  async function handlePull() {
    setPulling(true);
    const rows = await getLotsByZoneAction(pullZone);
    setLines((existing) => {
      const existingIds = new Set(existing.map((l) => l.id));
      const merged = [...existing];
      for (const r of rows) {
        if (!existingIds.has(r.id)) merged.push({ ...r, counted: String(r.sysQty) });
      }
      return merged;
    });
    setPulling(false);
  }

  function addLine(id: string) {
    const lot = lots.find((l) => l.id === id);
    if (!lot) return;
    setLines((ls) => [
      ...ls,
      {
        id: lot.id,
        productCode: lot.productCode,
        name: lot.name,
        lotNo: lot.lotNo,
        locationCode: lot.locationCode,
        sysQty: lot.qty,
        counted: String(lot.qty),
      },
    ]);
    setAddId("");
  }

  function updateLine(i: number, counted: string) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, counted } : l)));
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await confirmCountAction({
        pullZone,
        docDate,
        lines: lines.map((l) => ({ lotId: l.id, countedQty: Number(l.counted) || 0 })),
      });
      setPopup({ kind: "count", message: `Count ${res.docNo} saved — feeds Inventory Accuracy KPI.` });
      setLines([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save count.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    downloadCsv(
      "stock-count-draft.csv",
      ["Code", "Product", "Lot", "Location", "SysQty", "CountedQty", "Variance"],
      lines.map((l) => [
        l.productCode,
        l.name,
        l.lotNo,
        l.locationCode,
        l.sysQty,
        Number(l.counted) || 0,
        (Number(l.counted) || 0) - l.sysQty,
      ])
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] p-[18px_22px]">
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Count No. · auto</div>
            <div className="font-num text-[16px] font-semibold text-[#3E9B6E]">next on confirm</div>
          </div>
          <div className="h-[34px] w-px bg-[#e2e6ec]" />
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Pull by Location (ดึงตาม Location)</div>
            <select
              value={pullZone}
              onChange={(e) => setPullZone(e.target.value)}
              className="rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handlePull} disabled={pulling} className={buttonClass("accent")}>
            {pulling ? "Pulling…" : "⤓ Pull lots"}
          </button>
          <div className="flex-1" />
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-[8px] border border-[#1e9e5e] bg-[#eaf7f0] px-3.5 py-2 text-[12.5px] font-semibold text-[#12894f]">
            ⤓ Export file
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
                <th className="p-[10px_16px] text-[11.5px] font-medium">Location</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">System</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Counted</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Variance</th>
                <th className="w-10 p-[10px_16px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const variance = (Number(l.counted) || 0) - l.sysQty;
                return (
                  <tr key={l.id} className="border-t border-[#eef1f5]">
                    <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{l.productCode}</td>
                    <td className="p-[11px_16px] font-medium">{l.name}</td>
                    <td className="font-num p-[11px_16px] text-[12px]">{l.lotNo}</td>
                    <td className="font-num p-[11px_16px] text-[12px]">{l.locationCode}</td>
                    <td className="font-num p-[11px_16px] text-right">{l.sysQty.toLocaleString()}</td>
                    <td className="p-[11px_16px] text-right">
                      <input
                        value={l.counted}
                        onChange={(e) => updateLine(i, e.target.value)}
                        className="font-num w-[84px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                      />
                    </td>
                    <td
                      className="font-num p-[11px_16px] text-right font-semibold"
                      style={{ color: variance === 0 ? "#3E9B6E" : variance > 0 ? "#17935a" : "#d24141" }}
                    >
                      {variance > 0 ? `+${variance}` : variance}
                    </td>
                    <td className="p-[11px_16px] text-center">
                      <button onClick={() => removeLine(i)} className="text-[16px] text-[#c2606f]">
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[#9aa4b4]">
                    Choose a zone and click &quot;Pull lots&quot;, or add a lot below.
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
          <button
            onClick={() => setPopup({ kind: "draft", message: "Draft saved locally (not yet posted)." })}
            className={buttonClass("secondary")}
          >
            Save draft (ร่าง)
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || lines.length === 0}
            className={buttonClass("primary")}
          >
            {saving ? "Saving…" : "Save count (บันทึกนับสต็อก)"}
          </button>
        </div>
      </div>

      {popup && <CuteBoxPopup open kind={popup.kind} message={popup.message} onClose={() => setPopup(null)} />}
    </>
  );
}

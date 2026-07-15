"use client";

import { useEffect, useState } from "react";
import { getBomAction, saveBomAction } from "@/lib/actions/products";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type MaterialOption = { code: string; name: string; unit: string };
type Line = { materialProductCode: string; qtyPerUnit: string; perQty: string; unit: string };

export function BomEditor({
  finishedProductCode,
  materials,
}: {
  finishedProductCode: string;
  materials: MaterialOption[];
}) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [linesFor, setLinesFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBomAction(finishedProductCode).then((rows) => {
      setLines(rows.map((r) => ({ materialProductCode: r.materialProductCode, qtyPerUnit: String(r.qtyPerUnit), perQty: String(r.perQty ?? 1), unit: r.unit })));
      setLinesFor(finishedProductCode);
    });
  }, [finishedProductCode]);

  const shown = linesFor === finishedProductCode ? lines : null;
  const available = materials.filter((m) => !(shown ?? []).some((l) => l.materialProductCode === m.code));

  function addLine(code: string) {
    const m = materials.find((x) => x.code === code);
    if (!m || !shown) return;
    setLines([...shown, { materialProductCode: m.code, qtyPerUnit: "1", perQty: "1", unit: m.unit }]);
    setLinesFor(finishedProductCode);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    if (!shown) return;
    setLines(shown.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    if (!shown) return;
    setLines(shown.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!shown) return;
    setSaving(true);
    setError(null);
    try {
      await saveBomAction(
        finishedProductCode,
        shown.map((l) => ({
          materialProductCode: l.materialProductCode,
          qtyPerUnit: Number(l.qtyPerUnit) || 0,
          perQty: Number(l.perQty) || 1,
          unit: l.unit,
        }))
      );
      showToast("BOM saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save BOM.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[#eef1f5] pt-4">
      <div className="text-[12.5px] font-semibold text-[#16202e]">
        Bill of Materials (สูตรวัตถุดิบ) — used when receiving from Production
      </div>
      <div className="mb-2 text-[11px] text-[#9aa4b4]">
        ใช้ [Qty] ต่อทุกๆ [Per] หน่วยที่ผลิต · เช่น พาเลท 1 ต่อ 750 = ผลิตครบ 750 ถึงตัด 1 พาเลท (blank Per = 1)
      </div>
      {shown === null ? (
        <div className="text-[12px] text-[#9aa4b4]">Loading…</div>
      ) : (
        <>
          <table className="mb-2 w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[#9aa4b4]">
                <th className="pb-1.5 pr-3 font-medium">Material</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Qty</th>
                <th className="pb-1.5 pr-3 text-right font-medium">Per (ต่อผลิต)</th>
                <th className="pb-1.5 pr-3 font-medium">Unit</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l, i) => (
                <tr key={l.materialProductCode} className="border-t border-[#eef1f5]">
                  <td className="py-1.5 pr-3">
                    {materials.find((m) => m.code === l.materialProductCode)?.name ?? l.materialProductCode}
                    <span className="font-num ml-1.5 text-[10.5px] text-[#9aa4b4]">{l.materialProductCode}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <input
                      value={l.qtyPerUnit}
                      onChange={(e) => updateLine(i, { qtyPerUnit: e.target.value })}
                      className="font-num w-[70px] rounded-[6px] border border-[#d7dce4] px-2 py-1 text-right text-[12.5px]"
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <input
                      value={l.perQty}
                      onChange={(e) => updateLine(i, { perQty: e.target.value })}
                      title="ต่อทุกๆ กี่หน่วยที่ผลิต (per how many produced units)"
                      className="font-num w-[70px] rounded-[6px] border border-[#d7dce4] px-2 py-1 text-right text-[12.5px]"
                    />
                  </td>
                  <td className="font-num py-1.5 pr-3 text-[#69748a]">{l.unit}</td>
                  <td className="py-1.5 text-center">
                    <button onClick={() => removeLine(i)} className="text-[15px] text-[#c2606f]">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-[#9aa4b4]">
                    No materials linked yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <SearchableSelect
            options={available.map((m) => ({ value: m.code, label: `${m.code} · ${m.name}` }))}
            onSelect={addLine}
            placeholder="+ Add material (เพิ่มวัตถุดิบ) — พิมพ์ค้นหา…"
            className="mb-2 w-full rounded-[8px] border border-dashed border-[#c4ccd8] bg-[#f7f9fb] px-2.5 py-1.5 text-[12.5px] text-[#3a4658] outline-none focus:border-[#2f8f5b]"
          />

          {error && (
            <div className="mb-2 rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving} className={buttonClass("primary")}>
              {saving ? "Saving…" : "Save BOM"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

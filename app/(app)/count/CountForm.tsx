"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLotsByZoneAction, confirmCountAction } from "@/lib/actions/count";
import { LotOption, ProductOption } from "@/lib/views/docCommon";
import { buttonClass } from "@/components/ui/Button";
import { CuteBoxPopup } from "@/components/ui/CuteBoxPopup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { takeRedo } from "@/lib/redoTemplate";
import { downloadExcel } from "@/lib/calc/csvClient";
import { printTable } from "@/lib/calc/printClient";
import { fmtDateISO } from "@/lib/calc/date";

const ZONES = [
  "All zones",
  "Zone A — Raw Material",
  "Zone B — Liquids",
  "Zone C — Packaging",
];

type Row = Awaited<ReturnType<typeof getLotsByZoneAction>>[number] & { counted: string };
type OffRow = {
  key: string;
  productCode: string;
  name: string;
  unit: string;
  lotNo: string;
  locationCode: string;
  counted: string;
};

export function CountForm({
  lots,
  products,
  locations,
}: {
  lots: LotOption[];
  products: ProductOption[];
  locations: string[];
}) {
  const router = useRouter();
  const [pullZone, setPullZone] = useState(ZONES[0]);
  const [asOfDate, setAsOfDate] = useState(""); // empty = today's live stock
  const [docDate, setDocDate] = useState(fmtDateISO(new Date()));
  const [lines, setLines] = useState<Row[]>([]);
  const [offLines, setOffLines] = useState<OffRow[]>([]);
  const [popup, setPopup] = useState<{ kind: "count" | "draft"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [printShowSys, setPrintShowSys] = useState(false);

  const available = lots.filter((l) => !lines.some((x) => x.id === l.id));

  // Prefill from a "Redo" of a reversed stock count (one-shot, client-only storage).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = takeRedo<{
      pullZone: string;
      lines: { lotId: string; counted: string }[];
      offSystemLines: { productCode: string; lotNo: string; locationCode: string; counted: string }[];
    }>("count");
    if (!p) return;
    if (p.pullZone) setPullZone(p.pullZone);
    setLines(
      p.lines
        .map((pl) => {
          const lot = lots.find((l) => l.id === pl.lotId);
          if (!lot) return null;
          return {
            id: lot.id,
            productCode: lot.productCode,
            name: lot.name,
            lotNo: lot.lotNo,
            locationCode: lot.locationCode,
            sysQty: lot.qty,
            counted: pl.counted,
          };
        })
        .filter((x): x is Row => x !== null)
    );
    setOffLines(
      p.offSystemLines.map((ol) => {
        const prod = products.find((x) => x.code === ol.productCode);
        return {
          key: `${ol.productCode}-${Date.now()}-${Math.random()}`,
          productCode: ol.productCode,
          name: prod?.name ?? ol.productCode,
          unit: prod?.unit ?? "",
          lotNo: ol.lotNo,
          locationCode: ol.locationCode,
          counted: ol.counted,
        };
      })
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lots, products]);

  async function handlePull() {
    setPulling(true);
    const rows = await getLotsByZoneAction(pullZone, asOfDate || undefined);
    setLines((existing) => {
      const existingIds = new Set(existing.map((l) => l.id));
      const merged = [...existing];
      for (const r of rows) {
        if (!existingIds.has(r.id)) merged.push({ ...r, counted: String(r.sysQty) });
      }
      return merged;
    });
    // Counting a past snapshot → date the document to that day too.
    if (asOfDate) setDocDate(asOfDate);
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
  }

  function updateLine(i: number, counted: string) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, counted } : l)));
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  function addOffLine(productCode: string) {
    const p = products.find((x) => x.code === productCode);
    if (!p) return;
    setOffLines((ls) => [
      ...ls,
      {
        key: `${productCode}-${Date.now()}`,
        productCode: p.code,
        name: p.name,
        unit: p.unit,
        lotNo: "",
        locationCode: locations[0] ?? "",
        counted: "0",
      },
    ]);
  }
  function updateOffLine(i: number, patch: Partial<OffRow>) {
    setOffLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeOffLine(i: number) {
    setOffLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await confirmCountAction({
        pullZone,
        docDate,
        lines: lines.map((l) => ({ lotId: l.id, countedQty: Number(l.counted) || 0 })),
        offSystemLines: offLines.map((l) => ({
          productCode: l.productCode,
          lotNo: l.lotNo,
          locationCode: l.locationCode,
          countedQty: Number(l.counted) || 0,
        })),
      });
      setPopup({ kind: "count", message: `Count ${res.docNo} saved — feeds Inventory Accuracy KPI.` });
      setLines([]);
      setOffLines([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save count.");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    downloadExcel(
      "stock-count-draft.xls",
      "Stock Count",
      ["SAP Material Master", "Material Description", "Lot", "Location", "SysQty", "CountedQty", "Variance"],
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

  function handlePrint() {
    // Blank count sheet: the "Count" column is always empty (to write by hand);
    // the System (on-hand) column is optional.
    const headers = [
      "SAP Material Master",
      "Material Description",
      "Lot",
      "Location",
      ...(printShowSys ? ["System (ระบบ)"] : []),
      "Count (นับจริง)",
    ];
    const rows: (string | number)[][] = lines.map((l) => [
      l.productCode,
      l.name,
      l.lotNo,
      l.locationCode,
      ...(printShowSys ? [l.sysQty.toLocaleString()] : []),
      "      ", // blank space to write the count
    ]);
    printTable({
      title: "Stock Count Sheet (ใบนับสต็อก)",
      meta: [`Pull: ${pullZone}`, `Doc date: ${docDate}`, `${rows.length} lines`],
      headers,
      rows,
      // Long narrow list → portrait + compact fits far more rows per page (ประหยัดกระดาษ).
      orientation: "portrait",
      compact: true,
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] p-[18px_22px]">
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Count No. · auto</div>
            <div className="font-num text-[16px] font-semibold text-[#12a2bb]">next on confirm</div>
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
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">ยอด ณ วันที่ (as-of date)</div>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              title="เว้นว่าง = ยอดปัจจุบัน · ใส่วันที่ = ดึงยอดคงเหลือ ณ สิ้นวันนั้น"
              className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <button onClick={handlePull} disabled={pulling} className={buttonClass("accent")}>
            {pulling ? "Pulling…" : asOfDate ? "⤓ ดึงยอดวันนั้น" : "⤓ Pull lots"}
          </button>
          <div className="flex-1" />
          <button onClick={handleExport} className="flex items-center gap-1.5 rounded-[8px] border border-[#16a6bf] bg-[#e6f5fa] px-3.5 py-2 text-[12.5px] font-semibold text-[#0c7f93]">
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
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
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
                      style={{ color: variance === 0 ? "#12a2bb" : variance > 0 ? "#0e8ba1" : "#d24141" }}
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
              {offLines.map((l, i) => {
                const counted = Number(l.counted) || 0;
                return (
                  <tr key={l.key} className="border-t border-[#eef1f5] bg-[#fff8ec]">
                    <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{l.productCode}</td>
                    <td className="p-[11px_16px] font-medium">
                      {l.name}
                      <span className="ml-1.5 rounded-[5px] bg-[#f4c65a] px-1.5 py-0.5 text-[10px] font-semibold text-[#7a5b00]">
                        นอกระบบ
                      </span>
                    </td>
                    <td className="p-[11px_16px]">
                      <input
                        value={l.lotNo}
                        onChange={(e) => updateOffLine(i, { lotNo: e.target.value })}
                        placeholder="Lot / -"
                        className="font-num w-[110px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                      />
                    </td>
                    <td className="p-[11px_16px]">
                      <select
                        value={l.locationCode}
                        onChange={(e) => updateOffLine(i, { locationCode: e.target.value })}
                        className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                      >
                        {locations.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="font-num p-[11px_16px] text-right text-[#9aa4b4]">0</td>
                    <td className="p-[11px_16px] text-right">
                      <input
                        value={l.counted}
                        onChange={(e) => updateOffLine(i, { counted: e.target.value })}
                        className="font-num w-[84px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                      />
                    </td>
                    <td className="font-num p-[11px_16px] text-right font-semibold text-[#0e8ba1]">
                      +{counted}
                    </td>
                    <td className="p-[11px_16px] text-center">
                      <button onClick={() => removeOffLine(i)} className="text-[16px] text-[#c2606f]">
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && offLines.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[#9aa4b4]">
                    Choose a zone and click &quot;Pull lots&quot;, or add a lot below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#eef1f5] p-[12px_16px] sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchableSelect
              options={available.map((l) => ({
                value: l.id,
                label: `${l.productCode} · ${l.name} · ${l.lotNo} · ${l.locationCode}`,
              }))}
              onSelect={addLine}
              placeholder="+ Add line (เพิ่มรายการ) — พิมพ์ค้นหาสินค้า…"
            />
          </div>
          <div className="flex-1">
            <SearchableSelect
              options={products.map((p) => ({
                value: p.code,
                label: `${p.code} · ${p.name}`,
              }))}
              onSelect={addOffLine}
              placeholder="+ พบของนอกระบบ (found off-system) — พิมพ์ค้นหา…"
              className="w-full rounded-[7px] border border-dashed border-[#e0b64a] bg-[#fff8ec] px-2.5 py-1.5 text-[12.5px] text-[#7a5b00] outline-none focus:border-[#d99e1f]"
            />
          </div>
        </div>

        {error && (
          <div className="border-t border-[#f3d2d2] bg-[#fbe9e9] px-[22px] py-2.5 text-[12.5px] text-[#c53f3f]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-[#eef1f5] bg-[#fafbfc] p-[16px_22px]">
          <div className="text-[12.5px] text-[#69748a]">
            {lines.length + offLines.length} lines
            {offLines.length > 0 && (
              <span className="ml-1 text-[#b8860b]">· {offLines.length} off-system</span>
            )}
          </div>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-[12px] text-[#69748a]" title="แสดงจำนวนในระบบบนใบนับ (ถ้าไม่ติ๊ก = นับแบบไม่เห็นเลขระบบ)">
            <input type="checkbox" checked={printShowSys} onChange={(e) => setPrintShowSys(e.target.checked)} />
            โชว์จำนวนระบบตอนปริ้น
          </label>
          <button
            onClick={handlePrint}
            disabled={lines.length === 0}
            className={buttonClass("secondary")}
          >
            ⎙ Print ใบนับ
          </button>
          <button
            onClick={() => setPopup({ kind: "draft", message: "Draft saved locally (not yet posted)." })}
            className={buttonClass("secondary")}
          >
            Save draft (ร่าง)
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || (lines.length === 0 && offLines.length === 0)}
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

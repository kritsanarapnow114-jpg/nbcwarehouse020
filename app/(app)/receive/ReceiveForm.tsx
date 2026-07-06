"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiveFormData } from "@/lib/views/receive";
import { confirmReceiptAction, ReceiveLineInput } from "@/lib/actions/receive";
import { buttonClass } from "@/components/ui/Button";
import { CuteBoxPopup, CuteBoxKind } from "@/components/ui/CuteBoxPopup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { takeRedo } from "@/lib/redoTemplate";
import { fmtDateISO } from "@/lib/calc/date";

type Line = {
  productCode: string;
  name: string;
  unit: string;
  ordered: number | null;
  recv: string;
  lot: string;
  loc: string;
  mfg: string;
  exp: string;
};

export function ReceiveForm({ data }: { data: ReceiveFormData }) {
  const router = useRouter();
  const [mode, setMode] = useState<"PO" | "PRODUCTION">("PO");
  const [poId, setPoId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [docDate, setDocDate] = useState(fmtDateISO(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
  const [prodLoss, setProdLoss] = useState("20");
  const [bomLossByLine, setBomLossByLine] = useState<Record<string, string>>({});
  const [popup, setPopup] = useState<{ kind: CuteBoxKind; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPo = data.pos.find((p) => p.id === poId) ?? null;

  // Prefill from a "Redo" of a reversed receipt (one-shot, client-only storage).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = takeRedo<{
      mode: "PO" | "PRODUCTION";
      poId: string | null;
      invoiceNo: string;
      lines: Omit<Line, "name" | "unit">[];
    }>("receipt");
    if (!p) return;
    setMode(p.mode);
    setPoId(p.poId ?? "");
    setInvoiceNo(p.invoiceNo ?? "");
    setLines(
      p.lines.map((l) => {
        const prod = data.products.find((x) => x.code === l.productCode);
        return { ...l, name: prod?.name ?? l.productCode, unit: prod?.unit ?? "" };
      })
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.products]);

  function selectPo(id: string) {
    setPoId(id);
    const po = data.pos.find((p) => p.id === id);
    if (po) {
      setLines(
        po.lines
          .filter((l) => l.remaining > 0)
          .map((l) => ({
            productCode: l.productCode,
            name: l.name,
            unit: l.unit,
            ordered: l.remaining,
            recv: String(l.remaining),
            lot: "",
            loc: "",
            mfg: "",
            exp: "",
          }))
      );
    } else {
      setLines([]);
    }
  }

  function addLine(code: string) {
    const p = data.products.find((x) => x.code === code);
    if (!p) return;
    setLines((ls) => [
      ...ls,
      { productCode: p.code, name: p.name, unit: p.unit, ordered: null, recv: "0", lot: "", loc: "", mfg: "", exp: "" },
    ]);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  // Receive the same product across a second lot: clone the line with an empty
  // lot and zero qty right below it, so one PO line can land in multiple lots.
  function splitLine(i: number) {
    setLines((ls) => {
      const src = ls[i];
      const clone: Line = { ...src, ordered: null, recv: "0", lot: "", mfg: "", exp: "" };
      const next = [...ls];
      next.splice(i + 1, 0, clone);
      return next;
    });
  }

  const totalQty = lines.reduce((s, l) => s + (Number(l.recv) || 0), 0);
  const producedTotal = mode === "PRODUCTION" ? totalQty : 0;

  const bom = useMemo(() => {
    if (mode !== "PRODUCTION" || lines.length === 0) return null;
    return data.boms.find((b) => b.finishedProductCode === lines[0].productCode) ?? null;
  }, [mode, lines, data.boms]);

  const yieldPct =
    producedTotal + Number(prodLoss || 0) > 0
      ? (producedTotal / (producedTotal + Number(prodLoss || 0))) * 100
      : 100;

  const bomLossValue = bom
    ? bom.lines.reduce((s, m) => s + (Number(bomLossByLine[m.id] ?? 0) || 0) * m.materialPrice, 0)
    : 0;

  async function handleConfirm() {
    setError(null);

    if (data.locations.length === 0) {
      setError(
        "No storage locations exist yet — add one on the Locations page first (ยังไม่มีที่จัดเก็บ กรุณาเพิ่ม Location ก่อน)"
      );
      return;
    }
    const missingLoc = lines.some((l) => !l.loc);
    if (missingLoc) {
      setError("Every line needs a Location selected (ทุกรายการต้องเลือก Location)");
      return;
    }

    setSaving(true);
    const payload = {
      mode,
      poId: mode === "PO" ? poId || null : null,
      invoiceNo: mode === "PO" ? invoiceNo : null,
      docDate,
      lines: lines.map(
        (l): ReceiveLineInput => ({
          productCode: l.productCode,
          orderedQty: l.ordered,
          recvQty: Number(l.recv) || 0,
          lotNo: l.lot,
          locationCode: l.loc,
          mfgDate: l.mfg || null,
          expDate: l.exp || null,
        })
      ),
      producedTotal: mode === "PRODUCTION" ? producedTotal : undefined,
      prodLoss: mode === "PRODUCTION" ? Number(prodLoss) || 0 : undefined,
      bomLoss:
        mode === "PRODUCTION" && bom
          ? bom.lines.map((m) => ({ bomLineId: m.id, lossQty: Number(bomLossByLine[m.id] ?? 0) || 0 }))
          : undefined,
    };
    try {
      const res = await confirmReceiptAction(payload);
      setPopup({ kind: "in", message: `Receipt ${res.docNo} confirmed — inventory updated.` });
      setLines([]);
      setPoId("");
      setInvoiceNo("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm receipt.");
    } finally {
      setSaving(false);
    }
  }

  function handleDraft() {
    setPopup({ kind: "draft", message: "Draft saved locally (not yet posted to inventory)." });
  }

  return (
    <>
      <div className="mb-4 flex w-fit gap-2 rounded-[11px] bg-[#e5e9ef] p-1">
        <button
          onClick={() => {
            setMode("PO");
            setLines([]);
          }}
          className={`rounded-[9px] px-4 py-2 text-[13px] font-medium ${mode === "PO" ? "bg-white shadow-sm" : "text-[#3a4658]"}`}
        >
          By PO (ตาม PO)
        </button>
        <button
          onClick={() => {
            setMode("PRODUCTION");
            setLines([]);
            setPoId("");
          }}
          className={`rounded-[9px] px-4 py-2 text-[13px] font-medium ${mode === "PRODUCTION" ? "bg-white shadow-sm" : "text-[#3a4658]"}`}
        >
          From Production (จากฝ่ายผลิต)
        </button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] p-[18px_22px]">
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Receipt No. (เลขที่รับ) · auto</div>
            <div className="font-num text-[16px] font-semibold text-[#3E9B6E]">{data.docNo}</div>
          </div>
          <div className="h-[34px] w-px bg-[#e2e6ec]" />
          {mode === "PO" ? (
            <div>
              <div className="mb-1 text-[11.5px] text-[#69748a]">PO Reference (อ้างอิง PO) · optional</div>
              <div className="w-[230px]">
                <SearchableSelect
                  value={
                    poId
                      ? (() => {
                          const p = data.pos.find((x) => x.id === poId);
                          return p ? `${p.no} · ${p.vendor}` : "";
                        })()
                      : "No PO (ไม่ระบุ PO)"
                  }
                  options={[
                    { value: "", label: "No PO (ไม่ระบุ PO)" },
                    ...data.pos.map((p) => ({ value: p.id, label: `${p.no} · ${p.vendor}` })),
                  ]}
                  onSelect={selectPo}
                  placeholder="พิมพ์ค้นหา PO / ผู้ขาย…"
                  className="font-num w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#3E9B6E]"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[11.5px] text-[#69748a]">Source (รับจาก)</div>
              <div className="pt-1 text-[13px] font-medium">PACKING LINE-AREA020</div>
            </div>
          )}
          {mode === "PO" && (
            <>
              <div className="h-[34px] w-px bg-[#e2e6ec]" />
              <div>
                <div className="mb-1 text-[11.5px] text-[#69748a]">Invoice / DO No. (เลขที่ Invoice)</div>
                <input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="INV-2569-…"
                  className="font-num w-[150px] rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
                />
              </div>
            </>
          )}
          <div className="flex-1" />
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Doc date (วันที่เอกสาร)</div>
            <input
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <datalist id="nbLots">
            {data.lotOptions.map((lo) => (
              <option key={lo} value={lo} />
            ))}
          </datalist>
          <table className="w-full min-w-[960px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">
                  {mode === "PO" ? "Ordered (สั่งตาม PO)" : "Produced (จำนวนผลิต)"}
                </th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Received (รับจริง)</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Location</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Mfg</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Expiry</th>
                <th className="w-10 p-[10px_16px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{l.productCode}</td>
                  <td className="p-[11px_16px] font-medium">{l.name}</td>
                  <td className="font-num p-[11px_16px] text-right text-[12.5px] text-[#69748a]">
                    {l.ordered != null ? l.ordered.toLocaleString() : "—"}
                  </td>
                  <td className="p-[11px_16px] text-right">
                    <input
                      value={l.recv}
                      onChange={(e) => updateLine(i, { recv: e.target.value })}
                      className="font-num w-[74px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                    />
                  </td>
                  <td className="p-[11px_16px]">
                    <input
                      value={l.lot}
                      onChange={(e) => updateLine(i, { lot: e.target.value })}
                      list="nbLots"
                      className="font-num w-[118px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                    />
                  </td>
                  <td className="p-[11px_16px]">
                    <select
                      value={l.loc}
                      onChange={(e) => updateLine(i, { loc: e.target.value })}
                      className="font-num w-[84px] rounded-[7px] border border-[#d7dce4] px-1.5 py-1.5 text-[12px]"
                    >
                      <option value="">—</option>
                      {data.locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-[11px_16px]">
                    <input
                      type="date"
                      value={l.mfg}
                      onChange={(e) => updateLine(i, { mfg: e.target.value })}
                      className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1 text-[12px]"
                    />
                  </td>
                  <td className="p-[11px_16px]">
                    <input
                      type="date"
                      value={l.exp}
                      onChange={(e) => updateLine(i, { exp: e.target.value })}
                      className="font-num rounded-[7px] border border-[#d7dce4] px-2 py-1 text-[12px]"
                    />
                  </td>
                  <td className="p-[11px_16px] text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => splitLine(i)}
                        title="รับอีก Lot ของสินค้าตัวนี้ (split into another lot)"
                        className="rounded-[6px] border border-[#cfe6d9] bg-[#eaf7f0] px-1.5 py-0.5 text-[11px] font-semibold text-[#12894f] hover:bg-[#dcf0e6]"
                      >
                        ＋Lot
                      </button>
                      <button onClick={() => removeLine(i)} className="text-[16px] text-[#c2606f]">
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#9aa4b4]">
                    {mode === "PO" && selectedPo
                      ? "This PO has nothing outstanding."
                      : "No lines yet — add a product below."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-[#eef1f5] p-[12px_16px]">
          <SearchableSelect
            options={data.products.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }))}
            onSelect={addLine}
            placeholder="+ Add line (เพิ่มรายการ) — พิมพ์ค้นหาสินค้า…"
          />
        </div>

        {error && (
          <div className="border-t border-[#f3d2d2] bg-[#fbe9e9] px-[22px] py-2.5 text-[12.5px] text-[#c53f3f]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-[#eef1f5] bg-[#fafbfc] p-[16px_22px]">
          <div className="text-[12.5px] text-[#69748a]">
            {lines.length} lines · total received{" "}
            <b className="font-num text-[#16202e]">{totalQty.toLocaleString()}</b>
          </div>
          <div className="flex-1" />
          <button onClick={handleDraft} className={buttonClass("secondary")}>
            Save draft (ร่าง)
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || lines.length === 0}
            className={buttonClass("primary", "!bg-[#17935a]")}
          >
            {saving ? "Saving…" : "Confirm receipt (ยืนยันรับ)"}
          </button>
        </div>
      </div>

      {mode === "PRODUCTION" && bom && (
        <div className="mt-4 overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
          <div className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] p-[16px_22px]">
            <div className="flex-1 text-[14px] font-semibold">
              BOM &amp; Production Loss (สูตรวัตถุดิบ &amp; ของเสีย)
            </div>
            <div className="text-[12px] text-[#69748a]">
              Produced (ผลิตได้): <b className="font-num text-[#16202e]">{producedTotal.toLocaleString()}</b>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[#3a4658]">
              Loss (ของเสีย)
              <input
                value={prodLoss}
                onChange={(e) => setProdLoss(e.target.value)}
                className="font-num w-[70px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
              />
            </label>
            <div className="rounded-[8px] border border-[#cdeadd] bg-[#eaf7f0] px-2.5 py-1.5 text-[12px] text-[#69748a]">
              Yield → Quality KPI: <b className="font-num text-[#12894f]">{yieldPct.toFixed(1)}%</b>
            </div>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_22px] text-[11.5px] font-medium">Material used (วัตถุดิบที่ใช้)</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Per unit (ต่อหน่วย)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Consumed (ใช้ไป)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Loss / scrap (เสีย)</th>
              </tr>
            </thead>
            <tbody>
              {bom.lines.map((m) => (
                <tr key={m.id} className="border-t border-[#eef1f5]">
                  <td className="p-[10px_22px] font-medium">{m.materialName}</td>
                  <td className="font-num p-[10px_16px] text-[12px] text-[#3a4658]">{m.materialCode}</td>
                  <td className="font-num p-[10px_16px] text-right text-[#69748a]">
                    {m.qtyPerUnit} {m.unit}
                  </td>
                  <td className="font-num p-[10px_16px] text-right">
                    {(m.qtyPerUnit * producedTotal).toLocaleString()}
                  </td>
                  <td className="p-[10px_16px] text-right">
                    <input
                      value={bomLossByLine[m.id] ?? ""}
                      onChange={(e) => setBomLossByLine((s) => ({ ...s, [m.id]: e.target.value }))}
                      placeholder="0"
                      className="font-num w-[72px] rounded-[7px] border border-[#d7dce4] px-2 py-1 text-right text-[12.5px]"
                    />{" "}
                    <span className="text-[11px] text-[#9aa4b4]">{m.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 border-t border-[#eef1f5] bg-[#fdf6f6] p-[12px_22px]">
            <span className="text-[15px]">▼</span>
            <div className="flex-1 text-[12.5px] text-[#a34141]">
              Packaging / material loss value this run (มูลค่าของเสียจากบรรจุภัณฑ์)
            </div>
            <div className="font-num text-[16px] font-bold text-[#d24141]">
              ฿{Math.round(bomLossValue).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {popup && (
        <CuteBoxPopup open kind={popup.kind} message={popup.message} onClose={() => setPopup(null)} />
      )}
    </>
  );
}

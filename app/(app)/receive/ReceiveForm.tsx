"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReceiveFormData } from "@/lib/views/receive";
import { confirmReceiptAction, ReceiveLineInput } from "@/lib/actions/receive";
import { buttonClass } from "@/components/ui/Button";
import { CuteBoxPopup, CuteBoxKind } from "@/components/ui/CuteBoxPopup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { OeeProdCapture, ProdDowntime, ProdQualityLoss } from "./OeeProdCapture";
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
  weight: string;
  su: string;
  time: string;
  palletFull: boolean;
  stockType: "STOCK" | "NON_STOCK";
};

export function ReceiveForm({
  data,
  lockMode,
}: {
  data: ReceiveFormData;
  lockMode?: "PO" | "PRODUCTION";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"PO" | "PRODUCTION">(lockMode ?? "PO");
  const [poId, setPoId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [materialDoc, setMaterialDoc] = useState("");
  const [remark, setRemark] = useState("");
  const [stockType, setStockType] = useState<"STOCK" | "NON_STOCK">("STOCK");
  const [docDate, setDocDate] = useState(fmtDateISO(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
  const [prodLoss, setProdLoss] = useState("20");
  // Production: one Lot / Mfg / Expiry shared by every pallet (typed once).
  const [prodLot, setProdLot] = useState("");
  const [prodMfg, setProdMfg] = useState("");
  const [prodExp, setProdExp] = useState("");
  const [bomLossByLine, setBomLossByLine] = useState<Record<string, string>>({});
  // BOM material lines the operator marks as "reused" — not deducted this run.
  const [bomExclude, setBomExclude] = useState<Record<string, boolean>>({});
  const [popup, setPopup] = useState<{ kind: CuteBoxKind; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OEE capture (production only) — line "" means "don't score this run".
  const [oeeLine, setOeeLine] = useState("");
  const [oeePlannedMin, setOeePlannedMin] = useState("");
  const [oeeBreakMin, setOeeBreakMin] = useState("");
  const [oeeDowntimes, setOeeDowntimes] = useState<ProdDowntime[]>([]);
  const [oeeQualityLosses, setOeeQualityLosses] = useState<ProdQualityLoss[]>([]);
  const [oeeRepack, setOeeRepack] = useState("");
  const [oeeScrap, setOeeScrap] = useState("");

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
    if (lockMode && p.mode !== lockMode) return;
    setMode(lockMode ?? p.mode);
    setPoId(p.poId ?? "");
    setInvoiceNo(p.invoiceNo ?? "");
    setLines(
      p.lines.map((l) => {
        const prod = data.products.find((x) => x.code === l.productCode);
        return { ...l, name: prod?.name ?? l.productCode, unit: prod?.unit ?? "", weight: "", su: "", time: "", palletFull: true, stockType: "STOCK" as const };
      })
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.products, lockMode]);

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
            weight: "",
            su: "",
            time: "",
            palletFull: true,
            stockType,
          }))
      );
    } else {
      setLines([]);
    }
  }

  // Next SU = one past the highest SU already on the sheet, else the system's next.
  function nextSu(ls: Line[]): number {
    const nums = ls.map((x) => Number(x.su)).filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? Math.max(...nums) + 1 : data.nextSuNo;
  }

  function addLine(code: string) {
    const p = data.products.find((x) => x.code === code);
    if (!p) return;
    setLines((ls) => {
      // Production SU continues from the highest SU already on the sheet (+1), no
      // matter which row it's added from; seed from the system's next number when
      // the sheet is empty. Still editable.
      const su = mode === "PRODUCTION" ? String(nextSu(ls)) : "";
      return [
        ...ls,
        { productCode: p.code, name: p.name, unit: p.unit, ordered: null, recv: "0", lot: "", loc: "", mfg: "", exp: "", weight: "", su, time: "", palletFull: true, stockType },
      ];
    });
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
      // SU continues from the highest on the sheet (+1), whichever row you split from.
      const su = mode === "PRODUCTION" ? String(nextSu(ls)) : "";
      const clone: Line = { ...src, ordered: null, recv: "0", lot: "", mfg: "", exp: "", weight: "", su };
      const next = [...ls];
      next.splice(i + 1, 0, clone);
      return next;
    });
  }

  // Add one more pallet of the same product (production) — the single top "+"
  // button. Clones the last row with the next SU, blank weight/time.
  function addPalletRow() {
    setLines((ls) => {
      if (ls.length === 0) return ls;
      const src = ls[ls.length - 1];
      const clone: Line = { ...src, recv: "0", weight: "", time: "", su: String(nextSu(ls)), palletFull: true };
      return [...ls, clone];
    });
  }

  // A Full pallet is received as the product's standard pallet size (whatever the
  // scale reads); a Partial pallet is received as its actual weighed weight.
  const palletSizeOf = (code: string) => data.products.find((p) => p.code === code)?.pallet ?? 0;
  const effectiveQty = (l: Line) => {
    const w = Number(l.weight) || 0;
    return l.palletFull ? palletSizeOf(l.productCode) || w : w;
  };
  const totalQty = lines.reduce((s, l) => s + (Number(l.recv) || 0), 0);
  const producedTotal = mode === "PRODUCTION" ? lines.reduce((s, l) => s + effectiveQty(l), 0) : 0;

  const bom = useMemo(() => {
    if (mode !== "PRODUCTION" || lines.length === 0) return null;
    return data.boms.find((b) => b.finishedProductCode === lines[0].productCode) ?? null;
  }, [mode, lines, data.boms]);

  const yieldPct =
    producedTotal + Number(prodLoss || 0) > 0
      ? (producedTotal / (producedTotal + Number(prodLoss || 0))) * 100
      : 100;

  const bomLossValue = bom
    ? bom.lines.reduce(
        (s, m) => (bomExclude[m.id] ? s : s + (Number(bomLossByLine[m.id] ?? 0) || 0) * m.materialPrice),
        0
      )
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

    // Production must record OEE before it's sent for verification.
    if (mode === "PRODUCTION") {
      if (!oeeLine) {
        setError("กรุณาบันทึก OEE — เลือกสายผลิตในการ์ด OEE ก่อนส่งตรวจสอบ");
        return;
      }
      if (!(Number(oeePlannedMin) > 0)) {
        setError("กรุณาใส่เวลาวางแผนเดินเครื่อง (OEE) ก่อนส่งตรวจสอบ");
        return;
      }
    }

    setSaving(true);
    const payload = {
      mode,
      poId: mode === "PO" ? poId || null : null,
      invoiceNo: mode === "PO" ? invoiceNo : null,
      materialDoc: materialDoc || null,
      remark: remark || null,
      stockType,
      docDate,
      lines: lines.map((l): ReceiveLineInput => {
        const isProd = mode === "PRODUCTION";
        const weight = l.weight ? Number(l.weight) || 0 : 0;
        return {
          productCode: l.productCode,
          orderedQty: l.ordered,
          // Production: Full pallet → standard pallet size; Partial → actual weight.
          recvQty: isProd ? effectiveQty(l) : Number(l.recv) || 0,
          // Production: one shared Lot / Mfg / Expiry for every pallet.
          lotNo: isProd ? prodLot : l.lot,
          locationCode: l.loc,
          mfgDate: isProd ? prodMfg || null : l.mfg || null,
          expDate: isProd ? prodExp || null : l.exp || null,
          weightKg: weight || null,
          suNo: l.su ? Number(l.su) || null : null,
          palletFull: isProd ? l.palletFull : null,
          packTime: isProd ? l.time || null : null,
          stockType: l.stockType,
        };
      }),
      producedTotal: mode === "PRODUCTION" ? producedTotal : undefined,
      prodLoss: mode === "PRODUCTION" ? Number(prodLoss) || 0 : undefined,
      bomLoss:
        mode === "PRODUCTION" && bom
          ? bom.lines
              .filter((m) => !bomExclude[m.id])
              .map((m) => ({ bomLineId: m.id, lossQty: Number(bomLossByLine[m.id] ?? 0) || 0 }))
          : undefined,
      excludeBomLineIds:
        mode === "PRODUCTION" && bom
          ? bom.lines.filter((m) => bomExclude[m.id]).map((m) => m.id)
          : undefined,
      oeeLine: mode === "PRODUCTION" ? oeeLine || null : null,
      plannedMin: mode === "PRODUCTION" && oeeLine ? Number(oeePlannedMin) || 0 : null,
      breakMin: mode === "PRODUCTION" && oeeLine ? Number(oeeBreakMin) || 0 : null,
      downtime: mode === "PRODUCTION" && oeeLine ? oeeDowntimes : undefined,
      oeeQuality:
        mode === "PRODUCTION" && oeeLine
          ? {
              repack: Number(oeeRepack) || 0,
              scrap: Number(oeeScrap) || 0,
              losses: oeeQualityLosses,
            }
          : undefined,
    };
    try {
      const res = await confirmReceiptAction(payload);
      if (res.error) {
        setError(res.error);
      } else {
        setPopup({
          kind: "in",
          message:
            mode === "PRODUCTION"
              ? `ส่งแล้ว ${res.docNo} — รอตรวจสอบก่อนเข้าสต็อก (ดูรายการด้านล่าง)`
              : `Receipt ${res.docNo} confirmed — inventory updated.`,
        });
        setLines([]);
        setPoId("");
        setInvoiceNo("");
        setMaterialDoc("");
        setRemark("");
        setProdLot("");
        setProdMfg("");
        setProdExp("");
        setOeeLine("");
        setOeePlannedMin("");
        setOeeBreakMin("");
        setOeeDowntimes([]);
        setOeeQualityLosses([]);
        setOeeRepack("");
        setOeeScrap("");
        router.refresh();
      }
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
      {!lockMode && (
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
      )}

      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] p-[18px_22px]">
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Receipt No. (เลขที่รับ) · auto</div>
            <div className="font-num text-[16px] font-semibold text-[#2f86cf]">{data.docNo}</div>
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
                  className="font-num w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#2f86cf]"
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
          <div className="h-[34px] w-px bg-[#e2e6ec]" />
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">ประเภทเริ่มต้น · ตั้งทุกบรรทัด</div>
            <div className="flex gap-1.5">
              {(["STOCK", "NON_STOCK"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setStockType(t);
                    setLines((ls) => ls.map((l) => ({ ...l, stockType: t })));
                  }}
                  className={`rounded-[8px] border px-2.5 py-1.5 text-[12px] font-semibold ${
                    stockType === t
                      ? t === "NON_STOCK"
                        ? "border-[#d8c48f] bg-[#efe6d3] text-[#8a6d1f]"
                        : "border-[#a8cdea] bg-[#dcecf6] text-[#1f66a6]"
                      : "border-[#d7dce4] bg-white text-[#69748a] hover:bg-[#f2f6f9]"
                  }`}
                >
                  {t === "NON_STOCK" ? "Non-Stock" : "Stock"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[34px] w-px bg-[#e2e6ec]" />
          <div>
            <div className="mb-1 text-[11.5px] text-[#69748a]">Material Document (SAP)</div>
            <input
              value={materialDoc}
              onChange={(e) => setMaterialDoc(e.target.value)}
              placeholder="เลขที่จาก SAP"
              className="font-num w-[150px] rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <div className="mb-1 text-[11.5px] text-[#69748a]">Remark (หมายเหตุ)</div>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม"
              className="w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
            />
          </div>
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

        {mode === "PRODUCTION" && (
          <div className="flex flex-wrap items-end gap-4 border-b border-[#eef1f5] bg-[#f8fafc] p-[12px_22px]">
            <div className="text-[12px] font-semibold text-[#3a4658]">
              ล็อต/วันที่ (ใช้ร่วมทุกพาเลท):
            </div>
            <div>
              <div className="mb-1 text-[11.5px] text-[#69748a]">Lot (ล็อต)</div>
              <input
                value={prodLot}
                onChange={(e) => setProdLot(e.target.value)}
                list="nbLots"
                placeholder="เลขล็อตการผลิต"
                className="font-num w-[170px] rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] text-[#69748a]">Mfg (วันผลิต)</div>
              <input
                type="date"
                value={prodMfg}
                onChange={(e) => setProdMfg(e.target.value)}
                className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] text-[#69748a]">Expiry (วันหมดอายุ)</div>
              <input
                type="date"
                value={prodExp}
                onChange={(e) => setProdExp(e.target.value)}
                className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-1.5 text-[13px]"
              />
            </div>
            <div className="text-[11.5px] text-[#9aa4b4]">
              ดูจากเอกสารการผลิต · แต่ละแถว = 1 พาเลท (คีย์ SU + น้ำหนัก + เวลา)
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={addPalletRow}
              disabled={lines.length === 0}
              title={lines.length === 0 ? "เพิ่มสินค้าด้วย + Add line ด้านล่างก่อน" : "เพิ่มอีก 1 พาเลท (SU ถัดไป)"}
              className="rounded-[9px] bg-[#1f9d63] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#178150] disabled:bg-[#a9d3bd]"
            >
              ＋ เพิ่มพาเลท
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <datalist id="nbLots">
            {data.lotOptions.map((lo) => (
              <option key={lo} value={lo} />
            ))}
          </datalist>
          <datalist id="nbLocs">
            {data.locations.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
          <table className="w-full min-w-[960px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                {mode === "PRODUCTION" ? (
                  <>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">SU</th>
                    <th className="p-[10px_16px] text-right text-[11.5px] font-medium">น้ำหนักชั่งจริง (กก.)</th>
                    <th className="p-[10px_16px] text-right text-[11.5px] font-medium">รับเข้า (กก.)</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">Location</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">พาเลท</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">เวลา (24 ชม.)</th>
                  </>
                ) : (
                  <>
                    <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Ordered (สั่งตาม PO)</th>
                    <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Received (รับจริง)</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">Location</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">Mfg</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">Expiry</th>
                    <th className="p-[10px_16px] text-[11.5px] font-medium">Type</th>
                  </>
                )}
                <th className="w-10 p-[10px_16px]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{l.productCode}</td>
                  <td className="p-[11px_16px] font-medium">{l.name}</td>
                  {mode === "PRODUCTION" ? (
                    <>
                      <td className="p-[11px_16px]">
                        <input
                          value={l.su}
                          onChange={(e) => updateLine(i, { su: e.target.value })}
                          placeholder="SU"
                          className="font-num w-[80px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[13px] font-semibold text-[#8a6d1f]"
                        />
                      </td>
                      <td className="p-[11px_16px] text-right">
                        <input
                          value={l.weight}
                          onChange={(e) => updateLine(i, { weight: e.target.value })}
                          placeholder="กก."
                          className="font-num w-[96px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-right text-[13px]"
                        />
                      </td>
                      <td className="font-num p-[11px_16px] text-right text-[13px] font-semibold text-[#177a4a]">
                        {effectiveQty(l).toLocaleString()}
                        {l.palletFull && palletSizeOf(l.productCode) > 0 && (
                          <span className="ml-1 text-[10px] font-normal text-[#9aa4b4]">(พาเลทเต็ม)</span>
                        )}
                      </td>
                      <td className="p-[11px_16px]">
                        <input
                          value={l.loc}
                          onChange={(e) => updateLine(i, { loc: e.target.value })}
                          list="nbLocs"
                          placeholder="พิมพ์/เลือก"
                          className="font-num w-[100px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                        />
                      </td>
                      <td className="p-[11px_16px]">
                        <button
                          type="button"
                          onClick={() => updateLine(i, { palletFull: !l.palletFull })}
                          title="กดสลับ Full / Partial (พาเลทเต็ม/ไม่เต็ม)"
                          className={`rounded-[7px] border px-2.5 py-1 text-[11px] font-semibold ${
                            l.palletFull
                              ? "border-[#a8d9bd] bg-[#e2f0e8] text-[#177a4a]"
                              : "border-[#e0c08a] bg-[#faf0dc] text-[#9a6a12]"
                          }`}
                        >
                          {l.palletFull ? "Full" : "Partial"}
                        </button>
                      </td>
                      <td className="p-[11px_16px]">
                        <input
                          value={l.time}
                          onChange={(e) => updateLine(i, { time: e.target.value })}
                          inputMode="numeric"
                          maxLength={5}
                          placeholder="00:00"
                          title="เวลาที่พาเลทเสร็จ แบบ 24 ชม. (00:00–23:59)"
                          className="font-num w-[72px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-center text-[13px]"
                        />
                      </td>
                    </>
                  ) : (
                    <>
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
                        <input
                          value={l.loc}
                          onChange={(e) => updateLine(i, { loc: e.target.value })}
                          list="nbLocs"
                          placeholder="พิมพ์/เลือก"
                          className="font-num w-[100px] rounded-[7px] border border-[#d7dce4] px-2 py-1.5 text-[12px]"
                        />
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
                      <td className="p-[11px_16px]">
                        <button
                          type="button"
                          onClick={() => updateLine(i, { stockType: l.stockType === "STOCK" ? "NON_STOCK" : "STOCK" })}
                          title="กดสลับ Stock / Non-Stock"
                          className={`rounded-[7px] border px-2 py-1 text-[11px] font-semibold ${
                            l.stockType === "NON_STOCK"
                              ? "border-[#d8c48f] bg-[#efe6d3] text-[#8a6d1f]"
                              : "border-[#a8cdea] bg-[#dcecf6] text-[#1f66a6]"
                          }`}
                        >
                          {l.stockType === "NON_STOCK" ? "Non-Stock" : "Stock"}
                        </button>
                      </td>
                    </>
                  )}
                  <td className="p-[11px_16px] text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {mode !== "PRODUCTION" && (
                        <button
                          onClick={() => splitLine(i)}
                          title="รับอีก Lot ของสินค้าตัวนี้ (split into another lot)"
                          className="rounded-[6px] border border-[#cfe6d9] bg-[#e8f2fb] px-2 py-0.5 text-[13px] font-semibold text-[#0c7f93] hover:bg-[#d6eef4]"
                        >
                          ＋Lot
                        </button>
                      )}
                      <button onClick={() => removeLine(i)} className="text-[16px] text-[#c2606f]">
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={mode === "PRODUCTION" ? 9 : 10} className="p-6 text-center text-[#9aa4b4]">
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
            className={buttonClass("primary", "!bg-[#1f66a6]")}
          >
            {saving ? "Saving…" : "Confirm receipt (ยืนยันรับ)"}
          </button>
        </div>
      </div>

      {mode === "PRODUCTION" && (
        <OeeProdCapture
          prodLines={data.prodLines}
          standards={data.oeeStandards}
          line={oeeLine}
          onLine={setOeeLine}
          plannedMin={oeePlannedMin}
          onPlannedMin={setOeePlannedMin}
          breakMin={oeeBreakMin}
          onBreakMin={setOeeBreakMin}
          downtimes={oeeDowntimes}
          onDowntimes={setOeeDowntimes}
          qualityLosses={oeeQualityLosses}
          onQualityLosses={setOeeQualityLosses}
          repack={oeeRepack}
          onRepack={setOeeRepack}
          scrap={oeeScrap}
          onScrap={setOeeScrap}
          produced={producedTotal}
          loss={Number(prodLoss) || 0}
        />
      )}

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
            <div className="rounded-[8px] border border-[#cfe4f6] bg-[#e8f2fb] px-2.5 py-1.5 text-[12px] text-[#69748a]">
              Yield → Quality KPI: <b className="font-num text-[#0c7f93]">{yieldPct.toFixed(1)}%</b>
            </div>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_22px] text-[11.5px] font-medium">Material used (วัตถุดิบที่ใช้)</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Per unit (ต่อหน่วย)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Consumed (ใช้ไป)</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot ที่จะตัด (FIFO)</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Loss / scrap (เสีย)</th>
              </tr>
            </thead>
            <tbody>
              {bom.lines.map((m) => {
                const off = !!bomExclude[m.id];
                return (
                <tr key={m.id} className={`border-t border-[#eef1f5] ${off ? "bg-[#f4f6f9] text-[#9aa4b4]" : ""}`}>
                  <td className="p-[10px_22px] font-medium">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={(e) => setBomExclude((s) => ({ ...s, [m.id]: !e.target.checked }))}
                        title="ติ๊กออก = ไม่ตัดสต็อกวัตถุดิบนี้ (ใช้ของ Reuse)"
                      />
                      <span>{m.materialName}</span>
                    </label>
                  </td>
                  <td className="font-num p-[10px_16px] text-[12px] text-[#3a4658]">{m.materialCode}</td>
                  <td className="font-num p-[10px_16px] text-right text-[#69748a]">
                    {m.qtyPerUnit} {m.unit}
                    {m.perQty > 1 && (
                      <span className="text-[10.5px] text-[#9aa4b4]"> / {m.perQty.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="font-num p-[10px_16px] text-right">
                    {off
                      ? "— Reuse —"
                      : (Math.floor(producedTotal / (m.perQty > 0 ? m.perQty : 1)) * m.qtyPerUnit).toLocaleString()}
                  </td>
                  <td className="p-[10px_16px] text-[11.5px]">
                    {off ? (
                      <span className="text-[#9aa4b4]">ไม่ตัดสต็อก (Reuse)</span>
                    ) : (() => {
                      const need =
                        Math.floor(producedTotal / (m.perQty > 0 ? m.perQty : 1)) * m.qtyPerUnit +
                        (Number(bomLossByLine[m.id] ?? 0) || 0);
                      if (need <= 0) return <span className="text-[#9aa4b4]">—</span>;
                      let rem = need;
                      const picks: { lotNo: string; take: number; loc: string }[] = [];
                      for (const lot of m.lots) {
                        if (rem <= 0) break;
                        const take = Math.min(lot.qty, rem);
                        picks.push({ lotNo: lot.lotNo, take, loc: lot.locationCode });
                        rem -= take;
                      }
                      return (
                        <div className="flex flex-col gap-0.5">
                          {picks.map((p, idx) => (
                            <span key={idx} className="font-num text-[#3a4658]">
                              <span className="text-[#0c7f93]">{p.lotNo || "-"}</span>
                              <span className="text-[#9aa4b4]"> ·{p.loc}</span> ×{p.take.toLocaleString()}
                            </span>
                          ))}
                          {rem > 0 && (
                            <span className="font-num text-[#c53f3f]">ขาด {rem.toLocaleString()} (สต็อกไม่พอ)</span>
                          )}
                        </div>
                      );
                    })()}
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
                );
              })}
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

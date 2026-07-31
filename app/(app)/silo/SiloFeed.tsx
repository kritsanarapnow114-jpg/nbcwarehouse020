"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { stageForSiloAction, loadSiloAction, deleteStagingAction } from "@/lib/actions/silo";
import type { SiloFormData, StagingRow, SiloBag, LoadHistoryRow } from "@/lib/views/silo";

const MACHINES = ["Super Sack Unloading", "Box Unloading", "EBS Unloading"];

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmtDateBE(d)} · ${hm}`;
}
function hm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type StageProduct = SiloFormData["products"][number];

export function SiloFeed({
  data,
  staging,
  history,
}: {
  data: SiloFormData;
  staging: StagingRow[];
  history: LoadHistoryRow[];
}) {
  const router = useRouter();

  // ── Stage form: FEFO-aware issue → "waiting to load" ─────────────────────
  const [prod, setProd] = useState<StageProduct | null>(null);
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [stagedBy, setStagedBy] = useState("");
  const [date, setDate] = useState(fmtDateISO(new Date()));
  const [staging0, setStaging0] = useState(false);
  const [stageErr, setStageErr] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const selLot = prod?.lots.find((l) => l.id === lotId) || null;

  function pickProduct(code: string) {
    const p = data.products.find((x) => x.code === code) || null;
    setProd(p);
    if (p) {
      const fefo = p.lots.find((l) => l.isFefo) ?? p.lots[0];
      setLotId(fefo?.id ?? "");
      setQty(String(fefo?.qty ?? 0));
    }
    setStageErr(null);
  }

  function resetStage() {
    setProd(null);
    setLotId("");
    setQty("");
    setStageErr(null);
    setPickerKey((k) => k + 1);
  }

  async function submitStage() {
    setStaging0(true);
    setStageErr(null);
    const res = await stageForSiloAction({ lotId, qty: Number(qty) || 0, stagedBy: stagedBy || null, docDate: date });
    setStaging0(false);
    if (res.error) {
      setStageErr(res.error);
      return;
    }
    showToast(`เบิกไปรอโหลดแล้ว · ${res.docNo}`);
    resetStage();
    router.refresh();
  }

  // ── Load a single bag ────────────────────────────────────────────────────
  const [loadTarget, setLoadTarget] = useState<{ s: StagingRow; bag: SiloBag } | null>(null);
  const [machine, setMachine] = useState("");
  const [silo, setSilo] = useState("");
  const [operator, setOperator] = useState("");
  const [loadDate, setLoadDate] = useState(fmtDateISO(new Date()));
  const [loadTime, setLoadTime] = useState(nowHM());
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openLoad(s: StagingRow, bag: SiloBag) {
    setLoadTarget({ s, bag });
    setMachine("");
    setSilo("");
    setOperator("");
    setLoadDate(fmtDateISO(new Date()));
    setLoadTime(nowHM());
    setLoadErr(null);
  }

  async function submitLoad() {
    if (!loadTarget) return;
    setLoading(true);
    setLoadErr(null);
    const res = await loadSiloAction({
      stagingId: loadTarget.s.id,
      bagNo: loadTarget.bag.bagNo,
      qty: loadTarget.bag.size,
      machine: machine || null,
      silo: silo || null,
      operator: operator || null,
      loadedAt: `${loadDate}T${loadTime || "00:00"}`,
    });
    setLoading(false);
    if (res.error) {
      setLoadErr(res.error);
      return;
    }
    showToast(`บันทึกการโหลด ถุงที่ ${loadTarget.bag.bagNo} แล้ว`);
    setLoadTarget(null);
    router.refresh();
  }

  // ── Delete a whole staging (returns the stock) ───────────────────────────
  const [deleting, setDeleting] = useState<string | null>(null);
  async function removeStaging(s: StagingRow) {
    if (
      !window.confirm(
        `ลบรายการ ${s.docNo}?\n${s.name} · ล็อต ${s.lotNo} · ${s.qtyStaged.toLocaleString()} ${s.unit}\n\nระบบจะคืนของกลับเข้าสต็อก และลบประวัติการโหลดของรายการนี้ทั้งหมด`
      )
    )
      return;
    setDeleting(s.id);
    const res = await deleteStagingAction({ id: s.id });
    setDeleting(null);
    if (res.error) {
      showToast(res.error);
      return;
    }
    showToast(`ลบและคืนของเข้าสต็อกแล้ว · ${s.docNo}`);
    router.refresh();
  }

  const activeProds = data.products.filter((p) => p.lots.length > 0);

  return (
    <>
      {/* Stage: FEFO-aware issue → waiting to load */}
      <Card className="mb-4">
        <CardTitle>เบิกไปรอโหลด SILO (issue → รอโหลด)</CardTitle>
        <div className="mb-3 rounded-[10px] border border-[#dbe7f2] bg-[#eef4f9] px-3 py-2.5 text-[12px] text-[#1f66a6]">
          เลือกสินค้า — ระบบจะเลือกล็อต <b>FEFO (หมดอายุก่อน–ออกก่อน)</b> ให้อัตโนมัติ (เปลี่ยนล็อตเองได้) แล้ว
          <b>จ่ายออกจากสต็อกทันที</b> (มีผลใน Stock Card) และย้ายมาที่ “รอโหลด” — ระบบจะแตกเป็น<b>ถุงตามขนาดพาเลท</b>
          ให้คนโหลดกดโหลดทีละถุง พร้อมบันทึกเวลา/เครื่อง/SILO
        </div>
        <div className="mb-3">
          <span className="mb-1 block text-[11.5px] font-medium text-[#69748a]">สินค้า (เลือกแล้วได้ล็อต FEFO อัตโนมัติ)</span>
          <SearchableSelect
            key={pickerKey}
            options={activeProds.map((p) => ({ value: p.code, label: `${p.code} · ${p.name}` }))}
            onSelect={pickProduct}
            placeholder="พิมพ์ค้นหาสินค้า…"
          />
        </div>
        {prod && (
          <div className="flex flex-wrap items-end gap-3 rounded-[10px] bg-[#f7f9fb] p-3">
            <div className="min-w-[280px] flex-1">
              <span className="mb-1 block text-[11.5px] font-medium text-[#69748a]">ล็อต (★ = FEFO)</span>
              <select
                value={lotId}
                onChange={(e) => {
                  setLotId(e.target.value);
                  const l = prod.lots.find((x) => x.id === e.target.value);
                  if (l) setQty(String(l.qty));
                }}
                className="font-num w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[12.5px] outline-none focus:border-[#2f86cf]"
              >
                {prod.lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lotNo} · {l.locationCode} · {l.expDate ? fmtDateBE(new Date(l.expDate)) : "no exp"} ·{" "}
                    {l.qty.toLocaleString()} {prod.unit}
                    {l.isFefo ? " ★FEFO" : ""}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex w-[140px] flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#69748a]">จำนวนที่เบิก</span>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
              />
            </label>
            <label className="flex w-[160px] flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#69748a]">ผู้เบิก</span>
              <input
                list="silo-operators"
                value={stagedBy}
                onChange={(e) => setStagedBy(e.target.value)}
                className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
                placeholder="ชื่อผู้เบิก"
              />
            </label>
            <label className="flex w-[150px] flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#69748a]">วันที่เบิก</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
              />
            </label>
            <button
              onClick={submitStage}
              disabled={staging0 || !lotId || !(Number(qty) > 0)}
              className="rounded-[8px] bg-[#2f86cf] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1f66a6] disabled:opacity-50"
            >
              {staging0 ? "กำลังเบิก…" : "เบิกไปรอโหลด →"}
            </button>
            <button onClick={resetStage} className={buttonClass("secondary")}>
              ล้าง
            </button>
            {selLot && prod.pallet > 0 && Number(qty) > 0 && (
              <div className="w-full text-[11.5px] text-[#69748a]">
                จะแตกเป็น <b className="font-num text-[#1f66a6]">{Math.floor(Number(qty) / prod.pallet)}</b> ถุงเต็ม (
                {prod.pallet.toLocaleString()} {prod.unit}/ถุง)
                {Number(qty) % prod.pallet > 0.0001 && (
                  <>
                    {" "}
                    + partial <b className="font-num text-[#b5790f]">{(Number(qty) % prod.pallet).toLocaleString()}</b> {prod.unit}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {stageErr && (
          <div className="mt-2 rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">{stageErr}</div>
        )}
        <datalist id="silo-operators">
          {data.operators.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Card>

      {/* Staged items: each broken into bags to load one at a time */}
      <Card>
        <CardTitle>รายการเบิก SILO — โหลดทีละถุง (staged · load per bag)</CardTitle>
        <div className="flex flex-col gap-3">
          {staging.map((s) => {
            const loadedBags = s.bags.filter((b) => b.loaded).length;
            const allDone = s.remaining <= 0.0001;
            return (
              <div
                key={s.id}
                className="rounded-[12px] border border-[#e7ebf1] p-3"
                style={{ background: allDone ? "#f6faf7" : "#ffffff" }}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-num text-[13px] font-semibold text-[#2f86cf]">{s.docNo}</span>
                  <span className="font-num text-[12px] text-[#3a4658]">{s.productCode}</span>
                  <span className="text-[13px] font-medium">{s.name}</span>
                  <span className="font-num text-[12px] text-[#69748a]">
                    Lot {s.lotNo} · จาก {s.sourceLoc}
                  </span>
                  <span className="font-num text-[12px] text-[#69748a]">
                    เบิก <b className="text-[#3a4658]">{s.qtyStaged.toLocaleString()}</b> · โหลดแล้ว{" "}
                    <b className="text-[#1f9d63]">{s.qtyLoaded.toLocaleString()}</b> · เหลือ{" "}
                    <b className="text-[#b5790f]">{s.remaining.toLocaleString()}</b> {s.unit}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {allDone && (
                      <span className="rounded-full bg-[#e4f4ea] px-2 py-0.5 text-[10.5px] font-semibold text-[#178050]">
                        โหลดครบแล้ว
                      </span>
                    )}
                    <button
                      onClick={() => removeStaging(s)}
                      disabled={deleting === s.id}
                      className="rounded-[7px] border border-[#e6c9c9] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#b5484f] hover:bg-[#fdf3f3] disabled:opacity-50"
                      title="ลบรายการนี้ + คืนของเข้าสต็อก + ลบประวัติการโหลด"
                    >
                      {deleting === s.id ? "กำลังลบ…" : "ลบ / คืนของ"}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.bags.map((b) =>
                    b.loaded ? (
                      <span
                        key={b.bagNo}
                        title={
                          b.load
                            ? `${b.load.qty.toLocaleString()} ${s.unit} · ${fmtDateTime(b.load.loadedAt)}` +
                              (b.load.machine ? ` · เครื่อง ${b.load.machine}` : "") +
                              (b.load.silo ? ` · SILO ${b.load.silo}` : "") +
                              (b.load.operator ? ` · ${b.load.operator}` : "")
                            : ""
                        }
                        className="inline-flex items-center gap-1 rounded-[7px] border border-[#bfe3cd] bg-[#e9f6ee] px-2 py-1 text-[11px] font-medium text-[#178050]"
                      >
                        ✓ ถุง {b.bagNo}
                        {b.isPartial && <span className="text-[#b5790f]">(partial)</span>}
                        <span className="font-num">· {b.size.toLocaleString()}</span>
                        {b.load && <span className="font-num text-[#5b6473]">· {hm(b.load.loadedAt)}</span>}
                      </span>
                    ) : (
                      <button
                        key={b.bagNo}
                        onClick={() => openLoad(s, b)}
                        className="inline-flex items-center gap-1 rounded-[7px] border border-[#c9e0c9] bg-white px-2 py-1 text-[11px] font-semibold text-[#1f9d63] hover:bg-[#f0f9f2]"
                      >
                        ▶ ถุง {b.bagNo}
                        {b.isPartial && <span className="text-[#b5790f]">(partial)</span>}
                        <span className="font-num">· {b.size.toLocaleString()} {s.unit}</span>
                      </button>
                    )
                  )}
                </div>
                {s.bags.length > 0 && (
                  <div className="mt-1.5 text-[10.5px] text-[#9aa4b4]">
                    โหลดแล้ว {loadedBags}/{s.bags.length} ถุง
                  </div>
                )}
              </div>
            );
          })}
          {staging.length === 0 && (
            <div className="p-6 text-center text-[#9aa4b4]">ไม่มีรายการรอโหลด (nothing staged)</div>
          )}
        </div>
      </Card>

      {/* Load history */}
      <Card className="mt-4">
        <CardTitle>ประวัติการโหลดเข้าเครื่อง / SILO (load history)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">เวลาโหลด</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Doc No.</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">ถุง</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">จำนวน</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">เครื่อง</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SILO</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">ผู้โหลด</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[10px_16px] text-[#69748a]">{fmtDateTime(h.loadedAt)}</td>
                  <td className="font-num p-[10px_16px] font-semibold text-[#2f86cf]">{h.stagingDoc}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{h.productCode}</td>
                  <td className="p-[10px_16px]">{h.name}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{h.lotNo}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{h.bagNo != null ? `ถุง ${h.bagNo}` : "—"}</td>
                  <td className="font-num p-[10px_16px] text-right font-semibold text-[#1f9d63]">
                    {h.qty.toLocaleString()} {h.unit}
                  </td>
                  <td className="font-num p-[10px_16px] text-[12px]">{h.machine || "—"}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{h.silo || "—"}</td>
                  <td className="p-[10px_16px] text-[12px]">{h.operator || "—"}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-[#9aa4b4]">
                    ยังไม่มีประวัติการโหลด (no loads yet)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Load-one-bag modal */}
      <Modal open={!!loadTarget} onClose={() => setLoadTarget(null)} width={440}>
        {loadTarget && (
          <>
            <ModalHeader
              title={`โหลดถุงที่ ${loadTarget.bag.bagNo} · ${loadTarget.s.productCode}`}
              onClose={() => setLoadTarget(null)}
            />
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="rounded-[10px] bg-[#eef7f1] px-3 py-2 text-[12.5px] text-[#178050]">
                {loadTarget.s.name} · Lot {loadTarget.s.lotNo} · จาก {loadTarget.s.sourceLoc}
                <br />
                ถุงที่ {loadTarget.bag.bagNo}
                {loadTarget.bag.isPartial ? " (partial)" : ""} — น้ำหนัก{" "}
                <b className="font-num">{loadTarget.bag.size.toLocaleString()} {loadTarget.s.unit}</b>
              </div>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-[#69748a]">เครื่อง (machine)</span>
                  <select
                    value={machine}
                    onChange={(e) => setMachine(e.target.value)}
                    className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                  >
                    <option value="">— เลือกเครื่อง —</option>
                    {MACHINES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-[#69748a]">SILO</span>
                  <input
                    value={silo}
                    onChange={(e) => setSilo(e.target.value)}
                    className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                    placeholder="เช่น S3"
                  />
                </label>
              </div>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-[#69748a]">วันที่โหลด</span>
                  <input
                    type="date"
                    value={loadDate}
                    onChange={(e) => setLoadDate(e.target.value)}
                    className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                  />
                </label>
                <label className="flex w-[130px] flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-[#69748a]">เวลา (00:00–23:59)</span>
                  <input
                    type="time"
                    value={loadTime}
                    onChange={(e) => setLoadTime(e.target.value)}
                    className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[#69748a]">ผู้โหลด (operator)</span>
                <input
                  list="silo-operators"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                  placeholder="ชื่อผู้โหลด"
                />
              </label>
              {loadErr && (
                <div className="rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">{loadErr}</div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setLoadTarget(null)} disabled={loading} className={buttonClass("secondary")}>
                  ยกเลิก
                </button>
                <button
                  onClick={submitLoad}
                  disabled={loading}
                  className="rounded-[8px] bg-[#1f9d63] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#178050] disabled:opacity-60"
                >
                  {loading ? "กำลังบันทึก…" : "บันทึกการโหลด"}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

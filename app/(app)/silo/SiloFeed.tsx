"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { stageForSiloAction, loadSiloAction } from "@/lib/actions/silo";
import type { SiloFormData, StagingRow, LoadHistoryRow } from "@/lib/views/silo";

/** Current local time as "HH:MM" for the load-time default. */
function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** Show a stored ISO datetime as BE date + 24h time. */
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmtDateBE(d)} · ${hm}`;
}

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

  // ── Stage form: issue stock now → "waiting to load" ──────────────────────
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [stagedBy, setStagedBy] = useState("");
  const [date, setDate] = useState(fmtDateISO(new Date()));
  const [staging0, setStaging0] = useState(false);
  const [stageErr, setStageErr] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const selectedLot = data.lots.find((l) => l.id === lotId) || null;

  async function submitStage() {
    setStaging0(true);
    setStageErr(null);
    const res = await stageForSiloAction({
      lotId,
      qty: Number(qty) || 0,
      stagedBy: stagedBy || null,
      docDate: date,
    });
    setStaging0(false);
    if (res.error) {
      setStageErr(res.error);
      return;
    }
    showToast(`เบิกไปรอโหลดแล้ว · ${res.docNo}`);
    setLotId("");
    setQty("");
    setStageErr(null);
    setPickerKey((k) => k + 1);
    router.refresh();
  }

  // ── Load modal: a loader records loading (part of) a staged item ──────────
  const [loadTarget, setLoadTarget] = useState<StagingRow | null>(null);
  const [loadQty, setLoadQty] = useState("");
  const [machine, setMachine] = useState("");
  const [silo, setSilo] = useState("");
  const [operator, setOperator] = useState("");
  const [loadDate, setLoadDate] = useState(fmtDateISO(new Date()));
  const [loadTime, setLoadTime] = useState(nowHM());
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openLoad(s: StagingRow) {
    setLoadTarget(s);
    setLoadQty(String(s.remaining));
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
      stagingId: loadTarget.id,
      qty: Number(loadQty) || 0,
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
    showToast(`บันทึกการโหลดแล้ว · ${loadTarget.name}`);
    setLoadTarget(null);
    router.refresh();
  }

  const waiting = staging.filter((s) => s.remaining > 0);
  const done = staging.filter((s) => s.remaining <= 0);

  return (
    <>
      {/* Stage: key an issue that goes to "waiting to load" */}
      <Card className="mb-4">
        <CardTitle>เบิกไปรอโหลด SILO (issue → รอโหลด)</CardTitle>
        <div className="mb-3 rounded-[10px] border border-[#dbe7f2] bg-[#eef4f9] px-3 py-2.5 text-[12px] text-[#1f66a6]">
          เลือกล็อตในสต็อก แล้วเบิกออกมา — ระบบจะ<b>จ่ายออกจากสต็อกทันที</b> (มีผลใน Stock Card) และย้ายมาอยู่ในรายการ
          “รอโหลด” ให้คนโหลดมากรอกต่อว่าโหลดเข้าเครื่องกี่โมง เครื่องอะไร SILO ไหน
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[340px] flex-1">
            <span className="mb-1 block text-[11.5px] font-medium text-[#69748a]">ล็อตในสต็อก</span>
            <SearchableSelect
              key={pickerKey}
              options={data.lots.map((l) => ({
                value: l.id,
                label: `${l.productCode} · ${l.name} · ${l.lotNo} · ${l.locationCode} · ${l.qty.toLocaleString()} ${l.unit}`,
              }))}
              onSelect={(id) => {
                setLotId(id);
                const lot = data.lots.find((l) => l.id === id);
                if (lot) setQty(String(lot.qty));
                setStageErr(null);
              }}
              placeholder="พิมพ์ค้นหาล็อตในสต็อก…"
            />
          </div>
          <label className="flex w-[150px] flex-col gap-1">
            <span className="text-[11.5px] font-medium text-[#69748a]">จำนวนที่เบิก</span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
              placeholder={selectedLot ? `${selectedLot.unit}` : ""}
            />
          </label>
          <label className="flex w-[170px] flex-col gap-1">
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
        </div>
        {selectedLot && (
          <div className="mt-2 text-[12px] text-[#69748a]">
            ในสต็อก: <b className="font-num text-[#1f66a6]">{selectedLot.qty.toLocaleString()} {selectedLot.unit}</b>
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

      {/* Waiting to load */}
      <Card>
        <CardTitle>รอโหลดเข้าเครื่อง / SILO (waiting to load)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">Doc No.</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">จากที่เก็บ</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">เบิก</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">โหลดแล้ว</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">คงเหลือรอโหลด</th>
                <th className="p-[10px_16px]"></th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((s) => (
                <tr key={s.id} className="border-t border-[#eef1f5] align-top">
                  <td className="font-num p-[11px_16px] font-semibold text-[#2f86cf]">{s.docNo}</td>
                  <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{s.productCode}</td>
                  <td className="p-[11px_16px] font-medium">
                    {s.name}
                    {s.loads.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {s.loads.map((ld, i) => (
                          <span key={i} className="text-[10.5px] text-[#69748a]">
                            • {ld.qty.toLocaleString()} {s.unit} · {fmtDateTime(ld.loadedAt)}
                            {ld.machine && ` · เครื่อง ${ld.machine}`}
                            {ld.silo && ` · SILO ${ld.silo}`}
                            {ld.operator && ` · ${ld.operator}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="font-num p-[11px_16px] text-[12px]">{s.lotNo}</td>
                  <td className="font-num p-[11px_16px] text-[12px]">{s.sourceLoc}</td>
                  <td className="font-num p-[11px_16px] text-right text-[12px] text-[#3a4658]">
                    {s.qtyStaged.toLocaleString()} {s.unit}
                  </td>
                  <td className="font-num p-[11px_16px] text-right text-[12px] text-[#1f9d63]">
                    {s.qtyLoaded.toLocaleString()}
                  </td>
                  <td className="font-num p-[11px_16px] text-right font-semibold text-[#b5790f]">
                    {s.remaining.toLocaleString()} {s.unit}
                  </td>
                  <td className="p-[11px_16px] text-right">
                    <button
                      onClick={() => openLoad(s)}
                      className="rounded-[8px] bg-[#1f9d63] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#178050]"
                    >
                      โหลดเข้าเครื่อง →
                    </button>
                  </td>
                </tr>
              ))}
              {waiting.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#9aa4b4]">
                    ไม่มีรายการรอโหลด (nothing waiting to load)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Load history */}
      <Card className="mt-4">
        <CardTitle>ประวัติการโหลดเข้าเครื่อง / SILO (load history)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">เวลาโหลด</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Doc No.</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
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
                  <td colSpan={9} className="p-6 text-center text-[#9aa4b4]">
                    ยังไม่มีประวัติการโหลด (no loads yet)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {done.length > 0 && (
          <p className="mt-3 text-[11px] text-[#9aa4b4]">
            โหลดครบแล้ว {done.length} รายการ (ไม่แสดงในรายการรอโหลด)
          </p>
        )}
      </Card>

      {/* Load modal */}
      <Modal open={!!loadTarget} onClose={() => setLoadTarget(null)} width={440}>
        {loadTarget && (
          <>
            <ModalHeader title={`โหลดเข้าเครื่อง · ${loadTarget.productCode}`} onClose={() => setLoadTarget(null)} />
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="rounded-[10px] bg-[#eef7f1] px-3 py-2 text-[12.5px] text-[#178050]">
                {loadTarget.name} · Lot {loadTarget.lotNo} · จาก {loadTarget.sourceLoc}
                <br />
                คงเหลือรอโหลด{" "}
                <b className="font-num">{loadTarget.remaining.toLocaleString()} {loadTarget.unit}</b>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[#69748a]">จำนวนที่โหลด (โหลดบางส่วนได้)</span>
                <input
                  value={loadQty}
                  onChange={(e) => setLoadQty(e.target.value)}
                  className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                />
              </label>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-[#69748a]">เครื่อง (machine)</span>
                  <input
                    value={machine}
                    onChange={(e) => setMachine(e.target.value)}
                    className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#1f9d63]"
                    placeholder="เช่น M1"
                  />
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
                  disabled={loading || !(Number(loadQty) > 0)}
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

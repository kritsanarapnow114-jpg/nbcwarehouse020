"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  stageForSiloAction,
  startBagAction,
  finishBagAction,
  cancelBagAction,
  setBagSiloAction,
  deleteStagingAction,
} from "@/lib/actions/silo";
import type { SiloFormData, StagingRow, SiloBag, LoadHistoryRow } from "@/lib/views/silo";

const MACHINES = ["Super Sack Unloading", "Box Unloading", "EBS Unloading"];

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmtDateBE(d)} · ${t}`;
}
function hm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** Format a duration in ms as m:ss (or h:mm:ss past an hour). */
function fmtDur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Live stopwatch that ticks every second while a bag is loading. */
function LiveTimer({ from }: { from: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-num">⏱ {fmtDur(now - new Date(from).getTime())}</span>;
}

type StageProduct = SiloFormData["products"][number];

/** Small inline SILO input that saves on blur / Enter — "ใส่ทีหลัง". */
function SiloInput({ loadId, initial }: { loadId: string; initial: string }) {
  const router = useRouter();
  const [val, setVal] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (val.trim() === initial.trim()) return;
    setSaving(true);
    const res = await setBagSiloAction({ loadId, silo: val });
    setSaving(false);
    if (res.error) {
      showToast(res.error);
      return;
    }
    router.refresh();
  }
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      disabled={saving}
      placeholder="SILO?"
      className="font-num w-[68px] rounded-[6px] border border-[#d7dce4] bg-white px-1.5 py-0.5 text-[11px] outline-none focus:border-[#1f9d63]"
    />
  );
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

  // ── Stage form ───────────────────────────────────────────────────────────
  const [prod, setProd] = useState<StageProduct | null>(null);
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [machine, setMachine] = useState(MACHINES[0]);
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
    const res = await stageForSiloAction({
      lotId,
      qty: Number(qty) || 0,
      machine,
      stagedBy: stagedBy || null,
      docDate: date,
    });
    setStaging0(false);
    if (res.error) {
      setStageErr(res.error);
      return;
    }
    showToast(`เบิกไปรอโหลดแล้ว · ${res.docNo}`);
    resetStage();
    router.refresh();
  }

  // ── One-tap bag loading ──────────────────────────────────────────────────
  const [busy, setBusy] = useState<string | null>(null);

  async function startBag(s: StagingRow, bag: SiloBag) {
    setBusy(`${s.id}:${bag.bagNo}`);
    const res = await startBagAction({ stagingId: s.id, bagNo: bag.bagNo });
    setBusy(null);
    if (res.error) showToast(res.error);
    else router.refresh();
  }
  async function finishBag(bag: SiloBag) {
    if (!bag.loadId) return;
    setBusy(bag.loadId);
    const res = await finishBagAction({ loadId: bag.loadId });
    setBusy(null);
    if (res.error) showToast(res.error);
    else router.refresh();
  }
  async function cancelBag(bag: SiloBag) {
    if (!bag.loadId) return;
    setBusy(bag.loadId);
    const res = await cancelBagAction({ loadId: bag.loadId });
    setBusy(null);
    if (res.error) showToast(res.error);
    else router.refresh();
  }

  // Completed rows collapse to the bottom; click to expand their bag details.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Delete a whole staging (returns stock) ───────────────────────────────
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

  function bagChip(s: StagingRow, b: SiloBag) {
    if (b.status === "done") {
      return (
        <span
          key={b.bagNo}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#bfe3cd] bg-[#e9f6ee] px-2 py-1 text-[11px] font-medium text-[#178050]"
        >
          ✓ ถุง {b.bagNo}
          {b.isPartial && <span className="text-[#b5790f]">(partial)</span>}
          <span className="font-num">· {b.size.toLocaleString()}</span>
          {b.startedAt && b.loadedAt ? (
            <span className="font-num text-[#5b6473]">
              · {hm(b.startedAt)}→{hm(b.loadedAt)} · ⏱ {fmtDur(new Date(b.loadedAt).getTime() - new Date(b.startedAt).getTime())}
            </span>
          ) : (
            b.loadedAt && <span className="font-num text-[#5b6473]">· {hm(b.loadedAt)}</span>
          )}
          {b.loadId && <SiloInput loadId={b.loadId} initial={b.silo} />}
          {b.loadId && (
            <button
              onClick={() => cancelBag(b)}
              disabled={busy === b.loadId}
              title="ยกเลิกถุงนี้ (undo)"
              className="text-[13px] text-[#c2606f] hover:text-[#a83333]"
            >
              ×
            </button>
          )}
        </span>
      );
    }
    if (b.status === "loading") {
      return (
        <span
          key={b.bagNo}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#f0d6a0] bg-[#fdf6e7] px-2 py-1 text-[11px] font-semibold text-[#b5790f]"
        >
          <span className="animate-pulse">● กำลังโหลด ถุง {b.bagNo}</span>
          {b.startedAt && (
            <span className="font-num text-[#8a6d1f]">
              เริ่ม {hm(b.startedAt)} · <LiveTimer from={b.startedAt} />
            </span>
          )}
          <button
            onClick={() => finishBag(b)}
            disabled={busy === b.loadId}
            className="rounded-[6px] bg-[#1f9d63] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#178050] disabled:opacity-50"
          >
            ✔ เสร็จ
          </button>
          {b.loadId && <SiloInput loadId={b.loadId} initial={b.silo} />}
          {b.loadId && (
            <button
              onClick={() => cancelBag(b)}
              disabled={busy === b.loadId}
              title="ยกเลิก"
              className="text-[13px] text-[#c2606f] hover:text-[#a83333]"
            >
              ×
            </button>
          )}
        </span>
      );
    }
    return (
      <button
        key={b.bagNo}
        onClick={() => startBag(s, b)}
        disabled={busy === `${s.id}:${b.bagNo}`}
        className="inline-flex items-center gap-1 rounded-[8px] border border-[#c9e0c9] bg-white px-2 py-1 text-[11px] font-semibold text-[#1f9d63] hover:bg-[#f0f9f2] disabled:opacity-50"
      >
        ▶ เริ่มโหลด ถุง {b.bagNo}
        {b.isPartial && <span className="text-[#b5790f]">(partial)</span>}
        <span className="font-num">· {b.size.toLocaleString()} {s.unit}</span>
      </button>
    );
  }

  function stagedCard(s: StagingRow, collapsible: boolean) {
    const doneBags = s.bags.filter((b) => b.status === "done").length;
    const allDone = s.bags.length > 0 && s.bags.every((b) => b.status === "done");
    const open = !collapsible || expanded.has(s.id);
    return (
      <div
        key={s.id}
        className="rounded-[12px] border border-[#e7ebf1] p-3"
        style={{ background: allDone ? "#f6faf7" : "#ffffff" }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {collapsible && (
            <button
              onClick={() => toggleExpand(s.id)}
              className="text-[12px] text-[#69748a] hover:text-[#2f86cf]"
              title={open ? "ย่อ" : "ดูรายละเอียด"}
            >
              {open ? "▼" : "▶"}
            </button>
          )}
          <span className="font-num text-[13px] font-semibold text-[#2f86cf]">{s.docNo}</span>
          <span className="font-num text-[12px] text-[#3a4658]">{s.productCode}</span>
          <span className="text-[13px] font-medium">{s.name}</span>
          <span className="font-num text-[12px] text-[#69748a]">
            Lot {s.lotNo} · จาก {s.sourceLoc}
          </span>
          {s.machine && (
            <span className="rounded-full bg-[#eef4f9] px-2 py-0.5 text-[10.5px] font-semibold text-[#1f66a6]">
              ⚙ {s.machine}
            </span>
          )}
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

        {open && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">{s.bags.map((b) => bagChip(s, b))}</div>
            {s.bags.length > 0 && (
              <div className="mt-1.5 text-[10.5px] text-[#9aa4b4]">
                เสร็จแล้ว {doneBags}/{s.bags.length} ถุง
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const active = staging.filter((s) => !(s.bags.length > 0 && s.bags.every((b) => b.status === "done")));
  const completed = staging.filter((s) => s.bags.length > 0 && s.bags.every((b) => b.status === "done"));

  return (
    <>
      {/* Stage: pick product (FEFO) + machine, issue → waiting to load */}
      <Card className="mb-4">
        <CardTitle>เบิกไปรอโหลด SILO (issue → รอโหลด)</CardTitle>
        <div className="mb-3 rounded-[10px] border border-[#dbe7f2] bg-[#eef4f9] px-3 py-2.5 text-[12px] text-[#1f66a6]">
          เลือกสินค้า (ระบบเลือกล็อต <b>FEFO</b> ให้อัตโนมัติ) + <b>เครื่องโหลด</b> แล้วกดเบิก — ของจะ<b>จ่ายออกจากสต็อกทันที</b>{" "}
          และแตกเป็น<b>ถุงตามขนาดพาเลท</b>. เวลาโหลด: คนโหลด<b>กดถุงหนึ่งครั้ง = เริ่มโหลด, กดอีกครั้ง = เสร็จ</b> (จับเวลาให้อัตโนมัติ){" "}
          — SILO ค่อยใส่ทีหลังได้
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
            <div className="min-w-[260px] flex-1">
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
            <label className="flex w-[130px] flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#69748a]">จำนวนที่เบิก</span>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
              />
            </label>
            <label className="flex w-[190px] flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#69748a]">เครื่องโหลด (machine)</span>
              <select
                value={machine}
                onChange={(e) => setMachine(e.target.value)}
                className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
              >
                {MACHINES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-[150px] flex-col gap-1">
              <span className="text-[11.5px] font-medium text-[#69748a]">ผู้เบิก</span>
              <input
                list="silo-operators"
                value={stagedBy}
                onChange={(e) => setStagedBy(e.target.value)}
                className="rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
                placeholder="ชื่อผู้เบิก"
              />
            </label>
            <label className="flex w-[140px] flex-col gap-1">
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

      {/* Waiting to load — active items only */}
      <Card>
        <CardTitle>รอโหลด — โหลดทีละถุง (กดเริ่ม → กดเสร็จ)</CardTitle>
        <div className="flex flex-col gap-3">
          {active.map((s) => stagedCard(s, false))}
          {active.length === 0 && (
            <div className="p-6 text-center text-[#9aa4b4]">ไม่มีรายการรอโหลด (nothing waiting to load)</div>
          )}
        </div>
      </Card>

      {/* Completed — moved below, collapsed; click ▶ to expand */}
      {completed.length > 0 && (
        <Card className="mt-4">
          <CardTitle>โหลดเสร็จแล้ว {completed.length} รายการ · กด ▶ เพื่อดูรายละเอียด</CardTitle>
          <div className="flex flex-col gap-3">{completed.map((s) => stagedCard(s, true))}</div>
        </Card>
      )}

      {/* Load history (finished bags) */}
      <Card className="mt-4">
        <CardTitle>ประวัติการโหลดเข้าเครื่อง / SILO (load history)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">เวลาเริ่ม</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">เวลาเสร็จ</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">ใช้เวลา</th>
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
                  <td className="font-num p-[10px_16px] text-[#69748a]">{h.startedAt ? fmtDateTime(h.startedAt) : "—"}</td>
                  <td className="font-num p-[10px_16px] text-[#69748a]">{h.loadedAt ? fmtDateTime(h.loadedAt) : "—"}</td>
                  <td className="font-num p-[10px_16px] text-[#5b6473]">
                    {h.startedAt && h.loadedAt
                      ? fmtDur(new Date(h.loadedAt).getTime() - new Date(h.startedAt).getTime())
                      : "—"}
                  </td>
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
                  <td colSpan={12} className="p-6 text-center text-[#9aa4b4]">
                    ยังไม่มีประวัติการโหลด (no loads yet)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

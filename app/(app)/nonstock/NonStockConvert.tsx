"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { convertToStockAction, moveToNonStockAction } from "@/lib/actions/nonstock";
import type { NonStockHoldingRow, ConversionRow, MovableLotRow } from "@/lib/views/nonstock";

export function NonStockConvert({
  holdings,
  conversions,
  stockLots,
}: {
  holdings: NonStockHoldingRow[];
  conversions: ConversionRow[];
  stockLots: MovableLotRow[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState<NonStockHoldingRow | null>(null);
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(fmtDateISO(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Move stock → Non-Stock" tool (fix items that ended up in stock).
  const [moveLot, setMoveLot] = useState<MovableLotRow | null>(null);
  const [moveQty, setMoveQty] = useState("");
  const [moveDate, setMoveDate] = useState(fmtDateISO(new Date()));

  function openMove(lot: MovableLotRow) {
    setMoveLot(lot);
    setMoveQty(String(lot.qty));
    setMoveDate(fmtDateISO(new Date()));
    setError(null);
  }

  async function confirmMove() {
    if (!moveLot) return;
    setSaving(true);
    setError(null);
    const res = await moveToNonStockAction({ lotId: moveLot.id, qty: Number(moveQty) || 0, docDate: moveDate });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast(`ย้ายเข้า Non-Stock แล้ว · ${res.docNo}`);
    setMoveLot(null);
    router.refresh();
  }

  function open(h: NonStockHoldingRow) {
    setTarget(h);
    setQty(String(h.qty));
    setDate(fmtDateISO(new Date()));
    setError(null);
  }

  async function confirm() {
    if (!target) return;
    setSaving(true);
    setError(null);
    const res = await convertToStockAction({ holdingId: target.id, qty: Number(qty) || 0, docDate: date });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    showToast(`แปลงเข้าสต็อกแล้ว · ${res.docNo}`);
    setTarget(null);
    router.refresh();
  }

  return (
    <>
      <Card className="mb-4">
        <CardTitle>ย้ายของจากสต็อก → Non-Stock (แก้ของที่ค้างอยู่ในสต็อก)</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[320px] flex-1">
            <SearchableSelect
              options={stockLots.map((l) => ({
                value: l.id,
                label: `${l.productCode} · ${l.name} · ${l.lotNo} · ${l.locationCode} · ${l.qty.toLocaleString()} ${l.unit}`,
              }))}
              onSelect={(id) => {
                const lot = stockLots.find((l) => l.id === id);
                if (lot) openMove(lot);
              }}
              placeholder="พิมพ์ค้นหาของในสต็อก แล้วเลือกเพื่อย้ายเป็น Non-Stock…"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Non-Stock ที่รอแปลงเข้าสต็อก (held, not in stock)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP Material Master</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Location</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Received</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Qty (คงเหลือ)</th>
                <th className="p-[10px_16px]"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.id} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[11px_16px] text-[12px] text-[#3a4658]">{h.productCode}</td>
                  <td className="p-[11px_16px] font-medium">{h.name}</td>
                  <td className="font-num p-[11px_16px] text-[12px]">{h.lotNo}</td>
                  <td className="font-num p-[11px_16px] text-[12px]">{h.locationCode}</td>
                  <td className="font-num p-[11px_16px] text-[12px] text-[#69748a]">{fmtDateBE(new Date(h.recvDate))}</td>
                  <td className="font-num p-[11px_16px] text-right font-semibold text-[#8a6d1f]">
                    {h.qty.toLocaleString()} {h.unit}
                  </td>
                  <td className="p-[11px_16px] text-right">
                    <button
                      onClick={() => open(h)}
                      className="rounded-[8px] bg-[#2f86cf] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#1f66a6]"
                    >
                      แปลงเข้าสต็อก →
                    </button>
                  </td>
                </tr>
              ))}
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#9aa4b4]">
                    ไม่มีของ Non-Stock ค้างอยู่ (no Non-Stock held)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardTitle>ประวัติการแปลง (conversion history)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
                <th className="p-[10px_16px] text-[11.5px] font-medium">Doc No.</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Date</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">SAP</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Material Description</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Lot</th>
                <th className="p-[10px_16px] text-[11.5px] font-medium">Location</th>
                <th className="p-[10px_16px] text-right text-[11.5px] font-medium">Qty เข้าสต็อก</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.docNo} className="border-t border-[#eef1f5]">
                  <td className="font-num p-[10px_16px] font-semibold text-[#2f86cf]">{c.docNo}</td>
                  <td className="font-num p-[10px_16px] text-[#69748a]">{fmtDateBE(new Date(c.docDate))}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{c.productCode}</td>
                  <td className="p-[10px_16px]">{c.name}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{c.lotNo}</td>
                  <td className="font-num p-[10px_16px] text-[12px]">{c.locationCode}</td>
                  <td
                    className="font-num p-[10px_16px] text-right font-semibold"
                    style={{ color: c.qty >= 0 ? "#1f9d63" : "#b5790f" }}
                  >
                    {c.qty >= 0 ? `+${c.qty.toLocaleString()} เข้าสต็อก` : `${c.qty.toLocaleString()} → Non-Stock`}
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#9aa4b4]">
                    ยังไม่มีการแปลง (no conversions yet)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!target} onClose={() => setTarget(null)} width={420}>
        {target && (
          <>
            <ModalHeader title={`แปลงเข้าสต็อก · ${target.productCode}`} onClose={() => setTarget(null)} />
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="rounded-[10px] bg-[#faf6ec] px-3 py-2 text-[12.5px] text-[#8a6d1f]">
                {target.name} · Lot {target.lotNo} · {target.locationCode} · คงเหลือ{" "}
                <b className="font-num">{target.qty.toLocaleString()} {target.unit}</b>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[#69748a]">จำนวนที่แปลงเข้าสต็อก (ไม่ต้องเท่าที่รับ)</span>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[#69748a]">วันที่แปลงเข้าสต็อก</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
                />
              </label>
              {error && (
                <div className="rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">{error}</div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setTarget(null)} disabled={saving} className={buttonClass("secondary")}>
                  ยกเลิก
                </button>
                <button
                  onClick={confirm}
                  disabled={saving}
                  className="rounded-[8px] bg-[#2f86cf] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1f66a6] disabled:opacity-60"
                >
                  {saving ? "กำลังแปลง…" : "ยืนยันแปลงเข้าสต็อก"}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!moveLot} onClose={() => setMoveLot(null)} width={420}>
        {moveLot && (
          <>
            <ModalHeader title={`ย้ายเข้า Non-Stock · ${moveLot.productCode}`} onClose={() => setMoveLot(null)} />
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="rounded-[10px] bg-[#eef4f9] px-3 py-2 text-[12.5px] text-[#1f66a6]">
                {moveLot.name} · Lot {moveLot.lotNo} · {moveLot.locationCode} · ในสต็อก{" "}
                <b className="font-num">{moveLot.qty.toLocaleString()} {moveLot.unit}</b>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[#69748a]">จำนวนที่ย้ายออกเป็น Non-Stock</span>
                <input
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-[#69748a]">วันที่ย้าย</span>
                <input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="font-num rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#2f86cf]"
                />
              </label>
              {error && (
                <div className="rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12px] text-[#c53f3f]">{error}</div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setMoveLot(null)} disabled={saving} className={buttonClass("secondary")}>
                  ยกเลิก
                </button>
                <button
                  onClick={confirmMove}
                  disabled={saving}
                  className="rounded-[8px] bg-[#8a6d1f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#725a19] disabled:opacity-60"
                >
                  {saving ? "กำลังย้าย…" : "ยืนยันย้ายเป็น Non-Stock"}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

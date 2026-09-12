"use client";
import { useState } from "react";
import type { PartialPalletItem } from "@/lib/views/receive";

/** Clickable "Partial pallets" tile that expands to show exactly which lots
 *  are partial (product · lot · location · qty · date). */
export function PartialLotsCard({
  partial,
  pct,
  items,
}: {
  partial: number;
  pct: number;
  items: PartialPalletItem[];
}) {
  const [open, setOpen] = useState(false);
  const canOpen = items.length > 0;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <div className="rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04)]">
      <button
        type="button"
        onClick={() => canOpen && setOpen((v) => !v)}
        className="flex w-full items-start gap-2 p-[14px_16px] text-left"
        style={{ cursor: canOpen ? "pointer" : "default" }}
        aria-expanded={open}
      >
        <div className="flex-1">
          <div className="text-[11px] text-[#69748a]">พาเลท/กล่องไม่เต็ม (Partial)</div>
          <div className="font-num text-[26px] font-extrabold leading-tight text-[#c8891a]">
            {partial.toLocaleString()}
            <span className="ml-1 text-[12px] font-medium text-[#9aa4b4]">กล่อง</span>
          </div>
          <div className="text-[10.5px] text-[#9aa4b4]">
            {pct}% ของที่รับเข้าทั้งหมด{canOpen ? " · กดดูว่า LOT ไหน" : ""}
          </div>
        </div>
        {canOpen && (
          <span className="mt-1 text-[13px] text-[#c8891a]" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-[#eef1f5] p-[10px_12px]">
          <div className="max-h-[360px] overflow-auto overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead>
                <tr className="sticky top-0 bg-[#f7f9fb] text-left text-[11px] text-[#69748a]">
                  <th className="p-[6px_8px] font-medium">วันที่</th>
                  <th className="p-[6px_8px] font-medium">สินค้า</th>
                  <th className="p-[6px_8px] font-medium">Lot</th>
                  <th className="p-[6px_8px] font-medium">ที่เก็บ</th>
                  <th className="p-[6px_8px] text-right font-medium">จำนวน</th>
                  <th className="p-[6px_8px] font-medium">เอกสาร</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={`${it.docNo}-${it.lotNo}-${it.suNo ?? i}`} className="border-t border-[#eef1f5]">
                    <td className="font-num whitespace-nowrap p-[6px_8px] text-[#69748a]">{fmtDate(it.docDate)}</td>
                    <td className="p-[6px_8px]">
                      <div className="font-medium text-[#3a4658]">{it.name}</div>
                      <div className="text-[10.5px] text-[#9aa4b4]">{it.code}</div>
                    </td>
                    <td className="font-num p-[6px_8px] text-[#16202e]">{it.lotNo}</td>
                    <td className="font-num p-[6px_8px] text-[#69748a]">{it.locationCode}</td>
                    <td className="font-num whitespace-nowrap p-[6px_8px] text-right">
                      {it.recvQty.toLocaleString()} {it.unit}
                    </td>
                    <td className="font-num p-[6px_8px] text-[#2f86cf]">
                      {it.docNo}
                      {it.mode === "PRODUCTION" && (
                        <span className="ml-1 rounded-[4px] bg-[#eef6ff] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#2f86cf]">
                          ผลิต
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length >= 500 && (
            <div className="p-[6px_8px] text-[10.5px] text-[#9aa4b4]">แสดง 500 รายการล่าสุด</div>
          )}
        </div>
      )}
    </div>
  );
}

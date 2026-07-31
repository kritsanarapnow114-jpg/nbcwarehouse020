"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { showToast } from "@/components/ui/Toast";
import { fmtDateBE } from "@/lib/calc/date";
import { verifyReceiptAction } from "@/lib/actions/receive";
import type { PendingReceipt } from "@/lib/views/receive";

export function PendingVerify({ receipts }: { receipts: PendingReceipt[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function verify(r: PendingReceipt) {
    if (!window.confirm(`ยืนยันรับเข้าสต็อก ${r.docNo}? (ของจะเข้าสต็อกจริง)`)) return;
    setBusy(r.id);
    const res = await verifyReceiptAction(r.id);
    setBusy(null);
    if (res.error) {
      showToast(res.error);
      return;
    }
    showToast(`ตรวจสอบแล้ว เข้าสต็อก · ${r.docNo}`);
    router.refresh();
  }

  if (receipts.length === 0) return null;

  return (
    <Card className="mb-4 border-[#f0d79a] bg-[#fffdf6]">
      <CardTitle>
        <span className="text-[#8a6d1f]">⏳ รอตรวจสอบจากฝ่ายผลิต (Pending verification)</span>
      </CardTitle>
      <p className="mb-3 text-[12px] text-[#8a6d1f]">
        ฝ่ายผลิตส่งของเข้ามาแล้ว {receipts.length} ใบ — ตรวจสอบ SU / น้ำหนักให้เรียบร้อยแล้วกด “ตรวจสอบ & เข้าสต็อก” ของจึงจะเข้าสต็อกจริง
      </p>
      <div className="flex flex-col gap-3">
        {receipts.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-[10px] border border-[#efe0bf] bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#f2ead6] bg-[#fdf9ef] px-4 py-2.5">
              <span className="font-num font-semibold text-[#8a6d1f]">{r.docNo}</span>
              <span className="font-num text-[12px] text-[#69748a]">{fmtDateBE(new Date(r.docDate))}</span>
              <span className="text-[12px] text-[#69748a]">
                รวม <b className="font-num">{r.totalQty.toLocaleString()}</b> ·{" "}
                น้ำหนัก <b className="font-num">{r.totalWeight.toLocaleString()}</b> กก.
              </span>
              {r.remark && <span className="text-[12px] text-[#9aa4b4]">— {r.remark}</span>}
              <div className="flex-1" />
              <button
                onClick={() => verify(r)}
                disabled={busy === r.id}
                className="rounded-[8px] bg-[#1f9d63] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#178150] disabled:opacity-60"
              >
                {busy === r.id ? "กำลังยืนยัน…" : "✓ ตรวจสอบ & เข้าสต็อก"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[#9aa4b4]">
                    <th className="p-[7px_14px] text-[11px] font-medium">SU</th>
                    <th className="p-[7px_14px] text-[11px] font-medium">Material</th>
                    <th className="p-[7px_14px] text-[11px] font-medium">Lot</th>
                    <th className="p-[7px_14px] text-[11px] font-medium">Location</th>
                    <th className="p-[7px_14px] text-right text-[11px] font-medium">รับเข้า (กก.)</th>
                    <th className="p-[7px_14px] text-right text-[11px] font-medium">ชั่งจริง (กก.)</th>
                    <th className="p-[7px_14px] text-[11px] font-medium">พาเลท</th>
                    <th className="p-[7px_14px] text-[11px] font-medium">เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l, i) => (
                    <tr key={i} className="border-t border-[#f2f4f7]">
                      <td className="font-num p-[7px_14px] font-semibold text-[#8a6d1f]">
                        {l.suNo ?? "—"}
                      </td>
                      <td className="p-[7px_14px]">
                        <span className="font-num text-[11px] text-[#9aa4b4]">{l.code}</span> {l.name}
                      </td>
                      <td className="font-num p-[7px_14px] text-[12px]">{l.lotNo}</td>
                      <td className="font-num p-[7px_14px] text-[12px]">{l.locationCode}</td>
                      <td className="font-num p-[7px_14px] text-right font-semibold text-[#177a4a]">
                        {l.recvQty.toLocaleString()}
                      </td>
                      <td className="font-num p-[7px_14px] text-right text-[#69748a]">
                        {l.weightKg != null ? l.weightKg.toLocaleString() : "—"}
                      </td>
                      <td className="p-[7px_14px]">
                        {l.palletFull == null ? (
                          "—"
                        ) : (
                          <span
                            className={`rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold ${
                              l.palletFull ? "bg-[#e2f0e8] text-[#177a4a]" : "bg-[#faf0dc] text-[#9a6a12]"
                            }`}
                          >
                            {l.palletFull ? "Full" : "Partial"}
                          </span>
                        )}
                      </td>
                      <td className="font-num p-[7px_14px] text-[12px] text-[#69748a]">
                        {l.packTime || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

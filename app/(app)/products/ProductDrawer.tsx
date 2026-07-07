"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Currency";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import {
  getProductDetailAction,
  toggleLotQcAction,
  toggleAllLotsQcAction,
  updateLotExpiryAction,
} from "@/lib/actions/products";
import { ProductDetail } from "@/lib/views/products";
import { reorderStatus, REORDER_COLOR, REORDER_LABEL } from "@/lib/calc/reorder";
import { StockCardModal } from "./StockCardModal";
import { EditProductModal } from "./EditProductModal";
import { BomEditor } from "./BomEditor";
import Link from "next/link";

export function ProductDrawer({
  code,
  onClose,
  bomMaterials,
}: {
  code: string | null;
  onClose: () => void;
  bomMaterials: { code: string; name: string; unit: string }[];
}) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [stockCardOpen, setStockCardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!code) return;
    getProductDetailAction(code).then((d) => {
      setDetail(d);
      setDetailCode(code);
    });
  }, [code]);

  // Only show fetched detail once it matches the currently-open code, so switching
  // products (or closing) never flashes the previous product's stale data.
  const shown = detailCode === code ? detail : null;

  async function refresh() {
    if (code) {
      const d = await getProductDetailAction(code);
      setDetail(d);
      setDetailCode(code);
    }
  }

  return (
    <Drawer open={!!code} onClose={onClose}>
      {shown && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-[#eef1f5] px-5 py-4">
            <div className="flex-1">
              <div className="font-num text-[11px] text-[#9aa4b4]">
                {shown.code}
              </div>
              <div className="text-[15px] font-semibold text-[#16202e]">
                {shown.nameEnTh}
              </div>
            </div>
            <Badge tone={shown.status === "qc" ? "warn" : "ok"}>
              {shown.status === "qc" ? "QC Hold" : "Available"}
            </Badge>
            <button onClick={() => setEditOpen(true)} className={buttonClass("secondary")}>
              ✎ Edit
            </button>
            <button
              onClick={onClose}
              className="text-[18px] text-[#9aa4b4] hover:text-[#3a4658]"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            <div className="rounded-[12px] border border-[#e7ebf1] p-3.5">
              <div className="mb-1.5 text-[11.5px] text-[#69748a]">
                On hand
              </div>
              <div className="font-num text-[19px] font-bold">
                {shown.onHand.toLocaleString()} {shown.unit}
              </div>
            </div>
            <div className="rounded-[12px] border border-[#e7ebf1] p-3.5">
              <div className="mb-1.5 text-[11.5px] text-[#69748a]">
                Total value
              </div>
              <div className="font-num text-[19px] font-bold">
                <Money value={shown.totalValue} />
              </div>
            </div>
            <div className="col-span-2 rounded-[12px] border border-[#e7ebf1] p-3.5 text-[12px] text-[#69748a]">
              Pallet {shown.pallet.toLocaleString()} {shown.unit}/pallet ·
              Storage {shown.width}×{shown.length} m · stack ×
              {shown.stackLevels}
            </div>
            {(() => {
              const rs = reorderStatus(shown.onHand, shown.minQty, shown.maxQty);
              const c = REORDER_COLOR[rs];
              return (
                <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-[12px] border border-[#e7ebf1] p-3.5 text-[12px] text-[#69748a]">
                  <span>
                    Min / Max (จุดสั่งซื้อ):{" "}
                    <b className="font-num text-[#3a4658]">
                      {shown.minQty ? shown.minQty.toLocaleString() : "—"} /{" "}
                      {shown.maxQty ? shown.maxQty.toLocaleString() : "—"} {shown.unit}
                    </b>
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: c.bg, color: c.text }}
                  >
                    {REORDER_LABEL[rs]}
                  </span>
                  <span className="flex-1" />
                  <button onClick={() => setEditOpen(true)} className="text-[11.5px] font-medium text-[#12a2bb]">
                    ตั้งค่า Min/Max →
                  </button>
                </div>
              );
            })()}
          </div>

          <div className="flex-1 overflow-auto px-5">
            <div className="mb-2 text-[12.5px] font-semibold text-[#16202e]">
              Stored by Location / Lot
            </div>
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left text-[#9aa4b4]">
                  <th className="pb-2 font-medium">Loc</th>
                  <th className="pb-2 font-medium">Lot</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 font-medium">Expiry</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.lots.map((l) => {
                  const expired = l.expDate && new Date(l.expDate) < new Date();
                  const tone = expired ? "danger" : l.status === "QC" ? "warn" : "ok";
                  const label = expired ? "Expired" : l.status === "QC" ? "QC" : "OK";
                  return (
                    <tr key={l.id} className="border-t border-[#eef1f5]">
                      <td className="font-num py-2">{l.locationCode}</td>
                      <td className="font-num py-2">{l.lotNo}</td>
                      <td className="font-num py-2 text-right">
                        {l.qty.toLocaleString()}
                      </td>
                      <td className="py-2">
                        <input
                          type="date"
                          defaultValue={l.expDate ? l.expDate.slice(0, 10) : ""}
                          onBlur={async (e) => {
                            await updateLotExpiryAction(l.id, e.target.value);
                            showToast("Expiry updated");
                            refresh();
                          }}
                          className="font-num w-[128px] rounded-[6px] border border-[#d7dce4] px-1.5 py-1 text-[11.5px]"
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={tone}>{label}</Badge>
                          <button
                            onClick={async () => {
                              await toggleLotQcAction(l.id);
                              showToast(l.status === "QC" ? `Lot ${l.lotNo} released` : `Lot ${l.lotNo} held for QC`);
                              refresh();
                            }}
                            title={l.status === "QC" ? "ปลด QC ล็อตนี้" : "Hold QC เฉพาะล็อตนี้"}
                            className={`rounded-[6px] border px-1.5 py-0.5 text-[10.5px] font-semibold ${
                              l.status === "QC"
                                ? "border-[#bfe0d3] bg-[#e4f4f8] text-[#0e8ea6]"
                                : "border-[#f0cf9a] bg-[#fff2df] text-[#b5790f]"
                            }`}
                          >
                            {l.status === "QC" ? "▶ Release" : "⏸ Hold"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {shown.category === "FINISHED_GOODS" && (
              <BomEditor finishedProductCode={shown.code} materials={bomMaterials} />
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-[#eef1f5] p-4">
            <button
              onClick={() => setStockCardOpen(true)}
              className={buttonClass("secondary")}
            >
              ▤ Stock Card
            </button>
            <Link href="/adjust" className={buttonClass("secondary")}>
              Adjust
            </Link>
            <div className="flex-1" />
            <button
              onClick={async () => {
                await toggleAllLotsQcAction(shown.code);
                showToast("QC status updated");
                refresh();
              }}
              className={buttonClass(shown.status === "qc" ? "success" : "danger")}
              title="ทำกับทุกล็อตพร้อมกัน — ถ้าจะ Hold ทีละล็อต ใช้ปุ่ม Hold ในตารางด้านบน"
            >
              {shown.status === "qc" ? "Release ALL (คืนทั้งหมด)" : "Hold ALL lots (ทั้งหมด)"}
            </button>
          </div>

          <StockCardModal
            code={shown.code}
            name={shown.nameEnTh}
            open={stockCardOpen}
            onClose={() => setStockCardOpen(false)}
          />

          <EditProductModal
            product={shown}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={refresh}
          />
        </div>
      )}
    </Drawer>
  );
}

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
import { StockCardModal } from "./StockCardModal";
import Link from "next/link";

export function ProductDrawer({
  code,
  onClose,
}: {
  code: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [stockCardOpen, setStockCardOpen] = useState(false);

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
            <button
              onClick={onClose}
              className="text-[18px] text-[#9aa4b4] hover:text-[#3a4658]"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5">
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
                        <button
                          onClick={async () => {
                            await toggleLotQcAction(l.id);
                            refresh();
                          }}
                          title="Toggle QC hold for this lot"
                        >
                          <Badge tone={tone}>{label}</Badge>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            >
              {shown.status === "qc" ? "Release QC" : "Hold for QC"}
            </button>
          </div>

          <StockCardModal
            code={shown.code}
            name={shown.nameEnTh}
            open={stockCardOpen}
            onClose={() => setStockCardOpen(false)}
          />
        </div>
      )}
    </Drawer>
  );
}

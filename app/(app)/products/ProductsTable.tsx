"use client";

import { useState } from "react";
import { ProductRow } from "@/lib/views/products";
import { Badge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Currency";
import { deleteProductAction } from "@/lib/actions/products";
import { showToast } from "@/components/ui/Toast";
import { ProductDrawer } from "./ProductDrawer";

export function ProductsTable({
  rows,
  bomMaterials,
}: {
  rows: ProductRow[];
  bomMaterials: { code: string; name: string; unit: string }[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e7ebf1] bg-white shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f7f9fb] text-left text-[#69748a]">
              <Th>SAP Material Master</Th>
              <Th>Material Description</Th>
              <Th>Category (หมวด)</Th>
              <Th align="right">On Hand (คงเหลือ)</Th>
              <Th align="right">Unit Price (ราคา)</Th>
              <Th align="right">Total Value (มูลค่ารวม)</Th>
              <Th align="right">Pallet size (ขนาดพาเลท)</Th>
              <Th>Location (ที่เก็บ)</Th>
              <Th>Status (สถานะ)</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.code}
                onClick={() => setSelected(p.code)}
                className="cursor-pointer border-t border-[#eef1f5] hover:bg-[#f7f9fb]"
              >
                <Td className="font-num text-[12px] text-[#3a4658]">
                  {p.code}
                </Td>
                <Td className="font-medium">{p.nameEn}</Td>
                <Td className="text-[#69748a]">{p.categoryLabel}</Td>
                <Td align="right" className="font-num">
                  {p.onHand.toLocaleString()} {p.unit}
                </Td>
                <Td align="right" className="font-num">
                  <Money value={p.price} />
                </Td>
                <Td align="right" className="font-num font-semibold">
                  <Money value={p.totalValue} />
                </Td>
                <Td align="right" className="font-num text-[12px] text-[#69748a]">
                  {p.pallet.toLocaleString()} {p.unit}/pallet
                </Td>
                <Td className="font-num text-[12px] text-[#69748a]">
                  {p.locations[0] ?? "—"}
                  {p.locations.length > 1 ? ` +${p.locations.length - 1}` : ""}
                </Td>
                <Td>
                  <Badge tone={p.status === "qc" ? "warn" : "ok"}>
                    {p.status === "qc" ? "QC Hold (ติด QC)" : "Available (พร้อมใช้)"}
                  </Badge>
                </Td>
                <Td align="center">
                  <button
                    title="Delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete ${p.code}? (ลบสินค้านี้?)`)) return;
                      await deleteProductAction(p.code);
                      showToast(`Deleted ${p.code}`);
                    }}
                    className="cursor-pointer border-0 bg-transparent text-[15px] text-[#c2606f]"
                  >
                    🗑
                  </button>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-[#9aa4b4]">
                  No products found (ไม่พบสินค้า)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ProductDrawer code={selected} onClose={() => setSelected(null)} bomMaterials={bomMaterials} />
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`p-[11px_16px] text-[11.5px] font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`p-[12px_16px] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      {children}
    </td>
  );
}

"use client";

import { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { updateProductAction } from "@/lib/actions/products";
import { showToast } from "@/components/ui/Toast";
import { ProductDetail } from "@/lib/views/products";
import { Category } from "@prisma/client";

export function EditProductModal({
  product,
  open,
  onClose,
  onSaved,
}: {
  product: ProductDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nameEn, setNameEn] = useState(product.nameEn);
  const [nameTh, setNameTh] = useState(product.nameTh);
  const [category, setCategory] = useState(product.category as Category);
  const [unit, setUnit] = useState(product.unit);
  const [price, setPrice] = useState(String(product.price));
  const [pallet, setPallet] = useState(String(product.pallet));
  const [width, setWidth] = useState(String(product.width));
  const [length, setLength] = useState(String(product.length));
  const [stackLevels, setStackLevels] = useState(String(product.stackLevels));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateProductAction(product.code, {
        nameEn,
        nameTh,
        category: category as never,
        unit,
        price: Number(price) || 0,
        pallet: Number(pallet) || 0,
        width: Number(width) || 0,
        length: Number(length) || 0,
        stackLevels: Number(stackLevels) || 0,
      });
      showToast("Product updated");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={480}>
      <ModalHeader title={`Edit product (แก้ไขสินค้า) · ${product.code}`} onClose={onClose} />
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category (หมวด)">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={inputClass}
            >
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="PACKAGING">Packaging</option>
              <option value="FINISHED_GOODS">Finished Goods</option>
              <option value="SPARE_PARTS">Spare Parts</option>
            </select>
          </Field>
          <Field label="Unit">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Name EN">
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Name TH">
          <input value={nameTh} onChange={(e) => setNameTh(e.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price/unit">
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" className={inputClass} />
          </Field>
          <Field label="Pallet size">
            <input value={pallet} onChange={(e) => setPallet(e.target.value)} type="number" className={inputClass} />
          </Field>
        </div>
        <div className="mt-1 rounded-[10px] bg-[#f7f9fb] p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#69748a]">
            Storage size
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Width m">
              <input value={width} onChange={(e) => setWidth(e.target.value)} type="number" step="0.01" className={inputClass} />
            </Field>
            <Field label="Length m">
              <input value={length} onChange={(e) => setLength(e.target.value)} type="number" step="0.01" className={inputClass} />
            </Field>
            <Field label="Stack levels">
              <select value={stackLevels} onChange={(e) => setStackLevels(e.target.value)} className={inputClass}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        {error && (
          <div className="rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12.5px] text-[#c53f3f]">
            {error}
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={handleSave} className={buttonClass("primary")}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const inputClass =
  "w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#3E9B6E]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[#69748a]">{label}</span>
      {children}
    </label>
  );
}

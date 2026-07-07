"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { extendLotShelfLifeAction } from "@/lib/actions/products";
import { AgingRow } from "@/lib/views/aging";

const inputClass =
  "w-full rounded-[8px] border border-[#d7dce4] px-2.5 py-2 text-[13px] outline-none focus:border-[#12a2bb]";

export function ExtendShelfLifeModal({
  row,
  onClose,
}: {
  row: AgingRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mfgDate, setMfgDate] = useState(row?.mfgDate ? row.mfgDate.slice(0, 10) : "");
  const [expDate, setExpDate] = useState(row?.expDate ? row.expDate.slice(0, 10) : "");

  if (!row) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setPending(true);
    await extendLotShelfLifeAction(row.lotId, mfgDate, expDate);
    setPending(false);
    showToast("Shelf-life extended (ต่ออายุแล้ว)");
    router.refresh();
    onClose();
  }

  return (
    <Modal open={!!row} onClose={onClose} width={420}>
      <ModalHeader
        title={
          <span>
            Extend shelf-life (ต่ออายุ) ·{" "}
            <span className="font-num text-[13px] text-[#9aa4b4]">
              {row.code} / {row.lotNo}
            </span>
          </span>
        }
        onClose={onClose}
      />
      <form onSubmit={submit} className="flex flex-col gap-3 px-5 py-4">
        <div className="text-[12.5px] text-[#69748a]">{row.nameEn}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-[#69748a]">
              New MFD (วันผลิต)
            </span>
            <input
              type="date"
              value={mfgDate}
              onChange={(e) => setMfgDate(e.target.value)}
              className={`font-num ${inputClass}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-[#69748a]">
              New EXP (วันหมดอายุ)
            </span>
            <input
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              className={`font-num ${inputClass}`}
            />
          </label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

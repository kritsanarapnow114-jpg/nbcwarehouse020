"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { buttonClass } from "@/components/ui/Button";
import { CuteBoxPopup } from "@/components/ui/CuteBoxPopup";
import { createPoAction, FormState } from "@/lib/actions/po";

const initialState: FormState = {};

export function NewPoButton() {
  const [open, setOpen] = useState(false);
  const [createdNo, setCreatedNo] = useState<string | null>(null);

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass("accent")}>
        ＋ New PO (สร้างใบสั่งซื้อ)
      </button>
      <NewPoModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(no) => setCreatedNo(no)}
      />
      <CuteBoxPopup
        open={!!createdNo}
        kind="po"
        message={`Purchase order ${createdNo ?? ""} created as a draft (OPEN). Add line items later.`}
        onClose={() => setCreatedNo(null)}
      />
    </>
  );
}

function NewPoModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (no: string) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, fd) => {
      const res = await createPoAction(prev, fd);
      if (!res.error) {
        router.refresh();
        onClose();
        if (res.no) onCreated(res.no);
      }
      return res;
    },
    initialState
  );

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <ModalHeader title="New Purchase Order (สร้างใบสั่งซื้อ)" onClose={onClose} />
      <form action={formAction} className="flex flex-col gap-3 px-5 py-4">
        <Field label="Vendor (ผู้ขาย)">
          <input
            name="vendor"
            placeholder="Leave blank to set later"
            className={inputClass}
          />
        </Field>
        <p className="text-[12px] leading-snug text-[#69748a]">
          This creates a draft PO (status Open) dated today with an
          auto-generated PO number. Add line items afterward.
        </p>
        {state.error && (
          <div className="rounded-[8px] bg-[#fbe9e9] px-3 py-2 text-[12.5px] text-[#c53f3f]">
            {state.error}
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
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

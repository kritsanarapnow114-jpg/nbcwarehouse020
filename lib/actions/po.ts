"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextDocNumber } from "@/lib/calc/docNumber";

export type FormState = { error?: string; no?: string };

function revalidatePoPaths() {
  revalidatePath("/po");
  revalidatePath("/dashboard");
}

export async function createPoAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const vendorInput = String(formData.get("vendor") ?? "").trim();
  const vendor = vendorInput || "(New draft) set vendor";

  const no = await nextDocNumber("PO");

  await db.purchaseOrder.create({
    data: {
      no,
      vendor,
      date: new Date(),
      status: "OPEN",
    },
  });

  revalidatePoPaths();
  return { no };
}

export async function deletePoAction(id: string): Promise<{ error?: string }> {
  const receiptCount = await db.receipt.count({ where: { poId: id } });
  if (receiptCount > 0) {
    return {
      error: "Cannot delete — this PO already has receipts against it (มีการรับสินค้าตาม PO นี้แล้ว ลบไม่ได้)",
    };
  }
  await db.purchaseOrder.delete({ where: { id } });
  revalidatePoPaths();
  return {};
}

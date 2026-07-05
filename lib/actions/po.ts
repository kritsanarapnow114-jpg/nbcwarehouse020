"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextDocNumber } from "@/lib/calc/docNumber";

export type FormState = { error?: string; no?: string };

function revalidatePoPaths() {
  revalidatePath("/po");
  revalidatePath("/dashboard");
}

export type NewPoLine = { productCode: string; ordered: number };

export type CreatePoInput = {
  no?: string;
  vendor: string;
  date: string;
  lines: NewPoLine[];
};

export async function createPoAction(input: CreatePoInput): Promise<FormState> {
  const vendor = input.vendor.trim() || "(New draft) set vendor";

  let no = input.no?.trim();
  if (no) {
    const existing = await db.purchaseOrder.findUnique({ where: { no } });
    if (existing) {
      return { error: `PO number "${no}" already exists (เลข PO นี้มีอยู่แล้ว)` };
    }
  } else {
    no = await nextDocNumber("PO");
  }

  await db.purchaseOrder.create({
    data: {
      no,
      vendor,
      date: new Date(input.date),
      status: "OPEN",
      lines: {
        create: input.lines
          .filter((l) => l.ordered > 0)
          .map((l) => ({ productCode: l.productCode, ordered: l.ordered, received: 0 })),
      },
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

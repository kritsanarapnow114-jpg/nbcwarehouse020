"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { AdjustReason } from "@prisma/client";

export type AdjustLineInput = { lotId: string; countedQty: number };
export type ConfirmAdjustInput = {
  reason: AdjustReason;
  docDate: string;
  lines: AdjustLineInput[];
};

function revalidateAll() {
  for (const p of ["/adjust", "/dashboard", "/products", "/aging", "/locations"]) {
    revalidatePath(p);
  }
}

export async function confirmAdjustAction(input: ConfirmAdjustInput) {
  const docDate = new Date(input.docDate);
  const docNo = await nextDocNumber("ADJ", docDate);

  await db.$transaction(async (tx) => {
    const adj = await tx.adjustment.create({
      data: { docNo, reason: input.reason, docDate },
    });
    for (const line of input.lines) {
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
      if (!lot) continue;
      await tx.adjustmentLine.create({
        data: {
          adjustmentId: adj.id,
          lotId: lot.id,
          sysQty: lot.qty,
          countedQty: line.countedQty,
        },
      });
      await tx.lot.update({ where: { id: lot.id }, data: { qty: line.countedQty } });
    }
  });

  revalidateAll();
  return { docNo };
}

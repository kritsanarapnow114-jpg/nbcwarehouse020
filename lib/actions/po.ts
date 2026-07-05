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

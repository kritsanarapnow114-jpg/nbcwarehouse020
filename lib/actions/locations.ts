"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Zone } from "@prisma/client";

export type FormState = { error?: string };

function revalidateLocationPaths() {
  revalidatePath("/locations");
  revalidatePath("/dashboard");
}

export async function createLocationAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  const zone = String(formData.get("zone") ?? "") as Zone;
  const width = Number(formData.get("width") ?? 0);
  const length = Number(formData.get("length") ?? 0);

  if (!code || !zone) {
    return { error: "Fill in bin code and zone (กรอกรหัสที่เก็บและโซนให้ครบ)" };
  }
  if (!width || width <= 0 || !length || length <= 0) {
    return {
      error: "Width and length must be greater than 0 (ความกว้างและความยาวต้องมากกว่า 0)",
    };
  }

  const existing = await db.location.findUnique({ where: { code } });
  if (existing) {
    return { error: `Bin ${code} already exists (รหัสที่เก็บนี้มีอยู่แล้ว)` };
  }

  await db.location.create({
    data: { code, zone, width, length },
  });

  revalidateLocationPaths();
  return {};
}

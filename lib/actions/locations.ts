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

export async function updateLocationAction(
  code: string,
  data: { zone: Zone; width: number; length: number }
) {
  if (!data.width || data.width <= 0 || !data.length || data.length <= 0) {
    throw new Error("Width and length must be greater than 0 (ความกว้างและความยาวต้องมากกว่า 0)");
  }
  await db.location.update({ where: { code }, data });
  revalidateLocationPaths();
}

export async function deleteLocationAction(code: string): Promise<{ error?: string }> {
  // Block deletion while the bin still holds stock (would orphan the lots).
  const activeLots = await db.lot.count({ where: { locationCode: code, qty: { gt: 0 } } });
  if (activeLots > 0) {
    return {
      error: `ลบไม่ได้ — ช่อง ${code} ยังมีสินค้าอยู่ ${activeLots} ล็อต · ย้าย/จ่ายออกให้หมดก่อน (still has stock)`,
    };
  }
  try {
    await db.location.delete({ where: { code } });
  } catch {
    // e.g. depleted (qty 0) lots still reference this bin as history.
    return {
      error: `ลบไม่ได้ — ช่อง ${code} ผูกกับประวัติล็อต/เอกสารเดิมอยู่ (linked to past lots/documents)`,
    };
  }
  revalidateLocationPaths();
  return {};
}

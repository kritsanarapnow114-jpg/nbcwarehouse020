"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { PackagingType, ScheduleRow, PKG_TYPES_KEY, SCHEDULE_KEY } from "@/lib/planTypes";

async function saveSetting(key: string, value: string) {
  await db.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  revalidatePath("/plan");
}

export async function savePackagingTypesAction(
  types: PackagingType[]
): Promise<{ error?: string }> {
  try {
    await requireWrite();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  const clean = types.map((t) => ({
    id: t.id,
    name: t.name.trim() || "Packaging",
    lines: t.lines
      .filter((l) => l.code && Number(l.qtyPerUnit) > 0)
      .map((l) => ({ code: l.code, qtyPerUnit: Number(l.qtyPerUnit) })),
  }));
  await saveSetting(PKG_TYPES_KEY, JSON.stringify(clean));
  return {};
}

export async function saveScheduleAction(rows: ScheduleRow[]): Promise<{ error?: string }> {
  try {
    await requireWrite();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  const clean = rows
    .filter((r) => r.date && r.fgCode && Number(r.qty) > 0)
    .map((r) => ({
      id: r.id,
      date: r.date,
      fgCode: r.fgCode,
      qty: Number(r.qty),
      pkgTypeId: r.pkgTypeId ?? "",
    }));
  await saveSetting(SCHEDULE_KEY, JSON.stringify(clean));
  return {};
}

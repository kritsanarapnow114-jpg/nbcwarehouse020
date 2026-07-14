"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";

/** Relocate a whole lot to another bin (quick bin-to-bin move from the map). */
export async function moveLotAction(
  lotId: string,
  toLocationCode: string
): Promise<{ error?: string }> {
  try {
    await requireWrite();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  const to = toLocationCode.trim();
  if (!to) return { error: "ระบุช่องปลายทาง" };
  const [loc, lot] = await Promise.all([
    db.location.findUnique({ where: { code: to } }),
    db.lot.findUnique({ where: { id: lotId } }),
  ]);
  if (!loc) return { error: `ไม่พบช่อง ${to}` };
  if (!lot) return { error: "ไม่พบลอต" };
  if (lot.locationCode === to) return { error: "ลอตนี้อยู่ช่องนี้อยู่แล้ว" };

  await db.lot.update({ where: { id: lotId }, data: { locationCode: to } });
  revalidatePath("/map");
  revalidatePath("/locations");
  revalidatePath("/products");
  return {};
}

/** Swap the contents of two bins (all lots in A ↔ all lots in B). */
export async function swapLocationsAction(
  codeA: string,
  codeB: string
): Promise<{ error?: string }> {
  try {
    await requireWrite();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  const a = codeA.trim();
  const b = codeB.trim();
  if (!a || !b || a === b) return { error: "เลือกช่องปลายทางที่ต่างกัน" };
  const [locA, locB] = await Promise.all([
    db.location.findUnique({ where: { code: a } }),
    db.location.findUnique({ where: { code: b } }),
  ]);
  if (!locA || !locB) return { error: "ไม่พบช่องที่เลือก" };

  // Reassign by lot id (locationCode is a FK, so a sentinel value can't be used).
  const [lotsA, lotsB] = await Promise.all([
    db.lot.findMany({ where: { locationCode: a }, select: { id: true } }),
    db.lot.findMany({ where: { locationCode: b }, select: { id: true } }),
  ]);
  const idsA = lotsA.map((l) => l.id);
  const idsB = lotsB.map((l) => l.id);
  await db.$transaction([
    db.lot.updateMany({ where: { id: { in: idsA } }, data: { locationCode: b } }),
    db.lot.updateMany({ where: { id: { in: idsB } }, data: { locationCode: a } }),
  ]);
  revalidatePath("/map");
  revalidatePath("/locations");
  revalidatePath("/products");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { PLAN_KEY } from "@/lib/views/plan";

/** Save the production plan (finished-good code → planned quantity). */
export async function savePlanAction(plan: Record<string, number>): Promise<{ error?: string }> {
  try {
    await requireWrite();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  // Keep only positive numbers.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(plan)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) clean[k] = n;
  }
  const value = JSON.stringify(clean);
  await db.appSetting.upsert({
    where: { key: PLAN_KEY },
    update: { value },
    create: { key: PLAN_KEY, value },
  });
  revalidatePath("/plan");
  return {};
}

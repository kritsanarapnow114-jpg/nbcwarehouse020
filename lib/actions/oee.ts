"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";

export type OeeMachineInput = {
  name: string;
  operation: "PRODUCTION" | "UNLOADING";
  standardRate: number;
  rateUnit: string;
};

function revalidateOee() {
  // Machines drive the Settings list, the Receive capture form, and the OEE dashboard.
  revalidatePath("/settings");
  revalidatePath("/receive");
  revalidatePath("/oee");
}

export async function createOeeMachineAction(
  input: OeeMachineInput
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  const name = input.name.trim();
  if (!name) return { error: "Machine needs a name (กรุณาตั้งชื่อเครื่อง)" };
  if (!(input.standardRate > 0)) {
    return { error: "Standard rate must be greater than 0 (ค่ามาตรฐานต้องมากกว่า 0)" };
  }

  const max = await db.oeeMachine.aggregate({ _max: { sortOrder: true } });
  await db.oeeMachine.create({
    data: {
      name,
      operation: input.operation,
      standardRate: input.standardRate,
      rateUnit: input.rateUnit.trim() || "kg/hr",
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidateOee();
  return {};
}

export async function updateOeeMachineAction(
  id: string,
  input: OeeMachineInput & { active?: boolean }
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  const name = input.name.trim();
  if (!name) return { error: "Machine needs a name (กรุณาตั้งชื่อเครื่อง)" };
  if (!(input.standardRate > 0)) {
    return { error: "Standard rate must be greater than 0 (ค่ามาตรฐานต้องมากกว่า 0)" };
  }
  await db.oeeMachine.update({
    where: { id },
    data: {
      name,
      operation: input.operation,
      standardRate: input.standardRate,
      rateUnit: input.rateUnit.trim() || "kg/hr",
      ...(input.active != null ? { active: input.active } : {}),
    },
  });
  revalidateOee();
  return {};
}

export async function deleteOeeMachineAction(id: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
  // Receipts already scored against this machine keep their numbers — the FK is
  // ON DELETE SET NULL, so history stays intact; deleting just retires the machine.
  const usedCount = await db.receipt.count({ where: { oeeMachineId: id } });
  if (usedCount > 0) {
    // Soft-retire instead of deleting so past OEE runs keep their machine link.
    await db.oeeMachine.update({ where: { id }, data: { active: false } });
    revalidateOee();
    return {};
  }
  await db.oeeMachine.delete({ where: { id } });
  revalidateOee();
  return {};
}

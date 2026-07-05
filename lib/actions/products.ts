"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { buildStockCard } from "@/lib/calc/stockCard";
import { getProductDetail } from "@/lib/views/products";
import { Category } from "@prisma/client";

export async function getProductDetailAction(code: string) {
  return getProductDetail(code);
}

export type FormState = { error?: string };

function revalidateInventoryPaths() {
  revalidatePath("/products");
  revalidatePath("/dashboard");
  revalidatePath("/aging");
  revalidatePath("/locations");
}

export async function createProductAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  const category = String(formData.get("category") ?? "") as Category;
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const nameTh = String(formData.get("nameTh") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const pallet = Number(formData.get("pallet") ?? 500);
  const width = Number(formData.get("width") ?? 1);
  const length = Number(formData.get("length") ?? 1);
  const stackLevels = Number(formData.get("stackLevels") ?? 1);

  if (!code || !nameEn || !nameTh || !unit) {
    return { error: "Fill in code, names, and unit (กรอกรหัส ชื่อ และหน่วยให้ครบ)" };
  }
  const existing = await db.product.findUnique({ where: { code } });
  if (existing) {
    return { error: `Code ${code} already exists (รหัสนี้มีอยู่แล้ว)` };
  }

  await db.product.create({
    data: {
      code,
      category,
      nameEn,
      nameTh,
      unit,
      price,
      pallet,
      width,
      length,
      stackLevels,
    },
  });

  revalidateInventoryPaths();
  return {};
}

export async function deleteProductAction(code: string) {
  await db.product.update({
    where: { code },
    data: { deletedAt: new Date() },
  });
  revalidateInventoryPaths();
}

export async function toggleLotQcAction(lotId: string) {
  const lot = await db.lot.findUnique({ where: { id: lotId } });
  if (!lot) return;
  await db.lot.update({
    where: { id: lotId },
    data: { status: lot.status === "QC" ? "OK" : "QC" },
  });
  revalidateInventoryPaths();
}

export async function toggleAllLotsQcAction(productCode: string) {
  const lots = await db.lot.findMany({ where: { productCode } });
  if (lots.length === 0) return;
  const allQc = lots.every((l) => l.status === "QC");
  await db.lot.updateMany({
    where: { productCode },
    data: { status: allQc ? "OK" : "QC" },
  });
  revalidateInventoryPaths();
}

export async function updateLotExpiryAction(lotId: string, expDate: string) {
  await db.lot.update({
    where: { id: lotId },
    data: { expDate: expDate ? new Date(expDate) : null },
  });
  revalidateInventoryPaths();
}

/** Extend a lot's shelf-life from the Aging page (updates both mfgDate and expDate). */
export async function extendLotShelfLifeAction(
  lotId: string,
  mfgDate: string,
  expDate: string
) {
  await db.lot.update({
    where: { id: lotId },
    data: {
      mfgDate: mfgDate ? new Date(mfgDate) : null,
      expDate: expDate ? new Date(expDate) : null,
    },
  });
  revalidateInventoryPaths();
}

export async function getStockCardAction(productCode: string) {
  const entries = await buildStockCard(productCode);
  return entries.map((e) => ({
    date: e.date.toISOString(),
    doc: e.doc,
    type: e.type,
    lot: e.lot,
    in: e.in,
    out: e.out,
    balance: e.balance,
  }));
}

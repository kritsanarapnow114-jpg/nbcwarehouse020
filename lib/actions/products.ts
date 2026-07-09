"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { buildStockCard } from "@/lib/calc/stockCard";
import { getProductDetail } from "@/lib/views/products";
import { productLabel } from "@/lib/calc/productName";
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
  try {
    await requireWrite();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not allowed" };
  }
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
  const minQty = Number(formData.get("minQty") ?? 0);
  const maxQty = Number(formData.get("maxQty") ?? 0);

  if (!code || !nameEn || !unit) {
    return { error: "Fill in code, name, and unit (กรอกรหัส ชื่อ และหน่วยให้ครบ)" };
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
      nameTh: nameTh || null,
      unit,
      price,
      pallet,
      width,
      length,
      stackLevels,
      minQty: minQty > 0 ? minQty : 0,
      maxQty: maxQty > 0 ? maxQty : 0,
    },
  });

  revalidateInventoryPaths();
  return {};
}

export async function deleteProductAction(code: string) {
  await requireWrite();
  await db.product.update({
    where: { code },
    data: { deletedAt: new Date() },
  });
  revalidateInventoryPaths();
}

export async function toggleLotQcAction(lotId: string) {
  await requireWrite();
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

/** Edit a lot's identity/dates from the product drawer: lot number, mfg date,
 *  expiry date. Lot number must stay unique within its product+location bin. */
export async function updateLotAction(
  lotId: string,
  data: { lotNo: string; mfgDate: string; expDate: string }
): Promise<{ error?: string }> {
  await requireWrite();
  const lot = await db.lot.findUnique({ where: { id: lotId } });
  if (!lot) return { error: "Lot not found" };
  const lotNo = data.lotNo.trim() || "-";
  if (lotNo !== lot.lotNo) {
    const clash = await db.lot.findFirst({
      where: {
        id: { not: lotId },
        productCode: lot.productCode,
        locationCode: lot.locationCode,
        lotNo,
      },
    });
    if (clash) {
      return {
        error: `Lot "${lotNo}" already exists in ${lot.locationCode} for this product (เลข Lot ซ้ำในตำแหน่งเดียวกัน)`,
      };
    }
  }
  await db.lot.update({
    where: { id: lotId },
    data: {
      lotNo,
      mfgDate: data.mfgDate ? new Date(data.mfgDate) : null,
      expDate: data.expDate ? new Date(data.expDate) : null,
    },
  });
  revalidateInventoryPaths();
  return {};
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

export async function updateProductAction(
  code: string,
  data: {
    nameEn: string;
    nameTh: string;
    category: Category;
    unit: string;
    price: number;
    pallet: number;
    width: number;
    length: number;
    stackLevels: number;
    minQty: number;
    maxQty: number;
  }
) {
  await requireWrite();
  if (!data.nameEn.trim() || !data.unit.trim()) {
    throw new Error("Fill in name and unit (กรอกชื่อและหน่วยให้ครบ)");
  }
  if (data.price < 0 || data.pallet <= 0 || data.width <= 0 || data.length <= 0 || data.stackLevels <= 0) {
    throw new Error("Price, pallet size, and storage dimensions must be greater than 0 (ราคา ขนาดพาเลท และขนาดพื้นที่ต้องมากกว่า 0)");
  }
  if (data.maxQty > 0 && data.minQty > data.maxQty) {
    throw new Error("Min must not exceed Max (Min ต้องไม่เกิน Max)");
  }
  await db.product.update({
    where: { code },
    data: {
      ...data,
      nameTh: data.nameTh || null,
      minQty: data.minQty > 0 ? data.minQty : 0,
      maxQty: data.maxQty > 0 ? data.maxQty : 0,
    },
  });
  revalidateInventoryPaths();
}

export type BomLineInput = {
  materialProductCode: string;
  qtyPerUnit: number;
  perQty: number;
  unit: string;
};

export async function getBomAction(finishedProductCode: string) {
  const bom = await db.bom.findUnique({
    where: { finishedProductCode },
    include: { lines: { include: { materialProduct: true } } },
  });
  if (!bom) return [];
  return bom.lines
    .filter((l) => l.qtyPerUnit > 0)
    .map((l) => ({
      id: l.id,
      materialProductCode: l.materialProductCode,
      materialName: productLabel(l.materialProduct.nameEn, l.materialProduct.nameTh),
      qtyPerUnit: l.qtyPerUnit,
      perQty: l.perQty,
      unit: l.unit,
    }));
}

export async function saveBomAction(finishedProductCode: string, lines: BomLineInput[]) {
  if (lines.some((l) => !l.materialProductCode || l.qtyPerUnit <= 0)) {
    throw new Error(
      "Every material line needs a product and qty > 0 (ทุกรายการต้องเลือกวัตถุดิบและใส่จำนวนมากกว่า 0)"
    );
  }
  const codes = new Set(lines.map((l) => l.materialProductCode));
  if (codes.size !== lines.length) {
    throw new Error("Each material can only appear once in the BOM (วัตถุดิบซ้ำในสูตรไม่ได้)");
  }

  let bom = await db.bom.findUnique({ where: { finishedProductCode }, include: { lines: true } });
  if (!bom) {
    bom = await db.bom.create({ data: { finishedProductCode }, include: { lines: true } });
  }

  const existingByCode = new Map(bom.lines.map((l) => [l.materialProductCode, l]));
  const keepCodes = new Set(lines.map((l) => l.materialProductCode));

  for (const line of lines) {
    const existing = existingByCode.get(line.materialProductCode);
    if (existing) {
      await db.bomLine.update({
        where: { id: existing.id },
        data: { qtyPerUnit: line.qtyPerUnit, perQty: line.perQty > 0 ? line.perQty : 1, unit: line.unit },
      });
    } else {
      await db.bomLine.create({
        data: {
          bomId: bom.id,
          materialProductCode: line.materialProductCode,
          qtyPerUnit: line.qtyPerUnit,
          perQty: line.perQty > 0 ? line.perQty : 1,
          unit: line.unit,
        },
      });
    }
  }

  for (const existing of bom.lines) {
    if (!keepCodes.has(existing.materialProductCode)) {
      try {
        await db.bomLine.delete({ where: { id: existing.id } });
      } catch {
        // Referenced by a past production receipt's material-loss record — can't
        // hard-delete without breaking that record's FK, so soft-remove instead by
        // zeroing qty (filtered out of future BOM reads/receipts above).
        await db.bomLine.update({ where: { id: existing.id }, data: { qtyPerUnit: 0 } });
      }
    }
  }

  revalidatePath("/products");
  revalidatePath("/receive");
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

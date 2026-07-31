"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";

/**
 * Stage material for the SILO: issue it out of warehouse stock now (a real Issue,
 * so on-hand and the Stock Card stay correct) and create a "waiting to load"
 * record. Loaders fill in the actual loads (time/machine/SILO) afterwards.
 */
export async function stageForSiloAction(input: {
  lotId: string;
  qty: number;
  stagedBy?: string | null;
  docDate: string;
}): Promise<{ docNo?: string; error?: string }> {
  try {
    await requireWrite();
    const qty = Number(input.qty) || 0;
    if (qty <= 0) return { error: "จำนวนต้องมากกว่า 0 (quantity must be > 0)" };
    const docDate = new Date(input.docDate);

    const issNo = await nextDocNumber("ISS", docDate);
    const sfNo = await nextDocNumber("SF", docDate);

    await db.$transaction(async (tx) => {
      const lot = await tx.lot.findUnique({ where: { id: input.lotId } });
      if (!lot) throw new Error("ไม่พบล็อตในสต็อก (stock lot not found)");
      if (qty > lot.qty) {
        throw new Error(`สต็อกไม่พอ — มี ${lot.qty.toLocaleString()}, ขอเบิก ${qty.toLocaleString()}`);
      }

      await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - qty } });

      const issue = await tx.issue.create({
        data: {
          docNo: issNo,
          issueTo: "SILO — รอโหลด",
          stockType: "STOCK",
          docDate,
          shippedDate: docDate,
        },
      });
      await tx.issueLine.create({
        data: {
          issueId: issue.id,
          productCode: lot.productCode,
          selectedLotId: lot.id,
          qty,
          stockType: "STOCK",
        },
      });

      await tx.siloStaging.create({
        data: {
          docNo: sfNo,
          productCode: lot.productCode,
          lotNo: lot.lotNo,
          sourceLoc: lot.locationCode,
          qtyStaged: qty,
          stagedBy: input.stagedBy?.trim() || null,
          stagedAt: docDate,
        },
      });
    });

    safeRevalidate(["/silo", "/issue", "/dashboard", "/products", "/aging", "/locations", "/map"]);
    return { docNo: sfNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "เบิกไม่สำเร็จ (failed to stage)" };
  }
}

/**
 * A loader records loading part (or all) of a staged item into a machine/SILO.
 * Does not touch stock (already issued at staging) — it only logs the load and
 * advances how much of the staged qty has been loaded.
 */
export async function loadSiloAction(input: {
  stagingId: string;
  qty: number;
  machine?: string | null;
  silo?: string | null;
  operator?: string | null;
  loadedAt: string;
}): Promise<{ error?: string }> {
  try {
    await requireWrite();
    const qty = Number(input.qty) || 0;
    if (qty <= 0) return { error: "จำนวนต้องมากกว่า 0 (quantity must be > 0)" };
    const loadedAt = new Date(input.loadedAt);

    await db.$transaction(async (tx) => {
      const st = await tx.siloStaging.findUnique({ where: { id: input.stagingId } });
      if (!st) throw new Error("ไม่พบรายการรอโหลด (staging not found)");
      const remaining = st.qtyStaged - st.qtyLoaded;
      if (qty > remaining + 1e-6) {
        throw new Error(`โหลดเกินที่เหลือ — เหลือ ${remaining.toLocaleString()}, ขอโหลด ${qty.toLocaleString()}`);
      }
      await tx.siloLoad.create({
        data: {
          stagingId: st.id,
          qty,
          machine: input.machine?.trim() || null,
          silo: input.silo?.trim() || null,
          operator: input.operator?.trim() || null,
          loadedAt,
        },
      });
      await tx.siloStaging.update({
        where: { id: st.id },
        data: { qtyLoaded: st.qtyLoaded + qty },
      });
    });

    safeRevalidate(["/silo"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "โหลดไม่สำเร็จ (failed to load)" };
  }
}

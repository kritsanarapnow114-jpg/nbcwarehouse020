"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { eligibleLots } from "@/lib/calc/fefo";
import { bagSize } from "@/lib/calc/siloBags";

const SILO_PATHS = ["/silo", "/issue", "/dashboard", "/products", "/aging", "/locations", "/map"];

/**
 * Stage material for the SILO: issue it out of warehouse stock now (a real Issue,
 * so on-hand and the Stock Card stay correct) and create a "waiting to load"
 * record. The unloading machine is chosen here; loaders just tap start/finish
 * per bag afterwards. Draws across every stock record of the chosen lot+location.
 */
export async function stageForSiloAction(input: {
  lotId: string;
  qty: number;
  machine?: string | null;
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
      const sel = await tx.lot.findUnique({ where: { id: input.lotId }, include: { product: true } });
      if (!sel) throw new Error("ไม่พบล็อตในสต็อก (stock lot not found)");

      const siblings = await tx.lot.findMany({
        where: { productCode: sel.productCode, lotNo: sel.lotNo, locationCode: sel.locationCode },
      });
      const ordered = eligibleLots(
        siblings.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          qty: l.qty,
          status: l.status,
          expDate: l.expDate,
          mfgDate: l.mfgDate,
          recvDate: l.recvDate,
          locationCode: l.locationCode,
        }))
      );
      const avail = ordered.reduce((s, l) => s + l.qty, 0);
      if (avail < qty) {
        throw new Error(`สต็อกไม่พอ — มี ${avail.toLocaleString()}, ขอเบิก ${qty.toLocaleString()}`);
      }

      const issue = await tx.issue.create({
        data: { docNo: issNo, issueTo: "SILO — รอโหลด", stockType: "STOCK", docDate, shippedDate: docDate },
      });

      let remaining = qty;
      for (const s of ordered) {
        if (remaining <= 0) break;
        const take = Math.min(s.qty, remaining);
        await tx.lot.update({ where: { id: s.id }, data: { qty: s.qty - take } });
        await tx.issueLine.create({
          data: { issueId: issue.id, productCode: sel.productCode, selectedLotId: s.id, qty: take, stockType: "STOCK" },
        });
        remaining -= take;
      }

      await tx.siloStaging.create({
        data: {
          docNo: sfNo,
          productCode: sel.productCode,
          lotNo: sel.lotNo,
          sourceLoc: sel.locationCode,
          qtyStaged: qty,
          palletSize: sel.product.pallet > 0 ? sel.product.pallet : null,
          machine: input.machine?.trim() || null,
          issueId: issue.id,
          stagedBy: input.stagedBy?.trim() || null,
          stagedAt: docDate,
        },
      });
    });

    safeRevalidate(SILO_PATHS);
    return { docNo: sfNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "เบิกไม่สำเร็จ (failed to stage)" };
  }
}

/** Tap 1 — a loader starts loading a bag. Records the start time; no typing. */
export async function startBagAction(input: {
  stagingId: string;
  bagNo: number;
}): Promise<{ error?: string }> {
  try {
    await requireWrite();
    await db.$transaction(async (tx) => {
      const st = await tx.siloStaging.findUnique({ where: { id: input.stagingId }, include: { loads: true } });
      if (!st) throw new Error("ไม่พบรายการรอโหลด (staging not found)");
      if (st.loads.some((l) => l.bagNo === input.bagNo)) {
        throw new Error(`ถุงที่ ${input.bagNo} เริ่มโหลดไปแล้ว (bag already started)`);
      }
      await tx.siloLoad.create({
        data: {
          stagingId: st.id,
          bagNo: input.bagNo,
          qty: bagSize(st.qtyStaged, st.palletSize, input.bagNo),
          machine: st.machine,
          operator: st.stagedBy,
          startedAt: new Date(),
          loadedAt: null,
        },
      });
    });
    safeRevalidate(["/silo"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "เริ่มโหลดไม่สำเร็จ (failed to start)" };
  }
}

/** Tap 2 — finish loading a bag. Records the finish time and counts it as loaded. */
export async function finishBagAction(input: { loadId: string }): Promise<{ error?: string }> {
  try {
    await requireWrite();
    await db.$transaction(async (tx) => {
      const ld = await tx.siloLoad.findUnique({ where: { id: input.loadId } });
      if (!ld) throw new Error("ไม่พบรายการโหลด (load not found)");
      if (ld.loadedAt) return; // already finished
      await tx.siloLoad.update({ where: { id: ld.id }, data: { loadedAt: new Date() } });
      await tx.siloStaging.update({
        where: { id: ld.stagingId },
        data: { qtyLoaded: { increment: ld.qty } },
      });
    });
    safeRevalidate(["/silo"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ปิดโหลดไม่สำเร็จ (failed to finish)" };
  }
}

/** Cancel a bag that is still loading (before it's finished). */
export async function cancelBagAction(input: { loadId: string }): Promise<{ error?: string }> {
  try {
    await requireWrite();
    await db.$transaction(async (tx) => {
      const ld = await tx.siloLoad.findUnique({ where: { id: input.loadId } });
      if (!ld) return;
      if (ld.loadedAt) {
        // Finished bag: also roll back the loaded qty.
        await tx.siloStaging.update({ where: { id: ld.stagingId }, data: { qtyLoaded: { decrement: ld.qty } } });
      }
      await tx.siloLoad.delete({ where: { id: ld.id } });
    });
    safeRevalidate(["/silo"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ (failed to cancel)" };
  }
}

/** Fill in / change the SILO of a bag afterwards (entered later, not at load time). */
export async function setBagSiloAction(input: { loadId: string; silo: string }): Promise<{ error?: string }> {
  try {
    await requireWrite();
    await db.siloLoad.update({ where: { id: input.loadId }, data: { silo: input.silo.trim() || null } });
    safeRevalidate(["/silo"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "บันทึก SILO ไม่สำเร็จ (failed)" };
  }
}

/**
 * Delete a staging record entirely (removes it + all its load history) and return
 * the issued stock back to the lot — i.e. reverse the whole staging.
 */
export async function deleteStagingAction(input: { id: string }): Promise<{ error?: string }> {
  try {
    await requireWrite();
    await db.$transaction(async (tx) => {
      const st = await tx.siloStaging.findUnique({ where: { id: input.id } });
      if (!st) throw new Error("ไม่พบรายการ (staging not found)");

      if (st.issueId) {
        const issue = await tx.issue.findUnique({ where: { id: st.issueId }, include: { lines: true } });
        if (issue && !issue.reversedAt) {
          for (const line of issue.lines) {
            if (!line.selectedLotId) continue;
            const lot = await tx.lot.findUnique({ where: { id: line.selectedLotId } });
            if (!lot) continue;
            await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty + line.qty } });
          }
          await tx.issue.update({ where: { id: issue.id }, data: { reversedAt: new Date() } });
        }
      }

      await tx.siloStaging.delete({ where: { id: st.id } }); // cascades SiloLoad
    });
    safeRevalidate(SILO_PATHS);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ลบไม่สำเร็จ (failed to delete)" };
  }
}

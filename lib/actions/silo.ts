"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { eligibleLots } from "@/lib/calc/fefo";

const SILO_PATHS = ["/silo", "/issue", "/dashboard", "/products", "/aging", "/locations", "/map"];

/**
 * Stage material for the SILO: issue it out of warehouse stock now (a real Issue,
 * so on-hand and the Stock Card stay correct) and create a "waiting to load"
 * record. Loaders fill in the actual loads (time/machine/SILO) afterwards.
 * Draws across every stock record of the chosen lot+location (FEFO-first), like Issue.
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
      const sel = await tx.lot.findUnique({ where: { id: input.lotId }, include: { product: true } });
      if (!sel) throw new Error("ไม่พบล็อตในสต็อก (stock lot not found)");

      // Draw across all records of this same lot in this same location, FEFO-first.
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
        data: {
          docNo: issNo,
          issueTo: "SILO — รอโหลด",
          stockType: "STOCK",
          docDate,
          shippedDate: docDate,
        },
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

/**
 * A loader records loading one bag (or an ad-hoc qty) of a staged item into a
 * machine/SILO. Does not touch stock (already issued at staging) — it only logs
 * the load and advances how much of the staged qty has been loaded.
 */
export async function loadSiloAction(input: {
  stagingId: string;
  bagNo?: number | null;
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
      const st = await tx.siloStaging.findUnique({ where: { id: input.stagingId }, include: { loads: true } });
      if (!st) throw new Error("ไม่พบรายการรอโหลด (staging not found)");

      if (input.bagNo != null && st.loads.some((l) => l.bagNo === input.bagNo)) {
        throw new Error(`ถุงที่ ${input.bagNo} โหลดไปแล้ว (bag already loaded)`);
      }
      const remaining = st.qtyStaged - st.qtyLoaded;
      if (qty > remaining + 1e-6) {
        throw new Error(`โหลดเกินที่เหลือ — เหลือ ${remaining.toLocaleString()}, ขอโหลด ${qty.toLocaleString()}`);
      }
      await tx.siloLoad.create({
        data: {
          stagingId: st.id,
          bagNo: input.bagNo ?? null,
          qty,
          machine: input.machine?.trim() || null,
          silo: input.silo?.trim() || null,
          operator: input.operator?.trim() || null,
          loadedAt,
        },
      });
      await tx.siloStaging.update({ where: { id: st.id }, data: { qtyLoaded: st.qtyLoaded + qty } });
    });

    safeRevalidate(["/silo"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "โหลดไม่สำเร็จ (failed to load)" };
  }
}

/**
 * Delete a staging record entirely (removes it + all its load history) and return
 * the issued stock back to the lot — i.e. reverse the whole staging. Use this to
 * undo a mistaken เบิก; the Stock Card stays correct because the Issue is reversed.
 */
export async function deleteStagingAction(input: {
  id: string;
}): Promise<{ error?: string }> {
  try {
    await requireWrite();

    await db.$transaction(async (tx) => {
      const st = await tx.siloStaging.findUnique({ where: { id: input.id } });
      if (!st) throw new Error("ไม่พบรายการ (staging not found)");

      // Reverse the underlying Issue: add each issued qty back to its lot, then
      // mark the Issue reversed so it drops out of the Stock Card.
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

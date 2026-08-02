"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { fifoLots } from "@/lib/calc/fefo";
import { getAppSetting } from "@/lib/views/settings";
import { BOM_SOURCE_KEY, parseList } from "@/lib/settingsKeys";

export type ReceiveLineInput = {
  productCode: string;
  orderedQty: number | null;
  recvQty: number;
  lotNo: string;
  locationCode: string;
  mfgDate: string | null;
  expDate: string | null;
  stockType?: "STOCK" | "NON_STOCK";
  weightKg?: number | null;
  suNo?: number | null;
  palletFull?: boolean | null;
  packTime?: string | null;
};

export type ConfirmReceiptInput = {
  mode: "PO" | "PRODUCTION";
  poId: string | null;
  invoiceNo: string | null;
  materialDoc?: string | null;
  remark?: string | null;
  stockType?: "STOCK" | "NON_STOCK";
  docDate: string;
  lines: ReceiveLineInput[];
  producedTotal?: number;
  prodLoss?: number;
  bomLoss?: { bomLineId: string; lossQty: number }[];
  // BOM lines the operator chose NOT to consume this run (e.g. reused material
  // already on the line) — skip deducting these from stock.
  excludeBomLineIds?: string[];
  // OEE capture (PRODUCTION only): line/machine, planned+break minutes, downtime
  // (with responsible function), quality-loss breakdown and repack/scrap.
  oeeLine?: string | null;
  plannedMin?: number | null;
  breakMin?: number | null;
  downtime?: { minutes: number; reason: string; category?: string; owner?: string }[];
  oeeQuality?: {
    repack: number;
    scrap: number;
    losses: { reason: string; qty: number }[];
  };
};

function revalidateAll() {
  safeRevalidate(["/receive", "/dashboard", "/products", "/po", "/aging", "/locations", "/map", "/nonstock"]);
}

export async function confirmReceiptAction(
  input: ConfirmReceiptInput
): Promise<{ docNo?: string; error?: string }> {
  const docDate = new Date(input.docDate);

  try {
    await requireWrite();
    const docNo = await nextDocNumber("RC", docDate);

    await db.$transaction(async (tx) => {
    // Production receipts wait for warehouse verification before finished goods
    // enter stock; PO/normal receipts are verified as soon as they're created.
    const isProduction = input.mode === "PRODUCTION";
    const receipt = await tx.receipt.create({
      data: {
        docNo,
        mode: input.mode,
        poId: input.poId,
        invoiceNo: input.mode === "PO" ? input.invoiceNo : null,
        materialDoc: input.materialDoc?.trim() || null,
        remark: input.remark?.trim() || null,
        stockType: input.stockType ?? "STOCK",
        docDate,
        verifiedAt: isProduction ? null : docDate,
        producedTotal: input.mode === "PRODUCTION" ? input.producedTotal ?? 0 : null,
        prodLoss: input.mode === "PRODUCTION" ? input.prodLoss ?? 0 : null,
        // OEE capture only applies to production runs.
        oeeLine: isProduction ? input.oeeLine?.trim() || null : null,
        plannedMin: isProduction && input.oeeLine ? input.plannedMin ?? null : null,
        breakMin: isProduction && input.oeeLine ? input.breakMin ?? null : null,
        downtime:
          isProduction && input.oeeLine && input.downtime?.length
            ? input.downtime.filter((d) => d.minutes > 0)
            : undefined,
        oeeQuality:
          isProduction && input.oeeLine && input.oeeQuality
            ? {
                repack: input.oeeQuality.repack || 0,
                scrap: input.oeeQuality.scrap || 0,
                losses: (input.oeeQuality.losses ?? []).filter((l) => l.qty > 0),
              }
            : undefined,
      },
    });

    // SU numbers are keyed by the operator; fall back to a global running number
    // for any production line left blank.
    let suNext = isProduction
      ? ((await tx.receiptLine.aggregate({ _max: { suNo: true } }))._max.suNo ?? 0) + 1
      : 0;

    for (const line of input.lines) {
      if (line.recvQty <= 0) continue;

      const lotNo = line.lotNo || "-";
      let lotId: string | null = null;
      const suNo = isProduction ? (line.suNo ?? suNext++) : null;

      if (line.stockType === "NON_STOCK") {
        // Non-Stock: hold outside of valued inventory until a Conversion event
        // brings a chosen quantity into real stock. Don't create a Lot.
        const holding = await tx.nonStockHolding.findFirst({
          where: { productCode: line.productCode, locationCode: line.locationCode, lotNo },
        });
        if (holding) {
          await tx.nonStockHolding.update({
            where: { id: holding.id },
            data: {
              qty: holding.qty + line.recvQty,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : holding.mfgDate,
              expDate: line.expDate ? new Date(line.expDate) : holding.expDate,
            },
          });
        } else {
          await tx.nonStockHolding.create({
            data: {
              productCode: line.productCode,
              locationCode: line.locationCode,
              lotNo,
              qty: line.recvQty,
              recvDate: docDate,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
              expDate: line.expDate ? new Date(line.expDate) : null,
              receiptId: receipt.id,
            },
          });
        }
      } else if (isProduction) {
        // Finished goods from production wait for verification — don't create the
        // stock lot yet (lotId stays null). It's created on verifyReceiptAction.
      } else {
        let lot = await tx.lot.findFirst({
          where: { productCode: line.productCode, locationCode: line.locationCode, lotNo },
        });
        if (lot) {
          lot = await tx.lot.update({
            where: { id: lot.id },
            data: {
              qty: lot.qty + line.recvQty,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : lot.mfgDate,
              expDate: line.expDate ? new Date(line.expDate) : lot.expDate,
            },
          });
        } else {
          lot = await tx.lot.create({
            data: {
              productCode: line.productCode,
              locationCode: line.locationCode,
              lotNo,
              qty: line.recvQty,
              status: "OK",
              recvDate: docDate,
              mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
              expDate: line.expDate ? new Date(line.expDate) : null,
            },
          });
        }
        lotId = lot.id;
      }

      await tx.receiptLine.create({
        data: {
          receiptId: receipt.id,
          productCode: line.productCode,
          orderedQty: line.orderedQty,
          recvQty: line.recvQty,
          lotNo,
          locationCode: line.locationCode,
          mfgDate: line.mfgDate ? new Date(line.mfgDate) : null,
          expDate: line.expDate ? new Date(line.expDate) : null,
          suNo,
          weightKg: line.weightKg ?? null,
          palletFull: line.palletFull ?? null,
          packTime: line.packTime?.trim() || null,
          lotId,
          stockType: line.stockType ?? "STOCK",
        },
      });

      if (input.mode === "PO" && input.poId) {
        const poLine = await tx.purchaseOrderLine.findFirst({
          where: { poId: input.poId, productCode: line.productCode },
        });
        if (poLine) {
          await tx.purchaseOrderLine.update({
            where: { id: poLine.id },
            data: { received: poLine.received + line.recvQty },
          });
        }
      }
    }

    if (input.mode === "PO" && input.poId) {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: input.poId },
        include: { lines: true },
      });
      if (po) {
        const allDone = po.lines.every((l) => l.received >= l.ordered);
        const anyReceived = po.lines.some((l) => l.received > 0);
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: allDone ? "COMPLETE" : anyReceived ? "PENDING" : "OPEN" },
        });
      }
    }

    if (input.mode === "PRODUCTION" && input.bomLoss) {
      for (const bl of input.bomLoss) {
        if (bl.lossQty > 0) {
          await tx.receiptBomLoss.create({
            data: { receiptId: receipt.id, bomLineId: bl.bomLineId, lossQty: bl.lossQty },
          });
        }
      }
    }

    // Deduct BOM materials actually consumed by this production run (qtyPerUnit ×
    // produced, plus any recorded scrap/loss) from raw-material stock, FEFO-first.
    if (input.mode === "PRODUCTION" && input.lines.length > 0) {
      const finishedProductCode = input.lines[0].productCode;
      const bom = await tx.bom.findUnique({
        where: { finishedProductCode },
        include: { lines: true },
      });
      if (bom) {
        const bomSource = parseList(await getAppSetting(BOM_SOURCE_KEY));
        const lossByBomLineId = new Map((input.bomLoss ?? []).map((bl) => [bl.bomLineId, bl.lossQty]));
        const excluded = new Set(input.excludeBomLineIds ?? []);
        for (const bomLine of bom.lines) {
          if (bomLine.qtyPerUnit <= 0) continue; // soft-removed from the BOM
          if (excluded.has(bomLine.id)) continue; // reused material — don't deduct this run
          // Consume qtyPerUnit for every full `perQty` produced (e.g. 1 pallet
          // per 750 kg): a partial batch doesn't consume another unit.
          const perQty = bomLine.perQty > 0 ? bomLine.perQty : 1;
          const consumed = Math.floor((input.producedTotal ?? 0) / perQty) * bomLine.qtyPerUnit;
          const loss = lossByBomLineId.get(bomLine.id) ?? 0;
          const totalNeeded = consumed + loss;
          if (totalNeeded <= 0) continue;

          const materialLots = await tx.lot.findMany({
            where: {
              productCode: bomLine.materialProductCode,
              ...(bomSource.length > 0 ? { locationCode: { in: bomSource } } : {}),
            },
          });
          // BOM materials are consumed FIFO (oldest received first).
          const eligible = fifoLots(
            materialLots.map((l) => ({
              id: l.id,
              lotNo: l.lotNo,
              qty: l.qty,
              status: l.status,
              recvDate: l.recvDate,
            }))
          );
          const totalAvailable = eligible.reduce((s, l) => s + l.qty, 0);
          if (totalAvailable < totalNeeded) {
            throw new Error(
              `Not enough stock of ${bomLine.materialProductCode} for this production run — need ${totalNeeded.toLocaleString()}, have ${totalAvailable.toLocaleString()} (วัตถุดิบ ${bomLine.materialProductCode} ไม่พอสำหรับการผลิตนี้)`
            );
          }

          let remaining = totalNeeded;
          for (const lot of eligible) {
            if (remaining <= 0) break;
            const take = Math.min(lot.qty, remaining);
            await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - take } });
            // Record exactly how much came off each lot so a later reversal can
            // add the same quantities back to the same lots.
            await tx.receiptMaterialConsumption.create({
              data: { receiptId: receipt.id, lotId: lot.id, qty: take },
            });
            remaining -= take;
          }
        }
      }
    }
    });

    revalidateAll();
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to confirm receipt." };
  }
}

/**
 * Warehouse verifies a pending production receipt: the finished-goods lines now
 * enter stock (their lots are created) and the receipt is marked verified.
 */
export async function verifyReceiptAction(
  receiptId: string
): Promise<{ docNo?: string; error?: string }> {
  try {
    await requireWrite();
    const docNo = await db.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: receiptId },
        include: { lines: true },
      });
      if (!receipt) throw new Error("ไม่พบเอกสาร (receipt not found)");
      if (receipt.reversedAt) throw new Error("เอกสารถูกถอยไปแล้ว (already reversed)");
      if (receipt.verifiedAt) throw new Error("ตรวจสอบไปแล้ว (already verified)");

      for (const line of receipt.lines) {
        if (line.stockType === "NON_STOCK" || line.lotId || line.recvQty <= 0) continue;
        const lotNo = line.lotNo || "-";
        let lot = await tx.lot.findFirst({
          where: { productCode: line.productCode, locationCode: line.locationCode, lotNo },
        });
        if (lot) {
          lot = await tx.lot.update({
            where: { id: lot.id },
            data: {
              qty: lot.qty + line.recvQty,
              mfgDate: line.mfgDate ?? lot.mfgDate,
              expDate: line.expDate ?? lot.expDate,
            },
          });
        } else {
          lot = await tx.lot.create({
            data: {
              productCode: line.productCode,
              locationCode: line.locationCode,
              lotNo,
              qty: line.recvQty,
              status: "OK",
              recvDate: receipt.docDate,
              mfgDate: line.mfgDate,
              expDate: line.expDate,
            },
          });
        }
        await tx.receiptLine.update({ where: { id: line.id }, data: { lotId: lot.id } });
      }

      await tx.receipt.update({ where: { id: receipt.id }, data: { verifiedAt: new Date() } });
      return receipt.docNo;
    });

    revalidateAll();
    return { docNo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ตรวจสอบไม่สำเร็จ (failed to verify)" };
  }
}

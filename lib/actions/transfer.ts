"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";

export type TransferLineInput = { lotId: string; toLocationCode: string; qty: number };
export type ConfirmTransferInput = {
  operator: string;
  docDate: string;
  lines: TransferLineInput[];
};

function revalidateAll() {
  safeRevalidate(["/transfer", "/dashboard", "/products", "/locations", "/aging", "/map"]);
}

export async function confirmTransferAction(input: ConfirmTransferInput) {
  await requireWrite();
  const docDate = new Date(input.docDate);
  const docNo = await nextDocNumber("TRF", docDate);

  await db.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: { docNo, operator: input.operator, docDate },
    });

    for (const line of input.lines) {
      const lot = await tx.lot.findUnique({ where: { id: line.lotId } });
      if (!lot || line.qty <= 0 || line.qty > lot.qty) continue;
      if (lot.locationCode === line.toLocationCode) continue;

      await tx.transferLine.create({
        data: {
          transferId: transfer.id,
          lotId: lot.id,
          fromLocationCode: lot.locationCode,
          toLocationCode: line.toLocationCode,
          qty: line.qty,
        },
      });

      if (line.qty === lot.qty) {
        // Moving the whole lot. If the destination bin already holds a record of
        // the same product+lot, merge into it (drain this record) instead of just
        // relocating — otherwise the bin ends up with two records for one lot.
        const existing = await tx.lot.findFirst({
          where: {
            productCode: lot.productCode,
            locationCode: line.toLocationCode,
            lotNo: lot.lotNo,
            id: { not: lot.id },
          },
        });
        if (existing) {
          await tx.lot.update({ where: { id: existing.id }, data: { qty: { increment: line.qty } } });
          await tx.lot.update({ where: { id: lot.id }, data: { qty: 0 } });
        } else {
          await tx.lot.update({ where: { id: lot.id }, data: { locationCode: line.toLocationCode } });
        }
      } else {
        await tx.lot.update({ where: { id: lot.id }, data: { qty: { decrement: line.qty } } });
        const existing = await tx.lot.findFirst({
          where: {
            productCode: lot.productCode,
            locationCode: line.toLocationCode,
            lotNo: lot.lotNo,
          },
        });
        if (existing) {
          await tx.lot.update({ where: { id: existing.id }, data: { qty: { increment: line.qty } } });
        } else {
          await tx.lot.create({
            data: {
              productCode: lot.productCode,
              locationCode: line.toLocationCode,
              lotNo: lot.lotNo,
              qty: line.qty,
              status: lot.status,
              recvDate: lot.recvDate,
              mfgDate: lot.mfgDate,
              expDate: lot.expDate,
            },
          });
        }
      }
    }
  });

  revalidateAll();
  return { docNo };
}

"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { fefoLotFor } from "@/lib/calc/fefo";

export type IssueLineInput = {
  productCode: string;
  selectedLotId: string;
  qty: number;
};

export type ConfirmIssueInput = {
  issueTo: string;
  docDate: string;
  lines: IssueLineInput[];
};

function revalidateAll() {
  safeRevalidate(["/issue", "/dashboard", "/products", "/aging", "/locations"]);
}

export async function confirmIssueAction(
  input: ConfirmIssueInput
): Promise<{ docNo?: string; error?: string }> {
  const docDate = new Date(input.docDate);

  try {
    await requireWrite();
    const docNo = await nextDocNumber("ISS", docDate);

    await db.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          docNo,
          issueTo: input.issueTo,
          docDate,
          shippedDate: docDate,
        },
      });

      for (const line of input.lines) {
        if (line.qty <= 0) continue;
        const lot = await tx.lot.findUnique({ where: { id: line.selectedLotId } });
        if (!lot || lot.qty < line.qty) {
          throw new Error(
            `Not enough stock for ${line.productCode} (สต็อกไม่พอ — มี ${lot?.qty.toLocaleString() ?? 0}, ขอจ่าย ${line.qty.toLocaleString()})`
          );
        }

        const allLots = await tx.lot.findMany({ where: { productCode: line.productCode } });
        const fefo = fefoLotFor(
          allLots.map((l) => ({
            id: l.id,
            lotNo: l.lotNo,
            qty: l.qty,
            status: l.status,
            expDate: l.expDate,
            locationCode: l.locationCode,
          }))
        );

        await tx.lot.update({ where: { id: lot.id }, data: { qty: lot.qty - line.qty } });

        await tx.issueLine.create({
          data: {
            issueId: issue.id,
            productCode: line.productCode,
            fefoLotId: fefo?.id ?? null,
            selectedLotId: lot.id,
            qty: line.qty,
          },
        });
      }
    });

    revalidateAll();
    return { docNo };
  } catch (e) {
    // Return the message so it survives to the client — Next hides thrown
    // server-action error messages in production.
    return { error: e instanceof Error ? e.message : "Failed to confirm issue." };
  }
}

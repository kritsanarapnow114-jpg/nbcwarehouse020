"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";
import { nextDocNumber } from "@/lib/calc/docNumber";
import { eligibleLots, fefoLotFor } from "@/lib/calc/fefo";

export type IssueLineInput = {
  productCode: string;
  selectedLotId: string;
  qty: number;
};

export type ConfirmIssueInput = {
  issueTo: string;
  materialDoc?: string | null;
  remark?: string | null;
  docDate: string;
  lines: IssueLineInput[];
};

function revalidateAll() {
  safeRevalidate(["/issue", "/dashboard", "/products", "/aging", "/locations", "/map"]);
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
          materialDoc: input.materialDoc?.trim() || null,
          remark: input.remark?.trim() || null,
          docDate,
          shippedDate: docDate,
        },
      });

      for (const line of input.lines) {
        if (line.qty <= 0) continue;
        const sel = await tx.lot.findUnique({ where: { id: line.selectedLotId } });
        if (!sel) {
          throw new Error(`Not enough stock for ${line.productCode} (สต็อกไม่พอ)`);
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

        // The dropdown shows one option per lot+location, but that can be backed
        // by several stock records. Draw across every record of that same lot in
        // that same location, FEFO-first, until the requested qty is met.
        const siblings = allLots.filter(
          (l) => l.lotNo === sel.lotNo && l.locationCode === sel.locationCode
        );
        const ordered = eligibleLots(
          siblings.map((l) => ({
            id: l.id,
            lotNo: l.lotNo,
            qty: l.qty,
            status: l.status,
            expDate: l.expDate,
            locationCode: l.locationCode,
          }))
        );
        const avail = ordered.reduce((s, l) => s + l.qty, 0);
        if (avail < line.qty) {
          throw new Error(
            `Not enough stock for ${line.productCode} (สต็อกไม่พอ — มี ${avail.toLocaleString()}, ขอจ่าย ${line.qty.toLocaleString()})`
          );
        }

        let remaining = line.qty;
        for (const s of ordered) {
          if (remaining <= 0) break;
          const take = Math.min(s.qty, remaining);
          await tx.lot.update({ where: { id: s.id }, data: { qty: s.qty - take } });
          await tx.issueLine.create({
            data: {
              issueId: issue.id,
              productCode: line.productCode,
              fefoLotId: fefo?.id ?? null,
              selectedLotId: s.id,
              qty: take,
            },
          });
          remaining -= take;
        }
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

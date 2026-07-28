"use server";

import { safeRevalidate } from "./revalidate";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/authz";

export type MetaEditableKind = "receipt" | "issue";

/** Add / update the SAP Material Document number and Remark on a receipt or
 *  issue after the fact — the SAP number is often only known later. */
export async function updateDocMetaAction(
  kind: MetaEditableKind,
  id: string,
  meta: { materialDoc?: string | null; remark?: string | null; stockType?: "STOCK" | "NON_STOCK" }
): Promise<{ error?: string }> {
  try {
    await requireWrite();
    const data: { materialDoc: string | null; remark: string | null; stockType?: "STOCK" | "NON_STOCK" } = {
      materialDoc: meta.materialDoc?.trim() || null,
      remark: meta.remark?.trim() || null,
    };
    // Only touch stockType when supplied (so a plain meta save keeps it as-is).
    if (meta.stockType) data.stockType = meta.stockType;
    if (kind === "receipt") await db.receipt.update({ where: { id }, data });
    else await db.issue.update({ where: { id }, data });

    safeRevalidate(["/receive", "/issue", "/reports", "/search", "/dashboard"]);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save." };
  }
}

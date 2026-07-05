"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { qualityBreakdown, accuracyBreakdown } from "@/lib/calc/kpi";
import { KpiKey } from "@prisma/client";

export async function getKpiLogsAction(key: KpiKey) {
  const logs = await db.kpiLog.findMany({
    where: { key },
    orderBy: { date: "desc" },
  });
  return logs.map((l) => ({
    id: l.id,
    date: l.date.toISOString(),
    detail: l.detail,
    amount: l.amount,
    incident: l.incident,
    issueDocNo: l.issueDocNo,
    onTime: l.onTime,
  }));
}

export type AddKpiLogState = { error?: string };

export async function addKpiLogAction(
  _prev: AddKpiLogState,
  formData: FormData
): Promise<AddKpiLogState> {
  const key = String(formData.get("key")) as KpiKey;
  const date = String(formData.get("date") ?? "");
  if (!date) return { error: "Pick a date (เลือกวันที่)" };

  if (key === "SAFETY") {
    await db.kpiLog.create({
      data: {
        key,
        date: new Date(date),
        detail: String(formData.get("detail") ?? ""),
        incident: true,
      },
    });
  } else if (key === "COST") {
    const amount = Number(formData.get("amount") ?? 0);
    await db.kpiLog.create({
      data: {
        key,
        date: new Date(date),
        detail: String(formData.get("detail") ?? ""),
        amount,
      },
    });
  } else if (key === "DELIVERY") {
    await db.kpiLog.create({
      data: {
        key,
        date: new Date(date),
        issueDocNo: String(formData.get("issueDocNo") ?? ""),
        onTime: formData.get("onTime") === "true",
      },
    });
  }

  revalidatePath("/dashboard");
  return {};
}

export async function getQualityBreakdownAction() {
  const rows = await qualityBreakdown();
  return rows.map((r) => ({ ...r, date: r.date.toISOString() }));
}

export async function getAccuracyBreakdownAction() {
  const rows = await accuracyBreakdown();
  return rows.map((r) => ({ ...r, date: r.date.toISOString() }));
}

export async function getRecentIssueDocsAction() {
  const issues = await db.issue.findMany({
    orderBy: { docDate: "desc" },
    take: 15,
    select: { docNo: true },
  });
  return issues.map((i) => i.docNo);
}

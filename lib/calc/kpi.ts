import "server-only";
import { db } from "@/lib/db";
import { daysBetween } from "./date";
import { Range } from "@/lib/views/dashboard";

export type KpiTone = "ok" | "warn";

export type KpiResult = {
  key: "safety" | "quality" | "delivery" | "cost" | "accuracy";
  label: string;
  th: string;
  value: string;
  target: string;
  sub: string;
  tone: KpiTone;
  loggable: boolean; // Safety/Cost/Delivery: user adds log entries. Quality/Accuracy: derived, read-only.
};

export async function safetyKpi(range: Range): Promise<KpiResult> {
  const logs = await db.kpiLog.findMany({
    where: { key: "SAFETY", date: { gte: range.start, lte: range.end } },
    orderBy: { date: "asc" },
  });
  const incidents = logs.filter((l) => l.incident);
  const lastIncident = [...logs].reverse().find((l) => l.incident);
  const sinceDate = lastIncident ? lastIncident.date : range.start;
  const daysSince = Math.max(0, daysBetween(range.end, sinceDate));

  return {
    key: "safety",
    label: "Safety",
    th: "ความปลอดภัย",
    value: String(incidents.length),
    target: "Target 0 (เป้าหมาย 0)",
    sub: `${daysSince}d since last incident`,
    tone: incidents.length === 0 ? "ok" : "warn",
    loggable: true,
  };
}

export async function costKpi(range: Range): Promise<KpiResult> {
  const logs = await db.kpiLog.findMany({
    where: { key: "COST", date: { gte: range.start, lte: range.end } },
  });
  const total = logs.reduce((s, l) => s + (l.amount ?? 0), 0);
  return {
    key: "cost",
    label: "Cost Saving",
    th: "ต้นทุน",
    value: "฿" + Math.round(total).toLocaleString("en-US"),
    target: "Savings this period (ประหยัดช่วงนี้)",
    sub: `${logs.length} entries`,
    tone: "ok",
    loggable: true,
  };
}

export async function deliveryKpi(range: Range): Promise<KpiResult> {
  const logs = await db.kpiLog.findMany({
    where: { key: "DELIVERY", date: { gte: range.start, lte: range.end } },
  });
  const total = logs.length;
  const onTime = logs.filter((l) => l.onTime).length;
  const pct = total > 0 ? (onTime / total) * 100 : 100;
  return {
    key: "delivery",
    label: "Delivery",
    th: "การส่งมอบ",
    value: pct.toFixed(1) + "%",
    target: "Target 99% (เป้าหมาย 99%)",
    sub: `${onTime}/${total} on-time`,
    tone: pct >= 99 ? "ok" : "warn",
    loggable: true,
  };
}

export async function qualityKpi(range: Range): Promise<KpiResult> {
  const receipts = await db.receipt.findMany({
    where: { mode: "PRODUCTION", docDate: { gte: range.start, lte: range.end }, reversedAt: null },
  });
  const produced = receipts.reduce((s, r) => s + (r.producedTotal ?? 0), 0);
  const loss = receipts.reduce((s, r) => s + (r.prodLoss ?? 0), 0);
  const pct = produced + loss > 0 ? (produced / (produced + loss)) * 100 : 100;
  return {
    key: "quality",
    label: "Quality",
    th: "คุณภาพ",
    value: pct.toFixed(1) + "%",
    target: "Target 95% (เป้าหมาย 95%)",
    sub: `${receipts.length} production runs`,
    tone: pct >= 95 ? "ok" : "warn",
    loggable: false,
  };
}

export async function accuracyKpi(range: Range): Promise<KpiResult> {
  const counts = await db.stockCount.findMany({
    where: { docDate: { gte: range.start, lte: range.end }, reversedAt: null },
    include: { lines: true },
  });
  const lines = counts.flatMap((c) => c.lines);
  const total = lines.length;
  const matched = lines.filter((l) => l.countedQty === l.sysQty).length;
  const pct = total > 0 ? (matched / total) * 100 : 100;
  return {
    key: "accuracy",
    label: "Inv. Accuracy",
    th: "ความแม่นยำสต็อก",
    value: pct.toFixed(1) + "%",
    target: "Target 99.9% (เป้าหมาย 99.9%)",
    sub: `${matched}/${total} matched`,
    tone: pct >= 99.9 ? "ok" : "warn",
    loggable: false,
  };
}

/** Full-history breakdowns for the KPI drill-down modals — intentionally not period-filtered. */
export async function qualityBreakdown() {
  const receipts = await db.receipt.findMany({
    where: { mode: "PRODUCTION", reversedAt: null },
    orderBy: { docDate: "desc" },
    take: 30,
  });
  return receipts.map((r) => ({
    date: r.docDate,
    doc: r.docNo,
    produced: r.producedTotal ?? 0,
    loss: r.prodLoss ?? 0,
    yieldPct:
      (r.producedTotal ?? 0) + (r.prodLoss ?? 0) > 0
        ? ((r.producedTotal ?? 0) /
            ((r.producedTotal ?? 0) + (r.prodLoss ?? 0))) *
          100
        : 100,
  }));
}

export async function accuracyBreakdown() {
  const counts = await db.stockCount.findMany({
    where: { reversedAt: null },
    include: { lines: true },
    orderBy: { docDate: "desc" },
    take: 20,
  });
  return counts.map((c) => {
    const total = c.lines.length;
    const matched = c.lines.filter((l) => l.countedQty === l.sysQty).length;
    return {
      date: c.docDate,
      doc: c.docNo,
      counted: total,
      matched,
      pct: total > 0 ? (matched / total) * 100 : 100,
    };
  });
}

export async function kpiBand(range: Range): Promise<KpiResult[]> {
  const [safety, quality, delivery, cost, accuracy] = await Promise.all([
    safetyKpi(range),
    qualityKpi(range),
    deliveryKpi(range),
    costKpi(range),
    accuracyKpi(range),
  ]);
  return [safety, quality, delivery, cost, accuracy];
}

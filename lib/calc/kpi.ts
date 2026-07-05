import "server-only";
import { db } from "@/lib/db";
import { daysBetween, startOfYear } from "./date";

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

export async function safetyKpi(today: Date): Promise<KpiResult> {
  const yearStart = startOfYear(today);
  const logs = await db.kpiLog.findMany({
    where: { key: "SAFETY" },
    orderBy: { date: "asc" },
  });
  const incidentsYtd = logs.filter(
    (l) => l.incident && l.date >= yearStart && l.date <= today
  );
  const lastIncident = [...logs].reverse().find((l) => l.incident);
  const sinceDate = lastIncident ? lastIncident.date : yearStart;
  const daysSince = Math.max(0, daysBetween(today, sinceDate));

  return {
    key: "safety",
    label: "Safety",
    th: "ความปลอดภัย",
    value: String(incidentsYtd.length),
    target: "Target 0 (เป้าหมาย 0)",
    sub: `${daysSince}d since last incident`,
    tone: incidentsYtd.length === 0 ? "ok" : "warn",
    loggable: true,
  };
}

export async function costKpi(today: Date): Promise<KpiResult> {
  const yearStart = startOfYear(today);
  const logs = await db.kpiLog.findMany({
    where: { key: "COST", date: { gte: yearStart, lte: today } },
  });
  const total = logs.reduce((s, l) => s + (l.amount ?? 0), 0);
  return {
    key: "cost",
    label: "Cost Saving",
    th: "ต้นทุน",
    value: "฿" + Math.round(total).toLocaleString("en-US"),
    target: "Hard savings YTD (ประหยัดสะสม)",
    sub: `${logs.length} entries`,
    tone: "ok",
    loggable: true,
  };
}

export async function deliveryKpi(_today: Date): Promise<KpiResult> {
  const logs = await db.kpiLog.findMany({ where: { key: "DELIVERY" } });
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

export async function qualityKpi(): Promise<KpiResult> {
  const receipts = await db.receipt.findMany({
    where: { mode: "PRODUCTION" },
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

export async function accuracyKpi(): Promise<KpiResult> {
  const lines = await db.stockCountLine.findMany();
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

export async function qualityBreakdown() {
  const receipts = await db.receipt.findMany({
    where: { mode: "PRODUCTION" },
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

export async function kpiBand(today: Date): Promise<KpiResult[]> {
  const [safety, quality, delivery, cost, accuracy] = await Promise.all([
    safetyKpi(today),
    qualityKpi(),
    deliveryKpi(today),
    costKpi(today),
    accuracyKpi(),
  ]);
  return [safety, quality, delivery, cost, accuracy];
}

import "server-only";
import { db } from "@/lib/db";
import { Range } from "@/lib/views/dashboard";
import { aggregateOee, pct, OeeRunInput } from "@/lib/calc/oee";
import { fmtDateISO } from "@/lib/calc/date";

export type OeeMachineRow = {
  id: string;
  name: string;
  operation: "PRODUCTION" | "UNLOADING";
  standardRate: number;
  rateUnit: string;
  active: boolean;
  sortOrder: number;
};

export async function getOeeMachines(activeOnly = false): Promise<OeeMachineRow[]> {
  const rows = await db.oeeMachine.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ operation: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    operation: m.operation,
    standardRate: m.standardRate,
    rateUnit: m.rateUnit,
    active: m.active,
    sortOrder: m.sortOrder,
  }));
}

// ---- Dashboard aggregation --------------------------------------------------

/** One scored OEE run, reduced from a receipt that had a machine attached. */
type ScoredRun = OeeRunInput & {
  operation: "PRODUCTION" | "UNLOADING";
  machineId: string;
  machineName: string;
  day: string; // UTC calendar day key (docDate is stored UTC-midnight)
  output: number; // good + reject
};

function comp(runs: ScoredRun[]) {
  const agg = aggregateOee(runs);
  return {
    a: pct(agg.availability),
    p: pct(agg.performance),
    q: pct(agg.quality),
    oee: pct(agg.oee),
  };
}

export async function getOeeDashboard(range: Range) {
  const receipts = await db.receipt.findMany({
    where: {
      oeeMachineId: { not: null },
      reversedAt: null,
      docDate: { gte: range.start, lte: range.end },
    },
    include: { oeeMachine: true, downtimes: true, lines: true },
    orderBy: { docDate: "asc" },
  });

  const runs: ScoredRun[] = receipts
    .filter((r) => r.oeeMachine)
    .map((r) => {
      const machine = r.oeeMachine!;
      const isProd = machine.operation === "PRODUCTION";
      const good = isProd
        ? r.producedTotal ?? 0
        : r.lines.reduce((s, l) => s + l.recvQty, 0);
      const reject = isProd ? r.prodLoss ?? 0 : r.oeeReject ?? 0;
      const downtimeMin = r.downtimes.reduce((s, d) => s + d.minutes, 0);
      return {
        operation: machine.operation,
        machineId: machine.id,
        machineName: machine.name,
        day: fmtDateISO(new Date(Date.UTC(
          r.docDate.getUTCFullYear(),
          r.docDate.getUTCMonth(),
          r.docDate.getUTCDate()
        ))),
        plannedMin: r.plannedMin ?? 0,
        downtimeMin,
        good,
        reject,
        standardRatePerHour: machine.standardRate,
        output: good + reject,
      };
    });

  const prodRuns = runs.filter((r) => r.operation === "PRODUCTION");
  const unloadRuns = runs.filter((r) => r.operation === "UNLOADING");

  const summary = (rs: ScoredRun[]) => ({
    ...comp(rs),
    runs: rs.length,
    output: Math.round(rs.reduce((s, r) => s + r.output, 0)),
    good: Math.round(rs.reduce((s, r) => s + r.good, 0)),
    runMinutes: rs.reduce((s, r) => s + Math.max(0, r.plannedMin - r.downtimeMin), 0),
  });

  // Per-machine OEE (both operations together, one bar each).
  const byMachineMap = new Map<string, ScoredRun[]>();
  for (const r of runs) {
    const arr = byMachineMap.get(r.machineId) ?? [];
    arr.push(r);
    byMachineMap.set(r.machineId, arr);
  }
  const perMachine = [...byMachineMap.values()]
    .map((rs) => ({
      id: rs[0].machineId,
      name: rs[0].machineName,
      operation: rs[0].operation,
      oee: comp(rs).oee,
      runs: rs.length,
    }))
    .sort((a, b) => a.oee - b.oee); // worst first — surfaces what to fix

  // Downtime Pareto (minutes by reason, biggest first).
  const dtMap = new Map<string, number>();
  for (const r of receipts) {
    for (const d of r.downtimes) {
      dtMap.set(d.reason, (dtMap.get(d.reason) ?? 0) + d.minutes);
    }
  }
  const downtime = [...dtMap.entries()]
    .map(([reason, minutes]) => ({ reason, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
  const downtimeTotal = downtime.reduce((s, d) => s + d.minutes, 0);

  // 7-day OEE trend ending at range.end (per operation).
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(range.end);
    d.setDate(d.getDate() - i);
    days.push(fmtDateISO(d));
  }
  const trendFor = (rs: ScoredRun[]) =>
    days.map((day) => {
      const dayRuns = rs.filter((r) => r.day === day);
      return dayRuns.length ? comp(dayRuns).oee : null;
    });

  return {
    production: summary(prodRuns),
    unloading: summary(unloadRuns),
    perMachine,
    downtime,
    downtimeTotal,
    trend: {
      days,
      production: trendFor(prodRuns),
      unloading: trendFor(unloadRuns),
    },
    hasData: runs.length > 0,
  };
}

export type OeeDashboard = Awaited<ReturnType<typeof getOeeDashboard>>;

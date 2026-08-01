import "server-only";
import { db } from "@/lib/db";
import { Range } from "@/lib/views/dashboard";
import { getAppSetting } from "@/lib/views/settings";
import { OEE_STANDARDS_KEY, parseOeeStandards } from "@/lib/settingsKeys";
import { scoreUnloading, oeeFrom, pct } from "@/lib/calc/oee";
import { fmtDateISO } from "@/lib/calc/date";

// A finished bag-load reduced to the numbers OEE needs.
type Load = {
  machine: string;
  day: string; // Bangkok calendar day of the finish
  startMs: number;
  endMs: number;
  qty: number;
};

/** Pooled timing/output for a machine (or the whole operation) over the range. */
type Pool = { windowMs: number; loadingMs: number; output: number; loads: number };

function emptyPool(): Pool {
  return { windowMs: 0, loadingMs: 0, output: 0, loads: 0 };
}

// Bucket loads by machine+day so idle gaps *within* a day lower Availability, but
// the overnight gap between days does not. Window = first start → last finish of
// that machine on that day; loading = Σ(finish − start).
function poolByMachineDay(loads: Load[]): Map<string, Pool> {
  const dayKey = (l: Load) => `${l.machine}||${l.day}`;
  const groups = new Map<string, Load[]>();
  for (const l of loads) {
    const k = dayKey(l);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  // machine → pooled totals across its days
  const perMachine = new Map<string, Pool>();
  for (const [k, ls] of groups) {
    const machine = k.split("||")[0];
    const windowMs = Math.max(...ls.map((l) => l.endMs)) - Math.min(...ls.map((l) => l.startMs));
    const loadingMs = ls.reduce((s, l) => s + Math.max(0, l.endMs - l.startMs), 0);
    const output = ls.reduce((s, l) => s + l.qty, 0);
    const p = perMachine.get(machine) ?? emptyPool();
    p.windowMs += Math.max(0, windowMs);
    p.loadingMs += loadingMs;
    p.output += output;
    p.loads += ls.length;
    perMachine.set(machine, p);
  }
  return perMachine;
}

function scorePool(p: Pool, standardPerHour: number) {
  // Quality isn't measured at unloading (no scrap capture) → treat as 100%.
  return scoreUnloading({
    windowMs: p.windowMs,
    loadingMs: p.loadingMs,
    output: p.output,
    staged: p.output, // makes Q = 1
    standardPerHour,
  });
}

export async function getOeeDashboard(range: Range) {
  const [standardsRaw, siloLoads, prodReceipts] = await Promise.all([
    getAppSetting(OEE_STANDARDS_KEY),
    // Finished loads with both timestamps (legacy finish-only loads can't be timed).
    db.siloLoad.findMany({
      where: {
        loadedAt: { not: null, gte: range.start, lte: range.end },
        startedAt: { not: null },
      },
      select: { machine: true, qty: true, startedAt: true, loadedAt: true },
    }),
    db.receipt.findMany({
      where: { mode: "PRODUCTION", reversedAt: null, docDate: { gte: range.start, lte: range.end } },
      select: { producedTotal: true, prodLoss: true },
    }),
  ]);

  const standards = parseOeeStandards(standardsRaw);

  const loads: Load[] = siloLoads
    .filter((l) => l.startedAt && l.loadedAt)
    .map((l) => {
      const end = l.loadedAt as Date;
      return {
        machine: (l.machine || "ไม่ระบุเครื่อง").trim(),
        day: fmtDateISO(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))),
        startMs: (l.startedAt as Date).getTime(),
        endMs: end.getTime(),
        qty: l.qty,
      };
    });

  // ---- Unloading: per machine + overall -------------------------------------
  const perMachinePool = poolByMachineDay(loads);
  const perMachine = [...perMachinePool.keys()]
    .map((name) => {
      const p = perMachinePool.get(name)!;
      const parts = scorePool(p, standards[name] ?? 0);
      return {
        name,
        oee: pct(parts.oee),
        a: pct(parts.availability),
        p: pct(parts.performance),
        loads: p.loads,
        output: Math.round(p.output),
        loadingMs: p.loadingMs,
        idleMs: Math.max(0, p.windowMs - p.loadingMs),
        standard: standards[name] ?? 0,
      };
    })
    .sort((x, y) => x.oee - y.oee);

  const overall = [...perMachinePool.values()].reduce((acc, p) => {
    acc.windowMs += p.windowMs;
    acc.loadingMs += p.loadingMs;
    acc.output += p.output;
    acc.loads += p.loads;
    return acc;
  }, emptyPool());
  // Overall Performance uses an output-weighted average standard rate so a single
  // shared "standard" is meaningful across mixed machines.
  const outWeightedStd =
    overall.output > 0
      ? [...perMachinePool.entries()].reduce(
          (s, [name, p]) => s + (standards[name] ?? 0) * p.output,
          0
        ) / overall.output
      : 0;
  const overallParts = scorePool(overall, outWeightedStd);

  // ---- 7-day trend (OEE per day, all machines) ------------------------------
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(range.end);
    dd.setDate(dd.getDate() - i);
    days.push(fmtDateISO(dd));
  }
  const trend = days.map((day) => {
    const dayLoads = loads.filter((l) => l.day === day);
    if (dayLoads.length === 0) return null;
    const pools = poolByMachineDay(dayLoads);
    const pooled = [...pools.values()].reduce((acc, p) => {
      acc.windowMs += p.windowMs;
      acc.loadingMs += p.loadingMs;
      acc.output += p.output;
      return acc;
    }, emptyPool());
    const std =
      pooled.output > 0
        ? [...pools.entries()].reduce((s, [name, p]) => s + (standards[name] ?? 0) * p.output, 0) /
          pooled.output
        : 0;
    return pct(scorePool(pooled, std).oee);
  });

  // ---- Production yield (Quality only; A/P not tracked for production) -------
  const produced = prodReceipts.reduce((s, r) => s + (r.producedTotal ?? 0), 0);
  const loss = prodReceipts.reduce((s, r) => s + (r.prodLoss ?? 0), 0);
  const yieldQ = produced + loss > 0 ? produced / (produced + loss) : 1;

  return {
    hasUnloading: loads.length > 0,
    unloading: {
      ...toPct(overallParts),
      loads: overall.loads,
      output: Math.round(overall.output),
      loadingMs: overall.loadingMs,
      idleMs: Math.max(0, overall.windowMs - overall.loadingMs),
    },
    perMachine,
    trend: { days, oee: trend },
    production: {
      docs: prodReceipts.length,
      produced: Math.round(produced),
      loss: Math.round(loss),
      quality: pct(yieldQ),
    },
    standards,
  };
}

function toPct(parts: ReturnType<typeof oeeFrom>) {
  return {
    a: pct(parts.availability),
    p: pct(parts.performance),
    q: pct(parts.quality),
    oee: pct(parts.oee),
  };
}

export type OeeDashboard = Awaited<ReturnType<typeof getOeeDashboard>>;

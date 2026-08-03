import "server-only";
import { db } from "@/lib/db";
import { Range } from "@/lib/views/dashboard";
import { getAppSetting } from "@/lib/views/settings";
import { OEE_STANDARDS_KEY, parseOeeStandards } from "@/lib/settingsKeys";
import { scoreUnloading, scoreProduction, oeeFrom, pct } from "@/lib/calc/oee";
import { fmtDateISO } from "@/lib/calc/date";
import { productLabel } from "@/lib/calc/productName";

// A finished bag-load reduced to the numbers OEE needs.
type Load = {
  machine: string;
  day: string; // Bangkok calendar day of the finish
  startMs: number;
  endMs: number;
  qty: number;
  stagingId: string;
  stagingDoc: string;
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
  // SiloLoad.loadedAt is a real timestamp, but range.end is the *start* of the
  // last day (midnight). Using `lte: range.end` would drop everything loaded on
  // the final day itself. Extend the upper bound to the end of that day.
  const endExclusive = new Date(range.end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const [standardsRaw, siloLoads, prodReceipts, bomLosses] = await Promise.all([
    getAppSetting(OEE_STANDARDS_KEY),
    // Finished loads with both timestamps (legacy finish-only loads can't be timed).
    db.siloLoad.findMany({
      where: {
        loadedAt: { gte: range.start, lt: endExclusive },
        startedAt: { not: null },
      },
      select: {
        machine: true,
        qty: true,
        startedAt: true,
        loadedAt: true,
        stagingId: true,
        staging: { select: { docNo: true } },
      },
    }),
    db.receipt.findMany({
      where: { mode: "PRODUCTION", reversedAt: null, docDate: { gte: range.start, lte: range.end } },
      select: {
        id: true,
        docNo: true,
        docDate: true,
        producedTotal: true,
        prodLoss: true,
        oeeLine: true,
        plannedMin: true,
        downtime: true,
        oeeQuality: true,
      },
    }),
    // Packaging material loss (liner / bag / box…) captured on the BOM card —
    // a different metric from finished-goods quality loss.
    db.receiptBomLoss.findMany({
      where: {
        receipt: { mode: "PRODUCTION", reversedAt: null, docDate: { gte: range.start, lte: range.end } },
      },
      include: { bomLine: { include: { materialProduct: true } } },
    }),
  ]);

  const standards = parseOeeStandards(standardsRaw);

  // Packaging Material Loss (from BOM loss) — total + by material, no re-entry.
  const pkgMap = new Map<string, number>();
  let pkgTotal = 0;
  for (const bl of bomLosses) {
    if (bl.lossQty <= 0) continue;
    const name = productLabel(bl.bomLine.materialProduct.nameEn, bl.bomLine.materialProduct.nameTh);
    pkgMap.set(name, (pkgMap.get(name) ?? 0) + bl.lossQty);
    pkgTotal += bl.lossQty;
  }
  const packagingLoss = {
    total: Math.round(pkgTotal),
    byMaterial: [...pkgMap.entries()]
      .map(([name, qty]) => ({ name, qty: Math.round(qty) }))
      .sort((a, b) => b.qty - a.qty),
  };

  // Packaging pieces lost, per production receipt — each defective packaging
  // piece counts as one defective bag toward Quality (chosen model). It affects
  // Q only, never Performance (a torn liner doesn't change kg throughput).
  const pkgLossByReceipt = new Map<string, number>();
  for (const bl of bomLosses) {
    if (bl.lossQty <= 0) continue;
    pkgLossByReceipt.set(bl.receiptId, (pkgLossByReceipt.get(bl.receiptId) ?? 0) + bl.lossQty);
  }
  // Good ÷ (good + pellet loss + packaging pieces lost). Units in [0,1].
  const qualityFrac = (good: number, reject: number) =>
    good + reject > 0 ? good / (good + reject) : 1;

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
        stagingId: l.stagingId,
        stagingDoc: l.staging?.docNo ?? l.stagingId,
      };
    });

  // ---- Unloading: per-run (one row per staged item / SILO session) ----------
  const runMap = new Map<
    string,
    { doc: string; machine: string; day: string; startMs: number; endMs: number; loadingMs: number; output: number; bags: number }
  >();
  for (const l of loads) {
    const g =
      runMap.get(l.stagingId) ??
      { doc: l.stagingDoc, machine: l.machine, day: l.day, startMs: l.startMs, endMs: l.endMs, loadingMs: 0, output: 0, bags: 0 };
    g.startMs = Math.min(g.startMs, l.startMs);
    g.endMs = Math.max(g.endMs, l.endMs);
    g.loadingMs += Math.max(0, l.endMs - l.startMs);
    g.output += l.qty;
    g.bags += 1;
    g.day = l.day;
    runMap.set(l.stagingId, g);
  }
  const unloadingRuns = [...runMap.values()]
    .map((g) => {
      const parts = scoreUnloading({
        windowMs: g.endMs - g.startMs,
        loadingMs: g.loadingMs,
        output: g.output,
        staged: g.output,
        standardPerHour: standards[g.machine] ?? 0,
      });
      return {
        doc: g.doc,
        day: g.day,
        machine: g.machine,
        a: pct(parts.availability),
        p: pct(parts.performance),
        oee: pct(parts.oee),
        bags: g.bags,
        output: Math.round(g.output),
        loadingMs: g.loadingMs,
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 50);

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

  // ---- Production: yield always; full A/P/Q for runs that captured a line -----
  const produced = prodReceipts.reduce((s, r) => s + (r.producedTotal ?? 0), 0);
  const loss = prodReceipts.reduce((s, r) => s + (r.prodLoss ?? 0), 0);
  // Quality yield folds in packaging pieces lost (each = one defective bag).
  const yieldQ = qualityFrac(produced, loss + pkgTotal);

  const dtMinutes = (raw: unknown): number => {
    if (!Array.isArray(raw)) return 0;
    return raw.reduce((s, d) => {
      const m = d && typeof d === "object" ? Number((d as { minutes?: unknown }).minutes) : 0;
      return s + (Number.isFinite(m) ? m : 0);
    }, 0);
  };

  // Runs that captured a line + planned time can be fully scored.
  const scored = prodReceipts.filter((r) => r.oeeLine && (r.plannedMin ?? 0) > 0);

  // Per-run (one row per Pack Order that captured OEE).
  const productionRuns = scored
    .map((r) => {
      const dt = dtMinutes(r.downtime);
      const parts = scoreProduction({
        plannedMin: r.plannedMin ?? 0,
        downtimeMin: dt,
        good: r.producedTotal ?? 0,
        reject: r.prodLoss ?? 0,
        standardPerHour: standards[r.oeeLine as string] ?? 0,
      });
      // Fold packaging loss into Quality only, then recombine A×P×Q.
      const pkg = pkgLossByReceipt.get(r.id) ?? 0;
      const qf = qualityFrac(r.producedTotal ?? 0, (r.prodLoss ?? 0) + pkg);
      const oeeF = parts.availability * parts.performance * qf;
      return {
        doc: r.docNo,
        day: fmtDateISO(new Date(Date.UTC(r.docDate.getUTCFullYear(), r.docDate.getUTCMonth(), r.docDate.getUTCDate()))),
        line: r.oeeLine as string,
        a: pct(parts.availability),
        p: pct(parts.performance),
        q: pct(qf),
        oee: pct(oeeF),
        produced: Math.round(r.producedTotal ?? 0),
        loss: Math.round(r.prodLoss ?? 0),
        pkgLoss: Math.round(pkg),
        downtimeMin: dt,
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 50);
  const prodPool = scored.reduce(
    (acc, r) => {
      const planned = r.plannedMin ?? 0;
      const run = Math.max(0, planned - dtMinutes(r.downtime));
      const good = r.producedTotal ?? 0;
      const rej = r.prodLoss ?? 0;
      acc.plannedMin += planned;
      acc.runMin += run;
      acc.idealHrOutput += (standards[r.oeeLine as string] ?? 0) * (run / 60);
      acc.good += good;
      acc.reject += rej;
      acc.pkg += pkgLossByReceipt.get(r.id) ?? 0;
      return acc;
    },
    { plannedMin: 0, runMin: 0, idealHrOutput: 0, good: 0, reject: 0, pkg: 0 }
  );
  const prodOutput = prodPool.good + prodPool.reject;
  const prodParts = scoreProduction({
    plannedMin: prodPool.plannedMin,
    downtimeMin: prodPool.plannedMin - prodPool.runMin,
    good: prodPool.good,
    reject: prodPool.reject,
    standardPerHour:
      prodPool.runMin > 0 ? prodPool.idealHrOutput / (prodPool.runMin / 60) : 0,
  });
  // Aggregate Quality with packaging loss folded in, then A×P×Q.
  const prodQ = qualityFrac(prodPool.good, prodPool.reject + prodPool.pkg);
  const prodOeeF = prodParts.availability * prodParts.performance * prodQ;

  // Per-line OEE breakdown.
  const lineMap = new Map<string, typeof prodPool>();
  for (const r of scored) {
    const key = r.oeeLine as string;
    const p = lineMap.get(key) ?? { plannedMin: 0, runMin: 0, idealHrOutput: 0, good: 0, reject: 0, pkg: 0 };
    const planned = r.plannedMin ?? 0;
    const run = Math.max(0, planned - dtMinutes(r.downtime));
    p.plannedMin += planned;
    p.runMin += run;
    p.idealHrOutput += (standards[key] ?? 0) * (run / 60);
    p.good += r.producedTotal ?? 0;
    p.reject += r.prodLoss ?? 0;
    p.pkg += pkgLossByReceipt.get(r.id) ?? 0;
    lineMap.set(key, p);
  }
  const prodPerLine = [...lineMap.entries()]
    .map(([name, p]) => {
      const parts = scoreProduction({
        plannedMin: p.plannedMin,
        downtimeMin: p.plannedMin - p.runMin,
        good: p.good,
        reject: p.reject,
        standardPerHour: p.runMin > 0 ? p.idealHrOutput / (p.runMin / 60) : 0,
      });
      const qf = qualityFrac(p.good, p.reject + p.pkg);
      const oeeF = parts.availability * parts.performance * qf;
      return {
        name,
        oee: pct(oeeF),
        a: pct(parts.availability),
        p: pct(parts.performance),
        q: pct(qf),
        output: Math.round(p.good + p.reject),
        standard: standards[name] ?? 0,
      };
    })
    .sort((x, y) => x.oee - y.oee);

  // ---- Captured-at-source analytics (from the Pack Order OEE card) ---------
  const lossAggMap = new Map<
    string,
    { loss: string; category: string; owner: string; freq: number; lostMin: number }
  >();
  let repackTotal = 0;
  let scrapTotal = 0;
  for (const r of prodReceipts) {
    const oq = r.oeeQuality as
      | { repack?: number; scrap?: number; losses?: { reason?: string; qty?: number }[] }
      | null;
    if (oq && typeof oq === "object") {
      repackTotal += Number(oq.repack) || 0;
      scrapTotal += Number(oq.scrap) || 0;
    }
    const dt = r.downtime;
    if (Array.isArray(dt)) {
      for (const d of dt) {
        if (!d || typeof d !== "object") continue;
        const e = d as { minutes?: unknown; reason?: unknown; category?: unknown; owner?: unknown };
        const minutes = Number(e.minutes) || 0;
        if (minutes <= 0) continue;
        const reason = String(e.reason ?? "").trim() || "อื่น ๆ";
        const category = String(e.category ?? "").trim() || "Process loss";
        const owner = String(e.owner ?? "").trim();
        const key = `${reason}||${category}||${owner}`;
        const g = lossAggMap.get(key) ?? { loss: reason, category, owner, freq: 0, lostMin: 0 };
        g.freq += 1;
        g.lostMin += minutes;
        lossAggMap.set(key, g);
      }
    }
  }
  // Quality Loss Pareto comes straight from the BOM material loss (packaging
  // defects: liner tear, box damage…) — pulled from the BOM card, no re-entry.
  const capturedQualityLoss = packagingLoss.byMaterial.map((m) => ({ reason: m.name, qty: m.qty }));
  const capturedLossPareto = [...lossAggMap.values()].sort((a, b) => b.lostMin - a.lostMin);

  return {
    hasUnloading: loads.length > 0,
    packagingLoss,
    productionRuns,
    unloadingRuns,
    captured: {
      qualityLoss: capturedQualityLoss,
      lossPareto: capturedLossPareto,
      repack: Math.round(repackTotal),
      scrap: Math.round(scrapTotal),
      hasQuality: capturedQualityLoss.length > 0,
      hasLoss: capturedLossPareto.length > 0,
    },
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
      hasOee: scored.length > 0,
      scoredRuns: scored.length,
      output: Math.round(prodOutput),
      pkgLoss: Math.round(prodPool.pkg),
      a: pct(prodParts.availability),
      p: pct(prodParts.performance),
      q: pct(prodQ),
      oee: pct(prodOeeF),
      perLine: prodPerLine,
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

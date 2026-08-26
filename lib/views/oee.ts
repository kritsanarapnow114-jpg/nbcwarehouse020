import "server-only";
import { db } from "@/lib/db";
import { Range } from "@/lib/views/dashboard";
import { getAppSetting } from "@/lib/views/settings";
import { OEE_STANDARDS_KEY, parseOeeStandards, OEE_SHIFT_TIME_KEY, parseShiftTime } from "@/lib/settingsKeys";
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
  plannedMin: number; // planned unloading time for the session (0 = none set)
};

export async function getOeeDashboard(range: Range) {
  // SiloLoad.loadedAt is a real timestamp, but range.end is the *start* of the
  // last day (midnight). Using `lte: range.end` would drop everything loaded on
  // the final day itself. Extend the upper bound to the end of that day.
  const endExclusive = new Date(range.end);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const [standardsRaw, shiftTimeRaw, siloLoads, prodReceipts, bomLosses, products, boms] = await Promise.all([
    getAppSetting(OEE_STANDARDS_KEY),
    getAppSetting(OEE_SHIFT_TIME_KEY),
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
        staging: { select: { docNo: true, plannedMin: true } },
      },
    }),
    db.receipt.findMany({
      where: { mode: "PRODUCTION", reversedAt: null, docDate: { gte: range.start, lte: range.end } },
      select: {
        id: true,
        docNo: true,
        docDate: true,
        materialDoc: true,
        producedTotal: true,
        prodLoss: true,
        oeeLine: true,
        shift: true,
        plannedMin: true,
        breakMin: true,
        downtime: true,
        oeeQuality: true,
        lines: { select: { productCode: true }, take: 1 }, // finished good → its price
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
    // Prices for value-based Quality: finished-good price + packaging cost/unit.
    db.product.findMany({ select: { code: true, price: true } }),
    db.bom.findMany({ include: { lines: { include: { materialProduct: true } } } }),
  ]);

  const standards = parseOeeStandards(standardsRaw);
  // Fixed shift working window (same for every shift) — planned time is counted
  // once per shift, not per Pack Order. See parseShiftTime for the defaults.
  const shiftTime = parseShiftTime(shiftTimeRaw);
  // Planned Production Time is NET of the scheduled break (breaks aren't run
  // time), so Availability is measured against plan − break (e.g. 480 − 60 = 420).
  const PLAN = Math.max(0, shiftTime.planMin - shiftTime.breakMin);

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

  // Packaging / BOM MATERIAL USED — what production actually consumed via the BOM
  // (recorded per production receipt as ReceiptMaterialConsumption), per material.
  const matConsumption = await db.receiptMaterialConsumption.findMany({
    where: {
      receipt: { mode: "PRODUCTION", reversedAt: null, docDate: { gte: range.start, lte: range.end } },
    },
    include: { lot: { select: { product: { select: { nameEn: true, nameTh: true } } } } },
  });
  const usedMap = new Map<string, number>();
  let usedTotal = 0;
  for (const c of matConsumption) {
    if (c.qty <= 0) continue;
    const name = productLabel(c.lot.product.nameEn, c.lot.product.nameTh);
    usedMap.set(name, (usedMap.get(name) ?? 0) + c.qty);
    usedTotal += c.qty;
  }
  const packagingUsed = {
    total: Math.round(usedTotal),
    byMaterial: [...usedMap.entries()]
      .map(([name, qty]) => ({ name, qty: Math.round(qty) }))
      .sort((a, b) => b.qty - a.qty),
  };

  // Packaging pieces + packaging ฿ value lost, per production receipt.
  const pkgLossByReceipt = new Map<string, number>(); // pieces (for display)
  const pkgLossValueByReceipt = new Map<string, number>(); // ฿
  for (const bl of bomLosses) {
    if (bl.lossQty <= 0) continue;
    pkgLossByReceipt.set(bl.receiptId, (pkgLossByReceipt.get(bl.receiptId) ?? 0) + bl.lossQty);
    const val = bl.lossQty * (bl.bomLine.materialProduct.price ?? 0);
    pkgLossValueByReceipt.set(bl.receiptId, (pkgLossValueByReceipt.get(bl.receiptId) ?? 0) + val);
  }

  // Value-based Quality inputs. Pellet price/kg = finished-good price − packaging
  // cost per unit (e.g. ฿9/kg − ฿2.67/kg = ฿6.33/kg → ฿4,750 per 750-kg bag).
  const priceOf = new Map(products.map((p) => [p.code, p.price]));
  const pkgCostPerUnit = new Map<string, number>();
  for (const b of boms) {
    const cost = b.lines.reduce(
      (s, l) => s + (l.materialProduct.price ?? 0) * (l.perQty > 0 ? l.qtyPerUnit / l.perQty : l.qtyPerUnit),
      0
    );
    pkgCostPerUnit.set(b.finishedProductCode, cost);
  }
  // ฿ value of good ÷ (฿ good + ฿ loss).
  const valueQuality = (goodVal: number, lossVal: number) =>
    goodVal + lossVal > 0 ? goodVal / (goodVal + lossVal) : 1;
  // Per-receipt good value and quality-loss value (pellet + packaging), in ฿.
  const receiptGoodValue = (r: { producedTotal: number | null; lines: { productCode: string }[] }) => {
    const code = r.lines[0]?.productCode;
    return (r.producedTotal ?? 0) * (code ? priceOf.get(code) ?? 0 : 0);
  };
  const receiptLossValue = (r: { id: string; prodLoss: number | null; lines: { productCode: string }[] }) => {
    const code = r.lines[0]?.productCode;
    const price = code ? priceOf.get(code) ?? 0 : 0;
    const pelletPrice = Math.max(0, price - (code ? pkgCostPerUnit.get(code) ?? 0 : 0));
    return (r.prodLoss ?? 0) * pelletPrice + (pkgLossValueByReceipt.get(r.id) ?? 0);
  };

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
        plannedMin: l.staging?.plannedMin ?? 0,
      };
    });

  // ---- Unloading: aggregate per SILO session (staging) ----------------------
  // Availability now comes from the session's plan (plannedMin), so we pool by
  // staging — each staging carries its own plan once (not once per bag).
  type URun = {
    doc: string; machine: string; day: string;
    startMs: number; endMs: number; loadingMs: number; output: number; bags: number; plannedMs: number;
  };
  const runMap = new Map<string, URun>();
  for (const l of loads) {
    const g =
      runMap.get(l.stagingId) ??
      { doc: l.stagingDoc, machine: l.machine, day: l.day, startMs: l.startMs, endMs: l.endMs, loadingMs: 0, output: 0, bags: 0, plannedMs: l.plannedMin * 60_000 };
    g.startMs = Math.min(g.startMs, l.startMs);
    g.endMs = Math.max(g.endMs, l.endMs);
    g.loadingMs += Math.max(0, l.endMs - l.startMs);
    g.output += l.qty;
    g.bags += 1;
    g.day = l.day;
    runMap.set(l.stagingId, g);
  }
  const runs = [...runMap.values()];

  // Aggregate a set of sessions into one OEE (planned time summed across them).
  type UAgg = { plannedMs: number; loadingMs: number; windowMs: number; output: number; bags: number };
  const emptyAgg = (): UAgg => ({ plannedMs: 0, loadingMs: 0, windowMs: 0, output: 0, bags: 0 });
  const addRun = (a: UAgg, g: URun) => {
    a.plannedMs += g.plannedMs;
    a.loadingMs += g.loadingMs;
    a.windowMs += Math.max(0, g.endMs - g.startMs);
    a.output += g.output;
    a.bags += g.bags;
  };
  const scoreAgg = (a: UAgg, std: number) =>
    scoreUnloading({ plannedMs: a.plannedMs, windowMs: a.windowMs, loadingMs: a.loadingMs, output: a.output, staged: a.output, standardPerHour: std });

  const unloadingRuns = runs
    .map((g) => {
      const parts = scoreUnloading({
        plannedMs: g.plannedMs,
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
        loadingMs: Math.max(0, g.endMs - g.startMs), // elapsed span (time used)
        plannedMin: Math.round(g.plannedMs / 60_000),
        hasPlan: g.plannedMs > 0,
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 50);

  // ---- Unloading: per machine + overall -------------------------------------
  const byMachine = new Map<string, UAgg>();
  for (const g of runs) {
    const a = byMachine.get(g.machine) ?? emptyAgg();
    addRun(a, g);
    byMachine.set(g.machine, a);
  }
  const perMachine = [...byMachine.entries()]
    .map(([name, a]) => {
      const parts = scoreAgg(a, standards[name] ?? 0);
      return {
        name,
        oee: pct(parts.oee),
        a: pct(parts.availability),
        p: pct(parts.performance),
        loads: a.bags,
        output: Math.round(a.output),
        loadingMs: a.windowMs, // elapsed span (time used)
        idleMs: a.plannedMs > 0 ? Math.max(0, a.plannedMs - a.windowMs) : 0,
        plannedMin: Math.round(a.plannedMs / 60_000),
        standard: standards[name] ?? 0,
      };
    })
    .sort((x, y) => x.oee - y.oee);

  const overall = runs.reduce((a, g) => (addRun(a, g), a), emptyAgg());
  // Overall Performance uses an output-weighted average standard rate so a single
  // shared "standard" is meaningful across mixed machines.
  const outWeightedStd =
    overall.output > 0
      ? [...byMachine.entries()].reduce((s, [name, a]) => s + (standards[name] ?? 0) * a.output, 0) / overall.output
      : 0;
  const overallParts = scoreAgg(overall, outWeightedStd);

  // ---- 7-day trend (OEE per day, all machines) ------------------------------
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(range.end);
    dd.setDate(dd.getDate() - i);
    days.push(fmtDateISO(dd));
  }
  const trend = days.map((day) => {
    const dayRuns = runs.filter((g) => g.day === day);
    if (dayRuns.length === 0) return null;
    const agg = dayRuns.reduce((a, g) => (addRun(a, g), a), emptyAgg());
    const std =
      agg.output > 0
        ? dayRuns.reduce((s, g) => s + (standards[g.machine] ?? 0) * g.output, 0) / agg.output
        : 0;
    return pct(scoreAgg(agg, std).oee);
  });

  // ---- Production: yield always; full A/P/Q for runs that captured a line -----
  const produced = prodReceipts.reduce((s, r) => s + (r.producedTotal ?? 0), 0);
  const loss = prodReceipts.reduce((s, r) => s + (r.prodLoss ?? 0), 0);
  // Quality yield is value-based: ฿ good ÷ (฿ good + ฿ pellet loss + ฿ packaging loss).
  const goodValueAll = prodReceipts.reduce((s, r) => s + receiptGoodValue(r), 0);
  const lossValueAll = prodReceipts.reduce((s, r) => s + receiptLossValue(r), 0);
  const yieldQ = valueQuality(goodValueAll, lossValueAll);

  const dtMinutes = (raw: unknown): number => {
    if (!Array.isArray(raw)) return 0;
    return raw.reduce((s, d) => {
      const m = d && typeof d === "object" ? Number((d as { minutes?: unknown }).minutes) : 0;
      return s + (Number.isFinite(m) ? m : 0);
    }, 0);
  };

  // Any run that named a production line is scored — the planned window is the
  // fixed shift time (below), so no per-order planned entry is needed.
  const scored = prodReceipts.filter((r) => r.oeeLine);

  // Individual downtime events on a run (reason · which machine · responsible),
  // straight from what was captured on the Pack Order OEE card.
  const parseDowntimeEvents = (raw: unknown) => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((d) => {
        const e = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
        return {
          minutes: Math.round(Number(e.minutes) || 0),
          reason: String(e.reason ?? "").trim(),
          detail: String(e.detail ?? "").trim(),
        };
      })
      .filter((e) => e.minutes > 0);
  };

  // Per-run (one row per Pack Order that captured OEE).
  const productionRuns = scored
    .map((r) => {
      const dt = dtMinutes(r.downtime);
      const planned = PLAN; // fixed shift window
      const parts = scoreProduction({
        plannedMin: planned,
        downtimeMin: dt,
        good: r.producedTotal ?? 0,
        reject: r.prodLoss ?? 0,
        standardPerHour: standards[r.oeeLine as string] ?? 0,
      });
      // Value-based Quality (Quality only), then recombine A×P×Q.
      const pkg = pkgLossByReceipt.get(r.id) ?? 0;
      const qf = valueQuality(receiptGoodValue(r), receiptLossValue(r));
      const oeeF = parts.availability * parts.performance * qf;
      return {
        doc: r.docNo,
        matDoc: r.materialDoc ?? "",
        // Pack Order No. keyed on the receipt (materialDoc field). Reports show
        // this instead of the internal RC document number; fall back to it when blank.
        packNo: r.materialDoc?.trim() || r.docNo,
        day: fmtDateISO(new Date(Date.UTC(r.docDate.getUTCFullYear(), r.docDate.getUTCMonth(), r.docDate.getUTCDate()))),
        line: r.oeeLine as string,
        shift: r.shift ?? "",
        a: pct(parts.availability),
        p: pct(parts.performance),
        q: pct(qf),
        oee: pct(oeeF),
        produced: Math.round(r.producedTotal ?? 0),
        loss: Math.round(r.prodLoss ?? 0),
        pkgLoss: Math.round(pkg),
        output: Math.round((r.producedTotal ?? 0) + (r.prodLoss ?? 0)),
        plannedMin: Math.round(planned),
        breakMin: shiftTime.breakMin,
        runMin: Math.max(0, Math.round(planned - dt)),
        standard: standards[r.oeeLine as string] ?? 0,
        downtimeMin: dt,
        downtimeEvents: parseDowntimeEvents(r.downtime),
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 50);
  // A run's planned/break time belongs to its SHIFT, not to each Pack Order.
  // When several Pack Orders are keyed for the same shift + line on the same day
  // (e.g. กะเช้า keys 3 orders, all planned 480 / break 60), they share ONE
  // planned window — so we group runs into shift-sessions and count the planned
  // window once per session, while downtime and output accumulate across every
  // order in it. Un-shifted runs stay their own session (keyed by doc) so the
  // old per-run behaviour is preserved for data captured before shifts existed.
  const sessionMap = new Map<
    string,
    { day: string; line: string; shift: string; planned: number; downtime: number; good: number; reject: number; gv: number; lv: number }
  >();
  for (const r of scored) {
    const line = r.oeeLine as string;
    const shift = (r.shift ?? "").trim();
    const day = fmtDateISO(new Date(Date.UTC(r.docDate.getUTCFullYear(), r.docDate.getUTCMonth(), r.docDate.getUTCDate())));
    const key = shift ? `${day}||${shift}||${line}` : `doc:${r.docNo}`;
    const dt = dtMinutes(r.downtime);
    const s = sessionMap.get(key);
    if (s) {
      // Same shift window — planned stays fixed (counted once), only downtime and
      // output accumulate across the shift's Pack Orders.
      s.downtime += dt;
      s.good += r.producedTotal ?? 0;
      s.reject += r.prodLoss ?? 0;
      s.gv += receiptGoodValue(r);
      s.lv += receiptLossValue(r);
    } else {
      sessionMap.set(key, {
        day,
        line,
        shift,
        planned: PLAN, // fixed shift window, once per shift+line+day
        downtime: dt,
        good: r.producedTotal ?? 0,
        reject: r.prodLoss ?? 0,
        gv: receiptGoodValue(r),
        lv: receiptLossValue(r),
      });
    }
  }
  // Derive each session's run time & ideal output once planned is deduped.
  const sessions = [...sessionMap.values()].map((s) => {
    const runMin = Math.max(0, s.planned - s.downtime);
    return { ...s, runMin, idealHrOutput: (standards[s.line] ?? 0) * (runMin / 60) };
  });

  const prodPool = sessions.reduce(
    (acc, s) => {
      acc.plannedMin += s.planned;
      acc.runMin += s.runMin;
      acc.idealHrOutput += s.idealHrOutput;
      acc.good += s.good;
      acc.reject += s.reject;
      acc.gv += s.gv;
      acc.lv += s.lv;
      return acc;
    },
    { plannedMin: 0, runMin: 0, idealHrOutput: 0, good: 0, reject: 0, gv: 0, lv: 0 }
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
  // Aggregate value-based Quality, then A×P×Q.
  const prodQ = valueQuality(prodPool.gv, prodPool.lv);
  const prodOeeF = prodParts.availability * prodParts.performance * prodQ;

  // Per-line OEE breakdown (sum over shift-sessions on that line).
  const lineMap = new Map<string, typeof prodPool>();
  for (const s of sessions) {
    const key = s.line;
    const p = lineMap.get(key) ?? { plannedMin: 0, runMin: 0, idealHrOutput: 0, good: 0, reject: 0, gv: 0, lv: 0 };
    p.plannedMin += s.planned;
    p.runMin += s.runMin;
    p.idealHrOutput += s.idealHrOutput;
    p.good += s.good;
    p.reject += s.reject;
    p.gv += s.gv;
    p.lv += s.lv;
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
      const qf = valueQuality(p.gv, p.lv);
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

  // Per-shift (กะ) OEE breakdown — sum over shift-sessions, so the shift's planned
  // window is counted once even when it spans several Pack Orders. Runs with no
  // shift fall under "ไม่ระบุกะ". `runs` counts the Pack Orders keyed for the shift.
  type ShiftAgg = typeof prodPool & { downtimeMin: number };
  const NO_SHIFT = "ไม่ระบุกะ";
  const shiftMap = new Map<string, ShiftAgg>();
  for (const s of sessions) {
    const key = s.shift || NO_SHIFT;
    const p = shiftMap.get(key) ?? { plannedMin: 0, runMin: 0, idealHrOutput: 0, good: 0, reject: 0, gv: 0, lv: 0, downtimeMin: 0 };
    p.plannedMin += s.planned;
    p.runMin += s.runMin;
    p.idealHrOutput += s.idealHrOutput;
    p.good += s.good;
    p.reject += s.reject;
    p.gv += s.gv;
    p.lv += s.lv;
    p.downtimeMin += s.downtime;
    shiftMap.set(key, p);
  }
  // How many Pack Orders each shift had (for the report's "runs" column).
  const shiftRuns = new Map<string, number>();
  for (const r of scored) {
    const key = (r.shift ?? "").trim() || NO_SHIFT;
    shiftRuns.set(key, (shiftRuns.get(key) ?? 0) + 1);
  }
  const prodPerShift = [...shiftMap.entries()]
    .map(([name, p]) => {
      const parts = scoreProduction({
        plannedMin: p.plannedMin,
        downtimeMin: p.plannedMin - p.runMin,
        good: p.good,
        reject: p.reject,
        standardPerHour: p.runMin > 0 ? p.idealHrOutput / (p.runMin / 60) : 0,
      });
      const qf = valueQuality(p.gv, p.lv);
      const oeeF = parts.availability * parts.performance * qf;
      return {
        name,
        oee: pct(oeeF),
        a: pct(parts.availability),
        p: pct(parts.performance),
        q: pct(qf),
        produced: Math.round(p.good),
        loss: Math.round(p.reject),
        output: Math.round(p.good + p.reject),
        downtimeMin: Math.round(p.downtimeMin),
        runs: shiftRuns.get(name) ?? 0,
      };
    })
    .sort((x, y) => y.oee - x.oee);

  // Per-day × shift OEE — one row per (day, shift), the shift's fixed window
  // counted once per line. Newest day first, then shift name.
  type DayShiftAgg = ShiftAgg & { day: string; shift: string };
  const dayShiftMap = new Map<string, DayShiftAgg>();
  for (const s of sessions) {
    const shiftName = s.shift || NO_SHIFT;
    const key = `${s.day}||${shiftName}`;
    const p = dayShiftMap.get(key) ?? { day: s.day, shift: shiftName, plannedMin: 0, runMin: 0, idealHrOutput: 0, good: 0, reject: 0, gv: 0, lv: 0, downtimeMin: 0 };
    p.plannedMin += s.planned;
    p.runMin += s.runMin;
    p.idealHrOutput += s.idealHrOutput;
    p.good += s.good;
    p.reject += s.reject;
    p.gv += s.gv;
    p.lv += s.lv;
    p.downtimeMin += s.downtime;
    dayShiftMap.set(key, p);
  }
  // Pack Orders per (day, shift).
  const dayShiftRuns = new Map<string, number>();
  for (const r of scored) {
    const shiftName = (r.shift ?? "").trim() || NO_SHIFT;
    const day = fmtDateISO(new Date(Date.UTC(r.docDate.getUTCFullYear(), r.docDate.getUTCMonth(), r.docDate.getUTCDate())));
    const key = `${day}||${shiftName}`;
    dayShiftRuns.set(key, (dayShiftRuns.get(key) ?? 0) + 1);
  }
  const prodPerDayShift = [...dayShiftMap.entries()]
    .map(([key, p]) => {
      const parts = scoreProduction({
        plannedMin: p.plannedMin,
        downtimeMin: p.plannedMin - p.runMin,
        good: p.good,
        reject: p.reject,
        standardPerHour: p.runMin > 0 ? p.idealHrOutput / (p.runMin / 60) : 0,
      });
      const qf = valueQuality(p.gv, p.lv);
      const oeeF = parts.availability * parts.performance * qf;
      return {
        day: p.day,
        shift: p.shift,
        oee: pct(oeeF),
        a: pct(parts.availability),
        p: pct(parts.performance),
        q: pct(qf),
        produced: Math.round(p.good),
        loss: Math.round(p.reject),
        output: Math.round(p.good + p.reject),
        downtimeMin: Math.round(p.downtimeMin),
        runs: dayShiftRuns.get(key) ?? 0,
      };
    })
    .sort((x, y) => (x.day === y.day ? x.shift.localeCompare(y.shift) : y.day.localeCompare(x.day)));

  // ---- Captured-at-source analytics (from the Pack Order OEE card) ---------
  const lossAggMap = new Map<
    string,
    { loss: string; freq: number; lostMin: number }
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
        const e = d as { minutes?: unknown; reason?: unknown; detail?: unknown };
        const minutes = Number(e.minutes) || 0;
        if (minutes <= 0) continue;
        const reason = String(e.reason ?? "").trim() || "อื่น ๆ";
        const detail = String(e.detail ?? "").trim();
        // Fold the note (e.g. which machine) into the label so the Pareto
        // separates "เครื่องเสีย · เครื่องบรรจุ #2" from other machines.
        const loss = detail ? `${reason} · ${detail}` : reason;
        const g = lossAggMap.get(loss) ?? { loss, freq: 0, lostMin: 0 };
        g.freq += 1;
        g.lostMin += minutes;
        lossAggMap.set(loss, g);
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
    packagingUsed,
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
      loads: overall.bags,
      output: Math.round(overall.output),
      loadingMs: overall.windowMs, // elapsed span (time used)
      plannedMin: Math.round(overall.plannedMs / 60_000),
      hasPlan: overall.plannedMs > 0,
      idleMs: overall.plannedMs > 0 ? Math.max(0, overall.plannedMs - overall.windowMs) : 0,
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
      pkgLoss: packagingLoss.total,
      goodValue: Math.round(prodPool.gv),
      lossValue: Math.round(prodPool.lv),
      a: pct(prodParts.availability),
      p: pct(prodParts.performance),
      q: pct(prodQ),
      oee: pct(prodOeeF),
      perLine: prodPerLine,
      perShift: prodPerShift,
      perDayShift: prodPerDayShift,
      shiftPlanMin: shiftTime.planMin,
      shiftBreakMin: shiftTime.breakMin,
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

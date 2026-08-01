// OEE (Overall Equipment Effectiveness) math — pure functions, safe to import
// from both client and server code (no DB, no "server-only").
//
//   OEE = Availability × Performance × Quality
//
//   Availability = run time ÷ planned time      (run = planned − downtime)
//   Performance  = actual output ÷ ideal output (ideal = standard rate × run time)
//   Quality      = good output ÷ total output    (good ÷ (good + reject))
//
// All component functions return a fraction in [0, 1]. Use `pct()` for display.

export type OeeRunInput = {
  /** Planned operating time this run, in minutes (already net of scheduled breaks). */
  plannedMin: number;
  /** Total recorded downtime during the run, in minutes. */
  downtimeMin: number;
  /** Good output produced (kg, bags, pallets… matching the machine's rate unit). */
  good: number;
  /** Reject / spillage output (same unit as `good`). */
  reject: number;
  /** Machine standard output per hour at full speed (e.g. 1500 kg/hr). */
  standardRatePerHour: number;
};

export type OeeResult = {
  availability: number; // 0..1
  performance: number; // 0..1
  quality: number; // 0..1
  oee: number; // 0..1
  runMin: number; // planned − downtime, floored at 0
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function computeOee(input: OeeRunInput): OeeResult {
  const planned = Math.max(0, input.plannedMin || 0);
  const downtime = Math.max(0, input.downtimeMin || 0);
  const runMin = Math.max(0, planned - downtime);
  const totalOutput = Math.max(0, (input.good || 0) + (input.reject || 0));

  const availability = planned > 0 ? clamp01(runMin / planned) : 0;

  const idealOutput = (input.standardRatePerHour || 0) * (runMin / 60);
  const performance = idealOutput > 0 ? clamp01(totalOutput / idealOutput) : 0;

  const quality = totalOutput > 0 ? clamp01((input.good || 0) / totalOutput) : 1;

  return {
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
    runMin,
  };
}

/** Aggregate many runs into one OEE by pooling their inputs (so a big run counts
 *  more than a tiny one). Returns the same shape as `computeOee`. */
export function aggregateOee(
  runs: (OeeRunInput & { standardRatePerHour: number })[]
): OeeResult {
  let plannedSum = 0;
  let runSum = 0;
  let idealSum = 0;
  let outputSum = 0;
  let goodSum = 0;

  for (const r of runs) {
    const planned = Math.max(0, r.plannedMin || 0);
    const runMin = Math.max(0, planned - Math.max(0, r.downtimeMin || 0));
    const total = Math.max(0, (r.good || 0) + (r.reject || 0));
    plannedSum += planned;
    runSum += runMin;
    idealSum += (r.standardRatePerHour || 0) * (runMin / 60);
    outputSum += total;
    goodSum += r.good || 0;
  }

  const availability = plannedSum > 0 ? clamp01(runSum / plannedSum) : 0;
  const performance = idealSum > 0 ? clamp01(outputSum / idealSum) : 0;
  const quality = outputSum > 0 ? clamp01(goodSum / outputSum) : 1;

  return {
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
    runMin: runSum,
  };
}

/** Fraction (0..1) → whole-number percent for display. */
export function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

// World-class OEE ~85%. Bands used consistently across the OEE screens.
export const OEE_GOOD = 85;
export const OEE_OK = 65;

/** Status color for an OEE-style percentage (0..100). */
export function oeeColor(percent: number): string {
  if (percent >= OEE_GOOD) return "#1f9d63"; // green — very good
  if (percent >= OEE_OK) return "#c8891a"; // amber — fair
  return "#c53f3f"; // red — needs attention
}

export const OEE_OPERATION_LABELS: Record<string, { en: string; th: string }> = {
  PRODUCTION: { en: "Production", th: "การผลิต" },
  UNLOADING: { en: "Unloading", th: "Unloading เข้า SILO" },
};

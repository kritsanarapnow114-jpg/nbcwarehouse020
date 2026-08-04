// OEE (Overall Equipment Effectiveness) math — pure functions, safe to import
// from both client and server code (no DB, no "server-only").
//
//   OEE = Availability × Performance × Quality
//
//   Availability = loading time ÷ available window (idle between loads lowers it)
//   Performance  = actual output ÷ (machine standard rate × loading time)
//   Quality      = good output ÷ total output (loaded ÷ staged)
//
// All component functions return a fraction in [0, 1]. Use `pct()` for display.

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Fraction (0..1) → whole-number percent for display. */
export function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

export type OeeParts = {
  availability: number; // 0..1
  performance: number; // 0..1
  quality: number; // 0..1
  oee: number; // 0..1
};

/** Combine A, P, Q (each 0..1) into a full OEE result. */
export function oeeFrom(availability: number, performance: number, quality: number): OeeParts {
  const a = clamp01(availability);
  const p = clamp01(performance);
  const q = clamp01(quality);
  return { availability: a, performance: p, quality: q, oee: a * p * q };
}

/**
 * Score an unloading machine over a set of finished bag-loads.
 *  - windowMs: the span the machine was in use (first start → last finish)
 *  - loadingMs: total time actually spent loading (Σ finish − start per bag)
 *  - output: total quantity loaded (kg)
 *  - staged: total quantity that was meant to be loaded (for Quality/spill)
 *  - standardPerHour: the machine's standard output rate (kg/hr)
 */
export function scoreUnloading(input: {
  plannedMs?: number; // planned unloading time for this session (from the plan)
  windowMs: number;
  loadingMs: number;
  output: number;
  staged: number;
  standardPerHour: number;
}): OeeParts {
  const loadingHours = input.loadingMs / 3_600_000;
  const ideal = input.standardPerHour > 0 ? input.standardPerHour * loadingHours : 0;
  const performance = ideal > 0 ? input.output / ideal : 0;
  const quality = input.staged > 0 ? input.output / input.staged : 1;
  const planned = input.plannedMs ?? 0;
  if (planned > 0) {
    // A plan was set → Availability = actual loading time ÷ planned time. Idle
    // time within the plan (waiting between bags) lowers A. OEE = A × P × Q.
    return oeeFrom(input.loadingMs / planned, performance, quality);
  }
  // No plan → can't judge availability: gaps between sporadic load orders mean
  // "no work", not a machine fault. Show utilization (load ÷ in-use window) as
  // info on the `availability` field, and keep OEE = P × Q.
  const utilization = input.windowMs > 0 ? input.loadingMs / input.windowMs : 0;
  const parts = oeeFrom(utilization, performance, quality);
  return { ...parts, oee: parts.performance * parts.quality };
}

/**
 * Score a production run from planned time, downtime and output.
 *  - plannedMin: planned operating time (min, net of breaks)
 *  - downtimeMin: total recorded downtime (min)
 *  - good / reject: finished-goods produced vs loss (same unit as the rate)
 *  - standardPerHour: the line's standard output rate (kg/hr)
 */
export function scoreProduction(input: {
  plannedMin: number;
  downtimeMin: number;
  good: number;
  reject: number;
  standardPerHour: number;
}): OeeParts {
  const planned = Math.max(0, input.plannedMin || 0);
  const runMin = Math.max(0, planned - Math.max(0, input.downtimeMin || 0));
  const total = Math.max(0, (input.good || 0) + (input.reject || 0));
  const availability = planned > 0 ? runMin / planned : 0;
  const ideal = input.standardPerHour > 0 ? input.standardPerHour * (runMin / 60) : 0;
  const performance = ideal > 0 ? total / ideal : 0;
  const quality = total > 0 ? (input.good || 0) / total : 1;
  return oeeFrom(availability, performance, quality);
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

/** Format a millisecond duration as a compact "Xh Ym" / "Ym" string. */
export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} ชม. ${m} น.`;
  return `${m} น.`;
}

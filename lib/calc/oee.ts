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
  windowMs: number; // elapsed span: first bag start → last bag finish (operating time)
  loadingMs: number; // Σ per-bag hands-on time (kept for info; can be ~0 if tapped fast)
  output: number;
  staged: number;
  standardPerHour: number;
}): OeeParts {
  const quality = input.staged > 0 ? input.output / input.staged : 1;
  const planned = input.plannedMs ?? 0;
  // Operating time = the elapsed session span, not the fragile per-bag sum (which
  // is ~0 when start/finish are tapped together). Fall back to loadingMs if window
  // is missing (legacy single-tap loads).
  const operatingMs = input.windowMs > 0 ? input.windowMs : input.loadingMs;

  if (planned > 0 && input.standardPerHour > 0) {
    // Availability = schedule adherence to the plan. Finishing WITHIN the planned
    // time (early or on-time) is 100% — a generous plan must never be a penalty.
    // Only an overrun beyond the plan lowers A (= planned ÷ actual).
    const availability = operatingMs <= planned ? 1 : clamp01(planned / operatingMs);
    // Performance = actual loading rate vs standard, over the time actually used
    // (fall back to the planned time if the elapsed span is unusable).
    const perfHours = (operatingMs > 0 ? operatingMs : planned) / 3_600_000;
    const performance = clamp01(input.output / (input.standardPerHour * perfHours));
    return oeeFrom(availability, performance, quality); // OEE = A × P × Q
  }

  // No plan (or no standard) → can't judge availability: gaps between sporadic
  // load orders mean "no work", not a machine fault. Show utilization as info on
  // the `availability` field, and keep OEE = P × Q.
  const opHours = operatingMs / 3_600_000;
  const ideal = input.standardPerHour > 0 ? input.standardPerHour * opHours : 0;
  const performance = ideal > 0 ? input.output / ideal : 0;
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

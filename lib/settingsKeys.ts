// Pure setting keys/helpers — safe to import from both client and server code
// (no "server-only", no DB access). The DB reads live in lib/views/settings.ts.

export function subtitleKey(page: string) {
  return `subtitle.${page}`;
}

/** Per-zone description override key (e.g. zone.A → "Dry raw material"). */
export function zoneLabelKey(zone: string) {
  return `zone.${zone}`;
}

export const ALL_ZONES = ["A", "B", "C", "D", "E"] as const;

// Editable pick-lists (one entry per line), managed on the Settings page.
export const ISSUE_TO_KEY = "list.issueTo"; // Issue → "จ่ายไปที่" options
export const OPERATORS_KEY = "list.operators"; // Transfer → "ผู้ปฏิบัติงาน" options
export const BOM_SOURCE_KEY = "list.bomSource"; // BOM consumes materials only from these location codes (empty = anywhere)
export const PROD_LINES_KEY = "list.prodLines"; // Production lines/machines offered on the Pack Order OEE capture

export const ISSUE_TO_DEFAULTS = [
  "PRODUCTION-AREA110",
  "PRODUCTION-AREA140",
  "LAB-AREA010",
  "PACKING LINE-AREA020",
];

/** Split a stored newline/comma list into trimmed, non-empty entries. */
export function parseList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// OEE: standard output rate (units/hour) per unloading machine, stored as a JSON
// map { [machineName]: ratePerHour } in AppSetting. Drives the Performance score.
export const OEE_STANDARDS_KEY = "oee.standards";

// The unloading machines the SILO feed screen offers (kept in sync with
// app/(app)/silo/SiloFeed.tsx). OEE scores each of these.
export const OEE_MACHINES = ["Super Sack Unloading", "Box Unloading", "EBS Unloading"] as const;

// Sensible starting rates (kg/hr) — fully editable on the Settings page.
export const OEE_STANDARD_DEFAULTS: Record<string, number> = {
  "Super Sack Unloading": 1500,
  "Box Unloading": 1000,
  "EBS Unloading": 2000,
};

/** Parse the stored OEE standards JSON into a name→rate map, falling back to the
 *  defaults for any machine without a saved value. */
export function parseOeeStandards(raw: string | undefined | null): Record<string, number> {
  const out: Record<string, number> = { ...OEE_STANDARD_DEFAULTS };
  if (raw) {
    try {
      const j = JSON.parse(raw);
      for (const [k, v] of Object.entries(j)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) out[k] = n;
      }
    } catch {
      // ignore malformed JSON — use defaults
    }
  }
  return out;
}

export const COUNT_PLAN_MONTHLY_KEY = "countPlan.monthly"; // legacy single value (fallback)
export const COUNT_PLAN_WEEKLY_KEY = "countPlan.weekly"; // legacy single value (fallback)
export const COUNT_PLAN_MONTHS_KEY = "countPlan.months"; // JSON: 12 values, index 0=Jan
export const COUNT_PLAN_WEEKS_KEY = "countPlan.weeks"; // JSON: 5 values, index 0=W1

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Legacy single count-plan targets (per month / per week). null = not set. */
export function getCountPlan(settings: Record<string, string>): {
  monthly: number | null;
  weekly: number | null;
} {
  const m = settings[COUNT_PLAN_MONTHLY_KEY];
  const w = settings[COUNT_PLAN_WEEKLY_KEY];
  return {
    monthly: m != null && m !== "" ? Number(m) : null,
    weekly: w != null && w !== "" ? Number(w) : null,
  };
}

function parseNumArray(raw: string | undefined, n: number): (number | null)[] {
  const out: (number | null)[] = Array(n).fill(null);
  if (!raw) return out;
  try {
    const j = JSON.parse(raw);
    for (let i = 0; i < n; i++) {
      const v = j?.[i];
      if (v != null && v !== "") out[i] = Number(v);
    }
  } catch {
    // ignore malformed JSON — treat as unset
  }
  return out;
}

/** Per-month (0=Jan..11=Dec) and per-week (0=W1..4=W5) count-plan targets, with
 *  the legacy single values as fallbacks. null entries mean "count every lot". */
export function getCountPlanDetailed(settings: Record<string, string>): {
  months: (number | null)[];
  weeks: (number | null)[];
  monthlyFallback: number | null;
  weeklyFallback: number | null;
} {
  const single = getCountPlan(settings);
  return {
    months: parseNumArray(settings[COUNT_PLAN_MONTHS_KEY], 12),
    weeks: parseNumArray(settings[COUNT_PLAN_WEEKS_KEY], 5),
    monthlyFallback: single.monthly,
    weeklyFallback: single.weekly,
  };
}

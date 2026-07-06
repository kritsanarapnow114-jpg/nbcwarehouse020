// Pure setting keys/helpers — safe to import from both client and server code
// (no "server-only", no DB access). The DB reads live in lib/views/settings.ts.

export function subtitleKey(page: string) {
  return `subtitle.${page}`;
}

export const COUNT_PLAN_MONTHLY_KEY = "countPlan.monthly";
export const COUNT_PLAN_WEEKLY_KEY = "countPlan.weekly";

/** Count-plan targets (lots to count per month / per week). null = not set,
 *  in which case the dashboard falls back to "count every lot". */
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

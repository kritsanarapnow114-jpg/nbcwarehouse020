// Client-safe plan period constants (no server-only / DB imports).
export type PlanPeriod = "day" | "month" | "year";

export const PLAN_PERIODS: { value: PlanPeriod; label: string }[] = [
  { value: "day", label: "รายวัน (per day)" },
  { value: "month", label: "รายเดือน (per month)" },
  { value: "year", label: "รายปี (per year)" },
];

export const PERIOD_WORD: Record<PlanPeriod, string> = {
  day: "ต่อวัน",
  month: "ต่อเดือน",
  year: "ต่อปี",
};

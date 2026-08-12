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

// ---- OEE monthly report (Trial-Run / Startup) -------------------------------
// A single editable report block stored as JSON in AppSetting. Lets the packing
// unit publish an auditable Trial-Run OEE report (calc base, targets, last-month
// actuals) without changing the schema.
export const OEE_REPORT_KEY = "oee.report";

export const OEE_PHASES = [
  "Commissioning",
  "Early Startup",
  "Ramp-up",
  "Stabilization",
  "Mature Operation",
] as const;

export type OeeReportRowKey =
  | "plannedHr"
  | "operatingHr"
  | "downtimeMin"
  | "stdRate"
  | "produced"
  | "goodFPY"
  | "repack"
  | "scrap"
  | "availability"
  | "performance"
  | "quality"
  | "oee";

export const OEE_REPORT_ROWS: {
  key: OeeReportRowKey;
  label: string;
  unit: string;
  hasTarget: boolean;
  pct?: boolean;
}[] = [
  { key: "plannedHr", label: "Planned Production Time", unit: "hr", hasTarget: false },
  { key: "operatingHr", label: "Operating Time", unit: "hr", hasTarget: false },
  { key: "downtimeMin", label: "Total Downtime", unit: "min", hasTarget: true },
  { key: "stdRate", label: "Standard Rate", unit: "units/hr", hasTarget: false },
  { key: "produced", label: "Total Produced", unit: "tonnes", hasTarget: true },
  { key: "goodFPY", label: "Good First-Pass Quantity", unit: "tonnes", hasTarget: true },
  { key: "repack", label: "Rework / Repack", unit: "units", hasTarget: true },
  { key: "scrap", label: "Scrap / Rejected", unit: "units", hasTarget: true },
  { key: "availability", label: "Availability", unit: "%", hasTarget: true, pct: true },
  { key: "performance", label: "Performance", unit: "%", hasTarget: true, pct: true },
  { key: "quality", label: "Quality", unit: "%", hasTarget: true, pct: true },
  { key: "oee", label: "OEE", unit: "%", hasTarget: true, pct: true },
];

export type OeeReportCell = { cur: string; target: string; prev: string };
export type OeeReport = {
  phase: string;
  rows: Record<OeeReportRowKey, OeeReportCell>;
};

// Last-month (July) actuals already known from the manual report; everything else
// starts blank for the team to fill in as the month progresses.
const OEE_REPORT_PREV_DEFAULTS: Partial<Record<OeeReportRowKey, string>> = {
  downtimeMin: "45",
  availability: "97.0",
  performance: "97.0",
  quality: "74.7",
  oee: "70.3",
};

export function parseOeeReport(raw: string | undefined | null): OeeReport {
  const rows = {} as Record<OeeReportRowKey, OeeReportCell>;
  for (const r of OEE_REPORT_ROWS) {
    rows[r.key] = { cur: "", target: "", prev: OEE_REPORT_PREV_DEFAULTS[r.key] ?? "" };
  }
  const out: OeeReport = { phase: "Ramp-up", rows };
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (typeof j?.phase === "string") out.phase = j.phase;
      if (j?.rows && typeof j.rows === "object") {
        for (const r of OEE_REPORT_ROWS) {
          const c = j.rows[r.key];
          if (c && typeof c === "object") {
            out.rows[r.key] = {
              cur: typeof c.cur === "string" ? c.cur : "",
              target: typeof c.target === "string" ? c.target : "",
              prev: typeof c.prev === "string" ? c.prev : out.rows[r.key].prev,
            };
          }
        }
      }
    } catch {
      // malformed — use defaults
    }
  }
  return out;
}

/** OEE guideline by startup phase (replaces the World-Class band table). */
export const OEE_PHASE_GUIDE: { phase: string; range: string; priority: string }[] = [
  { phase: "Commissioning", range: "30–50%", priority: "Function, interlock, safety" },
  { phase: "Early Startup", range: "50–65%", priority: "Breakdown & defect" },
  { phase: "Ramp-up", range: "65–75%", priority: "Quality & cycle stability" },
  { phase: "Stabilization", range: "75–85%", priority: "Reliability & standard work" },
  { phase: "Mature Operation", range: "≥85%", priority: "Continuous improvement (Road to World-Class)" },
];

/** Standard Risk Level → management requirement (used across OEE report tables). */
export const RISK_LEVELS: { level: string; color: string; requirement: string }[] = [
  {
    level: "Critical",
    color: "#c53f3f",
    requirement:
      "Stop the activity immediately. Senior-management authorization is required before restart.",
  },
  {
    level: "High",
    color: "#e0691f",
    requirement:
      "Implement immediate interim controls. Corrective action and management follow-up are mandatory.",
  },
  {
    level: "Medium",
    color: "#c8891a",
    requirement: "Apply additional controls and track the action within an agreed timeframe.",
  },
  {
    level: "Low",
    color: "#1f9d63",
    requirement: "Maintain existing controls and monitor through routine operations.",
  },
];

// ---- OEE analytics: Quality Loss Pareto, Loss Pareto, extra KPIs ------------
// All settings-driven (JSON in AppSetting) — these are monthly-compiled report
// figures, not per-transaction data, so no schema change is needed.
export const OEE_QUALITY_LOSS_KEY = "oee.qualityLoss";
export const OEE_LOSS_PARETO_KEY = "oee.lossPareto";
export const OEE_KPIS_KEY = "oee.kpis";

export type QualityLossRow = { reason: string; qty: string; impact: string };

export const QUALITY_LOSS_SEED: QualityLossRow[] = [
  { reason: "Liner bag bottom tear", qty: "", impact: "Repack / Product loss" },
  { reason: "Weight out of tolerance", qty: "", impact: "Reweigh / Repack" },
  { reason: "Incorrect / Unreadable label", qty: "", impact: "Re-label" },
  { reason: "Package deformation / damage", qty: "", impact: "Hold / Repack" },
  { reason: "Start-up / Trial product", qty: "", impact: "Hold / Scrap" },
  { reason: "Other", qty: "", impact: "Investigation" },
];

export function parseQualityLoss(raw: string | undefined | null): QualityLossRow[] {
  if (!raw) return QUALITY_LOSS_SEED.map((r) => ({ ...r }));
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) {
      return j.map((r) => ({
        reason: String(r?.reason ?? ""),
        qty: String(r?.qty ?? ""),
        impact: String(r?.impact ?? ""),
      }));
    }
  } catch {
    /* ignore */
  }
  return QUALITY_LOSS_SEED.map((r) => ({ ...r }));
}

export const LOSS_CATEGORIES = [
  "Equipment breakdown",
  "Process loss",
  "Quality loss",
  "Upstream / Silo loss",
  "Warehouse / Logistics",
  "SAP / IT loss",
  "Planned commissioning test",
] as const;

export const LOSS_STATUSES = ["Open", "In progress", "Closed"] as const;

// OEE Downtime capture: the pick-list of downtime reasons shown on the Pack
// Order OEE form, each mapped to the responsible loss category (ฝ่ายรับผิดชอบ).
// Picking a reason narrows the category dropdown to just its categories.
export const OEE_DOWNTIME_REASONS_KEY = "oee.downtimeReasons";

/** A downtime reason and the loss categories it may be attributed to. An empty
 *  `categories` means "any category is allowed" (e.g. a generic "อื่น ๆ"). */
export type DowntimeReasonDef = { reason: string; categories: string[] };

export const DOWNTIME_REASON_DEFAULTS: DowntimeReasonDef[] = [
  { reason: "เครื่องเสีย", categories: ["Equipment breakdown"] },
  { reason: "รอวัตถุดิบ", categories: ["Upstream / Silo loss"] },
  { reason: "เปลี่ยนรุ่น", categories: ["Process loss"] },
  { reason: "ทำความสะอาด", categories: ["Process loss"] },
  { reason: "รอบรรจุภัณฑ์", categories: ["Warehouse / Logistics"] },
  { reason: "อื่น ๆ", categories: [] },
];

const cloneReasons = (rows: DowntimeReasonDef[]) =>
  rows.map((r) => ({ reason: r.reason, categories: [...r.categories] }));

/** Parse the stored downtime-reason JSON, keeping only categories that are real
 *  LOSS_CATEGORIES and dropping blank reasons; falls back to the seed. */
export function parseDowntimeReasons(raw: string | undefined | null): DowntimeReasonDef[] {
  if (!raw) return cloneReasons(DOWNTIME_REASON_DEFAULTS);
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) {
      const valid = new Set<string>(LOSS_CATEGORIES);
      const rows: DowntimeReasonDef[] = j
        .map((r) => ({
          reason: String(r?.reason ?? "").trim(),
          categories: Array.isArray(r?.categories)
            ? Array.from(new Set((r.categories as unknown[]).map((c) => String(c)))).filter((c) =>
                valid.has(c)
              )
            : [],
        }))
        .filter((r) => r.reason !== "");
      if (rows.length > 0) return rows;
    }
  } catch {
    /* ignore */
  }
  return cloneReasons(DOWNTIME_REASON_DEFAULTS);
}

export type LossParetoRow = {
  loss: string;
  category: string;
  freq: string;
  lostMin: string;
  oeeImpact: string; // % (negative), stored as a plain number string e.g. "2.4"
  owner: string;
  status: string;
};

export const LOSS_PARETO_SEED: LossParetoRow[] = [
  { loss: "Liner bag tear / Repack", category: "Quality loss", freq: "", lostMin: "", oeeImpact: "", owner: "Packaging / Vendor", status: "Open" },
  { loss: "Conveyor logic fault", category: "Equipment breakdown", freq: "", lostMin: "", oeeImpact: "", owner: "Project / Automation", status: "In progress" },
  { loss: "Forklift waiting", category: "Warehouse / Logistics", freq: "", lostMin: "", oeeImpact: "", owner: "Warehouse", status: "Open" },
  { loss: "HMI / Sequence error", category: "SAP / IT loss", freq: "", lostMin: "", oeeImpact: "", owner: "Project / Automation", status: "In progress" },
  { loss: "Changeover / Setup", category: "Process loss", freq: "", lostMin: "", oeeImpact: "", owner: "Operation / M&R", status: "Open" },
];

export function parseLossPareto(raw: string | undefined | null): LossParetoRow[] {
  if (!raw) return LOSS_PARETO_SEED.map((r) => ({ ...r }));
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) {
      return j.map((r) => ({
        loss: String(r?.loss ?? ""),
        category: String(r?.category ?? LOSS_CATEGORIES[0]),
        freq: String(r?.freq ?? ""),
        lostMin: String(r?.lostMin ?? ""),
        oeeImpact: String(r?.oeeImpact ?? ""),
        owner: String(r?.owner ?? ""),
        status: String(r?.status ?? "Open"),
      }));
    }
  } catch {
    /* ignore */
  }
  return LOSS_PARETO_SEED.map((r) => ({ ...r }));
}

export type OeeKpiDef = { key: string; label: string; unit: string; help: string };

export const OEE_KPIS: OeeKpiDef[] = [
  { key: "totalTonnes", label: "Total packed tonnes", unit: "t", help: "ผลผลิตจริง" },
  { key: "scheduleAttain", label: "Schedule attainment", unit: "%", help: "ผลิตได้ตามแผน" },
  { key: "fpy", label: "First Pass Yield", unit: "%", help: "คุณภาพก่อน Rework" },
  { key: "repackRate", label: "Repack rate", unit: "%", help: "ปัญหาหลักของ Packing" },
  { key: "autoMode", label: "Auto-mode utilization", unit: "%", help: "เดินเองไม่พึ่ง Manual/Vendor" },
  { key: "mtbf", label: "MTBF", unit: "hr", help: "ความถี่การเสีย/Trip" },
  { key: "mttr", label: "MTTR", unit: "min", help: "ความเร็วในการแก้" },
  { key: "microStops", label: "Micro-stop frequency", unit: "/shift", help: "หยุดสั้นที่ Downtime ไม่เห็น" },
  { key: "pkgLoss", label: "Packaging material loss", unit: "units", help: "Big Bag/Liner/Octabin เสีย" },
  { key: "openPunch", label: "Open critical punch items", unit: "", help: "ข้อจำกัดความพร้อม Startup" },
  { key: "vendorHours", label: "Vendor dependency hours", unit: "hr", help: "ความพร้อมรับมอบระบบ" },
];

export function parseKpis(raw: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of OEE_KPIS) out[k.key] = "";
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (j && typeof j === "object") {
        for (const k of OEE_KPIS) if (typeof j[k.key] === "string") out[k.key] = j[k.key];
      }
    } catch {
      /* ignore */
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

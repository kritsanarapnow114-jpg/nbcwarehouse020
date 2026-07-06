import "server-only";
import { Range } from "./dashboard";
import {
  getInventoryStats,
  getStorageUtilization,
  getValueByCategory,
  getValueByExpiry,
  getMovementDetail,
} from "./dashboard";
import { kpiBand } from "@/lib/calc/kpi";

/** All the numbers a summary presentation needs, computed for one period.
 *  Plain-serializable so it can be handed to the client PowerPoint builder. */
export async function getExecutiveSummary(range: Range) {
  const [stats, storage, byCategory, byExpiry, movement, kpis] = await Promise.all([
    getInventoryStats(range),
    getStorageUtilization(range.end),
    getValueByCategory(range.end),
    getValueByExpiry(range.end),
    getMovementDetail(range, 6),
    kpiBand(range),
  ]);

  return {
    stats,
    storage: {
      totalPct: storage.totalPct,
      totalUsed: storage.totalUsed,
      totalCap: storage.totalCap,
      zones: storage.zones.map((z) => ({ name: z.name, desc: z.desc, pct: z.pct })),
    },
    categories: byCategory.map((c) => ({ name: c.name, value: c.value })),
    expiry: {
      atRiskValue: byExpiry.atRiskValue,
      buckets: byExpiry.buckets.map((b) => ({ label: b.label, value: b.value, count: b.count })),
    },
    movement,
    kpis: kpis.map((k) => ({ label: k.label, th: k.th, value: k.value, target: k.target, tone: k.tone })),
  };
}

export type ExecutiveSummary = Awaited<ReturnType<typeof getExecutiveSummary>>;

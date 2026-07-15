import "server-only";
import { Range } from "./dashboard";
import {
  getInventoryStats,
  getStorageUtilization,
  getValueByCategory,
  getValueByExpiry,
  getMovementDetail,
} from "./dashboard";
import { getReportData } from "./reports";
import { getProductRows } from "./products";
import { getAgingRows } from "./aging";
import { kpiBand } from "@/lib/calc/kpi";

// Include the full period's rows in the deck — the PowerPoint export paginates
// any table that overflows a slide onto continuation slides.
const DETAIL_CAP = 400;

/** All the numbers a summary presentation needs, computed for one period.
 *  Plain-serializable so it can be handed to the client PowerPoint builder. */
export async function getExecutiveSummary(range: Range) {
  const [stats, storage, byCategory, byExpiry, movement, kpis, report, products, aging] =
    await Promise.all([
      getInventoryStats(range),
      getStorageUtilization(range.end),
      getValueByCategory(range.end),
      getValueByExpiry(range.end),
      getMovementDetail(range, 6),
      kpiBand(range),
      getReportData(range),
      getProductRows(),
      getAgingRows({ filter: "all", thresholdDays: 90 }),
    ]);

  // On-hand balances — top SKUs by value, only those actually holding stock.
  const balances = products
    .filter((p) => p.onHand > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, DETAIL_CAP)
    .map((p) => ({
      code: p.code,
      name: p.nameEn,
      onHand: p.onHand,
      unit: p.unit,
      value: p.totalValue,
      lotCount: p.lotCount,
    }));

  // Aging — oldest lots first (getAgingRows already sorts by ageDays desc).
  const agingTop = aging.slice(0, DETAIL_CAP).map((a) => ({
    code: a.code,
    name: a.nameEn,
    lotNo: a.lotNo,
    location: a.locationCode,
    onHand: a.onHand,
    unit: a.unit,
    ageDays: a.ageDays,
    expLabel: a.expLabel,
    daysLeft: a.daysLeft,
  }));

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
    detail: {
      production: {
        docCount: report.production.docCount,
        totalProduced: report.production.totalProduced,
        totalProdLoss: report.production.totalProdLoss,
        yieldPct: report.production.yieldPct,
        rows: report.production.rows.slice(0, DETAIL_CAP).map((r) => ({
          docNo: r.docNo,
          docDate: r.docDate,
          code: r.code,
          name: r.name,
          lotNo: r.lotNo,
          qty: r.qty,
          unit: r.unit,
        })),
      },
      balances,
      aging: agingTop,
      receiving: {
        docCount: report.receiving.docCount,
        totalUnits: report.receiving.totalUnits,
        rows: report.receiving.rows.slice(0, DETAIL_CAP).map((r) => ({
          docNo: r.docNo,
          docDate: r.docDate,
          code: r.code,
          name: r.name,
          lotNo: r.lotNo,
          qty: r.qty,
          unit: r.unit,
          location: r.locationCode,
          materialDoc: r.materialDoc,
        })),
      },
      issuing: {
        docCount: report.issuing.docCount,
        totalUnits: report.issuing.totalUnits,
        rows: report.issuing.rows.slice(0, DETAIL_CAP).map((r) => ({
          docNo: r.docNo,
          docDate: r.docDate,
          code: r.code,
          name: r.name,
          lotNo: r.lotNo,
          qty: r.qty,
          unit: r.unit,
          issueTo: r.issueTo,
          materialDoc: r.materialDoc,
        })),
      },
      transfer: {
        docCount: report.transfer.docCount,
        totalUnits: report.transfer.totalUnits,
        rows: report.transfer.rows.slice(0, DETAIL_CAP).map((r) => ({
          docNo: r.docNo,
          docDate: r.docDate,
          code: r.code,
          name: r.name,
          lotNo: r.lotNo,
          qty: r.qty,
          unit: r.unit,
          from: r.fromLocationCode,
          to: r.toLocationCode,
        })),
      },
      count: {
        docCount: report.count.docCount,
        lineCount: report.count.lineCount,
        accuracyPct: report.count.accuracyPct,
        rows: report.count.rows.slice(0, DETAIL_CAP).map((r) => ({
          docNo: r.docNo,
          docDate: r.docDate,
          code: r.code,
          name: r.name,
          lotNo: r.lotNo,
          sysQty: r.sysQty,
          countedQty: r.countedQty,
          variance: r.variance,
          unit: r.unit,
        })),
      },
      po: {
        docCount: report.po.docCount,
        totalOrdered: report.po.totalOrdered,
        totalReceived: report.po.totalReceived,
        rows: report.po.rows.slice(0, DETAIL_CAP).map((r) => ({
          no: r.no,
          vendor: r.vendor,
          date: r.date,
          status: r.status,
          code: r.code,
          name: r.name,
          ordered: r.ordered,
          received: r.received,
          remaining: r.remaining,
        })),
      },
    },
  };
}

export type ExecutiveSummary = Awaited<ReturnType<typeof getExecutiveSummary>>;

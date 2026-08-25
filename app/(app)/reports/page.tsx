import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Currency";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { resolvePeriod } from "@/lib/calc/period";
import { getReportData, getReportProductOptions } from "@/lib/views/reports";
import { getExecutiveSummary } from "@/lib/views/summary";
import { getOeeDashboard } from "@/lib/views/oee";
import { ReportsStockCard } from "./ReportsStockCard";
import { ReportRunner } from "./ReportRunner";
import { ExportDeckButton, type DeckOee } from "./ExportDeckButton";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const { mode, range, dateStr, startStr, endStr } = resolvePeriod(params);

  const [data, products, summary, oeeDash] = await Promise.all([
    getReportData(range),
    getReportProductOptions(),
    getExecutiveSummary(range),
    getOeeDashboard(range),
  ]);

  const periodLabel =
    mode === "all"
      ? "ทั้งหมด (All time)"
      : `${fmtDateBE(range.start)} – ${fmtDateBE(range.end)}`;

  // OEE + Packaging folded into the combined deck.
  const oee: DeckOee = {
    summary: {
      a: oeeDash.production.a,
      p: oeeDash.production.p,
      q: oeeDash.production.q,
      oee: oeeDash.production.oee,
      produced: oeeDash.production.produced,
      loss: oeeDash.production.loss,
      scoredRuns: oeeDash.production.scoredRuns,
      docs: oeeDash.production.docs,
    },
    perLine: oeeDash.production.perLine,
    perShift: oeeDash.production.perShift,
    perDayShift: oeeDash.production.perDayShift,
    lossPareto: oeeDash.captured.lossPareto,
    pkgUsed: oeeDash.packagingUsed.byMaterial,
    pkgLoss: oeeDash.packagingLoss.byMaterial,
    repack: oeeDash.captured.repack,
    scrap: oeeDash.captured.scrap,
    downtimeMin: oeeDash.productionRuns.reduce((s, r) => s + r.downtimeMin, 0),
  };

  return (
    <div className="max-w-[1280px] p-[24px_26px]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PeriodSelector basePath="/reports" mode={mode} date={dateStr} start={startStr} end={endStr} />
        <div className="flex-1" />
        <ExportDeckButton summary={summary} periodLabel={periodLabel} oee={oee} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Received (รับเข้า)</div>
          <div className="font-num text-[24px] font-bold tracking-tight text-[#1f66a6]">
            {data.receiving.totalUnits.toLocaleString()}
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">{data.receiving.docCount} docs</div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Issued (จ่ายออก)</div>
          <div className="font-num text-[24px] font-bold tracking-tight text-[#c9821f]">
            {data.issuing.totalUnits.toLocaleString()}
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">{data.issuing.docCount} docs</div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Loss value (มูลค่าสูญเสีย)</div>
          <div className="font-num text-[24px] font-bold tracking-tight text-[#d24141]">
            <Money value={data.loss.totalValue} />
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">{data.loss.totalQty.toLocaleString()} units short</div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Production yield (ผลิต)</div>
          <div className="font-num text-[24px] font-bold tracking-tight text-[#0c7f93]">
            {data.production.yieldPct.toFixed(1)}%
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">
            {data.production.totalProduced.toLocaleString()} produced · {data.production.totalProdLoss.toLocaleString()} loss
          </div>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Purchase Orders (PO)</div>
          <div className="font-num text-[20px] font-bold tracking-tight">{data.po.docCount}</div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">
            {data.po.totalReceived.toLocaleString()} / {data.po.totalOrdered.toLocaleString()} received
          </div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Transfers (ย้ายที่เก็บ)</div>
          <div className="font-num text-[20px] font-bold tracking-tight">{data.transfer.totalUnits.toLocaleString()}</div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">{data.transfer.docCount} docs</div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Stock Count accuracy (นับสต็อก)</div>
          <div className="font-num text-[20px] font-bold tracking-tight text-[#2f86cf]">
            {data.count.accuracyPct.toFixed(1)}%
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">{data.count.docCount} docs · {data.count.lineCount} lines</div>
        </Card>
      </div>

      <ReportRunner start={fmtDateISO(range.start)} end={fmtDateISO(range.end)} />

      {products.length > 0 && (
        <ReportsStockCard
          products={products}
          start={fmtDateISO(range.start)}
          end={fmtDateISO(range.end)}
        />
      )}
    </div>
  );
}

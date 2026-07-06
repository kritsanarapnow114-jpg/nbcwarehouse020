import { Card, CardTitle } from "@/components/ui/Card";
import { Money } from "@/components/ui/Currency";
import { fmtDateBE, fmtDateISO } from "@/lib/calc/date";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { resolvePeriod } from "@/lib/calc/period";
import { getReportData, getReportProductOptions } from "@/lib/views/reports";
import { ReportsStockCard } from "./ReportsStockCard";
import { ExportBar } from "./ExportBar";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const { mode, range, dateStr, startStr, endStr } = resolvePeriod(params);

  const [data, products] = await Promise.all([
    getReportData(range),
    getReportProductOptions(),
  ]);

  return (
    <div className="max-w-[1280px] p-[24px_26px]">
      <PeriodSelector basePath="/reports" mode={mode} date={dateStr} start={startStr} end={endStr} />

      <ExportBar start={fmtDateISO(range.start)} end={fmtDateISO(range.end)} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">Received (รับเข้า)</div>
          <div className="font-num text-[24px] font-bold tracking-tight text-[#17935a]">
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
          <div className="font-num text-[24px] font-bold tracking-tight text-[#12894f]">
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
          <div className="font-num text-[20px] font-bold tracking-tight text-[#3E9B6E]">
            {data.count.accuracyPct.toFixed(1)}%
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">{data.count.docCount} docs · {data.count.lineCount} lines</div>
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Receiving (รับสินค้า) — log by product</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "Qty", "Lot", "Location", "Mode", "PO Ref.", "Doc No."]}
            rows={data.receiving.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.docDate)),
              `${r.qty.toLocaleString()} ${r.unit}`,
              r.lotNo,
              r.locationCode,
              r.mode,
              r.poNo ?? "—",
              r.docNo,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Issuing (จ่ายสินค้า) — log by product</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "Qty", "Lot", "Issued To", "Doc No."]}
            rows={data.issuing.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.docDate)),
              `${r.qty.toLocaleString()} ${r.unit}`,
              r.lotNo,
              r.issueTo,
              r.docNo,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Loss (สูญเสีย) — negative variance from Adjustments</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "Qty short", "Value", "Lot", "Location", "Reason", "Doc No."]}
            rows={data.loss.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.docDate)),
              r.qty.toLocaleString(),
              `฿${Math.round(r.value).toLocaleString()}`,
              r.lotNo,
              r.locationCode,
              r.reason,
              r.docNo,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Production (ผลิต) — finished-goods lots produced</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "Qty", "Lot", "Location", "Doc loss", "Doc No."]}
            rows={data.production.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.docDate)),
              `${r.qty.toLocaleString()} ${r.unit}`,
              r.lotNo,
              r.locationCode,
              r.prodLoss.toLocaleString(),
              r.docNo,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Production material loss (สูญเสียวัตถุดิบจากผลิต)</CardTitle>
          <ReportTable
            cols={["Material Code", "Material", "Date", "Loss qty", "Value", "Doc No."]}
            rows={data.production.bomLossRows.map((r) => [
              r.materialCode,
              r.materialName,
              fmtDateBE(new Date(r.docDate)),
              `${r.lossQty.toLocaleString()} ${r.unit}`,
              `฿${Math.round(r.value).toLocaleString()}`,
              r.docNo,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Purchase Orders (ใบสั่งซื้อ) — log by product</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "Ordered", "Received", "Remaining", "Vendor", "Status", "PO No."]}
            rows={data.po.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.date)),
              r.ordered.toLocaleString(),
              r.received.toLocaleString(),
              r.remaining.toLocaleString(),
              r.vendor,
              r.status,
              r.no,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Transfers (ย้ายที่เก็บ) — log by product</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "Qty", "Lot", "From", "To", "Operator", "Doc No."]}
            rows={data.transfer.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.docDate)),
              `${r.qty.toLocaleString()} ${r.unit}`,
              r.lotNo,
              r.fromLocationCode,
              r.toLocationCode,
              r.operator,
              r.docNo,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Stock Count (นับสต็อก) — log by product</CardTitle>
          <ReportTable
            cols={["Code", "Product", "Date", "System", "Counted", "Variance", "Lot", "Location", "Zone", "Doc No."]}
            rows={data.count.rows.map((r) => [
              r.code,
              r.name,
              fmtDateBE(new Date(r.docDate)),
              r.sysQty.toLocaleString(),
              r.countedQty.toLocaleString(),
              r.variance > 0 ? `+${r.variance.toLocaleString()}` : r.variance.toLocaleString(),
              r.lotNo,
              r.locationCode,
              r.pullZone,
              r.docNo,
            ])}
          />
        </Card>
      </div>

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

function ReportTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="sticky top-0 bg-white text-left text-[#9aa4b4]">
            {cols.map((c) => (
              <th key={c} className="py-2 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[#eef1f5]">
              {r.map((v, j) => {
                const isFirst = j === 0;
                const isLast = j === r.length - 1;
                return (
                  <td
                    key={j}
                    className={`py-2 pr-3 ${
                      isFirst
                        ? "font-num font-semibold text-[#3a4658]"
                        : isLast
                          ? "font-num text-[11px] text-[#9aa4b4]"
                          : ""
                    }`}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="py-6 text-center text-[#9aa4b4]">
                No data for this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

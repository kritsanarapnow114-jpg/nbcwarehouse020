import { Card, CardTitle } from "@/components/ui/Card";
import { Money } from "@/components/ui/Currency";
import { fmtDateBE, parseISO, fmtDateISO, todayBangkok } from "@/lib/calc/date";
import { getReportData, getReportProductOptions } from "@/lib/views/reports";
import { PeriodSelector } from "./PeriodSelector";
import { ReportsStockCard } from "./ReportsStockCard";
import { ExportBar } from "./ExportBar";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const today = todayBangkok();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 29);

  const range = {
    start: start ? parseISO(start) : defaultStart,
    end: end ? parseISO(end) : today,
  };

  const [data, products] = await Promise.all([
    getReportData(range),
    getReportProductOptions(),
  ]);

  return (
    <div className="max-w-[1280px] p-[24px_26px]">
      <PeriodSelector start={fmtDateISO(range.start)} end={fmtDateISO(range.end)} />

      <ExportBar start={fmtDateISO(range.start)} end={fmtDateISO(range.end)} />

      <div className="mb-4 grid grid-cols-4 gap-4">
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

      <div className="mb-4 grid grid-cols-3 gap-4">
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
          <CardTitle>Receiving (รับสินค้า) — detail by line</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Mode", "PO Ref.", "Code", "Product", "Lot", "Location", "Qty"]}
            rows={data.receiving.rows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.mode,
              r.poNo ?? "—",
              r.code,
              r.name,
              r.lotNo,
              r.locationCode,
              `${r.qty.toLocaleString()} ${r.unit}`,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Issuing (จ่ายสินค้า) — detail by line</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Issued To", "Code", "Product", "Lot", "Qty"]}
            rows={data.issuing.rows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.issueTo,
              r.code,
              r.name,
              r.lotNo,
              `${r.qty.toLocaleString()} ${r.unit}`,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Loss (สูญเสีย) — negative variance from Adjustments</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Reason", "Code", "Product", "Lot", "Location", "Qty short", "Value"]}
            rows={data.loss.rows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.reason,
              r.code,
              r.name,
              r.lotNo,
              r.locationCode,
              r.qty.toLocaleString(),
              `฿${Math.round(r.value).toLocaleString()}`,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Production (ผลิต) — finished-goods lots produced</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Code", "Product", "Lot", "Location", "Qty", "Doc loss"]}
            rows={data.production.rows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.code,
              r.name,
              r.lotNo,
              r.locationCode,
              `${r.qty.toLocaleString()} ${r.unit}`,
              r.prodLoss.toLocaleString(),
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Production material loss (สูญเสียวัตถุดิบจากผลิต)</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Material Code", "Material", "Loss qty", "Value"]}
            rows={data.production.bomLossRows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.materialCode,
              r.materialName,
              `${r.lossQty.toLocaleString()} ${r.unit}`,
              `฿${Math.round(r.value).toLocaleString()}`,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Purchase Orders (ใบสั่งซื้อ) — detail by line</CardTitle>
          <ReportTable
            cols={["PO No.", "Vendor", "Date", "Status", "Code", "Product", "Ordered", "Received", "Remaining"]}
            rows={data.po.rows.map((r) => [
              r.no,
              r.vendor,
              fmtDateBE(new Date(r.date)),
              r.status,
              r.code,
              r.name,
              r.ordered.toLocaleString(),
              r.received.toLocaleString(),
              r.remaining.toLocaleString(),
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Transfers (ย้ายที่เก็บ) — detail by line</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Operator", "Code", "Product", "Lot", "From", "To", "Qty"]}
            rows={data.transfer.rows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.operator,
              r.code,
              r.name,
              r.lotNo,
              r.fromLocationCode,
              r.toLocationCode,
              `${r.qty.toLocaleString()} ${r.unit}`,
            ])}
          />
        </Card>
      </div>

      <div className="mb-4">
        <Card>
          <CardTitle>Stock Count (นับสต็อก) — detail by line</CardTitle>
          <ReportTable
            cols={["Doc No.", "Date", "Zone", "Code", "Product", "Lot", "Location", "System", "Counted", "Variance"]}
            rows={data.count.rows.map((r) => [
              r.docNo,
              fmtDateBE(new Date(r.docDate)),
              r.pullZone,
              r.code,
              r.name,
              r.lotNo,
              r.locationCode,
              r.sysQty.toLocaleString(),
              r.countedQty.toLocaleString(),
              r.variance > 0 ? `+${r.variance.toLocaleString()}` : r.variance.toLocaleString(),
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
              {r.map((v, j) => (
                <td
                  key={j}
                  className={`py-2 pr-3 ${j === 0 ? "font-num font-semibold text-[#3a4658]" : ""}`}
                >
                  {v}
                </td>
              ))}
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

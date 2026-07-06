import { NextRequest } from "next/server";
import { getReportData } from "@/lib/views/reports";
import { toCsv, csvResponse } from "@/lib/calc/csv";
import { fmtDateBE, parseISO, todayBangkok } from "@/lib/calc/date";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "receiving";
  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  const today = todayBangkok();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 29);

  const range = {
    start: startParam ? parseISO(startParam) : defaultStart,
    end: endParam ? parseISO(endParam) : today,
  };

  const data = await getReportData(range);

  switch (type) {
    case "issuing": {
      const csv = toCsv(
        ["Doc No.", "Date", "Issued To", "Qty", "Lines"],
        data.issuing.rows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.issueTo, r.qty, r.lineCount])
      );
      return csvResponse("report-issuing.csv", csv);
    }
    case "loss": {
      const csv = toCsv(
        ["Doc No.", "Date", "Reason", "Code", "Product", "Lot", "Qty short", "Value"],
        data.loss.rows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.reason, r.code, r.name, r.lotNo, r.qty, Math.round(r.value)])
      );
      return csvResponse("report-loss.csv", csv);
    }
    case "production": {
      const csv = toCsv(
        ["Doc No.", "Date", "Produced", "Loss"],
        data.production.rows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.producedTotal, r.prodLoss])
      );
      return csvResponse("report-production.csv", csv);
    }
    case "production_loss": {
      const csv = toCsv(
        ["Doc No.", "Date", "Material Code", "Material", "Loss qty", "Unit", "Value"],
        data.production.bomLossRows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.materialCode, r.materialName, r.lossQty, r.unit, Math.round(r.value)])
      );
      return csvResponse("report-production-loss.csv", csv);
    }
    case "po": {
      const csv = toCsv(
        ["PO No.", "Vendor", "Date", "Status", "Ordered", "Received", "Received %"],
        data.po.rows.map((r) => [r.no, r.vendor, fmtDateBE(new Date(r.date)), r.status, r.ordered, r.received, Math.round(r.receivedPct)])
      );
      return csvResponse("report-po.csv", csv);
    }
    case "transfer": {
      const csv = toCsv(
        ["Doc No.", "Date", "Operator", "Qty", "Lines"],
        data.transfer.rows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.operator, r.qty, r.lineCount])
      );
      return csvResponse("report-transfer.csv", csv);
    }
    case "count": {
      const csv = toCsv(
        ["Doc No.", "Date", "Zone", "Lines"],
        data.count.rows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.pullZone, r.lineCount])
      );
      return csvResponse("report-count.csv", csv);
    }
    case "receiving":
    default: {
      const csv = toCsv(
        ["Doc No.", "Date", "Mode", "PO Ref.", "Qty", "Lines"],
        data.receiving.rows.map((r) => [r.docNo, fmtDateBE(new Date(r.docDate)), r.mode, r.poNo ?? "—", r.qty, r.lineCount])
      );
      return csvResponse("report-receiving.csv", csv);
    }
  }
}

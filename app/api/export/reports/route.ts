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
        ["SAP Material Master", "Material Description", "Date", "Qty", "Unit", "Lot", "Issued To", "Doc No."],
        data.issuing.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.docDate)), r.qty, r.unit, r.lotNo, r.issueTo, r.docNo])
      );
      return csvResponse("report-issuing.csv", csv);
    }
    case "loss": {
      const csv = toCsv(
        ["SAP Material Master", "Material Description", "Date", "Qty short", "Value", "Lot", "Location", "Reason", "Doc No."],
        data.loss.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.docDate)), r.qty, Math.round(r.value), r.lotNo, r.locationCode, r.reason, r.docNo])
      );
      return csvResponse("report-loss.csv", csv);
    }
    case "production": {
      const csv = toCsv(
        ["SAP Material Master", "Material Description", "Date", "Qty", "Unit", "Lot", "Location", "Doc loss", "Doc No."],
        data.production.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.docDate)), r.qty, r.unit, r.lotNo, r.locationCode, r.prodLoss, r.docNo])
      );
      return csvResponse("report-production.csv", csv);
    }
    case "production_loss": {
      const csv = toCsv(
        ["Material Code", "Material", "Date", "Loss qty", "Unit", "Value", "Doc No."],
        data.production.bomLossRows.map((r) => [r.materialCode, r.materialName, fmtDateBE(new Date(r.docDate)), r.lossQty, r.unit, Math.round(r.value), r.docNo])
      );
      return csvResponse("report-production-loss.csv", csv);
    }
    case "po": {
      const csv = toCsv(
        ["SAP Material Master", "Material Description", "Date", "Ordered", "Received", "Remaining", "Vendor", "Status", "PO No."],
        data.po.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.date)), r.ordered, r.received, r.remaining, r.vendor, r.status, r.no])
      );
      return csvResponse("report-po.csv", csv);
    }
    case "transfer": {
      const csv = toCsv(
        ["SAP Material Master", "Material Description", "Date", "Qty", "Unit", "Lot", "From", "To", "Operator", "Doc No."],
        data.transfer.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.docDate)), r.qty, r.unit, r.lotNo, r.fromLocationCode, r.toLocationCode, r.operator, r.docNo])
      );
      return csvResponse("report-transfer.csv", csv);
    }
    case "count": {
      const csv = toCsv(
        ["SAP Material Master", "Material Description", "Date", "System", "Counted", "Variance", "Lot", "Location", "Zone", "Doc No."],
        data.count.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.docDate)), r.sysQty, r.countedQty, r.variance, r.lotNo, r.locationCode, r.pullZone, r.docNo])
      );
      return csvResponse("report-count.csv", csv);
    }
    case "receiving":
    default: {
      const csv = toCsv(
        ["SAP Material Master", "Material Description", "Date", "Qty", "Unit", "Lot", "Location", "Mode", "PO Ref.", "Doc No."],
        data.receiving.rows.map((r) => [r.code, r.name, fmtDateBE(new Date(r.docDate)), r.qty, r.unit, r.lotNo, r.locationCode, r.mode, r.poNo ?? "—", r.docNo])
      );
      return csvResponse("report-receiving.csv", csv);
    }
  }
}

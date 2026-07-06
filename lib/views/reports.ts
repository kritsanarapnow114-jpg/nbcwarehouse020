import "server-only";
import { db } from "@/lib/db";
import { Range } from "./dashboard";
import { productLabel } from "@/lib/calc/productName";

export async function getReportData(range: Range) {
  const docDateInRange = { docDate: { gte: range.start, lte: range.end } };
  // Reversed documents are a wash — leave them out of the reports.
  const activeInRange = { ...docDateInRange, reversedAt: null };

  const [receipts, issues, adjustments, transfers, pos, counts] = await Promise.all([
    db.receipt.findMany({
      where: activeInRange,
      include: {
        po: true,
        lines: { include: { product: true } },
        bomLoss: { include: { bomLine: { include: { materialProduct: true } } } },
      },
      orderBy: { docDate: "desc" },
    }),
    db.issue.findMany({
      where: activeInRange,
      include: { lines: { include: { product: true, selectedLot: true } } },
      orderBy: { docDate: "desc" },
    }),
    db.adjustment.findMany({
      where: activeInRange,
      include: { lines: { include: { lot: { include: { product: true } } } } },
      orderBy: { docDate: "desc" },
    }),
    db.transfer.findMany({
      where: activeInRange,
      include: { lines: { include: { lot: { include: { product: true } } } } },
      orderBy: { docDate: "desc" },
    }),
    db.purchaseOrder.findMany({
      where: { date: { gte: range.start, lte: range.end } },
      include: { lines: { include: { product: true } } },
      orderBy: { date: "desc" },
    }),
    db.stockCount.findMany({
      where: activeInRange,
      include: { lines: { include: { lot: { include: { product: true } } } } },
      orderBy: { docDate: "desc" },
    }),
  ]);

  // Receiving — one row per product/lot line received
  const receivingRows = receipts.flatMap((r) =>
    r.lines.map((l) => ({
      docNo: r.docNo,
      docDate: r.docDate.toISOString(),
      mode: r.mode,
      poNo: r.po?.no ?? null,
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      qty: l.recvQty,
      unit: l.product.unit,
    }))
  );
  const receiving = {
    docCount: receipts.length,
    totalUnits: receivingRows.reduce((s, r) => s + r.qty, 0),
    rows: receivingRows,
  };

  // Issuing — one row per product/lot line issued
  const issuingRows = issues.flatMap((i) =>
    i.lines.map((l) => ({
      docNo: i.docNo,
      docDate: i.docDate.toISOString(),
      issueTo: i.issueTo,
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.selectedLot.lotNo,
      qty: l.qty,
      unit: l.product.unit,
    }))
  );
  const issuing = {
    docCount: issues.length,
    totalUnits: issuingRows.reduce((s, r) => s + r.qty, 0),
    rows: issuingRows,
  };

  // Loss — one row per negative-variance adjustment line, valued at product price
  const lossRows = adjustments.flatMap((a) =>
    a.lines
      .filter((l) => l.countedQty < l.sysQty)
      .map((l) => ({
        docNo: a.docNo,
        docDate: a.docDate.toISOString(),
        reason: a.reason,
        code: l.lot.productCode,
        name: productLabel(l.lot.product.nameEn, l.lot.product.nameTh),
        lotNo: l.lot.lotNo,
        locationCode: l.lot.locationCode,
        qty: l.sysQty - l.countedQty,
        value: (l.sysQty - l.countedQty) * l.lot.product.price,
      }))
  );
  const loss = {
    docCount: new Set(lossRows.map((l) => l.docNo)).size,
    totalQty: lossRows.reduce((s, l) => s + l.qty, 0),
    totalValue: lossRows.reduce((s, l) => s + l.value, 0),
    rows: lossRows,
  };

  // Production — one row per finished-good lot produced, plus per-material loss lines
  const productionReceipts = receipts.filter((r) => r.mode === "PRODUCTION");
  const productionRows = productionReceipts.flatMap((r) =>
    r.lines.map((l) => ({
      docNo: r.docNo,
      docDate: r.docDate.toISOString(),
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      qty: l.recvQty,
      unit: l.product.unit,
      prodLoss: r.prodLoss ?? 0,
    }))
  );
  const totalProduced = productionReceipts.reduce((s, r) => s + (r.producedTotal ?? 0), 0);
  const totalProdLoss = productionReceipts.reduce((s, r) => s + (r.prodLoss ?? 0), 0);
  const bomLossRows = productionReceipts.flatMap((r) =>
    r.bomLoss.map((bl) => ({
      docNo: r.docNo,
      docDate: r.docDate.toISOString(),
      materialCode: bl.bomLine.materialProductCode,
      materialName: productLabel(bl.bomLine.materialProduct.nameEn, bl.bomLine.materialProduct.nameTh),
      lossQty: bl.lossQty,
      unit: bl.bomLine.unit,
      value: bl.lossQty * bl.bomLine.materialProduct.price,
    }))
  );
  const production = {
    docCount: productionReceipts.length,
    totalProduced,
    totalProdLoss,
    yieldPct: totalProduced + totalProdLoss > 0 ? (totalProduced / (totalProduced + totalProdLoss)) * 100 : 100,
    bomLossValue: bomLossRows.reduce((s, r) => s + r.value, 0),
    rows: productionRows,
    bomLossRows,
  };

  // Purchase Orders — one row per ordered product line (by PO date within range)
  const poRows = pos.flatMap((p) =>
    p.lines.map((l) => ({
      no: p.no,
      vendor: p.vendor,
      date: p.date.toISOString(),
      status: p.status,
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      ordered: l.ordered,
      received: l.received,
      remaining: l.ordered - l.received,
    }))
  );
  const po = {
    docCount: pos.length,
    totalOrdered: poRows.reduce((s, r) => s + r.ordered, 0),
    totalReceived: poRows.reduce((s, r) => s + r.received, 0),
    rows: poRows,
  };

  // Transfers — one row per lot moved
  const transferRows = transfers.flatMap((t) =>
    t.lines.map((l) => ({
      docNo: t.docNo,
      docDate: t.docDate.toISOString(),
      operator: t.operator,
      code: l.lot.productCode,
      name: productLabel(l.lot.product.nameEn, l.lot.product.nameTh),
      lotNo: l.lot.lotNo,
      fromLocationCode: l.fromLocationCode,
      toLocationCode: l.toLocationCode,
      qty: l.qty,
      unit: l.lot.product.unit,
    }))
  );
  const transfer = {
    docCount: transfers.length,
    totalUnits: transferRows.reduce((s, r) => s + r.qty, 0),
    rows: transferRows,
  };

  // Stock counts — one row per counted lot, with variance
  const countRows = counts.flatMap((c) =>
    c.lines.map((l) => ({
      docNo: c.docNo,
      docDate: c.docDate.toISOString(),
      pullZone: c.pullZone,
      code: l.lot.productCode,
      name: productLabel(l.lot.product.nameEn, l.lot.product.nameTh),
      lotNo: l.lot.lotNo,
      locationCode: l.lot.locationCode,
      sysQty: l.sysQty,
      countedQty: l.countedQty,
      variance: l.countedQty - l.sysQty,
      unit: l.lot.product.unit,
    }))
  );
  const accurateLines = countRows.filter((r) => r.variance === 0).length;
  const count = {
    docCount: counts.length,
    lineCount: countRows.length,
    accuracyPct: countRows.length > 0 ? (accurateLines / countRows.length) * 100 : 100,
    rows: countRows,
  };

  return { receiving, issuing, loss, production, po, transfer, count };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

export async function getReportProductOptions() {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
  });
  return products.map((p) => ({ code: p.code, name: productLabel(p.nameEn, p.nameTh) }));
}

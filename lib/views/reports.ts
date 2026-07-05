import "server-only";
import { db } from "@/lib/db";
import { Range } from "./dashboard";

export async function getReportData(range: Range) {
  const docDateInRange = { docDate: { gte: range.start, lte: range.end } };

  const [receipts, issues, adjustments, transfers, pos, counts] = await Promise.all([
    db.receipt.findMany({
      where: docDateInRange,
      include: {
        po: true,
        lines: { include: { product: true } },
        bomLoss: { include: { bomLine: { include: { materialProduct: true } } } },
      },
      orderBy: { docDate: "desc" },
    }),
    db.issue.findMany({
      where: docDateInRange,
      include: { lines: { include: { product: true } } },
      orderBy: { docDate: "desc" },
    }),
    db.adjustment.findMany({
      where: docDateInRange,
      include: { lines: { include: { lot: { include: { product: true } } } } },
      orderBy: { docDate: "desc" },
    }),
    db.transfer.findMany({
      where: docDateInRange,
      include: { lines: { include: { lot: { include: { product: true } } } } },
      orderBy: { docDate: "desc" },
    }),
    db.purchaseOrder.findMany({
      where: { date: { gte: range.start, lte: range.end } },
      include: { lines: { include: { product: true } } },
      orderBy: { date: "desc" },
    }),
    db.stockCount.findMany({
      where: docDateInRange,
      include: { lines: { include: { lot: { include: { product: true } } } } },
      orderBy: { docDate: "desc" },
    }),
  ]);

  // Receiving
  const receiving = {
    docCount: receipts.length,
    totalUnits: receipts.reduce((s, r) => s + r.lines.reduce((ls, l) => ls + l.recvQty, 0), 0),
    rows: receipts.map((r) => ({
      id: r.id,
      docNo: r.docNo,
      docDate: r.docDate.toISOString(),
      mode: r.mode,
      poNo: r.po?.no ?? null,
      qty: r.lines.reduce((s, l) => s + l.recvQty, 0),
      lineCount: r.lines.length,
    })),
  };

  // Issuing
  const issuing = {
    docCount: issues.length,
    totalUnits: issues.reduce((s, i) => s + i.lines.reduce((ls, l) => ls + l.qty, 0), 0),
    rows: issues.map((i) => ({
      id: i.id,
      docNo: i.docNo,
      docDate: i.docDate.toISOString(),
      issueTo: i.issueTo,
      qty: i.lines.reduce((s, l) => s + l.qty, 0),
      lineCount: i.lines.length,
    })),
  };

  // Loss — negative-variance adjustment lines, valued at product price
  const adjLossLines = adjustments.flatMap((a) =>
    a.lines
      .filter((l) => l.countedQty < l.sysQty)
      .map((l) => ({
        docNo: a.docNo,
        docDate: a.docDate.toISOString(),
        reason: a.reason,
        code: l.lot.productCode,
        name: `${l.lot.product.nameEn} (${l.lot.product.nameTh})`,
        lotNo: l.lot.lotNo,
        qty: l.sysQty - l.countedQty,
        value: (l.sysQty - l.countedQty) * l.lot.product.price,
      }))
  );
  const loss = {
    docCount: new Set(adjLossLines.map((l) => l.docNo)).size,
    totalQty: adjLossLines.reduce((s, l) => s + l.qty, 0),
    totalValue: adjLossLines.reduce((s, l) => s + l.value, 0),
    rows: adjLossLines,
  };

  // Production & production loss — Receipt rows with mode = PRODUCTION
  const productionReceipts = receipts.filter((r) => r.mode === "PRODUCTION");
  const totalProduced = productionReceipts.reduce((s, r) => s + (r.producedTotal ?? 0), 0);
  const totalProdLoss = productionReceipts.reduce((s, r) => s + (r.prodLoss ?? 0), 0);
  const bomLossRows = productionReceipts.flatMap((r) =>
    r.bomLoss.map((bl) => ({
      docNo: r.docNo,
      docDate: r.docDate.toISOString(),
      materialCode: bl.bomLine.materialProductCode,
      materialName: `${bl.bomLine.materialProduct.nameEn} (${bl.bomLine.materialProduct.nameTh})`,
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
    rows: productionReceipts.map((r) => ({
      id: r.id,
      docNo: r.docNo,
      docDate: r.docDate.toISOString(),
      producedTotal: r.producedTotal ?? 0,
      prodLoss: r.prodLoss ?? 0,
    })),
    bomLossRows,
  };

  // Purchase Orders (by order date within range)
  const po = {
    docCount: pos.length,
    totalOrdered: pos.reduce((s, p) => s + p.lines.reduce((ls, l) => ls + l.ordered, 0), 0),
    totalReceived: pos.reduce((s, p) => s + p.lines.reduce((ls, l) => ls + l.received, 0), 0),
    rows: pos.map((p) => {
      const ordered = p.lines.reduce((s, l) => s + l.ordered, 0);
      const received = p.lines.reduce((s, l) => s + l.received, 0);
      return {
        id: p.id,
        no: p.no,
        vendor: p.vendor,
        date: p.date.toISOString(),
        status: p.status,
        ordered,
        received,
        receivedPct: ordered > 0 ? (received / ordered) * 100 : 0,
      };
    }),
  };

  // Transfers
  const transfer = {
    docCount: transfers.length,
    totalUnits: transfers.reduce((s, t) => s + t.lines.reduce((ls, l) => ls + l.qty, 0), 0),
    rows: transfers.map((t) => ({
      id: t.id,
      docNo: t.docNo,
      docDate: t.docDate.toISOString(),
      operator: t.operator,
      qty: t.lines.reduce((s, l) => s + l.qty, 0),
      lineCount: t.lines.length,
    })),
  };

  // Stock counts / accuracy
  const countLines = counts.flatMap((c) => c.lines);
  const accuratelines = countLines.filter((l) => l.countedQty === l.sysQty).length;
  const count = {
    docCount: counts.length,
    lineCount: countLines.length,
    accuracyPct: countLines.length > 0 ? (accuratelines / countLines.length) * 100 : 100,
    rows: counts.map((c) => ({
      id: c.id,
      docNo: c.docNo,
      docDate: c.docDate.toISOString(),
      pullZone: c.pullZone,
      lineCount: c.lines.length,
    })),
  };

  return { receiving, issuing, loss, production, po, transfer, count };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

export async function getReportProductOptions() {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
  });
  return products.map((p) => ({ code: p.code, name: `${p.nameEn} (${p.nameTh})` }));
}

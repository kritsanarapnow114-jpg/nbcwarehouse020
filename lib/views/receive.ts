import "server-only";
import { db } from "@/lib/db";
import { peekNextDocNumber } from "@/lib/calc/docNumber";

export async function getReceiveFormData() {
  const [products, pos, locations, lots, bomsRaw, docNo] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
    }),
    db.purchaseOrder.findMany({
      where: { status: { not: "COMPLETE" } },
      include: { lines: { include: { product: true } } },
      orderBy: { no: "asc" },
    }),
    db.location.findMany({ orderBy: { code: "asc" } }),
    db.lot.findMany({ select: { lotNo: true }, distinct: ["lotNo"] }),
    db.bom.findMany({ include: { lines: { include: { materialProduct: true } } } }),
    peekNextDocNumber("RC"),
  ]);

  return {
    docNo,
    products: products.map((p) => ({
      code: p.code,
      name: `${p.nameEn} (${p.nameTh})`,
      unit: p.unit,
      price: p.price,
    })),
    pos: pos.map((po) => ({
      id: po.id,
      no: po.no,
      vendor: po.vendor,
      lines: po.lines.map((l) => ({
        productCode: l.productCode,
        name: `${l.product.nameEn} (${l.product.nameTh})`,
        unit: l.product.unit,
        ordered: l.ordered,
        received: l.received,
        remaining: Math.max(0, l.ordered - l.received),
      })),
    })),
    locations: locations.map((l) => l.code),
    lotOptions: lots.map((l) => l.lotNo).filter((l) => l !== "-"),
    boms: bomsRaw.map((b) => ({
      finishedProductCode: b.finishedProductCode,
      lines: b.lines.map((l) => ({
        id: l.id,
        materialCode: l.materialProductCode,
        materialName: `${l.materialProduct.nameEn} (${l.materialProduct.nameTh})`,
        qtyPerUnit: l.qtyPerUnit,
        unit: l.unit,
        materialPrice: l.materialProduct.price,
      })),
    })),
  };
}

export type ReceiveFormData = Awaited<ReturnType<typeof getReceiveFormData>>;

export async function getRecentReceipts(limit = 20) {
  const receipts = await db.receipt.findMany({
    include: {
      po: true,
      lines: { include: { product: true } },
    },
    orderBy: { docDate: "desc" },
    take: limit,
  });

  return receipts.map((r) => ({
    id: r.id,
    docNo: r.docNo,
    mode: r.mode,
    poNo: r.po?.no ?? null,
    invoiceNo: r.invoiceNo,
    docDate: r.docDate.toISOString(),
    lineCount: r.lines.length,
    totalQty: r.lines.reduce((s, l) => s + l.recvQty, 0),
    lines: r.lines.map((l) => ({
      code: l.productCode,
      name: `${l.product.nameEn} (${l.product.nameTh})`,
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      recvQty: l.recvQty,
      unit: l.product.unit,
    })),
  }));
}

export type ReceiptHistoryRow = Awaited<ReturnType<typeof getRecentReceipts>>[number];

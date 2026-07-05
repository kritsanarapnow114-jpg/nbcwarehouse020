import "server-only";
import { db } from "@/lib/db";

export type PoLineRow = {
  id: string;
  productCode: string;
  productName: string;
  ordered: number;
  received: number;
  remaining: number;
};

export type PoRow = {
  id: string;
  no: string;
  vendor: string;
  date: string;
  status: "OPEN" | "PENDING" | "COMPLETE";
  amount: number;
  receivedPct: number;
  lines: PoLineRow[];
};

export async function getProductPickerList() {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
  });
  return products.map((p) => ({
    code: p.code,
    name: `${p.nameEn} (${p.nameTh})`,
    unit: p.unit,
    price: p.price,
  }));
}

export async function getPurchaseOrders(opts?: {
  status?: string;
}): Promise<PoRow[]> {
  const pos = await db.purchaseOrder.findMany({
    where: opts?.status ? { status: opts.status as never } : {},
    include: { lines: { include: { product: true } } },
    orderBy: { date: "desc" },
  });

  return pos.map((po) => {
    const orderedTotal = po.lines.reduce((s, l) => s + l.ordered, 0);
    const receivedTotal = po.lines.reduce((s, l) => s + l.received, 0);
    const amount = po.lines.reduce(
      (s, l) => s + l.ordered * l.product.price,
      0
    );
    const receivedPct =
      orderedTotal > 0 ? (receivedTotal / orderedTotal) * 100 : 0;

    return {
      id: po.id,
      no: po.no,
      vendor: po.vendor,
      date: po.date.toISOString(),
      status: po.status,
      amount,
      receivedPct,
      lines: po.lines.map((l) => ({
        id: l.id,
        productCode: l.productCode,
        productName: l.product.nameEn,
        ordered: l.ordered,
        received: l.received,
        remaining: l.ordered - l.received,
      })),
    };
  });
}

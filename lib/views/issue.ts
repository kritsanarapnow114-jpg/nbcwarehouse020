import "server-only";
import { db } from "@/lib/db";
import { eligibleLots, fefoLotFor } from "@/lib/calc/fefo";
import { peekNextDocNumber } from "@/lib/calc/docNumber";
import { productLabel } from "@/lib/calc/productName";

export async function getIssueFormData() {
  const [products, docNo] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null },
      include: { lots: true },
      orderBy: { code: "asc" },
    }),
    peekNextDocNumber("ISS"),
  ]);

  const items = products
    .map((p) => {
      const eligible = eligibleLots(
        p.lots.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          qty: l.qty,
          status: l.status,
          expDate: l.expDate,
          locationCode: l.locationCode,
        }))
      );
      const fefo = fefoLotFor(
        p.lots.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          qty: l.qty,
          status: l.status,
          expDate: l.expDate,
          locationCode: l.locationCode,
        }))
      );
      return {
        code: p.code,
        name: productLabel(p.nameEn, p.nameTh),
        unit: p.unit,
        price: p.price,
        fefoLotId: fefo?.id ?? null,
        lots: eligible.map((l) => ({
          id: l.id,
          lotNo: l.lotNo,
          locationCode: l.locationCode,
          qty: l.qty,
          expDate: l.expDate ? l.expDate.toISOString() : null,
          isFefo: l.id === fefo?.id,
        })),
      };
    })
    .filter((p) => p.lots.length > 0);

  return { docNo, products: items };
}

export type IssueFormData = Awaited<ReturnType<typeof getIssueFormData>>;

export async function getRecentIssues(limit = 400) {
  const issues = await db.issue.findMany({
    include: {
      lines: { include: { product: true, selectedLot: true } },
    },
    orderBy: { docDate: "desc" },
    take: limit,
  });

  return issues.map((i) => ({
    id: i.id,
    docNo: i.docNo,
    issueTo: i.issueTo,
    docDate: i.docDate.toISOString(),
    reversedAt: i.reversedAt ? i.reversedAt.toISOString() : null,
    lineCount: i.lines.length,
    totalQty: i.lines.reduce((s, l) => s + l.qty, 0),
    lines: i.lines.map((l) => ({
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.selectedLot.lotNo,
      locationCode: l.selectedLot.locationCode,
      qty: l.qty,
      unit: l.product.unit,
    })),
  }));
}

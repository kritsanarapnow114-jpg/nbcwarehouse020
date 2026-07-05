import "server-only";
import { db } from "@/lib/db";
import { eligibleLots, fefoLotFor } from "@/lib/calc/fefo";
import { peekNextDocNumber } from "@/lib/calc/docNumber";

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
        name: `${p.nameEn} (${p.nameTh})`,
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

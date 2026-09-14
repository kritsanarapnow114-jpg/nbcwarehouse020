import "server-only";
import { db } from "@/lib/db";
import { peekNextDocNumber } from "@/lib/calc/docNumber";
import { productLabel } from "@/lib/calc/productName";
import { fmtDateISO } from "@/lib/calc/date";
import { getAppSetting } from "@/lib/views/settings";
import {
  BOM_SOURCE_KEY,
  PROD_LINES_KEY,
  PROD_SHIFTS_KEY,
  PROD_SHIFTS_DEFAULTS,
  OEE_STANDARDS_KEY,
  OEE_SHIFT_TIME_KEY,
  OEE_DOWNTIME_REASONS_KEY,
  parseList,
  parseOeeStandards,
  parseShiftTime,
  parseDowntimeReasons,
} from "@/lib/settingsKeys";

export async function getReceiveFormData() {
  const [products, pos, locations, lots, bomsRaw, docNo, suAgg] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
    }),
    db.purchaseOrder.findMany({
      where: { status: { not: "COMPLETE" } },
      include: { lines: { include: { product: true } } },
      orderBy: { no: "asc" },
    }),
    db.location.findMany({ where: { archivedAt: null }, orderBy: { code: "asc" } }),
    db.lot.findMany({ select: { lotNo: true }, distinct: ["lotNo"] }),
    db.bom.findMany({ include: { lines: { include: { materialProduct: true } } } }),
    peekNextDocNumber("RC"),
    db.receiptLine.aggregate({ _max: { suNo: true } }),
  ]);
  const nextSuNo = (suAgg._max.suNo ?? 0) + 1;

  // FIFO-ordered eligible lots for each BOM material, so the production screen
  // can preview which lots will be deducted.
  const materialCodes = [
    ...new Set(bomsRaw.flatMap((b) => b.lines.map((l) => l.materialProductCode))),
  ];
  // If a BOM source location is configured (e.g. the packing line), only those
  // bins' stock is eligible to be consumed by production.
  const [bomSourceRaw, prodLinesRaw, prodShiftsRaw, oeeStdRaw, shiftTimeRaw, downtimeReasonsRaw] = await Promise.all([
    getAppSetting(BOM_SOURCE_KEY),
    getAppSetting(PROD_LINES_KEY),
    getAppSetting(PROD_SHIFTS_KEY),
    getAppSetting(OEE_STANDARDS_KEY),
    getAppSetting(OEE_SHIFT_TIME_KEY),
    getAppSetting(OEE_DOWNTIME_REASONS_KEY),
  ]);
  const bomSource = parseList(bomSourceRaw);
  const prodLines = parseList(prodLinesRaw);
  // Shifts fall back to the built-in default set when none configured yet.
  const prodShifts = prodShiftsRaw != null && parseList(prodShiftsRaw).length > 0 ? parseList(prodShiftsRaw) : PROD_SHIFTS_DEFAULTS;
  const oeeStandards = parseOeeStandards(oeeStdRaw);
  const shiftTime = parseShiftTime(shiftTimeRaw); // fixed plan/break per shift
  const downtimeReasons = parseDowntimeReasons(downtimeReasonsRaw);
  const materialLots = await db.lot.findMany({
    where: {
      productCode: { in: materialCodes },
      status: "OK",
      qty: { gt: 0 },
      ...(bomSource.length > 0 ? { locationCode: { in: bomSource } } : {}),
    },
    orderBy: [{ recvDate: "asc" }, { lotNo: "asc" }],
  });
  const lotsByCode = new Map<string, { lotNo: string; qty: number; locationCode: string }[]>();
  for (const l of materialLots) {
    const arr = lotsByCode.get(l.productCode) ?? [];
    arr.push({ lotNo: l.lotNo, qty: l.qty, locationCode: l.locationCode });
    lotsByCode.set(l.productCode, arr);
  }

  // Lots that already carry a Mfg and/or Expiry, newest first — so re-receiving a
  // known lot can auto-fill its production/expiry dates. Keyed both by
  // `product||lot` (exact match) and by `lot` alone (fallback across products);
  // newest wins because we iterate newest→oldest and only fill an empty key.
  const datedLots = await db.lot.findMany({
    where: { lotNo: { not: "-" }, OR: [{ mfgDate: { not: null } }, { expDate: { not: null } }] },
    select: { productCode: true, lotNo: true, mfgDate: true, expDate: true },
    orderBy: { recvDate: "desc" },
  });
  const lotMeta: Record<string, { mfg: string | null; exp: string | null }> = {};
  for (const l of datedLots) {
    const meta = {
      mfg: l.mfgDate ? fmtDateISO(l.mfgDate) : null,
      exp: l.expDate ? fmtDateISO(l.expDate) : null,
    };
    const exact = `${l.productCode}||${l.lotNo}`;
    if (!(exact in lotMeta)) lotMeta[exact] = meta;
    if (!(l.lotNo in lotMeta)) lotMeta[l.lotNo] = meta;
  }

  return {
    docNo,
    nextSuNo,
    products: products.map((p) => ({
      code: p.code,
      name: productLabel(p.nameEn, p.nameTh),
      unit: p.unit,
      price: p.price,
      pallet: p.pallet, // standard pallet size — a Full pallet is received as this
      category: p.category,
    })),
    pos: pos.map((po) => ({
      id: po.id,
      no: po.no,
      vendor: po.vendor,
      lines: po.lines.map((l) => ({
        productCode: l.productCode,
        name: productLabel(l.product.nameEn, l.product.nameTh),
        unit: l.product.unit,
        ordered: l.ordered,
        received: l.received,
        remaining: Math.max(0, l.ordered - l.received),
      })),
    })),
    locations: locations.map((l) => l.code),
    lotOptions: lots.map((l) => l.lotNo).filter((l) => l !== "-"),
    lotMeta,
    prodLines,
    prodShifts,
    shiftPlanMin: shiftTime.planMin,
    shiftBreakMin: shiftTime.breakMin,
    oeeStandards,
    downtimeReasons,
    boms: bomsRaw.map((b) => ({
      finishedProductCode: b.finishedProductCode,
      lines: b.lines.map((l) => ({
        id: l.id,
        materialCode: l.materialProductCode,
        materialName: productLabel(l.materialProduct.nameEn, l.materialProduct.nameTh),
        qtyPerUnit: l.qtyPerUnit,
        perQty: l.perQty,
        unit: l.unit,
        materialPrice: l.materialProduct.price,
        lots: lotsByCode.get(l.materialProductCode) ?? [],
      })),
    })),
  };
}

export type ReceiveFormData = Awaited<ReturnType<typeof getReceiveFormData>>;

export async function getRecentReceipts(limit = 400) {
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
    materialDoc: r.materialDoc ?? "",
    shift: r.shift ?? "",
    remark: r.remark ?? "",
    stockType: r.stockType,
    docDate: r.docDate.toISOString(),
    reversedAt: r.reversedAt ? r.reversedAt.toISOString() : null,
    pending: r.mode === "PRODUCTION" && !r.verifiedAt,
    lineCount: r.lines.length,
    totalQty: r.lines.reduce((s, l) => s + l.recvQty, 0),
    lines: r.lines.map((l) => ({
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      recvQty: l.recvQty,
      suNo: l.suNo,
      weightKg: l.weightKg,
      palletFull: l.palletFull,
      packTime: l.packTime,
      unit: l.product.unit,
    })),
  }));
}

export type ReceiptHistoryRow = Awaited<ReturnType<typeof getRecentReceipts>>[number];

/**
 * How many pallets/boxes were received Full vs Partial (not a full pallet),
 * across all non-reversed receipts. `palletFull === false` marks a partial
 * pallet/box; legacy rows with no flag (null) are counted as unknown and left
 * out of the Full/Partial split. `items` lists each partial pallet so the UI
 * can drill down to exactly which lots are partial (newest first).
 */
export async function getPalletFillSummary() {
  const base = { receipt: { reversedAt: null } };
  const [partial, full, partialLines] = await Promise.all([
    db.receiptLine.count({ where: { ...base, palletFull: false } }),
    db.receiptLine.count({ where: { ...base, palletFull: true } }),
    db.receiptLine.findMany({
      where: { ...base, palletFull: false },
      include: {
        product: true,
        receipt: { select: { docNo: true, docDate: true, mode: true } },
      },
      orderBy: { receipt: { docDate: "desc" } },
      take: 500,
    }),
  ]);
  // Merge partial pallets of the SAME product + lot + location into one row:
  // sum the qty, count how many partial pallets it is, keep the latest date and
  // every document it came from.
  type Group = {
    key: string;
    code: string;
    name: string;
    lotNo: string;
    locationCode: string;
    unit: string;
    qty: number;
    weightKg: number;
    pallets: number;
    docDate: string;
    _dateMs: number;
    docNos: Set<string>;
    hasProduction: boolean;
  };
  const groups = new Map<string, Group>();
  for (const l of partialLines) {
    const key = `${l.productCode}||${l.lotNo}||${l.locationCode}`;
    const ms = l.receipt.docDate.getTime();
    const g = groups.get(key);
    if (g) {
      g.qty += l.recvQty;
      g.weightKg += l.weightKg ?? 0;
      g.pallets += 1;
      g.docNos.add(l.receipt.docNo);
      if (l.receipt.mode === "PRODUCTION") g.hasProduction = true;
      if (ms > g._dateMs) {
        g._dateMs = ms;
        g.docDate = l.receipt.docDate.toISOString();
      }
    } else {
      groups.set(key, {
        key,
        code: l.productCode,
        name: productLabel(l.product.nameEn, l.product.nameTh),
        lotNo: l.lotNo,
        locationCode: l.locationCode,
        unit: l.product.unit,
        qty: l.recvQty,
        weightKg: l.weightKg ?? 0,
        pallets: 1,
        docDate: l.receipt.docDate.toISOString(),
        _dateMs: ms,
        docNos: new Set([l.receipt.docNo]),
        hasProduction: l.receipt.mode === "PRODUCTION",
      });
    }
  }
  const items = [...groups.values()]
    .sort((a, b) => b._dateMs - a._dateMs)
    .map((g) => ({
      code: g.code,
      name: g.name,
      lotNo: g.lotNo,
      locationCode: g.locationCode,
      unit: g.unit,
      qty: Math.round(g.qty * 1000) / 1000,
      weightKg: Math.round(g.weightKg * 100) / 100,
      pallets: g.pallets,
      docDate: g.docDate,
      docNo: [...g.docNos][0],
      docCount: g.docNos.size,
      hasProduction: g.hasProduction,
    }));
  return { partial, full, items };
}

export type PartialPalletItem = Awaited<ReturnType<typeof getPalletFillSummary>>["items"][number];

/** Production receipts awaiting warehouse verification (finished goods not in stock yet). */
export async function getPendingReceipts() {
  const receipts = await db.receipt.findMany({
    where: { mode: "PRODUCTION", verifiedAt: null, reversedAt: null },
    include: { lines: { include: { product: true } } },
    orderBy: { docDate: "desc" },
  });
  return receipts.map((r) => ({
    id: r.id,
    docNo: r.docNo,
    docDate: r.docDate.toISOString(),
    remark: r.remark ?? "",
    totalQty: r.lines.reduce((s, l) => s + l.recvQty, 0),
    totalWeight: r.lines.reduce((s, l) => s + (l.weightKg ?? 0), 0),
    lines: r.lines.map((l) => ({
      suNo: l.suNo,
      code: l.productCode,
      name: productLabel(l.product.nameEn, l.product.nameTh),
      lotNo: l.lotNo,
      locationCode: l.locationCode,
      recvQty: l.recvQty,
      weightKg: l.weightKg,
      palletFull: l.palletFull,
      packTime: l.packTime,
      unit: l.product.unit,
    })),
  }));
}

export type PendingReceipt = Awaited<ReturnType<typeof getPendingReceipts>>[number];

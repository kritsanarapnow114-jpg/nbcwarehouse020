// Client-safe types for the packaging plan (no server-only / DB imports).

/** One packaging item used by a packaging "type", per produced unit. */
export type PkgTypeLine = { code: string; qtyPerUnit: number };

/** A named packaging recipe the user defines (e.g. "Box set" vs "Bag set"). */
export type PackagingType = { id: string; name: string; lines: PkgTypeLine[] };

/** One dated production entry: produce `qty` units on `date`, packed with
 *  packaging type `pkgTypeId` (Box / Supersack / …). */
export type ScheduleRow = {
  id: string;
  date: string; // yyyy-mm-dd
  qty: number;
  pkgTypeId: string;
};

/** A planned incoming delivery ("เรียกเข้า"): `qty` of material `code` arrives
 *  at the warehouse on `date`. */
export type IncomingRow = {
  id: string;
  date: string; // yyyy-mm-dd
  code: string;
  qty: number;
};

export const PKG_TYPES_KEY = "packagingTypes";
export const SCHEDULE_KEY = "productionSchedule";
export const INCOMING_KEY = "incomingSchedule";

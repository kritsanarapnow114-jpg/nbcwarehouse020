// Client-safe types for the packaging plan (no server-only / DB imports).

/** One packaging item used by a packaging "type", per produced unit. */
export type PkgTypeLine = { code: string; qtyPerUnit: number };

/** A named packaging recipe the user defines (e.g. "Box set" vs "Bag set"). */
export type PackagingType = { id: string; name: string; lines: PkgTypeLine[] };

/** One dated production entry: produce `qty` of `fgCode` on `date`, packed with
 *  packaging type `pkgTypeId`. */
export type ScheduleRow = {
  id: string;
  date: string; // yyyy-mm-dd
  fgCode: string;
  qty: number;
  pkgTypeId: string;
};

export const PKG_TYPES_KEY = "packagingTypes";
export const SCHEDULE_KEY = "productionSchedule";

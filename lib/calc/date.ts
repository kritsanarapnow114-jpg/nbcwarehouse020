const BE_OFFSET = 543;
const BANGKOK_OFFSET_MS = 7 * 3600 * 1000;

/**
 * "Today" as a UTC-midnight Date matching the Bangkok (UTC+7) calendar day.
 * Server `new Date()` returns UTC time, but docDate values are stored as
 * UTC-midnight of the date string entered in the (Thai) browser — so
 * comparing against a raw `new Date()` skews the boundary during
 * 00:00–06:59 ICT, when the UTC calendar day is still "yesterday".
 */
export function todayBangkok(): Date {
  const shifted = new Date(Date.now() + BANGKOK_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function beYear(d: Date): number {
  return d.getFullYear() + BE_OFFSET;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Display date as dd/mm/yyyy in the Christian era (ค.ศ.), e.g. 05/07/2026.
 *  (Name kept for its many call sites; document numbers still use beYear.) */
export function fmtDateBE(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** yyyy-mm-dd for <input type="date"> */
export function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(
    earlier.getFullYear(),
    earlier.getMonth(),
    earlier.getDate()
  );
  return Math.floor((a - b) / 86400000);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function parseISO(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

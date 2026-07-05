const BE_OFFSET = 543;

export function beYear(d: Date): number {
  return d.getFullYear() + BE_OFFSET;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** dd/mm/BEyyyy, e.g. 05/07/2569 */
export function fmtDateBE(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${beYear(d)}`;
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

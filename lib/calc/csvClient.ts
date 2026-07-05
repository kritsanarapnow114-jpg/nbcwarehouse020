"use client";

import { toCsv } from "./csv";

/** Client-side CSV download for data that only exists in-browser (e.g. an unconfirmed doc draft). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = toCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

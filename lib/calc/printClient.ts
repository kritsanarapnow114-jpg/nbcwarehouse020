"use client";

function esc(v: string | number): string {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Open a print window with a clean, full-width table that uses the Aptos Narrow
 * font and prints landscape so it fills the paper.
 */
export function printTable(opts: {
  title: string;
  meta?: string[];
  headers: string[];
  rows: (string | number)[][];
  signatures?: string[];
  /** Page orientation. Default "landscape" (fills wide exports); use "portrait"
   *  for long narrow lists like the count sheet so more rows fit per page. */
  orientation?: "landscape" | "portrait";
  /** Compact = smaller fonts + tighter rows → many more rows per printed page. */
  compact?: boolean;
}) {
  const w = window.open("", "_blank", "width=1000,height=900");
  if (!w) return;
  const orientation = opts.orientation ?? "landscape";
  const compact = opts.compact ?? false;
  const meta = (opts.meta ?? []).map((m) => esc(m)).join(" &nbsp;·&nbsp; ");
  const head = opts.headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = opts.rows.length
    ? opts.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${opts.headers.length}">—</td></tr>`;
  const thPad = compact ? "3px 6px" : "7px 9px";
  const tdPad = compact ? "2px 6px" : "6px 9px";
  const fs = compact ? "10.5px" : "12.5px";
  const margin = compact ? "8mm" : "12mm";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${esc(opts.title)}</title>
<style>
  @page { size: ${orientation}; margin: ${margin}; }
  * { box-sizing: border-box; }
  body { font-family:'Aptos Narrow',Arial,sans-serif; color:#16202e; margin:0; padding:${compact ? "10px 12px" : "18px 22px"}; }
  h2 { margin:0 0 4px; font-size:${compact ? "16px" : "20px"}; }
  .sub { color:#5a6675; font-size:${compact ? "11px" : "12.5px"}; margin-bottom:${compact ? "8px" : "14px"}; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; } /* repeat the header on every printed page */
  tr { page-break-inside:avoid; }
  th { background:#12557e; color:#fff; border:1px solid #9fb0c3; padding:${thPad}; text-align:left; font-size:${fs}; }
  td { border:1px solid #d0d7de; padding:${tdPad}; font-size:${fs}; }
  tr:nth-child(even) td { background:#eef4f8; }
  tfoot { color:#8a97a5; font-size:11px; }
  .sig { margin-top:${compact ? "28px" : "56px"}; display:flex; justify-content:space-around; gap:40px; }
  .sig div { flex:1; max-width:38%; border-top:1px solid #333; padding-top:6px; text-align:center; font-size:12px; }
</style></head><body>
<h2>${esc(opts.title)}</h2>
${meta ? `<div class="sub">${meta}</div>` : ""}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${opts.signatures && opts.signatures.length ? `<div class="sig">${opts.signatures.map((s) => `<div>${esc(s)}</div>`).join("")}</div>` : ""}
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

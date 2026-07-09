"use client";

import { FLS_LOGO, NATUREWORKS_LOGO } from "./countSheetLogos";

function esc(v: string | number): string {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Print the customer's "WEEKLY CYCLE COUNT" form: FLS + NatureWorks logos, a
 * titled header block (repeated on every page), a compact portrait table with
 * blank Count + Remark columns to fill in by hand, and a signature footer.
 */
export function printCountSheet(opts: {
  meta?: string[];
  showSys?: boolean;
  /** rows: [sapCode, description, lot, location, sysQtyText] */
  rows: [string, string, string, string, string][];
}) {
  const w = window.open("", "_blank", "width=1000,height=900");
  if (!w) return;
  const showSys = opts.showSys ?? false;
  const meta = (opts.meta ?? []).map((m) => esc(m)).join(" &nbsp;·&nbsp; ");
  const headCells = [
    "No.",
    "SAP Material Master",
    "Material Description",
    "Lot",
    "Location",
    ...(showSys ? ["System"] : []),
    "Count (นับจริง)",
    "Remark",
  ];
  const head = headCells.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = opts.rows.length
    ? opts.rows
        .map((r, i) => {
          const cells = [
            String(i + 1),
            r[0],
            r[1],
            r[2],
            r[3],
            ...(showSys ? [r[4]] : []),
            "", // Count — blank to write
            "", // Remark — blank to write
          ];
          return `<tr>${cells
            .map((c, ci) => `<td class="${ci >= cells.length - 2 ? "write" : ""}">${esc(c)}</td>`)
            .join("")}</tr>`;
        })
        .join("")
    : `<tr><td colspan="${headCells.length}">—</td></tr>`;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>WEEKLY CYCLE COUNT</title>
<style>
  @page { size: portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family:'Aptos Narrow',Arial,sans-serif; color:#16202e; margin:0; padding:0; }
  .hdr { display:flex; align-items:center; gap:14px; border-bottom:2px solid #16202e; padding-bottom:6px; margin-bottom:6px; }
  .hdr img { height:42px; width:auto; }
  .hdr .nw { height:38px; }
  .hdr .ttl { flex:1; text-align:center; }
  .hdr .ttl h1 { margin:0; font-size:19px; letter-spacing:1px; }
  .hdr .ttl .m { color:#5a6675; font-size:10.5px; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  tr { page-break-inside:avoid; }
  th { background:#12557e; color:#fff; border:1px solid #9fb0c3; padding:3px 5px; text-align:left; font-size:10px; }
  td { border:1px solid #b9c2cd; padding:2px 5px; font-size:10px; }
  td.write { min-width:70px; }
  tbody tr { height:19px; }
  tbody tr:nth-child(even) td { background:#f2f6f9; }
  .sig { margin-top:22px; display:flex; justify-content:space-around; gap:30px; page-break-inside:avoid; }
  .sig div { flex:1; max-width:30%; border-top:1px solid #333; padding-top:5px; text-align:center; font-size:10.5px; color:#3a4658; }
</style></head><body>
<div class="hdr">
  <img src="${FLS_LOGO}" alt="FLS"/>
  <div class="ttl"><h1>WEEKLY CYCLE COUNT</h1>${meta ? `<div class="m">${meta}</div>` : ""}</div>
  <img class="nw" src="${NATUREWORKS_LOGO}" alt="NatureWorks"/>
</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="sig"><div>Counted by (ผู้นับ)</div><div>Checked by (ผู้ตรวจ)</div><div>Approved by (ผู้อนุมัติ)</div></div>
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
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

"use client";

import { useState } from "react";
import type PptxGenJSLib from "pptxgenjs";

export type OeeDowntimeEvent = {
  minutes: number;
  reason: string;
  detail: string;
};

// Per-round (per Pack Order run) OEE row, as computed by getOeeDashboard.
export type OeeRunRow = {
  doc: string;
  matDoc: string;
  day: string; // yyyy-mm-dd
  line: string;
  a: number;
  p: number;
  q: number;
  oee: number;
  produced: number;
  loss: number;
  pkgLoss: number;
  output: number;
  plannedMin: number;
  breakMin: number;
  runMin: number;
  standard: number;
  downtimeMin: number;
  downtimeEvents: OeeDowntimeEvent[];
};

export type OeeDeckSummary = {
  a: number;
  p: number;
  q: number;
  oee: number;
  produced: number;
  loss: number;
  output: number;
  pkgLoss: number;
  scoredRuns: number;
  docs: number;
};

export type OeeLineRow = { name: string; oee: number; a: number; p: number; q: number; output: number; standard: number };
export type OeeLossRow = { loss: string; freq: number; lostMin: number };
export type PkgRow = { name: string; qty: number };

// ---- NatureWorks / Ingeo template palette (matches the monthly deck) ----
const BLUE = "018BBF";
const TEAL = "009192";
const ORANGE = "EB8A01";
const CORAL = "FF5C3E";
const CYAN = "22B6E6";
const SLATE = "44546A";
const INK = "1F2A37";
const MUTE = "8A97A5";
const BG = "F4F7F9";
const PANEL = "FFFFFF";
const CARDLINE = "E1E7EC";
const TRACK = "E7ECF0";
const BANNER = "EAF4F8";
const FONT = "Aptos Narrow";

const num = (v: number) => Math.round(v).toLocaleString();

async function loadImg(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const oeeColorHex = (v: number) => (v >= 65 ? TEAL : v >= 45 ? ORANGE : CORAL);

type Align = "left" | "center" | "right";
type Cell = { v: string; align?: Align; color?: string; bold?: boolean };

export function OeeDeckButton({
  runs,
  summary,
  perLine,
  lossPareto,
  repack,
  scrap,
  pkgUsed,
  pkgLoss,
  periodLabel,
}: {
  runs: OeeRunRow[];
  summary: OeeDeckSummary;
  perLine: OeeLineRow[];
  lossPareto: OeeLossRow[];
  repack: number;
  scrap: number;
  pkgUsed: PkgRow[];
  pkgLoss: PkgRow[];
  periodLabel: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const logo = await loadImg("/deck/logo.jpeg");

      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
      pptx.layout = "WIDE";
      pptx.author = "NBC Warehouse";
      pptx.title = "NBC Warehouse — OEE Report (by round)";
      pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

      const W = 13.333;
      const genDate = new Date().toLocaleDateString("en-GB");
      let page = 0;

      const SHADOW: PptxGenJSLib.ShadowProps = { type: "outer", color: "B9C6D0", opacity: 0.5, blur: 5, offset: 2, angle: 90 };
      const LOGO_H = 0.52;
      const LOGO_W = (400 / 144) * LOGO_H;
      const dfmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

      const footer = (s: PptxGenJSLib.Slide) => {
        page += 1;
        s.addShape("line", { x: 0.5, y: 7.12, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        s.addText("NBC Warehouse · Ingeo by NatureWorks", { x: 0.5, y: 7.14, w: 6, h: 0.3, fontSize: 8, color: MUTE, valign: "middle" });
        s.addText("OEE · แยกรอบการผลิต", { x: W / 2 - 1.5, y: 7.14, w: 3, h: 0.3, fontSize: 8, color: MUTE, align: "center", valign: "middle" });
        s.addText(String(page), { x: W - 1.0, y: 7.14, w: 0.5, h: 0.3, fontSize: 8.5, bold: true, color: BLUE, align: "right", valign: "middle" });
      };

      const header = (s: PptxGenJSLib.Slide, title: string, th: string, accent = BLUE) => {
        s.background = { color: BG };
        s.addText(title, { x: 0.5, y: 0.28, w: 8.6, h: 0.5, fontSize: 23, bold: true, color: SLATE, valign: "middle" });
        s.addText(th, { x: 0.52, y: 0.82, w: 8.6, h: 0.3, fontSize: 11, color: MUTE, valign: "middle" });
        s.addShape("rect", { x: 0.52, y: 0.78, w: 0.9, h: 0.035, fill: { color: accent } });
        if (logo) s.addImage({ data: logo, x: W - 0.5 - LOGO_W, y: 0.32, w: LOGO_W, h: LOGO_H });
        s.addShape("roundRect", { x: W - 4.6, y: 0.9, w: 4.1, h: 0.34, rectRadius: 0.17, fill: { color: BANNER } });
        s.addText(periodLabel, { x: W - 4.6, y: 0.9, w: 4.1, h: 0.34, fontSize: 9.5, bold: true, color: BLUE, align: "center", valign: "middle" });
        s.addShape("line", { x: 0.5, y: 1.32, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        footer(s);
      };

      const newSlide = (title: string, th: string, accent = BLUE) => {
        const s = pptx.addSlide();
        header(s, title, th, accent);
        return s;
      };

      const tile = (
        s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number,
        label: string, value: string, valueColor = INK, sub?: string, accent = BLUE
      ) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        s.addShape("rect", { x, y, w, h: 0.1, fill: { color: accent } });
        s.addText(label, { x: x + 0.12, y: y + 0.2, w: w - 0.24, h: 0.4, fontSize: 11, bold: true, color: SLATE, align: "center", valign: "middle" });
        s.addText(value, { x: x + 0.1, y: y + 0.54, w: w - 0.2, h: h - (sub ? 0.9 : 0.66), fontSize: 22, bold: true, color: valueColor, align: "center", valign: "middle", fit: "shrink" });
        if (sub) s.addText(sub, { x: x + 0.12, y: y + h - 0.36, w: w - 0.24, h: 0.32, fontSize: 10, color: MUTE, align: "center" });
      };

      // Gauge drawn with shapes only (no chart) — a big % over a rounded
      // progress bar. Charts are what make PowerPoint prompt to "repair" the
      // file, so the whole deck avoids them.
      const gauge = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, label: string, p: number, color = BLUE) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        const v = Math.max(0, Math.min(100, p));
        s.addText(`${Math.round(v)}%`, { x: x + 0.1, y: y + 0.5, w: w - 0.2, h: h - 1.4, align: "center", valign: "middle", fontSize: 40, bold: true, color });
        const barX = x + 0.35, barW = w - 0.7, barY = y + h - 0.78, barH = 0.22;
        s.addShape("roundRect", { x: barX, y: barY, w: barW, h: barH, rectRadius: 0.11, fill: { color: TRACK } });
        if (v > 0) s.addShape("roundRect", { x: barX, y: barY, w: Math.max(0.12, (barW * v) / 100), h: barH, rectRadius: 0.11, fill: { color } });
        s.addText(label, { x: x + 0.1, y: y + h - 0.5, w: w - 0.2, h: 0.4, fontSize: 12, bold: true, color: SLATE, align: "center", valign: "middle" });
      };

      // Generic paginated table (header + alternating rows + optional summary banner).
      const BOTTOM = 6.98;
      const MIN_ROWH = 0.4;
      const tableSlide = (
        title: string, th: string, headers: string[], aligns: Align[], weights: number[],
        rows: Cell[][], summaryLine?: string, accent = BLUE
      ) => {
        const totalW = 12.33;
        const wsum = weights.reduce((a, b) => a + b, 0);
        const colW = weights.map((wt) => (wt / wsum) * totalW);
        const firstTop = summaryLine ? 2.32 : 2.05;
        const firstCap = Math.max(1, Math.floor((BOTTOM - firstTop) / MIN_ROWH) - 1);
        const contCap = Math.max(1, Math.floor((BOTTOM - 2.05) / MIN_ROWH) - 1);
        const chunks: Cell[][][] = [];
        if (rows.length === 0) chunks.push([]);
        else { let i = 0; while (i < rows.length) { const cap = chunks.length === 0 ? firstCap : contCap; chunks.push(rows.slice(i, i + cap)); i += cap; } }

        chunks.forEach((chunk, ci) => {
          const contTh = chunks.length > 1 ? `${th} (ต่อ ${ci + 1}/${chunks.length})` : th;
          const s = newSlide(title, contTh, accent);
          let top = 2.05;
          if (ci === 0 && summaryLine) {
            s.addShape("roundRect", { x: 0.5, y: 1.58, w: 12.33, h: 0.5, rectRadius: 0.06, fill: { color: BANNER }, line: { color: CARDLINE, width: 1 } });
            s.addText(summaryLine, { x: 0.7, y: 1.58, w: 12, h: 0.5, fontSize: 13, bold: true, color: BLUE, valign: "middle", fontFace: FONT });
            top = 2.32;
          }
          const headRow: PptxGenJSLib.TableRow = headers.map((hh, i) => ({
            text: hh,
            options: { bold: true, color: "FFFFFF", fill: { color: accent }, fontSize: 12, valign: "middle", align: aligns[i] ?? "left", fontFace: FONT, margin: [2, 4, 2, 4] as [number, number, number, number] },
          }));
          const bodyRows: PptxGenJSLib.TableRow[] = chunk.length
            ? chunk.map((r, ri) => r.map((c, cix) => ({
                text: c.v,
                options: {
                  fontSize: 12, bold: c.bold ?? false, color: c.color ?? (cix === 0 ? SLATE : INK),
                  align: c.align ?? aligns[cix] ?? "left", fill: { color: ri % 2 ? PANEL : BANNER },
                  valign: "middle", fontFace: FONT, margin: [2, 4, 2, 4] as [number, number, number, number],
                },
              })))
            : [[{ text: "— ไม่มีข้อมูลในช่วงนี้ (no data) —", options: { fontSize: 12, italic: true, color: MUTE, colspan: headers.length, align: "center" as const, fill: { color: PANEL }, fontFace: FONT } }]];
          const nRows = Math.max(chunk.length, 1) + 1;
          const rowH = Math.min(0.55, Math.max(MIN_ROWH, (BOTTOM - top) / nRows));
          s.addTable([headRow, ...bodyRows], { x: 0.5, y: top, w: totalW, colW, border: { type: "solid", color: CARDLINE, pt: 0.5 }, rowH, valign: "middle" });
        });
      };

      // ============ Slide 1: Title ============
      const t = pptx.addSlide();
      t.background = { color: BLUE };
      t.addShape("ellipse", { x: 9.3, y: -2.0, w: 6.0, h: 6.0, fill: { color: CYAN, transparency: 62 } });
      t.addShape("ellipse", { x: 11.0, y: 2.4, w: 4.6, h: 4.6, fill: { color: TEAL, transparency: 70 } });
      t.addShape("rect", { x: 0, y: 0, w: W, h: 0.18, fill: { color: TEAL } });
      if (logo) {
        t.addShape("roundRect", { x: 0.6, y: 0.55, w: 2.6, h: 1.05, rectRadius: 0.1, fill: { color: "FFFFFF" }, shadow: SHADOW });
        t.addImage({ data: logo, x: 0.82, y: 0.73, w: LOGO_W * 1.55, h: LOGO_H * 1.55 });
      }
      t.addText("OEE PERFORMANCE REPORT", { x: 0.65, y: 2.35, w: 11, h: 0.4, fontSize: 14, bold: true, color: "CFEFFF", charSpacing: 3 });
      t.addText("OEE รายรอบการผลิต", { x: 0.6, y: 2.8, w: 11.7, h: 1.0, fontSize: 44, bold: true, color: "FFFFFF" });
      t.addText("แยกรอบ · จัดกลุ่มตามวัน · สาเหตุ Downtime (by round · per day · with downtime causes)", { x: 0.63, y: 3.95, w: 11.8, h: 0.5, fontSize: 17, color: "EAF6FB" });
      t.addShape("roundRect", { x: 0.65, y: 4.75, w: 5.6, h: 0.52, rectRadius: 0.26, fill: { color: "FFFFFF" } });
      t.addText(`ช่วงข้อมูล (Period):  ${periodLabel}`, { x: 0.65, y: 4.75, w: 5.6, h: 0.52, fontSize: 12, bold: true, color: BLUE, align: "center", valign: "middle" });
      tile(t, 0.65, 5.5, 3.72, 1.45, "OEE (ภาพรวม)", `${summary.oee}%`, oeeColorHex(summary.oee), `${num(summary.scoredRuns)} รอบที่วัดได้`, BLUE);
      tile(t, 4.63, 5.5, 3.72, 1.45, "ผลิตได้ (Produced)", num(summary.produced), TEAL, "units", TEAL);
      tile(t, 8.61, 5.5, 3.72, 1.45, "ของเสีย (Loss)", num(summary.loss), CORAL, "units", CORAL);
      t.addText(`Generated: ${genDate}`, { x: W - 3.5, y: 5.05, w: 3.0, h: 0.3, fontSize: 9.5, color: "DDE8EE", align: "right" });

      // ============ Slide 2: Overall summary ============
      const totalDowntime = runs.reduce((s, r) => s + r.downtimeMin, 0);
      const s2 = newSlide("OEE Summary", "ภาพรวมทั้งช่วง · A × P × Q");
      const gy = 1.7, gh = 2.7, gw = (12.33 - 0.36) / 4;
      gauge(s2, 0.5, gy, gw, gh, "Availability", summary.a, BLUE);
      gauge(s2, 0.5 + (gw + 0.12), gy, gw, gh, "Performance", summary.p, ORANGE);
      gauge(s2, 0.5 + (gw + 0.12) * 2, gy, gw, gh, "Quality", summary.q, TEAL);
      gauge(s2, 0.5 + (gw + 0.12) * 3, gy, gw, gh, "OEE", summary.oee, oeeColorHex(summary.oee));
      const ty2 = gy + gh + 0.3, th2 = 1.5, tw = (12.33 - 0.6) / 6;
      const tileX = (i: number) => 0.5 + i * (tw + 0.12);
      tile(s2, tileX(0), ty2, tw, th2, "รอบที่วัด OEE", `${num(summary.scoredRuns)}/${num(summary.docs)}`, INK, "runs / docs", BLUE);
      tile(s2, tileX(1), ty2, tw, th2, "ผลิตได้", num(summary.produced), TEAL, "units", TEAL);
      tile(s2, tileX(2), ty2, tw, th2, "ของเสีย", num(summary.loss), CORAL, "units", CORAL);
      tile(s2, tileX(3), ty2, tw, th2, "Downtime รวม", num(totalDowntime), SLATE, "นาที (min)", SLATE);
      tile(s2, tileX(4), ty2, tw, th2, "Repack", num(repack), ORANGE, "units", ORANGE);
      tile(s2, tileX(5), ty2, tw, th2, "Scrap", num(scrap), CORAL, "units", CORAL);

      // ============ Slide 3: OEE by production line ============
      tableSlide(
        "OEE by Line", "OEE แยกตามสายผลิต",
        ["สายผลิต (Line)", "A%", "P%", "Q%", "OEE%", "Output", "Std (u/hr)"],
        ["left", "center", "center", "center", "center", "right", "right"],
        [3.2, 1, 1, 1, 1.2, 1.6, 1.6],
        perLine.map((l) => [
          { v: l.name || "-", bold: true },
          { v: `${l.a}`, color: BLUE }, { v: `${l.p}`, color: ORANGE }, { v: `${l.q}`, color: TEAL },
          { v: `${l.oee}`, color: oeeColorHex(l.oee), bold: true },
          { v: num(l.output) }, { v: l.standard ? num(l.standard) : "—" },
        ]),
        `${perLine.length} สายผลิต · OEE รวม ${summary.oee}%`,
        TEAL
      );

      // ============ Slide 4: Downtime Pareto ============
      const pareto = [...lossPareto].sort((a, b) => b.lostMin - a.lostMin);
      const s4 = newSlide("Downtime Pareto", "สาเหตุที่ทำให้เสียเวลามากที่สุด");
      if (pareto.length > 0) {
        const top = pareto.slice(0, 6);
        const maxMin = Math.max(1, ...top.map((r) => r.lostMin));
        const panelH = 0.5 + top.length * 0.42 + 0.15;
        s4.addShape("roundRect", { x: 0.5, y: 1.55, w: 12.33, h: panelH, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        s4.addText("เสียเวลา (นาที) ต่อสาเหตุ — Lost minutes by cause", { x: 0.7, y: 1.65, w: 11.9, h: 0.3, fontSize: 12, bold: true, color: SLATE });
        // Horizontal bars drawn with shapes (no chart → no PowerPoint repair).
        const labelW = 4.0, trackX = 0.7 + labelW + 0.1, trackW = 12.33 - (trackX - 0.5) - 1.6;
        top.forEach((r, i) => {
          const rowY = 2.06 + i * 0.42;
          s4.addText(r.loss || "-", { x: 0.7, y: rowY, w: labelW, h: 0.34, fontSize: 11, color: SLATE, valign: "middle", align: "left", fontFace: FONT });
          s4.addShape("roundRect", { x: trackX, y: rowY + 0.05, w: trackW, h: 0.24, rectRadius: 0.05, fill: { color: TRACK } });
          s4.addShape("roundRect", { x: trackX, y: rowY + 0.05, w: Math.max(0.1, (trackW * r.lostMin) / maxMin), h: 0.24, rectRadius: 0.05, fill: { color: ORANGE } });
          s4.addText(`${num(r.lostMin)} นาที`, { x: trackX + trackW + 0.08, y: rowY, w: 1.5, h: 0.34, fontSize: 11, bold: true, color: SLATE, valign: "middle", align: "left", fontFace: FONT });
        });
      } else {
        s4.addText("— ไม่มี Downtime ที่บันทึกไว้ในช่วงนี้ —", { x: 0.5, y: 3.0, w: 12.33, h: 0.5, fontSize: 14, italic: true, color: MUTE, align: "center", fontFace: FONT });
      }

      // ============ Slide 5: Packaging — used vs loss ============
      {
        const names = Array.from(new Set([...pkgUsed.map((m) => m.name), ...pkgLoss.map((m) => m.name)]));
        const usedBy = new Map(pkgUsed.map((m) => [m.name, m.qty]));
        const lossBy = new Map(pkgLoss.map((m) => [m.name, m.qty]));
        const pkgRows: Cell[][] = names
          .map((name) => {
            const used = usedBy.get(name) ?? 0;
            const lost = lossBy.get(name) ?? 0;
            const lossPct = used > 0 ? (lost / used) * 100 : lost > 0 ? 100 : 0;
            return { name, used, lost, lossPct };
          })
          .sort((a, b) => b.used - a.used)
          .map((r) => [
            { v: r.name || "-", bold: true } as Cell,
            { v: num(r.used), align: "right" as Align },
            { v: num(r.lost), align: "right" as Align, color: r.lost > 0 ? CORAL : INK },
            { v: `${r.lossPct.toFixed(1)}%`, align: "right" as Align, color: r.lossPct >= 3 ? CORAL : MUTE },
          ]);
        const usedTotal = pkgUsed.reduce((s, m) => s + m.qty, 0);
        const lossTotal = pkgLoss.reduce((s, m) => s + m.qty, 0);
        tableSlide(
          "Packaging (บรรจุภัณฑ์)", "ใช้ไป vs เสีย · ต่อวัสดุ (used vs loss, per material)",
          ["วัสดุ (Material)", "ใช้ไป (Used)", "เสีย (Loss)", "% เสีย"],
          ["left", "right", "right", "right"],
          [4.6, 2.4, 2.4, 1.6],
          pkgRows,
          `ใช้ไปรวม ${num(usedTotal)} · เสียรวม ${num(lossTotal)}${usedTotal > 0 ? ` (${((lossTotal / usedTotal) * 100).toFixed(1)}%)` : ""}`,
          TEAL
        );
      }

      // ============ Per-day round tables (grouped, each round separate) ============
      const byDay = new Map<string, OeeRunRow[]>();
      for (const r of runs) { const arr = byDay.get(r.day) ?? []; arr.push(r); byDay.set(r.day, arr); }
      const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));

      const rHeaders = ["รอบ", "Doc No", "Line", "Plan", "DT", "A%", "P%", "Q%", "OEE%", "ผลิต", "ของเสีย"];
      const rAligns: Align[] = ["center", "left", "left", "right", "right", "center", "center", "center", "center", "right", "right"];
      const rWeights = [0.8, 1.9, 1.8, 1, 0.9, 0.9, 0.9, 0.9, 1.05, 1.15, 1.1];
      const totalW = 12.33; const wsum = rWeights.reduce((a, b) => a + b, 0); const colW = rWeights.map((wt) => (wt / wsum) * totalW);

      for (const day of days) {
        const dayRuns = byDay.get(day)!;
        const avgOee = Math.round(dayRuns.reduce((s, r) => s + r.oee, 0) / dayRuns.length);
        const dayProduced = dayRuns.reduce((s, r) => s + r.produced, 0);
        const dayDown = dayRuns.reduce((s, r) => s + r.downtimeMin, 0);
        const rowsTop = 2.4;
        const cap = Math.max(1, Math.floor((BOTTOM - rowsTop) / MIN_ROWH) - 1);
        const nChunks = Math.max(1, Math.ceil(dayRuns.length / cap));
        for (let ci = 0; ci < nChunks; ci++) {
          const chunk = dayRuns.slice(ci * cap, ci * cap + cap);
          const suffix = nChunks > 1 ? ` (ต่อ ${ci + 1}/${nChunks})` : "";
          const s = newSlide(`OEE · ${dfmt(day)}`, `แยกรอบในวันเดียวกัน · ${dayRuns.length} รอบ${suffix}`);
          s.addShape("roundRect", { x: 0.5, y: 1.58, w: 12.33, h: 0.56, rectRadius: 0.06, fill: { color: BANNER }, line: { color: CARDLINE, width: 1 } });
          s.addText(`${dfmt(day)}  ·  ${dayRuns.length} รอบ  ·  OEE เฉลี่ย ${avgOee}%  ·  ผลิตรวม ${num(dayProduced)}  ·  Downtime รวม ${num(dayDown)} นาที`,
            { x: 0.7, y: 1.58, w: 12, h: 0.56, fontSize: 13, bold: true, color: BLUE, valign: "middle", fontFace: FONT });
          const headRow: PptxGenJSLib.TableRow = rHeaders.map((hh, i) => ({
            text: hh, options: { bold: true, color: "FFFFFF", fill: { color: BLUE }, fontSize: 11.5, valign: "middle", align: rAligns[i], fontFace: FONT, margin: [2, 4, 2, 4] as [number, number, number, number] },
          }));
          const bodyRows: PptxGenJSLib.TableRow[] = chunk.map((r, ri) => {
            const roundNo = ci * cap + ri + 1;
            const cells: Cell[] = [
              { v: String(roundNo), align: "center", bold: true },
              { v: r.doc, align: "left", color: SLATE },
              { v: r.line || "-", align: "left" },
              { v: num(r.plannedMin), align: "right" },
              { v: num(r.downtimeMin), align: "right", color: r.downtimeMin > 0 ? ORANGE : INK },
              { v: `${r.a}`, align: "center", color: BLUE },
              { v: `${r.p}`, align: "center", color: ORANGE },
              { v: `${r.q}`, align: "center", color: TEAL },
              { v: `${r.oee}`, align: "center", color: oeeColorHex(r.oee), bold: true },
              { v: num(r.produced), align: "right" },
              { v: num(r.loss), align: "right", color: r.loss > 0 ? CORAL : INK },
            ];
            return cells.map((c) => ({
              text: c.v, options: { fontSize: 11.5, bold: c.bold ?? false, color: c.color ?? INK, align: c.align ?? "left", fill: { color: ri % 2 ? PANEL : BANNER }, valign: "middle", fontFace: FONT, margin: [2, 4, 2, 4] as [number, number, number, number] },
            }));
          });
          const nRows = chunk.length + 1;
          const rowH = Math.min(0.55, Math.max(MIN_ROWH, (BOTTOM - rowsTop) / nRows));
          s.addTable([headRow, ...bodyRows], { x: 0.5, y: rowsTop, w: totalW, colW, border: { type: "solid", color: CARDLINE, pt: 0.5 }, rowH, valign: "middle" });
        }
      }

      // ============ Downtime detail (every recorded event) ============
      const dtRows: Cell[][] = [];
      for (const r of runs) {
        for (const e of r.downtimeEvents) {
          dtRows.push([
            { v: dfmt(r.day) },
            { v: r.doc, color: SLATE },
            { v: e.reason || "-", bold: true },
            { v: e.detail || "-", color: e.detail ? BLUE : MUTE },
            { v: num(e.minutes), align: "right", color: ORANGE, bold: true },
          ]);
        }
      }
      if (dtRows.length > 0) {
        tableSlide(
          "Downtime detail", "รายละเอียดการหยุดเครื่อง (ทุกเหตุการณ์) · เหตุ · อธิบายเหตุ · นาที",
          ["วันที่", "Doc", "เหตุ (Reason)", "อธิบายเหตุ", "นาที"],
          ["left", "left", "left", "left", "right"],
          [1.6, 2.4, 3.0, 4.0, 1.3],
          dtRows,
          `รวม ${dtRows.length} เหตุการณ์ · ${num(totalDowntime)} นาที`,
          ORANGE
        );
      }

      if (days.length === 0) {
        const s = newSlide("OEE · รายรอบ", "แยกรอบในวันเดียวกัน");
        s.addText("— ไม่มีรอบการผลิตที่วัด OEE ในช่วงนี้ (no scored production runs) —", { x: 0.5, y: 3.2, w: 12.33, h: 0.6, fontSize: 14, italic: true, color: MUTE, align: "center", fontFace: FONT });
      }

      await pptx.writeFile({ fileName: `NBC-OEE-by-round-${genDate.replace(/\//g, "-")}.pptx` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-[8px] border border-[#16a6bf] bg-[#e8f2fb] px-3.5 py-2 text-[12.5px] font-semibold text-[#0c7f93] disabled:opacity-60"
    >
      {busy ? "กำลังสร้าง…" : "⬇ Export OEE (PowerPoint · แยกรอบ)"}
    </button>
  );
}

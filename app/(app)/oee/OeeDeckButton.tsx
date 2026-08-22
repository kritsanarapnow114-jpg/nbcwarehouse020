"use client";

import { useState } from "react";
import type PptxGenJSLib from "pptxgenjs";

// Per-round (per Pack Order run) OEE row, as computed by getOeeDashboard.
export type OeeRunRow = {
  doc: string;
  day: string; // yyyy-mm-dd
  line: string;
  a: number;
  p: number;
  q: number;
  oee: number;
  produced: number;
  loss: number;
  pkgLoss: number;
  downtimeMin: number;
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

export function OeeDeckButton({
  runs,
  summary,
  periodLabel,
}: {
  runs: OeeRunRow[];
  summary: OeeDeckSummary;
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
      const CT = pptx.ChartType;
      const cf = { dataLabelFontFace: FONT, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT };
      const genDate = new Date().toLocaleDateString("en-GB");
      let page = 0;

      const SHADOW: PptxGenJSLib.ShadowProps = {
        type: "outer", color: "B9C6D0", opacity: 0.5, blur: 5, offset: 2, angle: 90,
      };
      const LOGO_H = 0.52;
      const LOGO_W = (400 / 144) * LOGO_H;

      const footer = (s: PptxGenJSLib.Slide) => {
        page += 1;
        s.addShape("line", { x: 0.5, y: 7.12, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        s.addText("NBC Warehouse · Ingeo by NatureWorks", { x: 0.5, y: 7.14, w: 6, h: 0.3, fontSize: 8, color: MUTE, valign: "middle" });
        s.addText("OEE · แยกรอบการผลิต", { x: W / 2 - 1.5, y: 7.14, w: 3, h: 0.3, fontSize: 8, color: MUTE, align: "center", valign: "middle" });
        s.addText(String(page), { x: W - 1.0, y: 7.14, w: 0.5, h: 0.3, fontSize: 8.5, bold: true, color: BLUE, align: "right", valign: "middle" });
      };

      const header = (s: PptxGenJSLib.Slide, title: string, th: string, accent = BLUE) => {
        s.background = { color: BG };
        s.addText(title, { x: 0.5, y: 0.28, w: 8.6, h: 0.5, fontSize: 24, bold: true, color: SLATE, valign: "middle" });
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

      const gauge = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, label: string, p: number, color = BLUE) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        const v = Math.max(0, Math.min(100, p));
        const size = Math.min(w - 0.4, h - 1.0);
        const cx = x + (w - size) / 2;
        const cy = y + 0.42;
        s.addChart(
          CT.doughnut,
          [{ name: "g", labels: ["value", "rest"], values: [v, 100 - v] }],
          { x: cx, y: cy, w: size, h: size, holeSize: 74, chartColors: [color, TRACK], showLegend: false, showTitle: false, ...cf, showValue: false, showPercent: false, dataBorder: { pt: 0, color: PANEL } }
        );
        s.addText(`${Math.round(v)}%`, { x: cx, y: cy, w: size, h: size, align: "center", valign: "middle", fontSize: 24, bold: true, color: SLATE });
        s.addText(label, { x: x + 0.1, y: y + h - 0.5, w: w - 0.2, h: 0.4, fontSize: 12, bold: true, color: SLATE, align: "center", valign: "middle" });
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
      t.addText("แยกรอบ · จัดกลุ่มตามวัน (by production round, grouped per day)", { x: 0.63, y: 3.95, w: 11.5, h: 0.5, fontSize: 18, color: "EAF6FB" });
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
      const ty2 = gy + gh + 0.3, th2 = 1.5, tw = (12.33 - 0.48) / 5;
      tile(s2, 0.5, ty2, tw, th2, "รอบที่วัด OEE", `${num(summary.scoredRuns)}/${num(summary.docs)}`, INK, "runs scored / docs", BLUE);
      tile(s2, 0.5 + (tw + 0.12), ty2, tw, th2, "ผลิตได้", num(summary.produced), TEAL, "units", TEAL);
      tile(s2, 0.5 + (tw + 0.12) * 2, ty2, tw, th2, "ของเสีย", num(summary.loss), CORAL, "units", CORAL);
      tile(s2, 0.5 + (tw + 0.12) * 3, ty2, tw, th2, "บรรจุภัณฑ์เสีย", num(summary.pkgLoss), ORANGE, "pkg units", ORANGE);
      tile(s2, 0.5 + (tw + 0.12) * 4, ty2, tw, th2, "Downtime รวม", `${num(totalDowntime)}`, SLATE, "นาที (min)", SLATE);

      // ============ Per-day round tables ============
      // Group runs by day (desc), each day's rounds listed separately.
      const byDay = new Map<string, OeeRunRow[]>();
      for (const r of runs) {
        const arr = byDay.get(r.day) ?? [];
        arr.push(r);
        byDay.set(r.day, arr);
      }
      const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
      const dfmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

      const headers = ["รอบ", "Doc No", "Line", "A%", "P%", "Q%", "OEE%", "ผลิต", "ของเสีย", "Downtime"];
      const weights = [0.9, 2.0, 1.9, 1.0, 1.0, 1.0, 1.1, 1.2, 1.2, 1.3];
      const totalW = 12.33;
      const wsum = weights.reduce((a, b) => a + b, 0);
      const colW = weights.map((wt) => (wt / wsum) * totalW);
      const BOTTOM = 6.98;
      const MIN_ROWH = 0.4;

      for (const day of days) {
        const dayRuns = byDay.get(day)!;
        const avgOee = Math.round(dayRuns.reduce((s, r) => s + r.oee, 0) / dayRuns.length);
        const dayProduced = dayRuns.reduce((s, r) => s + r.produced, 0);
        const dayDown = dayRuns.reduce((s, r) => s + r.downtimeMin, 0);
        const bannerTop = 1.58;
        const rowsTop = 2.4;
        const cap = Math.max(1, Math.floor((BOTTOM - rowsTop) / MIN_ROWH) - 1);

        // A day can have more rounds than fit on one slide — spill onto more.
        for (let ci = 0; ci * cap < dayRuns.length || ci === 0; ci++) {
          const chunk = dayRuns.slice(ci * cap, ci * cap + cap);
          if (chunk.length === 0 && ci > 0) break;
          const suffix = dayRuns.length > cap ? ` (ต่อ ${ci + 1})` : "";
          const s = newSlide(`OEE · ${dfmt(day)}`, `แยกรอบในวันเดียวกัน · ${dayRuns.length} รอบ${suffix}`);
          s.addShape("roundRect", { x: 0.5, y: bannerTop, w: 12.33, h: 0.56, rectRadius: 0.06, fill: { color: BANNER }, line: { color: CARDLINE, width: 1 } });
          s.addText(
            `${dfmt(day)}  ·  ${dayRuns.length} รอบ  ·  OEE เฉลี่ย ${avgOee}%  ·  ผลิตรวม ${num(dayProduced)}  ·  Downtime รวม ${num(dayDown)} นาที`,
            { x: 0.7, y: bannerTop, w: 12, h: 0.56, fontSize: 13, bold: true, color: BLUE, valign: "middle", fontFace: FONT }
          );
          const headRow: PptxGenJSLib.TableRow = headers.map((h) => ({
            text: h,
            options: { bold: true, color: "FFFFFF", fill: { color: BLUE }, fontSize: 12, valign: "middle", align: "center", fontFace: FONT, margin: [2, 4, 2, 4] as [number, number, number, number] },
          }));
          const bodyRows: PptxGenJSLib.TableRow[] = chunk.map((r, ri) => {
            const roundNo = ci * cap + ri + 1;
            const cells: (string | { v: string; align?: "left" | "center" | "right"; color?: string })[] = [
              { v: String(roundNo), align: "center" },
              { v: r.doc, align: "left" },
              { v: r.line || "-", align: "left" },
              { v: `${r.a}`, align: "center", color: BLUE },
              { v: `${r.p}`, align: "center", color: ORANGE },
              { v: `${r.q}`, align: "center", color: TEAL },
              { v: `${r.oee}`, align: "center", color: oeeColorHex(r.oee) },
              { v: num(r.produced), align: "right" },
              { v: num(r.loss), align: "right", color: r.loss > 0 ? CORAL : INK },
              { v: `${num(r.downtimeMin)}`, align: "right", color: r.downtimeMin > 0 ? ORANGE : INK },
            ];
            return cells.map((c, cix) => {
              const cell = typeof c === "string" ? { v: c } : c;
              return {
                text: cell.v,
                options: {
                  fontSize: 12,
                  bold: cix === 0 || cix === 6,
                  color: cell.color ?? (cix === 1 ? SLATE : INK),
                  align: (cell.align ?? "left") as "left" | "center" | "right",
                  fill: { color: ri % 2 ? PANEL : BANNER },
                  valign: "middle",
                  fontFace: FONT,
                  margin: [2, 4, 2, 4] as [number, number, number, number],
                },
              };
            });
          });
          const nRows = chunk.length + 1;
          const rowH = Math.min(0.55, Math.max(MIN_ROWH, (BOTTOM - rowsTop) / nRows));
          s.addTable([headRow, ...bodyRows], {
            x: 0.5, y: rowsTop, w: totalW, colW,
            border: { type: "solid", color: CARDLINE, pt: 0.5 },
            rowH, valign: "middle",
          });
          if ((ci + 1) * cap >= dayRuns.length) break;
        }
      }

      if (days.length === 0) {
        const s = newSlide("OEE · รายรอบ", "แยกรอบในวันเดียวกัน");
        s.addText("— ไม่มีรอบการผลิตที่วัด OEE ในช่วงนี้ (no scored production runs) —", {
          x: 0.5, y: 3.2, w: 12.33, h: 0.6, fontSize: 14, italic: true, color: MUTE, align: "center", fontFace: FONT,
        });
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

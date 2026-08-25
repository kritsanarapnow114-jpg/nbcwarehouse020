"use client";

import { useState } from "react";
import type PptxGenJSLib from "pptxgenjs";
import type { ExecutiveSummary } from "@/lib/views/summary";

// ---- NatureWorks / Ingeo template palette (from the client's template) ----
const BLUE = "018BBF"; // primary
const TEAL = "009192";
const ORANGE = "EB8A01";
const CORAL = "FF5C3E";
const CYAN = "22B6E6";
const SLATE = "44546A"; // headings
const INK = "1F2A37";
const MUTE = "8A97A5";
const BG = "F4F7F9"; // page background
const PANEL = "FFFFFF"; // cards
const CARDLINE = "E1E7EC";
const TRACK = "E7ECF0"; // gauge/bar track
const BANNER = "EAF4F8"; // soft blue tint
const AMBER = ORANGE;
const RED = CORAL;
const CATS = [BLUE, TEAL, ORANGE, CYAN, SLATE, CORAL];
const FONT = "Aptos Narrow";

const money = (v: number) => "฿" + Math.round(v).toLocaleString();
const num = (v: number) => Math.round(v).toLocaleString();
// Short axis/label form so shape-drawn bars stay readable (1.2M, 340K).
const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return Math.round(v / 1e3) + "K";
  return String(Math.round(v));
};
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const oeeColorHex = (v: number) => (v >= 65 ? TEAL : v >= 45 ? ORANGE : CORAL);

// OEE / Packaging data folded into the combined report (optional — the deck
// still builds when the period has no production).
export type DeckOee = {
  summary: { a: number; p: number; q: number; oee: number; produced: number; loss: number; scoredRuns: number; docs: number };
  perLine: { name: string; oee: number; a: number; p: number; q: number; output: number; standard: number }[];
  perShift: { name: string; oee: number; a: number; p: number; q: number; produced: number; loss: number; output: number; downtimeMin: number; runs: number }[];
  lossPareto: { loss: string; freq: number; lostMin: number }[];
  pkgUsed: { name: string; qty: number }[];
  pkgLoss: { name: string; qty: number }[];
  repack: number;
  scrap: number;
  downtimeMin: number;
};

// Fetch a same-origin image as a data URL. Never throws — a miss just returns
// null and that image is skipped, so the export always succeeds.
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

export function ExportDeckButton({
  summary,
  periodLabel,
  oee,
}: {
  summary: ExecutiveSummary;
  periodLabel: string;
  oee?: DeckOee | null;
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
      pptx.title = "NBC Warehouse — Combined Report";
      pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

      const W = 13.333;
      const genDate = new Date().toLocaleDateString("en-GB");
      let page = 0;

      const SHADOW: PptxGenJSLib.ShadowProps = {
        type: "outer", color: "B9C6D0", opacity: 0.5, blur: 5, offset: 2, angle: 90,
      };
      const LOGO_H = 0.52; // logo is 400x144
      const LOGO_W = (400 / 144) * LOGO_H;

      const footer = (s: PptxGenJSLib.Slide) => {
        page += 1;
        s.addShape("line", { x: 0.5, y: 7.12, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        s.addText("NBC Warehouse · Ingeo by NatureWorks", { x: 0.5, y: 7.14, w: 6, h: 0.3, fontSize: 8, color: MUTE, valign: "middle" });
        s.addText("CONFIDENTIAL", { x: W / 2 - 1.5, y: 7.14, w: 3, h: 0.3, fontSize: 8, color: MUTE, align: "center", valign: "middle", charSpacing: 2 });
        s.addText(String(page), { x: W - 1.0, y: 7.14, w: 0.5, h: 0.3, fontSize: 8.5, bold: true, color: BLUE, align: "right", valign: "middle" });
      };

      const header = (s: PptxGenJSLib.Slide, title: string, th: string, no: number, accent = BLUE) => {
        s.background = { color: BG };
        s.addText(String(no).padStart(2, "0"), { x: 0.5, y: 0.3, w: 0.9, h: 0.6, fontSize: 30, bold: true, color: accent, valign: "middle" });
        s.addText(title, { x: 1.35, y: 0.28, w: 8.0, h: 0.44, fontSize: 22, bold: true, color: SLATE, valign: "middle" });
        s.addText(th, { x: 1.37, y: 0.7, w: 8.0, h: 0.3, fontSize: 11, color: MUTE, valign: "middle" });
        s.addShape("rect", { x: 1.37, y: 0.66, w: 0.9, h: 0.035, fill: { color: accent } });
        if (logo) s.addImage({ data: logo, x: W - 0.5 - LOGO_W, y: 0.32, w: LOGO_W, h: LOGO_H });
        s.addShape("roundRect", { x: W - 4.6, y: 0.98, w: 4.1, h: 0.34, rectRadius: 0.17, fill: { color: BANNER } });
        s.addText(periodLabel, { x: W - 4.6, y: 0.98, w: 4.1, h: 0.34, fontSize: 9.5, bold: true, color: BLUE, align: "center", valign: "middle" });
        s.addShape("line", { x: 0.5, y: 1.42, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        footer(s);
      };

      const newSlide = (title: string, th: string, no: number, accent = BLUE) => {
        const s = pptx.addSlide();
        header(s, title, th, no, accent);
        return s;
      };

      // KPI tile — white card, colored top strip, big colored number.
      const tile = (
        s: PptxGenJSLib.Slide,
        x: number, y: number, w: number, h: number,
        label: string, value: string, valueColor = INK, sub?: string, valueSize = 22, accent = BLUE
      ) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        s.addShape("roundRect", { x, y, w, h: 0.12, rectRadius: 0.05, fill: { color: accent } });
        s.addShape("rect", { x, y: y + 0.06, w, h: 0.08, fill: { color: accent } });
        s.addText(label, { x: x + 0.15, y: y + 0.2, w: w - 0.3, h: 0.4, fontSize: 11, bold: true, color: SLATE, align: "center", valign: "middle" });
        s.addText(value, { x: x + 0.1, y: y + 0.56, w: w - 0.2, h: h - (sub ? 0.86 : 0.66), fontSize: valueSize, bold: true, color: valueColor, align: "center", valign: "middle", fit: "shrink" });
        if (sub) s.addText(sub, { x: x + 0.12, y: y + h - 0.34, w: w - 0.24, h: 0.3, fontSize: 10, color: MUTE, align: "center" });
      };

      const panel = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, title?: string) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        if (title) s.addText(title, { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.34, fontSize: 13, bold: true, color: SLATE, align: "center" });
      };

      // --- Shape-only graphs. Charts (addChart) embed an Excel workbook whose
      // XML makes PowerPoint prompt to "repair" the file on every open, so the
      // whole deck draws its graphs with rectangles instead. ---

      // Gauge: big % over a rounded progress bar, inside a titled card.
      const gauge = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, label: string, pct: number, color = BLUE) => {
        panel(s, x, y, w, h);
        const v = clamp(pct);
        s.addText(`${Math.round(v)}%`, { x: x + 0.1, y: y + 0.42, w: w - 0.2, h: h - 1.5, align: "center", valign: "middle", fontSize: 34, bold: true, color });
        const barX = x + 0.3, barW = w - 0.6, barY = y + h - 0.86, barH = 0.2;
        s.addShape("roundRect", { x: barX, y: barY, w: barW, h: barH, rectRadius: 0.1, fill: { color: TRACK } });
        if (v > 0) s.addShape("roundRect", { x: barX, y: barY, w: Math.max(0.1, (barW * v) / 100), h: barH, rectRadius: 0.1, fill: { color } });
        s.addText(label, { x: x + 0.1, y: y + h - 0.56, w: w - 0.2, h: 0.44, fontSize: 11.5, bold: true, color: SLATE, align: "center", valign: "middle" });
      };

      // Vertical column chart drawn with shapes. `fmt` labels each column.
      const barColumn = (
        s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number,
        labels: string[], values: number[], colors: string[], fmt: (v: number) => string
      ) => {
        const n = values.length;
        if (!n) return;
        const max = Math.max(1, ...values);
        const gap = Math.min(0.18, (w * 0.9) / (n * 3));
        const colW = (w - gap * (n + 1)) / n;
        const labelH = 0.44;
        const baseY = y + h - labelH;
        const chartH = h - labelH - 0.28; // headroom for value text
        values.forEach((v, i) => {
          const bx = x + gap + i * (colW + gap);
          const bh = Math.max(0.03, (v / max) * chartH);
          s.addShape("roundRect", { x: bx, y: baseY - bh, w: colW, h: bh, rectRadius: 0.03, fill: { color: colors[i % colors.length] } });
          s.addText(fmt(v), { x: bx - 0.15, y: baseY - bh - 0.26, w: colW + 0.3, h: 0.24, fontSize: 9, bold: true, color: SLATE, align: "center" });
          s.addText(labels[i], { x: bx - 0.15, y: baseY + 0.03, w: colW + 0.3, h: labelH - 0.03, fontSize: 8.5, color: MUTE, align: "center", valign: "top" });
        });
      };

      // Horizontal bar rows drawn with shapes (label · track · value).
      const barRows = (
        s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number,
        rows: { label: string; pct: number; color: string; valueText: string }[], labelW = 2.2, valW = 1.1
      ) => {
        const n = rows.length;
        if (!n) return;
        const rowH = Math.min(0.5, h / n);
        const trackX = x + labelW + 0.1;
        const trackW = w - labelW - 0.1 - valW;
        rows.forEach((r, i) => {
          const ry = y + i * rowH;
          const cy = ry + rowH / 2;
          s.addText(r.label, { x, y: ry, w: labelW, h: rowH, fontSize: 10.5, color: SLATE, valign: "middle", fontFace: FONT });
          s.addShape("roundRect", { x: trackX, y: cy - 0.11, w: trackW, h: 0.22, rectRadius: 0.11, fill: { color: TRACK } });
          s.addShape("roundRect", { x: trackX, y: cy - 0.11, w: Math.max(0.08, (trackW * clamp(r.pct)) / 100), h: 0.22, rectRadius: 0.11, fill: { color: r.color } });
          s.addText(r.valueText, { x: trackX + trackW + 0.06, y: ry, w: valW, h: rowH, fontSize: 10.5, bold: true, color: SLATE, valign: "middle", fontFace: FONT });
        });
      };

      const st = summary.stats;
      const d = summary.detail;

      // ================= Slide 1: Title (blue) =================
      const t = pptx.addSlide();
      t.background = { color: BLUE };
      t.addShape("ellipse", { x: 9.3, y: -2.0, w: 6.0, h: 6.0, fill: { color: CYAN, transparency: 62 } });
      t.addShape("ellipse", { x: 11.0, y: 2.4, w: 4.6, h: 4.6, fill: { color: TEAL, transparency: 70 } });
      t.addShape("rect", { x: 0, y: 0, w: W, h: 0.18, fill: { color: TEAL } });
      if (logo) {
        t.addShape("roundRect", { x: 0.6, y: 0.55, w: 2.6, h: 1.05, rectRadius: 0.1, fill: { color: "FFFFFF" }, shadow: SHADOW });
        t.addImage({ data: logo, x: 0.82, y: 0.73, w: LOGO_W * 1.55, h: LOGO_H * 1.55 });
      }
      t.addText("COMBINED WAREHOUSE REPORT", { x: 0.65, y: 2.35, w: 11, h: 0.4, fontSize: 14, bold: true, color: "CFEFFF", charSpacing: 3 });
      t.addText("NBC Warehouse", { x: 0.6, y: 2.8, w: 11.7, h: 1.0, fontSize: 48, bold: true, color: "FFFFFF" });
      t.addText("รายงานรวมทุกงาน · Inventory · Operations · OEE · Packaging", { x: 0.63, y: 3.95, w: 11.8, h: 0.5, fontSize: 19, color: "EAF6FB" });
      t.addShape("roundRect", { x: 0.65, y: 4.75, w: 5.6, h: 0.52, rectRadius: 0.26, fill: { color: "FFFFFF" } });
      t.addText(`ช่วงข้อมูล (Period):  ${periodLabel}`, { x: 0.65, y: 4.75, w: 5.6, h: 0.52, fontSize: 12, bold: true, color: BLUE, align: "center", valign: "middle" });
      tile(t, 0.65, 5.5, 3.72, 1.45, "Inventory Value (มูลค่าคงเหลือ)", money(st.inventoryValue), BLUE, `${num(st.skuCount)} SKU · ${num(st.lotCount)} lots`, 18, BLUE);
      tile(t, 4.63, 5.5, 3.72, 1.45, "Received (รับเข้า)", num(st.receivedUnits), TEAL, "units this period", 18, TEAL);
      tile(t, 8.61, 5.5, 3.72, 1.45, "Issued (จ่ายออก)", num(st.issuedUnits), ORANGE, "units this period", 18, ORANGE);
      t.addText(`Generated: ${genDate}`, { x: W - 3.5, y: 5.05, w: 3.0, h: 0.3, fontSize: 9.5, color: "DDE8EE", align: "right" });

      // ================= Slide 2: Executive Dashboard =================
      const g = pptx.addSlide();
      g.background = { color: BG };
      g.addText("Executive Dashboard", { x: 0.5, y: 0.3, w: 8, h: 0.5, fontSize: 26, bold: true, color: SLATE });
      g.addText(`ภาพรวมคลังสินค้า · ${periodLabel}`, { x: 0.52, y: 0.82, w: 8, h: 0.3, fontSize: 11, color: MUTE });
      if (logo) g.addImage({ data: logo, x: W - 0.5 - LOGO_W, y: 0.32, w: LOGO_W, h: LOGO_H });
      g.addShape("line", { x: 0.5, y: 1.2, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
      footer(g);

      const TY = [1.32, 2.74, 4.16, 5.58];
      const TH = 1.32;
      tile(g, 0.28, TY[0], 2.2, TH, "Inventory Value", money(st.inventoryValue), BLUE, "มูลค่าคงเหลือ", 15, BLUE);
      tile(g, 0.28, TY[1], 2.2, TH, "SKU Count", num(st.skuCount), INK, "จำนวนสินค้า", 20, TEAL);
      tile(g, 0.28, TY[2], 2.2, TH, "Lots On Hand", num(st.lotCount), INK, "ล็อตคงเหลือ", 20, TEAL);
      tile(g, 0.28, TY[3], 2.2, TH, "Received", num(st.receivedUnits), BLUE, "รับเข้า (units)", 20, BLUE);
      const RX = W - 0.28 - 2.2;
      tile(g, RX, TY[0], 2.2, TH, "Issued", num(st.issuedUnits), ORANGE, "จ่ายออก (units)", 20, ORANGE);
      tile(g, RX, TY[1], 2.2, TH, "Loss Value", money(st.lossValue), CORAL, "มูลค่าสูญเสีย", 15, CORAL);
      tile(g, RX, TY[2], 2.2, TH, "PO Received", num(d.po.totalReceived), INK, `จาก ${num(d.po.totalOrdered)} สั่ง`, 20, TEAL);
      tile(g, RX, TY[3], 2.2, TH, "Transfers", num(d.transfer.totalUnits), INK, "ย้ายที่ (units)", 20, BLUE);

      const CX = 2.66, CW = RX - 0.18 - CX;
      const cardW = (CW - 0.18) / 2;
      panel(g, CX, TY[0], cardW, 2.4, "Value by Category (หมวด)");
      if (summary.categories.length)
        barColumn(
          g, CX + 0.15, TY[0] + 0.52, cardW - 0.3, 1.75,
          summary.categories.slice(0, 6).map((c) => c.name.replace(/\s*\(.*\)/, "")),
          summary.categories.slice(0, 6).map((c) => c.value),
          CATS, (v) => "฿" + compact(v)
        );
      const bx = CX + cardW + 0.18;
      panel(g, bx, TY[0], cardW, 2.4, "Time-to-Expiry (อายุคงเหลือ)");
      if (summary.expiry.buckets.length) {
        const bColors = summary.expiry.buckets.map((_, i) => (i < 3 ? RED : i === 3 ? AMBER : TEAL));
        barColumn(
          g, bx + 0.15, TY[0] + 0.52, cardW - 0.3, 1.75,
          summary.expiry.buckets.map((b) => b.label),
          summary.expiry.buckets.map((b) => b.value),
          bColors, (v) => "฿" + compact(v)
        );
      }
      const R2Y = 3.82, R2H = 3.16;
      const gaugeW = 1.9;
      const stW = CW - gaugeW * 2 - 0.18 * 2;
      panel(g, CX, R2Y, stW, R2H, "Storage by Zone (พื้นที่)");
      if (summary.storage.zones.length)
        barRows(
          g, CX + 0.18, R2Y + 0.62, stW - 0.36, R2H - 0.8,
          summary.storage.zones.map((z) => ({
            label: `Zone ${z.name}`, pct: z.pct, color: z.pct >= 85 ? CORAL : z.pct >= 60 ? ORANGE : BLUE, valueText: `${Math.round(z.pct)}%`,
          })),
          1.7, 0.8
        );
      gauge(g, CX + stW + 0.18, R2Y, gaugeW, R2H, "Production Yield (ผลิต)", d.production.yieldPct, TEAL);
      gauge(g, CX + stW + 0.18 + gaugeW + 0.18, R2Y, gaugeW, R2H, "Count Accuracy (นับสต็อก)", d.count.accuracyPct, BLUE);

      // ================= Slide 3: KPIs =================
      const k = newSlide("Key Performance Indicators", "ตัวชี้วัดหลัก", 1);
      const kw = (W - 1.0 - 0.35 * (summary.kpis.length - 1)) / summary.kpis.length;
      const ky = 2.05, kh = 4.15;
      summary.kpis.forEach((kpi, i) => {
        const x = 0.5 + i * (kw + 0.35);
        const acc = kpi.tone === "ok" ? TEAL : ORANGE;
        k.addShape("roundRect", { x, y: ky, w: kw, h: kh, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        k.addShape("roundRect", { x, y: ky, w: kw, h: 0.14, rectRadius: 0.05, fill: { color: acc } });
        k.addShape("rect", { x, y: ky + 0.07, w: kw, h: 0.08, fill: { color: acc } });
        k.addText(kpi.label, { x: x + 0.12, y: ky + 0.42, w: kw - 0.24, h: 0.5, fontSize: 20, bold: true, color: SLATE, align: "center", fontFace: FONT });
        k.addText(kpi.value, { x: x + 0.1, y: ky + 1.25, w: kw - 0.2, h: 1.5, fontSize: 54, bold: true, color: acc, align: "center", valign: "middle", fit: "shrink", fontFace: FONT });
        k.addText(kpi.th, { x: x + 0.14, y: ky + 3.0, w: kw - 0.28, h: 0.5, fontSize: 16, bold: true, color: SLATE, align: "center", fontFace: FONT });
        k.addText(kpi.target, { x: x + 0.14, y: ky + 3.5, w: kw - 0.28, h: 0.55, fontSize: 12, color: MUTE, align: "center", valign: "top", fontFace: FONT });
      });
      k.addText("เขียว = ผ่านเกณฑ์ · ส้ม = เฝ้าระวัง (เทียบกับเป้าหมาย)", { x: 0.5, y: 6.4, w: 12, h: 0.4, fontSize: 13, italic: true, color: MUTE, fontFace: FONT });

      // ================= Divider: Operations Detail (blue) =================
      const dv = pptx.addSlide();
      dv.background = { color: BLUE };
      dv.addShape("ellipse", { x: 9.6, y: -1.8, w: 5.6, h: 5.6, fill: { color: CYAN, transparency: 64 } });
      dv.addShape("ellipse", { x: 11.2, y: 3.2, w: 4.4, h: 4.4, fill: { color: TEAL, transparency: 72 } });
      dv.addShape("rect", { x: 0.8, y: 3.05, w: 0.9, h: 0.09, fill: { color: "FFFFFF" } });
      dv.addText("SECTION 02", { x: 0.8, y: 2.5, w: 10, h: 0.4, fontSize: 14, bold: true, color: "CFEFFF", charSpacing: 3 });
      dv.addText("Operations Detail", { x: 0.78, y: 3.25, w: 11.5, h: 0.9, fontSize: 46, bold: true, color: "FFFFFF" });
      dv.addText("รายละเอียดการดำเนินงาน · ผลิต · ยอดคงเหลือ · Aging · GR · GI · TF · Count · PO", { x: 0.8, y: 4.35, w: 11.8, h: 0.5, fontSize: 16, color: "EAF6FB" });
      if (logo) {
        dv.addShape("roundRect", { x: W - 0.5 - 2.3, y: 0.4, w: 2.3, h: 0.92, rectRadius: 0.1, fill: { color: "FFFFFF" }, shadow: SHADOW });
        dv.addImage({ data: logo, x: W - 0.5 - 2.3 + 0.2, y: 0.56, w: LOGO_W, h: LOGO_H });
      }

      // ================= Detail table slides =================
      const dfmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

      const tableSlide = (
        title: string, th: string, no: number,
        headers: string[], rows: (string | number)[][], weights: number[],
        summaryLine?: string, accent = BLUE
      ) => {
        const totalW = 12.33;
        const wsum = weights.reduce((a, b) => a + b, 0);
        const colW = weights.map((wt) => (wt / wsum) * totalW);
        const BOTTOM = 6.98;
        const MIN_ROWH = 0.4; // comfortable row height that drives pagination

        // Split rows across as many slides as needed (first slide is shorter
        // because of the summary banner). Never cram — spill onto new slides.
        const firstTop = summaryLine ? 2.32 : 2.05;
        const firstCap = Math.max(1, Math.floor((BOTTOM - firstTop) / MIN_ROWH) - 1);
        const contCap = Math.max(1, Math.floor((BOTTOM - 2.05) / MIN_ROWH) - 1);
        const chunks: (string | number)[][][] = [];
        if (rows.length === 0) {
          chunks.push([]);
        } else {
          let i = 0;
          while (i < rows.length) {
            const cap = chunks.length === 0 ? firstCap : contCap;
            chunks.push(rows.slice(i, i + cap));
            i += cap;
          }
        }

        let firstSlide: PptxGenJSLib.Slide | null = null;
        chunks.forEach((chunk, ci) => {
          const contTh = chunks.length > 1 ? `${th} (ต่อ ${ci + 1}/${chunks.length})` : th;
          const s = newSlide(title, contTh, no, accent);
          let top = 2.05;
          if (ci === 0 && summaryLine) {
            s.addShape("roundRect", { x: 0.5, y: 1.58, w: 12.33, h: 0.5, rectRadius: 0.06, fill: { color: BANNER }, line: { color: CARDLINE, width: 1 } });
            s.addText(summaryLine, { x: 0.7, y: 1.58, w: 12, h: 0.5, fontSize: 14, bold: true, color: BLUE, valign: "middle", fontFace: FONT });
            top = 2.32;
          }
          const nRows = Math.max(chunk.length, 1) + 1; // + header
          const avail = BOTTOM - top;
          const rowH = Math.min(0.6, Math.max(MIN_ROWH, avail / nRows));
          const headRow: PptxGenJSLib.TableRow = headers.map((h) => ({
            text: h,
            options: { bold: true, color: "FFFFFF", fill: { color: accent }, fontSize: 13, valign: "middle", fontFace: FONT, margin: [3, 5, 3, 5] as [number, number, number, number] },
          }));
          const bodyRows: PptxGenJSLib.TableRow[] = chunk.length
            ? chunk.map((r, ri) =>
                r.map((c, cix) => ({
                  text: String(c),
                  options: {
                    fontSize: 13,
                    bold: cix === 0,
                    color: cix === 0 ? SLATE : INK,
                    fill: { color: ri % 2 ? PANEL : BANNER },
                    valign: "middle",
                    fontFace: FONT,
                    margin: [2, 5, 2, 5] as [number, number, number, number],
                  },
                }))
              )
            : [[
                {
                  text: "— no data for this period (ไม่มีข้อมูลช่วงนี้) —",
                  options: { fontSize: 12, italic: true, color: MUTE, colspan: headers.length, align: "center" as const, fill: { color: PANEL }, fontFace: FONT },
                },
              ]];
          s.addTable([headRow, ...bodyRows], {
            x: 0.5, y: top, w: totalW, colW,
            border: { type: "solid", color: CARDLINE, pt: 0.5 },
            rowH, valign: "middle",
          });
          if (ci === 0) firstSlide = s;
        });
        return firstSlide as unknown as PptxGenJSLib.Slide;
      };

      tableSlide(
        "Production", "การผลิต — สินค้าที่ผลิต", 2,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot"],
        d.production.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo]),
        [2, 4, 1.8, 1.6, 2],
        `${num(d.production.docCount)} docs   ·   ผลิตได้ ${num(d.production.totalProduced)}   ·   สูญเสีย ${num(d.production.totalProdLoss)}   ·   Yield ${d.production.yieldPct.toFixed(1)}%`,
        TEAL
      );

      tableSlide(
        "On-hand Balances", "ยอดคงเหลือ — เรียงตามมูลค่า", 3,
        ["SAP Material", "Material Description", "On hand", "Value", "Lots"],
        d.balances.map((r) => [r.code, r.name, `${num(r.onHand)} ${r.unit}`, money(r.value), num(r.lotCount)]),
        [2, 4.2, 2, 2.2, 1],
        `มูลค่าคงเหลือรวม ${money(st.inventoryValue)}   ·   ${num(st.skuCount)} SKU   ·   ${num(st.lotCount)} lots`,
        BLUE
      );

      tableSlide(
        "Aging", "อายุสินค้า — ล็อตที่เก่าที่สุด", 4,
        ["SAP Material", "Description", "Lot", "Loc", "On hand", "Age (วัน)", "อายุคงเหลือ (Days left)"],
        d.aging.map((r) => [
          r.code, r.name, r.lotNo, r.location, `${num(r.onHand)} ${r.unit}`,
          num(r.ageDays), r.daysLeft == null ? "— ไม่มีวันหมดอายุ" : r.daysLeft < 0 ? `หมดอายุแล้ว ${Math.abs(r.daysLeft)} วัน` : `${num(r.daysLeft)} วัน`,
        ]),
        [1.9, 2.9, 1.7, 1, 1.5, 1.3, 2.6],
        "เรียงจากล็อตที่รับเข้ามานานที่สุด · อายุคงเหลือ = จำนวนวันก่อนหมดอายุ",
        ORANGE
      );

      tableSlide(
        "GR · Receiving", "รับเข้า", 5,
        ["SAP Material", "Material Description", "Mat.Doc (SAP)", "Date", "Qty", "Lot", "Loc"],
        d.receiving.rows.map((r) => [r.code, r.name, r.materialDoc || "-", dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.location]),
        [1.9, 3.1, 1.7, 1.5, 1.5, 1.7, 0.9],
        `${num(d.receiving.docCount)} docs   ·   รับเข้ารวม ${num(d.receiving.totalUnits)} units`,
        TEAL
      );

      tableSlide(
        "GI · Issuing", "จ่ายออก", 6,
        ["SAP Material", "Material Description", "Mat.Doc (SAP)", "Date", "Qty", "Lot", "Issued To"],
        d.issuing.rows.map((r) => [r.code, r.name, r.materialDoc || "-", dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.issueTo]),
        [1.9, 2.9, 1.7, 1.5, 1.5, 1.7, 1.9],
        `${num(d.issuing.docCount)} docs   ·   จ่ายออกรวม ${num(d.issuing.totalUnits)} units`,
        ORANGE
      );

      tableSlide(
        "TF · Transfers", "ย้ายที่เก็บ", 7,
        ["SAP Material", "Description", "Date", "Qty", "Lot", "From", "To"],
        d.transfer.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.from, r.to]),
        [2, 3, 1.6, 1.5, 1.9, 1.3, 1.3],
        `${num(d.transfer.docCount)} docs   ·   ย้ายรวม ${num(d.transfer.totalUnits)} units`,
        BLUE
      );

      tableSlide(
        "Count · Stock Count", "นับสต็อก", 8,
        ["SAP Material", "Description", "Date", "System", "Counted", "Variance", "Lot"],
        d.count.rows.map((r) => [
          r.code, r.name, dfmt(r.docDate), num(r.sysQty), num(r.countedQty),
          r.variance > 0 ? `+${num(r.variance)}` : num(r.variance), r.lotNo,
        ]),
        [2, 3, 1.6, 1.4, 1.4, 1.5, 2],
        `${num(d.count.docCount)} docs   ·   ${num(d.count.lineCount)} lines   ·   Accuracy ${d.count.accuracyPct.toFixed(1)}%`,
        TEAL
      );

      tableSlide(
        "PO · Purchase Orders", "ใบสั่งซื้อ", 9,
        ["PO No.", "Vendor", "Date", "SAP Material", "Ordered", "Received", "Remaining", "Status"],
        d.po.rows.map((r) => [r.no, r.vendor, dfmt(r.date), r.code, num(r.ordered), num(r.received), num(r.remaining), r.status]),
        [1.8, 2.6, 1.6, 2, 1.3, 1.3, 1.4, 1.4],
        `${num(d.po.docCount)} POs   ·   รับแล้ว ${num(d.po.totalReceived)} / สั่ง ${num(d.po.totalOrdered)}`,
        BLUE
      );

      // ================= SECTION 03: OEE & Packaging =================
      if (oee && (oee.summary.docs > 0 || oee.perLine.length > 0 || oee.pkgUsed.length > 0 || oee.pkgLoss.length > 0)) {
        const o = oee;

        // ---- Divider ----
        const dv3 = pptx.addSlide();
        dv3.background = { color: TEAL };
        dv3.addShape("ellipse", { x: 9.6, y: -1.8, w: 5.6, h: 5.6, fill: { color: CYAN, transparency: 64 } });
        dv3.addShape("ellipse", { x: 11.2, y: 3.2, w: 4.4, h: 4.4, fill: { color: BLUE, transparency: 72 } });
        dv3.addShape("rect", { x: 0.8, y: 3.05, w: 0.9, h: 0.09, fill: { color: "FFFFFF" } });
        dv3.addText("SECTION 03", { x: 0.8, y: 2.5, w: 10, h: 0.4, fontSize: 14, bold: true, color: "CFEFFF", charSpacing: 3 });
        dv3.addText("OEE & Packaging", { x: 0.78, y: 3.25, w: 11.5, h: 0.9, fontSize: 46, bold: true, color: "FFFFFF" });
        dv3.addText("ประสิทธิผลการผลิต · A × P × Q · Downtime · บรรจุภัณฑ์ใช้ไป vs เสีย", { x: 0.8, y: 4.35, w: 11.8, h: 0.5, fontSize: 16, color: "EAF6FB" });
        if (logo) {
          dv3.addShape("roundRect", { x: W - 0.5 - 2.3, y: 0.4, w: 2.3, h: 0.92, rectRadius: 0.1, fill: { color: "FFFFFF" }, shadow: SHADOW });
          dv3.addImage({ data: logo, x: W - 0.5 - 2.3 + 0.2, y: 0.56, w: LOGO_W, h: LOGO_H });
        }

        // ---- OEE overview: 4 gauges + tiles ----
        const os = newSlide("OEE Overview", "ภาพรวมประสิทธิผล · A × P × Q", 3, TEAL);
        const gy = 1.7, gh = 2.7, gw = (12.33 - 0.36) / 4;
        gauge(os, 0.5, gy, gw, gh, "Availability", o.summary.a, BLUE);
        gauge(os, 0.5 + (gw + 0.12), gy, gw, gh, "Performance", o.summary.p, ORANGE);
        gauge(os, 0.5 + (gw + 0.12) * 2, gy, gw, gh, "Quality", o.summary.q, TEAL);
        gauge(os, 0.5 + (gw + 0.12) * 3, gy, gw, gh, "OEE", o.summary.oee, oeeColorHex(o.summary.oee));
        const oy = gy + gh + 0.3, otH = 1.5, otW = (12.33 - 0.6) / 6;
        const otX = (i: number) => 0.5 + i * (otW + 0.12);
        tile(os, otX(0), oy, otW, otH, "รอบที่วัด OEE", `${num(o.summary.scoredRuns)}/${num(o.summary.docs)}`, INK, "runs / docs", 20, BLUE);
        tile(os, otX(1), oy, otW, otH, "ผลิตได้", num(o.summary.produced), TEAL, "units", 20, TEAL);
        tile(os, otX(2), oy, otW, otH, "ของเสีย", num(o.summary.loss), CORAL, "units", 20, CORAL);
        tile(os, otX(3), oy, otW, otH, "Downtime รวม", num(o.downtimeMin), SLATE, "นาที (min)", 20, SLATE);
        tile(os, otX(4), oy, otW, otH, "Repack", num(o.repack), ORANGE, "units", 20, ORANGE);
        tile(os, otX(5), oy, otW, otH, "Scrap", num(o.scrap), CORAL, "units", 20, CORAL);

        // ---- OEE by line ----
        if (o.perLine.length) {
          tableSlide(
            "OEE by Line", "OEE แยกตามสายผลิต", 3,
            ["สายผลิต (Line)", "A%", "P%", "Q%", "OEE%", "Output", "Std (u/hr)"],
            o.perLine.map((l) => [
              l.name || "-", `${l.a}`, `${l.p}`, `${l.q}`, `${l.oee}`, num(l.output), l.standard ? num(l.standard) : "—",
            ]),
            [3.2, 1, 1, 1, 1.2, 1.6, 1.6],
            `${o.perLine.length} สายผลิต · OEE รวม ${o.summary.oee}%`,
            TEAL
          );
        }

        // ---- OEE by shift (กะ) ----
        if (o.perShift.length) {
          tableSlide(
            "OEE by Shift", "OEE แยกตามกะ (per shift)", 3,
            ["กะ (Shift)", "รอบ", "A%", "P%", "Q%", "OEE%", "ผลิต", "ของเสีย", "Downtime"],
            o.perShift.map((sft) => [
              sft.name || "-", num(sft.runs), `${sft.a}`, `${sft.p}`, `${sft.q}`, `${sft.oee}`,
              num(sft.produced), num(sft.loss), `${num(sft.downtimeMin)} น.`,
            ]),
            [3.0, 0.9, 1, 1, 1, 1.2, 1.4, 1.4, 1.4],
            `${o.perShift.length} กะ · OEE รวม ${o.summary.oee}%`,
            BLUE
          );
        }

        // ---- Downtime Pareto (shape bars) ----
        const pareto = [...o.lossPareto].sort((a, b) => b.lostMin - a.lostMin).slice(0, 8);
        const dp = newSlide("Downtime Pareto", "สาเหตุที่ทำให้เสียเวลามากที่สุด", 3, ORANGE);
        if (pareto.length) {
          const maxMin = Math.max(1, ...pareto.map((r) => r.lostMin));
          const panelH = 0.6 + pareto.length * 0.5 + 0.2;
          panel(dp, 0.5, 1.75, 12.33, panelH, "เสียเวลา (นาที) ต่อสาเหตุ — Lost minutes by cause");
          barRows(
            dp, 0.7, 2.35, 11.93, pareto.length * 0.5,
            pareto.map((r) => ({
              label: r.loss || "-", pct: (r.lostMin / maxMin) * 100, color: ORANGE, valueText: `${num(r.lostMin)} น.`,
            })),
            4.2, 1.3
          );
        } else {
          dp.addText("— ไม่มี Downtime ที่บันทึกไว้ในช่วงนี้ —", { x: 0.5, y: 3.2, w: 12.33, h: 0.5, fontSize: 14, italic: true, color: MUTE, align: "center", fontFace: FONT });
        }

        // ---- Packaging — used vs loss ----
        const names = Array.from(new Set([...o.pkgUsed.map((m) => m.name), ...o.pkgLoss.map((m) => m.name)]));
        const usedBy = new Map(o.pkgUsed.map((m) => [m.name, m.qty]));
        const lossBy = new Map(o.pkgLoss.map((m) => [m.name, m.qty]));
        const pkgRows = names
          .map((name) => {
            const used = usedBy.get(name) ?? 0;
            const lost = lossBy.get(name) ?? 0;
            const lossPct = used > 0 ? (lost / used) * 100 : lost > 0 ? 100 : 0;
            return { name, used, lost, lossPct };
          })
          .sort((a, b) => b.used - a.used)
          .map((r) => [
            r.name || "-", num(r.used), num(r.lost), `${r.lossPct.toFixed(1)}%`,
          ]);
        const usedTotal = o.pkgUsed.reduce((s, m) => s + m.qty, 0);
        const lossTotal = o.pkgLoss.reduce((s, m) => s + m.qty, 0);
        tableSlide(
          "Packaging (บรรจุภัณฑ์)", "ใช้ไป vs เสีย · ต่อวัสดุ (used vs loss)", 3,
          ["วัสดุ (Material)", "ใช้ไป (Used)", "เสีย (Loss)", "% เสีย"],
          pkgRows,
          [4.6, 2.4, 2.4, 1.6],
          `ใช้ไปรวม ${num(usedTotal)} · เสียรวม ${num(lossTotal)}${usedTotal > 0 ? ` (${((lossTotal / usedTotal) * 100).toFixed(1)}%)` : ""}`,
          TEAL
        );
      }

      await pptx.writeFile({ fileName: `NBC-Warehouse-Combined-Report-${genDate.replace(/\//g, "-")}.pptx` });
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
      {busy ? "กำลังสร้าง…" : "⬇ Export Report รวม (PowerPoint · ทุกอย่าง+กราฟ)"}
    </button>
  );
}

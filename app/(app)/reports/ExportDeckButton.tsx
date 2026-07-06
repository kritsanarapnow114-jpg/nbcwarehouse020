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
}: {
  summary: ExecutiveSummary;
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
      pptx.title = "NBC Warehouse — Monthly Report";
      pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

      const W = 13.333;
      const CT = pptx.ChartType;
      const cf = { dataLabelFontFace: FONT, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT };
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
        s.addText(label, { x: x + 0.15, y: y + 0.2, w: w - 0.3, h: 0.4, fontSize: 9.5, bold: true, color: SLATE, align: "center", valign: "middle" });
        s.addText(value, { x: x + 0.1, y: y + 0.56, w: w - 0.2, h: h - (sub ? 0.86 : 0.66), fontSize: valueSize, bold: true, color: valueColor, align: "center", valign: "middle", fit: "shrink" });
        if (sub) s.addText(sub, { x: x + 0.12, y: y + h - 0.3, w: w - 0.24, h: 0.26, fontSize: 8, color: MUTE, align: "center" });
      };

      const panel = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, title?: string) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.05, fill: { color: PANEL }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        if (title) s.addText(title, { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.34, fontSize: 12, bold: true, color: SLATE, align: "center" });
      };

      const gauge = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, label: string, pct: number, color = BLUE) => {
        panel(s, x, y, w, h);
        const p = Math.max(0, Math.min(100, pct));
        const size = Math.min(w - 0.4, h - 1.0);
        const cx = x + (w - size) / 2;
        const cy = y + 0.42;
        s.addChart(
          CT.doughnut,
          [{ name: "g", labels: ["value", "rest"], values: [p, 100 - p] }],
          { x: cx, y: cy, w: size, h: size, holeSize: 74, chartColors: [color, TRACK], showLegend: false, showTitle: false, ...cf, showValue: false, showPercent: false, dataBorder: { pt: 0, color: PANEL } }
        );
        s.addText(`${Math.round(p)}%`, { x: cx, y: cy, w: size, h: size, align: "center", valign: "middle", fontSize: 20, bold: true, color: SLATE });
        s.addText(label, { x: x + 0.1, y: y + h - 0.52, w: w - 0.2, h: 0.42, fontSize: 10, bold: true, color: SLATE, align: "center", valign: "middle" });
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
      t.addText("MONTHLY WAREHOUSE REPORT", { x: 0.65, y: 2.35, w: 11, h: 0.4, fontSize: 14, bold: true, color: "CFEFFF", charSpacing: 3 });
      t.addText("NBC Warehouse", { x: 0.6, y: 2.8, w: 11.7, h: 1.0, fontSize: 48, bold: true, color: "FFFFFF" });
      t.addText("Executive Summary · สรุปผู้บริหารคลังสินค้า", { x: 0.63, y: 3.95, w: 11, h: 0.5, fontSize: 20, color: "EAF6FB" });
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
        g.addChart(CT.bar, [{ name: "Value", labels: summary.categories.map((c) => c.name), values: summary.categories.map((c) => c.value) }], {
          x: CX + 0.1, y: TY[0] + 0.5, w: cardW - 0.2, h: 1.8, barDir: "col", chartColors: CATS,
          showValue: false, showLegend: false, showTitle: false, ...cf,
          catAxisLabelColor: SLATE, catAxisLabelFontSize: 7, valAxisLabelColor: MUTE, valAxisLabelFontSize: 7, valGridLine: { style: "dash", color: TRACK, size: 1 }, barGapWidthPct: 40,
        });
      const bx = CX + cardW + 0.18;
      panel(g, bx, TY[0], cardW, 2.4, "Time-to-Expiry (อายุคงเหลือ)");
      if (summary.expiry.buckets.length) {
        const bColors = summary.expiry.buckets.map((_, i) => (i < 3 ? RED : i === 3 ? AMBER : TEAL));
        g.addChart(CT.bar, [{ name: "Value", labels: summary.expiry.buckets.map((b) => b.label), values: summary.expiry.buckets.map((b) => b.value) }], {
          x: bx + 0.1, y: TY[0] + 0.5, w: cardW - 0.2, h: 1.8, barDir: "col", chartColors: bColors,
          showValue: false, showLegend: false, showTitle: false, ...cf,
          catAxisLabelColor: SLATE, catAxisLabelFontSize: 7, valAxisLabelColor: MUTE, valAxisLabelFontSize: 7, valGridLine: { style: "dash", color: TRACK, size: 1 }, barGapWidthPct: 40,
        });
      }
      const R2Y = 3.82, R2H = 3.16;
      const gaugeW = 1.9;
      const stW = CW - gaugeW * 2 - 0.18 * 2;
      panel(g, CX, R2Y, stW, R2H, "Storage by Zone (พื้นที่)");
      if (summary.storage.zones.length)
        g.addChart(CT.bar, [{ name: "Utilization %", labels: summary.storage.zones.map((z) => `Zone ${z.name}`), values: summary.storage.zones.map((z) => z.pct) }], {
          x: CX + 0.12, y: R2Y + 0.5, w: stW - 0.24, h: R2H - 0.65, barDir: "bar", chartColors: [BLUE],
          showValue: true, dataLabelColor: SLATE, dataLabelFontSize: 8, dataLabelFontBold: true,
          valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelColor: MUTE, valAxisLabelFontSize: 7, catAxisLabelColor: SLATE, catAxisLabelFontSize: 8,
          showLegend: false, showTitle: false, ...cf, valGridLine: { style: "dash", color: TRACK, size: 1 }, barGapWidthPct: 45,
        });
      gauge(g, CX + stW + 0.18, R2Y, gaugeW, R2H, "Production Yield (ผลิต)", d.production.yieldPct, TEAL);
      gauge(g, CX + stW + 0.18 + gaugeW + 0.18, R2Y, gaugeW, R2H, "Count Accuracy (นับสต็อก)", d.count.accuracyPct, BLUE);

      // ================= Slide 3: KPIs =================
      const k = newSlide("Key Performance Indicators", "ตัวชี้วัดหลัก", 1);
      const kw = (W - 1.0 - 0.35 * (summary.kpis.length - 1)) / summary.kpis.length;
      summary.kpis.forEach((kpi, i) => {
        const x = 0.5 + i * (kw + 0.35);
        const acc = kpi.tone === "ok" ? TEAL : ORANGE;
        tile(k, x, 2.1, kw, 4.05, kpi.label, kpi.value, acc, `${kpi.th} · เป้าหมาย ${kpi.target}`, 40, acc);
      });
      k.addText("เขียว = ผ่านเกณฑ์ · ส้ม = เฝ้าระวัง (เทียบกับเป้าหมาย)", { x: 0.5, y: 6.35, w: 12, h: 0.4, fontSize: 12.5, italic: true, color: MUTE });

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
        const s = newSlide(title, th, no, accent);
        let top = 2.05;
        if (summaryLine) {
          s.addShape("roundRect", { x: 0.5, y: 1.58, w: 12.33, h: 0.5, rectRadius: 0.06, fill: { color: BANNER }, line: { color: CARDLINE, width: 1 } });
          s.addText(summaryLine, { x: 0.7, y: 1.58, w: 12, h: 0.5, fontSize: 12.5, bold: true, color: BLUE, valign: "middle", fontFace: FONT });
          top = 2.32;
        }
        const totalW = 12.33;
        const wsum = weights.reduce((a, b) => a + b, 0);
        const colW = weights.map((wt) => (wt / wsum) * totalW);
        // Grow the rows to fill the slide so there's no big empty gap below.
        const nRows = Math.max(rows.length, 1) + 1; // + header
        const avail = 6.98 - top;
        const rowH = Math.min(0.7, Math.max(0.3, avail / nRows));
        const headRow: PptxGenJSLib.TableRow = headers.map((h) => ({
          text: h,
          options: { bold: true, color: "FFFFFF", fill: { color: accent }, fontSize: 12, valign: "middle", fontFace: FONT, margin: [3, 5, 3, 5] as [number, number, number, number] },
        }));
        const bodyRows: PptxGenJSLib.TableRow[] = rows.length
          ? rows.map((r, ri) =>
              r.map((c, ci) => ({
                text: String(c),
                options: {
                  fontSize: 11.5,
                  bold: ci === 0,
                  color: ci === 0 ? SLATE : INK,
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
        return s;
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
        ["SAP Material", "Material Description", "Date", "Qty", "Lot", "Loc"],
        d.receiving.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.location]),
        [2, 3.6, 1.8, 1.6, 2, 1],
        `${num(d.receiving.docCount)} docs   ·   รับเข้ารวม ${num(d.receiving.totalUnits)} units`,
        TEAL
      );

      tableSlide(
        "GI · Issuing", "จ่ายออก", 6,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot", "Issued To"],
        d.issuing.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.issueTo]),
        [2, 3.4, 1.8, 1.6, 2, 2],
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

      await pptx.writeFile({ fileName: `NBC-Warehouse-Monthly-Report-${genDate.replace(/\//g, "-")}.pptx` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-[8px] border border-[#1e9e5e] bg-[#eaf7f0] px-3.5 py-2 text-[12.5px] font-semibold text-[#12894f] disabled:opacity-60"
    >
      {busy ? "กำลังสร้าง…" : "⬇ Export PowerPoint (สรุปเป็นสไลด์)"}
    </button>
  );
}

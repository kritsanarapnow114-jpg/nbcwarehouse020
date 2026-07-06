"use client";

import { useState } from "react";
import type PptxGenJSLib from "pptxgenjs";
import type { ExecutiveSummary } from "@/lib/views/summary";

// ---- Brand palette ------------------------------------------------------
const GREEN = "3E9B6E";
const GREEN_D = "2C6E49";
const GREEN_L = "8FE3B8";
const INK = "16202E";
const SLATE = "3A4658";
const GRAY = "69748A";
const MUTE = "9AA4B4";
const CREAM = "F7FAF9";
const PANEL = "FFFFFF";
const LIGHT = "F1F5F8";
const TRACK = "E4EAF0";
const OK = "17935A";
const TEAL = "2FA5A0";
const GOLD = "E6A532";
const ORANGE = "E5793A";
const RED = "C53F3F";
const PALETTE = [GREEN, TEAL, GOLD, ORANGE, "6C8CD5", "9B6CD5", RED, MUTE];

const money = (v: number) => "฿" + Math.round(v).toLocaleString();
const num = (v: number) => Math.round(v).toLocaleString();

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
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
      pptx.layout = "WIDE";
      pptx.author = "NBC Warehouse";
      pptx.title = "NBC Warehouse — Executive Summary";

      const W = 13.333;
      const CT = pptx.ChartType;
      const genDate = new Date().toLocaleDateString("en-GB");
      let page = 0;

      const SHADOW: PptxGenJSLib.ShadowProps = {
        type: "outer",
        color: "8496A8",
        opacity: 0.28,
        blur: 6,
        offset: 2,
        angle: 90,
      };

      // ---- Reusable chrome ------------------------------------------------
      const footer = (s: PptxGenJSLib.Slide) => {
        page += 1;
        s.addShape("line", { x: 0.5, y: 7.12, w: 12.33, h: 0, line: { color: TRACK, width: 1 } });
        s.addText("NBC Warehouse · สรุปผู้บริหารคลังสินค้า", { x: 0.5, y: 7.14, w: 6, h: 0.3, fontSize: 8, color: MUTE, valign: "middle" });
        s.addText("CONFIDENTIAL", { x: W / 2 - 1.5, y: 7.14, w: 3, h: 0.3, fontSize: 8, color: MUTE, align: "center", valign: "middle", charSpacing: 2 });
        s.addText(String(page), { x: W - 1.0, y: 7.14, w: 0.5, h: 0.3, fontSize: 8.5, bold: true, color: GRAY, align: "right", valign: "middle" });
      };

      const header = (s: PptxGenJSLib.Slide, title: string, th: string, no: number) => {
        s.background = { color: CREAM };
        s.addShape("rect", { x: 0, y: 0, w: W, h: 0.98, fill: { color: INK } });
        s.addShape("rect", { x: 0, y: 0.98, w: W, h: 0.06, fill: { color: GREEN } });
        // section-number chip
        s.addShape("roundRect", { x: 0.5, y: 0.24, w: 0.52, h: 0.52, rectRadius: 0.1, fill: { color: GREEN } });
        s.addText(String(no).padStart(2, "0"), { x: 0.5, y: 0.24, w: 0.52, h: 0.52, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
        s.addText(title, { x: 1.2, y: 0.16, w: 8.2, h: 0.44, fontSize: 21, bold: true, color: "FFFFFF", valign: "middle" });
        s.addText(th, { x: 1.2, y: 0.58, w: 8.2, h: 0.3, fontSize: 11, color: "AEBBC8", valign: "middle" });
        // period pill
        s.addShape("roundRect", { x: W - 4.2, y: 0.3, w: 3.7, h: 0.42, rectRadius: 0.21, fill: { color: GREEN } });
        s.addText(periodLabel, { x: W - 4.2, y: 0.3, w: 3.7, h: 0.42, fontSize: 10, color: "FFFFFF", align: "center", valign: "middle" });
        footer(s);
      };

      const newSlide = (title: string, th: string, no: number) => {
        const s = pptx.addSlide();
        header(s, title, th, no);
        return s;
      };

      const divider = (kicker: string, title: string, th: string) => {
        const s = pptx.addSlide();
        s.background = { color: INK };
        s.addShape("ellipse", { x: 9.7, y: -1.6, w: 5.2, h: 5.2, fill: { color: GREEN, transparency: 80 } });
        s.addShape("ellipse", { x: 11.2, y: 3.4, w: 4.2, h: 4.2, fill: { color: TEAL, transparency: 84 } });
        s.addShape("rect", { x: 0.8, y: 3.05, w: 0.8, h: 0.09, fill: { color: GREEN } });
        s.addText(kicker, { x: 0.8, y: 2.5, w: 10, h: 0.4, fontSize: 13, bold: true, color: GREEN_L, charSpacing: 3 });
        s.addText(title, { x: 0.8, y: 3.25, w: 11, h: 0.9, fontSize: 40, bold: true, color: "FFFFFF" });
        s.addText(th, { x: 0.8, y: 4.25, w: 11, h: 0.5, fontSize: 18, color: "AEBBC8" });
        footer(s);
        return s;
      };

      const tile = (
        s: PptxGenJSLib.Slide,
        x: number, y: number, w: number, h: number,
        label: string, value: string, color = INK, sub?: string, accent = color
      ) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.07, fill: { color: PANEL }, line: { color: TRACK, width: 1 }, shadow: SHADOW });
        s.addShape("roundRect", { x, y, w: 0.11, h, rectRadius: 0.05, fill: { color: accent } });
        s.addText(label, { x: x + 0.26, y: y + 0.16, w: w - 0.46, h: 0.34, fontSize: 10.5, color: GRAY });
        s.addText(value, { x: x + 0.24, y: y + 0.5, w: w - 0.42, h: 0.62, fontSize: 24, bold: true, color });
        if (sub) s.addText(sub, { x: x + 0.26, y: y + h - 0.42, w: w - 0.46, h: 0.32, fontSize: 9, color: MUTE });
      };

      const bar = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, pct: number, color = GREEN) => {
        s.addShape("roundRect", { x, y, w, h: 0.16, rectRadius: 0.08, fill: { color: TRACK } });
        const fw = Math.max(0.03, (Math.min(100, Math.max(0, pct)) / 100) * w);
        s.addShape("roundRect", { x, y, w: fw, h: 0.16, rectRadius: 0.08, fill: { color } });
      };

      const panel = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, title?: string) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.07, fill: { color: PANEL }, line: { color: TRACK, width: 1 }, shadow: SHADOW });
        if (title) s.addText(title, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.35, fontSize: 13, bold: true, color: INK });
      };

      // ---- Slide 1: Title -------------------------------------------------
      const t = pptx.addSlide();
      t.background = { color: CREAM };
      t.addShape("rect", { x: 0, y: 0, w: W, h: 4.75, fill: { color: INK } });
      t.addShape("ellipse", { x: 9.4, y: -1.9, w: 5.6, h: 5.6, fill: { color: GREEN, transparency: 78 } });
      t.addShape("ellipse", { x: 11.1, y: 1.6, w: 4.2, h: 4.2, fill: { color: TEAL, transparency: 84 } });
      t.addShape("rect", { x: 0, y: 4.75, w: W, h: 0.13, fill: { color: GREEN } });
      t.addText("WAREHOUSE MANAGEMENT REPORT", { x: 0.8, y: 0.85, w: 11, h: 0.4, fontSize: 13, bold: true, color: GREEN_L, charSpacing: 4 });
      t.addText("NBC Warehouse", { x: 0.78, y: 1.35, w: 11, h: 0.9, fontSize: 42, bold: true, color: "FFFFFF" });
      t.addText("Executive Summary · สรุปผู้บริหารคลังสินค้า", { x: 0.8, y: 2.5, w: 11, h: 0.6, fontSize: 20, color: "EAF6EF" });
      t.addShape("roundRect", { x: 0.8, y: 3.35, w: 5.3, h: 0.5, rectRadius: 0.25, fill: { color: GREEN } });
      t.addText(`ช่วงข้อมูล (Period):  ${periodLabel}`, { x: 0.8, y: 3.35, w: 5.3, h: 0.5, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      tile(t, 0.8, 5.25, 3.75, 1.55, "Inventory Value (มูลค่าคงเหลือ)", money(summary.stats.inventoryValue), GREEN, `${num(summary.stats.skuCount)} SKU · ${num(summary.stats.lotCount)} lots`, GREEN);
      tile(t, 4.79, 5.25, 3.75, 1.55, "Received (รับเข้า)", num(summary.stats.receivedUnits), OK, "units this period", OK);
      tile(t, 8.78, 5.25, 3.75, 1.55, "Issued (จ่ายออก)", num(summary.stats.issuedUnits), ORANGE, "units this period", ORANGE);
      t.addText(`Generated: ${genDate}`, { x: W - 4, y: 6.95, w: 3.5, h: 0.3, fontSize: 9.5, color: MUTE, align: "right" });

      // ===== SECTION 1: OVERVIEW ==========================================
      divider("SECTION 01", "Executive Overview", "ภาพรวมสำหรับผู้บริหาร");

      // ---- KPIs -----------------------------------------------------------
      const k = newSlide("Key Performance Indicators", "ตัวชี้วัดหลัก", 1);
      const kw = (W - 1.0 - 0.35 * (summary.kpis.length - 1)) / summary.kpis.length;
      summary.kpis.forEach((kpi, i) => {
        const x = 0.5 + i * (kw + 0.35);
        const tone = kpi.tone === "ok" ? OK : GOLD;
        tile(k, x, 1.9, kw, 2.5, `${kpi.label}`, kpi.value, tone, kpi.target, tone);
        k.addText(kpi.th, { x: x + 0.26, y: 2.28, w: kw - 0.5, h: 0.3, fontSize: 9.5, color: MUTE });
      });
      k.addText("เทียบกับเป้าหมาย (vs target) — เขียว = ผ่านเกณฑ์, เหลือง = เฝ้าระวัง", { x: 0.5, y: 4.7, w: 12, h: 0.4, fontSize: 11, italic: true, color: GRAY });

      // ---- Inventory overview --------------------------------------------
      const inv = newSlide("Inventory Overview", "ภาพรวมสต็อก", 2);
      const cells: [string, string, string][] = [
        ["Inventory Value (มูลค่าคงเหลือ)", money(summary.stats.inventoryValue), GREEN],
        ["SKU count (จำนวนสินค้า)", num(summary.stats.skuCount), TEAL],
        ["Lots on hand (ล็อตคงเหลือ)", num(summary.stats.lotCount), INK],
        ["Received (รับเข้าช่วงนี้)", num(summary.stats.receivedUnits), OK],
        ["Issued (จ่ายออกช่วงนี้)", num(summary.stats.issuedUnits), ORANGE],
        ["Loss value (มูลค่าสูญเสีย)", money(summary.stats.lossValue), RED],
      ];
      cells.forEach((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        tile(inv, 0.5 + col * 4.15, 1.9 + row * 2.35, 3.9, 2.05, c[0], c[1], c[2], undefined, c[2]);
      });

      // ---- Storage --------------------------------------------------------
      const st = newSlide("Storage Utilization", "การใช้พื้นที่จัดเก็บ", 3);
      tile(st, 0.5, 1.85, 3.6, 1.5, "Total utilization (รวมทุกโซน)", `${summary.storage.totalPct}%`, GREEN, `${num(summary.storage.totalUsed)} / ${num(summary.storage.totalCap)} m²`, GREEN);
      panel(st, 4.35, 1.85, 8.45, 4.9, "By zone (แยกตามโซน)");
      if (summary.storage.zones.length) {
        st.addChart(
          CT.bar,
          [{ name: "Utilization %", labels: summary.storage.zones.map((z) => `Zone ${z.name}`), values: summary.storage.zones.map((z) => z.pct) }],
          {
            x: 4.55, y: 2.45, w: 8.05, h: 4.15, barDir: "bar", chartColors: [GREEN],
            showValue: true, dataLabelPosition: "outEnd", dataLabelColor: SLATE, dataLabelFontSize: 10, dataLabelFontBold: true,
            valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelColor: MUTE, valAxisLabelFontSize: 9,
            catAxisLabelColor: SLATE, catAxisLabelFontSize: 10, showLegend: false, showTitle: false,
            barGapWidthPct: 45, valGridLine: { style: "dash", color: TRACK, size: 1 },
          }
        );
      }
      // total bar under the tile
      bar(st, 0.5, 3.65, 3.6, summary.storage.totalPct);

      // ---- Value by category (doughnut) ----------------------------------
      const cat = newSlide("Inventory Value by Category", "มูลค่าตามหมวดหมู่", 4);
      panel(cat, 0.5, 1.85, 6.3, 4.9);
      if (summary.categories.length) {
        cat.addChart(
          CT.doughnut,
          [{ name: "Value", labels: summary.categories.map((c) => c.name), values: summary.categories.map((c) => c.value) }],
          {
            x: 0.6, y: 2.0, w: 6.1, h: 4.6, holeSize: 58, chartColors: PALETTE,
            showLegend: true, legendPos: "b", legendColor: SLATE, legendFontSize: 10,
            showValue: false, showPercent: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 10, dataLabelFontBold: true,
            showTitle: false,
          }
        );
      }
      panel(cat, 7.05, 1.85, 5.75, 4.9, "Ranked (มูลค่าเรียงจากมากไปน้อย)");
      const catMax = Math.max(1, ...summary.categories.map((c) => c.value));
      summary.categories.forEach((c, i) => {
        const y = 2.55 + i * 0.82;
        cat.addShape("roundRect", { x: 7.3, y: y - 0.02, w: 0.16, h: 0.16, rectRadius: 0.04, fill: { color: PALETTE[i % PALETTE.length] } });
        cat.addText(c.name, { x: 7.6, y: y - 0.05, w: 3.2, h: 0.3, fontSize: 11, color: SLATE });
        cat.addText(money(c.value), { x: 10.4, y: y - 0.05, w: 2.2, h: 0.3, fontSize: 11, bold: true, color: GREEN, align: "right" });
        bar(cat, 7.3, y + 0.3, 5.25, (c.value / catMax) * 100, PALETTE[i % PALETTE.length]);
      });

      // ---- Expiry risk ----------------------------------------------------
      const ex = newSlide("Value by Time-to-Expiry", "มูลค่าตามอายุคงเหลือ", 5);
      tile(ex, 0.5, 1.85, 3.6, 1.55, "At risk ≤90d (เสี่ยงหมดอายุ)", money(summary.expiry.atRiskValue), RED, "value expiring soon", RED);
      panel(ex, 4.35, 1.85, 8.45, 4.9, "Value by bucket (มูลค่าตามช่วงอายุ)");
      if (summary.expiry.buckets.length) {
        const bColors = summary.expiry.buckets.map((_, i) => (i < 3 ? RED : i === 3 ? GOLD : GREEN));
        ex.addChart(
          CT.bar,
          [{ name: "Value", labels: summary.expiry.buckets.map((b) => `${b.label} (${b.count})`), values: summary.expiry.buckets.map((b) => b.value) }],
          {
            x: 4.55, y: 2.45, w: 8.05, h: 4.15, barDir: "col", chartColors: bColors,
            showValue: false, valAxisLabelColor: MUTE, valAxisLabelFontSize: 9,
            catAxisLabelColor: SLATE, catAxisLabelFontSize: 9.5, showLegend: false, showTitle: false,
            barGapWidthPct: 40, valGridLine: { style: "dash", color: TRACK, size: 1 },
          }
        );
      }

      // ---- Top movement (two bar charts) ---------------------------------
      const mv = newSlide("Top Movement", "ความเคลื่อนไหวสูงสุด", 6);
      panel(mv, 0.5, 1.85, 6.05, 4.9, "Received (รับเข้า)");
      if (summary.movement.received.length) {
        mv.addChart(
          CT.bar,
          [{ name: "Received", labels: summary.movement.received.map((r) => r.code), values: summary.movement.received.map((r) => r.qty) }],
          {
            x: 0.7, y: 2.5, w: 5.65, h: 4.1, barDir: "bar", chartColors: [OK],
            showValue: true, dataLabelPosition: "outEnd", dataLabelColor: SLATE, dataLabelFontSize: 9, dataLabelFontBold: true,
            valAxisHidden: true, catAxisLabelColor: SLATE, catAxisLabelFontSize: 9, showLegend: false, showTitle: false, barGapWidthPct: 40,
          }
        );
      } else mv.addText("— no data —", { x: 0.7, y: 3.5, w: 5, h: 0.3, fontSize: 11, color: MUTE });
      panel(mv, 6.75, 1.85, 6.05, 4.9, "Issued (จ่ายออก)");
      if (summary.movement.issued.length) {
        mv.addChart(
          CT.bar,
          [{ name: "Issued", labels: summary.movement.issued.map((r) => r.code), values: summary.movement.issued.map((r) => r.qty) }],
          {
            x: 6.95, y: 2.5, w: 5.65, h: 4.1, barDir: "bar", chartColors: [ORANGE],
            showValue: true, dataLabelPosition: "outEnd", dataLabelColor: SLATE, dataLabelFontSize: 9, dataLabelFontBold: true,
            valAxisHidden: true, catAxisLabelColor: SLATE, catAxisLabelFontSize: 9, showLegend: false, showTitle: false, barGapWidthPct: 40,
          }
        );
      } else mv.addText("— no data —", { x: 6.95, y: 3.5, w: 5, h: 0.3, fontSize: 11, color: MUTE });

      // ===== SECTION 2: OPERATIONS DETAIL =================================
      divider("SECTION 02", "Operations Detail", "รายละเอียดการดำเนินงาน");

      const dfmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

      const tableSlide = (
        title: string, th: string, no: number,
        headers: string[], rows: (string | number)[][], weights: number[],
        summaryLine?: string
      ) => {
        const s = newSlide(title, th, no);
        let top = 1.75;
        if (summaryLine) {
          s.addShape("roundRect", { x: 0.5, y: 1.4, w: 12.33, h: 0.42, rectRadius: 0.08, fill: { color: "EAF6EF" }, line: { color: "CDEBD9", width: 1 } });
          s.addText(summaryLine, { x: 0.7, y: 1.4, w: 12, h: 0.42, fontSize: 11, bold: true, color: GREEN_D, valign: "middle" });
          top = 2.0;
        }
        const totalW = 12.33;
        const wsum = weights.reduce((a, b) => a + b, 0);
        const colW = weights.map((wt) => (wt / wsum) * totalW);
        const headRow: PptxGenJSLib.TableRow = headers.map((h) => ({
          text: h,
          options: { bold: true, color: "FFFFFF", fill: { color: INK }, fontSize: 10, valign: "middle", margin: [3, 4, 3, 4] as [number, number, number, number] },
        }));
        const bodyRows: PptxGenJSLib.TableRow[] = rows.length
          ? rows.map((r, ri) =>
              r.map((c, ci) => ({
                text: String(c),
                options: {
                  fontSize: 9.5,
                  bold: ci === 0,
                  color: ci === 0 ? INK : SLATE,
                  fill: { color: ri % 2 ? PANEL : LIGHT },
                  valign: "middle",
                  margin: [2, 4, 2, 4] as [number, number, number, number],
                },
              }))
            )
          : [[
              {
                text: "— no data for this period (ไม่มีข้อมูลช่วงนี้) —",
                options: { fontSize: 10, italic: true, color: MUTE, colspan: headers.length, align: "center" as const, fill: { color: PANEL } },
              },
            ]];
        s.addTable([headRow, ...bodyRows], {
          x: 0.5, y: top, w: totalW, colW,
          border: { type: "solid", color: TRACK, pt: 0.5 },
          rowH: 0.3, valign: "middle",
        });
        return s;
      };

      const d = summary.detail;

      tableSlide(
        "Production", "การผลิต — สินค้าที่ผลิต", 7,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot"],
        d.production.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo]),
        [2, 4, 1.8, 1.6, 2],
        `${num(d.production.docCount)} docs   ·   ผลิตได้ ${num(d.production.totalProduced)}   ·   สูญเสีย ${num(d.production.totalProdLoss)}   ·   Yield ${d.production.yieldPct.toFixed(1)}%`
      );

      tableSlide(
        "On-hand Balances", "ยอดคงเหลือ — เรียงตามมูลค่า", 8,
        ["SAP Material", "Material Description", "On hand", "Value", "Lots"],
        d.balances.map((r) => [r.code, r.name, `${num(r.onHand)} ${r.unit}`, money(r.value), num(r.lotCount)]),
        [2, 4.2, 2, 2.2, 1],
        `มูลค่าคงเหลือรวม ${money(summary.stats.inventoryValue)}   ·   ${num(summary.stats.skuCount)} SKU   ·   ${num(summary.stats.lotCount)} lots`
      );

      tableSlide(
        "Aging", "อายุสินค้า — ล็อตที่เก่าที่สุด", 9,
        ["SAP Material", "Description", "Lot", "Loc", "On hand", "Age (days)", "Expiry"],
        d.aging.map((r) => [r.code, r.name, r.lotNo, r.location, `${num(r.onHand)} ${r.unit}`, num(r.ageDays), r.expLabel]),
        [2, 3.2, 1.8, 1, 1.6, 1.4, 2],
        "เรียงจากล็อตที่รับเข้ามานานที่สุด (received longest ago)"
      );

      tableSlide(
        "GR · Receiving", "รับเข้า", 10,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot", "Loc"],
        d.receiving.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.location]),
        [2, 3.6, 1.8, 1.6, 2, 1],
        `${num(d.receiving.docCount)} docs   ·   รับเข้ารวม ${num(d.receiving.totalUnits)} units`
      );

      tableSlide(
        "GI · Issuing", "จ่ายออก", 11,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot", "Issued To"],
        d.issuing.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.issueTo]),
        [2, 3.4, 1.8, 1.6, 2, 2],
        `${num(d.issuing.docCount)} docs   ·   จ่ายออกรวม ${num(d.issuing.totalUnits)} units`
      );

      tableSlide(
        "TF · Transfers", "ย้ายที่เก็บ", 12,
        ["SAP Material", "Description", "Date", "Qty", "Lot", "From", "To"],
        d.transfer.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.from, r.to]),
        [2, 3, 1.6, 1.5, 1.9, 1.3, 1.3],
        `${num(d.transfer.docCount)} docs   ·   ย้ายรวม ${num(d.transfer.totalUnits)} units`
      );

      tableSlide(
        "Count · Stock Count", "นับสต็อก", 13,
        ["SAP Material", "Description", "Date", "System", "Counted", "Variance", "Lot"],
        d.count.rows.map((r) => [
          r.code, r.name, dfmt(r.docDate), num(r.sysQty), num(r.countedQty),
          r.variance > 0 ? `+${num(r.variance)}` : num(r.variance), r.lotNo,
        ]),
        [2, 3, 1.6, 1.4, 1.4, 1.5, 2],
        `${num(d.count.docCount)} docs   ·   ${num(d.count.lineCount)} lines   ·   Accuracy ${d.count.accuracyPct.toFixed(1)}%`
      );

      tableSlide(
        "PO · Purchase Orders", "ใบสั่งซื้อ", 14,
        ["PO No.", "Vendor", "Date", "SAP Material", "Ordered", "Received", "Remaining", "Status"],
        d.po.rows.map((r) => [r.no, r.vendor, dfmt(r.date), r.code, num(r.ordered), num(r.received), num(r.remaining), r.status]),
        [1.8, 2.6, 1.6, 2, 1.3, 1.3, 1.4, 1.4],
        `${num(d.po.docCount)} POs   ·   รับแล้ว ${num(d.po.totalReceived)} / สั่ง ${num(d.po.totalOrdered)}`
      );

      await pptx.writeFile({ fileName: `NBC-Warehouse-Summary-${genDate.replace(/\//g, "-")}.pptx` });
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

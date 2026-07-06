"use client";

import { useState } from "react";
import type PptxGenJSLib from "pptxgenjs";
import type { ExecutiveSummary } from "@/lib/views/summary";

// ---- Dark "dashboard" palette (navy + light-blue tiles + aqua accents) ----
const NAVY = "0C2A43"; // page background
const NAVY2 = "123A5A"; // alt table row / inner fill
const CARD = "0E3450"; // card / tile body
const CARDLINE = "2E5C80"; // card border
const BANNER = "8FCBEA"; // light-blue tile header
const BANNER_TX = "0C2A43"; // dark text on the banner
const AQUA = "35A7C0"; // accent / gauge value
const AQUA_TRK = "17456A"; // gauge remainder track
const BLUE_L = "9AD3EF";
const BLUE_M = "3E86B4";
const BLUE_D = "1C5E8C";
const WHITE = "FFFFFF";
const TXT = "D7E5F0"; // light body text
const MUTE = "8CA3B8";
const AMBER = "E0A33E";
const RED = "D9534F";
const CATS = [BLUE_L, AQUA, BLUE_M, BLUE_D, "6FB6D9", "2C7CA8"];

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
      const v3d = { v3DRotX: 14, v3DRotY: 20, v3DPerspective: 40, v3DRAngAx: false };
      const genDate = new Date().toLocaleDateString("en-GB");
      let page = 0;

      const SHADOW: PptxGenJSLib.ShadowProps = {
        type: "outer", color: "05121F", opacity: 0.5, blur: 6, offset: 2, angle: 90,
      };

      // ---- Chrome ---------------------------------------------------------
      const footer = (s: PptxGenJSLib.Slide) => {
        page += 1;
        s.addShape("line", { x: 0.5, y: 7.12, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        s.addText("NBC Warehouse · สรุปผู้บริหารคลังสินค้า", { x: 0.5, y: 7.14, w: 6, h: 0.3, fontSize: 8, color: MUTE, valign: "middle" });
        s.addText("CONFIDENTIAL", { x: W / 2 - 1.5, y: 7.14, w: 3, h: 0.3, fontSize: 8, color: MUTE, align: "center", valign: "middle", charSpacing: 2 });
        s.addText(String(page), { x: W - 1.0, y: 7.14, w: 0.5, h: 0.3, fontSize: 8.5, bold: true, color: BLUE_L, align: "right", valign: "middle" });
      };

      const header = (s: PptxGenJSLib.Slide, title: string, th: string, no: number) => {
        s.background = { color: NAVY };
        s.addShape("roundRect", { x: 0.5, y: 0.3, w: 0.52, h: 0.52, rectRadius: 0.1, fill: { color: AQUA } });
        s.addText(String(no).padStart(2, "0"), { x: 0.5, y: 0.3, w: 0.52, h: 0.52, fontSize: 15, bold: true, color: NAVY, align: "center", valign: "middle" });
        s.addText(title, { x: 1.2, y: 0.24, w: 8.2, h: 0.44, fontSize: 22, bold: true, color: WHITE, valign: "middle" });
        s.addText(th, { x: 1.2, y: 0.66, w: 8.2, h: 0.3, fontSize: 11, color: BLUE_L, valign: "middle" });
        s.addShape("roundRect", { x: W - 4.2, y: 0.36, w: 3.7, h: 0.42, rectRadius: 0.21, fill: { color: AQUA } });
        s.addText(periodLabel, { x: W - 4.2, y: 0.36, w: 3.7, h: 0.42, fontSize: 10, color: NAVY, bold: true, align: "center", valign: "middle" });
        s.addShape("line", { x: 0.5, y: 1.02, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
        footer(s);
      };

      const newSlide = (title: string, th: string, no: number) => {
        const s = pptx.addSlide();
        header(s, title, th, no);
        return s;
      };

      // Banner-style KPI tile (light-blue header + dark body), the reference look.
      const tile = (
        s: PptxGenJSLib.Slide,
        x: number, y: number, w: number, h: number,
        label: string, value: string, valueColor = WHITE, sub?: string, valueSize = 20
      ) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: CARD }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        s.addShape("roundRect", { x, y, w, h: 0.48, rectRadius: 0.06, fill: { color: BANNER } });
        s.addShape("rect", { x, y: y + 0.24, w, h: 0.24, fill: { color: BANNER } });
        s.addText(label, { x: x + 0.08, y: y + 0.02, w: w - 0.16, h: 0.44, fontSize: 9.5, bold: true, color: BANNER_TX, align: "center", valign: "middle" });
        s.addText(value, { x: x + 0.08, y: y + 0.52, w: w - 0.16, h: h - (sub ? 0.82 : 0.6), fontSize: valueSize, bold: true, color: valueColor, align: "center", valign: "middle", fit: "shrink" });
        if (sub) s.addText(sub, { x: x + 0.08, y: y + h - 0.3, w: w - 0.16, h: 0.26, fontSize: 8, color: MUTE, align: "center" });
      };

      const panel = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, title?: string) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: CARD }, line: { color: CARDLINE, width: 1 }, shadow: SHADOW });
        if (title) s.addText(title, { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.34, fontSize: 12, bold: true, color: WHITE, align: "center" });
      };

      // Donut gauge (like the reference Engagement / Effectiveness rings).
      const gauge = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, h: number, label: string, pct: number, color = AQUA) => {
        panel(s, x, y, w, h);
        const p = Math.max(0, Math.min(100, pct));
        const size = Math.min(w - 0.4, h - 1.0);
        const cx = x + (w - size) / 2;
        const cy = y + 0.42;
        s.addChart(
          CT.doughnut,
          [{ name: "g", labels: ["value", "rest"], values: [p, 100 - p] }],
          { x: cx, y: cy, w: size, h: size, holeSize: 72, chartColors: [color, AQUA_TRK], showLegend: false, showTitle: false, showValue: false, showPercent: false, dataBorder: { pt: 0, color: NAVY } }
        );
        s.addText(`${Math.round(p)}%`, { x: cx, y: cy, w: size, h: size, align: "center", valign: "middle", fontSize: 20, bold: true, color: WHITE });
        s.addText(label, { x: x + 0.1, y: y + h - 0.52, w: w - 0.2, h: 0.42, fontSize: 10, bold: true, color: TXT, align: "center", valign: "middle" });
      };

      const st = summary.stats;
      const d = summary.detail;

      // ================= Slide 1: Title =================
      const t = pptx.addSlide();
      t.background = { color: NAVY };
      t.addShape("rect", { x: 0, y: 0, w: W, h: 0.18, fill: { color: AQUA } });
      t.addText("WAREHOUSE MANAGEMENT REPORT", { x: 0.8, y: 1.4, w: 11, h: 0.4, fontSize: 13, bold: true, color: BLUE_L, charSpacing: 4 });
      t.addText("NBC Warehouse", { x: 0.78, y: 1.85, w: 11.7, h: 1.0, fontSize: 46, bold: true, color: WHITE });
      t.addText("Executive Summary · สรุปผู้บริหารคลังสินค้า", { x: 0.8, y: 3.0, w: 11.7, h: 0.6, fontSize: 20, color: TXT });
      t.addShape("roundRect", { x: 0.8, y: 3.75, w: 5.5, h: 0.5, rectRadius: 0.25, fill: { color: AQUA } });
      t.addText(`ช่วงข้อมูล (Period):  ${periodLabel}`, { x: 0.8, y: 3.75, w: 5.5, h: 0.5, fontSize: 12, bold: true, color: NAVY, align: "center", valign: "middle" });
      tile(t, 0.8, 5.15, 3.75, 1.6, "Inventory Value (มูลค่าคงเหลือ)", money(st.inventoryValue), WHITE, `${num(st.skuCount)} SKU · ${num(st.lotCount)} lots`, 22);
      tile(t, 4.79, 5.15, 3.75, 1.6, "Received (รับเข้า)", num(st.receivedUnits), WHITE, "units this period", 22);
      tile(t, 8.78, 5.15, 3.75, 1.6, "Issued (จ่ายออก)", num(st.issuedUnits), WHITE, "units this period", 22);
      t.addText(`Generated: ${genDate}`, { x: W - 4, y: 6.95, w: 3.5, h: 0.3, fontSize: 9.5, color: MUTE, align: "right" });

      // ================= Slide 2: Executive Dashboard =================
      const g = pptx.addSlide();
      g.background = { color: NAVY };
      g.addText("Executive Dashboard", { x: 0, y: 0.24, w: W, h: 0.5, fontSize: 26, bold: true, color: WHITE, align: "center" });
      g.addText(`ภาพรวมคลังสินค้า · ${periodLabel}`, { x: 0, y: 0.74, w: W, h: 0.3, fontSize: 11, color: BLUE_L, align: "center" });
      g.addShape("line", { x: 0.5, y: 1.12, w: 12.33, h: 0, line: { color: CARDLINE, width: 1 } });
      footer(g);

      const TY = [1.24, 2.68, 4.12, 5.56];
      const TH = 1.34;
      // Left column
      tile(g, 0.28, TY[0], 2.2, TH, "Inventory Value", money(st.inventoryValue), WHITE, "มูลค่าคงเหลือ", 15);
      tile(g, 0.28, TY[1], 2.2, TH, "SKU Count", num(st.skuCount), WHITE, "จำนวนสินค้า", 20);
      tile(g, 0.28, TY[2], 2.2, TH, "Lots On Hand", num(st.lotCount), WHITE, "ล็อตคงเหลือ", 20);
      tile(g, 0.28, TY[3], 2.2, TH, "Received", num(st.receivedUnits), WHITE, "รับเข้า (units)", 20);
      // Right column
      const RX = W - 0.28 - 2.2;
      tile(g, RX, TY[0], 2.2, TH, "Issued", num(st.issuedUnits), WHITE, "จ่ายออก (units)", 20);
      tile(g, RX, TY[1], 2.2, TH, "Loss Value", money(st.lossValue), WHITE, "มูลค่าสูญเสีย", 15);
      tile(g, RX, TY[2], 2.2, TH, "PO Received", num(d.po.totalReceived), WHITE, `จาก ${num(d.po.totalOrdered)} สั่ง`, 20);
      tile(g, RX, TY[3], 2.2, TH, "Transfers", num(d.transfer.totalUnits), WHITE, "ย้ายที่ (units)", 20);

      // Center region
      const CX = 2.66, CW = RX - 0.18 - CX; // center width
      const cardW = (CW - 0.18) / 2;
      // Row 1: two 3D column charts
      panel(g, CX, TY[0], cardW, 2.42, "Value by Category (หมวด)");
      if (summary.categories.length)
        g.addChart(CT.bar3d, [{ name: "Value", labels: summary.categories.map((c) => c.name), values: summary.categories.map((c) => c.value) }], {
          x: CX + 0.1, y: TY[0] + 0.5, w: cardW - 0.2, h: 1.82, barDir: "col", bar3DShape: "cylinder", ...v3d,
          chartColors: CATS, showValue: false, showLegend: false, showTitle: false,
          catAxisLabelColor: TXT, catAxisLabelFontSize: 7, valAxisLabelColor: MUTE, valAxisLabelFontSize: 7, valGridLine: { style: "dash", color: CARDLINE, size: 1 },
        });
      panel(g, CX + cardW + 0.18, TY[0], cardW, 2.42, "Time-to-Expiry (อายุคงเหลือ)");
      if (summary.expiry.buckets.length) {
        const bx = CX + cardW + 0.18;
        const bColors = summary.expiry.buckets.map((_, i) => (i < 3 ? RED : i === 3 ? AMBER : AQUA));
        g.addChart(CT.bar3d, [{ name: "Value", labels: summary.expiry.buckets.map((b) => b.label), values: summary.expiry.buckets.map((b) => b.value) }], {
          x: bx + 0.1, y: TY[0] + 0.5, w: cardW - 0.2, h: 1.82, barDir: "col", bar3DShape: "cylinder", ...v3d,
          chartColors: bColors, showValue: false, showLegend: false, showTitle: false,
          catAxisLabelColor: TXT, catAxisLabelFontSize: 7, valAxisLabelColor: MUTE, valAxisLabelFontSize: 7, valGridLine: { style: "dash", color: CARDLINE, size: 1 },
        });
      }
      // Row 2: storage chart (wide) + two gauges
      const R2Y = 3.76, R2H = 3.2;
      const gaugeW = 1.9;
      const stW = CW - gaugeW * 2 - 0.18 * 2;
      panel(g, CX, R2Y, stW, R2H, "Storage by Zone (พื้นที่)");
      if (summary.storage.zones.length)
        g.addChart(CT.bar3d, [{ name: "Utilization %", labels: summary.storage.zones.map((z) => `Zone ${z.name}`), values: summary.storage.zones.map((z) => z.pct) }], {
          x: CX + 0.12, y: R2Y + 0.5, w: stW - 0.24, h: R2H - 0.65, barDir: "bar", bar3DShape: "box", ...v3d, chartColors: [AQUA],
          showValue: true, dataLabelColor: WHITE, dataLabelFontSize: 8, dataLabelFontBold: true,
          valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelColor: MUTE, valAxisLabelFontSize: 7, catAxisLabelColor: TXT, catAxisLabelFontSize: 8,
          showLegend: false, showTitle: false, valGridLine: { style: "dash", color: CARDLINE, size: 1 },
        });
      gauge(g, CX + stW + 0.18, R2Y, gaugeW, R2H, "Production Yield (ผลิต)", d.production.yieldPct, AQUA);
      gauge(g, CX + stW + 0.18 + gaugeW + 0.18, R2Y, gaugeW, R2H, "Count Accuracy (นับสต็อก)", d.count.accuracyPct, BLUE_L);

      // ================= Slide 3: KPIs =================
      const k = newSlide("Key Performance Indicators", "ตัวชี้วัดหลัก", 1);
      const kw = (W - 1.0 - 0.35 * (summary.kpis.length - 1)) / summary.kpis.length;
      summary.kpis.forEach((kpi, i) => {
        const x = 0.5 + i * (kw + 0.35);
        tile(k, x, 2.0, kw, 2.5, kpi.label, kpi.value, kpi.tone === "ok" ? BLUE_L : AMBER, `${kpi.th} · ${kpi.target}`, 24);
      });
      k.addText("เขียวฟ้า = ผ่านเกณฑ์ · เหลือง = เฝ้าระวัง (vs target)", { x: 0.5, y: 4.8, w: 12, h: 0.4, fontSize: 11, italic: true, color: MUTE });

      // ================= Divider: Operations Detail =================
      const dv = pptx.addSlide();
      dv.background = { color: NAVY };
      dv.addShape("ellipse", { x: 9.7, y: -1.6, w: 5.2, h: 5.2, fill: { color: AQUA, transparency: 82 } });
      dv.addShape("ellipse", { x: 11.2, y: 3.4, w: 4.2, h: 4.2, fill: { color: BLUE_M, transparency: 84 } });
      dv.addShape("rect", { x: 0.8, y: 3.05, w: 0.8, h: 0.09, fill: { color: AQUA } });
      dv.addText("SECTION 02", { x: 0.8, y: 2.5, w: 10, h: 0.4, fontSize: 13, bold: true, color: BLUE_L, charSpacing: 3 });
      dv.addText("Operations Detail", { x: 0.8, y: 3.25, w: 11, h: 0.9, fontSize: 40, bold: true, color: WHITE });
      dv.addText("รายละเอียดการดำเนินงาน", { x: 0.8, y: 4.25, w: 11, h: 0.5, fontSize: 18, color: TXT });
      footer(dv);

      // ================= Detail table slides =================
      const dfmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

      const tableSlide = (
        title: string, th: string, no: number,
        headers: string[], rows: (string | number)[][], weights: number[],
        summaryLine?: string
      ) => {
        const s = newSlide(title, th, no);
        let top = 1.75;
        if (summaryLine) {
          s.addShape("roundRect", { x: 0.5, y: 1.32, w: 12.33, h: 0.42, rectRadius: 0.08, fill: { color: NAVY2 }, line: { color: CARDLINE, width: 1 } });
          s.addText(summaryLine, { x: 0.7, y: 1.32, w: 12, h: 0.42, fontSize: 11, bold: true, color: BLUE_L, valign: "middle" });
          top = 1.95;
        }
        const totalW = 12.33;
        const wsum = weights.reduce((a, b) => a + b, 0);
        const colW = weights.map((wt) => (wt / wsum) * totalW);
        const headRow: PptxGenJSLib.TableRow = headers.map((h) => ({
          text: h,
          options: { bold: true, color: NAVY, fill: { color: BANNER }, fontSize: 10, valign: "middle", margin: [3, 4, 3, 4] as [number, number, number, number] },
        }));
        const bodyRows: PptxGenJSLib.TableRow[] = rows.length
          ? rows.map((r, ri) =>
              r.map((c, ci) => ({
                text: String(c),
                options: {
                  fontSize: 9.5,
                  bold: ci === 0,
                  color: ci === 0 ? WHITE : TXT,
                  fill: { color: ri % 2 ? CARD : NAVY2 },
                  valign: "middle",
                  margin: [2, 4, 2, 4] as [number, number, number, number],
                },
              }))
            )
          : [[
              {
                text: "— no data for this period (ไม่มีข้อมูลช่วงนี้) —",
                options: { fontSize: 10, italic: true, color: MUTE, colspan: headers.length, align: "center" as const, fill: { color: CARD } },
              },
            ]];
        s.addTable([headRow, ...bodyRows], {
          x: 0.5, y: top, w: totalW, colW,
          border: { type: "solid", color: CARDLINE, pt: 0.5 },
          rowH: 0.3, valign: "middle",
        });
        return s;
      };

      tableSlide(
        "Production", "การผลิต — สินค้าที่ผลิต", 2,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot"],
        d.production.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo]),
        [2, 4, 1.8, 1.6, 2],
        `${num(d.production.docCount)} docs   ·   ผลิตได้ ${num(d.production.totalProduced)}   ·   สูญเสีย ${num(d.production.totalProdLoss)}   ·   Yield ${d.production.yieldPct.toFixed(1)}%`
      );

      tableSlide(
        "On-hand Balances", "ยอดคงเหลือ — เรียงตามมูลค่า", 3,
        ["SAP Material", "Material Description", "On hand", "Value", "Lots"],
        d.balances.map((r) => [r.code, r.name, `${num(r.onHand)} ${r.unit}`, money(r.value), num(r.lotCount)]),
        [2, 4.2, 2, 2.2, 1],
        `มูลค่าคงเหลือรวม ${money(st.inventoryValue)}   ·   ${num(st.skuCount)} SKU   ·   ${num(st.lotCount)} lots`
      );

      tableSlide(
        "Aging", "อายุสินค้า — ล็อตที่เก่าที่สุด", 4,
        ["SAP Material", "Description", "Lot", "Loc", "On hand", "Age (วัน)", "อายุคงเหลือ (Days left)"],
        d.aging.map((r) => [
          r.code, r.name, r.lotNo, r.location, `${num(r.onHand)} ${r.unit}`,
          num(r.ageDays), r.daysLeft == null ? "— ไม่มีวันหมดอายุ" : r.daysLeft < 0 ? `หมดอายุแล้ว ${Math.abs(r.daysLeft)} วัน` : `${num(r.daysLeft)} วัน`,
        ]),
        [1.9, 2.9, 1.7, 1, 1.5, 1.3, 2.6],
        "เรียงจากล็อตที่รับเข้ามานานที่สุด · อายุคงเหลือ = จำนวนวันก่อนหมดอายุ"
      );

      tableSlide(
        "GR · Receiving", "รับเข้า", 5,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot", "Loc"],
        d.receiving.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.location]),
        [2, 3.6, 1.8, 1.6, 2, 1],
        `${num(d.receiving.docCount)} docs   ·   รับเข้ารวม ${num(d.receiving.totalUnits)} units`
      );

      tableSlide(
        "GI · Issuing", "จ่ายออก", 6,
        ["SAP Material", "Material Description", "Date", "Qty", "Lot", "Issued To"],
        d.issuing.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.issueTo]),
        [2, 3.4, 1.8, 1.6, 2, 2],
        `${num(d.issuing.docCount)} docs   ·   จ่ายออกรวม ${num(d.issuing.totalUnits)} units`
      );

      tableSlide(
        "TF · Transfers", "ย้ายที่เก็บ", 7,
        ["SAP Material", "Description", "Date", "Qty", "Lot", "From", "To"],
        d.transfer.rows.map((r) => [r.code, r.name, dfmt(r.docDate), `${num(r.qty)} ${r.unit}`, r.lotNo, r.from, r.to]),
        [2, 3, 1.6, 1.5, 1.9, 1.3, 1.3],
        `${num(d.transfer.docCount)} docs   ·   ย้ายรวม ${num(d.transfer.totalUnits)} units`
      );

      tableSlide(
        "Count · Stock Count", "นับสต็อก", 8,
        ["SAP Material", "Description", "Date", "System", "Counted", "Variance", "Lot"],
        d.count.rows.map((r) => [
          r.code, r.name, dfmt(r.docDate), num(r.sysQty), num(r.countedQty),
          r.variance > 0 ? `+${num(r.variance)}` : num(r.variance), r.lotNo,
        ]),
        [2, 3, 1.6, 1.4, 1.4, 1.5, 2],
        `${num(d.count.docCount)} docs   ·   ${num(d.count.lineCount)} lines   ·   Accuracy ${d.count.accuracyPct.toFixed(1)}%`
      );

      tableSlide(
        "PO · Purchase Orders", "ใบสั่งซื้อ", 9,
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

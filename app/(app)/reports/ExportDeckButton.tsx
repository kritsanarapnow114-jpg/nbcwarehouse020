"use client";

import { useState } from "react";
import type PptxGenJSLib from "pptxgenjs";
import type { ExecutiveSummary } from "@/lib/views/summary";

const GREEN = "3E9B6E";
const DARK = "16202E";
const GRAY = "69748A";
const LIGHT = "F1F5F8";
const TRACK = "E4EAF0";
const OK = "17935A";
const WARN = "E59A2B";
const ORANGE = "E5913A";
const RED = "C53F3F";

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
      const genDate = new Date().toLocaleDateString("en-GB");

      // Header used on every content slide
      const header = (s: PptxGenJSLib.Slide, title: string) => {
        s.background = { color: "FFFFFF" };
        s.addShape("rect", { x: 0, y: 0, w: W, h: 0.12, fill: { color: GREEN } });
        s.addText(title, { x: 0.5, y: 0.35, w: 10.5, h: 0.6, fontSize: 24, bold: true, color: DARK });
        s.addText("NBC Warehouse", { x: 0.5, y: 0.02, w: 6, h: 0.3, fontSize: 9, color: GREEN, bold: true, valign: "top" });
        s.addText(periodLabel, { x: W - 5.3, y: 0.4, w: 4.8, h: 0.4, fontSize: 11, color: GRAY, align: "right" });
      };

      const tile = (
        s: PptxGenJSLib.Slide,
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        value: string,
        valueColor = DARK,
        sub?: string
      ) => {
        s.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: LIGHT }, line: { color: TRACK, width: 1 } });
        s.addText(label, { x: x + 0.2, y: y + 0.18, w: w - 0.4, h: 0.35, fontSize: 11, color: GRAY });
        s.addText(value, { x: x + 0.2, y: y + 0.55, w: w - 0.4, h: 0.6, fontSize: 26, bold: true, color: valueColor });
        if (sub) s.addText(sub, { x: x + 0.2, y: y + h - 0.42, w: w - 0.4, h: 0.35, fontSize: 9.5, color: GRAY });
      };

      const bar = (s: PptxGenJSLib.Slide, x: number, y: number, w: number, pct: number, color = GREEN) => {
        s.addShape("roundRect", { x, y, w, h: 0.16, rectRadius: 0.08, fill: { color: TRACK } });
        const fw = Math.max(0.03, (Math.min(100, Math.max(0, pct)) / 100) * w);
        s.addShape("roundRect", { x, y, w: fw, h: 0.16, rectRadius: 0.08, fill: { color } });
      };

      // ---- Slide 1: Title ----
      const t = pptx.addSlide();
      t.background = { color: "FFFFFF" };
      t.addShape("rect", { x: 0, y: 0, w: W, h: 3.0, fill: { color: GREEN } });
      t.addText("NBC Warehouse", { x: 0.7, y: 0.9, w: 11, h: 0.7, fontSize: 34, bold: true, color: "FFFFFF" });
      t.addText("Executive Summary · สรุปผู้บริหาร", { x: 0.7, y: 1.75, w: 11, h: 0.6, fontSize: 20, color: "EAF6EF" });
      t.addText(`ช่วงข้อมูล (Period): ${periodLabel}`, { x: 0.7, y: 3.5, w: 11, h: 0.5, fontSize: 16, color: DARK, bold: true });
      t.addText(`Generated: ${genDate}`, { x: 0.7, y: 4.1, w: 11, h: 0.4, fontSize: 12, color: GRAY });
      tile(t, 0.7, 5.0, 3.7, 1.6, "Inventory Value (มูลค่าคงเหลือ)", money(summary.stats.inventoryValue), GREEN, `${num(summary.stats.skuCount)} SKU · ${num(summary.stats.lotCount)} lots`);
      tile(t, 4.75, 5.0, 3.7, 1.6, "Received (รับเข้า)", num(summary.stats.receivedUnits), OK, "units this period");
      tile(t, 8.8, 5.0, 3.7, 1.6, "Issued (จ่ายออก)", num(summary.stats.issuedUnits), ORANGE, "units this period");

      // ---- Slide 2: KPIs ----
      const k = pptx.addSlide();
      header(k, "Key Performance Indicators (ตัวชี้วัด)");
      const kw = (W - 1.0 - 0.4 * (summary.kpis.length - 1)) / summary.kpis.length;
      summary.kpis.forEach((kpi, i) => {
        const x = 0.5 + i * (kw + 0.4);
        tile(k, x, 1.7, kw, 2.4, `${kpi.label} (${kpi.th})`, kpi.value, kpi.tone === "ok" ? OK : WARN, kpi.target);
      });

      // ---- Slide 3: Inventory overview ----
      const inv = pptx.addSlide();
      header(inv, "Inventory Overview (ภาพรวมสต็อก)");
      const cells: [string, string, string][] = [
        ["Inventory Value (มูลค่าคงเหลือ)", money(summary.stats.inventoryValue), GREEN],
        ["SKU count (จำนวนสินค้า)", num(summary.stats.skuCount), DARK],
        ["Lots on hand (ล็อตคงเหลือ)", num(summary.stats.lotCount), DARK],
        ["Received (รับเข้าช่วงนี้)", num(summary.stats.receivedUnits), OK],
        ["Issued (จ่ายออกช่วงนี้)", num(summary.stats.issuedUnits), ORANGE],
        ["Loss value (มูลค่าสูญเสีย)", money(summary.stats.lossValue), RED],
      ];
      cells.forEach((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        tile(inv, 0.5 + col * 4.15, 1.7 + row * 2.3, 3.9, 2.0, c[0], c[1], c[2]);
      });

      // ---- Slide 4: Storage ----
      const st = pptx.addSlide();
      header(st, "Storage Utilization (การใช้พื้นที่)");
      st.addText(`Total — all zones (รวมทุกโซน): ${summary.storage.totalPct}%`, { x: 0.5, y: 1.7, w: 8, h: 0.4, fontSize: 14, bold: true, color: DARK });
      bar(st, 0.5, 2.2, 12.3, summary.storage.totalPct);
      st.addText(`${num(summary.storage.totalUsed)} / ${num(summary.storage.totalCap)} m²`, { x: 0.5, y: 2.42, w: 6, h: 0.3, fontSize: 10, color: GRAY });
      summary.storage.zones.forEach((z, i) => {
        const y = 3.1 + i * 0.75;
        st.addText(`Zone ${z.name} · ${z.desc}`, { x: 0.5, y, w: 8, h: 0.3, fontSize: 12, color: DARK });
        st.addText(`${z.pct}%`, { x: 11.8, y, w: 1, h: 0.3, fontSize: 12, bold: true, color: GRAY, align: "right" });
        bar(st, 0.5, y + 0.33, 12.3, z.pct);
      });

      // ---- Slide 5: Value by category ----
      const cat = pptx.addSlide();
      header(cat, "Inventory Value by Category (มูลค่าตามหมวด)");
      const catMax = Math.max(1, ...summary.categories.map((c) => c.value));
      summary.categories.forEach((c, i) => {
        const y = 1.8 + i * 1.05;
        cat.addText(c.name, { x: 0.5, y, w: 8, h: 0.3, fontSize: 12, color: DARK });
        cat.addText(money(c.value), { x: 9.5, y, w: 3.3, h: 0.3, fontSize: 12, bold: true, color: GREEN, align: "right" });
        bar(cat, 0.5, y + 0.35, 12.3, (c.value / catMax) * 100);
      });

      // ---- Slide 6: Expiry risk ----
      const ex = pptx.addSlide();
      header(ex, "Value by Time-to-Expiry (มูลค่าตามอายุที่เหลือ)");
      tile(ex, 0.5, 1.7, 4.0, 1.5, "At risk ≤90d (เสี่ยงหมดอายุ)", money(summary.expiry.atRiskValue), RED);
      const exMax = Math.max(1, ...summary.expiry.buckets.map((b) => b.value));
      summary.expiry.buckets.forEach((b, i) => {
        const y = 3.6 + i * 0.66;
        ex.addText(`${b.label}  (${b.count})`, { x: 0.5, y, w: 6, h: 0.3, fontSize: 11, color: DARK });
        ex.addText(money(b.value), { x: 9.8, y, w: 3, h: 0.3, fontSize: 11, bold: true, color: GRAY, align: "right" });
        bar(ex, 0.5, y + 0.32, 12.3, (b.value / exMax) * 100, i < 3 ? RED : GREEN);
      });

      // ---- Slide 7: Top movement ----
      const mv = pptx.addSlide();
      header(mv, "Top Movement (ความเคลื่อนไหวสูงสุด)");
      const colList = (x: number, title: string, rows: { code: string; name: string; qty: number }[], color: string) => {
        mv.addText(title, { x, y: 1.7, w: 5.8, h: 0.4, fontSize: 14, bold: true, color });
        if (rows.length === 0) mv.addText("— no data —", { x, y: 2.2, w: 5.8, h: 0.3, fontSize: 11, color: GRAY });
        rows.forEach((r, i) => {
          const y = 2.3 + i * 0.62;
          mv.addText(`${r.code}  ${r.name}`, { x, y, w: 4.4, h: 0.4, fontSize: 11, color: DARK });
          mv.addText(num(r.qty), { x: x + 4.4, y, w: 1.3, h: 0.4, fontSize: 11, bold: true, color, align: "right" });
        });
      };
      colList(0.5, "Received (รับเข้า)", summary.movement.received, OK);
      colList(7.0, "Issued (จ่ายออก)", summary.movement.issued, ORANGE);

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

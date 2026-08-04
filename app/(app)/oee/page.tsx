import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { resolvePeriod } from "@/lib/calc/period";
import { getOeeDashboard } from "@/lib/views/oee";
import { oeeColor, OEE_GOOD, fmtDuration } from "@/lib/calc/oee";
import { getAppSetting } from "@/lib/views/settings";
import {
  OEE_REPORT_KEY,
  OEE_REPORT_ROWS,
  OEE_PHASE_GUIDE,
  RISK_LEVELS,
  QUALITY_LOSS_SEED,
  parseOeeReport,
  type OeeReportRowKey,
} from "@/lib/settingsKeys";

export default async function OeePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const { mode, range, dateStr, startStr, endStr } = resolvePeriod(params);
  const [d, report] = await Promise.all([
    getOeeDashboard(range),
    getAppSetting(OEE_REPORT_KEY).then(parseOeeReport),
  ]);

  // Analytics come only from what's captured at the Pack Order / Fill-SILO — the
  // Settings page just holds the standards & report config, no hand-typed numbers.
  const impactFor = (reason: string) =>
    QUALITY_LOSS_SEED.find((s) => s.reason === reason)?.impact ?? "";
  const qualityLoss = d.captured.qualityLoss.map((r) => ({
    reason: r.reason,
    qty: r.qty,
    impact: impactFor(r.reason),
  }));
  const lossSorted = d.captured.lossPareto; // already sorted by lost time
  const R = report.rows;
  const num = (s: string) => {
    const n = Number(String(s).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const qLossTotal = qualityLoss.reduce((s, r) => s + r.qty, 0);
  const lossMax = Math.max(1, ...lossSorted.map((r) => r.lostMin));

  return (
    <div className="max-w-[1180px] p-[24px_26px]">
      <PeriodSelector basePath="/oee" mode={mode} date={dateStr} start={startStr} end={endStr} />

      {/* ── Packing Unit Startup Performance · Trial-Run OEE ─────────────── */}
      <TrialRunHeader phase={report.phase} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["oee", "availability", "performance", "quality"] as OeeReportRowKey[]).map((k) => (
          <MonthTile
            key={k}
            label={k === "oee" ? "OEE" : k[0].toUpperCase() + k.slice(1)}
            cur={num(R[k].cur)}
            prev={num(R[k].prev)}
            suffix="%"
          />
        ))}
      </div>

      <Card className="mb-4">
        <CardTitle>OEE Calculation Base — เดือนนี้ / เป้า / เดือนก่อน (ตรวจที่มาได้)</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#f7f9fb] text-[#69748a]">
                <th className="p-[8px_12px] text-left text-[11.5px] font-medium">OEE Input</th>
                <th className="p-[8px_12px] text-right text-[11.5px] font-medium">This month</th>
                <th className="p-[8px_12px] text-right text-[11.5px] font-medium">Target</th>
                <th className="p-[8px_12px] text-right text-[11.5px] font-medium">Last month</th>
                <th className="p-[8px_12px] text-center text-[11.5px] font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {OEE_REPORT_ROWS.map((row) => {
                const c = R[row.key];
                const cur = num(c.cur);
                const prev = num(c.prev);
                const emphasize = row.key === "oee" || row.pct;
                // For downtime/repack/scrap, lower is better — flip arrow meaning.
                const lowerBetter = ["downtimeMin", "repack", "scrap"].includes(row.key);
                return (
                  <tr key={row.key} className={`border-t border-[#eef1f5] ${emphasize ? "font-semibold" : ""}`}>
                    <td className="p-[7px_12px] text-[#3a4658]">
                      {row.label} <span className="text-[10.5px] font-normal text-[#9aa4b4]">{row.unit}</span>
                    </td>
                    <td className="font-num p-[7px_12px] text-right">{c.cur || "—"}</td>
                    <td className="font-num p-[7px_12px] text-right text-[#69748a]">
                      {row.hasTarget ? c.target || "—" : "–"}
                    </td>
                    <td className="font-num p-[7px_12px] text-right text-[#9aa4b4]">{c.prev || "—"}</td>
                    <td className="p-[7px_12px] text-center">
                      <TrendArrow cur={cur} prev={prev} lowerBetter={lowerBetter} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#9aa4b4]">
          กรอก/แก้ตัวเลขได้ที่ <Link href="/settings" className="text-[#2f86cf]">Settings → OEE Report</Link> ·
          ค่าเดือนก่อน (July) ใส่ให้จากรายงานเดิมแล้ว
        </p>
      </Card>

      {/* Quality Loss Pareto — pulled from the BOM material loss */}
      <Card className="mb-4">
        <CardTitle>
          Quality Loss Pareto — วัสดุที่เสีย (จาก BOM)
          <span className="ml-2 rounded-[5px] bg-[#e9f6ee] px-2 py-0.5 text-[10px] font-semibold text-[#1f9d63]">
            จาก BOM อัตโนมัติ
          </span>
        </CardTitle>
        {qualityLoss.length === 0 ? (
          <CaptureHint what="Loss ในการ์ด BOM" />
        ) : (
          <div className="flex flex-col gap-2.5">
            {qualityLoss.map((r) => {
              const pctLoss = qLossTotal > 0 ? (r.qty / qLossTotal) * 100 : 0;
              return (
                <div key={r.reason} className="flex items-center gap-3">
                  <div className="w-[190px] flex-none text-[12px] text-[#3a4658]">{r.reason}</div>
                  <div className="h-[13px] flex-1 overflow-hidden rounded-[5px] bg-[#eef1f5]">
                    <div className="h-full rounded-[5px] bg-[#c53f3f]" style={{ width: `${pctLoss}%` }} />
                  </div>
                  <div className="font-num w-12 text-right text-[12px] font-semibold text-[#c53f3f]">{pctLoss.toFixed(0)}%</div>
                  <div className="w-16 flex-none text-right font-num text-[11.5px] text-[#9aa4b4]">{r.qty.toLocaleString()}</div>
                  <div className="w-[130px] flex-none text-[10.5px] text-[#9aa4b4]">{r.impact}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Loss Pareto — split by function/owner (from Pack Order downtime) */}
      <Card className="mb-4">
        <CardTitle>Loss Pareto — แยกตามฝ่ายรับผิดชอบ (Project / Vendor / Operator)</CardTitle>
        {lossSorted.length === 0 ? (
          <CaptureHint what="downtime + Category + Owner" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f7f9fb] text-left text-[11px] text-[#69748a]">
                  <th className="p-[7px_10px] font-medium">#</th>
                  <th className="p-[7px_10px] font-medium">Top loss</th>
                  <th className="p-[7px_10px] font-medium">Category</th>
                  <th className="p-[7px_10px] text-right font-medium">Freq</th>
                  <th className="p-[7px_10px] font-medium">Lost time</th>
                  <th className="p-[7px_10px] font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {lossSorted.map((r, i) => (
                  <tr key={i} className="border-t border-[#eef1f5]">
                    <td className="font-num p-[7px_10px] text-[#9aa4b4]">{i + 1}</td>
                    <td className="p-[7px_10px] font-medium text-[#3a4658]">{r.loss}</td>
                    <td className="p-[7px_10px]"><CatChip category={r.category} /></td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{r.freq}</td>
                    <td className="p-[7px_10px]">
                      <div className="flex items-center gap-2">
                        <div className="h-[8px] w-[70px] flex-none overflow-hidden rounded-[4px] bg-[#eef1f5]">
                          <div className="h-full rounded-[4px] bg-[#c8891a]" style={{ width: `${(r.lostMin / lossMax) * 100}%` }} />
                        </div>
                        <span className="font-num text-[11.5px] text-[#69748a]">{r.lostMin} min</span>
                      </div>
                    </td>
                    <td className="p-[7px_10px] text-[11.5px] text-[#69748a]">{r.owner || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Repack / Scrap — captured at Pack Order */}
      {(d.captured.repack > 0 || d.captured.scrap > 0) && (
        <Card className="mb-4">
          <CardTitle>Repack / Scrap (จาก Pack Order)</CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[12px] border border-[#eef1f5] bg-[#fafbfc] p-[12px_14px]">
              <div className="text-[11px] text-[#69748a]">Repack</div>
              <div className="font-num text-[22px] font-extrabold text-[#c8891a]">
                {d.captured.repack.toLocaleString()}<span className="ml-1 text-[12px] font-medium text-[#9aa4b4]">units</span>
              </div>
            </div>
            <div className="rounded-[12px] border border-[#eef1f5] bg-[#fafbfc] p-[12px_14px]">
              <div className="text-[11px] text-[#69748a]">Scrap</div>
              <div className="font-num text-[22px] font-extrabold text-[#c53f3f]">
                {d.captured.scrap.toLocaleString()}<span className="ml-1 text-[12px] font-medium text-[#9aa4b4]">units</span>
              </div>
            </div>
          </div>
        </Card>
      )}


      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Startup Phase Guideline (แทน World-Class)</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="text-left text-[11px] text-[#69748a]">
                  <th className="p-[6px_10px] font-medium">Phase</th>
                  <th className="p-[6px_10px] font-medium">OEE guideline</th>
                  <th className="p-[6px_10px] font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {OEE_PHASE_GUIDE.map((g) => {
                  const active = g.phase === report.phase;
                  return (
                    <tr
                      key={g.phase}
                      className={`border-t border-[#eef1f5] ${active ? "bg-[#e9f6ee]" : ""}`}
                    >
                      <td className={`p-[6px_10px] ${active ? "font-bold text-[#1f9d63]" : "text-[#3a4658]"}`}>
                        {active ? "▶ " : ""}
                        {g.phase}
                      </td>
                      <td className="font-num p-[6px_10px]">{g.range}</td>
                      <td className="p-[6px_10px] text-[#69748a]">{g.priority}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-[#9aa4b4]">
            ยังเป็นช่วงทดสอบเครื่อง — <b className="text-[#3a4658]">Trial-Run OEE ไม่ควรเทียบ World-Class 85% โดยตรง</b>
          </p>
        </Card>

        <Card>
          <CardTitle>Risk Level — Management Requirement</CardTitle>
          <div className="flex flex-col gap-2">
            {RISK_LEVELS.map((r) => (
              <div key={r.level} className="flex gap-2.5 text-[12px]">
                <span
                  className="mt-0.5 h-fit flex-none rounded-[5px] px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ background: r.color }}
                >
                  {r.level}
                </span>
                <span className="text-[#69748a]">{r.requirement}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-2 mt-6 text-[13px] font-semibold text-[#16202e]">
        ข้อมูลจริงตามช่วงเวลา (Live · เลือกช่วงด้านบน)
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Unloading OEE hero */}
        <Card>
          <CardTitle>Unloading เข้า SILO · OEE = P × Q</CardTitle>
          {!d.hasUnloading ? (
            <Empty text="ยังไม่มีการโหลดเข้า SILO ที่จับเวลาในช่วงนี้ — ดูที่หน้า Feed to SILO" />
          ) : (
            <>
              <div className="flex items-center gap-6">
                <Gauge value={d.unloading.oee} />
                <div className="flex flex-1 flex-col gap-2.5">
                  {d.unloading.hasPlan ? (
                    <Bar label="Availability" sub="เสร็จในแผน=100% · เกินแผนถึงลด" v={d.unloading.a} />
                  ) : (
                    <Bar label="การใช้งาน" sub="โหลดจริง/ช่วงเปิดเครื่อง (info)" v={d.unloading.a} />
                  )}
                  <Bar label="Performance" sub="เทียบมาตรฐาน kg/ชม." v={d.unloading.p} />
                  <Bar label="Quality" sub="ไม่นับของเสีย = 100%" v={d.unloading.q} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-5 border-t border-[#eef1f5] pt-3 text-[12px] text-[#69748a]">
                <Foot k="โหลดทั้งหมด" v={`${d.unloading.loads} ถุง`} />
                <Foot k="ปริมาณ" v={`${d.unloading.output.toLocaleString()} kg`} />
                <Foot k="เวลาที่ใช้โหลด" v={fmtDuration(d.unloading.loadingMs)} />
                {d.unloading.hasPlan && <Foot k="แผนเวลา" v={`${d.unloading.plannedMin} นาที`} />}
                <Foot k={d.unloading.hasPlan ? "ว่าง (เทียบแผน)" : "ว่าง (ไม่มีงาน)"} v={fmtDuration(d.unloading.idleMs)} />
              </div>
              <p className="mt-2 rounded-[9px] bg-[#f7f9fb] p-2.5 text-[11px] leading-relaxed text-[#69748a]">
                {d.unloading.hasPlan ? (
                  <>
                    <b className="text-[#3a4658]">Availability</b> = โหลดเสร็จภายในแผน → 100% (เสร็จเร็ว/ตรงเวลาไม่โดนหัก) ·
                    ถ้า<b>เกินแผน</b>ถึงจะลด (แผน ÷ เวลาจริง) · <b>Performance</b> = อัตราโหลดจริงเทียบมาตรฐาน ·
                    OEE = A × P × Q · รอบไหนไม่ตั้งแผน = ใช้ P × Q
                  </>
                ) : (
                  <>
                    <b className="text-[#3a4658]">หมายเหตุ:</b> รอบนี้ยังไม่ได้ตั้ง <b>แผนเวลาโหลด</b> → ไม่คิด Availability
                    (OEE = P × Q) · ตั้งแผนตอนเบิกเข้า SILO เพื่อให้ได้ A ครบ
                  </>
                )}
              </p>
            </>
          )}
        </Card>

        {/* Production */}
        <Card>
          <CardTitle>{d.production.hasOee ? "การผลิต · OEE" : "การผลิต · Yield"}</CardTitle>
          {d.production.docs === 0 ? (
            <Empty text="ยังไม่มีรับจากผลิตในช่วงนี้" />
          ) : d.production.hasOee ? (
            <>
              <div className="flex items-center gap-5">
                <Gauge value={d.production.oee} />
                <div className="flex flex-1 flex-col gap-2.5">
                  <Bar label="Availability" sub="เดินจริง/แผน" v={d.production.a} />
                  <Bar label="Performance" sub="เทียบมาตรฐาน" v={d.production.p} />
                  <Bar label="Quality" sub="มูลค่าดี/(มูลค่าดี+มูลค่าเสีย)" v={d.production.q} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-5 border-t border-[#eef1f5] pt-3 text-[12px] text-[#69748a]">
                <Foot k="ผลิตได้" v={`${d.production.produced.toLocaleString()} kg`} />
                <Foot k="เม็ดเสีย" v={`${d.production.loss.toLocaleString()} kg`} />
                <Foot k="Packaging เสีย" v={`${d.production.pkgLoss.toLocaleString()} ชิ้น`} />
                <Foot k="มูลค่าเสีย" v={`฿${d.production.lossValue.toLocaleString()}`} />
                <Foot k="รอบที่วัด OEE" v={`${d.production.scoredRuns}/${d.production.docs}`} />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <Gauge value={d.production.quality} small />
                <div className="text-[12.5px] text-[#69748a]">
                  <div className="mb-1">
                    ผลิตได้ <b className="font-num text-[#16202e]">{d.production.produced.toLocaleString()}</b> kg
                  </div>
                  <div className="mb-1">
                    ของเสีย <b className="font-num text-[#c53f3f]">{d.production.loss.toLocaleString()}</b> kg
                  </div>
                  <div>
                    จาก <b className="font-num">{d.production.docs}</b> ใบรับผลิต
                  </div>
                </div>
              </div>
              <p className="mt-3 rounded-[9px] bg-[#fbf1de] p-2.5 text-[11px] leading-relaxed text-[#8a6d1f]">
                ตอนนี้มีแค่ <b>Yield</b> — เลือก “สายผลิต” + ใส่เวลาตอนบันทึก Pack Order เพื่อให้ได้ A/P/Q ครบ
              </p>
            </>
          )}
        </Card>
      </div>

      {d.production.hasOee && d.production.perLine.length > 0 && (
        <Card className="mb-4">
          <CardTitle>OEE รายสายผลิต (Production lines)</CardTitle>
          <div className="flex flex-col gap-3.5">
            {d.production.perLine.map((m) => (
              <div key={m.name}>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="flex-1 text-[12.5px] font-medium">{m.name}</span>
                  <span className="text-[10.5px] text-[#9aa4b4]">
                    {m.output.toLocaleString()} kg · มาตรฐาน{" "}
                    {m.standard ? `${m.standard.toLocaleString()} kg/ชม.` : "ยังไม่ตั้ง"}
                  </span>
                  <span
                    className="font-num w-11 text-right text-[13px] font-bold"
                    style={{ color: oeeColor(m.oee) }}
                  >
                    {m.oee}%
                  </span>
                </div>
                <div className="h-[10px] overflow-hidden rounded-[6px] bg-[#eef1f5]">
                  <div
                    className="h-full rounded-[6px]"
                    style={{ width: `${m.oee}%`, background: oeeColor(m.oee) }}
                  />
                </div>
                <div className="mt-1 flex gap-3 text-[10.5px] text-[#9aa4b4]">
                  <span>A {m.a}%</span>
                  <span>P {m.p}%</span>
                  <span>Q {m.q}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Per-machine */}
        <Card>
          <CardTitle>OEE รายเครื่อง (Unloading)</CardTitle>
          {d.perMachine.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-3.5">
              {d.perMachine.map((m) => (
                <div key={m.name}>
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="flex-1 text-[12.5px] font-medium">{m.name}</span>
                    <span className="text-[10.5px] text-[#9aa4b4]">
                      {m.loads} ถุง · {m.output.toLocaleString()} kg · มาตรฐาน{" "}
                      {m.standard ? `${m.standard.toLocaleString()} kg/ชม.` : "ยังไม่ตั้ง"}
                    </span>
                    <span
                      className="font-num w-11 text-right text-[13px] font-bold"
                      style={{ color: oeeColor(m.oee) }}
                    >
                      {m.oee}%
                    </span>
                  </div>
                  <div className="h-[10px] overflow-hidden rounded-[6px] bg-[#eef1f5]">
                    <div
                      className="h-full rounded-[6px]"
                      style={{ width: `${m.oee}%`, background: oeeColor(m.oee) }}
                    />
                  </div>
                  <div className="mt-1 flex gap-3 text-[10.5px] text-[#9aa4b4]">
                    <span>P {m.p}%</span>
                    <span>ใช้งาน {m.a}%</span>
                    <span>ว่าง {fmtDuration(m.idleMs)}</span>
                  </div>
                </div>
              ))}
              <div className="mt-1 flex gap-3 text-[11px] text-[#9aa4b4]">
                <Legend color="#1f9d63" label="≥85 ดีมาก" />
                <Legend color="#c8891a" label="65–84 พอใช้" />
                <Legend color="#c53f3f" label="<65 ต้องแก้" />
              </div>
              {!d.perMachine.some((m) => m.standard > 0) && (
                <p className="rounded-[9px] bg-[#fbf1de] p-2.5 text-[11px] text-[#8a6d1f]">
                  ยังไม่ได้ตั้งค่ามาตรฐานเครื่อง → Performance จะเป็น 0% ·{" "}
                  <Link href="/settings" className="font-semibold underline">
                    ตั้งค่าที่ Settings
                  </Link>
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Trend */}
        <Card>
          <CardTitle>แนวโน้ม OEE · 7 วันล่าสุด (Unloading)</CardTitle>
          <div className="mb-2 text-[11.5px] text-[#9aa4b4]">
            เส้นประ = เป้า {OEE_GOOD}% · วันที่ไม่มีงานจะเว้นว่าง
          </div>
          <Trend days={d.trend.days} oee={d.trend.oee} />
        </Card>
      </div>

      {/* ── OEE per run — each production run & each unloading session ─────── */}
      {d.productionRuns.length > 0 && (
        <Card className="mb-4">
          <CardTitle>OEE รายครั้ง · การผลิต (แต่ละใบ Pack Order)</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f7f9fb] text-left text-[11px] text-[#69748a]">
                  <th className="p-[7px_10px] font-medium">เอกสาร</th>
                  <th className="p-[7px_10px] font-medium">วันที่</th>
                  <th className="p-[7px_10px] font-medium">สายผลิต</th>
                  <th className="p-[7px_10px] text-right font-medium">A</th>
                  <th className="p-[7px_10px] text-right font-medium">P</th>
                  <th className="p-[7px_10px] text-right font-medium">Q</th>
                  <th className="p-[7px_10px] text-right font-medium">OEE</th>
                  <th className="p-[7px_10px] text-right font-medium">ผลิต</th>
                  <th className="p-[7px_10px] text-right font-medium">Downtime</th>
                </tr>
              </thead>
              <tbody>
                {d.productionRuns.map((r) => (
                  <tr key={r.doc} className="border-t border-[#eef1f5]">
                    <td className="font-num p-[7px_10px] text-[#2f86cf]">{r.doc}</td>
                    <td className="font-num p-[7px_10px] text-[#69748a]">{r.day}</td>
                    <td className="p-[7px_10px]">{r.line}</td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{r.a}%</td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{r.p}%</td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{r.q}%</td>
                    <td className="font-num p-[7px_10px] text-right font-bold" style={{ color: oeeColor(r.oee) }}>{r.oee}%</td>
                    <td className="font-num p-[7px_10px] text-right">{r.produced.toLocaleString()}</td>
                    <td className="font-num p-[7px_10px] text-right text-[#c8891a]">{r.downtimeMin} น.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {d.unloadingRuns.length > 0 && (
        <Card className="mb-4">
          <CardTitle>OEE รายครั้ง · Unloading (แต่ละรอบโหลดเข้า SILO)</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f7f9fb] text-left text-[11px] text-[#69748a]">
                  <th className="p-[7px_10px] font-medium">เอกสาร</th>
                  <th className="p-[7px_10px] font-medium">วันที่</th>
                  <th className="p-[7px_10px] font-medium">เครื่อง</th>
                  <th className="p-[7px_10px] text-right font-medium">ใช้งาน</th>
                  <th className="p-[7px_10px] text-right font-medium">P</th>
                  <th className="p-[7px_10px] text-right font-medium">OEE</th>
                  <th className="p-[7px_10px] text-right font-medium">ถุง</th>
                  <th className="p-[7px_10px] text-right font-medium">ปริมาณ</th>
                  <th className="p-[7px_10px] text-right font-medium">เวลาโหลด</th>
                </tr>
              </thead>
              <tbody>
                {d.unloadingRuns.map((r) => (
                  <tr key={r.doc} className="border-t border-[#eef1f5]">
                    <td className="font-num p-[7px_10px] text-[#2f86cf]">{r.doc}</td>
                    <td className="font-num p-[7px_10px] text-[#69748a]">{r.day}</td>
                    <td className="p-[7px_10px]">{r.machine}</td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{r.a}%</td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{r.p}%</td>
                    <td className="font-num p-[7px_10px] text-right font-bold" style={{ color: oeeColor(r.oee) }}>{r.oee}%</td>
                    <td className="font-num p-[7px_10px] text-right">{r.bags}</td>
                    <td className="font-num p-[7px_10px] text-right">{r.output.toLocaleString()} kg</td>
                    <td className="font-num p-[7px_10px] text-right text-[#69748a]">{fmtDuration(r.loadingMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Gauge({ value, small }: { value: number; small?: boolean }) {
  const color = oeeColor(value);
  const size = small ? 104 : 132;
  const hole = small ? 12 : 14;
  return (
    <div
      className="relative flex-none rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${color} ${value}%, #eef1f5 0)` }}
    >
      <div
        className="absolute flex flex-col items-center justify-center rounded-full bg-white"
        style={{ inset: hole }}
      >
        <div
          className="font-num font-extrabold leading-none"
          style={{ color, fontSize: small ? 24 : 30 }}
        >
          {value}%
        </div>
        <div className="mt-0.5 text-[10px] tracking-wide text-[#9aa4b4]">
          {small ? "Yield" : "OEE"}
        </div>
      </div>
    </div>
  );
}

function Bar({ label, sub, v }: { label: string; sub: string; v: number }) {
  const color = oeeColor(v);
  return (
    <div className="grid grid-cols-[110px_1fr_40px] items-center gap-2.5">
      <div className="text-[11.5px] text-[#69748a]">
        {label}
        <span className="block text-[10px] text-[#9aa4b4]">{sub}</span>
      </div>
      <div className="h-[9px] overflow-hidden rounded-[5px] bg-[#eef1f5]">
        <div className="h-full rounded-[5px]" style={{ width: `${v}%`, background: color }} />
      </div>
      <div className="font-num text-right text-[12.5px] font-bold" style={{ color }}>
        {v}%
      </div>
    </div>
  );
}

function Foot({ k, v }: { k: string; v: string }) {
  return (
    <div>
      {k}
      <b className="font-num mt-0.5 block text-[15px] font-bold text-[#16202e]">{v}</b>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Empty({ text = "ยังไม่มีข้อมูล" }: { text?: string }) {
  return <div className="py-6 text-center text-[12.5px] text-[#9aa4b4]">{text}</div>;
}

const CAT_COLORS: Record<string, string> = {
  "Equipment breakdown": "#c53f3f",
  "Process loss": "#c8891a",
  "Quality loss": "#b5477f",
  "Upstream / Silo loss": "#2f86cf",
  "Warehouse / Logistics": "#1f9d63",
  "SAP / IT loss": "#6b6bd6",
  "Planned commissioning test": "#8d9a92",
};

function CatChip({ category }: { category: string }) {
  const c = CAT_COLORS[category] ?? "#8d9a92";
  return (
    <span className="rounded-[5px] px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: `${c}1a`, color: c }}>
      {category}
    </span>
  );
}

function CaptureHint({ what }: { what: string }) {
  return (
    <div className="rounded-[10px] bg-[#f7f9fb] p-4 text-center text-[12px] text-[#69748a]">
      ยังไม่มีข้อมูลในช่วงนี้ — บันทึก <b className="text-[#3a4658]">{what}</b> ตอนบันทึก{" "}
      <Link href="/pack" className="text-[#2f86cf]">Pack Order</Link> แล้วกราฟจะขึ้นเอง
    </div>
  );
}

function TrialRunHeader({ phase }: { phase: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#e7ebf1] bg-gradient-to-r from-[#eef6ff] to-white p-[16px_20px] shadow-[0_1px_2px_rgba(20,30,48,.04)]">
      <div className="flex-1">
        <div className="text-[16px] font-bold text-[#16202e]">
          Packing Unit Startup Performance · Trial-Run OEE
        </div>
        <div className="text-[12px] text-[#69748a]">
          ยังเป็นช่วงทดสอบเครื่อง — Commissioning OEE · ไม่เทียบ World-Class โดยตรง
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-[#69748a]">Phase:</span>
        <span className="rounded-full bg-[#1f9d63] px-3 py-1 text-[12.5px] font-bold text-white">{phase}</span>
      </div>
    </div>
  );
}

function MonthTile({
  label,
  cur,
  prev,
  suffix = "",
}: {
  label: string;
  cur: number | null;
  prev: number | null;
  suffix?: string;
}) {
  const color = cur != null && suffix === "%" ? oeeColor(cur) : "#16202e";
  return (
    <div className="rounded-[14px] border border-[#e7ebf1] bg-white p-[14px_16px] shadow-[0_1px_2px_rgba(20,30,48,.04)]">
      <div className="text-[11px] text-[#69748a]">{label}</div>
      <div className="font-num text-[26px] font-extrabold leading-tight" style={{ color }}>
        {cur != null ? `${cur}${suffix}` : "—"}
      </div>
      <div className="text-[10.5px] text-[#9aa4b4]">
        <TrendArrow cur={cur} prev={prev} inline /> เดือนก่อน {prev != null ? `${prev}${suffix}` : "—"}
      </div>
    </div>
  );
}

function TrendArrow({
  cur,
  prev,
  lowerBetter,
  inline,
}: {
  cur: number | null;
  prev: number | null;
  lowerBetter?: boolean;
  inline?: boolean;
}) {
  if (cur == null || prev == null) return <span className="text-[#c9d0da]">–</span>;
  const diff = cur - prev;
  if (Math.abs(diff) < 1e-9) return <span className="text-[#9aa4b4]">→</span>;
  const up = diff > 0;
  const good = lowerBetter ? !up : up;
  const color = good ? "#1f9d63" : "#c53f3f";
  return (
    <span style={{ color }} className={inline ? "" : "font-semibold"}>
      {up ? "↑" : "↓"}
      {!inline && ` ${diff > 0 ? "+" : ""}${Math.round(diff * 10) / 10}`}
    </span>
  );
}

/** Static SVG line chart of 7-day OEE. Null days leave a gap. */
function Trend({ days, oee }: { days: string[]; oee: (number | null)[] }) {
  const W = 720;
  const H = 210;
  const pad = { l: 30, r: 40, t: 14, b: 24 };
  const n = days.length;
  const xs = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const lo = 40;
  const ys = (v: number) => pad.t + ((100 - v) / (100 - lo)) * (H - pad.t - pad.b);

  const pts = oee
    .map((v, i) => (v == null ? null : ([xs(i), ys(v), v] as const)))
    .filter((p): p is readonly [number, number, number] => p !== null);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];

  const labelOf = (iso: string) => {
    const wd = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const [y, m, day] = iso.split("-").map(Number);
    return wd[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[460px]" role="img" aria-label="แนวโน้ม OEE 7 วัน">
        {[40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} y1={ys(v)} x2={W - pad.r} y2={ys(v)} stroke="#eef1f5" strokeWidth={1} />
            <text x={pad.l - 7} y={ys(v) + 3} fontSize={10} fill="#9aa4b4" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <line
          x1={pad.l}
          y1={ys(OEE_GOOD)}
          x2={W - pad.r}
          y2={ys(OEE_GOOD)}
          stroke="#9aa4b4"
          strokeWidth={1.4}
          strokeDasharray="5 5"
        />
        {days.map((iso, i) => (
          <text key={iso} x={xs(i)} y={H - 6} fontSize={10} fill="#9aa4b4" textAnchor="middle">
            {labelOf(iso)}
          </text>
        ))}
        {pts.length > 0 && (
          <>
            <path d={path} fill="none" stroke="#2f86cf" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={4} fill="#2f86cf" stroke="#fff" strokeWidth={2} />
            ))}
            <text x={last[0] + 8} y={last[1] + 4} fontSize={12} fontWeight={700} fill="#2f86cf">
              {last[2]}%
            </text>
          </>
        )}
        {pts.length === 0 && (
          <text x={W / 2} y={H / 2} fontSize={12} fill="#9aa4b4" textAnchor="middle">
            ไม่มีข้อมูลใน 7 วันนี้
          </text>
        )}
      </svg>
    </div>
  );
}

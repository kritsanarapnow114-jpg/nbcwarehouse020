import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { resolvePeriod } from "@/lib/calc/period";
import { getOeeDashboard } from "@/lib/views/oee";
import { oeeColor, OEE_GOOD, fmtDuration } from "@/lib/calc/oee";

export default async function OeePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const { mode, range, dateStr, startStr, endStr } = resolvePeriod(params);
  const d = await getOeeDashboard(range);

  return (
    <div className="max-w-[1180px] p-[24px_26px]">
      <PeriodSelector basePath="/oee" mode={mode} date={dateStr} start={startStr} end={endStr} />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Unloading OEE hero */}
        <Card>
          <CardTitle>Unloading เข้า SILO · OEE</CardTitle>
          {!d.hasUnloading ? (
            <Empty text="ยังไม่มีการโหลดเข้า SILO ที่จับเวลาในช่วงนี้ — ดูที่หน้า Feed to SILO" />
          ) : (
            <>
              <div className="flex items-center gap-6">
                <Gauge value={d.unloading.oee} />
                <div className="flex flex-1 flex-col gap-2.5">
                  <Bar label="Availability" sub="เวลาโหลด/ช่วงเปิดเครื่อง" v={d.unloading.a} />
                  <Bar label="Performance" sub="เทียบมาตรฐาน kg/ชม." v={d.unloading.p} />
                  <Bar label="Quality" sub="ไม่นับของเสีย = 100%" v={d.unloading.q} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-5 border-t border-[#eef1f5] pt-3 text-[12px] text-[#69748a]">
                <Foot k="โหลดทั้งหมด" v={`${d.unloading.loads} ถุง`} />
                <Foot k="ปริมาณ" v={`${d.unloading.output.toLocaleString()} kg`} />
                <Foot k="เวลาโหลดจริง" v={fmtDuration(d.unloading.loadingMs)} />
                <Foot k="เวลาว่าง (idle)" v={fmtDuration(d.unloading.idleMs)} />
              </div>
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
                  <Bar label="Quality" sub="ผลิตดี/ทั้งหมด" v={d.production.q} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-5 border-t border-[#eef1f5] pt-3 text-[12px] text-[#69748a]">
                <Foot k="ผลิตได้" v={`${d.production.produced.toLocaleString()} kg`} />
                <Foot k="ของเสีย" v={`${d.production.loss.toLocaleString()} kg`} />
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
                    <span>A {m.a}%</span>
                    <span>P {m.p}%</span>
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

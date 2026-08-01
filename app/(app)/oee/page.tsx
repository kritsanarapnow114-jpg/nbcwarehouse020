import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { resolvePeriod } from "@/lib/calc/period";
import { getOeeDashboard } from "@/lib/views/oee";
import { oeeColor, OEE_GOOD } from "@/lib/calc/oee";

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

      {!d.hasData ? (
        <Card>
          <div className="p-4 text-center">
            <div className="mb-1 text-[15px] font-semibold">ยังไม่มีข้อมูล OEE ในช่วงนี้</div>
            <p className="mx-auto max-w-[460px] text-[12.5px] leading-relaxed text-[#69748a]">
              บันทึก OEE ได้ที่หน้า <Link href="/receive" className="text-[#2f86cf]">รับสินค้า</Link> —
              เลือก “เครื่องจักร” ในการ์ด OEE แล้วใส่เวลาเดินเครื่อง + downtime. ตั้งค่าเครื่อง &amp;
              ค่ามาตรฐานได้ที่ <Link href="/settings" className="text-[#2f86cf]">Settings</Link>.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HeroCard
              title="การผลิต · Production"
              s={d.production}
              outputUnit="ผลิตได้"
            />
            <HeroCard
              title="Unloading เข้า SILO"
              s={d.unloading}
              outputUnit="โหลดเข้า"
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>OEE รายเครื่อง (per machine)</CardTitle>
              {d.perMachine.length === 0 ? (
                <Empty />
              ) : (
                <div className="flex flex-col gap-3">
                  {d.perMachine.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="w-[160px] flex-none text-[12.5px]">
                        <div className="truncate font-medium">{m.name}</div>
                        <div className="text-[10.5px] text-[#9aa4b4]">
                          {m.operation === "PRODUCTION" ? "การผลิต" : "Unloading"} · {m.runs} ครั้ง
                        </div>
                      </div>
                      <div className="h-[11px] flex-1 overflow-hidden rounded-[6px] bg-[#eef1f5]">
                        <div
                          className="h-full rounded-[6px]"
                          style={{ width: `${m.oee}%`, background: oeeColor(m.oee) }}
                        />
                      </div>
                      <div
                        className="font-num w-11 text-right text-[13px] font-bold"
                        style={{ color: oeeColor(m.oee) }}
                      >
                        {m.oee}%
                      </div>
                    </div>
                  ))}
                  <div className="mt-1 flex gap-3 text-[11px] text-[#9aa4b4]">
                    <Legend color="#1f9d63" label="≥85 ดีมาก" />
                    <Legend color="#c8891a" label="65–84 พอใช้" />
                    <Legend color="#c53f3f" label="<65 ต้องแก้" />
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <CardTitle>
                สาเหตุหยุดเครื่อง · Downtime Pareto
                <span className="ml-2 font-num text-[12px] font-normal text-[#69748a]">
                  รวม {d.downtimeTotal.toLocaleString()} นาที
                </span>
              </CardTitle>
              {d.downtime.length === 0 ? (
                <Empty text="ไม่มีการหยุดเครื่องในช่วงนี้ 🎉" />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {d.downtime.map((r) => {
                    const max = d.downtime[0].minutes || 1;
                    return (
                      <div key={r.reason} className="flex items-center gap-3">
                        <div className="w-[110px] flex-none text-[12.5px] text-[#3a4658]">
                          {r.reason}
                        </div>
                        <div className="h-[11px] flex-1 overflow-hidden rounded-[6px] bg-[#eef1f5]">
                          <div
                            className="h-full rounded-[6px] bg-[#c8891a]"
                            style={{ width: `${Math.round((r.minutes / max) * 100)}%` }}
                          />
                        </div>
                        <div className="font-num w-14 text-right text-[12.5px] font-semibold text-[#69748a]">
                          {r.minutes.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <CardTitle>แนวโน้ม OEE · 7 วันล่าสุด</CardTitle>
            <div className="mb-2 flex gap-4 text-[12px] text-[#69748a]">
              <Legend color="#1f9d63" label="การผลิต" dot />
              <Legend color="#2f86cf" label="Unloading" dot />
              <span className="text-[#9aa4b4]">เส้นประ = เป้า {OEE_GOOD}%</span>
            </div>
            <Trend trend={d.trend} />
          </Card>
        </>
      )}
    </div>
  );
}

type Summary = {
  a: number;
  p: number;
  q: number;
  oee: number;
  runs: number;
  output: number;
  good: number;
  runMinutes: number;
};

function HeroCard({ title, s, outputUnit }: { title: string; s: Summary; outputUnit: string }) {
  const color = oeeColor(s.oee);
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {s.runs === 0 ? (
        <Empty text="ยังไม่มีข้อมูลในช่วงนี้" />
      ) : (
        <>
          <div className="flex items-center gap-5">
            <div
              className="relative h-[132px] w-[132px] flex-none rounded-full"
              style={{ background: `conic-gradient(${color} ${s.oee}%, #eef1f5 0)` }}
            >
              <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white">
                <div className="font-num text-[30px] font-extrabold leading-none" style={{ color }}>
                  {s.oee}%
                </div>
                <div className="mt-0.5 text-[10px] tracking-wide text-[#9aa4b4]">OEE</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              <Bar label="Availability" sub="เดินจริง/แผน" v={s.a} />
              <Bar label="Performance" sub="ความเร็ว" v={s.p} />
              <Bar label="Quality" sub="ของดี" v={s.q} />
            </div>
          </div>
          <div className="mt-4 flex gap-5 border-t border-[#eef1f5] pt-3 text-[12px] text-[#69748a]">
            <Foot k={outputUnit} v={s.output.toLocaleString()} />
            <Foot k="ของดี" v={s.good.toLocaleString()} />
            <Foot k="รอบผลิต" v={`${s.runs}`} />
            <Foot k="เวลาเดินเครื่อง" v={`${Math.round(s.runMinutes / 60)} ชม.`} />
          </div>
        </>
      )}
    </Card>
  );
}

function Bar({ label, sub, v }: { label: string; sub: string; v: number }) {
  const color = oeeColor(v);
  return (
    <div className="grid grid-cols-[92px_1fr_40px] items-center gap-2.5">
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
      <b className="font-num mt-0.5 block text-[16px] font-bold text-[#16202e]">{v}</b>
    </div>
  );
}

function Legend({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5"
        style={{ background: color, borderRadius: dot ? "50%" : 2 }}
      />
      {label}
    </span>
  );
}

function Empty({ text = "ยังไม่มีข้อมูล" }: { text?: string }) {
  return <div className="py-6 text-center text-[12.5px] text-[#9aa4b4]">{text}</div>;
}

/** Static SVG line chart of 7-day OEE for production vs unloading. */
function Trend({
  trend,
}: {
  trend: { days: string[]; production: (number | null)[]; unloading: (number | null)[] };
}) {
  const W = 1000;
  const H = 220;
  const pad = { l: 34, r: 40, t: 14, b: 26 };
  const n = trend.days.length;
  const xs = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const lo = 40;
  const ys = (v: number) => pad.t + ((100 - v) / (100 - lo)) * (H - pad.t - pad.b);

  const line = (arr: (number | null)[], color: string) => {
    const pts = arr
      .map((v, i) => (v == null ? null : ([xs(i), ys(v), v, i] as const)))
      .filter((p): p is readonly [number, number, number, number] => p !== null);
    if (pts.length === 0) return null;
    const path = pts
      .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(" ");
    const last = pts[pts.length - 1];
    return (
      <g>
        <path d={path} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={color} stroke="#fff" strokeWidth={2} />
        ))}
        <text x={last[0] + 8} y={last[1] + 4} fontSize={12} fontWeight={700} fill={color}>
          {last[2]}%
        </text>
      </g>
    );
  };

  const labelOf = (iso: string) => {
    const wd = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const [y, m, day] = iso.split("-").map(Number);
    return wd[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="แนวโน้ม OEE 7 วัน">
        {[40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} y1={ys(v)} x2={W - pad.r} y2={ys(v)} stroke="#eef1f5" strokeWidth={1} />
            <text x={pad.l - 8} y={ys(v) + 3} fontSize={10} fill="#9aa4b4" textAnchor="end">
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
        {trend.days.map((iso, i) => (
          <text key={iso} x={xs(i)} y={H - 6} fontSize={10} fill="#9aa4b4" textAnchor="middle">
            {labelOf(iso)}
          </text>
        ))}
        {line(trend.production, "#1f9d63")}
        {line(trend.unloading, "#2f86cf")}
      </svg>
    </div>
  );
}

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Money } from "@/components/ui/Currency";
import { fmtDateISO, parseISO, todayBangkok } from "@/lib/calc/date";
import { kpiBand } from "@/lib/calc/kpi";
import {
  getInventoryStats,
  getStorageUtilization,
  getValueByCategory,
  getValueByExpiry,
  getMovementDetail,
  getSlowMoving,
  getCountProgress,
  getMovementBuckets,
  getActionRequired,
} from "@/lib/views/dashboard";
import { PeriodSelector } from "./PeriodSelector";
import { KpiBand } from "./KpiBand";
import { MovementChart } from "./MovementChart";
import { SlowMovingCard } from "./SlowMovingCard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const today = todayBangkok();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 29);

  const range = {
    start: start ? parseISO(start) : defaultStart,
    end: end ? parseISO(end) : today,
  };

  const [
    kpis,
    stats,
    storage,
    valueByCategory,
    valueByExpiry,
    movementDetail,
    slowMoving,
    countProgress,
    movementBuckets,
    actionRequired,
  ] = await Promise.all([
    kpiBand(range),
    getInventoryStats(range),
    getStorageUtilization(range.end),
    getValueByCategory(range.end),
    getValueByExpiry(range.end),
    getMovementDetail(range),
    getSlowMoving(range.end),
    getCountProgress(range.end),
    getMovementBuckets(range),
    getActionRequired(range.end),
  ]);

  const countMaxMonthly = Math.max(1, ...countProgress.monthly.map((m) => m.plan));
  const countMaxWeekly = Math.max(1, ...countProgress.weekly.map((m) => m.plan));

  return (
    <div className="max-w-[1280px] p-[24px_26px]">
      <PeriodSelector
        start={fmtDateISO(range.start)}
        end={fmtDateISO(range.end)}
      />

      <KpiBand kpis={kpis} />

      <div className="mb-4 grid grid-cols-4 gap-4">
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">
            Inventory Value (มูลค่าคงเหลือ)
          </div>
          <div className="font-num text-[27px] font-bold tracking-tight">
            <Money value={stats.inventoryValue} />
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">
            {stats.skuCount} SKU · {stats.lotCount} lots
          </div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">
            Received in period (รับเข้าช่วงนี้)
          </div>
          <div className="font-num text-[27px] font-bold tracking-tight text-[#17935a]">
            {stats.receivedUnits.toLocaleString()}
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">units received</div>
        </Card>
        <Card>
          <div className="mb-2 text-[12px] text-[#69748a]">
            Issued in period (จ่ายออกช่วงนี้)
          </div>
          <div className="font-num text-[27px] font-bold tracking-tight text-[#c9821f]">
            {stats.issuedUnits.toLocaleString()}
          </div>
          <div className="mt-1.5 text-[11.5px] text-[#9aa4b4]">units issued</div>
        </Card>
        <Link href="/aging?filter=expired">
          <Card>
            <div className="mb-2 text-[12px] text-[#69748a]">
              Loss Value (มูลค่าสูญเสีย)
            </div>
            <div className="font-num text-[27px] font-bold tracking-tight text-[#d24141]">
              <Money value={stats.lossValue} />
            </div>
            <div className="mt-1.5 text-[11.5px] text-[#d24141]">
              expired stock · tap to view
            </div>
          </Card>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-[1.55fr_1fr] gap-4">
        <Card>
          <div className="mb-1 flex items-baseline">
            <div className="flex-1 text-[14px] font-semibold">
              Storage Utilization (การใช้พื้นที่)
            </div>
            <Link href="/locations" className="text-[12px] text-[#3E9B6E]">
              View all →
            </Link>
          </div>
          <div className="mb-3.5 text-[11.5px] text-[#9aa4b4]">
            Total + per-zone (รวม + รายโซน) · by area m²
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 flex justify-between text-[12px] font-semibold">
                <span>Total — all zones (รวมทุกโซน)</span>
                <span className="font-num">{storage.totalPct}%</span>
              </div>
              <ProgressBar pct={storage.totalPct} color={storage.totalColor} />
              <div className="mt-1 text-[10.5px] text-[#9aa4b4]">
                {storage.totalUsed.toLocaleString()} / {storage.totalCap.toLocaleString()} m²
              </div>
            </div>
            {storage.zones.map((z) => (
              <div key={z.name}>
                <div className="mb-1.5 flex justify-between text-[12px]">
                  <span>
                    Zone {z.name} · {z.desc}
                  </span>
                  <span className="font-num text-[#69748a]">{z.pct}%</span>
                </div>
                <ProgressBar pct={z.pct} color={z.color} height={9} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>Value by Category (มูลค่าตามหมวด)</CardTitle>
          <div className="flex flex-col gap-3.5">
            {valueByCategory.map((c) => (
              <div key={c.name}>
                <div className="mb-1.5 flex justify-between text-[12px]">
                  <span>{c.name}</span>
                  <span className="font-num text-[#69748a]">
                    <Money value={c.value} />
                  </span>
                </div>
                <ProgressBar pct={c.pct} color={c.color} height={8} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="mb-3.5 flex flex-wrap items-baseline gap-3">
          <div className="flex-1 text-[14px] font-semibold">
            Value by Time-to-Expiry (มูลค่าตามอายุที่เหลือ)
          </div>
          <Link href="/aging" className="text-[12px] text-[#3E9B6E]">
            View aging →
          </Link>
          <div className="text-[12px] text-[#69748a]">
            At risk ≤90d (เสี่ยงหมดอายุ):{" "}
            <b className="font-num text-[#d24141]">
              <Money value={valueByExpiry.atRiskValue} />
            </b>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {valueByExpiry.buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <div className="flex w-[120px] flex-none items-center gap-2 text-[12.5px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                <span>{b.label}</span>
              </div>
              <div className="h-[13px] flex-1 overflow-hidden rounded-[5px] bg-[#f1f3f7]">
                <div className="h-full rounded-[5px]" style={{ width: `${b.pct}%`, background: b.color }} />
              </div>
              <div className="font-num w-[60px] text-right text-[11px] text-[#9aa4b4]">
                {b.count} lots
              </div>
              <div className="font-num w-[112px] text-right text-[12.5px] font-semibold">
                <Money value={b.value} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card>
          <CardTitle>Received in period (รับเข้าอะไรบ้าง)</CardTitle>
          <div className="flex flex-col gap-2.5">
            {movementDetail.received.map((d) => (
              <div key={d.code} className="flex items-center gap-2.5 text-[13px]">
                <span className="font-num w-16 text-[11px] text-[#9aa4b4]">{d.code}</span>
                <span className="flex-1">{d.name}</span>
                <span className="font-num font-semibold text-[#17935a]">+{d.qty.toLocaleString()}</span>
              </div>
            ))}
            {movementDetail.received.length === 0 && (
              <div className="text-[12.5px] text-[#9aa4b4]">No receipts this period</div>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle>Issued in period (จ่ายออกอะไรบ้าง)</CardTitle>
          <div className="flex flex-col gap-2.5">
            {movementDetail.issued.map((d) => (
              <div key={d.code} className="flex items-center gap-2.5 text-[13px]">
                <span className="font-num w-16 text-[11px] text-[#9aa4b4]">{d.code}</span>
                <span className="flex-1">{d.name}</span>
                <span className="font-num font-semibold text-[#c9821f]">−{d.qty.toLocaleString()}</span>
              </div>
            ))}
            {movementDetail.issued.length === 0 && (
              <div className="text-[12.5px] text-[#9aa4b4]">No issues this period</div>
            )}
          </div>
        </Card>
      </div>

      <SlowMovingCard rows={slowMoving} />

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card>
          <div className="mb-1 text-[14px] font-semibold">
            Monthly Count Progress (แผน vs นับจริง รายเดือน)
          </div>
          <div className="mb-4 text-[11.5px] text-[#9aa4b4]">
            Green = counted vs plan (เขียว = นับแล้ว)
          </div>
          <div className="flex flex-col gap-3">
            {countProgress.monthly.map((m) => {
              const pct = Math.min(100, (m.counted / countMaxMonthly) * 100);
              const donePct = m.plan > 0 ? (m.counted / m.plan) * 100 : 0;
              return (
                <div key={m.label} className="flex items-center gap-2.5">
                  <span className="w-[34px] text-[12px] text-[#69748a]">{m.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-[5px] bg-[#eef1f5]">
                    <div
                      className="h-full rounded-[5px] bg-[#3E9B6E]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-num w-28 text-right text-[11.5px] text-[#9aa4b4]">
                    {m.counted}/{m.plan}
                  </span>
                  <span
                    className="font-num w-10 text-right text-[12.5px] font-bold"
                    style={{ color: donePct >= 100 ? "#17935a" : "#e59a2b" }}
                  >
                    {donePct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <div className="mb-1 text-[14px] font-semibold">
            Weekly Count Progress (แผน vs นับจริง รายอาทิตย์)
          </div>
          <div className="mb-4 text-[11.5px] text-[#9aa4b4]">
            Current month · by week (เดือนนี้)
          </div>
          <div className="flex flex-col gap-3">
            {countProgress.weekly.map((m) => {
              const pct = Math.min(100, (m.counted / countMaxWeekly) * 100);
              const donePct = m.plan > 0 ? (m.counted / m.plan) * 100 : 0;
              return (
                <div key={m.label} className="flex items-center gap-2.5">
                  <span className="w-[34px] text-[12px] text-[#69748a]">{m.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-[5px] bg-[#eef1f5]">
                    <div
                      className="h-full rounded-[5px] bg-[#3E9B6E]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-num w-24 text-right text-[11.5px] text-[#9aa4b4]">
                    {m.counted}/{m.plan}
                  </span>
                  <span
                    className="font-num w-10 text-right text-[12.5px] font-bold"
                    style={{ color: donePct >= 100 ? "#17935a" : "#e59a2b" }}
                  >
                    {donePct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <MovementChart
            buckets={movementBuckets}
            totalRecv={stats.receivedUnits}
            totalIssue={stats.issuedUnits}
          />
        </Card>
        <Card>
          <CardTitle>Action Required (ต้องดำเนินการ)</CardTitle>
          <div className="flex flex-col gap-2.5">
            <ActionRow
              icon="⚠"
              bg="#fbf1df"
              border="#f2e2c2"
              text={`${actionRequired.qcCount} lots on QC hold (ติด QC)`}
              sub="Unusable until released"
              subColor="#8a7333"
              href="/products"
              cta="Review"
            />
            <ActionRow
              icon="◔"
              bg="#fbe9e9"
              border="#f3d2d2"
              text={`${actionRequired.expCount} lots expiring/expired (หมดอายุ)`}
              sub="Issue or write off soon"
              subColor="#a34141"
              href="/aging"
              cta="Aging"
            />
            <ActionRow
              icon="◷"
              bg="#f1f3f7"
              border="#e2e6ec"
              text={`${actionRequired.overduePOs.length} PO overdue (ค้างรับ)`}
              sub={actionRequired.overduePOs.join(", ") || "—"}
              subColor="#69748a"
              href="/receive"
              cta="Receive"
              mono
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  bg,
  border,
  text,
  sub,
  subColor,
  href,
  cta,
  mono,
}: {
  icon: string;
  bg: string;
  border: string;
  text: string;
  sub: string;
  subColor: string;
  href: string;
  cta: string;
  mono?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[10px] p-[11px_13px]"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className="text-[16px]">{icon}</span>
      <div className="flex-1 leading-tight">
        <div className="text-[13px] font-medium">{text}</div>
        <div className={`text-[11.5px] ${mono ? "font-num" : ""}`} style={{ color: subColor }}>
          {sub}
        </div>
      </div>
      <Link
        href={href}
        className="rounded-[8px] border border-[#d7dce4] bg-white px-2.5 py-1.5 text-[12px] text-[#3a4658]"
      >
        {cta}
      </Link>
    </div>
  );
}

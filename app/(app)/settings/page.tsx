import { getUsers } from "@/lib/views/users";
import {
  getAppSettings,
  COUNT_PLAN_MONTHLY_KEY,
  COUNT_PLAN_WEEKLY_KEY,
  getCountPlanDetailed,
} from "@/lib/views/settings";
import { ResetDataCard } from "./ResetDataCard";
import { ClearDemoDataCard } from "./ClearDemoDataCard";
import { UsersCard } from "./UsersCard";
import { CountPlanCard } from "./CountPlanCard";
import { SubtitlesCard } from "./SubtitlesCard";

export default async function SettingsPage() {
  const [users, settings] = await Promise.all([getUsers(), getAppSettings()]);

  const subtitleOverrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (k.startsWith("subtitle.")) subtitleOverrides[k.slice("subtitle.".length)] = v;
  }

  // Prefill each month/week input: its own saved value, else the legacy single
  // value (so an existing global target shows in every box until customized).
  const plan = getCountPlanDetailed(settings);
  const globalMonthly = settings[COUNT_PLAN_MONTHLY_KEY] ?? "";
  const globalWeekly = settings[COUNT_PLAN_WEEKLY_KEY] ?? "";
  const monthsInit = Array.from({ length: 12 }, (_, i) =>
    plan.months[i] != null ? String(plan.months[i]) : globalMonthly
  );
  const weeksInit = Array.from({ length: 5 }, (_, i) =>
    plan.weeks[i] != null ? String(plan.weeks[i]) : globalWeekly
  );

  return (
    <div className="max-w-[720px] p-[22px_26px]">
      <UsersCard users={users} />
      <div className="mt-4">
        <CountPlanCard months={monthsInit} weeks={weeksInit} />
      </div>
      <div className="mt-4">
        <SubtitlesCard overrides={subtitleOverrides} />
      </div>
      <div className="mt-4">
        <ClearDemoDataCard />
      </div>
      <div className="mt-4">
        <ResetDataCard />
      </div>
    </div>
  );
}

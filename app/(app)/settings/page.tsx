import { getUsers } from "@/lib/views/users";
import {
  getAppSettings,
  COUNT_PLAN_MONTHLY_KEY,
  COUNT_PLAN_WEEKLY_KEY,
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

  return (
    <div className="max-w-[720px] p-[22px_26px]">
      <UsersCard users={users} />
      <div className="mt-4">
        <CountPlanCard
          monthly={settings[COUNT_PLAN_MONTHLY_KEY] ?? ""}
          weekly={settings[COUNT_PLAN_WEEKLY_KEY] ?? ""}
        />
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

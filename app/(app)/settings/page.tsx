import { getUsers } from "@/lib/views/users";
import { ResetDataCard } from "./ResetDataCard";
import { UsersCard } from "./UsersCard";

export default async function SettingsPage() {
  const users = await getUsers();
  return (
    <div className="max-w-[720px] p-[22px_26px]">
      <UsersCard users={users} />
      <ResetDataCard />
    </div>
  );
}

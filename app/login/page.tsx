import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "linear-gradient(180deg,#f5f6fc,#eceef8)",
      }}
    >
      <div className="w-full max-w-sm rounded-[18px] border border-[#e7ebf1] bg-white p-8 shadow-[0_1px_2px_rgba(20,30,48,.04),0_6px_18px_rgba(20,30,48,.035)]">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[9px] bg-[#5b53d6] text-[15px] font-bold text-white">
            NB
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-[#16202e]">
              NBC Warehouse
            </div>
            <div className="text-[11px] text-[#69748a]">
              Warehouse Mgmt (ระบบคลังสินค้า)
            </div>
          </div>
        </div>
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </div>
  );
}

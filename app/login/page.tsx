import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";
import { SkyBg } from "@/components/ui/SkyBg";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { next } = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <SkyBg className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative w-full max-w-sm rounded-[18px] border border-white/70 bg-white/85 p-8 shadow-[0_8px_40px_rgba(20,50,80,.16)] backdrop-blur-md">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[9px] bg-[#1f5f9e] text-[15px] font-bold text-white">
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

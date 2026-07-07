"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { NavIcon } from "./NavIcons";
import { logoutAction } from "@/lib/actions/auth";

export function Sidebar({
  poPendingCount,
  user,
  mobileOpen = false,
  onClose,
}: {
  poPendingCount: number;
  user: { name: string; role: string; avatarInitials: string };
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-[240px] flex-none flex-col text-[#e6f5fa] shadow-[2px_0_16px_rgba(13,20,36,.12)] transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(180deg,#17a6c0,#5b53d6)" }}
      >
        <div className="flex items-center gap-2.5 border-b border-white/15 px-[18px] py-4">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-white text-[15px] font-bold tracking-wide text-[#5b53d6]">
            NB
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="whitespace-nowrap text-[14px] font-bold text-white">
              NBC Warehouse
            </div>
            <div className="whitespace-nowrap text-[10.5px] text-[#cfeaf1]">
              Warehouse Mgmt (ระบบคลังสินค้า)
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-none text-[18px] leading-none text-white/70 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const badge = item.key === "po" && poPendingCount > 0 ? poPendingCount : null;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13px] ${
                  active ? "bg-white text-[#5b53d6]" : "bg-white/[.06] text-[#e6f5fa] hover:bg-white/[.12]"
                }`}
              >
                <span className={`flex w-[22px] flex-none items-center justify-center ${active ? "text-[#5b53d6]" : "text-white/90"}`}>
                  <NavIcon name={item.key} />
                </span>
                <span className="flex-1 text-left leading-tight">
                  <span className="block">{item.en}</span>
                  <span
                    className={`block text-[10px] ${active ? "text-[#5fa987]" : "text-[#bfe4d1]"}`}
                  >
                    ({item.th})
                  </span>
                </span>
                {badge !== null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? "bg-[#5b53d6]/15 text-[#5b53d6]" : "bg-[#c53f3f] text-white"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/settings"
          onClick={onClose}
          className={`mx-3 mb-1 flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[12px] ${
            pathname.startsWith("/settings")
              ? "bg-white text-[#5b53d6]"
              : "bg-white/[.06] text-[#cfeaf1] hover:bg-white/[.12]"
          }`}
        >
          <span className="flex w-[22px] flex-none items-center justify-center">
            <NavIcon name="settings" size={17} />
          </span>
          Settings (ตั้งค่า)
        </Link>

        <form
          action={logoutAction}
          className="flex items-center gap-2.5 border-t border-white/15 px-4 py-3.5"
        >
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/[.22] text-[12px] font-semibold text-white">
            {user.avatarInitials}
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[12.5px] font-medium text-white">
              {user.name}
            </div>
            <div className="text-[10.5px] text-[#cfeaf1]">{user.role}</div>
          </div>
          <button
            type="submit"
            title="Sign out"
            className="rounded-[7px] px-2 py-1 text-[11px] text-[#cfeaf1] hover:bg-white/[.12]"
          >
            Exit
          </button>
        </form>
      </aside>
    </>
  );
}

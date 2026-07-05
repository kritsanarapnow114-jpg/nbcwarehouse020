"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { PAGE_TITLES } from "./nav";
import { CurrencyToggleButton } from "@/components/ui/Currency";
import { NewDocMenu } from "./NewDocMenu";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const info = PAGE_TITLES[pathname] ?? { title: "NBC Warehouse", sub: "" };

  return (
    <header className="sticky top-0 z-20 flex h-[62px] flex-none items-center gap-4 border-b border-[#e7ebf1] bg-white/90 px-6 shadow-[0_1px_12px_rgba(20,30,48,.04)] backdrop-blur-md">
      <div className="leading-tight">
        <div className="text-[16px] font-semibold text-[#16202e]">
          {info.title}
        </div>
        <div className="text-[11.5px] text-[#69748a]">{info.sub}</div>
      </div>
      <div className="flex-1" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/products?q=${encodeURIComponent(q)}`);
        }}
        className="flex w-[290px] items-center gap-2 rounded-[9px] border border-[#e2e6ec] bg-[#f1f3f7] px-3 py-2"
      >
        <span className="text-[14px] text-[#9aa4b4]">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product / code (ค้นหา)"
          className="w-full border-0 bg-transparent text-[13px] text-[#16202e] outline-none"
        />
      </form>
      <CurrencyToggleButton />
      <NewDocMenu />
    </header>
  );
}

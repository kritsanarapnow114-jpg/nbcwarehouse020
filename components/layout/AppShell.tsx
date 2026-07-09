"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppShell({
  poPendingCount,
  user,
  subtitleOverrides,
  children,
}: {
  poPendingCount: number;
  user: { name: string; role: string; permission: string; avatarInitials: string };
  subtitleOverrides?: Record<string, string>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        poPendingCount={poPendingCount}
        user={user}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          subtitleOverrides={subtitleOverrides}
          permission={user.permission}
        />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}

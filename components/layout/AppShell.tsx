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
        <div
          className="flex-1 overflow-auto"
          style={{
            backgroundColor: "#f1f7f3",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='84' height='84' viewBox='0 0 84 84'%3E%3Cg fill='%232f8f5b' fill-opacity='0.045'%3E%3Cpath d='M20 16c14-6 26-2 31 9-13 6-26 2-31-9z'/%3E%3Cpath d='M60 50c10 3 15 13 12 24-10-3-15-13-12-24z'/%3E%3C/g%3E%3C/svg%3E\")",
            backgroundSize: "84px 84px",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

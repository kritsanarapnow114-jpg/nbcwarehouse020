import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CurrencyProvider } from "@/components/ui/Currency";
import { ToastHost } from "@/components/ui/Toast";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const poPendingCount = await db.purchaseOrder.count({
    where: { status: "PENDING" },
  });

  return (
    <CurrencyProvider>
      <ToastHost />
      <AppShell
        poPendingCount={poPendingCount}
        user={{
          name: session.name,
          role: session.role,
          avatarInitials: session.avatarInitials,
        }}
      >
        {children}
      </AppShell>
    </CurrencyProvider>
  );
}

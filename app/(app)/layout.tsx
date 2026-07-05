import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CurrencyProvider } from "@/components/ui/Currency";
import { ToastHost } from "@/components/ui/Toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

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
      <div className="flex min-h-screen w-full">
        <Sidebar
          poPendingCount={poPendingCount}
          user={{
            name: session.name,
            role: session.role,
            avatarInitials: session.avatarInitials,
          }}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <Header />
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </CurrencyProvider>
  );
}

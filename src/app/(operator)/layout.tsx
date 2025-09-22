import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function OperatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionContext();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "operator") {
    redirect("/super-admin");
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <AppSidebar role="operator" />
      <div className="flex flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
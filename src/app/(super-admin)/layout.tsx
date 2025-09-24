import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionContext();

  // TODO: Remover esta linha após configurar autenticação
  // Permitindo acesso temporário para teste
  const mockSession = session || { role: "super-admin" };

  if (!mockSession) {
    redirect("/");
  }

  if (mockSession.role !== "super-admin") {
    redirect("/operator");
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AppSidebar role="super-admin" />
      <div className="flex flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

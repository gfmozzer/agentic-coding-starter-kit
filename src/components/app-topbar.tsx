"use client";

import { useSessionContext } from "@/components/session-context";
import { SignInButton } from "@/components/auth/sign-in-button";
import { signOut } from "@/lib/auth-client";
import type { SessionContext } from "@/lib/auth/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { BadgeCheck, Building2, LogOut, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";

function TenantBadge({ tenantId }: { tenantId?: string }) {
  if (!tenantId) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-1 text-xs text-muted-foreground">
        <Building2 className="h-4 w-4" />
        Nenhum tenant ativo
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium">
      <Building2 className="h-4 w-4 text-primary" />
      Tenant: {tenantId}
    </div>
  );
}

function RoleBadge({ role }: { role: SessionContext["role"] }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
      <BadgeCheck className="h-4 w-4" />
      {role === "super-admin" ? "Super-Admin" : "Operador"}
    </div>
  );
}

export function AppTopbar() {
  const session = useSessionContext();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        {session ? <RoleBadge role={session.role} /> : null}
        <TenantBadge tenantId={session?.tenantId} />
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        {session ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={session.user.image ?? undefined}
                    alt={session.user.name ?? "Usuario"}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback>
                    {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left text-sm leading-tight md:block">
                  <p className="font-semibold">{session.user.name ?? "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.user.email ?? "Sem email"}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold">{session.user.name ?? "Sem nome"}</span>
                  <span className="text-xs text-muted-foreground">
                    {session.user.email ?? "Sem email"}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SignInButton />
        )}
      </div>
    </header>
  );
}
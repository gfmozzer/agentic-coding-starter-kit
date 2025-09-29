"use client";

import type { AppRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  Building2,
  FileText,
  History,
  LayoutDashboard,
  LibraryBig,
  LucideIcon,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

const superAdminNav: NavItem[] = [
  {
    label: "Visao Geral",
    href: "/super-admin",
    icon: LayoutDashboard,
  },
  {
    label: "Tenants & Usuarios",
    href: "/super-admin/tenants",
    icon: Building2,
  },
  {
    label: "Agentes Globais",
    href: "/super-admin/agents",
    icon: ShieldCheck,
  },
  {
    label: "Templates Globais",
    href: "/super-admin/templates",
    icon: FileText,
  },
  {
    label: "Workflow Builder",
    href: "/super-admin/workflows",
    icon: Workflow,
  },
  {
    label: "Disponibilizar Workflows",
    href: "/super-admin/workflow-library",
    icon: LibraryBig,
  },
];

const operatorNav: NavItem[] = [
  {
    label: "Visao Geral",
    href: "/operator",
    icon: LayoutDashboard,
  },
  {
    label: "Workflows",
    href: "/operator/workflows",
    icon: Workflow,
  },
  {
    label: "Iniciar Traducao",
    href: "/operator/start-translation",
    icon: BadgeCheck,
  },
  {
    label: "Revisoes Pendentes",
    href: "/reviews",
    icon: History,
  },
  {
    label: "Jobs",
    href: "/operator/jobs",
    icon: FileText,
  },
];

function getItems(role: AppRole) {
  return role === "super-admin" ? superAdminNav : operatorNav;
}

export function AppSidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const items = getItems(role);

  return (
    <aside className="hidden border-r bg-muted/40 md:flex md:w-64 md:flex-col">
      <div className="px-6 py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Translator Pro
        </p>
        <h1 className="text-xl font-bold leading-tight">
          {role === "super-admin" ? "Super-Admin" : "Operador"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {role === "super-admin"
            ? "Configure tenants, agentes e workflows globais."
            : "Execute traducoes, revisoes e acompanhe jobs."}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-6">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

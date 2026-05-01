"use client";

import type { Session } from "next-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardCheck,
  Layers,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardUserMenu } from "@/components/admin/dashboard/DashboardUserMenu";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffNavItems,
  isStaffNavItemActive,
  type StaffNavItemId,
} from "@/lib/staff-app-nav";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  roleHomePath,
} from "@/lib/roles";

const ICONS: Record<StaffNavItemId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  students: Users,
  batches: Layers,
  attendance: ClipboardCheck,
  progress: TrendingUp,
};

type StaffAppShellProps = {
  session: Session | null;
  children: React.ReactNode;
};

function staffRoleGate(role: string | undefined): boolean {
  return (
    role === ROLE_ADMIN ||
    role === ROLE_HEAD_COACH ||
    role === ROLE_ASSISTANT_COACH
  );
}

export function StaffAppShell({ session, children }: StaffAppShellProps) {
  const pathname = usePathname() ?? "";
  const role = session?.user?.role;

  if (!session?.user || !staffRoleGate(role)) {
    return <>{children}</>;
  }

  const items = getStaffNavItems(role);
  const dashboardHref = roleHomePath(role);

  return (
    <div className="min-h-dvh bg-[#f4f6f8]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-8">
            <Link
              href={dashboardHref}
              className="flex shrink-0 items-center gap-2 text-slate-900"
            >
              <BrandMark size="md" />
              <span className="hidden font-semibold tracking-tight sm:inline">
                MallaTrack
              </span>
            </Link>
            <nav
              className="flex max-w-[min(100vw-8rem,20rem)] items-center gap-1 overflow-x-auto sm:max-w-none"
              aria-label="Main"
            >
              {items.map((item) => {
                const Icon = ICONS[item.id];
                const active = isStaffNavItemActive(
                  pathname,
                  item,
                  dashboardHref,
                );
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                      active
                        ? "bg-slate-900/5 text-amber-900 underline decoration-amber-800/40 underline-offset-4"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/alerts"
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" strokeWidth={2} />
            </Link>
            <Link
              href="/settings"
              className="hidden rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:block"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" strokeWidth={2} />
            </Link>
            <DashboardUserMenu />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

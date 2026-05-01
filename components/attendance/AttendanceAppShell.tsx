"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Layers, LayoutDashboard, LineChart, Users } from "lucide-react";
import { ROLE_ASSISTANT_COACH } from "@/lib/roles";

const ASSISTANT_BOTTOM_NAV = [
  { href: "/assistant-coach", label: "Dash", icon: LayoutDashboard },
  { href: "/students", label: "Kids", icon: Users },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/reports", label: "Stats", icon: LineChart },
  { href: "/attendance", label: "Mark", icon: Check },
] as const;

function assistantNavActive(pathname: string, href: string): boolean {
  if (href === "/assistant-coach") return pathname === "/assistant-coach";
  if (href === "/attendance") {
    return pathname === "/attendance" || pathname.startsWith("/attendance/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AttendanceAppShellProps = {
  role: string;
  children: React.ReactNode;
};

/**
 * Attendance content wrapper — assistant mobile tab bar; top chrome comes from StaffAppShell.
 */
export function AttendanceAppShell({ role, children }: AttendanceAppShellProps) {
  const pathname = usePathname();
  const showAssistantTabBar = role === ROLE_ASSISTANT_COACH;

  return (
    <div
      className={
        showAssistantTabBar ? "pb-[4.75rem] md:pb-0" : ""
      }
    >
      <div className="mx-auto w-full max-w-md px-4 pt-1.5 sm:max-w-2xl sm:px-5 sm:pt-2 md:max-w-4xl md:px-6">
        {children}
      </div>

      {showAssistantTabBar ? (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          aria-label="Assistant navigation"
        >
          <ul className="mx-auto flex max-w-md justify-between gap-1 px-2 pt-2 sm:max-w-lg">
            {ASSISTANT_BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
              const active = assistantNavActive(pathname, href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[9px] font-bold uppercase tracking-wide transition ${
                      active
                        ? "bg-amber-900 text-white shadow-md"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <Icon
                      className="h-5 w-5"
                      strokeWidth={active ? 2.5 : 2}
                      aria-hidden
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

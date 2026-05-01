"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, LogOut, Settings, User } from "lucide-react";
import { ROLE_SUPER_ADMIN } from "@/lib/roles";

function formatRoleLabel(role?: string | null): string {
  if (!role) return "";
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Returns 1–2 letter initials, or null when none can be derived (use icon instead). */
function initialsFromSession(name?: string | null, email?: string | null): string | null {
  const s = (name ?? email ?? "").trim();
  if (!s) return null;
  const parts = s.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return s.slice(0, 2).toUpperCase();
}

export function DashboardUserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  async function handleSignOut() {
    setOpen(false);
    await signOut({ callbackUrl: "/login" });
  }

  const name = session?.user?.name ?? session?.user?.email ?? null;
  const roleLabel = formatRoleLabel(session?.user?.role);
  const initials = initialsFromSession(session?.user?.name, session?.user?.email);

  if (status === "loading") {
    return (
      <div
        className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200/80 ring-1 ring-slate-200/80"
        aria-hidden
      />
    );
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tracking-tight text-slate-700 ring-1 ring-slate-200/90 transition-all duration-200 ease-out hover:bg-slate-200/80 hover:ring-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        {initials ? (
          <span aria-hidden>{initials}</span>
        ) : (
          <User className="h-4 w-4 text-slate-600" aria-hidden />
        )}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[200px] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-100/80"
          role="menu"
          aria-label="Account actions"
        >
          {(name || roleLabel || session?.user?.instituteName || session?.user?.instituteId === null) && (
            <div className="border-b border-slate-100 px-3 py-2">
              {name ? (
                <p className="truncate text-sm font-medium text-slate-900" title={name}>
                  {name}
                </p>
              ) : null}
              {roleLabel ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">{roleLabel}</p>
              ) : null}
              {session?.user?.instituteName?.trim() ? (
                <p
                  className="mt-1 truncate text-xs font-medium text-slate-600"
                  title={session.user.instituteName.trim()}
                >
                  {session.user.instituteName.trim()}
                </p>
              ) : session?.user?.instituteId === null ? (
                <p
                  className={`mt-1 text-xs ${
                    session?.user?.role === ROLE_SUPER_ADMIN
                      ? "text-slate-600"
                      : "text-amber-800"
                  }`}
                >
                  {session?.user?.role === ROLE_SUPER_ADMIN
                    ? "Platform account (no institute)"
                    : "No institute linked to this account"}
                </p>
              ) : null}
            </div>
          )}
          {session?.user?.role === ROLE_SUPER_ADMIN ? (
            <Link
              href="/platform"
              role="menuitem"
              onClick={close}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              Platform
            </Link>
          ) : null}
          <Link
            href="/settings"
            role="menuitem"
            onClick={close}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            <LogOut className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

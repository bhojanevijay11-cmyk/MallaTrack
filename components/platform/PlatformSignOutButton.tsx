"use client";

import { signOut } from "next-auth/react";

export function PlatformSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/login" })}
      className="rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}

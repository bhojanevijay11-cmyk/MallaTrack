"use client";

import { signOut } from "next-auth/react";

export function RoleHomeSignOut() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/login" })}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}

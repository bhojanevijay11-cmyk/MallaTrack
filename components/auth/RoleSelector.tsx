"use client";

import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Megaphone, Network, Shield, Volleyball } from "lucide-react";
import type { RoleTab } from "./types";

const ROLES: { id: RoleTab; label: string; Icon: LucideIcon }[] = [
  { id: "admin", label: "ADMIN", Icon: Shield },
  { id: "head_coach", label: "HEAD", Icon: Megaphone },
  { id: "assistant_coach", label: "ASST", Icon: Volleyball },
  { id: "parent", label: "PARENT", Icon: Network },
];

type RoleSelectorProps = {
  value: RoleTab;
  setRole: (role: RoleTab) => void;
  /** If set, only these roles are shown (login uses all roles by default). */
  allowedRoles?: readonly RoleTab[];
};

export function RoleSelector({
  value,
  setRole,
  allowedRoles,
}: RoleSelectorProps) {
  const roles = allowedRoles?.length
    ? ROLES.filter((r) => allowedRoles.includes(r.id))
    : ROLES;

  useEffect(() => {
    if (!allowedRoles?.length) return;
    if (!roles.length) return;
    if (!roles.some((r) => r.id === value)) {
      setRole(roles[0].id);
    }
  }, [allowedRoles, roles, value, setRole]);

  return (
    <div className="w-full min-w-0">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        SELECT YOUR ROLE
      </p>
      <div
        className="flex w-full gap-2 rounded-xl bg-slate-100/95 p-1.5 ring-1 ring-slate-200/60"
        role="tablist"
        aria-label="Role"
      >
        {roles.map(({ id, label, Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRole(id)}
              className={[
                "flex h-11 min-h-11 w-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-center text-[10px] font-medium leading-tight transition-colors duration-200 sm:h-12 sm:min-h-12 sm:text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50 focus-visible:ring-offset-2",
                active
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-transparent text-slate-500 hover:bg-slate-200/60 hover:text-slate-700",
              ].join(" ")}
            >
              <Icon
                className={[
                  "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
                  active ? "text-white" : "text-slate-400",
                ].join(" ")}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

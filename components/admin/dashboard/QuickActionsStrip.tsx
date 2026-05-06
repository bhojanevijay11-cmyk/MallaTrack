import type { ReactNode } from "react";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Layers,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { QuickActionDef } from "./mockData";

type Props = { actions: QuickActionDef[] };

const ACTION_HREF: Record<string, string> = {
  "progress-review": "/progress/review",
  students: "/students",
  branches: "/branches",
  batches: "/batches",
  coaches: "/coaches",
  attendance: "/attendance",
};

const iconMap: Record<string, ReactNode> = {
  "progress-review": <ClipboardList className="h-3 w-3" aria-hidden />,
  students: <Users className="h-3 w-3" aria-hidden />,
  branches: <Building2 className="h-3 w-3" aria-hidden />,
  batches: <Layers className="h-3 w-3" aria-hidden />,
  coaches: <UserCheck className="h-3 w-3" aria-hidden />,
  attendance: <ClipboardCheck className="h-3 w-3" aria-hidden />,
};

const actionClass =
  "flex min-h-[2.25rem] min-w-0 items-center justify-center gap-1 rounded-lg border border-slate-200/90 bg-muted/40 px-1.5 py-1 text-[11px] font-semibold leading-tight text-slate-900 shadow-sm transition-all duration-200 ease-out hover:border-slate-300 hover:bg-white hover:shadow-md active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:gap-1.5 sm:px-2 sm:text-[12px]";

export function QuickActionsStrip({ actions }: Props) {
  return (
    <nav
      className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-2"
      aria-label="Quick actions"
    >
      {actions.map((a) => (
        <Link
          key={a.id}
          href={ACTION_HREF[a.id] ?? "/admin"}
          className={actionClass}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-primary ring-1 ring-slate-200/80">
            {iconMap[a.id] ?? <ClipboardList className="h-3 w-3" aria-hidden />}
          </span>
          <span className="min-w-0 text-center leading-snug lg:text-left">
            {a.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}

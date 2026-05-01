import { Plus } from "lucide-react";
import Link from "next/link";
import type { QuickActionDef } from "./mockData";
import { DashboardUserMenu } from "./DashboardUserMenu";
import { QuickActionsStrip } from "./QuickActionsStrip";
type Props = {
  dateLabel: string;
  quickActions: QuickActionDef[];
  /** Shown under the subtitle so users see which organization they are working in. */
  instituteLabel?: string | null;
};

export function DashboardHeader({ dateLabel, quickActions, instituteLabel }: Props) {
  return (
    <header className="space-y-1.5">
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] lg:items-start lg:gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <h1 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl md:text-2xl">
                Academy control center
              </h1>
            </div>
            <p className="shrink-0 pt-0.5 text-right text-[11px] font-medium tabular-nums text-slate-400 lg:hidden">
              {dateLabel}
            </p>
          </div>
          <p className="max-w-xl text-[13px] leading-snug text-slate-500 sm:text-sm">
            Students, batches, attendance, and coach coverage.
          </p>
          {instituteLabel?.trim() ? (
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Organization · {instituteLabel.trim()}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 lg:flex lg:items-center lg:justify-center lg:self-center">
          <QuickActionsStrip actions={quickActions} />
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="hidden text-right text-[11px] font-medium tabular-nums text-slate-400 lg:block sm:text-xs">
            {dateLabel}
          </p>
          <div className="flex items-center justify-end gap-2 sm:gap-2.5">
            <Link
              href="/students/new"
              className="hidden items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm cursor-pointer transition-all duration-200 hover:shadow-soft active:scale-[0.97] sm:inline-flex"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Student
            </Link>
            <DashboardUserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

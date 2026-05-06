import type { QuickActionDef } from "./mockData";
import { QuickActionsStrip } from "./QuickActionsStrip";
type Props = {
  dateLabel: string;
  quickActions: QuickActionDef[];
  /** Shown under the subtitle so users see which organization they are working in. */
  instituteLabel?: string | null;
  /** Short role label (e.g. Institute admin). */
  roleLabel?: string;
  /** First-name style greeting; optional. */
  displayName?: string | null;
};

export function DashboardHeader({
  dateLabel,
  quickActions,
  instituteLabel,
  roleLabel = "Institute admin",
  displayName = null,
}: Props) {
  const greeting =
    displayName?.trim() != null && displayName.trim().length > 0
      ? `Hi ${displayName.trim()} — `
      : "";
  return (
    <header className="space-y-1.5">
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] lg:items-start lg:gap-2.5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {roleLabel}
                </p>
                <h1 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl md:text-2xl">
                  Academy control center
                </h1>
              </div>
            </div>
            <p className="shrink-0 pt-0.5 text-right text-[11px] font-medium tabular-nums text-slate-400 lg:hidden">
              {dateLabel}
            </p>
          </div>
          <p className="max-w-xl text-[13px] leading-snug text-slate-500 sm:text-sm">
            {greeting}
            Run the institute day-to-day: roster, locations, batches, coaches, attendance, and progress review.
          </p>
          {instituteLabel?.trim() ? (
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Institute · {instituteLabel.trim()}
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-slate-500">
            <span className="font-medium text-slate-600">Next up:</span> check attendance for today, then open progress review if anything is pending.
          </p>
        </div>

        <div className="min-w-0 lg:flex lg:items-start lg:justify-center lg:self-start">
          <QuickActionsStrip actions={quickActions} />
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <p className="hidden text-right text-[11px] font-medium tabular-nums text-slate-400 lg:block sm:text-xs">
            {dateLabel}
          </p>
        </div>
      </div>
    </header>
  );
}

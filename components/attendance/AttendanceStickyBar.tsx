"use client";

type AttendanceStickyBarProps = {
  present: number;
  absent: number;
  late: number;
  marked: number;
  total: number;
  canSubmit: boolean;
  submitting: boolean;
  /** Draft differs from last loaded/saved server snapshot. */
  unsavedChanges: boolean;
  /** Last bulk submit succeeded (until next edit). */
  recentlySaved: boolean;
  /** Last submit failed; draft on screen was not saved. */
  submitFailed?: boolean;
  /** Sit above fixed assistant bottom tabs (md+ has no tabs). */
  reserveMobileTabBar?: boolean;
  onSubmit: () => void;
};

export function AttendanceStickyBar({
  present,
  absent,
  late,
  marked,
  total,
  canSubmit,
  submitting,
  unsavedChanges,
  recentlySaved,
  submitFailed = false,
  reserveMobileTabBar = false,
  onSubmit,
}: AttendanceStickyBarProps) {
  const progress = total > 0 ? Math.round((marked / total) * 100) : 0;
  const allMarked = total > 0 && marked === total;

  const bottomOffset =
    reserveMobileTabBar
      ? "max-md:bottom-[4.75rem] md:bottom-0"
      : "bottom-0";

  let statusLine: { tone: "slate" | "amber" | "emerald" | "rose"; text: string };
  if (submitting) {
    statusLine = { tone: "slate", text: "Saving…" };
  } else if (submitFailed) {
    statusLine = {
      tone: "rose",
      text: "Save didn’t finish—your marks are still here. Submit again.",
    };
  } else if (recentlySaved) {
    statusLine = { tone: "emerald", text: "Saved to server" };
  } else if (unsavedChanges && allMarked) {
    statusLine = { tone: "amber", text: "Tap submit to save changes" };
  } else if (unsavedChanges && !allMarked) {
    statusLine = { tone: "amber", text: `${total - marked} not marked yet` };
  } else if (!unsavedChanges && allMarked) {
    statusLine = { tone: "slate", text: "Matches last saved attendance" };
  } else {
    statusLine = { tone: "slate", text: `${marked}/${total} marked` };
  }

  const toneClass =
    statusLine.tone === "amber"
      ? "text-amber-900/90"
      : statusLine.tone === "emerald"
        ? "text-emerald-800"
        : statusLine.tone === "rose"
          ? "text-rose-900/90"
          : "text-slate-500";

  const barBorderClass =
    submitFailed && !submitting
      ? "border-rose-200/90 ring-1 ring-rose-100/80"
      : unsavedChanges
        ? "border-amber-300/90 ring-1 ring-amber-200/80"
        : recentlySaved && !submitting
          ? "border-emerald-200/90 ring-1 ring-emerald-100/90"
          : "border-slate-200/90";

  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 z-50 flex justify-center px-2 pt-1 sm:px-4 ${bottomOffset} pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
    >
      <div
        className={`pointer-events-auto w-full max-w-md rounded-2xl border bg-white/95 px-3 py-2.5 shadow-[0_-8px_32px_rgba(15,23,42,0.12)] backdrop-blur-md sm:max-w-2xl sm:px-4 sm:py-3 md:max-w-3xl ${barBorderClass}`}
      >
        <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 sm:mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Attendance marked"
          />
        </div>
        <p className={`mb-1.5 text-[11px] font-medium leading-tight sm:text-xs ${toneClass}`}>
          {statusLine.text}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-600 sm:gap-x-3 sm:text-[13px]">
            <span>
              <span className="font-semibold text-emerald-700">{present}</span>{" "}
              present
            </span>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-semibold text-rose-700">{absent}</span> absent
            </span>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-semibold text-amber-800">{late}</span> late
            </span>
            <span className="w-full text-slate-500 sm:w-auto">
              {marked}/{total} · {progress}%
            </span>
          </div>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
            className="touch-manipulation min-h-[48px] w-full shrink-0 rounded-xl bg-gradient-to-r from-amber-900 to-amber-800 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-950/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[11rem] md:min-w-[12.5rem]"
          >
            {submitting ? "Submitting…" : "Submit Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

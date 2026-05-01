import type { Student360ViewModel } from "@/lib/student-360-data";

export function Student360IdentityHeader({
  identity,
}: {
  identity: Student360ViewModel["identity"];
}) {
  return (
    <header className="flex flex-col gap-1.5 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:gap-2.5 sm:p-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-600 ring-1 ring-slate-200/80 sm:h-11 sm:w-11 sm:text-base"
        aria-hidden
      >
        {identity.monogram}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            {identity.fullName}
          </h2>
          <span
            className={`inline-flex shrink-0 items-center shadow-sm ring-1 ring-black/[0.04] ${identity.readinessBadgeClass}`}
          >
            {identity.readinessLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{identity.metaLine}</p>
        <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-slate-600 sm:gap-x-3 sm:text-xs">
          <span>
            <span className="font-medium text-slate-400">Batch</span>{" "}
            <span className="text-slate-800">{identity.batchLabel}</span>
          </span>
          <span className="hidden text-slate-300 sm:inline" aria-hidden>
            ·
          </span>
          <span>
            <span className="font-medium text-slate-400">Branch</span>{" "}
            <span className="text-slate-800">{identity.branchLabel}</span>
          </span>
        </div>
      </div>
      {identity.lastUpdatedLine ? (
        <p className="shrink-0 text-[11px] text-slate-400 sm:max-w-[11rem] sm:text-right">
          {identity.lastUpdatedLine}
        </p>
      ) : null}
    </header>
  );
}

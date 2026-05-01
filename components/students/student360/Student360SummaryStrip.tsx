import type { Student360ViewModel } from "@/lib/student-360-data";

export function Student360SummaryStrip({
  summary,
}: {
  summary: Student360ViewModel["summary"];
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 md:gap-2">
      {summary.map((card) => (
        <div
          key={card.key}
          className="flex min-h-[3.75rem] flex-col rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 shadow-sm sm:min-h-[4rem] sm:px-2.5 sm:py-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {card.label}
          </p>
          <p className="mt-0.5 flex-1 text-sm font-semibold tabular-nums leading-tight text-slate-900 sm:text-base">
            {card.value}
          </p>
          <p className="mt-auto line-clamp-2 pt-0.5 text-[10px] leading-snug text-slate-500 sm:pt-1 sm:text-[11px]">
            {card.hint}
          </p>
        </div>
      ))}
    </div>
  );
}

type ScoreStripProps = {
  strengthScore: number | null;
  flexibilityScore: number | null;
  techniqueScore: number | null;
  disciplineScore: number | null;
  overallScore: number | null;
  /** Human label, e.g. "On track" */
  indicatorLabel: string;
  /** Slightly larger padding for page header vs compact modal */
  compact?: boolean;
};

function cell(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(v);
}

export function AssessmentReviewScoreStrip({
  strengthScore,
  flexibilityScore,
  techniqueScore,
  disciplineScore,
  overallScore,
  indicatorLabel,
  compact = false,
}: ScoreStripProps) {
  const py = compact ? "py-2 px-2 sm:px-3" : "py-2.5 px-3 sm:px-4";
  const gap = compact ? "gap-1 sm:gap-2" : "gap-2";
  const items: [string, string][] = [
    ["Strength", cell(strengthScore)],
    ["Flexibility", cell(flexibilityScore)],
    ["Technique", cell(techniqueScore)],
    ["Discipline", cell(disciplineScore)],
    ["Overall", cell(overallScore)],
    ["Indicator", indicatorLabel.trim() || "—"],
  ];

  return (
    <div
      className={`flex flex-wrap rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm ${gap}`}
      aria-label="Score summary"
    >
      {items.map(([label, val]) => (
        <div
          key={label}
          className={`flex min-w-[5.5rem] flex-1 flex-col justify-center rounded-lg border border-slate-100/90 bg-white/90 ${py} text-center sm:min-w-[6.5rem]`}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="mt-0.5 tabular-nums text-sm font-semibold leading-none text-slate-900">{val}</span>
        </div>
      ))}
    </div>
  );
}

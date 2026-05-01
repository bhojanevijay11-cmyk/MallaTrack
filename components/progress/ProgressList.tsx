import Link from "next/link";
import { ProgressRow } from "@/components/progress/ProgressRow";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";

export function ProgressList({
  assessments,
  onSelect,
  emptyMessage,
  emptyCtaLabel,
  onEmptyCta,
  emptyCtaHref,
}: {
  assessments: ProgressAssessmentListItem[];
  onSelect: (a: ProgressAssessmentListItem) => void;
  emptyMessage: string;
  emptyCtaLabel?: string;
  onEmptyCta?: () => void;
  /** When set, renders a navigation link instead of invoking `onEmptyCta`. */
  emptyCtaHref?: string;
}) {
  if (assessments.length === 0) {
    const trimmedHref = emptyCtaHref?.trim();
    const showLink = Boolean(emptyCtaLabel && trimmedHref);
    const showButton = Boolean(emptyCtaLabel && onEmptyCta && !trimmedHref);
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">{emptyMessage}</p>
        {showLink ? (
          <Link
            href={trimmedHref ?? ""}
            className="mt-5 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            {emptyCtaLabel}
          </Link>
        ) : showButton ? (
          <button
            type="button"
            onClick={onEmptyCta}
            className="mt-5 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-950/15 transition hover:brightness-105"
          >
            {emptyCtaLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {assessments.map((a) => (
        <li key={a.id}>
          <ProgressRow assessment={a} onSelect={() => onSelect(a)} />
        </li>
      ))}
    </ul>
  );
}

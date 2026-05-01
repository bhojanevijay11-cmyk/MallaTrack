import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";

const STATUS_STYLES: Record<string, string> = {
  [PROGRESS_ASSESSMENT_STATUS.DRAFT]: "bg-slate-100 text-slate-700 ring-slate-200",
  [PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW]:
    "bg-amber-50 text-amber-900 ring-amber-200",
  [PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION]: "bg-red-50 text-red-800 ring-red-200",
  [PROGRESS_ASSESSMENT_STATUS.APPROVED]: "bg-emerald-50 text-emerald-900 ring-emerald-200",
};

const STATUS_LABELS: Record<string, string> = {
  [PROGRESS_ASSESSMENT_STATUS.DRAFT]: "Draft — not submitted",
  [PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW]: "Submitted — awaiting review",
  [PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION]: "Needs revision",
  [PROGRESS_ASSESSMENT_STATUS.APPROVED]: "Approved",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-left text-[10px] font-semibold leading-snug ring-1 ring-inset sm:text-[11px] ${cls}`}
    >
      {label}
    </span>
  );
}

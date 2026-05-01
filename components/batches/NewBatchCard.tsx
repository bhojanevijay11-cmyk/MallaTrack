import { Plus } from "lucide-react";
import Link from "next/link";

export function NewBatchCard() {
  return (
    <Link
      href="/batches/new"
      className="group flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300/90 bg-slate-50/40 px-5 py-8 text-center transition hover:border-primary/50 hover:bg-primary/[0.04]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:border-primary/30 group-hover:text-primary">
        <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <span className="text-sm font-semibold text-slate-800">New Training Batch</span>
      <span className="max-w-[200px] text-xs leading-relaxed text-slate-500">
        Add a cohort, schedule, and roster entry point.
      </span>
    </Link>
  );
}

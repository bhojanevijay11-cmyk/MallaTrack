"use client";

import type { BatchFilterChip } from "@/lib/batch-ui-derive";

const CHIPS: { id: BatchFilterChip; label: string }[] = [
  { id: "all", label: "All Batches" },
  { id: "morning", label: "Morning" },
  { id: "evening", label: "Evening" },
  { id: "elite", label: "Elite" },
];

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  activeChip: BatchFilterChip;
  onChipChange: (chip: BatchFilterChip) => void;
};

export function BatchFilters({ search, onSearchChange, activeChip, onChipChange }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
            />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search batches by name or staff…"
          className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none ring-primary/20 placeholder:text-slate-400 focus:border-primary/40 focus:ring-2"
          autoComplete="off"
        />
      </div>
      <div
        className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end"
        role="group"
        aria-label="Filter batches"
      >
        {CHIPS.map(({ id, label }) => {
          const on = activeChip === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChipChange(id)}
              className={[
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                on
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200/90 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

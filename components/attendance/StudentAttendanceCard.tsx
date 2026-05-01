"use client";

import type { AttendanceMarkStatus } from "@/lib/attendance-status";

type StudentAttendanceCardProps = {
  fullName: string;
  secondaryLine: string;
  initials: string;
  status: AttendanceMarkStatus | null;
  onChange: (status: AttendanceMarkStatus) => void;
};

const ACTIONS: { key: AttendanceMarkStatus; label: string }[] = [
  { key: "PRESENT", label: "Present" },
  { key: "ABSENT", label: "Absent" },
  { key: "LATE", label: "Late" },
];

export function StudentAttendanceCard({
  fullName,
  secondaryLine,
  initials,
  status,
  onChange,
}: StudentAttendanceCardProps) {
  return (
    <article
      className={[
        "rounded-xl border bg-white shadow-sm transition",
        status
          ? "border-slate-300/90 ring-1 ring-slate-200/60"
          : "border-dashed border-slate-200/90",
        "p-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-3",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 gap-2.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 sm:h-10 sm:w-10"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-[15px] font-semibold leading-snug text-slate-900 sm:text-sm md:text-[15px]">
            {fullName}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{secondaryLine}</p>
        </div>
      </div>
      <div className="mt-3 grid min-h-[48px] grid-cols-3 gap-2 sm:mt-0 sm:max-w-md sm:flex-1 sm:grid-cols-none sm:flex sm:gap-2 md:max-w-lg">
        {ACTIONS.map(({ key, label }) => {
          const active = status === key;
          const activeClass =
            key === "PRESENT"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/25 ring-2 ring-emerald-700/50 ring-offset-2 ring-offset-white"
              : key === "ABSENT"
                ? "bg-rose-600 text-white shadow-md shadow-rose-900/25 ring-2 ring-rose-700/50 ring-offset-2 ring-offset-white"
                : "bg-amber-800 text-white shadow-md shadow-amber-950/25 ring-2 ring-amber-900/40 ring-offset-2 ring-offset-white";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={[
                "touch-manipulation rounded-xl px-2 py-3 text-center text-xs font-semibold transition active:scale-[0.98] sm:min-h-[48px] sm:flex-1 sm:py-2.5 sm:text-[13px]",
                active
                  ? activeClass
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-100",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
    </article>
  );
}

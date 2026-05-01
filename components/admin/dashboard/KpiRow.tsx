import { Layers, Percent, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import type { DashboardKpis } from "./mockData";

type Props = { kpis: DashboardKpis };

const cardBase =
  "flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm cursor-pointer transition-all duration-200 ease-out hover:shadow-soft hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-orange-500";

export function KpiRow({ kpis }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/students" className={cardBase}>
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Total active students
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {kpis.totalActiveStudents === null ? "—" : kpis.totalActiveStudents.toLocaleString()}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-primary">
            <Users className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{kpis.totalActiveStudentsHint}</p>
      </Link>

      <Link href="/attendance" className={cardBase}>
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Today attendance %
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {kpis.todayAttendancePct === null ? "—" : `${kpis.todayAttendancePct}%`}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-secondary">
            <Percent className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{kpis.todayAttendanceHint}</p>
      </Link>

      <Link href="/batches" className={cardBase}>
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Total active batches
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {kpis.activeBatchesToday === null ? "—" : kpis.activeBatchesToday}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Layers className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{kpis.activeBatchesHint}</p>
      </Link>

      <Link href="/coaches" className={cardBase}>
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Active coaches
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {kpis.activeCoaches === null ? "—" : kpis.activeCoaches}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <UserCheck className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{kpis.activeCoachesHint}</p>
      </Link>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import type { Student360ActionTier, Student360ViewModel } from "@/lib/student-360-data";

function CardShell({
  title,
  subtitle,
  children,
  denseHeader,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Tighter header when subtitle is short */
  denseHeader?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
      <div
        className={`border-b border-slate-100 ${denseHeader ? "pb-2" : "pb-2.5"}`}
      >
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className={`mt-0.5 text-xs text-slate-500 ${denseHeader ? "line-clamp-2" : ""}`}>
          {subtitle}
        </p>
      </div>
      <div className="pt-2">{children}</div>
    </section>
  );
}

function AttendanceBlock({ attendance }: { attendance: Student360ViewModel["attendance"] }) {
  const r = attendance.rollup;
  const rateLabel =
    attendance.ratePct != null ? `${attendance.ratePct}%` : r ? "—" : "No data";
  return (
    <CardShell title={attendance.title} subtitle={attendance.subtitle} denseHeader>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Attendance rate
          </p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {rateLabel}
          </p>
        </div>
        <p className="max-w-[11rem] text-right text-[10px] leading-snug text-slate-400">
          Present + late ÷ rows (7-day)
        </p>
      </div>
      <div
        className="mt-2.5 flex items-end justify-between gap-1 rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-100"
        aria-label="Seven day attendance"
      >
        {attendance.weekStrip.map((day) => (
          <div key={day.ymd} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full max-w-[2rem] rounded-md ${
                day.kind === "attended"
                  ? "bg-emerald-400/90"
                  : day.kind === "absent"
                    ? "bg-red-300/90"
                    : "bg-slate-200/90"
              }`}
              style={{ height: `${Math.max(24, day.barHeight * 52)}px` }}
              title={`${day.ymd}: ${day.kind}`}
            />
            <span className="text-[10px] font-medium text-slate-400">{day.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Present
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {r ? String(r.presentCount) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Late
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-800">
            {r ? String(r.lateCount) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Absent
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-red-800">
            {r ? String(r.absentCount) : "—"}
          </p>
        </div>
      </div>
    </CardShell>
  );
}

function ProgressBlock({ progress }: { progress: Student360ViewModel["progress"] }) {
  return (
    <CardShell title={progress.title} subtitle={progress.subtitle} denseHeader>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Overall score
          </p>
          <p className="mt-0.5 text-3xl font-bold tabular-nums text-slate-900">
            {progress.overallScore}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-200/80">
          {progress.indicatorLabel}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {progress.scores.map((row) => (
          <div
            key={row.label}
            className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {row.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{row.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600 ring-1 ring-slate-100">
        {progress.latestLine}
      </p>
    </CardShell>
  );
}

function FeedbackNoteBlock({ vm }: { vm: NonNullable<Student360ViewModel["feedback"]["primary"]> }) {
  return (
    <>
      {vm.title ? (
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {vm.title}
        </p>
      ) : null}
      <blockquote className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-100/80">
        {vm.note}
      </blockquote>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
        <span className="font-medium text-slate-600">{vm.authorLabel}</span>
        <span className="text-slate-300">·</span>
        <span>{vm.dateLabel}</span>
      </div>
    </>
  );
}

function FeedbackBlock({ feedback }: { feedback: Student360ViewModel["feedback"] }) {
  const countLine =
    feedback.visibleReviewCount > 0
      ? `${feedback.visibleReviewCount} total note${feedback.visibleReviewCount === 1 ? "" : "s"}`
      : null;

  return (
    <CardShell title={feedback.title} subtitle={feedback.subtitle} denseHeader>
      {countLine ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {countLine}
        </p>
      ) : null}
      {feedback.primary ? (
        <FeedbackNoteBlock vm={feedback.primary} />
      ) : (
        <p className="text-sm text-slate-500">No notes in your visibility.</p>
      )}
      {feedback.secondary ? (
        <div className="mt-3 border-t border-dashed border-slate-200 pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Earlier note
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{feedback.secondary.note}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {feedback.secondary.authorLabel} · {feedback.secondary.dateLabel}
          </p>
        </div>
      ) : null}
    </CardShell>
  );
}

function actionLinkClass(tier: Student360ActionTier): string {
  if (tier === "primary") {
    return "inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-950/15 transition hover:brightness-105";
  }
  if (tier === "secondary") {
    return "inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50";
  }
  return "inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline";
}

function ActionsBlock({ actions }: { actions: Student360ViewModel["actions"] }) {
  return (
    <CardShell title="Actions" subtitle="Shortcuts" denseHeader>
      <div className="flex flex-col gap-1.5">
        {actions.map((a) =>
          a.href && !a.disabled ? (
            <Link key={a.key} href={a.href} className={actionLinkClass(a.tier)}>
              {a.label}
            </Link>
          ) : (
            <button
              key={a.key}
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-400"
            >
              {a.label}
              {a.key === "mark_attendance" && a.disabled ? (
                <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                  Assign a batch to enable
                </span>
              ) : null}
            </button>
          ),
        )}
      </div>
    </CardShell>
  );
}

function QuickFactsBlock({ facts }: { facts: Student360ViewModel["quickFacts"] }) {
  return (
    <CardShell title="Quick facts" subtitle="Directory" denseHeader>
      <ul className="space-y-1.5">
        {facts.map((row) => (
          <li
            key={row.label}
            className="flex items-baseline justify-between gap-2 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {row.label}
            </span>
            <span className="max-w-[62%] text-right text-sm font-medium leading-snug text-slate-800">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function ActivityBlock({ activity }: { activity: Student360ViewModel["activity"] }) {
  return (
    <CardShell title={activity.title} subtitle={activity.subtitle} denseHeader>
      <ul className="space-y-1.5">
        {activity.items.map((item, idx) => (
          <li
            key={`${item.title}-${idx}`}
            className={`flex gap-2.5 rounded-lg border px-2.5 py-2 ${
              item.isLatest
                ? "border-amber-200/80 bg-amber-50/50 ring-1 ring-amber-100/80"
                : "border-slate-100 bg-slate-50/80 ring-1 ring-slate-100/50"
            }`}
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ring-white ${
                item.isLatest ? "bg-amber-500" : "bg-slate-300"
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.isLatest ? (
                  <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/90">
                    Latest
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">{item.detail}</p>
              <p className="mt-1 text-[11px] text-slate-400">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

export function Student360MainGrid({ data }: { data: Student360ViewModel }) {
  return (
    <div className="grid gap-3 md:grid-cols-12 md:items-start md:gap-4">
      {/* Mobile: actions rail first; md+: main column left, rail right */}
      <div className="order-2 flex flex-col gap-3 md:order-1 md:col-span-8">
        <AttendanceBlock attendance={data.attendance} />
        <ProgressBlock progress={data.progress} />
        <FeedbackBlock feedback={data.feedback} />
      </div>
      <aside className="order-1 flex flex-col gap-3 md:order-2 md:col-span-4 md:sticky md:top-4 md:self-start">
        <ActionsBlock actions={data.actions} />
        <QuickFactsBlock facts={data.quickFacts} />
        <ActivityBlock activity={data.activity} />
      </aside>
    </div>
  );
}

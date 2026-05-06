"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Dumbbell,
  Layers,
  LayoutDashboard,
  PenLine,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { CoachAttentionSummary } from "@/components/operations/CoachAttentionSummary";
import {
  isMarkedAttendanceStatus,
  normalizeStoredAttendanceStatus,
} from "@/lib/attendance-status";
import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";
import type { ProgressAlertCounts } from "@/lib/progress-alerts";

type BatchRow = {
  id: string;
  name: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  studentCount: number;
  branchName: string | null;
};

type AttendancePreview = { marked: number; total: number };

const BOTTOM_NAV = [
  { href: "/assistant-coach", label: "Dash", icon: LayoutDashboard },
  { href: "/students", label: "Kids", icon: Users },
  { href: "/progress", label: "Progress", icon: PenLine },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/attendance", label: "Mark", icon: Check },
] as const;

function assistantNavActive(pathname: string, href: string): boolean {
  if (href === "/assistant-coach") return pathname === "/assistant-coach";
  if (href === "/progress") return pathname === "/progress";
  if (href === "/attendance") {
    return pathname === "/attendance" || pathname.startsWith("/attendance/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatBatchTimeRange(b: Pick<BatchRow, "startTime" | "endTime">): string {
  if (b.startTime && b.endTime) return `${b.startTime} – ${b.endTime}`;
  if (b.startTime) return b.startTime;
  if (b.endTime) return b.endTime;
  return "—";
}

function attendancePreviewLabel(p: AttendancePreview | undefined): string | null {
  if (!p || p.total === 0) return null;
  if (p.marked === 0) return "Attendance today: not marked yet";
  if (p.marked === p.total) return "Attendance today: complete";
  return `Attendance today: ${p.marked}/${p.total} marked`;
}

function uniqueBranchNames(batches: BatchRow[]): string[] {
  const set = new Set<string>();
  for (const b of batches) {
    const n = b.branchName?.trim();
    if (n) set.add(n);
  }
  return [...set];
}

export function AssistantCoachDashboard({
  initialProgressAlerts = null,
}: {
  initialProgressAlerts?: ProgressAlertCounts | null;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [attendanceByBatch, setAttendanceByBatch] = useState<
    Record<string, AttendancePreview | undefined>
  >({});

  const displayName =
    session?.user?.name?.split("@")[0] ??
    session?.user?.email?.split("@")[0] ??
    "Coach";

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/batches", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        batches?: Array<{
          id: string;
          name: string | null;
          status?: string;
          startTime: string | null;
          endTime: string | null;
          studentCount?: number;
          branchName?: string | null;
        }>;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.batches)) {
        setBatches([]);
        return;
      }
      setBatches(
        data.batches.map((b) => ({
          id: b.id,
          name: b.name,
          status: typeof b.status === "string" ? b.status : "ACTIVE",
          startTime: b.startTime,
          endTime: b.endTime,
          studentCount: typeof b.studentCount === "number" ? b.studentCount : 0,
          branchName:
            typeof b.branchName === "string" && b.branchName.trim()
              ? b.branchName.trim()
              : null,
        })),
      );
    } catch {
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const activeBatches = useMemo(
    () =>
      (batches ?? []).filter((b) => (b.status ?? "").toUpperCase() === "ACTIVE"),
    [batches],
  );

  useEffect(() => {
    if (!activeBatches.length) {
      setAttendanceByBatch({});
      return;
    }
    const today = getIndiaTodayCalendarYmd();
    if (!today) {
      setAttendanceByBatch({});
      return;
    }

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        activeBatches.map(async (b) => {
          try {
            const q = new URLSearchParams({ batchId: b.id, date: today });
            const res = await fetch(`/api/attendance?${q}`, {
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            const data = (await res.json()) as {
              ok?: boolean;
              students?: Array<{ status?: string | null }>;
            };
            if (!res.ok || !data.ok || !Array.isArray(data.students)) {
              return { id: b.id, preview: undefined as AttendancePreview | undefined };
            }
            const total = data.students.length;
            const marked = data.students.filter((s) =>
              isMarkedAttendanceStatus(normalizeStoredAttendanceStatus(s.status)),
            ).length;
            return { id: b.id, preview: { marked, total } as AttendancePreview };
          } catch {
            return { id: b.id, preview: undefined as AttendancePreview | undefined };
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, AttendancePreview | undefined> = {};
      for (const r of results) {
        if (r.preview) next[r.id] = r.preview;
      }
      setAttendanceByBatch(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBatches]);

  const assignedBatches = batches ?? [];
  const totalStudentsAcrossAssigned = assignedBatches.reduce(
    (acc, b) => acc + (b.studentCount ?? 0),
    0,
  );
  const totalStudentsActiveBatches = activeBatches.reduce(
    (acc, b) => acc + (b.studentCount ?? 0),
    0,
  );
  const totalStudentsDisplay =
    batches === null ? null : totalStudentsAcrossAssigned;

  const branchSummary = useMemo(() => {
    if (!assignedBatches.length) return { title: "—", subtitle: "Location for your batches" };
    const names = uniqueBranchNames(assignedBatches);
    if (names.length === 0) return { title: "—", subtitle: "Location not set on batches" };
    if (names.length === 1) return { title: names[0]!, subtitle: "Your training location" };
    return { title: `${names.length} locations`, subtitle: names.join(" · ") };
  }, [assignedBatches]);

  const heroBatch = activeBatches[0];
  const hasAssignedActive = activeBatches.length > 0;
  const hasAnyAssignment = batches !== null && assignedBatches.length > 0;
  const onlyInactiveAssignments = hasAnyAssignment && !hasAssignedActive;
  const singleActiveBatch = activeBatches.length === 1;

  return (
    <div className="pb-24 md:pb-6">
      <main className="mx-auto max-w-lg px-4 py-3 sm:max-w-4xl lg:max-w-6xl lg:py-4">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Assistant coach
        </p>
        <p className="mt-0.5 text-center text-sm font-semibold text-slate-900">Hi {displayName}</p>
        {session?.user?.instituteName?.trim() ? (
          <p className="mt-1 text-center text-xs font-medium text-slate-600">
            Institute · {session.user.instituteName.trim()}
          </p>
        ) : session?.user?.instituteId === null ? (
          <p className="mt-1 text-center text-xs text-amber-800">No institute linked</p>
        ) : null}
        <p className="mx-auto mt-2 max-w-md text-center text-[13px] leading-snug text-slate-600">
          Draft and submit progress assessments for your head coach to review. Mark attendance for your assigned batches.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-3 lg:items-start">
          <div className="space-y-3 lg:col-span-2">
            <section className="relative overflow-hidden rounded-xl border border-amber-900/10 bg-gradient-to-br from-white to-amber-50/80 p-3 shadow-sm sm:p-3.5">
              <Dumbbell
                className="pointer-events-none absolute -right-4 -top-4 h-36 w-36 rotate-12 text-amber-900/[0.06]"
                strokeWidth={1}
                aria-hidden
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900/70">
                {hasAssignedActive
                  ? singleActiveBatch
                    ? "Your batch"
                    : "Your assigned batches"
                  : onlyInactiveAssignments
                    ? "Your assignments"
                    : "Active session"}
              </p>
              {batches === null ? (
                <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  Loading…
                </h1>
              ) : !hasAnyAssignment ? (
                <>
                  <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    No session scheduled
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Ask your Head Coach for a batch assignment.
                  </p>
                </>
              ) : onlyInactiveAssignments ? (
                <>
                  <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    No active batches
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    You have {assignedBatches.length} assigned batch
                    {assignedBatches.length === 1 ? "" : "es"} marked inactive. Attendance is available when a batch is
                    active.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href="/batches"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-900/30 bg-white py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
                    >
                      View batches
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Link
                      href="/progress"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      <PenLine className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                      Progress assessments
                    </Link>
                  </div>
                </>
              ) : singleActiveBatch && heroBatch ? (
                <>
                  <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    {heroBatch.name ?? "Batch"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {heroBatch.studentCount} student{heroBatch.studentCount === 1 ? "" : "s"} ·{" "}
                    {formatBatchTimeRange(heroBatch)}
                  </p>
                  {attendancePreviewLabel(attendanceByBatch[heroBatch.id]) ? (
                    <p className="mt-1.5 text-xs font-medium text-slate-600">
                      {attendancePreviewLabel(attendanceByBatch[heroBatch.id])}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Schedule
                      </p>
                      <p className="font-semibold text-slate-900">{formatBatchTimeRange(heroBatch)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Roster
                      </p>
                      <p className="font-semibold text-slate-900">
                        {heroBatch.studentCount} student{heroBatch.studentCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Link
                      href={`/attendance?batchId=${encodeURIComponent(heroBatch.id)}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-900 to-amber-800 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      Mark attendance — {heroBatch.name?.trim() || "Batch"}
                    </Link>
                    <Link
                      href={`/progress?batch=${encodeURIComponent(heroBatch.id)}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-900/35 bg-white py-2.5 text-sm font-medium text-amber-900 shadow-sm transition hover:bg-amber-50"
                    >
                      <PenLine className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                      Progress assessments
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    {activeBatches.length} batches
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {totalStudentsActiveBatches} student{totalStudentsActiveBatches === 1 ? "" : "s"} across your active
                    assignments.
                  </p>
                  <ul className="mt-3 space-y-2 border-t border-amber-900/10 pt-3">
                    {activeBatches.map((b) => {
                      const att = attendanceByBatch[b.id];
                      const attLine = attendancePreviewLabel(att);
                      return (
                        <li
                          key={b.id}
                          className="rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2.5 backdrop-blur-sm"
                        >
                          <p className="font-semibold text-slate-900">{b.name ?? "Batch"}</p>
                          <p className="text-xs text-slate-600">
                            {formatBatchTimeRange(b)} · {b.studentCount} student
                            {b.studentCount === 1 ? "" : "s"}
                          </p>
                          {attLine ? (
                            <p className="mt-1 text-[11px] font-medium text-slate-600">{attLine}</p>
                          ) : null}
                          <div className="mt-2 flex flex-col gap-1.5">
                            <Link
                              href={`/attendance?batchId=${encodeURIComponent(b.id)}`}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-900 to-amber-800 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                              Mark attendance
                            </Link>
                            <Link
                              href={`/progress?batch=${encodeURIComponent(b.id)}`}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-900/30 bg-white py-2 text-[11px] font-medium text-amber-900 transition hover:bg-amber-50"
                            >
                              <PenLine className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                              Progress assessments
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href="/attendance"
                    className="mt-4 block w-full text-center text-xs font-semibold uppercase tracking-wide text-amber-900 hover:underline"
                  >
                    Open attendance (all batches)
                  </Link>
                </>
              )}
            </section>

            {initialProgressAlerts ? (
              <CoachAttentionSummary counts={initialProgressAlerts} />
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Assigned batches</h2>
                <Link
                  href="/batches"
                  className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 hover:underline"
                >
                  Full schedule
                </Link>
              </div>
              <ul className="space-y-2">
                {batches === null ? (
                  <li className="rounded-xl border border-slate-200/80 bg-white px-3 py-4 text-center text-sm text-slate-500">
                    Loading batches…
                  </li>
                ) : batches.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-600">
                    No batches assigned yet. An admin or head coach can assign you from Batch Management (open a batch →
                    Assistant coaches).
                  </li>
                ) : (
                  batches.slice(0, 4).map((b, i) => {
                    const isActive = (b.status ?? "").toUpperCase() === "ACTIVE";
                    const att = isActive ? attendanceByBatch[b.id] : undefined;
                    const attLine = attendancePreviewLabel(att);
                    return (
                      <li key={b.id}>
                        <Link
                          href={`/batches/${encodeURIComponent(b.id)}`}
                          className="block rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-amber-900">
                              {i % 2 === 0 ? (
                                <Sun className="h-5 w-5" strokeWidth={2} />
                              ) : (
                                <Zap className="h-5 w-5" strokeWidth={2} />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900">{b.name ?? "Batch"}</p>
                              <p className="text-xs text-slate-500">
                                {formatBatchTimeRange(b)} · {b.studentCount} students
                                {!isActive ? " · Inactive" : ""}
                              </p>
                              {attLine ? (
                                <p className="mt-0.5 text-[11px] text-slate-600">{attLine}</p>
                              ) : null}
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                          </div>
                        </Link>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Today&apos;s total
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {totalStudentsDisplay === null ? "—" : totalStudentsDisplay}
                </p>
                <p className="text-xs text-slate-500">Students in your assigned batches</p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Location
                </p>
                <p className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  {branchSummary.title}
                </p>
                <p className="text-xs text-slate-500">{branchSummary.subtitle}</p>
              </div>
            </div>

            {hasAnyAssignment ? (
              <p className="hidden text-xs text-slate-500 lg:block">
                Quick links use your scoped roster. Attendance edits follow the 7-day India
                calendar rule.
              </p>
            ) : null}
          </div>
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Assistant navigation"
      >
        <ul className="mx-auto flex max-w-lg justify-between gap-1 px-2 pt-2">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = assistantNavActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[9px] font-bold uppercase tracking-wide transition ${
                    active
                      ? "bg-amber-900 text-white shadow-md"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

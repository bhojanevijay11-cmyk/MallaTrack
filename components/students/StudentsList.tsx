"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import {
  getStudentAlerts,
  PROGRESS_ALERT_TYPE,
  type ProgressAlertViewer,
} from "@/lib/progress-alerts";
import { getStudentReadiness } from "@/lib/progress-readiness";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { studentsListNavContextSuffix } from "@/lib/student-navigation-url";
import {
  parseStudentsActionFilter,
  studentsActionFilterChipLabel,
} from "@/lib/students-url-action-filters";
import {
  pickActiveProgressAssessment,
  studentAssessmentPrimaryAction,
} from "@/lib/student-progress-assessment-helpers";

type StudentsResponse =
  | { ok: true; students: StudentDTO[]; totalInScope?: number }
  | { ok: false; error?: string };

type BatchSummary = {
  id: string;
  name: string | null;
};

type StudentDTO = {
  id: string;
  fullName: string;
  dob: string;
  gender: string;
  parentName: string | null;
  parentPhone: string | null;
  emergencyContact: string | null;
  joiningDate: string;
  status: string;
  batchId: string | null;
  batch: BatchSummary | null;
};

type FilterKey =
  | "ALL"
  | "ACTIVE"
  | "INACTIVE"
  | "UNASSIGNED"
  | "NEEDS_ATTENTION"
  | `BATCH:${string}`;

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function normalizeStatus(status: string | null | undefined): "ACTIVE" | "INACTIVE" {
  if ((status ?? "").toUpperCase() === "ACTIVE") return "ACTIVE";
  return "INACTIVE";
}

function batchDisplayName(student: StudentDTO): string {
  if (!student.batchId || !student.batch) return "Unassigned";
  const n = student.batch.name?.trim();
  return n || "Untitled batch";
}

function toProgressAlertRows(items: ReadonlyArray<ProgressAssessmentListItem>) {
  return items.map((a) => ({
    studentId: a.studentId,
    status: a.status,
    overallScore: a.overallScore,
    assessmentDate: a.assessmentDate.slice(0, 10),
    createdAt: a.createdAt,
    authorUserId: a.authorUserId,
  }));
}

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full px-3.5 py-2 text-sm font-medium transition",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StudentCard({
  student,
  showAssessmentAction,
  listNavSuffix,
  assessmentHref,
  assessmentLabel,
}: {
  student: StudentDTO;
  showAssessmentAction: boolean;
  /** `?filter=…` / `?alert=…` / `?readiness=…` from the list URL when present. */
  listNavSuffix: string;
  assessmentHref: string;
  assessmentLabel: string;
}) {
  const status = normalizeStatus(student.status);
  const batchLabel = batchDisplayName(student);
  const profileHref = `/students/${student.id}${listNavSuffix}`;
  const threeSixtyHref = `/students/${student.id}/360${listNavSuffix}`;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
      <Link
        href={profileHref}
        aria-label={`View profile for ${student.fullName}`}
        className="group -mx-1 -mt-1 rounded-xl p-1 outline-none ring-slate-400 transition hover:bg-slate-50/90 focus-visible:ring-2"
      >
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 transition group-hover:bg-slate-200/80"
            aria-hidden
          >
            {initialsFromName(student.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="truncate text-sm font-semibold leading-snug text-slate-900 group-hover:text-slate-950">
                {student.fullName}
              </h2>
              <span
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
                ].join(" ")}
              >
                {status === "ACTIVE" ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Batch</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className={batchLabel === "Unassigned" ? "text-slate-400" : "text-slate-700"}>
                {batchLabel}
              </span>
            </p>
          </div>
        </div>
      </Link>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2">
        <Link
          href={profileHref}
          className="text-xs font-semibold text-amber-900 underline-offset-2 transition hover:underline"
        >
          View Profile
        </Link>
        <Link
          href={threeSixtyHref}
          className="text-xs font-semibold text-amber-900 underline-offset-2 transition hover:underline"
          title="Attendance, progress, and feedback in one view"
        >
          View 360
        </Link>
        {showAssessmentAction ? (
          <Link
            href={assessmentHref}
            className="text-xs font-semibold text-amber-900 underline-offset-2 transition hover:underline"
          >
            {assessmentLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function StudentsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /** Stable key so memo/effects rerun when hydration fills in query params (same object reference edge cases). */
  const searchParamsKey = searchParams.toString();
  const { data: session, status: sessionStatus } = useSession();
  const showAttentionFilter = session?.user?.role === "head_coach";
  const showStudentCardAssessment =
    sessionStatus === "authenticated" &&
    (session?.user?.role === ROLE_ASSISTANT_COACH || session?.user?.role === ROLE_HEAD_COACH);

  const actionFilter = useMemo(
    () => parseStudentsActionFilter(searchParams),
    [searchParams, searchParamsKey],
  );
  const actionFilterKey = actionFilter ? `${actionFilter.kind}:${actionFilter.value}` : "none";

  const listNavSuffix = useMemo(
    () => studentsListNavContextSuffix(searchParams),
    [searchParams, searchParamsKey],
  );

  const progressViewer = useMemo((): ProgressAlertViewer | null => {
    if (sessionStatus !== "authenticated" || !session?.user?.id) return null;
    const role = session.user.role;
    if (role === ROLE_ADMIN) return { kind: "admin" };
    if (role === ROLE_HEAD_COACH) return { kind: "head_coach" };
    if (role === ROLE_ASSISTANT_COACH) return { kind: "assistant", userId: session.user.id };
    return null;
  }, [session, sessionStatus]);

  const [students, setStudents] = useState<StudentDTO[] | null>(null);
  /** Count in scope before server-side needs-attention filter (from API). */
  const [totalInScope, setTotalInScope] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  /**
   * Progress assessments visible to the current coach (same payload as GET /api/progress/assessments).
   * Used for URL action filters and state-aware assessment links on cards.
   */
  const [scopeAssessments, setScopeAssessments] = useState<ProgressAssessmentListItem[] | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const hadActionFilterUrl = useRef(false);
  /** Bumps when the user retries after a fetch error (same deps otherwise would not re-run). */
  const [listReloadNonce, setListReloadNonce] = useState(0);

  const updateFilter = useCallback(
    (next: FilterKey) => {
      setFilter(next);
      if (next === "NEEDS_ATTENTION") {
        router.replace(`${pathname}?filter=needs-attention`, { scroll: false });
      } else {
        router.replace(pathname, { scroll: false });
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    if (sessionStatus === "loading") return;
    const sp = searchParams.get("filter");
    if (sp === "needs-attention") {
      if (session?.user?.role === "head_coach") {
        setFilter("NEEDS_ATTENTION");
      } else {
        router.replace(pathname, { scroll: false });
      }
    }
  }, [searchParams, sessionStatus, session, pathname, router]);

  /** URL-driven alert/readiness filters replace the student list from the server; reset local pills so a prior chip choice cannot hide every row until click (same-route ?query updates preserve React state). */
  useLayoutEffect(() => {
    if (actionFilterKey === "none") return;
    setFilter("ALL");
  }, [actionFilterKey]);

  useEffect(() => {
    if (actionFilter) {
      setStudents(null);
      setTotalInScope(null);
    } else if (hadActionFilterUrl.current) {
      setStudents(null);
      setTotalInScope(null);
    }
    hadActionFilterUrl.current = Boolean(actionFilter);

    if (actionFilter && sessionStatus === "loading") return;

    const controller = new AbortController();
    void (async () => {
      try {
        setError(null);
        setProgressError(null);
        const q = filter === "NEEDS_ATTENTION" ? "?filter=needs-attention" : "";

        const coachCards =
          session?.user?.role === ROLE_ASSISTANT_COACH ||
          session?.user?.role === ROLE_HEAD_COACH;

        if (actionFilter) {
          const isCoachFeedback =
            actionFilter.kind === "alert" &&
            actionFilter.value === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK;
          const isLowAttendanceAlert =
            actionFilter.kind === "alert" &&
            actionFilter.value === PROGRESS_ALERT_TYPE.LOW_ATTENDANCE;

          if (isCoachFeedback || isLowAttendanceAlert) {
            const alertParam = isCoachFeedback
              ? PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK
              : PROGRESS_ALERT_TYPE.LOW_ATTENDANCE;
            const stRes = await fetch(`/api/students?alert=${alertParam}`, {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            const stData = (await stRes.json()) as StudentsResponse;
            if (controller.signal.aborted) return;
            if (!stRes.ok || !stData.ok) {
              setError("list");
              setStudents([]);
              setTotalInScope(null);
              setScopeAssessments(null);
              return;
            }
            setProgressError(null);
            const list = Array.isArray(stData.students) ? stData.students : [];
            const scopeTotal =
              typeof stData.totalInScope === "number" && Number.isFinite(stData.totalInScope)
                ? stData.totalInScope
                : list.length;
            setTotalInScope(scopeTotal);
            setStudents(
              list.map((s) => ({
                ...s,
                batchId: s.batchId ?? null,
                batch: s.batch ?? null,
              })),
            );

            if (coachCards) {
              const prRes = await fetch("/api/progress/assessments", {
                method: "GET",
                signal: controller.signal,
                headers: { Accept: "application/json" },
                cache: "no-store",
              });
              const prData = (await prRes.json()) as
                | { ok: true; assessments: ProgressAssessmentListItem[] }
                | { ok: false; error?: string };
              if (controller.signal.aborted) return;
              if (!prRes.ok || !prData.ok || !("assessments" in prData)) {
                setScopeAssessments([]);
              } else {
                setScopeAssessments(
                  Array.isArray(prData.assessments) ? prData.assessments : [],
                );
              }
            } else {
              setScopeAssessments(null);
            }
            return;
          }

          const [stRes, prRes] = await Promise.all([
            fetch(`/api/students${q}`, {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
              cache: "no-store",
            }),
            fetch("/api/progress/assessments", {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
              cache: "no-store",
            }),
          ]);

          const stData = (await stRes.json()) as StudentsResponse;
          if (controller.signal.aborted) return;
          if (!stRes.ok || !stData.ok) {
            setError("list");
            setStudents([]);
            setTotalInScope(null);
            setScopeAssessments(null);
            return;
          }

          const prData = (await prRes.json()) as
            | { ok: true; assessments: ProgressAssessmentListItem[] }
            | { ok: false; error?: string };
          if (controller.signal.aborted) return;
          if (!prRes.ok || !prData.ok || !("assessments" in prData)) {
            setProgressError("Could not load progress for this filter.");
            setScopeAssessments(null);
          } else {
            setScopeAssessments(
              Array.isArray(prData.assessments) ? prData.assessments : [],
            );
          }

          const list = Array.isArray(stData.students) ? stData.students : [];
          const scopeTotal =
            typeof stData.totalInScope === "number" && Number.isFinite(stData.totalInScope)
              ? stData.totalInScope
              : list.length;
          setTotalInScope(scopeTotal);
          setStudents(
            list.map((s) => ({
              ...s,
              batchId: s.batchId ?? null,
              batch: s.batch ?? null,
            })),
          );
          return;
        }

        if (coachCards) {
          const [res, prRes] = await Promise.all([
            fetch(`/api/students${q}`, {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
              cache: "no-store",
            }),
            fetch("/api/progress/assessments", {
              method: "GET",
              signal: controller.signal,
              headers: { Accept: "application/json" },
              cache: "no-store",
            }),
          ]);

          const data = (await res.json()) as StudentsResponse;
          if (controller.signal.aborted) return;
          if (!res.ok || !data.ok) {
            setError("list");
            setStudents([]);
            setTotalInScope(null);
            setScopeAssessments(null);
            return;
          }

          const prData = (await prRes.json()) as
            | { ok: true; assessments: ProgressAssessmentListItem[] }
            | { ok: false; error?: string };
          if (controller.signal.aborted) return;
          if (!prRes.ok || !prData.ok || !("assessments" in prData)) {
            setScopeAssessments([]);
          } else {
            setScopeAssessments(
              Array.isArray(prData.assessments) ? prData.assessments : [],
            );
          }

          const list = Array.isArray(data.students) ? data.students : [];
          const scopeTotal =
            typeof data.totalInScope === "number" && Number.isFinite(data.totalInScope)
              ? data.totalInScope
              : list.length;
          setTotalInScope(scopeTotal);
          setStudents(
            list.map((s) => ({
              ...s,
              batchId: s.batchId ?? null,
              batch: s.batch ?? null,
            })),
          );
        } else {
          setScopeAssessments(null);
          const res = await fetch(`/api/students${q}`, {
            method: "GET",
            signal: controller.signal,
            headers: { Accept: "application/json" },
            cache: "no-store",
          });

          const data = (await res.json()) as StudentsResponse;
          if (controller.signal.aborted) return;
          if (!res.ok || !data.ok) {
            setError("list");
            setStudents([]);
            setTotalInScope(null);
            return;
          }
          const list = Array.isArray(data.students) ? data.students : [];
          const scopeTotal =
            typeof data.totalInScope === "number" && Number.isFinite(data.totalInScope)
              ? data.totalInScope
              : list.length;
          setTotalInScope(scopeTotal);
          setStudents(
            list.map((s) => ({
              ...s,
              batchId: s.batchId ?? null,
              batch: s.batch ?? null,
            })),
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("list");
        setStudents([]);
        setTotalInScope(null);
        if (actionFilter) setScopeAssessments(null);
      }
    })();

    return () => controller.abort();
  }, [
    filter,
    actionFilterKey,
    actionFilter,
    sessionStatus,
    searchParamsKey,
    session?.user?.role,
    listReloadNonce,
  ]);

  const assessmentActionByStudent = useMemo((): ((
    sid: string,
  ) => {
    label: string;
    href: string;
  }) => {
    if (!showStudentCardAssessment) {
      return (sid: string) => studentAssessmentPrimaryAction(sid, null);
    }
    if (scopeAssessments === null) {
      return (sid: string) => studentAssessmentPrimaryAction(sid, null);
    }
    const grouped = new Map<string, ProgressAssessmentListItem[]>();
    for (const a of scopeAssessments) {
      const cur = grouped.get(a.studentId) ?? [];
      cur.push(a);
      grouped.set(a.studentId, cur);
    }
    const activeFor = new Map<string, ProgressAssessmentListItem | null>();
    for (const [sid, rows] of grouped) {
      activeFor.set(sid, pickActiveProgressAssessment(rows));
    }
    return (sid: string) =>
      studentAssessmentPrimaryAction(sid, activeFor.get(sid) ?? null);
  }, [scopeAssessments, showStudentCardAssessment]);

  const batchTabs = useMemo(() => {
    const list = students ?? [];
    const map = new Map<string, string>();
    for (const s of list) {
      if (s.batchId && s.batch) {
        const label = s.batch.name?.trim() || "Untitled batch";
        map.set(s.batchId, label);
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [students]);

  const matchingActionIds = useMemo(() => {
    if (!actionFilter) return null;
    if (
      actionFilter.kind === "alert" &&
      (actionFilter.value === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK ||
        actionFilter.value === PROGRESS_ALERT_TYPE.LOW_ATTENDANCE)
    ) {
      /** Server GET /api/students?alert=… already narrows rows; chip + search refine only. */
      return null;
    }
    if (progressError) return new Set<string>();
    if (scopeAssessments === null) return null;
    if (!progressViewer) return null;

    const byStudent = new Map<string, ProgressAssessmentListItem[]>();
    for (const a of scopeAssessments) {
      const cur = byStudent.get(a.studentId) ?? [];
      cur.push(a);
      byStudent.set(a.studentId, cur);
    }

    const pass = new Set<string>();
    for (const s of students ?? []) {
      const rows = toProgressAlertRows(byStudent.get(s.id) ?? []);
      if (actionFilter.kind === "alert") {
        if (getStudentAlerts(rows, progressViewer).types.includes(actionFilter.value)) {
          pass.add(s.id);
        }
      } else if (getStudentReadiness(rows).level === actionFilter.value) {
        pass.add(s.id);
      }
    }
    return pass;
  }, [actionFilter, scopeAssessments, progressError, progressViewer, students]);

  const filtered = useMemo(() => {
    const list = students ?? [];
    const q = query.trim().toLowerCase();

    return list.filter((s) => {
      if (matchingActionIds && !matchingActionIds.has(s.id)) return false;

      const status = normalizeStatus(s.status);

      if (filter === "ACTIVE" && status !== "ACTIVE") return false;
      if (filter === "INACTIVE" && status !== "INACTIVE") return false;
      if (filter === "UNASSIGNED" && s.batchId) return false;
      if (filter.startsWith("BATCH:")) {
        const bid = filter.slice("BATCH:".length);
        if (s.batchId !== bid) return false;
      }

      if (!q) return true;
      return (s.fullName ?? "").toLowerCase().includes(q);
    });
  }, [students, query, filter, matchingActionIds]);

  const hasStudents = (students?.length ?? 0) > 0;
  const noActionMatches =
    Boolean(actionFilter) &&
    !progressError &&
    hasStudents &&
    matchingActionIds !== null &&
    matchingActionIds.size === 0;
  const showNoResults = hasStudents && filtered.length === 0 && !noActionMatches;
  const isGlobalEmpty =
    !error && students !== null && totalInScope !== null && totalInScope === 0;
  const isAttentionFilterEmpty =
    !error &&
    students !== null &&
    totalInScope !== null &&
    filter === "NEEDS_ATTENTION" &&
    !hasStudents &&
    totalInScope > 0;

  const isServerAlertListEmpty =
    !error &&
    students !== null &&
    totalInScope !== null &&
    totalInScope > 0 &&
    actionFilter?.kind === "alert" &&
    (actionFilter.value === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK ||
      actionFilter.value === PROGRESS_ALERT_TYPE.LOW_ATTENDANCE) &&
    (students?.length ?? 0) === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Student registry
          </p>
          <p className="mt-1 text-base text-slate-600">
            Search and manage your students in one place.
          </p>
        </div>
        <Link
          href="/students/new"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
        >
          New Student
        </Link>
      </div>

      {actionFilter ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
          <p className="text-sm text-slate-800">
            <span className="font-semibold text-slate-900">Filtered:</span>{" "}
            {studentsActionFilterChipLabel(actionFilter)}
          </p>
          {students !== null ? (
            <p className="text-sm tabular-nums text-slate-600">
              Showing {filtered.length} student{filtered.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <Link
            href="/students"
            className="text-sm font-semibold text-amber-900 underline-offset-2 hover:underline sm:ml-auto"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10.5 18C14.6421 18 18 14.6421 18 10.5C18 6.35786 14.6421 3 10.5 3C6.35786 3 3 6.35786 3 10.5C3 14.6421 6.35786 18 10.5 18Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 21L15.75 15.75"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill active={filter === "ALL"} onClick={() => updateFilter("ALL")}>
            All Students
          </Pill>
          <Pill active={filter === "ACTIVE"} onClick={() => updateFilter("ACTIVE")}>
            Active
          </Pill>
          <Pill active={filter === "INACTIVE"} onClick={() => updateFilter("INACTIVE")}>
            Inactive
          </Pill>
          <Pill active={filter === "UNASSIGNED"} onClick={() => updateFilter("UNASSIGNED")}>
            Unassigned
          </Pill>
          {showAttentionFilter ? (
            <Pill
              active={filter === "NEEDS_ATTENTION"}
              onClick={() => updateFilter("NEEDS_ATTENTION")}
            >
              Needs attention
            </Pill>
          ) : null}
          {batchTabs.map(({ id, label }) => (
            <Pill
              key={id}
              active={filter === `BATCH:${id}`}
              onClick={() => updateFilter(`BATCH:${id}`)}
            >
              {label}
            </Pill>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-950">Couldn&apos;t load the student list</p>
          <p className="mt-1 text-amber-900/90">
            Check your connection, then try again. If this keeps happening, refresh the page.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setListReloadNonce((n) => n + 1);
            }}
            className="mt-3 inline-flex items-center justify-center rounded-xl border border-amber-300/80 bg-white px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50"
          >
            Try again
          </button>
        </div>
      ) : null}

      {progressError ? (
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-950">Progress data didn&apos;t load for this filter</p>
          <p className="mt-1 text-amber-900/90">
            The student list is shown, but alert/readiness matching needs progress data. Try{" "}
            <button
              type="button"
              onClick={() => {
                setProgressError(null);
                setListReloadNonce((n) => n + 1);
              }}
              className="font-semibold underline decoration-amber-800/40 underline-offset-2 hover:decoration-amber-900"
            >
              reload
            </button>{" "}
            or clear the filter — coaching cards still work from the full list.
          </p>
        </div>
      ) : null}

      {students === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[148px] animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100/60"
            />
          ))}
        </div>
      ) : noActionMatches ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">No students match this filter</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {actionFilter?.kind === "alert" &&
            actionFilter.value === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK ? (
              <>
                No students currently have pending parent-visible staff feedback drafts in your scope.
              </>
            ) : (
              <>No one in your current scope matches this alert or readiness view.</>
            )}
          </p>
          <Link
            href="/students"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Clear filter
          </Link>
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((s) => {
            const assessmentAction = assessmentActionByStudent(s.id);
            return (
              <StudentCard
                key={s.id}
                student={s}
                showAssessmentAction={showStudentCardAssessment}
                listNavSuffix={listNavSuffix}
                assessmentHref={assessmentAction.href}
                assessmentLabel={assessmentAction.label}
              />
            );
          })}
        </div>
      ) : isServerAlertListEmpty ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">
            {actionFilter?.kind === "alert" &&
            actionFilter.value === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK
              ? "No pending staff feedback"
              : "No students match this filter"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {actionFilter?.kind === "alert" &&
            actionFilter.value === PROGRESS_ALERT_TYPE.PENDING_COACH_FEEDBACK ? (
              <>
                No students currently have pending parent-visible staff feedback drafts in your scope.
              </>
            ) : (
              <>
                No one in your current scope matches this alert view (the server returned an empty list while your
                registry still has students).
              </>
            )}
          </p>
          <Link
            href="/students"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Clear filter
          </Link>
        </div>
      ) : isAttentionFilterEmpty ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">No students need attention right now</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Your branch still has students on file — none currently match inactive, absence, or low-attendance
            signals.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => updateFilter("ALL")}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              View all students
            </button>
            <Link
              href="/students"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Clear filter
            </Link>
          </div>
        </div>
      ) : showNoResults ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">No students found</p>
          <p className="mt-2 text-sm text-slate-600">
            Try a different search or filter.
          </p>
          {filter !== "ALL" ? (
            <button
              type="button"
              onClick={() => updateFilter("ALL")}
              className="mt-6 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Clear filter
            </button>
          ) : null}
        </div>
      ) : isGlobalEmpty ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">No students yet</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Add your first student to start building your registry.
          </p>
          <Link
            href="/students/new"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Add first student
          </Link>
        </div>
      ) : null}
    </div>
  );
}

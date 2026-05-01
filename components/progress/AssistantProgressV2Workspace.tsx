"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ListSkeleton } from "@/components/progress/ListSkeleton";
import { ProgressList } from "@/components/progress/ProgressList";
import { StatusBadge } from "@/components/progress/StatusBadge";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import {
  PROGRESS_ASSESSMENT_STATUS,
  type ProgressAssessmentStatusValue,
} from "@/lib/progress-assessment-constants";
import { formatAssessmentDateYmd } from "@/lib/progress-assessment-display";
import { ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";

type StudentOption = { id: string; fullName: string; batchName: string | null; batchId: string | null };

type ListResponse = { ok: true; assessments: ProgressAssessmentListItem[] } | { ok: false; error?: string };

export function AssistantProgressV2Workspace({
  students,
  initialBatchId,
  initialStatusFilter = null,
  viewerRole,
}: {
  students: StudentOption[];
  /** Optional batch scope (e.g. `?batch=` from dashboard). */
  initialBatchId?: string;
  /** From `?status=` — list filters your assessments by workflow state (monitoring view). */
  initialStatusFilter?: ProgressAssessmentStatusValue | null;
  /** Signed-in role (drives nav hints for head coaches). */
  viewerRole?: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id?.trim() ?? "";
  const router = useRouter();
  const urlSearchParams = useSearchParams();

  const batchScopeLabel = useMemo(() => {
    const bid = initialBatchId?.trim();
    if (!bid) return null;
    const name = students.find((s) => s.batchId === bid)?.batchName?.trim();
    return name || null;
  }, [students, initialBatchId]);

  const [assessments, setAssessments] = useState<ProgressAssessmentListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);

  const fetchList = useCallback(async (opts?: { soft?: boolean }) => {
    setLoadError(null);
    if (opts?.soft) setListRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/progress/assessments", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.ok) {
        setLoadError("Check your connection, or wait a moment and use Try again.");
        setAssessments([]);
        return;
      }
      setAssessments(data.assessments);
    } catch {
      setLoadError("Something interrupted the request. Check your connection and try again.");
      setAssessments([]);
    } finally {
      setLoading(false);
      setListRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const mine = useMemo(() => {
    if (!userId) return [];
    return assessments.filter((a) => a.authorUserId === userId);
  }, [assessments, userId]);

  const needsRevision = useMemo(() => {
    if (viewerRole !== ROLE_ASSISTANT_COACH) return [];
    return mine.filter((a) => a.status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION);
  }, [mine, viewerRole]);

  /**
   * Assistants: revision rows are promoted to "Needs revision" above so they are not duplicated here.
   * Head coaches: keep a single combined list (monitoring view).
   */
  const listForMainTable = useMemo(() => {
    const base =
      viewerRole === ROLE_ASSISTANT_COACH
        ? mine.filter((a) => a.status !== PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION)
        : mine;
    if (!initialStatusFilter) return base;
    return base.filter((a) => a.status === initialStatusFilter);
  }, [mine, initialStatusFilter, viewerRole]);

  const clearStatusFilterHref = useMemo(() => {
    const batch = urlSearchParams.get("batch")?.trim();
    if (batch) return `/progress?batch=${encodeURIComponent(batch)}`;
    return "/progress";
  }, [urlSearchParams]);

  const goToAssessmentEditPage = (a: ProgressAssessmentListItem) => {
    const sp = new URLSearchParams();
    const batch = urlSearchParams.get("batch")?.trim();
    const student = urlSearchParams.get("student")?.trim();
    const status = urlSearchParams.get("status")?.trim();
    if (batch) sp.set("batch", batch);
    if (student) sp.set("student", student);
    if (status) sp.set("status", status);
    const qs = sp.toString();
    void router.push(qs ? `/progress/assessments/${a.id}?${qs}` : `/progress/assessments/${a.id}`);
  };

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-soft">
        <p className="text-base font-semibold text-slate-900">No students in scope</p>
        <p className="mt-2 text-sm text-slate-600">
          Assign students to your batches to see progress here. Use{" "}
          <Link href="/students" className="font-semibold text-amber-900 underline-offset-2 hover:underline">
            Students
          </Link>{" "}
          when you are ready to start or continue structured assessments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <header className="min-w-0 space-y-1">
          <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            Your progress overview
          </h2>
          <p className="max-w-2xl text-sm leading-snug text-slate-600">
            Track assessment status and open records you own. Start or continue structured assessments from{" "}
            <Link href="/students" className="font-semibold text-amber-900 underline-offset-2 hover:underline">
              Students
            </Link>
            .
          </p>
          {viewerRole === ROLE_HEAD_COACH ? (
            <p className="max-w-2xl text-xs leading-snug text-slate-700 sm:text-sm">
              <Link
                href="/progress/review?status=PENDING_REVIEW"
                className="font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Review queue
              </Link>
              <span className="text-slate-600"> — pending and revision requests for your branch.</span>
            </p>
          ) : null}
          {initialBatchId?.trim() ? (
            <p className="max-w-2xl text-xs leading-snug text-slate-700 sm:text-sm">
              <span className="font-semibold text-slate-900">Batch scope:</span>{" "}
              {batchScopeLabel ? `${batchScopeLabel} — ` : ""}
              This list respects your batch shortcut; open Progress without a batch filter to see your full roster.
              Choose a student on{" "}
              <Link href="/students" className="font-semibold text-amber-900 underline-offset-2 hover:underline">
                Students
              </Link>{" "}
              to start assessments in student context.
            </p>
          ) : null}
          {initialStatusFilter ? (
            <p className="max-w-2xl text-xs leading-snug text-slate-700 sm:text-sm">
              <span className="font-semibold text-slate-900">Filtered:</span>{" "}
              {initialStatusFilter.replace(/_/g, " ")}.
              <Link
                href={clearStatusFilterHref}
                className="ml-2 font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            </p>
          ) : null}
        </header>
        <Link
          href="/students"
          className="inline-flex w-full shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:w-auto sm:self-start"
        >
          Go to Students
        </Link>
      </div>

      {sessionStatus === "loading" ? (
        <p className="text-sm text-slate-600">Verifying your session…</p>
      ) : !userId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your session could not be confirmed. Sign out and sign back in, then open Progress again.
        </p>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-950">
          <p className="font-medium">Couldn&apos;t load your assessments</p>
          <p className="mt-1 text-red-900/90">{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchList()}
            className="mt-2 inline-flex items-center justify-center rounded-lg border border-red-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-red-950 shadow-sm hover:bg-red-50"
          >
            Try again
          </button>
        </div>
      ) : null}

      {viewerRole === ROLE_ASSISTANT_COACH &&
      sessionStatus !== "loading" &&
      userId &&
      needsRevision.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-800/90">
            Needs revision
          </h3>
          <p className="text-xs leading-snug text-slate-600">
            Your head coach asked for changes. Open an item to read feedback, update the assessment, then
            resubmit for review.
          </p>
          <ul className="space-y-3">
            {needsRevision.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border-2 border-red-200/90 bg-red-50/35 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{a.student.fullName}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatAssessmentDateYmd(a.assessmentDate)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToAssessmentEditPage(a)}
                  className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 sm:w-auto"
                >
                  Fix &amp; Resubmit
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="relative space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Your assessments (records)
          </h3>
          {listRefreshing ? (
            <span className="text-xs font-medium text-slate-500">Updating…</span>
          ) : null}
        </div>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : (
          <ProgressList
            assessments={listForMainTable}
            emptyMessage={
              initialStatusFilter
                ? `No assessments with status “${initialStatusFilter.replace(/_/g, " ")}” in your current list. Your roster may have no records in this state, or the URL filter is narrow.`
                : needsRevision.length > 0 && listForMainTable.length === 0
                  ? "No other assessments here. Items returned by your head coach are listed under Needs revision above."
                  : "No assessment records yet for your account in this view."
            }
            emptyCtaLabel={initialStatusFilter ? "Show all statuses" : "Go to Students"}
            emptyCtaHref={initialStatusFilter ? clearStatusFilterHref : "/students"}
            onSelect={goToAssessmentEditPage}
          />
        )}
      </section>
    </div>
  );
}

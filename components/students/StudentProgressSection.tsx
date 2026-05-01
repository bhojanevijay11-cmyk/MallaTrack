"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ProgressReviewDetail } from "@/components/progress/review/ProgressReviewDetail";
import type { ProgressAssessmentDetailPayload } from "@/components/progress/review/progress-review-types";
import { ListSkeleton } from "@/components/progress/ListSkeleton";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";
import { formatAssessmentDateYmd } from "@/lib/progress-assessment-display";
import {
  getStudentAlerts,
  progressAlertLabel,
  type ProgressAlertType,
  type ProgressAlertViewer,
} from "@/lib/progress-alerts";
import { getStudentReadiness } from "@/lib/progress-readiness";
import {
  indicatorDisplay,
  latestApprovedAssessment,
  StudentProgressList,
} from "@/components/students/StudentProgressList";
import {
  pickActiveProgressAssessment,
  studentAssessmentPrimaryAction,
} from "@/lib/student-progress-assessment-helpers";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type ListResponse = { ok: true; assessments: ProgressAssessmentListItem[] } | { ok: false; error?: unknown };

type DetailResponse =
  | { ok: true; assessment: ProgressAssessmentDetailPayload }
  | { ok: false; error?: unknown };

export function StudentProgressSection({
  studentId,
  userRole,
}: {
  studentId: string;
  userRole: string;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id?.trim() ?? "";

  const canAuthorAssessments =
    userRole === ROLE_ASSISTANT_COACH || userRole === ROLE_HEAD_COACH;
  const canReviewProgress = userRole === ROLE_HEAD_COACH || userRole === ROLE_ADMIN;

  const [assessments, setAssessments] = useState<ProgressAssessmentListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProgressAssessmentDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const reviewNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(async () => {
    if (!studentId) return;
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/progress/assessments?studentId=${encodeURIComponent(studentId)}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      );
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.ok) {
        setLoadError("Could not load progress for this student.");
        setAssessments([]);
        return;
      }
      setAssessments(data.assessments);
    } catch {
      setLoadError("Could not load progress for this student.");
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void fetchList();
  }, [fetchList, refreshTick]);

  useEffect(() => {
    return () => {
      if (reviewNoticeTimerRef.current) clearTimeout(reviewNoticeTimerRef.current);
    };
  }, []);

  const listForViewer = assessments;

  const latestApproved = useMemo(() => latestApprovedAssessment(assessments), [assessments]);
  const activeAssessment = useMemo(
    () => pickActiveProgressAssessment(assessments),
    [assessments],
  );
  const primaryAssessmentAction = useMemo(
    () => studentAssessmentPrimaryAction(studentId, activeAssessment),
    [studentId, activeAssessment],
  );
  const readiness = useMemo(() => getStudentReadiness(assessments), [assessments]);

  const showCoachAttention =
    userRole === ROLE_ADMIN || userRole === ROLE_HEAD_COACH || userRole === ROLE_ASSISTANT_COACH;

  const progressAlertViewer: ProgressAlertViewer = useMemo(
    () =>
      canAuthorAssessments && userId
        ? { kind: "assistant", userId }
        : userRole === ROLE_ADMIN
          ? { kind: "admin" }
          : { kind: "head_coach" },
    [canAuthorAssessments, userId, userRole],
  );

  const progressAlerts = useMemo(() => {
    if (!showCoachAttention) {
      return { types: [] as ProgressAlertType[], primary: null };
    }
    return getStudentAlerts(assessments, progressAlertViewer);
  }, [assessments, progressAlertViewer, showCoachAttention]);

  const bumpRefresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailError(null);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/progress/assessments/${encodeURIComponent(id)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as DetailResponse;
      if (!res.ok || !data.ok || !("assessment" in data)) {
        setDetailError(
          getApiErrorMessageFromPayload(data, "Could not load this assessment."),
        );
        return;
      }
      setDetail(data.assessment);
    } catch {
      setDetailError("Could not load this assessment.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openReadOnlyDetail = (a: ProgressAssessmentListItem) => {
    setDetailModalId(a.id);
    void loadDetail(a.id);
  };

  const closeReadOnlyDetail = useCallback(() => {
    setDetailModalId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const handleReviewFinished = useCallback(
    (message: string) => {
      if (reviewNoticeTimerRef.current) clearTimeout(reviewNoticeTimerRef.current);
      setReviewNotice(message);
      reviewNoticeTimerRef.current = setTimeout(() => setReviewNotice(null), 6000);
      closeReadOnlyDetail();
      bumpRefresh();
    },
    [bumpRefresh, closeReadOnlyDetail],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Progress (V2)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Structured assessments and review status for this student.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAuthorAssessments ? (
            <>
              <Link
                href={primaryAssessmentAction.href}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-amber-950/15 transition hover:brightness-105"
              >
                {primaryAssessmentAction.label}
              </Link>
              <Link
                href={`/progress?student=${encodeURIComponent(studentId)}`}
                className="text-sm font-medium text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
              >
                Open Progress page
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {sessionStatus === "loading" && canAuthorAssessments ? (
        <p className="text-sm text-slate-600">Checking session…</p>
      ) : null}
      {canAuthorAssessments && sessionStatus === "authenticated" && !userId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sign in again to manage assessments.
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{loadError}</p>
      ) : null}

      {reviewNotice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-sm">
          {reviewNotice}
        </p>
      ) : null}

      {!loading && progressAlerts.primary ? (
        <div
          className="rounded-xl border border-amber-200/90 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 shadow-sm"
          title={progressAlerts.types.map((t) => progressAlertLabel(t)).join(" · ")}
        >
          <span className="font-semibold">Needs attention:</span>{" "}
          {progressAlertLabel(progressAlerts.primary)}
          {progressAlerts.types.length > 1 ? (
            <span className="text-xs font-normal text-amber-900/85">
              {" "}
              · +{progressAlerts.types.length - 1} more
            </span>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Latest approved
          </h3>
          {!loading ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span className="text-slate-600">Readiness:</span>
              <span className={readiness.badgeClass}>{readiness.label}</span>
            </p>
          ) : null}
        </div>
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ) : latestApproved ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">
              {formatAssessmentDateYmd(latestApproved.assessmentDate)}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Overall score:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {latestApproved.overallScore ?? "—"}
              </span>
              {latestApproved.overallScore != null ? <span className="text-slate-500"> / 10</span> : null}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Indicator:{" "}
              <span className="font-medium text-slate-900">
                {indicatorDisplay(latestApproved.assessmentIndicator)}
              </span>
            </p>
            {latestApproved.coachNotes?.trim() ? (
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                {latestApproved.coachNotes.trim()}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No coach notes on this assessment.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No approved progress yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Progress history
        </h3>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : assessments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-800">No progress records for this student</p>
            {canAuthorAssessments ? (
              <Link
                href={primaryAssessmentAction.href}
                className="mt-5 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-950/15 transition hover:brightness-105"
              >
                {primaryAssessmentAction.label}
              </Link>
            ) : null}
          </div>
        ) : (
          <StudentProgressList
            assessments={listForViewer}
            viewer={canAuthorAssessments ? "assistant" : "readonly"}
            onSelect={(a) => {
              if (canAuthorAssessments) {
                if (userId && a.authorUserId === userId) {
                  router.push(`/progress/assessments/${encodeURIComponent(a.id)}`);
                } else {
                  openReadOnlyDetail(a);
                }
              } else if (userRole === ROLE_ADMIN || userRole === ROLE_HEAD_COACH) {
                openReadOnlyDetail(a);
              }
            }}
          />
        )}
      </section>

      {detailModalId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReadOnlyDetail();
          }}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <ProgressReviewDetail
              key={detailModalId}
              detail={detail}
              loading={detailLoading}
              error={detailError}
              onClose={closeReadOnlyDetail}
              onReviewFinished={handleReviewFinished}
              showReviewActions={canReviewProgress}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListSkeleton } from "@/components/progress/ListSkeleton";
import { ProgressReviewDetail } from "@/components/progress/review/ProgressReviewDetail";
import { ProgressReviewQueue } from "@/components/progress/review/ProgressReviewQueue";
import type { ProgressAssessmentDetailPayload } from "@/components/progress/review/progress-review-types";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";

type ListResponse =
  | { ok: true; assessments: ProgressAssessmentListItem[] }
  | { ok: false; error?: unknown };

type DetailResponse = {
  ok: true;
  assessment: ProgressAssessmentDetailPayload;
} | { ok: false; error?: string };

export type ProgressReviewQueueMode = "all" | "pending" | "revision";

function filterAssessments(
  list: ProgressAssessmentListItem[],
  studentQ: string,
  batchQ: string,
): ProgressAssessmentListItem[] {
  const s = studentQ.trim().toLowerCase();
  const b = batchQ.trim().toLowerCase();
  if (!s && !b) return list;
  return list.filter((a) => {
    if (s && !a.student.fullName.toLowerCase().includes(s)) return false;
    if (b && !(a.batch.name ?? "").toLowerCase().includes(b)) return false;
    return true;
  });
}

export function HeadCoachProgressReviewWorkspace({
  queueMode,
}: {
  /** Which queue(s) to load: both, or a single status for focused dashboard links. */
  queueMode: ProgressReviewQueueMode;
}) {
  const [pendingQueue, setPendingQueue] = useState<ProgressAssessmentListItem[]>([]);
  const [revisionQueue, setRevisionQueue] = useState<ProgressAssessmentListItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [studentFilter, setStudentFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProgressAssessmentDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadPending = queueMode === "all" || queueMode === "pending";
  const loadRevision = queueMode === "all" || queueMode === "revision";

  const loadQueues = useCallback(
    async (opts?: { soft?: boolean }) => {
      setQueueError(null);
      if (opts?.soft) setQueueRefreshing(true);
      else setQueueLoading(true);

      const fetchStatus = async (
        status: string,
      ): Promise<
        | { ok: true; assessments: ProgressAssessmentListItem[] }
        | { ok: false; error: string }
      > => {
        const res = await fetch(`/api/progress/assessments?status=${encodeURIComponent(status)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        let data: ListResponse;
        try {
          data = (await res.json()) as ListResponse;
        } catch {
          return { ok: false, error: "The server returned an invalid response." };
        }
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: getApiErrorMessageFromPayload(data, "Could not load assessments."),
          };
        }
        return { ok: true, assessments: data.assessments };
      };

      try {
        const pendingP = loadPending
          ? fetchStatus(PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW)
          : Promise.resolve({ ok: true as const, assessments: [] as ProgressAssessmentListItem[] });
        const revisionP = loadRevision
          ? fetchStatus(PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION)
          : Promise.resolve({ ok: true as const, assessments: [] as ProgressAssessmentListItem[] });

        const [pRes, rRes] = await Promise.all([pendingP, revisionP]);
        if (!pRes.ok) {
          setQueueError(pRes.error);
          if (loadPending) setPendingQueue([]);
          if (loadRevision) setRevisionQueue([]);
          return;
        }
        if (!rRes.ok) {
          setQueueError(rRes.error);
          if (loadPending) setPendingQueue([]);
          if (loadRevision) setRevisionQueue([]);
          return;
        }
        if (loadPending) setPendingQueue(pRes.assessments);
        if (loadRevision) setRevisionQueue(rRes.assessments);
      } catch {
        setQueueError("Something interrupted the request. Check your connection and try again.");
        if (loadPending) setPendingQueue([]);
        if (loadRevision) setRevisionQueue([]);
      } finally {
        setQueueLoading(false);
        setQueueRefreshing(false);
      }
    },
    [loadPending, loadRevision],
  );

  useEffect(() => {
    void loadQueues();
  }, [loadQueues]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const filteredPending = useMemo(
    () => filterAssessments(pendingQueue, studentFilter, batchFilter),
    [pendingQueue, studentFilter, batchFilter],
  );
  const filteredRevision = useMemo(
    () => filterAssessments(revisionQueue, studentFilter, batchFilter),
    [revisionQueue, studentFilter, batchFilter],
  );

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
          getApiErrorMessageFromPayload(
            data,
            "This assessment could not be opened. It may have been withdrawn, approved, or removed from your queue.",
          ),
        );
        return;
      }
      setDetail(data.assessment);
    } catch {
      setDetailError("We couldn't load this row. Check your connection and try again.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (a: ProgressAssessmentListItem) => {
    setSelectedId(a.id);
    void loadDetail(a.id);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  };

  const finishReview = useCallback(
    (message: string) => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setSuccessBanner(message);
      bannerTimerRef.current = setTimeout(() => setSuccessBanner(null), 6000);
      setSelectedId(null);
      setDetail(null);
      setDetailError(null);
      void loadQueues({ soft: true });
    },
    [loadQueues],
  );

  const pageTitle =
    queueMode === "all"
      ? "Review queue"
      : queueMode === "pending"
        ? "Pending review"
        : "Needs revision";

  const pageIntro =
    queueMode === "all" ? (
      <>
        <span className="font-semibold text-slate-800">Pending</span> needs your decision;{" "}
        <span className="font-semibold text-slate-800">Needs revision</span> tracks send-backs. Open a row to
        review read-only detail and act.
      </>
    ) : queueMode === "pending" ? (
      <>
        Read scores and notes, then approve or request revision. You can&apos;t edit here — authors update
        records from Progress.
      </>
    ) : (
      <>
        Authors are updating these after revision requests. When they resubmit, rows return to{" "}
        <span className="font-semibold text-slate-800">{PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW}</span>.
      </>
    );

  const pendingEmpty =
    queueMode === "revision"
      ? "Not loading this list in focused view."
      : "No assessments pending review. When assessments are submitted for review, they will appear here.";
  const revisionEmpty =
    queueMode === "pending"
      ? "Not loading this list in focused view."
      : "No assessments are waiting on author revisions right now.";

  const showFilters =
    (loadPending && pendingQueue.length > 0) || (loadRevision && revisionQueue.length > 0);

  const revisionSectionFirst = queueMode === "revision";

  const pendingSection = loadPending ? (
    <section
      id="review-queue-pending"
      className="scroll-mt-4 space-y-2 rounded-xl border border-slate-200/90 bg-white p-3 shadow-soft"
      aria-labelledby="review-queue-pending-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3
            id="review-queue-pending-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Pending review
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            <span className="font-semibold tabular-nums text-slate-800">{filteredPending.length}</span>
            {studentFilter.trim() || batchFilter.trim() ? (
              <span className="text-slate-500">
                {" "}
                shown
                {(loadPending ? pendingQueue.length : 0) !== filteredPending.length ? (
                  <span className="text-slate-400">
                    {" "}
                    · {loadPending ? pendingQueue.length : 0} total
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-slate-500"> awaiting your decision</span>
            )}
          </p>
        </div>
        {queueMode === "all" ? (
          <Link
            href="/progress/review?status=PENDING_REVIEW"
            className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 underline-offset-2 hover:underline"
          >
            Pending only
          </Link>
        ) : null}
      </div>
      <ProgressReviewQueue
        queueVariant="pending"
        assessments={filteredPending}
        loading={false}
        error={null}
        onSelect={openDetail}
        emptyMessage={pendingEmpty}
      />
    </section>
  ) : null;

  const revisionSection = loadRevision ? (
    <section
      id="review-queue-revision"
      className="scroll-mt-4 space-y-2 rounded-xl border border-slate-200/90 bg-white p-3 shadow-soft"
      aria-labelledby="review-queue-revision-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3
            id="review-queue-revision-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Needs revision
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            <span className="font-semibold tabular-nums text-slate-800">{filteredRevision.length}</span>
            {studentFilter.trim() || batchFilter.trim() ? (
              <span className="text-slate-500">
                {" "}
                shown
                {(loadRevision ? revisionQueue.length : 0) !== filteredRevision.length ? (
                  <span className="text-slate-400">
                    {" "}
                    · {loadRevision ? revisionQueue.length : 0} total
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-slate-500"> with coach-facing feedback</span>
            )}
          </p>
        </div>
        {queueMode === "all" ? (
          <Link
            href="/progress/review?status=NEEDS_REVISION"
            className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 underline-offset-2 hover:underline"
          >
            Revision only
          </Link>
        ) : null}
      </div>
      <ProgressReviewQueue
        queueVariant="revision"
        assessments={filteredRevision}
        loading={false}
        error={null}
        onSelect={openDetail}
        emptyMessage={revisionEmpty}
      />
    </section>
  ) : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {successBanner ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm">
          {successBanner}
        </p>
      ) : null}

      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{pageTitle}</h2>
        <p className="max-w-3xl text-[13px] leading-snug text-slate-600 sm:text-sm">{pageIntro}</p>
      </header>

      {queueMode !== "all" ? (
        <p className="text-xs text-slate-600">
          {queueMode === "pending" ? (
            <>
              Looking for items returned for revision?{" "}
              <Link
                href="/progress/review?status=NEEDS_REVISION"
                className="font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Open needs-revision queue
              </Link>
              {" · "}
              <Link href="/progress/review" className="font-semibold text-slate-700 underline-offset-2 hover:underline">
                Show both lists
              </Link>
            </>
          ) : (
            <>
              Need incoming submissions?{" "}
              <Link
                href="/progress/review?status=PENDING_REVIEW"
                className="font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Open pending review
              </Link>
              {" · "}
              <Link href="/progress/review" className="font-semibold text-slate-700 underline-offset-2 hover:underline">
                Show both lists
              </Link>
            </>
          )}
        </p>
      ) : null}

      {queueError ? (
        <div className="rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-950">
          <p className="font-medium">Couldn&apos;t load the review queue</p>
          <p className="mt-1 text-red-900/90">{queueError}</p>
          <button
            type="button"
            onClick={() => void loadQueues()}
            className="mt-2 inline-flex items-center justify-center rounded-lg border border-red-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-red-950 shadow-sm hover:bg-red-50"
          >
            Try again
          </button>
        </div>
      ) : null}

      {showFilters ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="sr-only" htmlFor="review-filter-student">
            Filter by student name
          </label>
          <input
            id="review-filter-student"
            type="search"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            placeholder="Filter by student…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80 sm:max-w-xs"
          />
          <label className="sr-only" htmlFor="review-filter-batch">
            Filter by batch name
          </label>
          <input
            id="review-filter-batch"
            type="search"
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            placeholder="Filter by batch…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80 sm:max-w-xs"
          />
          {queueRefreshing ? (
            <span className="text-xs font-medium text-slate-500 sm:ml-auto">Updating…</span>
          ) : null}
        </div>
      ) : queueLoading ? null : queueRefreshing ? (
        <p className="text-xs font-medium text-slate-500">Updating…</p>
      ) : null}

      {queueLoading && !queueRefreshing ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {revisionSectionFirst ? (
            <>
              {revisionSection}
              {pendingSection}
            </>
          ) : (
            <>
              {pendingSection}
              {revisionSection}
            </>
          )}
        </div>
      )}

      {selectedId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <ProgressReviewDetail
              key={selectedId}
              detail={detail}
              loading={detailLoading}
              error={detailError}
              onClose={closeDetail}
              onReviewFinished={finishReview}
              closeButtonLabel="← Back to progress review"
              onRetryLoad={
                selectedId ? () => void loadDetail(selectedId) : undefined
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

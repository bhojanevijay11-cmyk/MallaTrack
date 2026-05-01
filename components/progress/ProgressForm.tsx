"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, ClipboardList, FileCheck2, Pencil } from "lucide-react";
import { AssessmentReviewScoreStrip } from "@/components/progress/AssessmentReviewScoreStrip";
import { StatusBadge } from "@/components/progress/StatusBadge";
import { ReviewActionBar } from "@/components/progress/review/ReviewActionBar";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import type {
  ProgressAssessmentDetailPayload,
  ProgressAssessmentExerciseDTO,
} from "@/components/progress/review/progress-review-types";
import { formatAssessmentDateYmd } from "@/lib/progress-assessment-display";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import {
  clampMetricInt,
  decodeExpectedPerformance,
  formatRepsSetsOrLegacy,
  metricIntFromDecodedSegment,
} from "@/lib/progress-assessment-exercise-metrics";
import {
  computeOverallScoreFromCategories,
  overallScoreForDisplay,
} from "@/lib/progress-assessment-category-scores";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type StudentOption = { id: string; fullName: string; batchName: string | null; batchId: string | null };

type LocalExerciseRow = {
  key: string;
  exerciseName: string;
  /** Modal layout only — legacy string fields. */
  expectedPerformance: string;
  observedPerformance: string;
  note: string;
  /** Page table — persisted via API `targetReps` / `targetSets` / `completedReps` / `completedSets`. */
  targetReps: number | null;
  targetSets: number | null;
  completedReps: number | null;
  completedSets: number | null;
};

function newExerciseRow(): LocalExerciseRow {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `ex-${Math.random().toString(36).slice(2)}`,
    exerciseName: "",
    expectedPerformance: "",
    observedPerformance: "",
    note: "",
    targetReps: null,
    targetSets: null,
    completedReps: null,
    completedSets: null,
  };
}

function exerciseRowFromDto(e: ProgressAssessmentExerciseDTO): LocalExerciseRow {
  let targetReps = e.targetReps ?? null;
  let targetSets = e.targetSets ?? null;
  let completedReps = e.completedReps ?? null;
  let completedSets = e.completedSets ?? null;
  const ep = e.expectedPerformance ?? "";
  const op = e.observedPerformance ?? "";

  if (targetReps === null && targetSets === null && ep.trim()) {
    const d = decodeExpectedPerformance(ep);
    const dr = metricIntFromDecodedSegment(d.reps);
    const ds = metricIntFromDecodedSegment(d.sets);
    if (dr !== null) targetReps = dr;
    if (ds !== null) targetSets = ds;
  }
  if (completedReps === null && completedSets === null && op.trim()) {
    const d = decodeExpectedPerformance(op);
    const dr = metricIntFromDecodedSegment(d.reps);
    const ds = metricIntFromDecodedSegment(d.sets);
    if (dr !== null) completedReps = dr;
    if (ds !== null) completedSets = ds;
  }

  return {
    key: e.id,
    exerciseName: e.exerciseName,
    expectedPerformance: ep,
    observedPerformance: op,
    note: e.note ?? "",
    targetReps,
    targetSets,
    completedReps,
    completedSets,
  };
}

function parseMetricInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n)) return null;
  return clampMetricInt(n);
}

function buildExercisesPayload(rows: LocalExerciseRow[], forPageLayout: boolean) {
  return rows
    .filter((r) => r.exerciseName.trim() !== "")
    .map((r) => {
      if (forPageLayout) {
        return {
          exerciseName: r.exerciseName.trim(),
          note: r.note.trim() || null,
          targetReps: r.targetReps,
          targetSets: r.targetSets,
          completedReps: r.completedReps,
          completedSets: r.completedSets,
        };
      }
      return {
        exerciseName: r.exerciseName.trim(),
        expectedPerformance: r.expectedPerformance.trim() || null,
        observedPerformance: r.observedPerformance.trim() || null,
        note: r.note.trim() || null,
      };
    });
}

function isoAssessmentToDateInput(iso: string): string {
  const d = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return d;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const INDICATOR_LABELS_MAP: Record<string, string> = {
  ON_TRACK: "On track",
  NEEDS_ATTENTION: "Needs attention",
  EXCELLING: "Excelling",
};

function indicatorLabelFromCode(code: string | null | undefined): string {
  const t = code?.trim() ?? "";
  if (!t) return "—";
  return INDICATOR_LABELS_MAP[t] ?? t;
}

type AssessmentPageMeta = {
  studentFullName: string;
  batchName: string | null;
  submittedByEmail: string | null;
  submittedAtIso: string | null;
  authorEmail: string | null;
};

function pageMetaFromSeed(a: ProgressAssessmentListItem | null): AssessmentPageMeta {
  if (!a) {
    return {
      studentFullName: "",
      batchName: null,
      submittedByEmail: null,
      submittedAtIso: null,
      authorEmail: null,
    };
  }
  const d = a as ProgressAssessmentDetailPayload;
  return {
    studentFullName: a.student?.fullName?.trim() || "",
    batchName: a.batch?.name?.trim() || null,
    submittedByEmail: d.submittedByUser?.email?.trim() || null,
    submittedAtIso: a.submittedAt,
    authorEmail: d.authorUser?.email?.trim() || null,
  };
}

function ScoreField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled: boolean;
}) {
  const v = value ?? 5;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-amber-900">
          {value == null ? "—" : value}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={v}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

/** Overall is derived from the four category scores; no manual slider. */
function OverallScoreField({
  value,
  showComputedHint,
}: {
  value: number | null;
  showComputedHint: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">Overall</span>
        <span className="text-sm font-semibold tabular-nums text-amber-900">
          {value == null ? "—" : value}
        </span>
      </div>
      <p className={`text-[11px] leading-snug ${showComputedHint ? "text-slate-500" : "text-slate-400"}`}>
        {showComputedHint
          ? "Computed: average of Strength, Flexibility, Technique, and Discipline (rounded to whole number)."
          : "Rounded average of the four categories."}
      </p>
      <div className="h-2 w-full rounded-full bg-slate-100" aria-hidden />
    </div>
  );
}

export function ProgressForm({
  students,
  defaultStudentId,
  initialAssessment,
  isCreate,
  onClose,
  onRefresh,
  presentation = "modal",
}: {
  students: StudentOption[];
  /** Preselect student when opening “New assessment” (e.g. from ?student=). */
  defaultStudentId?: string;
  initialAssessment: ProgressAssessmentListItem | null;
  isCreate: boolean;
  onClose: () => void;
  onRefresh: () => void;
  /** `page` = full-route layout for /progress/assessments/*. Default `modal` for embedded overlays. */
  presentation?: "modal" | "page";
}) {
  const isPage = presentation === "page";
  const [studentId, setStudentId] = useState(() => {
    if (initialAssessment) return initialAssessment.studentId;
    if (defaultStudentId && students.some((s) => s.id === defaultStudentId)) return defaultStudentId;
    return students[0]?.id ?? "";
  });
  const [assessmentDate, setAssessmentDate] = useState(() => {
    if (initialAssessment) return isoAssessmentToDateInput(initialAssessment.assessmentDate);
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [strengthScore, setStrengthScore] = useState<number | null>(() =>
    initialAssessment?.strengthScore ?? (isCreate ? 5 : null),
  );
  const [flexibilityScore, setFlexibilityScore] = useState<number | null>(() =>
    initialAssessment?.flexibilityScore ?? (isCreate ? 5 : null),
  );
  const [techniqueScore, setTechniqueScore] = useState<number | null>(() =>
    initialAssessment?.techniqueScore ?? (isCreate ? 5 : null),
  );
  const [disciplineScore, setDisciplineScore] = useState<number | null>(() =>
    initialAssessment?.disciplineScore ?? (isCreate ? 5 : null),
  );
  /** From server for read-only fallback when a legacy row is missing a category score. */
  const [legacyOverallStored, setLegacyOverallStored] = useState<number | null>(
    () => initialAssessment?.overallScore ?? null,
  );
  const [coachNotes, setCoachNotes] = useState(() => initialAssessment?.coachNotes ?? "");
  const [assessmentIndicator, setAssessmentIndicator] = useState(
    () => initialAssessment?.assessmentIndicator ?? "",
  );
  const [exercises, setExercises] = useState<LocalExerciseRow[]>(() => []);

  const [status, setStatus] = useState(() => initialAssessment?.status ?? PROGRESS_ASSESSMENT_STATUS.DRAFT);
  const [reviewNote, setReviewNote] = useState(() => initialAssessment?.reviewNote ?? null);
  const [pageMeta, setPageMeta] = useState<AssessmentPageMeta>(() => pageMetaFromSeed(initialAssessment));
  const [assessmentId, setAssessmentId] = useState<string | null>(() => initialAssessment?.id ?? null);
  const [authorUserId, setAuthorUserId] = useState<string | null>(
    () => initialAssessment?.authorUserId ?? null,
  );
  const [loadingDetail, setLoadingDetail] = useState(!isCreate && !!initialAssessment?.id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const viewerRole = session?.user?.role;
  const viewerUserId = session?.user?.id?.trim() ?? "";
  /** Only the original author may edit or resubmit draft / needs-revision assessments (API-enforced). */
  const isAssessmentAuthor = useMemo(() => {
    if (isCreate) return true;
    if (!authorUserId || authStatus !== "authenticated" || !viewerUserId) return false;
    return viewerUserId === authorUserId;
  }, [isCreate, authorUserId, authStatus, viewerUserId]);
  /** Reviewer roles (head coach + admin): inline review on assessment page when pending (matches /api/.../review). */
  const viewerCanInlineReview =
    authStatus === "authenticated" &&
    (viewerRole === ROLE_HEAD_COACH || viewerRole === ROLE_ADMIN);

  const redirectIfActiveAssessmentConflict = useCallback(
    (
      res: Response,
      data: { ok?: boolean; existingAssessmentId?: unknown; assessment?: { id?: string } },
    ) => {
      if (res.status !== 409 || !data || typeof data !== "object") return false;
      const raw = (data as { existingAssessmentId?: unknown }).existingAssessmentId;
      if (typeof raw !== "string") return false;
      const id = raw.trim();
      if (!id) return false;
      router.push(`/progress/assessments/${encodeURIComponent(id)}`);
      return true;
    },
    [router],
  );
  /** Must match POST /api/progress/assessments/[id]/submit (assistant → queue; HC/admin → approved). */
  const authorFinalizesDirectly =
    authStatus === "authenticated" &&
    (viewerRole === ROLE_HEAD_COACH || viewerRole === ROLE_ADMIN);
  const submitsToReviewQueue = !authorFinalizesDirectly;
  const primarySubmitLabel = authorFinalizesDirectly
    ? "Finalize assessment"
    : status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION
      ? "Resubmit for review"
      : "Submit for review";
  /** When true, pending-lock copy mentions the review queue path; when false, generic “until review completes”. */
  const pendingSubmittedForQueueReview = submitsToReviewQueue;

  const overallScoreLive = useMemo(
    () =>
      computeOverallScoreFromCategories(
        strengthScore,
        flexibilityScore,
        techniqueScore,
        disciplineScore,
      ),
    [strengthScore, flexibilityScore, techniqueScore, disciplineScore],
  );

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/progress/assessments/${encodeURIComponent(id)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        assessment?: ProgressAssessmentDetailPayload;
        error?: unknown;
      };
      if (!res.ok || !data.ok || !data.assessment) {
        setMessage(getApiErrorMessageFromPayload(data, "Could not load assessment."));
        return;
      }
      const a = data.assessment;
      setAssessmentId(a.id);
      setStudentId(a.studentId);
      setAssessmentDate(isoAssessmentToDateInput(a.assessmentDate));
      setStrengthScore(a.strengthScore);
      setFlexibilityScore(a.flexibilityScore);
      setTechniqueScore(a.techniqueScore);
      setDisciplineScore(a.disciplineScore);
      setLegacyOverallStored(a.overallScore);
      setCoachNotes(a.coachNotes ?? "");
      setAssessmentIndicator(a.assessmentIndicator ?? "");
      setStatus(a.status);
      setReviewNote(a.reviewNote ?? null);
      setAuthorUserId(a.authorUserId);
      setPageMeta(pageMetaFromSeed(a));
      setExercises((a.exercises ?? []).map(exerciseRowFromDto));
    } catch {
      setMessage(
        "Could not load assessment. Check your connection, then try again or return to Progress.",
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (isCreate || !initialAssessment?.id) return;
    void loadDetail(initialAssessment.id);
  }, [isCreate, initialAssessment?.id, loadDetail]);

  const selectedStudent = students.find((s) => s.id === studentId) ?? null;
  const editable =
    status === PROGRESS_ASSESSMENT_STATUS.DRAFT ||
    status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION;
  const lockedPending = status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW;
  const lockedApproved = status === PROGRESS_ASSESSMENT_STATUS.APPROVED;
  const readOnly = !editable;
  const documentView = readOnly && isPage;
  const showHeadCoachReviewPanel =
    isPage &&
    !isCreate &&
    viewerCanInlineReview &&
    status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW &&
    !!assessmentId;

  const overallScoreShown = readOnly
    ? overallScoreForDisplay({
        strengthScore,
        flexibilityScore,
        techniqueScore,
        disciplineScore,
        storedOverallScore: legacyOverallStored,
      })
    : overallScoreLive;

  const indicatorStripLabel = indicatorLabelFromCode(assessmentIndicator);

  const studentDisplayName =
    selectedStudent?.fullName?.trim() ||
    pageMeta.studentFullName ||
    initialAssessment?.student?.fullName?.trim() ||
    "—";
  const batchDisplayName =
    selectedStudent?.batchName?.trim() ||
    pageMeta.batchName ||
    initialAssessment?.batch?.name?.trim() ||
    null;

  const submittedLine =
    pageMeta.submittedAtIso && pageMeta.submittedByEmail
      ? `${formatAssessmentDateYmd(pageMeta.submittedAtIso)} · ${pageMeta.submittedByEmail}`
      : pageMeta.submittedAtIso
        ? formatAssessmentDateYmd(pageMeta.submittedAtIso)
        : pageMeta.submittedByEmail
          ? pageMeta.submittedByEmail
          : null;

  const showRevisionFeedback = status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION;

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(assessmentDate);
  const batchOk = !!selectedStudent?.batchId;
  const canSubmit =
    editable && !!studentId && dateOk && batchOk && !busy && !loadingDetail;

  const buildBody = () => {
    const overallScore = overallScoreLive;
    const scores = {
      strengthScore,
      flexibilityScore,
      techniqueScore,
      disciplineScore,
      overallScore,
    };
    return {
      assessmentDate,
      coachNotes: coachNotes.trim() || null,
      assessmentIndicator: assessmentIndicator.trim() || null,
      exercises: buildExercisesPayload(exercises, isPage),
      ...scores,
    };
  };

  const onSaveDraft = async () => {
    if (busy) return;
    setMessage(null);
    if (!studentId) {
      setMessage("Select a student.");
      return;
    }
    const batchId =
      selectedStudent?.batchId ?? (!isCreate ? initialAssessment?.batchId : null) ?? null;
    setBusy(true);
    try {
      if (!assessmentId) {
        if (!batchId) {
          setMessage("Student must be assigned to a batch to create an assessment.");
          setBusy(false);
          return;
        }
        const res = await fetch("/api/progress/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            studentId,
            batchId,
            assessmentDate,
            strengthScore,
            flexibilityScore,
            techniqueScore,
            disciplineScore,
            overallScore: overallScoreLive,
            coachNotes: coachNotes.trim() || null,
            assessmentIndicator: assessmentIndicator.trim() || null,
            exercises: buildExercisesPayload(exercises, isPage),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          assessment?: { id: string };
          error?: unknown;
          existingAssessmentId?: string;
        };
        if (!res.ok || !data.ok || !data.assessment) {
          if (redirectIfActiveAssessmentConflict(res, data)) return;
          setMessage(getApiErrorMessageFromPayload(data, "Could not save draft."));
          return;
        }
        setAssessmentId(data.assessment.id);
        setStatus(PROGRESS_ASSESSMENT_STATUS.DRAFT);
        setMessage("Draft saved successfully.");
        onRefresh();
        return;
      }

      const effectiveBatchId =
        selectedStudent?.batchId ?? initialAssessment?.batchId ?? undefined;
      const res = await fetch(`/api/progress/assessments/${encodeURIComponent(assessmentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...buildBody(),
          ...(effectiveBatchId ? { batchId: effectiveBatchId } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setMessage(getApiErrorMessageFromPayload(data, "Could not save draft."));
        return;
      }
      setMessage("Draft saved successfully.");
      onRefresh();
    } catch {
      setMessage(
        "Save failed—connection may have dropped. Wait a moment, check your network, then try Save draft again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmitForReview = async () => {
    if (busy) return;
    setMessage(null);
    if (!studentId) {
      setMessage("Select a student.");
      return;
    }
    if (!dateOk) {
      setMessage("Choose a valid assessment date.");
      return;
    }
    const batchId =
      selectedStudent?.batchId ?? (!isCreate ? initialAssessment?.batchId : null) ?? null;
    if (!batchId) {
      setMessage("Student must be assigned to a batch.");
      return;
    }
    const confirmFinalize =
      "Finalize this assessment? It will be marked approved and you won’t be able to edit it afterward.";
    const confirmReviewQueue =
      "Submit for review? You won’t be able to edit until a reviewer approves or returns this for revision.";
    if (!window.confirm(submitsToReviewQueue ? confirmReviewQueue : confirmFinalize)) {
      return;
    }
    setBusy(true);
    try {
      let id = assessmentId;
      if (!id) {
        const res = await fetch("/api/progress/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            studentId,
            batchId,
            assessmentDate,
            strengthScore,
            flexibilityScore,
            techniqueScore,
            disciplineScore,
            overallScore: overallScoreLive,
            coachNotes: coachNotes.trim() || null,
            assessmentIndicator: assessmentIndicator.trim() || null,
            exercises: buildExercisesPayload(exercises, isPage),
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          assessment?: { id: string; status: string };
          error?: unknown;
          existingAssessmentId?: string;
        };
        if (!res.ok || !data.ok || !data.assessment) {
          if (redirectIfActiveAssessmentConflict(res, data)) {
            setBusy(false);
            return;
          }
          setMessage(getApiErrorMessageFromPayload(data, "Could not create assessment."));
          setBusy(false);
          return;
        }
        id = data.assessment.id;
        setAssessmentId(id);
      } else {
        const resPatch = await fetch(`/api/progress/assessments/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ...buildBody(),
            batchId: batchId ?? undefined,
          }),
        });
        const dataPatch = (await resPatch.json()) as { ok?: boolean; error?: unknown };
        if (!resPatch.ok || !dataPatch.ok) {
          setMessage(getApiErrorMessageFromPayload(dataPatch, "Could not update before submit."));
          setBusy(false);
          return;
        }
      }

      const resSubmit = await fetch(`/api/progress/assessments/${encodeURIComponent(id!)}/submit`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const dataSubmit = (await resSubmit.json()) as {
        ok?: boolean;
        assessment?: { status: string };
        error?: unknown;
      };
      if (!resSubmit.ok || !dataSubmit.ok) {
        setMessage(getApiErrorMessageFromPayload(dataSubmit, "Submit failed."));
        return;
      }
      setStatus(
        dataSubmit.assessment?.status ??
          (submitsToReviewQueue
            ? PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW
            : PROGRESS_ASSESSMENT_STATUS.APPROVED),
      );
      setMessage(
        submitsToReviewQueue
          ? "Submitted for review successfully."
          : "Assessment finalized and approved.",
      );
      onRefresh();
    } catch {
      setMessage(
        "Submit failed—connection may have dropped. Your draft should still be on this page; wait, check the network, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const primaryActions = (
    <>
      <button
        type="button"
        onClick={() => void onSaveDraft()}
        disabled={busy || loadingDetail || readOnly}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Working…" : "Save draft"}
      </button>
      {editable ? (
        <button
          type="button"
          onClick={() => void onSubmitForReview()}
          disabled={!canSubmit}
          title={
            !canSubmit && !busy && !loadingDetail
              ? "Select a student with a batch and a valid date to submit."
              : undefined
          }
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working…" : primarySubmitLabel}
        </button>
      ) : null}
    </>
  );

  const formMain = loadingDetail ? (
          <div
            className={`flex flex-col items-center justify-center gap-3 ${isPage ? "py-16 sm:py-24" : "py-12"}`}
            aria-busy="true"
          >
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-amber-200 border-t-amber-800"
              aria-hidden
            />
            <p className="text-sm text-slate-600">Loading assessment…</p>
          </div>
        ) : (
          <>
            {lockedPending && !isPage ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pendingSubmittedForQueueReview
                  ? "Submitted for review — editing is locked until review finishes (approved or returned for revision)."
                  : "Submitted for review — editing is locked until review is complete."}
              </p>
            ) : null}
            {lockedPending && isPage ? (
              <div className="mb-6 flex gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-white px-4 py-3 shadow-sm ring-1 ring-amber-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
                  <ClipboardList className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-950">In review</p>
                  <p className="mt-1 text-sm leading-snug text-amber-950/90">
                    {pendingSubmittedForQueueReview
                      ? "Editing is paused while this assessment is under review."
                      : "Editing is paused while this assessment is reviewed."}
                  </p>
                </div>
              </div>
            ) : null}
            {lockedApproved && !isPage ? (
              <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Approved — this assessment is read-only.
              </p>
            ) : null}
            {lockedApproved && isPage ? (
              <div className="mb-6 flex gap-3 rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm ring-1 ring-emerald-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-900">
                  <FileCheck2 className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-950">Approved assessment</p>
                  <p className="mt-1 text-sm leading-snug text-emerald-950/90">
                    This record is finalized. Content below is preserved for reference.
                  </p>
                </div>
              </div>
            ) : null}
            {showRevisionFeedback && !isPage ? (
              <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950 shadow-sm ring-1 ring-red-100">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-900">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Coach feedback (required changes)
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {reviewNote?.trim()
                    ? reviewNote.trim()
                    : "No written feedback was added. Please check with your head coach for what to change."}
                </p>
                {isAssessmentAuthor ? (
                  <p className="mt-3 border-t border-red-200 pt-3 text-xs font-medium text-red-950">
                    Update the sections below, save your draft, then submit again for review.
                  </p>
                ) : null}
              </div>
            ) : null}
            {showRevisionFeedback && isPage ? (
              <div className="mb-6 rounded-xl border-2 border-red-300 bg-gradient-to-b from-red-50 to-white px-4 py-4 shadow-md ring-1 ring-red-100">
                <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-900">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Coach feedback (required changes)
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-red-950">
                  {reviewNote?.trim()
                    ? reviewNote.trim()
                    : "No written feedback was added. Please check with your head coach for what to change."}
                </p>
                {isAssessmentAuthor ? (
                  <ul className="mt-4 list-inside list-disc space-y-1 text-sm font-medium text-red-950/95">
                    <li>Apply the feedback in the scores, exercises, and notes below.</li>
                    <li>
                      Save your draft, then use <span className="font-bold">{primarySubmitLabel}</span> again.
                    </li>
                  </ul>
                ) : null}
              </div>
            ) : null}

            {!documentView ? (
              <div
                className={
                  isPage
                    ? "grid gap-4 rounded-xl border border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-2 sm:p-5"
                    : "grid gap-4 sm:grid-cols-2"
                }
              >
                <div>
                  <label htmlFor="v2-student" className="text-xs font-semibold text-slate-500">
                    Student
                  </label>
                  <select
                    id="v2-student"
                    value={studentId}
                    disabled={readOnly || !isCreate || !!assessmentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                        {s.batchName ? ` · ${s.batchName}` : ""}
                        {!s.batchId ? " (no batch)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="v2-date" className="text-xs font-semibold text-slate-500">
                    Assessment date
                  </label>
                  <input
                    id="v2-date"
                    type="date"
                    value={assessmentDate}
                    disabled={readOnly}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                </div>
              </div>
            ) : isPage ? (
              <p className="text-sm font-medium text-slate-600">
                <span className="font-semibold text-slate-800">Assessment content</span> — exercises and notes
                from the submission.
              </p>
            ) : null}

            {!documentView ? (
              <div
                className={
                  isPage
                    ? "mt-6 space-y-5 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
                    : "mt-5 space-y-5 border-t border-slate-100 pt-5"
                }
              >
                <ScoreField
                  label="Strength"
                  value={strengthScore}
                  onChange={setStrengthScore}
                  disabled={readOnly}
                />
                <ScoreField
                  label="Flexibility"
                  value={flexibilityScore}
                  onChange={setFlexibilityScore}
                  disabled={readOnly}
                />
                <ScoreField
                  label="Technique"
                  value={techniqueScore}
                  onChange={setTechniqueScore}
                  disabled={readOnly}
                />
                <ScoreField
                  label="Discipline"
                  value={disciplineScore}
                  onChange={setDisciplineScore}
                  disabled={readOnly}
                />
                <OverallScoreField value={overallScoreShown} showComputedHint={!readOnly} />
              </div>
            ) : null}

            <div
              className={
                isPage
                  ? "mt-6 space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
                  : "mt-5 space-y-2 border-t border-slate-100 pt-4"
              }
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Assessment exercises
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {documentView
                      ? "Recorded exercises — compare target vs completed at a glance."
                      : "Optional — record tasks, targets, and what you observed."}
                  </p>
                </div>
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={() => setExercises((prev) => [...prev, newExerciseRow()])}
                    className={
                      isPage
                        ? "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-amber-900/20 bg-amber-50/80 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100/80"
                        : "shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm transition hover:bg-slate-50"
                    }
                  >
                    {isPage ? "+ Add exercise" : "Add exercise"}
                  </button>
                )}
              </div>

              {isPage ? (
                <>
                  {exercises.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-8 text-center text-sm text-slate-500">
                      {documentView ? (
                        "No exercises recorded for this assessment."
                      ) : (
                        <>
                          No exercises yet. Use <span className="font-semibold">+ Add exercise</span> to add
                          rows.
                        </>
                      )}
                    </p>
                  ) : documentView ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            <th className="whitespace-nowrap px-4 py-3">Exercise</th>
                            <th className="whitespace-nowrap border-l border-slate-200/80 bg-sky-50/80 px-3 py-3 text-sky-900/90">
                              Target
                            </th>
                            <th className="whitespace-nowrap border-l border-slate-200/80 bg-emerald-50/80 px-3 py-3 text-emerald-900/90">
                              Completed
                            </th>
                            <th className="min-w-[7rem] px-3 py-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exercises.map((row) => (
                            <tr key={row.key} className="border-b border-slate-100 align-top last:border-b-0">
                              <td className="px-4 py-3 font-semibold text-slate-900">{row.exerciseName.trim() || "—"}</td>
                              <td className="border-l border-slate-100 bg-sky-50/40 px-3 py-3 tabular-nums text-slate-800">
                                {formatRepsSetsOrLegacy(
                                  row.targetReps,
                                  row.targetSets,
                                  row.expectedPerformance,
                                )}
                              </td>
                              <td className="border-l border-slate-100 bg-emerald-50/40 px-3 py-3 tabular-nums text-slate-800">
                                {formatRepsSetsOrLegacy(
                                  row.completedReps,
                                  row.completedSets,
                                  row.observedPerformance,
                                )}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {row.note?.trim() ? (
                                  <span className="whitespace-pre-wrap">{row.note.trim()}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            <th className="whitespace-nowrap px-3 py-2.5">Exercise</th>
                            <th className="whitespace-nowrap px-2 py-2.5">Target reps</th>
                            <th className="whitespace-nowrap px-2 py-2.5">Target sets</th>
                            <th className="whitespace-nowrap px-2 py-2.5">Completed reps</th>
                            <th className="whitespace-nowrap px-2 py-2.5">Completed sets</th>
                            <th className="min-w-[8rem] px-2 py-2.5">Notes</th>
                            <th className="whitespace-nowrap px-2 py-2.5 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exercises.map((row) => {
                            const cellInput =
                              "h-9 w-full min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/50 disabled:cursor-not-allowed disabled:bg-slate-100";
                            return (
                              <tr key={row.key} className="border-b border-slate-100 align-top last:border-b-0">
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={row.exerciseName}
                                    disabled={readOnly}
                                    onChange={(e) =>
                                      setExercises((prev) =>
                                        prev.map((r) =>
                                          r.key === row.key ? { ...r, exerciseName: e.target.value } : r,
                                        ),
                                      )
                                    }
                                    placeholder="Name"
                                    className={`${cellInput} min-w-[10rem]`}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.targetReps ?? ""}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                      const n = parseMetricInput(e.target.value);
                                      setExercises((prev) =>
                                        prev.map((r) =>
                                          r.key === row.key ? { ...r, targetReps: n } : r,
                                        ),
                                      );
                                    }}
                                    placeholder="—"
                                    className={cellInput}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.targetSets ?? ""}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                      const n = parseMetricInput(e.target.value);
                                      setExercises((prev) =>
                                        prev.map((r) =>
                                          r.key === row.key ? { ...r, targetSets: n } : r,
                                        ),
                                      );
                                    }}
                                    placeholder="—"
                                    className={cellInput}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.completedReps ?? ""}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                      const n = parseMetricInput(e.target.value);
                                      setExercises((prev) =>
                                        prev.map((r) =>
                                          r.key === row.key ? { ...r, completedReps: n } : r,
                                        ),
                                      );
                                    }}
                                    placeholder="—"
                                    className={cellInput}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.completedSets ?? ""}
                                    disabled={readOnly}
                                    onChange={(e) => {
                                      const n = parseMetricInput(e.target.value);
                                      setExercises((prev) =>
                                        prev.map((r) =>
                                          r.key === row.key ? { ...r, completedSets: n } : r,
                                        ),
                                      );
                                    }}
                                    placeholder="—"
                                    className={cellInput}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="text"
                                    value={row.note}
                                    disabled={readOnly}
                                    onChange={(e) =>
                                      setExercises((prev) =>
                                        prev.map((r) =>
                                          r.key === row.key ? { ...r, note: e.target.value } : r,
                                        ),
                                      )
                                    }
                                    placeholder="Optional"
                                    className={cellInput}
                                  />
                                </td>
                                <td className="px-2 py-2 text-right">
                                  {readOnly ? (
                                    <span className="text-xs text-slate-400">—</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExercises((prev) => prev.filter((r) => r.key !== row.key))
                                      }
                                      className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 hover:underline"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {documentView ? (
                    <p className="text-[11px] leading-snug text-slate-500">
                      Target and completed columns use recorded reps and sets when available; otherwise legacy
                      text from older entries.
                    </p>
                  ) : (
                    <p className="text-[11px] leading-snug text-slate-500">
                      Reps and sets are stored as integers; the server also keeps legacy text fields for older
                      clients and free-text targets.
                    </p>
                  )}
                </>
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-0.5">
                  {exercises.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-2.5 py-2 text-[11px] text-slate-500">
                      No exercises yet. Add rows for drills or conditioning blocks you used.
                    </p>
                  ) : (
                    exercises.map((row, idx) => (
                      <div
                        key={row.key}
                        className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-2.5 shadow-sm"
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Exercise {idx + 1}
                          </span>
                          {readOnly ? null : (
                            <button
                              type="button"
                              onClick={() =>
                                setExercises((prev) => prev.filter((r) => r.key !== row.key))
                              }
                              className="shrink-0 text-[11px] font-semibold text-red-700 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={row.exerciseName}
                            disabled={readOnly}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, exerciseName: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Exercise name *"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <input
                            type="text"
                            value={row.expectedPerformance}
                            disabled={readOnly}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, expectedPerformance: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Target / expected (e.g. 30 reps)"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <input
                            type="text"
                            value={row.observedPerformance}
                            disabled={readOnly}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, observedPerformance: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Observed (e.g. completed 28)"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <input
                            type="text"
                            value={row.note}
                            disabled={readOnly}
                            onChange={(e) =>
                              setExercises((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, note: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Note (optional)"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div
              className={
                isPage
                  ? `mt-6 rounded-xl border p-4 shadow-sm sm:p-5 ${
                      documentView && lockedApproved
                        ? "border-emerald-100 bg-emerald-50/20 ring-1 ring-emerald-50"
                        : "border-slate-100 bg-white"
                    }`
                  : "mt-5"
              }
            >
              <label htmlFor="v2-indicator" className="text-xs font-semibold text-slate-500">
                Indicator (optional)
              </label>
              {documentView ? (
                <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-900">
                  {indicatorStripLabel}
                </p>
              ) : (
                <select
                  id="v2-indicator"
                  value={assessmentIndicator}
                  disabled={readOnly}
                  onChange={(e) => setAssessmentIndicator(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="">Not set</option>
                  <option value="ON_TRACK">On track</option>
                  <option value="NEEDS_ATTENTION">Needs attention</option>
                  <option value="EXCELLING">Excelling</option>
                </select>
              )}
            </div>

            <div
              className={
                isPage
                  ? `mt-4 rounded-xl border p-4 shadow-sm sm:p-5 ${
                      documentView && lockedApproved
                        ? "border-emerald-100 bg-emerald-50/20 ring-1 ring-emerald-50"
                        : "border-slate-100 bg-white"
                    }`
                  : "mt-4"
              }
            >
              <label htmlFor="v2-notes" className="text-xs font-semibold text-slate-500">
                Coach notes
              </label>
              {documentView ? (
                <div className="mt-2 min-h-[5rem] rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-sm leading-relaxed text-slate-900">
                  {coachNotes?.trim() ? (
                    <span className="whitespace-pre-wrap">{coachNotes}</span>
                  ) : (
                    <span className="text-slate-400">No notes.</span>
                  )}
                </div>
              ) : (
                <textarea
                  id="v2-notes"
                  value={coachNotes}
                  disabled={readOnly}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  rows={4}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
                  placeholder="Observations, goals, reminders…"
                />
              )}
            </div>

            {message ? (
              <p
                className={
                  message.includes("failed") ||
                  message.includes("Could not") ||
                  message.includes("must be") ||
                  message.includes("Select a") ||
                  message.includes("Choose a valid")
                    ? "mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                    : "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                }
              >
                {message}
              </p>
            ) : null}
          </>
        );

  const hideAssistantToolbar =
    isPage && viewerCanInlineReview && status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW;

  const onReviewCompleted = (msg: string) => {
    setMessage(msg);
    if (assessmentId) void loadDetail(assessmentId);
    onRefresh();
  };

  if (isPage) {
    return (
      <div className="space-y-6">
        <section
          className={`overflow-hidden rounded-xl border shadow-sm ${
            lockedApproved
              ? "border-emerald-200/80 bg-emerald-50/[0.12] ring-1 ring-emerald-100/70"
              : "border-slate-200/90 bg-white"
          }`}
        >
          <header className="flex flex-col gap-4 border-b border-slate-100 bg-white px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <span aria-hidden className="text-base leading-none">
                  ←
                </span>
                Back
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {isCreate ? "New assessment" : "Assessment"}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  {isCreate ? (
                    <span className="text-sm font-medium text-slate-500">Draft</span>
                  ) : null}
                </div>
                {!isCreate &&
                !isAssessmentAuthor &&
                (status === PROGRESS_ASSESSMENT_STATUS.DRAFT ||
                  status === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION) ? (
                  <p className="mt-2 max-w-xl text-xs leading-snug text-slate-600">
                    Only the assessment author can edit or resubmit this record.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {hideAssistantToolbar ? (
                <p className="max-w-md text-xs leading-snug text-slate-600 sm:text-right">
                  Author save/submit actions are hidden while you review — use the review panel below.
                </p>
              ) : (
                primaryActions
              )}
            </div>
          </header>

          {!isCreate ? (
            <div className="space-y-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-5 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Student</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{studentDisplayName}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Batch</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{batchDisplayName ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Assessment date
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatAssessmentDateYmd(assessmentDate)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-50">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Submitted by</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={submittedLine ?? undefined}>
                    {submittedLine ?? "—"}
                  </p>
                </div>
              </div>

              <AssessmentReviewScoreStrip
                strengthScore={strengthScore}
                flexibilityScore={flexibilityScore}
                techniqueScore={techniqueScore}
                disciplineScore={disciplineScore}
                overallScore={overallScoreShown}
                indicatorLabel={indicatorStripLabel}
              />

              {showHeadCoachReviewPanel && assessmentId ? (
                <div className="rounded-xl border-2 border-sky-400/35 bg-gradient-to-br from-sky-50 via-white to-emerald-50/40 p-4 shadow-md ring-1 ring-sky-100 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                      <CheckCircle2 className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">Review assessment</p>
                      <p className="mt-1 text-xs leading-snug text-slate-600">
                        Approve to finalize this assessment, or request a revision with clear feedback for the
                        author.
                      </p>
                    </div>
                  </div>
                  <ReviewActionBar assessmentId={assessmentId} status={status} onReviewFinished={onReviewCompleted} />
                </div>
              ) : null}

              {pageMeta.authorEmail ? (
                <p className="text-center text-[11px] text-slate-500 sm:text-left">
                  <span className="font-medium text-slate-600">Draft author:</span>{" "}
                  <span className="text-slate-700">{pageMeta.authorEmail}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-8 px-4 pb-10 pt-6 sm:px-6">{formMain}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isCreate ? "New assessment" : "Assessment"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Assessment</h2>
            <StatusBadge status={status} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">{formMain}</div>

      <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
        {primaryActions}
      </div>
    </div>
  );
}

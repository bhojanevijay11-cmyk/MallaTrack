"use client";

import { formatBatchTimeRange, validateBatchTimePair } from "@/lib/batch-time";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BatchProgressCell } from "@/components/batches/BatchProgressCell";
import { ProgressReviewDetail } from "@/components/progress/review/ProgressReviewDetail";
import type { ProgressAssessmentDetailPayload } from "@/components/progress/review/progress-review-types";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import type { BatchProgressViewer } from "@/lib/batch-progress-derive";
import { deriveBatchStudentProgress } from "@/lib/batch-progress-derive";
import { getStudentAlerts, type ProgressAlertViewer } from "@/lib/progress-alerts";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  type AppRole,
} from "@/lib/roles";

type StudentRow = {
  id: string;
  fullName: string;
  status: string;
};

type UnassignedStudent = {
  id: string;
  fullName: string;
  status: string;
  batchId: string | null;
};

type InstituteBranchOption = { id: string; name: string };

type BatchDetailPayload = {
  id: string;
  name: string | null;
  status: string;
  studentCount: number;
  startTime: string | null;
  endTime: string | null;
  branchId?: string | null;
  branchName?: string | null;
  assistantCoaches: { userId: string; label: string }[];
  students: StudentRow[];
};

type BatchDetailResponse =
  | {
      ok: true;
      batch: BatchDetailPayload;
    }
  | { ok: false; error?: unknown };

type ProgressListResponse =
  | { ok: true; assessments: ProgressAssessmentListItem[] }
  | { ok: false; error?: unknown };

type DetailResponse =
  | { ok: true; assessment: ProgressAssessmentDetailPayload }
  | { ok: false; error?: unknown };

function parseAssistantRows(raw: unknown): { userId: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { userId: string; label: string }[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.userId === "string" && typeof o.label === "string") {
      out.push({ userId: o.userId, label: o.label });
    }
  }
  return out;
}

function toProgressAlertViewer(
  v: BatchProgressViewer,
  staffRole: AppRole,
): ProgressAlertViewer {
  if (v.kind === "assistant") return { kind: "assistant", userId: v.userId };
  return staffRole === ROLE_ADMIN ? { kind: "admin" } : { kind: "head_coach" };
}

export function BatchManageView({
  batchId,
  viewerRole,
}: {
  batchId: string;
  viewerRole: AppRole;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const userId = session?.user?.id?.trim() ?? "";

  const isAssistant = viewerRole === ROLE_ASSISTANT_COACH;
  const canAuthorAssessments =
    viewerRole === ROLE_ASSISTANT_COACH || viewerRole === ROLE_HEAD_COACH;
  const canReviewProgress = viewerRole === ROLE_HEAD_COACH || viewerRole === ROLE_ADMIN;
  const canAssignAssistants =
    viewerRole === ROLE_ADMIN || viewerRole === ROLE_HEAD_COACH;
  /** Roster assign/remove: admin + head coach only (PATCH /api/students/:id matches this). */
  const canManageBatchRoster =
    viewerRole === ROLE_ADMIN || viewerRole === ROLE_HEAD_COACH;
  const canEditBatchDetails = viewerRole === ROLE_ADMIN;
  /** Empty batches in the head coach’s branch (API enforces scope). */
  const canDeleteBatch =
    viewerRole === ROLE_ADMIN || viewerRole === ROLE_HEAD_COACH;
  const [batch, setBatch] = useState<BatchDetailPayload | null>(null);
  const [unassignedCandidates, setUnassignedCandidates] = useState<UnassignedStudent[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editBranchId, setEditBranchId] = useState("");
  const [instituteBranches, setInstituteBranches] = useState<InstituteBranchOption[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editOk, setEditOk] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [progressAssessments, setProgressAssessments] = useState<ProgressAssessmentListItem[]>([]);
  const [progressError, setProgressError] = useState<string | null>(null);

  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProgressAssessmentDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [assignment, setAssignment] = useState<{
    assigned: { userId: string; label: string }[];
    candidates: { userId: string; label: string }[];
  } | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentActionError, setAssignmentActionError] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [selectedAssistantUserId, setSelectedAssistantUserId] = useState("");

  const load = useCallback(async () => {
    setPageLoading(true);
    setLoadError(null);
    setActionError(null);
    setProgressError(null);
    try {
      const progressUrl = `/api/progress/assessments?batchId=${encodeURIComponent(batchId)}`;
      if (canManageBatchRoster) {
        const [rRes, pRes] = await Promise.all([
          fetch(`/api/batches/${encodeURIComponent(batchId)}/roster`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }),
          fetch(progressUrl, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }),
        ]);

        const rJson = (await rRes.json()) as {
          ok?: boolean;
          batch?: BatchDetailPayload & { assistantCoaches?: unknown };
          unassignedCandidates?: UnassignedStudent[];
          instituteBranches?: InstituteBranchOption[];
          error?: unknown;
        };
        const pJson = (await pRes.json()) as ProgressListResponse;

        if (!rRes.ok || !rJson.ok || !rJson.batch) {
          setLoadError(getApiErrorMessageFromPayload(rJson, "Failed to load batch roster."));
          setBatch(null);
          setUnassignedCandidates([]);
          setProgressAssessments([]);
          return;
        }

        if (!pRes.ok || !pJson.ok || !("assessments" in pJson)) {
          setProgressError(
            getApiErrorMessageFromPayload(pJson, "Could not load progress for this batch."),
          );
          setProgressAssessments([]);
        } else {
          setProgressAssessments(pJson.assessments);
        }

        const payload = rJson.batch;
        setBatch({
          ...payload,
          startTime: payload.startTime ?? null,
          endTime: payload.endTime ?? null,
          branchId: payload.branchId ?? null,
          assistantCoaches: parseAssistantRows(
            (payload as { assistantCoaches?: unknown }).assistantCoaches,
          ),
        });
        setUnassignedCandidates(
          Array.isArray(rJson.unassignedCandidates) ? rJson.unassignedCandidates : [],
        );
        if (viewerRole === ROLE_ADMIN && Array.isArray(rJson.instituteBranches)) {
          setInstituteBranches(
            rJson.instituteBranches.filter(
              (br) =>
                br &&
                typeof br.id === "string" &&
                typeof br.name === "string",
            ),
          );
        } else {
          setInstituteBranches([]);
        }
        return;
      }

      const [bRes, pRes] = await Promise.all([
        fetch(`/api/batches/${encodeURIComponent(batchId)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
        fetch(progressUrl, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        }),
      ]);

      const bJson = (await bRes.json()) as BatchDetailResponse;
      const pJson = (await pRes.json()) as ProgressListResponse;

      if (!bRes.ok || !bJson.ok || !("batch" in bJson)) {
        setLoadError(getApiErrorMessageFromPayload(bJson, "Failed to load batch."));
        setBatch(null);
        setUnassignedCandidates([]);
        setProgressAssessments([]);
        return;
      }

      if (!pRes.ok || !pJson.ok || !("assessments" in pJson)) {
        setProgressError(
          getApiErrorMessageFromPayload(pJson, "Could not load progress for this batch."),
        );
        setProgressAssessments([]);
      } else {
        setProgressAssessments(pJson.assessments);
      }

      const payload = bJson.batch;
      setBatch({
        ...payload,
        startTime: payload.startTime ?? null,
        endTime: payload.endTime ?? null,
        branchId: payload.branchId ?? null,
        assistantCoaches: parseAssistantRows(
          (payload as { assistantCoaches?: unknown }).assistantCoaches,
        ),
      });
      setUnassignedCandidates([]);
      setInstituteBranches([]);
    } catch (e) {
      console.error(e);
      setLoadError("Failed to load data.");
      setBatch(null);
      setUnassignedCandidates([]);
      setProgressAssessments([]);
    } finally {
      setPageLoading(false);
    }
  }, [batchId, canManageBatchRoster, viewerRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAssignment = useCallback(async () => {
    if (!canAssignAssistants) return;
    setAssignmentLoading(true);
    setAssignmentActionError(null);
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/assistants`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        assigned?: { userId: string; label: string }[];
        candidates?: { userId: string; label: string }[];
        error?: unknown;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.assigned) || !Array.isArray(data.candidates)) {
        setAssignmentActionError(
          getApiErrorMessageFromPayload(data, "Could not load assistant assignments."),
        );
        setAssignment(null);
        return;
      }
      setAssignment({ assigned: data.assigned, candidates: data.candidates });
    } catch {
      setAssignmentActionError("Could not load assistant assignments.");
      setAssignment(null);
    } finally {
      setAssignmentLoading(false);
    }
  }, [batchId, canAssignAssistants]);

  useEffect(() => {
    if (!batch || !canAssignAssistants) {
      setAssignment(null);
      return;
    }
    void loadAssignment();
  }, [batch, canAssignAssistants, loadAssignment]);

  async function assignAssistantCoach() {
    if (!selectedAssistantUserId.trim()) return;
    setAssignBusy(true);
    setAssignmentActionError(null);
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}/assistants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ userId: selectedAssistantUserId.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setAssignmentActionError(
          getApiErrorMessageFromPayload(data, "Could not assign assistant."),
        );
        return;
      }
      setSelectedAssistantUserId("");
      await loadAssignment();
      await load();
    } catch {
      setAssignmentActionError("Could not assign assistant.");
    } finally {
      setAssignBusy(false);
    }
  }

  async function removeAssistantCoach(userId: string) {
    if (assignBusy) return;
    const assistantLabel =
      assignment?.assigned.find((a) => a.userId === userId)?.label?.trim() || "this assistant";
    if (
      !window.confirm(
        `Remove ${assistantLabel} from batch “${title}”? They lose access to this batch immediately. Existing attendance and progress entries they contributed stay with the batch and students.`,
      )
    ) {
      return;
    }
    setAssignBusy(true);
    setAssignmentActionError(null);
    try {
      const res = await fetch(
        `/api/batches/${encodeURIComponent(batchId)}/assistants?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE", headers: { Accept: "application/json" } },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setAssignmentActionError(
          getApiErrorMessageFromPayload(data, "Could not remove assignment."),
        );
        return;
      }
      await loadAssignment();
      await load();
    } catch {
      setAssignmentActionError("Could not remove assignment.");
    } finally {
      setAssignBusy(false);
    }
  }

  const navigateToNewAssessment = useCallback(
    (studentId: string) => {
      const sp = new URLSearchParams();
      sp.set("student", studentId.trim());
      sp.set("batch", batchId.trim());
      void router.push(`/progress/assessments/new?${sp.toString()}`);
    },
    [batchId, router],
  );

  const navigateToEditAssessment = useCallback(
    (assessmentId: string) => {
      const sp = new URLSearchParams();
      sp.set("batch", batchId.trim());
      void router.push(`/progress/assessments/${encodeURIComponent(assessmentId)}?${sp.toString()}`);
    },
    [batchId, router],
  );

  const loadAssessmentDetail = useCallback(async (id: string) => {
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

  async function assignStudent(studentId: string) {
    setBusyStudentId(studentId);
    setActionError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Could not assign student."));
        return;
      }
      await load();
    } catch (e) {
      console.error(e);
      setActionError("Could not assign student.");
    } finally {
      setBusyStudentId(null);
    }
  }

  function openEdit() {
    if (!canEditBatchDetails || !batch) return;
    setEditName(batch.name?.trim() ?? "");
    setEditStatus(batch.status.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE");
    setEditStart(batch.startTime ?? "");
    setEditEnd(batch.endTime ?? "");
    setEditBranchId(batch.branchId?.trim() ?? "");
    setEditError(null);
    setEditOk(null);
    setEditing(true);
  }

  async function saveBatchEdit() {
    if (!canEditBatchDetails || !batch) return;
    setEditError(null);
    setEditOk(null);
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Batch name is required.");
      return;
    }
    if (!editBranchId.trim()) {
      setEditError("Please assign this batch to a branch.");
      return;
    }
    const times = validateBatchTimePair(editStart, editEnd);
    if (!times.ok) {
      setEditError(times.error);
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: trimmed,
          status: editStatus,
          startTime: editStart,
          endTime: editEnd,
          branchId: editBranchId.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setEditError(getApiErrorMessageFromPayload(data, "Could not save batch."));
        return;
      }
      setEditOk("Saved.");
      await load();
    } catch (e) {
      console.error(e);
      setEditError("Could not save batch.");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDeleteBatch() {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setDeleteError(
          getApiErrorMessageFromPayload(data, "Could not delete batch."),
        );
        return;
      }
      setDeleteOpen(false);
      router.push("/batches");
      router.refresh();
    } catch {
      setDeleteError("Could not delete batch.");
    } finally {
      setDeleteBusy(false);
    }
  }

  const title = batch?.name?.trim() ? batch.name.trim() : "Untitled batch";
  const timeRange =
    batch != null ? formatBatchTimeRange(batch.startTime, batch.endTime) : null;

  if (loadError && !batch) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100/50"
          >
            Retry
          </button>
        </div>
        <Link
          href="/batches"
          className="text-sm font-medium text-primary transition hover:opacity-90"
        >
          ← Back to batches
        </Link>
      </div>
    );
  }

  if (pageLoading || !batch) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100/60" />
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/batches"
        className="text-sm font-medium text-primary transition hover:opacity-90"
      >
        ← Back to batches
      </Link>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {timeRange ? (
          <p className="mt-1 text-sm text-slate-600">{timeRange}</p>
        ) : null}
        <p className="mt-1 text-sm text-slate-500">
          {batch.studentCount === 1 ? "1 student" : `${batch.studentCount} students`} assigned
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Branch:{" "}
          <span className="font-medium text-slate-800">
            {batch.branchName?.trim()
              ? batch.branchName.trim()
              : batch.branchId
                ? "Assigned"
                : "Unassigned"}
          </span>
        </p>
        {!batch.branchId?.trim() ? (
          <div className="mt-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            This batch is missing a branch. Please assign one.
          </div>
        ) : null}
        {canManageBatchRoster ? (
          <p className="mt-1 text-xs text-slate-500">
            You can add or remove students for this batch within your institute
            {viewerRole === ROLE_HEAD_COACH ? " and branch" : ""} scope.
          </p>
        ) : null}
        {canEditBatchDetails || canDeleteBatch ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {canEditBatchDetails ? (
              <button
                type="button"
                onClick={() => (editing ? setEditing(false) : openEdit())}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                {editing ? "Close editor" : "Edit batch details"}
              </button>
            ) : null}
            {canDeleteBatch ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
              >
                Delete batch
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {canAssignAssistants ? (
        <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Assistant coaches (staff)
          </p>
          <p className="text-xs text-slate-500">
            Link invited assistant coach accounts to this batch. They must belong to the same branch when the batch has a branch.
          </p>
          {assignmentActionError ? (
            <p className="text-sm text-amber-700">{assignmentActionError}</p>
          ) : null}
          {assignmentLoading ? (
            <p className="text-sm text-slate-500">Loading assignments…</p>
          ) : assignment ? (
            <>
              {assignment.assigned.length ? (
                <ul className="space-y-2">
                  {assignment.assigned.map((a) => (
                    <li
                      key={a.userId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-900">{a.label}</span>
                      <button
                        type="button"
                        disabled={assignBusy}
                        onClick={() => void removeAssistantCoach(a.userId)}
                        className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No assistant coaches assigned yet.</p>
              )}
              {assignment.candidates.length ? (
                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor="assignAssistantSelect"
                      className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                    >
                      Add assistant
                    </label>
                    <select
                      id="assignAssistantSelect"
                      value={selectedAssistantUserId}
                      onChange={(e) => setSelectedAssistantUserId(e.target.value)}
                      disabled={assignBusy}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                    >
                      <option value="">Select assistant coach…</option>
                      {assignment.candidates.map((c) => (
                        <option key={c.userId} value={c.userId}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={assignBusy || !selectedAssistantUserId}
                    onClick={() => void assignAssistantCoach()}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-50"
                  >
                    {assignBusy ? "Saving…" : "Assign"}
                  </button>
                </div>
              ) : assignment.assigned.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No eligible assistant coaches for this batch. Invite an assistant for this branch, or use Branch Management
                  if branches are not set up yet.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {canEditBatchDetails && editing ? (
        <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Edit batch
          </p>
          {!batch.branchId?.trim() ? (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
              This batch is missing a branch. Please assign one.
            </div>
          ) : null}
          {editError ? (
            <p className="text-sm text-amber-700">{editError}</p>
          ) : null}
          {editOk ? <p className="text-sm text-emerald-700">{editOk}</p> : null}
          <div className="space-y-2">
            <label
              htmlFor="editBatchName"
              className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
            >
              Batch name
            </label>
            <input
              id="editBatchName"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={editSaving}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="editBatchStart"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                Start time
              </label>
              <input
                id="editBatchStart"
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                disabled={editSaving}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="editBatchEnd"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                End time
              </label>
              <input
                id="editBatchEnd"
                type="time"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                disabled={editSaving}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Leave both times empty to clear. If one is set, both are required; end must be after start.
          </p>
          <div className="space-y-2">
            <label
              htmlFor="editBatchStatus"
              className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
            >
              Status
            </label>
            <select
              id="editBatchStatus"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE")}
              disabled={editSaving}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="editBatchBranch"
              className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
            >
              Branch <span className="text-red-600">*</span>
            </label>
            <select
              id="editBatchBranch"
              value={editBranchId}
              onChange={(e) => setEditBranchId(e.target.value)}
              disabled={editSaving}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
            >
              <option value="">Select a branch…</option>
              {editBranchId.trim() &&
              !instituteBranches.some((br) => br.id === editBranchId) ? (
                <option value={editBranchId}>
                  {batch.branchName?.trim() || "Current branch"} (not in institute list)
                </option>
              ) : null}
              {instituteBranches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.name.trim() || br.id}
                </option>
              ))}
            </select>
            {!editBranchId.trim() ? (
              <p className="text-xs text-amber-800">Please assign this batch to a branch.</p>
            ) : instituteBranches.length === 0 ? (
              <p className="text-xs text-amber-800">
                No branches loaded for this institute. Add branches under Branch Management to pick one from the list.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Head coaches and branch-scoped tools only see students in batches linked to their branch.
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={editSaving || !editBranchId.trim()}
            onClick={() => void saveBatchEdit()}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
          >
            {editSaving ? "Saving…" : "Save changes"}
          </button>
        </section>
      ) : null}

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeleteOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-batch-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-batch-title" className="text-base font-semibold text-slate-900">
              Delete batch
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Permanently remove <span className="font-medium text-slate-900">{title}</span>? This is only allowed when
              the batch has no students, no attendance history, and no progress assessments. If anything is still linked,
              deletion will be blocked with a short explanation.
            </p>
            {deleteError ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void confirmDeleteBatch()}
                className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete batch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {actionError}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Assigned
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {canAuthorAssessments &&
            batch.students.length > 0 &&
            sessionStatus === "authenticated" &&
            userId ? (
              <button
                type="button"
                onClick={() => navigateToNewAssessment(batch.students[0].id)}
                className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Add progress (first student)
              </button>
            ) : null}
            {canReviewProgress ? (
              <Link
                href="/progress/review?status=PENDING_REVIEW"
                className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Review queue
              </Link>
            ) : null}
          </div>
        </div>
        {progressError ? (
          <p className="text-xs text-red-700">{progressError}</p>
        ) : null}
        {!progressError && progressAssessments.length === 0 && batch.students.length > 0 ? (
          <p className="text-xs text-slate-500">No progress recorded for this batch yet.</p>
        ) : null}
        {!progressError &&
        progressAssessments.length === 0 &&
        batch.students.length > 0 &&
        canAuthorAssessments &&
        sessionStatus === "authenticated" &&
        userId ? (
          <button
            type="button"
            onClick={() => navigateToNewAssessment(batch.students[0].id)}
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-amber-950/15 transition hover:brightness-105"
          >
            Add first assessment
          </button>
        ) : null}
        {batch.students.length ? (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-soft">
            {batch.students.map((s: StudentRow) => {
              const busy = busyStudentId === s.id;
              const viewer: BatchProgressViewer | null = canAuthorAssessments
                ? sessionStatus === "authenticated" && userId
                  ? { kind: "assistant", userId }
                  : null
                : { kind: "readonly" };
              const derived =
                viewer === null
                  ? null
                  : deriveBatchStudentProgress(progressAssessments, s.id, viewer);

              const progressAlertState =
                viewer === null
                  ? null
                  : getStudentAlerts(
                      progressAssessments.filter((a) => a.studentId === s.id),
                      toProgressAlertViewer(viewer, viewerRole),
                    );

              const openReadonlyDetail = () => {
                const target = derived?.readonlyClickTarget;
                if (!target) return;
                setDetailModalId(target.id);
                void loadAssessmentDetail(target.id);
              };

              const openAssistantFromCell = () => {
                if (!derived) return;
                if (derived.assistantNewestOwned) {
                  navigateToEditAssessment(derived.assistantNewestOwned.id);
                } else {
                  navigateToNewAssessment(s.id);
                }
              };

              return (
                <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="min-w-0 shrink-0 sm:w-40">
                    <span className="text-sm font-medium text-slate-900">{s.fullName}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {derived === null ? (
                      <p className="text-xs text-slate-400">Loading progress…</p>
                    ) : (
                      <BatchProgressCell
                        derived={derived}
                        isAssistant={canAuthorAssessments}
                        disabled={busy || (!canAuthorAssessments && !derived.readonlyClickTarget)}
                        onOpenProgress={canAuthorAssessments ? openAssistantFromCell : openReadonlyDetail}
                        onAddProgress={() => navigateToNewAssessment(s.id)}
                        progressAlerts={progressAlertState}
                      />
                    )}
                  </div>
                  {canManageBatchRoster ? (
                    <Link
                      href={`/students/${s.id}`}
                      className="inline-flex shrink-0 self-start items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:self-center"
                    >
                      Change batch
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-600">
            No students assigned yet.
          </p>
        )}
      </section>

      {canManageBatchRoster ? (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Unassigned students
          </p>
          <p className="text-xs text-slate-500">
            Students with no batch in your allowed scope. Assigning moves them into this batch.
          </p>
          {unassignedCandidates.length ? (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-soft">
              {unassignedCandidates.map((s) => {
                const busy = busyStudentId === s.id;
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-medium text-slate-900">{s.fullName}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void assignStudent(s.id)}
                      className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
                    >
                      {busy ? "Saving…" : "Assign"}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-600">
              No unassigned students in your scope.
            </p>
          )}
        </section>
      ) : null}

      {detailModalId ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDetailModalId(null);
              setDetail(null);
              setDetailError(null);
            }
          }}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <ProgressReviewDetail
              key={detailModalId}
              detail={detail}
              loading={detailLoading}
              error={detailError}
              onClose={() => {
                setDetailModalId(null);
                setDetail(null);
                setDetailError(null);
              }}
              onReviewFinished={() => {
                setDetailModalId(null);
                setDetail(null);
                setDetailError(null);
                void load();
              }}
              showReviewActions={canReviewProgress}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

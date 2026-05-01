"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type BranchOption = { id: string; name: string };

/** Minimal issue fields for repair UI (keeps client bundle free of prisma-backed modules). */
export type HealthIssueRepairSlice = {
  category: string;
  entityType: "batch" | "student" | "user" | "batch_assistant";
  entityId: string;
  instituteId: string | null;
};

type HealthIssueRepairControlProps = {
  issue: HealthIssueRepairSlice;
  branchOptions?: BranchOption[];
};

export function HealthIssueRepairControl({
  issue,
  branchOptions = [],
}: HealthIssueRepairControlProps) {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function postRepair(body: Record<string, string>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/platform/health/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: unknown;
      };
      if (!res.ok) {
        setError(getApiErrorMessageFromPayload(data, "Repair request failed."));
        return;
      }
      if (data.ok && typeof data.message === "string") {
        setMessage(data.message);
        router.refresh();
      } else {
        setError("Unexpected response.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  if (issue.category === "batch.missing_branch") {
    if (issue.entityType !== "batch") {
      return (
        <span className="text-xs text-slate-500">Manual review required</span>
      );
    }
    const batchId = issue.entityId;
    const hasBranches = branchOptions.length > 0;

    function onAssign() {
      if (!branchId) {
        setError("Select a branch first.");
        return;
      }
      if (
        !window.confirm(
          "Assign this batch to the selected branch? This only updates the batch’s branch field.",
        )
      ) {
        return;
      }
      void postRepair({
        action: "assign_batch_branch",
        batchId,
        branchId,
      });
    }

    return (
      <div className="flex min-w-[200px] flex-col gap-2">
        {!hasBranches ? (
          <p className="text-xs text-amber-800">
            No branches in this institute. Create a branch in the tenant first.
          </p>
        ) : (
          <>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900"
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setError(null);
              }}
              disabled={pending}
              aria-label="Branch to assign"
            >
              <option value="">Choose branch…</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onAssign}
              disabled={pending || !branchId}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {pending ? "Working…" : "Assign branch"}
            </button>
          </>
        )}
        {error ? (
          <p className="text-xs text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-xs text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  if (issue.category === "batch.branch_orphan_fk") {
    if (issue.entityType !== "batch") {
      return (
        <span className="text-xs text-slate-500">Manual review required</span>
      );
    }
    const batchId = issue.entityId;

    function onClear() {
      if (
        !window.confirm(
          "Clear the invalid branch reference on this batch? The branch row is missing; only batch.branchId will be set to empty.",
        )
      ) {
        return;
      }
      void postRepair({
        action: "clear_batch_orphan_branch",
        batchId,
      });
    }

    return (
      <div className="flex min-w-[160px] flex-col gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? "Working…" : "Clear invalid branch"}
        </button>
        {error ? (
          <p className="text-xs text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-xs text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  if (issue.category === "student.batch_orphan_fk") {
    if (issue.entityType !== "student") {
      return (
        <span className="text-xs text-slate-500">Manual review required</span>
      );
    }
    const studentId = issue.entityId;

    function onClearStudentBatch() {
      if (
        !window.confirm(
          "Clear the invalid batch reference on this student? Only student.batchId will be cleared.",
        )
      ) {
        return;
      }
      void postRepair({
        action: "clear_student_orphan_batch",
        studentId,
      });
    }

    return (
      <div className="flex min-w-[160px] flex-col gap-2">
        <button
          type="button"
          onClick={onClearStudentBatch}
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? "Working…" : "Clear invalid batch"}
        </button>
        {error ? (
          <p className="text-xs text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-xs text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  if (issue.category === "user.head_coach_branch_orphan_fk") {
    if (issue.entityType !== "user") {
      return (
        <span className="text-xs text-slate-500">Manual review required</span>
      );
    }
    const userId = issue.entityId;

    function onClearCoachBranch() {
      if (
        !window.confirm(
          "Clear the invalid branch reference on this head coach? Only user.branchId will be cleared.",
        )
      ) {
        return;
      }
      void postRepair({
        action: "clear_head_coach_orphan_branch",
        userId,
      });
    }

    return (
      <div className="flex min-w-[160px] flex-col gap-2">
        <button
          type="button"
          onClick={onClearCoachBranch}
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? "Working…" : "Clear invalid branch"}
        </button>
        {error ? (
          <p className="text-xs text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-xs text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  if (issue.category === "batch_assistant.batch_orphan_fk") {
    if (issue.entityType !== "batch_assistant") {
      return (
        <span className="text-xs text-slate-500">Manual review required</span>
      );
    }
    const batchAssistantId = issue.entityId;

    function onRemoveAssignment() {
      if (
        !window.confirm(
          "Remove this assistant assignment? The batch row is missing; only this assignment row will be deleted.",
        )
      ) {
        return;
      }
      void postRepair({
        action: "remove_orphan_batch_assistant_assignment",
        batchAssistantId,
      });
    }

    return (
      <div className="flex min-w-[160px] flex-col gap-2">
        <button
          type="button"
          onClick={onRemoveAssignment}
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? "Working…" : "Remove invalid assignment"}
        </button>
        {error ? (
          <p className="text-xs text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-xs text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span className="text-xs text-slate-500">Manual review required</span>
  );
}

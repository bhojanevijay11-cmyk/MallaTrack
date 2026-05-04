"use client";

import Link from "next/link";
import { validateBatchTimePair } from "@/lib/batch-time";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

export type BranchOption = { id: string; name: string };

type Props = {
  branches: BranchOption[];
  /** Admin must pick a branch; head coach batches use the coach’s branch on the server. */
  requireBranchSelection: boolean;
};

export function NewBatchForm({ branches, requireBranchSelection }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const noBranchesForAdmin = requireBranchSelection && branches.length === 0;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (noBranchesForAdmin) {
      setErrorMessage("Add at least one branch before creating a batch.");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Batch name is required.");
      return;
    }

    if (requireBranchSelection && !branchId.trim()) {
      setErrorMessage("Please assign this batch to a branch.");
      return;
    }

    const times = validateBatchTimePair(startTime, endTime);
    if (!times.ok) {
      setErrorMessage(times.error);
      return;
    }

    const payload: Record<string, unknown> = {
      name: trimmed,
      status,
      startTime: times.startTime,
      endTime: times.endTime,
    };
    if (requireBranchSelection) {
      payload.branchId = branchId.trim();
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(getApiErrorMessageFromPayload(data, "Failed to create batch."));
        return;
      }

      router.push("/batches");
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error(err);
      }
      setErrorMessage("Failed to create batch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {errorMessage ? <p className="text-sm text-amber-700">{errorMessage}</p> : null}

      {noBranchesForAdmin ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">No branches yet</p>
          <p className="mt-1 text-amber-900/90">
            Create a branch first, then return here to add a batch for that location.
          </p>
          <Link
            href="/branches"
            className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Manage branches
          </Link>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="batchName"
          className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Batch name
        </label>
        <input
          id="batchName"
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          required
          disabled={noBranchesForAdmin}
        />
      </div>

      {requireBranchSelection ? (
        <div className="space-y-2">
          <label
            htmlFor="batchBranch"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Branch <span className="text-red-600">*</span>
          </label>
          <select
            id="batchBranch"
            name="branchId"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            required
            disabled={noBranchesForAdmin || isSubmitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
          >
            <option value="">Select a branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {!branchId.trim() ? (
            <p className="text-xs text-amber-800">Please assign this batch to a branch.</p>
          ) : (
            <p className="text-xs text-slate-500">Required — batches belong to one branch.</p>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="batchStartTime"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Start time (optional)
          </label>
          <input
            id="batchStartTime"
            name="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            disabled={noBranchesForAdmin}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="batchEndTime"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            End time (optional)
          </label>
          <input
            id="batchEndTime"
            name="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            disabled={noBranchesForAdmin}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        If you set a start time, set an end time too. End must be after start.
      </p>

      <div className="space-y-2">
        <label
          htmlFor="batchStatus"
          className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Status
        </label>
        <select
          id="batchStatus"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE")}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          disabled={noBranchesForAdmin}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={
          isSubmitting ||
          noBranchesForAdmin ||
          (requireBranchSelection && !branchId.trim())
        }
        className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : "Create batch"}
      </button>
    </form>
  );
}

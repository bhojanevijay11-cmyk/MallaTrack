"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type BatchOption = {
  id: string;
  name: string | null;
  branchId: string | null;
  branchName: string | null;
};

type BatchesResponse = { ok?: boolean; batches?: BatchOption[] };

export function StudentBatchAssignmentEditor({
  studentId,
  initialBatchId,
}: {
  studentId: string;
  initialBatchId: string | null;
}) {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterBranchId, setFilterBranchId] = useState("");
  const [batchId, setBatchId] = useState(initialBatchId ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBatchId(initialBatchId ?? "");
  }, [initialBatchId]);

  const loadBatches = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/batches", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as BatchesResponse;
      if (!res.ok || !data.ok || !Array.isArray(data.batches)) {
        setLoadError("Could not load batches.");
        setBatches([]);
        return;
      }
      setBatches(data.batches);
    } catch {
      setLoadError("Could not load batches.");
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  const branchChoices = (() => {
    const m = new Map<string, string>();
    for (const b of batches ?? []) {
      const bid = b.branchId?.trim();
      if (!bid) continue;
      const label = b.branchName?.trim() || "Branch";
      if (!m.has(bid)) m.set(bid, label);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const filteredBatches = (batches ?? []).filter((b) => {
    if (!filterBranchId.trim()) return true;
    return b.branchId === filterBranchId.trim();
  });

  const missingBatch = !initialBatchId?.trim();

  async function save() {
    setSaveError(null);
    const next = batchId.trim();
    if (!next) {
      setSaveError("Please assign this student to a batch.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ batchId: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSaveError(getApiErrorMessageFromPayload(data, "Could not update batch."));
        return;
      }
      router.refresh();
    } catch {
      setSaveError("Could not update batch.");
    } finally {
      setSaving(false);
    }
  }

  const showOrphanBatchOption = Boolean(
    initialBatchId?.trim() &&
      batches &&
      !batches.some((b) => b.id === initialBatchId),
  );

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Batch assignment
      </p>
      {missingBatch ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          This student is not assigned to a batch.
        </div>
      ) : null}
      {loadError ? <p className="text-sm text-amber-700">{loadError}</p> : null}
      {saveError ? <p className="text-sm text-amber-700">{saveError}</p> : null}
      {branchChoices.length > 1 ? (
        <div className="space-y-1">
          <label
            htmlFor={`studentBatchBranchFilter-${studentId}`}
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Filter by branch (optional)
          </label>
          <select
            id={`studentBatchBranchFilter-${studentId}`}
            value={filterBranchId}
            onChange={(e) => {
              const next = e.target.value;
              setFilterBranchId(next);
              const list = (batches ?? []).filter(
                (b) => !next.trim() || b.branchId === next.trim(),
              );
              if (batchId.trim() && !list.some((b) => b.id === batchId)) {
                setBatchId("");
              }
            }}
            disabled={saving || batches === null}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
          >
            <option value="">All branches</option>
            {branchChoices.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1">
        <label
          htmlFor={`studentBatchSelect-${studentId}`}
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Batch <span className="text-red-600">*</span>
        </label>
        <select
          id={`studentBatchSelect-${studentId}`}
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          disabled={saving || batches === null}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
        >
          <option value="">Select a batch…</option>
          {showOrphanBatchOption ? (
            <option value={initialBatchId!}>Current batch (not in list)</option>
          ) : null}
          {filteredBatches.map((b) => {
            const bn = b.name?.trim() || "Untitled batch";
            const br = b.branchName?.trim();
            return (
              <option key={b.id} value={b.id}>
                {br ? `${bn} — ${br}` : bn}
              </option>
            );
          })}
        </select>
        {!batchId.trim() ? (
          <p className="text-xs text-amber-800">Please assign this student to a batch.</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={saving || batches === null || !batchId.trim()}
        onClick={() => void save()}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save batch"}
      </button>
    </div>
  );
}

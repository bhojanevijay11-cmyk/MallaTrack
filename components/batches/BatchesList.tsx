"use client";

import { BatchCard, type BatchCardModel } from "@/components/batches/BatchCard";
import { BatchGrid } from "@/components/batches/BatchGrid";
import { BatchManagementHeader } from "@/components/batches/BatchManagementHeader";
import { NewBatchCard } from "@/components/batches/NewBatchCard";
import { batchMatchesChip, type BatchFilterChip } from "@/lib/batch-ui-derive";
import { ROLE_ADMIN, type AppRole } from "@/lib/roles";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type BatchesResponse =
  | { ok: true; batches: BatchDTO[] }
  | { ok: false; error?: unknown };

type BatchDTO = BatchCardModel;

function normalizeStatus(status: string | null | undefined): "ACTIVE" | "INACTIVE" {
  if ((status ?? "").toUpperCase() === "ACTIVE") return "ACTIVE";
  return "INACTIVE";
}

function parseCoachFromApi(raw: unknown): BatchDTO["coach"] {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const fullName = o.fullName;
  if (typeof id !== "string" || typeof fullName !== "string") return null;
  return { id, fullName };
}

type PatchBatchResponse = {
  ok?: boolean;
  batch?: Record<string, unknown> & { id?: string };
  error?: unknown;
};

function batchMatchesSearch(batch: BatchDTO, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if ((batch.name ?? "").toLowerCase().includes(n)) return true;
  if ((batch.coach?.fullName ?? "").toLowerCase().includes(n)) return true;
  if ((batch.branchName ?? "").toLowerCase().includes(n)) return true;
  if ((batch.branchHeadCoachLabel ?? "").toLowerCase().includes(n)) return true;
  if (batch.assistantCoaches.some((a) => a.label.toLowerCase().includes(n))) return true;
  return false;
}

function parseAssistantCoaches(raw: unknown): BatchDTO["assistantCoaches"] {
  if (!Array.isArray(raw)) return [];
  const out: BatchDTO["assistantCoaches"] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.userId === "string" && typeof o.label === "string") {
      out.push({ userId: o.userId, label: o.label });
    }
  }
  return out;
}

function rowFromPatch(prev: BatchDTO, row: NonNullable<PatchBatchResponse["batch"]>): BatchDTO {
  const coach =
    "coach" in row ? parseCoachFromApi(row.coach) : prev.coach;
  const branchName =
    "branchName" in row
      ? typeof row.branchName === "string" || row.branchName === null
        ? (row.branchName as string | null)
        : prev.branchName
      : prev.branchName;
  const assistantCoaches =
    "assistantCoaches" in row
      ? parseAssistantCoaches((row as { assistantCoaches?: unknown }).assistantCoaches)
      : prev.assistantCoaches;
  const branchHeadCoachLabel =
    "branchHeadCoachLabel" in row
      ? typeof row.branchHeadCoachLabel === "string" || row.branchHeadCoachLabel === null
        ? (row.branchHeadCoachLabel as string | null)
        : prev.branchHeadCoachLabel
      : prev.branchHeadCoachLabel;
  return {
    ...prev,
    status: typeof row.status === "string" ? row.status : prev.status,
    name: row.name !== undefined ? (row.name as string | null) : prev.name,
    studentCount:
      typeof row.studentCount === "number" ? row.studentCount : prev.studentCount,
    startTime: row.startTime !== undefined ? (row.startTime as string | null) : prev.startTime,
    endTime: row.endTime !== undefined ? (row.endTime as string | null) : prev.endTime,
    branchName,
    branchHeadCoachLabel,
    assistantCoaches,
    coach: coach === undefined ? prev.coach : coach,
  };
}

type BatchesListProps = {
  /** When false, hides “new batch” entry points (e.g. Assistant Coach). Defaults true. */
  showCreateBatch?: boolean;
  /** Used to show batch name / schedule / status controls only to admins. */
  viewerRole?: AppRole;
};

export function BatchesList({ showCreateBatch = true, viewerRole }: BatchesListProps) {
  const [batches, setBatches] = useState<BatchDTO[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<BatchFilterChip>("all");
  const showBatchMetadataActions = viewerRole === ROLE_ADMIN;

  const load = useCallback(async (signal?: AbortSignal) => {
    setListError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "GET",
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as BatchesResponse;
      if (!res.ok || !data.ok) {
        setListError(getApiErrorMessageFromPayload(data, "Failed to load batches."));
        setBatches([]);
        return;
      }
      const raw = Array.isArray(data.batches) ? data.batches : [];
      setBatches(
        raw.map((x) => {
          const bn = (x as { branchName?: unknown }).branchName;
          const bh = (x as { branchHeadCoachLabel?: unknown }).branchHeadCoachLabel;
          return {
            id: x.id,
            name: x.name ?? null,
            status: x.status,
            startTime: x.startTime ?? null,
            endTime: x.endTime ?? null,
            studentCount: typeof x.studentCount === "number" ? x.studentCount : 0,
            branchName: typeof bn === "string" ? bn : null,
            branchHeadCoachLabel: typeof bh === "string" ? bh : null,
            assistantCoaches: parseAssistantCoaches(
              (x as { assistantCoaches?: unknown }).assistantCoaches,
            ),
            coach: parseCoachFromApi(
              (x as { coach?: unknown }).coach ?? null,
            ),
          };
        }),
      );
    } catch (err) {
      if (signal?.aborted) return;
      if (process.env.NODE_ENV === "development") {
        console.error(err);
      }
      setListError("Failed to load batches.");
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    if (!batches) return [];
    return batches.filter(
      (b) => batchMatchesSearch(b, search) && batchMatchesChip(b, chip),
    );
  }, [batches, search, chip]);

  async function toggleStatus(batch: BatchDTO) {
    const current = normalizeStatus(batch.status);
    const next = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setUpdatingId(batch.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as PatchBatchResponse;
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Failed to update status."));
        return;
      }
      if (data.batch && typeof data.batch.id === "string") {
        const row = data.batch;
        setBatches((prev) => {
          if (!prev) return prev;
          return prev.map((b) => (b.id === row.id ? rowFromPatch(b, row) : b));
        });
      } else {
        await load();
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error(err);
      }
      setActionError("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <BatchManagementHeader
        search={search}
        onSearchChange={setSearch}
        activeChip={chip}
        onChipChange={setChip}
      />

      {listError ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100/50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {actionError}
        </div>
      ) : null}

      {batches === null ? (
        <BatchGrid>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[200px] animate-pulse rounded-xl border border-slate-200/70 bg-slate-100/50"
            />
          ))}
        </BatchGrid>
      ) : listError && batches.length === 0 ? null : batches.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-5 text-center shadow-sm sm:px-6">
            <p className="text-base font-semibold text-slate-900">
              {showCreateBatch ? "No batches yet" : "No batches assigned"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {showCreateBatch
                ? "Create a batch to organize students. Active batches surface on your dashboard."
                : "When a Head Coach assigns you to a batch, it will appear here."}
            </p>
          </div>
          {showCreateBatch ? (
            <BatchGrid>
              <NewBatchCard />
            </BatchGrid>
          ) : null}
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-600">
              No batches match your search or filters. Try another chip or clear the search.
            </p>
          ) : null}
          <BatchGrid>
            {filtered.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                busy={updatingId === batch.id}
                onToggleStatus={() => void toggleStatus(batch)}
                showMetadataActions={showBatchMetadataActions}
              />
            ))}
            {showCreateBatch ? <NewBatchCard /> : null}
          </BatchGrid>
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROLE_ADMIN } from "@/lib/roles";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type CoachRow = {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
};

type BranchRow = { id: string; name: string };

type BatchRow = {
  id: string;
  name: string | null;
  status: string;
  studentCount: number;
  coachId: string | null;
  branchId: string | null;
  branchName: string | null;
  coach: { id: string; fullName: string; status: string } | null;
  assistantCoaches: { userId: string; label: string }[];
};

const cardClass =
  "rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm";

function displayBatchName(b: BatchRow): string {
  const n = (b.name ?? "").trim();
  return n || "Unnamed batch";
}

function parseBatchesPayload(raw: unknown): BatchRow[] {
  if (!raw || typeof raw !== "object" || !("batches" in raw)) return [];
  const list = (raw as { batches: unknown }).batches;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : null;
      if (!id) return null;
      const assistantsRaw = o.assistantCoaches;
      const assistantCoaches: BatchRow["assistantCoaches"] = [];
      if (Array.isArray(assistantsRaw)) {
        for (const a of assistantsRaw) {
          if (!a || typeof a !== "object") continue;
          const ar = a as Record<string, unknown>;
          const userId = typeof ar.userId === "string" ? ar.userId : null;
          const label = typeof ar.label === "string" ? ar.label : null;
          if (userId && label) assistantCoaches.push({ userId, label });
        }
      }
      const coachRaw = o.coach;
      let coach: BatchRow["coach"] = null;
      if (coachRaw && typeof coachRaw === "object") {
        const c = coachRaw as Record<string, unknown>;
        const cid = typeof c.id === "string" ? c.id : null;
        const fn = typeof c.fullName === "string" ? c.fullName : null;
        const st = typeof c.status === "string" ? c.status : "";
        if (cid && fn) coach = { id: cid, fullName: fn, status: st };
      }
      return {
        id,
        name: typeof o.name === "string" ? o.name : null,
        status: typeof o.status === "string" ? o.status : "",
        studentCount:
          typeof o.studentCount === "number" && Number.isFinite(o.studentCount)
            ? o.studentCount
            : 0,
        coachId:
          o.coachId === null
            ? null
            : typeof o.coachId === "string"
              ? o.coachId
              : null,
        branchId:
          o.branchId === null
            ? null
            : typeof o.branchId === "string"
              ? o.branchId
              : null,
        branchName:
          o.branchName === null
            ? null
            : typeof o.branchName === "string"
              ? o.branchName
              : null,
        coach,
        assistantCoaches,
      } satisfies BatchRow;
    })
    .filter((x): x is BatchRow => x !== null);
}

type AssignCoachPanelProps = {
  viewerRole: "admin" | "head_coach";
};

export function AssignCoachPanel({ viewerRole }: AssignCoachPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [coaches, setCoaches] = useState<CoachRow[] | null>(null);
  const [branches, setBranches] = useState<BranchRow[] | null>(null);
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [savingBatchId, setSavingBatchId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = viewerRole === ROLE_ADMIN;

  const showSuccess = useCallback((message: string) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setSuccessBanner(message);
    bannerTimerRef.current = setTimeout(() => setSuccessBanner(null), 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const batchesUrl = useCallback(
    (branchId: string | "all") => {
      if (!isAdmin || branchId === "all") {
        return "/api/batches";
      }
      return `/api/batches?branchId=${encodeURIComponent(branchId)}`;
    },
    [isAdmin],
  );

  const loadBranches = useCallback(async (signal?: AbortSignal) => {
    if (!isAdmin) {
      setBranches([]);
      return;
    }
    try {
      const res = await fetch("/api/branches", { signal, cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; branches?: BranchRow[] };
      if (!res.ok || !data.ok || !Array.isArray(data.branches)) {
        setBranches([]);
        return;
      }
      setBranches(data.branches);
    } catch {
      if (signal?.aborted) return;
      setBranches([]);
    }
  }, [isAdmin]);

  const loadBatches = useCallback(
    async (branchScope: string | "all", signal?: AbortSignal) => {
      try {
        const res = await fetch(batchesUrl(branchScope), {
          signal,
          cache: "no-store",
        });
        const bj = await res.json();
        if (!res.ok || !bj || typeof bj !== "object" || !(bj as { ok?: boolean }).ok) {
          setLoadError((e) => e ?? "Could not load batches.");
          setBatches([]);
          return;
        }
        const parsed = parseBatchesPayload(bj);
        setBatches(
          parsed.filter((b) => (b.status ?? "").toUpperCase() === "ACTIVE"),
        );
      } catch {
        if (signal?.aborted) return;
        setLoadError((msg) => msg ?? NETWORK_RETRY_HINT);
        setBatches([]);
      }
    },
    [batchesUrl],
  );

  const loadCoaches = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/coaches", { signal, cache: "no-store" });
      const cj = (await res.json()) as { ok?: boolean; coaches?: CoachRow[] };
      if (!res.ok || !cj.ok || !Array.isArray(cj.coaches)) {
        setLoadError("Could not load coaches.");
        setCoaches([]);
        return;
      }
      setCoaches(
        cj.coaches.filter((x) => (x.status ?? "").toUpperCase() === "ACTIVE"),
      );
    } catch {
      if (signal?.aborted) return;
      setLoadError((msg) => msg ?? NETWORK_RETRY_HINT);
      setCoaches([]);
    }
  }, []);

  /** Resolved branch filter for admin: URL param, or single-branch default, or "all". */
  const adminBranchScope = useCallback((): string | "all" => {
    if (!isAdmin || !branches || branches.length === 0) return "all";
    if (branches.length === 1) return branches[0].id;
    const fromUrl = searchParams.get("branchId")?.trim();
    if (fromUrl && branches.some((b) => b.id === fromUrl)) return fromUrl;
    return "all";
  }, [branches, isAdmin, searchParams]);

  useEffect(() => {
    const c = new AbortController();
    setLoadError(null);
    setActionError(null);
    void loadCoaches(c.signal);
    void loadBranches(c.signal);
    return () => c.abort();
  }, [loadBranches, loadCoaches]);

  /** Drop a bad `branchId` from the URL so the page state matches the address bar (admin only). */
  useEffect(() => {
    if (!isAdmin || !branches || branches.length < 2) return;
    const fromUrl = searchParams.get("branchId")?.trim();
    if (!fromUrl) return;
    if (branches.some((b) => b.id === fromUrl)) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("branchId");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }, [branches, isAdmin, router, searchParams]);

  useEffect(() => {
    const c = new AbortController();
    const scope = isAdmin ? adminBranchScope() : "all";
    void loadBatches(scope, c.signal);
    return () => c.abort();
  }, [adminBranchScope, isAdmin, loadBatches, branches, searchParams]);

  function syncBranchUrl(next: string | "all") {
    if (!isAdmin) return;
    const url = new URL(window.location.href);
    if (next === "all") {
      url.searchParams.delete("branchId");
    } else {
      url.searchParams.set("branchId", next);
    }
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  function onAdminBranchSelect(value: string) {
    if (value === "__all__") {
      syncBranchUrl("all");
      return;
    }
    syncBranchUrl(value);
  }

  async function onCreateCoach(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (creating) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/coaches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fullName: name,
          phone: newPhone.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setCreateError(getApiErrorMessageFromPayload(data, "Could not add coach."));
        return;
      }
      setNewName("");
      setNewPhone("");
      showSuccess("Coach added to your institute roster.");
      const c = new AbortController();
      await loadCoaches(c.signal);
    } catch {
      setCreateError(`${NETWORK_RETRY_HINT} The coach was not added.`);
    } finally {
      setCreating(false);
    }
  }

  async function assignHeadCoach(batchId: string, coachId: string, batchLabel: string) {
    if (savingBatchId !== null) return;
    setSavingBatchId(batchId);
    setActionError(null);
    const prevCoachId = batches?.find((b) => b.id === batchId)?.coachId ?? null;
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ coachId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Update failed."));
        return;
      }
      showSuccess(
        prevCoachId
          ? `Head Coach updated for ${batchLabel}.`
          : `Head Coach assigned to ${batchLabel}.`,
      );
      const scope = isAdmin ? adminBranchScope() : "all";
      const c = new AbortController();
      await loadBatches(scope, c.signal);
    } catch {
      setActionError(`${NETWORK_RETRY_HINT} Head coach was not updated.`);
    } finally {
      setSavingBatchId(null);
    }
  }

  async function clearHeadCoach(batchId: string, batchLabel: string) {
    if (savingBatchId !== null) return;
    setSavingBatchId(batchId);
    setActionError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ coachId: null }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Update failed."));
        return;
      }
      showSuccess(`Head Coach removed for ${batchLabel}.`);
      const scope = isAdmin ? adminBranchScope() : "all";
      const c = new AbortController();
      await loadBatches(scope, c.signal);
    } catch {
      setActionError(`${NETWORK_RETRY_HINT} Head coach was not updated.`);
    } finally {
      setSavingBatchId(null);
    }
  }

  async function onBatchHeadCoachChange(batchId: string, value: string) {
    const b = batches?.find((x) => x.id === batchId);
    const batchLabel = b ? displayBatchName(b) : "batch";
    if (value === "__none__") {
      await clearHeadCoach(batchId, batchLabel);
      return;
    }
    await assignHeadCoach(batchId, value, batchLabel);
  }

  const adminScope = isAdmin ? adminBranchScope() : "all";
  const showBranchColumn =
    isAdmin && (adminScope === "all" || (batches ?? []).some((b) => !b.branchName));

  return (
    <div className="space-y-3">
      {successBanner ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-sm">
          {successBanner}
        </p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
          {actionError}
        </p>
      ) : null}

      {isAdmin && branches && branches.length > 1 ? (
        <div className={cardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Branch context
          </p>
          <p className="mt-2 text-[13px] text-slate-600">
            Head Coach assignment is per batch. Choose a branch to focus the list, or
            view all batches across the institute.
          </p>
          <label className="mt-4 block max-w-md min-w-0">
            <span className="text-xs font-medium text-slate-600">Branch</span>
            <select
              className="mt-1.5 w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              value={adminScope === "all" ? "__all__" : adminScope}
              onChange={(e) => onAdminBranchSelect(e.target.value)}
            >
              <option value="__all__">All branches</option>
              {branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {isAdmin && branches && branches.length === 1 ? (
        <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-600">
          <span className="font-medium text-slate-800">Branch: </span>
          {branches[0].name}
        </p>
      ) : null}

      {!isAdmin ? (
        <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-600">
          Showing batches in your branch scope. Assistant coaches are managed on each
          batch&apos;s detail page.
        </p>
      ) : null}

      {isAdmin ? (
        <div className={cardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Add institute coach
          </p>
          <p className="mt-2 text-[13px] text-slate-500">
            Creates a roster record for your institute. You can then assign that person
            as the{" "}
            <span className="font-medium text-slate-700">Head Coach</span> (batch owner)
            below — this is not the same as inviting staff users or assigning assistant
            coaches.
          </p>
          <form
            onSubmit={onCreateCoach}
            className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="block min-w-0 sm:col-span-1">
              <span className="text-xs font-medium text-slate-600">Full name</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200/90 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name as it should appear"
                disabled={creating}
              />
            </label>
            <label className="block min-w-0 sm:col-span-1">
              <span className="text-xs font-medium text-slate-600">Phone (optional)</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200/90 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="10-digit mobile"
                disabled={creating}
              />
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                type="submit"
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-soft disabled:opacity-50 sm:w-auto sm:px-5"
                disabled={creating || !newName.trim()}
              >
                {creating ? "Adding…" : "Add to roster"}
              </button>
            </div>
          </form>
          {createError ? (
            <p className="mt-3 text-sm text-red-700">{createError}</p>
          ) : null}
        </div>
      ) : null}

      <div className={cardClass}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Batch Head Coach assignment
        </p>
        <p className="mt-2 text-[13px] text-slate-500">
          Each batch has exactly one <span className="font-medium text-slate-700">Head Coach</span>{" "}
          (operational owner). Unassigned batches need a Head Coach. Assistant coaches
          support the batch but do not replace this role — see the batch page to manage
          them.
        </p>

        {!batches?.length ? (
          <p className="mt-4 text-sm text-slate-500">
            {batches === null ? "Loading batches…" : "No active batches in this view."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-2.5">Batch</th>
                  {showBranchColumn ? (
                    <th className="px-3 py-2.5">Branch</th>
                  ) : null}
                  <th className="px-3 py-2.5">Students</th>
                  <th className="px-3 py-2.5">Assistants</th>
                  <th className="px-3 py-2.5">Head Coach</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const unassigned = !b.coachId;
                  const selectValue = b.coachId ?? "__none__";
                  const assistantCount = b.assistantCoaches.length;
                  return (
                    <tr
                      key={b.id}
                      className={
                        unassigned
                          ? "border-b border-slate-100 bg-amber-50/40"
                          : "border-b border-slate-100"
                      }
                    >
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {displayBatchName(b)}
                        {unassigned ? (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            No head coach
                          </span>
                        ) : null}
                      </td>
                      {showBranchColumn ? (
                        <td className="px-3 py-3 text-slate-600">
                          {b.branchName?.trim() ? (
                            b.branchName
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        {b.studentCount}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {assistantCount === 0 ? (
                          <span className="text-slate-400">None</span>
                        ) : (
                          <span>
                            {assistantCount} assigned
                            <Link
                              href={`/batches/${b.id}`}
                              className="ml-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                            >
                              Manage
                            </Link>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="w-full max-w-[220px] rounded-lg border border-slate-200/90 bg-white px-2 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                          value={selectValue}
                          disabled={savingBatchId === b.id || coaches === null}
                          onChange={(e) =>
                            void onBatchHeadCoachChange(b.id, e.target.value)
                          }
                        >
                          <option value="__none__">No head coach</option>
                          {(coaches ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {coaches && coaches.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {isAdmin
              ? "Add at least one institute coach above before you can assign a Head Coach."
              : "No active roster coaches are available. Ask an admin to add coaches to the institute roster."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

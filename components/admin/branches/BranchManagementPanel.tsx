"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

export type BranchRow = {
  id: string;
  name: string;
  createdAt: string;
};

type Props = {
  initialBranches: BranchRow[];
};

type ApiOk = { ok: true; branch: BranchRow };
type ApiErr = { ok: false; error?: unknown };

export function BranchManagementPanel({ initialBranches }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = !loading && trimmed.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json()) as ApiOk | ApiErr;
      if (!data.ok) {
        setError(getApiErrorMessageFromPayload(data, "Could not create branch."));
        return;
      }
      setName("");
      setSuccess("Branch added.");
      router.refresh();
    } catch {
      setError(NETWORK_RETRY_HINT);
    } finally {
      setLoading(false);
    }
  }

  function openRename(row: BranchRow) {
    setRenameError(null);
    setRename({ id: row.id, name: row.name });
    setRenameInput(row.name);
  }

  async function submitRename() {
    if (renameBusy) return;
    if (!rename) return;
    const next = renameInput.trim();
    if (!next) {
      setRenameError("Branch name is required.");
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/branches/${encodeURIComponent(rename.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const data = (await res.json()) as ApiOk | ApiErr;
      if (!data.ok) {
        setRenameError(getApiErrorMessageFromPayload(data, "Could not rename branch."));
        return;
      }
      setRename(null);
      setSuccess("Branch renamed.");
      router.refresh();
    } catch {
      setRenameError(NETWORK_RETRY_HINT);
    } finally {
      setRenameBusy(false);
    }
  }

  async function submitDelete() {
    if (deleteBusy) return;
    if (!del) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/branches/${encodeURIComponent(del.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setDeleteError(getApiErrorMessageFromPayload(data, "Could not delete branch."));
        return;
      }
      setDel(null);
      setSuccess("Branch deleted.");
      router.refresh();
    } catch {
      setDeleteError(NETWORK_RETRY_HINT);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label className="text-sm font-medium text-slate-800" htmlFor="branchName">
              Branch name <span className="text-red-600">*</span>
            </label>
            <input
              id="branchName"
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
              placeholder="e.g. North campus"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add Branch"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Your branches</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Open a branch for batches, staff roster, and quick links to batch management.
        </p>

        {initialBranches.length === 0 ? (
          <div className="mt-5 space-y-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-800">No branches yet</p>
            <p className="text-sm text-slate-600">
              Add at least one branch so you can assign head and assistant coaches when inviting staff.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {initialBranches.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:border-amber-200/60 hover:bg-white"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    href={`/branches/${b.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg transition hover:opacity-90"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{b.name}</p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                        Added {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-900/90">
                      Control center
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => openRename(b)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDel({ id: b.id, name: b.name });
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rename ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !renameBusy) setRename(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-branch-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="rename-branch-title" className="text-base font-semibold text-slate-900">
              Rename branch
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Update the display name for <span className="font-medium">{rename.name}</span>.
            </p>
            {renameError ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {renameError}
              </p>
            ) : null}
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Branch name
            </label>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              disabled={renameBusy}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
              autoComplete="off"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={renameBusy}
                onClick={() => setRename(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={renameBusy}
                onClick={() => void submitRename()}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 disabled:opacity-50"
              >
                {renameBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {del ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDel(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-branch-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-branch-title" className="text-base font-semibold text-slate-900">
              Delete branch
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Delete <span className="font-medium text-slate-900">{del.name}</span>? This is only allowed when the branch
              has no batches, no staff assigned to it, and no pending invites. If something is still linked, we will
              block the deletion and explain what to fix first.
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
                onClick={() => setDel(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void submitDelete()}
                className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete branch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

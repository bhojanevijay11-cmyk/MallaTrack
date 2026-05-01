"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InviteListStatus } from "@/lib/invite-status";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type BranchOption = { id: string; name: string };

export type RecentInviteRow = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchName: string | null;
  status: InviteListStatus;
  createdAt: string;
};

type Props = {
  branches: BranchOption[];
  recentInvites: RecentInviteRow[];
};

type ApiOk = {
  ok: true;
  inviteId: string;
  inviteUrl: string;
  expiresAt: string;
};

type ApiErr = {
  ok: false;
  error?: unknown;
};

function formatStaffRole(role: string): string {
  switch (role) {
    case ROLE_ADMIN:
      return "Admin";
    case ROLE_HEAD_COACH:
      return "Head coach";
    case ROLE_ASSISTANT_COACH:
      return "Assistant coach";
    default:
      return role;
  }
}

function statusLabel(status: InviteListStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "used":
      return "Used";
    case "expired":
      return "Expired";
  }
}

function fullInviteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function AdminInvitesPanel({ branches, recentInvites }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ApiOk | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdminRole = role === ROLE_ADMIN;
  const needsBranch = role === ROLE_HEAD_COACH || role === ROLE_ASSISTANT_COACH;
  const roleChosen = role !== "";
  const branchDisabled =
    loading || !roleChosen || isAdminRole || !needsBranch;

  const canSubmit =
    !loading &&
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    roleChosen &&
    (!needsBranch || !!branchId);

  const branchOptions = useMemo(() => branches, [branches]);

  function handleRoleChange(next: string) {
    setRole(next);
    if (next === ROLE_ADMIN) {
      setBranchId("");
    }
  }

  async function copyInviteLink() {
    if (!success) return;
    const url = fullInviteUrl(success.inviteUrl);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);
    setCopied(false);
    setLoading(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          role,
          branchId: isAdminRole || !needsBranch ? null : branchId || null,
        }),
      });
      const data = (await res.json()) as ApiOk | ApiErr;
      if (!data.ok) {
        setError(getApiErrorMessageFromPayload(data, "Could not create invite."));
        return;
      }
      setSuccess(data);
      setFullName("");
      setEmail("");
      setRole("");
      setBranchId("");
      router.refresh();
    } catch {
      setError(NETWORK_RETRY_HINT);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Invite your team
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Staff join your institute by opening the link you share—no separate signup for your
            academy.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="fullName">
                Full name <span className="text-red-600">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                required
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
                placeholder="e.g. Priya Sharma"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="email">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className={`grid gap-5 ${isAdminRole ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="role">
                Role <span className="text-red-600">*</span>
              </label>
              <select
                id="role"
                disabled={loading}
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
              >
                <option value="" disabled>
                  Select a role…
                </option>
                <option value={ROLE_ADMIN}>Admin</option>
                <option value={ROLE_HEAD_COACH}>Head coach</option>
                <option value={ROLE_ASSISTANT_COACH}>Assistant coach</option>
              </select>
            </div>

            {!isAdminRole ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-800" htmlFor="branchId">
                  Branch{" "}
                  {needsBranch ? (
                    <span className="text-red-600">*</span>
                  ) : (
                    <span className="font-normal text-slate-500">(choose role first)</span>
                  )}
                </label>
                <select
                  id="branchId"
                  disabled={branchDisabled}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:border-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {needsBranch ? "Select a branch" : "—"}
                  </option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {needsBranch ? (
                  <p className="text-xs text-slate-500">Required for coach roles</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate invite link"}
          </button>
        </form>

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-4 text-sm text-emerald-950">
            <p className="font-semibold text-emerald-950">Invite link created</p>
            <p className="mt-1 text-emerald-900/85">
              Expires{" "}
              <span className="font-medium">
                {new Date(success.expiresAt).toLocaleString()}
              </span>
            </p>
            <p className="mt-3 break-all rounded-md border border-emerald-200/80 bg-white/80 px-2.5 py-2 font-mono text-[11px] leading-snug text-emerald-950">
              {fullInviteUrl(success.inviteUrl)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyInviteLink()}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300/80 bg-white px-3 text-xs font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100/80 active:scale-[0.98]"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <Link
                href={success.inviteUrl}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-95 active:scale-[0.98] active:brightness-90"
              >
                Open link
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recent invites</h2>
        <p className="mt-0.5 text-xs text-slate-500">Last 25 for your institute</p>
        {recentInvites.length === 0 ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-slate-800">No invites yet</p>
            <p className="text-sm text-slate-600">
              Invite your first staff member to start building your team.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12px] text-slate-800">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentInvites.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-mono text-[11px]">{r.email}</td>
                    <td className="py-2 pr-3">{r.fullName}</td>
                    <td className="py-2 pr-3">{formatStaffRole(r.role)}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.branchName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          r.status === "pending"
                            ? "text-amber-700"
                            : r.status === "used"
                              ? "text-emerald-700"
                              : "text-slate-500"
                        }
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

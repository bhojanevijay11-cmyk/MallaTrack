"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

export type ParentInviteBadge = "not_linked" | "invite_pending" | "invite_expired" | "linked";

function badgeClasses(kind: ParentInviteBadge): string {
  switch (kind) {
    case "not_linked":
      return "border-slate-200 bg-slate-50 text-slate-800";
    case "invite_pending":
      return "border-amber-200 bg-amber-50 text-amber-950";
    case "invite_expired":
      return "border-orange-200 bg-orange-50 text-orange-950";
    case "linked":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

function badgeLabel(kind: ParentInviteBadge): string {
  switch (kind) {
    case "not_linked":
      return "Not linked";
    case "invite_pending":
      return "Invite pending";
    case "invite_expired":
      return "Invite expired";
    case "linked":
      return "Linked / active";
    default:
      return "—";
  }
}

export function StudentParentInvitePanel({
  studentId,
  initialEmail,
  badge,
  pendingExpiresLabel,
}: {
  studentId: string;
  /** Prefill from linked parent email when present. */
  initialEmail: string;
  badge: ParentInviteBadge;
  /** Human-readable expiry when invite is pending. */
  pendingExpiresLabel: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sendInvite = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/parent-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: unknown };
      if (!res.ok || !data.ok) {
        setError(getApiErrorMessageFromPayload(data, "Could not send parent invite."));
        return;
      }
      setSuccess(data.message ?? "Parent invite created.");
      router.refresh();
    } catch {
      setError("Could not send parent invite.");
    } finally {
      setSending(false);
    }
  }, [email, router, studentId]);

  const showResend = badge === "invite_pending" || badge === "invite_expired" || badge === "linked";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Parent account
        </p>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeClasses(badge)}`}
        >
          {badgeLabel(badge)}
        </span>
      </div>

      {pendingExpiresLabel && badge === "invite_pending" ? (
        <p className="text-xs text-slate-600">Invite expires {pendingExpiresLabel}.</p>
      ) : null}

      {badge === "invite_expired" ? (
        <p className="text-xs text-slate-600">
          The last invite expired. Send again so the parent can set a password.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={`parent-invite-email-${studentId}`} className="sr-only">
            Parent email
          </label>
          <input
            id={`parent-invite-email-${studentId}`}
            type="email"
            autoComplete="email"
            placeholder="Parent email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void sendInvite()}
            disabled={sending || !email.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send parent invite"}
          </button>
          {showResend ? (
            <button
              type="button"
              onClick={() => void sendInvite()}
              disabled={sending || !email.trim()}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Resend invite
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-800">{success}</p> : null}

      <p className="text-xs leading-relaxed text-slate-500">
        Parents cannot sign themselves up. They only set a password from the invite link you send.
        Head coaches can see the linked account but cannot send invites.
      </p>
    </div>
  );
}

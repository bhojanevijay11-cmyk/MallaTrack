"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  INSTITUTE_STATUS_ACTIVE,
  INSTITUTE_STATUS_DISABLED,
  type InstituteStatus,
} from "@/lib/institute-status";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type InstituteStatusControlProps = {
  instituteId: string;
  initialStatus: InstituteStatus;
};

export function InstituteStatusControl({
  instituteId,
  initialStatus,
}: InstituteStatusControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<InstituteStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const isActive = status === INSTITUTE_STATUS_ACTIVE;

  async function apply(next: InstituteStatus) {
    const verb = next === INSTITUTE_STATUS_DISABLED ? "disable" : "reactivate";
    if (
      !window.confirm(
        `Are you sure you want to ${verb} this institute? This affects all tenant users immediately after their session refreshes.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform/institutes/${instituteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        institute?: { status?: InstituteStatus };
        error?: unknown;
      };
      if (!res.ok) {
        setMessage({
          kind: "err",
          text: getApiErrorMessageFromPayload(data, "Request failed."),
        });
        return;
      }
      const newStatus = data.institute?.status;
      if (newStatus === INSTITUTE_STATUS_ACTIVE || newStatus === INSTITUTE_STATUS_DISABLED) {
        setStatus(newStatus);
      }
      setMessage({ kind: "ok", text: "Institute status updated." });
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-950">
        Emergency Control
      </h2>
      <p className="mt-2 text-sm text-amber-950/80">
        Disable tenant access for all users linked to this institute, or restore access.
        No data is deleted.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isActive ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply(INSTITUTE_STATUS_DISABLED)}
            className="rounded-lg border border-red-200/90 bg-white px-4 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
          >
            Disable institute
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply(INSTITUTE_STATUS_ACTIVE)}
            className="rounded-lg border border-emerald-200/90 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
          >
            Reactivate institute
          </button>
        )}
        {busy ? (
          <span className="text-xs font-medium text-amber-900/80">Working…</span>
        ) : null}
      </div>
      {message ? (
        <p
          className={`mt-3 text-sm font-medium ${
            message.kind === "ok" ? "text-emerald-800" : "text-red-800"
          }`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

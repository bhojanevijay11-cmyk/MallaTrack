"use client";

import { displayNameFromEmail } from "@/lib/email-display";
import { useEffect, useState } from "react";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type ParentRow = { id: string; name: string; email: string };

export function StudentParentLinkEditor({
  studentId,
  initialParentUserId,
  linkedParentEmail,
  readOnly = false,
}: {
  studentId: string;
  initialParentUserId: string | null;
  /** When set, show this option if the linked user is missing from /api/parents (e.g. rare race). */
  linkedParentEmail?: string | null;
  /** When true, show linked parent as text only (no PATCH). */
  readOnly?: boolean;
}) {
  const [parents, setParents] = useState<ParentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [value, setValue] = useState<string>(initialParentUserId ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (readOnly) return;
    void (async () => {
      try {
        const res = await fetch("/api/parents", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await res.json()) as { ok?: boolean; parents?: ParentRow[] };
        if (!res.ok || !data.ok || !Array.isArray(data.parents)) {
          setLoadError("Could not load parent accounts.");
          setParents([]);
          return;
        }
        setParents(data.parents);
      } catch {
        setLoadError("Could not load parent accounts.");
        setParents([]);
      }
    })();
  }, [readOnly]);

  useEffect(() => {
    setValue(initialParentUserId ?? "");
  }, [initialParentUserId]);

  async function persist(next: string) {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ parentUserId: next === "" ? null : next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setSaveError(getApiErrorMessageFromPayload(data, "Could not update link."));
        setValue(initialParentUserId ?? "");
        return;
      }
    } catch {
      setSaveError(`${NETWORK_RETRY_HINT} The parent link was not changed.`);
      setValue(initialParentUserId ?? "");
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) {
    const email = linkedParentEmail?.trim() || null;
    const hasLink = Boolean(initialParentUserId);
    let body: string;
    if (hasLink && email) {
      body = `Linked parent account: ${displayNameFromEmail(email)} (${email})`;
    } else if (hasLink && !email) {
      body = "Linked parent account: (linked — details unavailable)";
    } else {
      body = "No parent account linked";
    }
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Linked Parent Account
        </p>
        <p className="text-sm font-medium text-slate-900">{body}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Linked Parent Account
      </p>
      {loadError ? <p className="text-sm text-amber-700">{loadError}</p> : null}
      {saveError ? <p className="text-sm text-amber-700">{saveError}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={`parentUserId-${studentId}`}
          aria-label="Linked parent account"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            const previous = value;
            const hadLink = Boolean((previous || initialParentUserId || "").trim());
            if (next === "" && hadLink) {
              if (
                !window.confirm(
                  "Remove the linked parent from this student? The parent loses access to this student’s progress in MallaTrack until an admin links a parent again. The parent user account is not deleted.",
                )
              ) {
                setValue(previous);
                return;
              }
            }
            setValue(next);
            void persist(next);
          }}
          disabled={parents === null || saving}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
        >
          <option value="">No parent linked</option>
          {initialParentUserId &&
          linkedParentEmail &&
          !(parents ?? []).some((p) => p.id === initialParentUserId) ? (
            <option value={initialParentUserId}>
              {displayNameFromEmail(linkedParentEmail)} ({linkedParentEmail})
            </option>
          ) : null}
          {(parents ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
        {saving ? (
          <span className="text-xs font-medium text-slate-500">Saving…</span>
        ) : null}
      </div>
    </div>
  );
}

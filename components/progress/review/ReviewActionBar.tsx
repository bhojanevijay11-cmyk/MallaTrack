"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { PROGRESS_ASSESSMENT_STATUS } from "@/lib/progress-assessment-constants";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

export function ReviewActionBar({
  assessmentId,
  status,
  onReviewFinished,
  className,
  density = "default",
}: {
  assessmentId: string;
  status: string;
  /** Called after a successful review; parent should refresh, show feedback, and close the modal. */
  onReviewFinished: (message: string) => void;
  /** Optional wrapper classes (panel chrome on the assessment page). */
  className?: string;
  /** Compact layout when the bar sits in the modal header (fewer stacks, tighter copy). */
  density?: "default" | "compact";
}) {
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisionAttempted, setRevisionAttempted] = useState(false);

  const canAct = status === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW;

  const postReview = async (action: "approve" | "request_correction") => {
    if (busy) return;
    setError(null);
    if (action === "request_correction") {
      setRevisionAttempted(true);
      if (reviewNote.trim().length < 3) {
        setError(
          "Revision requests need specific feedback — add what to change before sending it back (at least 3 characters).",
        );
        return;
      }
    }
    setBusy(true);
    try {
      const body: { action: string; reviewNote?: string | null } = { action };
      if (action === "request_correction") {
        body.reviewNote = reviewNote.trim();
      } else if (reviewNote.trim()) {
        body.reviewNote = reviewNote.trim();
      }
      const res = await fetch(`/api/progress/assessments/${encodeURIComponent(assessmentId)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setError(
          getApiErrorMessageFromPayload(data, "Could not complete this action. Try again."),
        );
        return;
      }
      onReviewFinished(
        action === "approve"
          ? "Approved — removed from your queue."
          : "Correction requested — sent back to the author.",
      );
    } catch {
      setError(
        `${NETWORK_RETRY_HINT} Your decision was not recorded—open the assessment again if needed.`,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!canAct) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 sm:text-sm">
        This assessment is not awaiting review.
      </p>
    );
  }

  const noteTooShortForRevision = reviewNote.trim().length < 3;
  const revisionNoteRequired = revisionAttempted && noteTooShortForRevision;

  const spacing = density === "compact" ? "space-y-2" : "space-y-3";

  return (
    <div className={`${spacing} ${className ?? ""}`}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Reviewer decision
        </p>
        <p className={`mt-0.5 leading-snug text-slate-600 ${density === "compact" ? "text-[11px]" : "mt-1 text-xs"}`}>
          Approve to lock the record, or request revision — revisions{" "}
          <span className="font-semibold text-slate-800">must</span> include feedback below.
        </p>
      </div>

      <div>
        <label htmlFor="review-note" className="text-xs font-semibold text-slate-800">
          Note for the author
          <span className="ml-1 font-normal text-red-700">(required for revision requests)</span>
        </label>
        {density === "default" ? (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Optional when approving. When requesting revision, explain what is missing or inaccurate.
          </p>
        ) : null}
        <textarea
          id="review-note"
          value={reviewNote}
          onChange={(e) => {
            setReviewNote(e.target.value);
            setError(null);
          }}
          rows={density === "compact" ? 2 : 3}
          aria-invalid={revisionNoteRequired || undefined}
          placeholder="What should change before this can be approved?"
          className={`mt-1.5 w-full resize-y rounded-lg border bg-white px-2.5 py-1.5 text-sm leading-snug text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100/80 ${
            revisionNoteRequired ? "border-red-400 ring-2 ring-red-100" : "border-slate-200"
          } ${density === "compact" ? "min-h-[3.25rem]" : "min-h-[4.25rem]"}`}
        />
      </div>

      {revisionNoteRequired ? (
        <p className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-900 sm:text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Add revision feedback above so the author knows exactly what to fix.</span>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-900 sm:text-sm">{error}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void postReview("approve")}
          className="order-1 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg bg-gradient-to-r from-sky-700 via-sky-600 to-emerald-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:order-2"
        >
          {busy ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void postReview("request_correction")}
          className="order-2 inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
        >
          {busy ? "Working…" : "Request revision"}
        </button>
      </div>
    </div>
  );
}

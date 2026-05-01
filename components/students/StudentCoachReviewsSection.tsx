"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquareText, Pencil, Send } from "lucide-react";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";
import {
  APP_STAFF_ROLES,
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";
import {
  parseStudentReviewVisibility,
  STUDENT_REVIEW_STATUS,
  STUDENT_REVIEW_VISIBILITY,
  type StudentReviewVisibility,
} from "@/lib/student-review-constants";

type SerializedReview = {
  id: string;
  authorUserId: string;
  authorRole: string;
  authorEmail: string;
  title: string | null;
  note: string;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { ok: true; reviews: SerializedReview[] } | { ok: false; error?: unknown };

function isStaffRole(role: string): boolean {
  return (APP_STAFF_ROLES as readonly string[]).includes(role);
}

function badgeClass(kind: "status" | "visibility", value: string): string {
  if (kind === "status") {
    if (value === STUDENT_REVIEW_STATUS.PUBLISHED) {
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    }
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  if (value === STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE) {
    return "border-sky-200 bg-sky-50 text-sky-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function labelForStatus(v: string): string {
  if (v === STUDENT_REVIEW_STATUS.PUBLISHED) return "Published";
  if (v === STUDENT_REVIEW_STATUS.DRAFT) return "Draft";
  return v;
}

function visibilityBadge(v: string): { text: string; title: string } {
  if (v === STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE) {
    return {
      text: "Shared with parents",
      title: "Can appear to parents after a head coach or admin publishes this item.",
    };
  }
  if (v === STUDENT_REVIEW_VISIBILITY.INTERNAL) {
    return {
      text: "Internal",
      title: "Visible to staff only; parents never see this item.",
    };
  }
  return { text: v, title: "" };
}

export function StudentCoachReviewsSection({
  studentId,
  userRole,
}: {
  studentId: string;
  userRole: string;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id?.trim() ?? "";

  const staff = isStaffRole(userRole);
  const canPublish = userRole === ROLE_HEAD_COACH || userRole === ROLE_ADMIN;

  const [reviews, setReviews] = useState<SerializedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<StudentReviewVisibility>(
    STUDENT_REVIEW_VISIBILITY.INTERNAL,
  );
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState<StudentReviewVisibility>(
    STUDENT_REVIEW_VISIBILITY.INTERNAL,
  );
  const [editSaving, setEditSaving] = useState(false);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/reviews`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as ListResponse;
      if (!res.ok || !data.ok) {
        setError(getApiErrorMessageFromPayload(data, "Could not load reviews."));
        setReviews([]);
        return;
      }
      setReviews(data.reviews);
    } catch {
      setError("Could not load reviews.");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const refresh = () => setRefreshTick((n) => n + 1);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setActionError(null);
    const n = note.trim();
    if (!n) {
      setActionError("Note is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(studentId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          note: n,
          visibility,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Could not save review."));
        return;
      }
      setTitle("");
      setNote("");
      setVisibility(STUDENT_REVIEW_VISIBILITY.INTERNAL);
      refresh();
    } catch {
      setActionError("Could not save review.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(r: SerializedReview) {
    setActionError(null);
    setEditingId(r.id);
    setEditTitle(r.title?.trim() ?? "");
    setEditNote(r.note);
    setEditVisibility(
      r.visibility === STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE
        ? STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE
        : STUDENT_REVIEW_VISIBILITY.INTERNAL,
    );
  }

  async function saveEdit() {
    if (!editingId || editSaving) return;
    const n = editNote.trim();
    if (!n) {
      setActionError("Note cannot be empty.");
      return;
    }
    setEditSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || null,
          note: n,
          visibility: editVisibility,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Could not update review."));
        return;
      }
      setEditingId(null);
      refresh();
    } catch {
      setActionError("Could not update review.");
    } finally {
      setEditSaving(false);
    }
  }

  async function publish(id: string) {
    if (publishBusyId) return;
    setPublishBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: STUDENT_REVIEW_STATUS.PUBLISHED }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setActionError(getApiErrorMessageFromPayload(data, "Could not publish."));
        return;
      }
      refresh();
    } catch {
      setActionError("Could not publish.");
    } finally {
      setPublishBusyId(null);
    }
  }

  const canEditRow = (r: SerializedReview) => {
    if (userRole === ROLE_ADMIN || userRole === ROLE_HEAD_COACH) return true;
    if (userRole === ROLE_ASSISTANT_COACH) {
      return r.authorUserId === currentUserId && r.status === STUDENT_REVIEW_STATUS.DRAFT;
    }
    return false;
  };

  return (
    <section
      id="staff-feedback"
      className="scroll-mt-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-soft"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-900 ring-1 ring-amber-900/10">
          <MessageSquareText className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Staff Feedback</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Internal</span> is visible to staff only.
            <span className="font-medium text-slate-600"> Shared with parents</span> can appear to
            parents after publish (head coach or admin).
          </p>
        </div>
      </div>

      {staff ? (
        <form onSubmit={onCreate} className="mb-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Add feedback
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">
              Title <span className="font-normal text-slate-400">(optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-amber-900/0 transition focus:border-amber-800/40 focus:ring-2 focus:ring-amber-900/15"
                placeholder="e.g. Mid-term check-in"
                maxLength={200}
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Visibility
              <select
                value={visibility}
                onChange={(e) => {
                  const v = parseStudentReviewVisibility(e.target.value);
                  if (v) setVisibility(v);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-amber-800/40 focus:ring-2 focus:ring-amber-900/15"
              >
                <option value={STUDENT_REVIEW_VISIBILITY.INTERNAL}>Internal — staff only</option>
                <option value={STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE}>
                  Shared with parents — when published
                </option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-700">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-amber-800/40 focus:ring-2 focus:ring-amber-900/15"
              placeholder="Write feedback for this student…"
              required
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {submitting ? "Saving…" : "Save as draft"}
            </button>
            {userRole === ROLE_ASSISTANT_COACH ? (
              <p className="text-[11px] text-slate-500">
                Head coach or admin publishes parent-visible reviews.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      {actionError ? (
        <p className="mb-3 rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-xs text-red-900">
          {actionError}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-500">No staff feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass("status", r.status)}`}
                >
                  {labelForStatus(r.status)}
                </span>
                <span
                  title={visibilityBadge(r.visibility).title}
                  className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass("visibility", r.visibility)}`}
                >
                  {visibilityBadge(r.visibility).text}
                </span>
                <span className="ml-auto text-[10px] text-slate-400">
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {r.authorEmail.split("@")[0] || "Coach"}{" "}
                <span className="text-slate-400">· {r.authorRole.replace("_", " ")}</span>
              </p>
              {editingId === r.id ? (
                <div className="mt-3 space-y-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Title (optional)"
                  />
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                  <select
                    value={editVisibility}
                    onChange={(e) => {
                      const v = parseStudentReviewVisibility(e.target.value);
                      if (v) setEditVisibility(v);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value={STUDENT_REVIEW_VISIBILITY.INTERNAL}>Internal — staff only</option>
                    <option value={STUDENT_REVIEW_VISIBILITY.PARENT_VISIBLE}>
                      Shared with parents — when published
                    </option>
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={editSaving}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {r.title?.trim() ? (
                    <p className="mt-2 text-sm font-semibold text-slate-900">{r.title.trim()}</p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {r.note}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {staff && !canEditRow(r) ? (
                      <p className="text-[11px] font-medium text-slate-500">
                        {userRole === ROLE_ASSISTANT_COACH
                          ? "Read-only — you can edit only feedback you created (while it is still a draft)."
                          : "Read-only for your role."}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                    {canEditRow(r) ? (
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                      >
                        <Pencil className="h-3 w-3" aria-hidden />
                        Edit
                      </button>
                    ) : null}
                    {canPublish && r.status === STUDENT_REVIEW_STATUS.DRAFT ? (
                      <button
                        type="button"
                        disabled={publishBusyId !== null}
                        onClick={() => void publish(r.id)}
                        className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {publishBusyId === r.id ? "Publishing…" : "Publish"}
                      </button>
                    ) : null}
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

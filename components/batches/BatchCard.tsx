"use client";

import { deriveTimeSlotLabel, isEliteFromBatchName } from "@/lib/batch-ui-derive";
import { formatBatchTimeRange } from "@/lib/batch-time";
import { Clock, GitBranch, Pencil, Power, User, UserPlus, Users } from "lucide-react";
import Link from "next/link";

export type BatchCardModel = {
  id: string;
  name: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  studentCount: number;
  branchName: string | null;
  /** User accounts with role head_coach for this batch's branch (from institute roster). */
  branchHeadCoachLabel: string | null;
  coach: { id: string; fullName: string } | null;
  assistantCoaches: { userId: string; label: string }[];
};

function normalizeStatus(status: string | null | undefined): "ACTIVE" | "INACTIVE" {
  if ((status ?? "").toUpperCase() === "ACTIVE") return "ACTIVE";
  return "INACTIVE";
}

type Props = {
  batch: BatchCardModel;
  busy: boolean;
  onToggleStatus: () => void;
  /** Hides status toggle; use on branch overview where changing status is not the focus. */
  readOnly?: boolean;
  /** When false, hides pencil + active/inactive controls (e.g. non-admin staff). */
  showMetadataActions?: boolean;
};

export function BatchCard({
  batch,
  busy,
  onToggleStatus,
  readOnly = false,
  showMetadataActions = true,
}: Props) {
  const status = normalizeStatus(batch.status);
  const title = batch.name?.trim() ? batch.name.trim() : "Untitled batch";
  const slot = deriveTimeSlotLabel(batch.startTime);
  const elite = isEliteFromBatchName(batch.name);
  const timeRange = formatBatchTimeRange(batch.startTime, batch.endTime);
  const count = batch.studentCount ?? 0;
  const legacyCoachName = batch.coach?.fullName?.trim() || null;
  const branchName = batch.branchName?.trim() || null;
  const headCoachLine = batch.branchHeadCoachLabel?.trim() || null;
  const assistantLine =
    batch.assistantCoaches?.length > 0
      ? batch.assistantCoaches.map((a) => a.label).join(", ")
      : null;

  const showSideActions = !readOnly && showMetadataActions;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm transition hover:shadow-soft">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <div className="flex flex-wrap justify-end gap-1.5">
            {slot ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100">
                {slot}
              </span>
            ) : null}
            {elite ? (
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800 ring-1 ring-violet-100">
                Elite
              </span>
            ) : null}
            <span
              className={[
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
                status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                  : "bg-slate-100 text-slate-600 ring-slate-200",
              ].join(" ")}
            >
              {status === "ACTIVE" ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 text-slate-600">
            <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
            <span>
              <span className="text-slate-400">Branch · </span>
              {branchName ?? (
                <span className="text-slate-500 italic">Not set</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-600">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
            <span>
              <span className="text-slate-400">Head coach · </span>
              {headCoachLine ? (
                headCoachLine
              ) : branchName ? (
                <span className="text-slate-500 italic">No head coach assigned</span>
              ) : (
                <span className="text-slate-500 italic">Set a branch to show head coach</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-600">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
            <span>
              <span className="text-slate-400">Assistant coaches · </span>
              {assistantLine ?? (
                <span className="text-slate-500 italic">No assistant coaches assigned</span>
              )}
            </span>
          </div>
          {legacyCoachName ? (
            <div className="flex items-start gap-2 text-slate-600">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
              <span>
                <span className="text-slate-400">Coach directory · </span>
                {legacyCoachName}
              </span>
            </div>
          ) : null}
          <div className="flex items-start gap-2 text-slate-600">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
            <span>
              {timeRange ?? (
                <span className="text-slate-500">Schedule not set</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2 text-slate-600">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
            <span>
              {count === 1 ? "1 student" : `${count} students`}
              <span className="text-slate-400"> · </span>
              <span className="text-slate-500">Capacity not tracked</span>
            </span>
          </div>
        </div>
      </div>

      <div
        className={`mt-4 flex items-stretch border-t border-slate-100 pt-4 ${showSideActions ? "gap-2" : ""}`}
      >
        <Link
          href={`/batches/${batch.id}`}
          className={`inline-flex min-h-[44px] min-w-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 ${showSideActions ? "flex-1" : "w-full"}`}
        >
          {readOnly ? "View batch details" : "Manage"}
        </Link>
        {showSideActions ? (
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/batches/${batch.id}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Edit batch details"
              title="Edit"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleStatus()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              aria-label={status === "ACTIVE" ? "Set batch inactive" : "Set batch active"}
              title={busy ? "Updating…" : status === "ACTIVE" ? "Set inactive" : "Set active"}
            >
              <Power className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

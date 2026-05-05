"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, Layers, UserPlus, Users } from "lucide-react";
import { BatchCard, type BatchCardModel } from "@/components/batches/BatchCard";
import type { BranchControlCenterBatch } from "@/lib/branch-control-center-data";

function toCardModel(b: BranchControlCenterBatch): BatchCardModel {
  return {
    id: b.id,
    name: b.name,
    status: b.status,
    startTime: b.startTime,
    endTime: b.endTime,
    studentCount: b.studentCount,
    branchName: b.branchName,
    branchHeadCoachLabel: b.branchHeadCoachLabel,
    coach: b.coach ? { id: b.coach.id, fullName: b.coach.fullName } : null,
    assistantCoaches: b.assistantCoaches,
  };
}

type Props = {
  branch: { id: string; name: string; createdAt: string };
  headCoachLabels: string[];
  assistantCoachLabels: string[];
  batches: BranchControlCenterBatch[];
};

export function BranchControlCenter({
  branch,
  headCoachLabels,
  assistantCoachLabels,
  batches,
}: Props) {
  const created = new Date(branch.createdAt).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/branches"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All branches
      </Link>

      <header className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900/90">
          Branch control center
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{branch.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
            Added {created}
          </span>
          <span className="text-slate-300">·</span>
          <span>
            {batches.length} batch{batches.length === 1 ? "" : "es"} in this branch
          </span>
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/80">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Staff assigned to this branch</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Head coaches are linked by branch on their account. Assistant coaches appear when
              assigned to any batch here.
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Head coach
                </dt>
                <dd className="mt-1 text-slate-800">
                  {headCoachLabels.length > 0 ? (
                    headCoachLabels.join(" · ")
                  ) : (
                    <span className="text-slate-500 italic">No head coach assigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Assistant coaches
                </dt>
                <dd className="mt-1 text-slate-800">
                  {assistantCoachLabels.length > 0 ? (
                    assistantCoachLabels.join(" · ")
                  ) : (
                    <span className="text-slate-500 italic">No assistant coaches assigned</span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Invite or reassign staff from{" "}
              <Link href="/admin/invites" className="font-semibold text-amber-900 hover:underline">
                Invites
              </Link>
              . Batch-level assistants are managed on each batch.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-900 ring-1 ring-amber-900/10">
              <Layers className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Batches in this branch</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Head coach, assistants, and coach directory are shown per batch. Open manage for
                roster and assignments.
              </p>
            </div>
          </div>
          <Link
            href="/batches/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            New batch
          </Link>
        </div>

        {batches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-800">No batches in this branch yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Create a batch to start scheduling and assigning coaches.
            </p>
            <Link
              href="/batches/new"
              className="mt-4 inline-block text-sm font-semibold text-amber-900 hover:underline"
            >
              Create batch
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {batches.map((b) => (
              <BatchCard
                key={b.id}
                batch={toCardModel(b)}
                busy={false}
                onToggleStatus={() => {}}
                readOnly
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

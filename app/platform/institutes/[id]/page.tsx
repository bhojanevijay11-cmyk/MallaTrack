import Link from "next/link";
import { notFound } from "next/navigation";
import { InstituteStatusControl } from "@/components/platform/InstituteStatusControl";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { INSTITUTE_STATUS_DISABLED } from "@/lib/institute-status";
import { requireSuperAdminPage } from "@/lib/platform-auth";
import { getPlatformInstituteDetail } from "@/lib/platform-institutes";

type PageProps = { params: Promise<{ id: string }> };

type SummaryCard = {
  label: string;
  value: number;
  hint?: string;
};

function SummaryCardGrid({
  title,
  description,
  cards,
}: {
  title: string;
  description?: string;
  cards: readonly SummaryCard[];
}) {
  return (
    <section aria-label={title} className="mb-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
        {title}
      </h2>
      {description ? (
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-slate-600">{description}</p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
            {card.hint ? (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{card.hint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PlatformInstituteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const trimmed = id?.trim() ?? "";
  if (!trimmed) notFound();

  await requireSuperAdminPage(`/platform/institutes/${trimmed}`);

  const payload = await getPlatformInstituteDetail(trimmed);
  if (!payload) notFound();

  const { institute: inst } = payload;
  const c = inst.counts;

  const rosterCards: SummaryCard[] = [
    {
      label: "Total students",
      value: c.studentsTotal,
      hint: "All Student rows linked to this institute (any batch linkage or status).",
    },
    {
      label: "Active students",
      value: c.studentsActive,
      hint: "Student records marked ACTIVE (status field on each student).",
    },
    {
      label: "Inactive students",
      value: c.studentsInactive,
      hint: "Total students minus ACTIVE (non-ACTIVE statuses grouped here).",
    },
    {
      label: "Students on Admin roster",
      value: c.studentsOperationalRoster,
      hint: "Same operational rules as the tenant Admin dashboard student list (valid institute + batch–branch linkage).",
    },
    {
      label: "Total batches",
      value: c.batchesTotal,
      hint: "All Batch rows for this institute (any branch linkage or status).",
    },
    {
      label: "Active batches",
      value: c.batchesActive,
      hint: "Batch records marked ACTIVE (status field on each batch).",
    },
    {
      label: "Inactive batches",
      value: c.batchesInactive,
      hint: "Total batches minus ACTIVE.",
    },
    {
      label: "Active operational batches",
      value: c.batchesActiveOperational,
      hint: 'Matches the tenant Admin “Total active batches” KPI (ACTIVE and valid branch on batch).',
    },
  ];

  const peopleCards: SummaryCard[] = [
    {
      label: "Total staff (user accounts)",
      value: c.staffUsersTotal,
      hint: "Head coach + assistant coach users linked to this institute (User.role).",
    },
    {
      label: "Admins",
      value: c.admins,
      hint: "Admin user accounts for this institute (no per-user active/inactive flag in the data model).",
    },
    {
      label: "Head coaches",
      value: c.headCoaches,
      hint: "User accounts with head_coach role for this institute.",
    },
    {
      label: "Assistant coaches",
      value: c.assistantCoaches,
      hint: "User accounts with assistant_coach role for this institute.",
    },
    {
      label: "Parents",
      value: c.parents,
      hint: "User accounts with parent role for this institute.",
    },
    {
      label: "Branches",
      value: c.branches,
      hint: "Branches linked to this institute (no active/inactive flag on branch records).",
    },
    {
      label: "Invites (total)",
      value: c.invitesTotal,
      hint: "All Invite rows for this institute.",
    },
    {
      label: "Unused invites",
      value: c.invitesPending,
      hint: "Rows where usedAt is null (not yet accepted).",
    },
  ];

  return (
    <PlatformShell>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Platform / Institutes
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {inst.name}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                  inst.status === INSTITUTE_STATUS_DISABLED
                    ? "bg-red-100 text-red-900"
                    : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {inst.status === INSTITUTE_STATUS_DISABLED ? "Disabled" : "Active"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Tenant overview; emergency control below. Platform totals are database-wide for the
              institute unless a card says it matches the Admin dashboard.
            </p>
          </div>
          <Link
            href="/platform/institutes"
            className="text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4 hover:text-amber-950"
          >
            ← All institutes
          </Link>
        </div>

        <SummaryCardGrid
          title="Students & batches"
          description="Active/inactive splits use Student.status and Batch.status (ACTIVE vs other values). Totals include all rows scoped to this institute."
          cards={rosterCards}
        />

        <SummaryCardGrid
          title="People, branches & invites"
          cards={peopleCards}
        />

        <section aria-label="Emergency control" className="mb-8">
          <InstituteStatusControl instituteId={inst.id} initialStatus={inst.status} />
        </section>

        <section aria-label="Admins" className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
            Admins
          </h2>
          {inst.admins.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
              No admin users linked to this institute.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {inst.admins.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium text-slate-900">
                    {a.name ?? "—"}
                  </span>
                  <span className="text-sm text-slate-600">{a.email}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Branches">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
            Branches
          </h2>
          {inst.branches.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
              No branches for this institute.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3 text-right">Batches (linked)</th>
                    <th className="px-4 py-3 text-right">Students (in batches)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inst.branches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {b.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                        {b.batchCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                        {b.studentCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
                Batch and student columns count only rows assigned to a batch on this branch;
                unassigned students are not included in the per-branch student total.
              </p>
            </div>
          )}
        </section>
      </main>
    </PlatformShell>
  );
}

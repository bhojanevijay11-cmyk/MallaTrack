import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { INSTITUTE_STATUS_DISABLED } from "@/lib/institute-status";
import { requireSuperAdminPage } from "@/lib/platform-auth";
import { getPlatformInstituteSummaries } from "@/lib/platform-institutes";
import { logError } from "@/lib/server-log";

function StatusBadge({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        disabled
          ? "bg-red-100 text-red-900"
          : "bg-emerald-100 text-emerald-900"
      }`}
    >
      {disabled ? "Disabled" : "Active"}
    </span>
  );
}

export default async function PlatformInstitutesPage() {
  await requireSuperAdminPage("/platform/institutes");

  let institutes: Awaited<ReturnType<typeof getPlatformInstituteSummaries>> = [];
  let loadError: string | null = null;

  try {
    institutes = await getPlatformInstituteSummaries();
  } catch (e) {
    logError("platform_institutes_load_failed", { route: "/platform/institutes" }, e);
    loadError = "Unable to load institutes. Try again later.";
  }

  return (
    <PlatformShell>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Platform
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Institutes
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tenant directory and emergency status (see detail to change). Counts are all database
              rows linked to each institute (not the same filters as the tenant Admin dashboard).
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Link
              href="/platform/institutes/new"
              className="inline-flex items-center justify-center rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100"
            >
              Create institute
            </Link>
            <Link
              href="/platform"
              className="text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4 hover:text-amber-950"
            >
              ← Back to platform
            </Link>
          </div>
        </div>

        {loadError ? (
          <div
            className="rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            {loadError}
          </div>
        ) : institutes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center shadow-sm">
            <p className="text-sm text-slate-600">No institutes found yet.</p>
            <Link
              href="/platform/institutes/new"
              className="mt-4 inline-flex rounded-lg border border-amber-200/90 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100"
            >
              Create institute
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3 sm:hidden">
              {institutes.map((row) => {
                const staffCount =
                  row.headCoachCount + row.assistantCoachCount;
                const disabled = row.status === INSTITUTE_STATUS_DISABLED;
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900">
                        {row.name}
                      </h2>
                      <StatusBadge disabled={disabled} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          Admins
                        </dt>
                        <dd className="tabular-nums text-slate-900">
                          {row.adminCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          Total staff
                        </dt>
                        <dd className="tabular-nums text-slate-900">
                          {staffCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          Branches
                        </dt>
                        <dd className="tabular-nums text-slate-900">
                          {row.branchCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          Total batches
                        </dt>
                        <dd className="tabular-nums text-slate-900">
                          {row.batchCount}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                          Total students
                        </dt>
                        <dd className="tabular-nums text-slate-900">
                          {row.studentCount}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/platform/institutes/${row.id}`}
                      className="mt-4 flex w-full items-center justify-center rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="hidden sm:block sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-slate-200/80 sm:bg-white sm:shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Institute</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Admins</th>
                    <th className="px-4 py-3 text-right">Total staff</th>
                    <th className="px-4 py-3 text-right">Parents</th>
                    <th className="px-4 py-3 text-right">Branches</th>
                    <th className="px-4 py-3 text-right">Total batches</th>
                    <th className="px-4 py-3 text-right">Total students</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {institutes.map((row) => {
                    const staffCount =
                      row.headCoachCount + row.assistantCoachCount;
                    return (
                      <tr key={row.id} className="text-slate-800">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                              row.status === INSTITUTE_STATUS_DISABLED
                                ? "bg-red-100 text-red-900"
                                : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {row.status === INSTITUTE_STATUS_DISABLED
                              ? "Disabled"
                              : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.adminCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {staffCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.parentCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.branchCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.batchCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.studentCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/platform/institutes/${row.id}`}
                            className="inline-flex rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </PlatformShell>
  );
}

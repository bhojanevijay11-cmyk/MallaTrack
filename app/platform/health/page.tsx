import Link from "next/link";
import { HealthIssueRepairControl } from "@/components/platform/HealthIssueRepairControl";
import { MobileField } from "@/components/platform/MobileField";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { formatShortId } from "@/lib/format-short-id";
import { requireSuperAdminPage } from "@/lib/platform-auth";
import {
  getPlatformHealthReport,
  type PlatformHealthIssue,
} from "@/lib/platform-health";
import { getInstituteBranchOptions } from "@/lib/platform-institutes";

function SeverityBadge({
  severity,
}: {
  severity: PlatformHealthIssue["severity"];
}) {
  if (severity === "critical") {
    return (
      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
        Critical
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
      Warning
    </span>
  );
}

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type BranchOptions = Awaited<ReturnType<typeof getInstituteBranchOptions>>;

function IssueRepairBlock({
  row,
  branchOptionsByInstitute,
}: {
  row: PlatformHealthIssue;
  branchOptionsByInstitute: Map<string, BranchOptions>;
}) {
  if (row.category === "batch.missing_branch") {
    return (
      <HealthIssueRepairControl
        issue={row}
        branchOptions={
          row.instituteId
            ? (branchOptionsByInstitute.get(row.instituteId) ?? [])
            : []
        }
      />
    );
  }
  if (
    row.category === "batch.branch_orphan_fk" ||
    row.category === "student.batch_orphan_fk" ||
    row.category === "user.head_coach_branch_orphan_fk" ||
    row.category === "batch_assistant.batch_orphan_fk"
  ) {
    return <HealthIssueRepairControl issue={row} />;
  }
  return (
    <span className="text-xs text-slate-500">Manual review required</span>
  );
}

export default async function PlatformHealthPage() {
  await requireSuperAdminPage("/platform/health");

  let report: Awaited<ReturnType<typeof getPlatformHealthReport>> | null = null;
  let loadError: string | null = null;

  try {
    report = await getPlatformHealthReport();
  } catch (e) {
    console.error("[platform/health]", e);
    loadError = "Unable to load health data. Try again later.";
  }

  const branchOptionsByInstitute = new Map<string, BranchOptions>();

  if (report) {
    const instituteIds = [
      ...new Set(
        report.issues
          .filter(
            (i) => i.category === "batch.missing_branch" && i.instituteId,
          )
          .map((i) => i.instituteId as string),
      ),
    ];
    await Promise.all(
      instituteIds.map(async (id) => {
        const branches = await getInstituteBranchOptions(id);
        branchOptionsByInstitute.set(id, branches);
      }),
    );
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
              System health
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Cross-tenant setup and data integrity signals. Narrow SUPER_ADMIN
              repairs are available only for safe batch branch fixes; all other
              issues need manual review.
            </p>
          </div>
          <Link
            href="/platform"
            className="text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4 hover:text-amber-950"
          >
            ← Back to platform
          </Link>
        </div>

        {loadError ? (
          <div
            className="rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            {loadError}
          </div>
        ) : report ? (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Total issues
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {report.summary.totalIssues}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Critical
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-rose-800">
                  {report.summary.criticalCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Warnings
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-900">
                  {report.summary.warningCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Checked at
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {formatCheckedAt(report.summary.checkedAt)}
                </p>
              </div>
            </div>

            {report.issues.length === 0 ? (
              <p className="rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
                No platform health issues found.
              </p>
            ) : (
              <>
                <ul className="space-y-4 sm:hidden">
                  {report.issues.map((row) => {
                    const shortEntity = formatShortId(row.entityId);
                    return (
                      <li
                        key={row.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={row.severity} />
                          <span className="font-mono text-xs text-slate-700">
                            {row.category}
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          <MobileField label="Institute">
                            {row.instituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </MobileField>
                          <MobileField label="Entity">
                            <span className="font-mono text-xs text-slate-800">
                              {row.entityType}
                            </span>
                            <p
                              className="mt-0.5 font-mono text-xs text-slate-600"
                              title={row.entityId}
                            >
                              {shortEntity ?? row.entityId}
                            </p>
                          </MobileField>
                          <MobileField label="Description">
                            {row.description}
                          </MobileField>
                          <MobileField label="Recommended action">
                            {row.recommendedAction}
                          </MobileField>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Repair
                          </p>
                          <div
                            className="mt-2 w-full min-w-0 [&_div.flex.flex-col]:!min-w-0 [&_div.flex.flex-col]:w-full [&_select]:w-full [&_button]:w-full"
                          >
                            <IssueRepairBlock
                              row={row}
                              branchOptionsByInstitute={
                                branchOptionsByInstitute
                              }
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden sm:block sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-slate-200/80 sm:bg-white sm:shadow-sm">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Institute</th>
                        <th className="px-4 py-3">Entity</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Recommended action</th>
                        <th className="px-4 py-3">Repair</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.issues.map((row) => (
                        <tr key={row.id} className="align-top text-slate-800">
                          <td className="px-4 py-3">
                            <SeverityBadge severity={row.severity} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-700">
                            {row.category}
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            {row.instituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-600">
                              {row.entityType}
                            </span>
                            <div className="mt-0.5 break-all font-mono text-[11px] text-slate-500">
                              {row.entityId}
                            </div>
                          </td>
                          <td className="max-w-xs px-4 py-3 text-slate-700">
                            {row.description}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-slate-600">
                            {row.recommendedAction}
                          </td>
                          <td className="px-4 py-3">
                            <IssueRepairBlock
                              row={row}
                              branchOptionsByInstitute={
                                branchOptionsByInstitute
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </PlatformShell>
  );
}

import Link from "next/link";
import { MobileField } from "@/components/platform/MobileField";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { formatShortId } from "@/lib/format-short-id";
import { requireSuperAdminPage } from "@/lib/platform-auth";
import {
  getPlatformParentLinks,
  getPlatformSupportInvites,
  getPlatformSupportUsers,
} from "@/lib/platform-support";
import { logError } from "@/lib/server-log";

const PREVIEW_LIMIT = 25;

function PreviewError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
      {message}
    </p>
  );
}

function formatInviteWhen(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatLinkStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export default async function PlatformSupportPage() {
  await requireSuperAdminPage("/platform/support");

  let usersResult: Awaited<ReturnType<typeof getPlatformSupportUsers>> | null =
    null;
  let invitesResult: Awaited<
    ReturnType<typeof getPlatformSupportInvites>
  > | null = null;
  let linksResult: Awaited<ReturnType<typeof getPlatformParentLinks>> | null =
    null;
  let usersError: string | null = null;
  let invitesError: string | null = null;
  let linksError: string | null = null;

  try {
    usersResult = await getPlatformSupportUsers({ limit: PREVIEW_LIMIT });
  } catch (e) {
    logError("platform_support_users_preview_failed", { route: "/platform/support" }, e);
    usersError = "Could not load user scope preview.";
  }

  try {
    invitesResult = await getPlatformSupportInvites({ limit: PREVIEW_LIMIT });
  } catch (e) {
    logError("platform_support_invites_preview_failed", { route: "/platform/support" }, e);
    invitesError = "Could not load invite preview.";
  }

  try {
    linksResult = await getPlatformParentLinks({ limit: PREVIEW_LIMIT });
  } catch (e) {
    logError("platform_support_parent_links_preview_failed", { route: "/platform/support" }, e);
    linksError = "Could not load parent link preview.";
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
              Support tools
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Read-only views for account scope, invites, and parent–student
              links. No actions are available from this area.
            </p>
          </div>
          <Link
            href="/platform"
            className="text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4 hover:text-amber-950"
          >
            ← Back to platform
          </Link>
        </div>

        <div className="space-y-10">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
              User scope inspector
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              See institute and branch assignment, batch assignments for
              assistants, and how parent accounts tie to students—useful when
              login or roster access does not match expectations.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              API:{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                GET /api/platform/support/users
              </code>
            </p>
            {usersError ? (
              <div className="mt-4">
                <PreviewError message={usersError} />
              </div>
            ) : usersResult && usersResult.users.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No users match.</p>
            ) : (
              <>
                <ul className="mt-4 space-y-3 sm:hidden">
                  {usersResult?.users.map((u) => (
                    <li
                      key={u.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                    >
                      <div className="space-y-3">
                        <MobileField label="Email">
                          <span className="font-mono text-xs">{u.email}</span>
                        </MobileField>
                        <MobileField label="Role">{u.role}</MobileField>
                        <MobileField label="Institute">
                          {u.instituteName ?? (
                            <span className="text-slate-400">—</span>
                          )}
                        </MobileField>
                        <MobileField label="Branch">
                          {u.branchName ?? (
                            <span className="text-slate-400">—</span>
                          )}
                        </MobileField>
                        <MobileField label="Scope summary">
                          {u.scopeSummary}
                        </MobileField>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 hidden sm:block sm:overflow-x-auto sm:rounded-xl sm:border sm:border-slate-100">
                  <table className="min-w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-xs">
                      <tr>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Institute</th>
                        <th className="px-3 py-2">Branch</th>
                        <th className="px-3 py-2">Scope summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {usersResult?.users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-3 py-2 font-mono text-[11px] sm:text-xs">
                            {u.email}
                          </td>
                          <td className="px-3 py-2">{u.role}</td>
                          <td className="px-3 py-2">
                            {u.instituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {u.branchName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="max-w-xs px-3 py-2 text-slate-700">
                            {u.scopeSummary}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Showing latest {PREVIEW_LIMIT} users (newest first). Use the API
              with query params for filters.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
              Invite visibility
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Inspect pending, expired, and accepted invites without tokens—
              helps confirm onboarding emails and staff/parent flows per
              institute.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              API:{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                GET /api/platform/support/invites
              </code>
            </p>
            {invitesError ? (
              <div className="mt-4">
                <PreviewError message={invitesError} />
              </div>
            ) : invitesResult && invitesResult.invites.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No invites match.</p>
            ) : (
              <>
                <ul className="mt-4 space-y-3 sm:hidden">
                  {invitesResult?.invites.map((inv) => {
                    const accepted = formatInviteWhen(inv.acceptedAt);
                    const expires = formatInviteWhen(inv.expiresAt);
                    return (
                      <li
                        key={inv.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                      >
                        <div className="space-y-3">
                          <MobileField label="Email">
                            <span className="font-mono text-xs">
                              {inv.email ?? "—"}
                            </span>
                          </MobileField>
                          <MobileField label="Role">{inv.role}</MobileField>
                          <MobileField label="Institute">
                            {inv.instituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </MobileField>
                          <MobileField label="Status">
                            <span className="capitalize">{inv.status}</span>
                          </MobileField>
                          {accepted ? (
                            <MobileField label="Accepted">{accepted}</MobileField>
                          ) : null}
                          {expires ? (
                            <MobileField label="Expires">{expires}</MobileField>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 hidden sm:block sm:overflow-x-auto sm:rounded-xl sm:border sm:border-slate-100">
                  <table className="min-w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-xs">
                      <tr>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Institute</th>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {invitesResult?.invites.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-3 py-2 font-mono text-[11px] sm:text-xs">
                            {inv.email ?? "—"}
                          </td>
                          <td className="px-3 py-2">{inv.role}</td>
                          <td className="px-3 py-2 capitalize">{inv.status}</td>
                          <td className="px-3 py-2">
                            {inv.instituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-slate-700">
                            {inv.studentLabel ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                            {inv.expiresAt
                              ? new Date(inv.expiresAt).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Showing latest {PREVIEW_LIMIT} invites (newest first). Tokens are
              never shown here or in the API.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
              Parent link inspector
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Review parent–student linkage and institute alignment for access
              troubleshooting (no contact or medical fields).
            </p>
            <p className="mt-1 text-xs text-slate-500">
              API:{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                GET /api/platform/support/parent-links
              </code>
            </p>
            {linksError ? (
              <div className="mt-4">
                <PreviewError message={linksError} />
              </div>
            ) : linksResult && linksResult.links.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No students match.</p>
            ) : (
              <>
                <ul className="mt-4 space-y-3 sm:hidden">
                  {linksResult?.links.map((row) => {
                    const shortId = formatShortId(row.studentId);
                    return (
                      <li
                        key={row.studentId}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                      >
                        <div className="space-y-3">
                          <MobileField label="Student">
                            <span className="font-medium text-slate-900">
                              {row.studentLabel}
                            </span>
                            <p
                              className="mt-0.5 font-mono text-[11px] text-slate-500"
                              title={row.studentId}
                            >
                              {shortId ?? row.studentId}
                            </p>
                          </MobileField>
                          <MobileField label="Parent email">
                            <span className="font-mono text-xs">
                              {row.parentEmail ?? (
                                <span className="text-slate-400">—</span>
                              )}
                            </span>
                          </MobileField>
                          <MobileField label="Student institute">
                            {row.studentInstituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </MobileField>
                          <MobileField label="Parent institute">
                            {row.parentInstituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </MobileField>
                          <MobileField label="Link status">
                            {formatLinkStatus(row.linkStatus)}
                          </MobileField>
                          <MobileField label="Issue summary">
                            {row.issueSummary ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </MobileField>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 hidden sm:block sm:overflow-x-auto sm:rounded-xl sm:border sm:border-slate-100">
                  <table className="min-w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-xs">
                      <tr>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Institute</th>
                        <th className="px-3 py-2">Parent email</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {linksResult?.links.map((row) => (
                        <tr key={row.studentId}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-900">
                              {row.studentLabel}
                            </span>
                            <div className="font-mono text-[10px] text-slate-500">
                              {row.studentId}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {row.studentInstituteName ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] sm:text-xs">
                            {row.parentEmail ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{row.linkStatus}</td>
                          <td className="max-w-xs px-3 py-2 text-slate-600">
                            {row.issueSummary ?? (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Showing latest {PREVIEW_LIMIT} students by recent update. Filter
              via API with institute, parent email, or student id.
            </p>
          </section>
        </div>
      </main>
    </PlatformShell>
  );
}

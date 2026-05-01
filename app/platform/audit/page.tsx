import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { getPlatformAuditLogs } from "@/lib/platform-audit";
import { requireSuperAdminPage } from "@/lib/platform-auth";

const ACTION_LABELS: Record<string, string> = {
  "institute.status_changed": "Institute status changed",
  "health_repair.assign_batch_branch": "Batch branch assigned",
  "health_repair.clear_batch_orphan_branch": "Invalid batch branch cleared",
  "health_repair.clear_student_orphan_batch": "Invalid student batch cleared",
  "health_repair.clear_head_coach_orphan_branch": "Invalid head coach branch cleared",
  "health_repair.remove_orphan_batch_assistant_assignment":
    "Invalid assistant assignment removed",
};

function formatShortId(id: string | null | undefined): string | null {
  if (id == null || id === "") return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-3)}`;
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function AuditMetadata({ meta }: { meta: object | null }) {
  if (!meta || Object.keys(meta).length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">No metadata</p>
    );
  }

  const entries = Object.entries(meta);

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex max-w-full items-baseline gap-1 rounded-lg border border-slate-200/90 bg-slate-50/90 px-2 py-1 text-xs text-slate-800"
        >
          <span className="shrink-0 font-medium text-slate-600">{key}:</span>
          <span className="min-w-0 break-words font-normal text-slate-900">
            {formatMetadataValue(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

function ShortId({
  id,
  label,
}: {
  id: string | null | undefined;
  label: string;
}) {
  const full = id?.trim() ? id : null;
  const short = formatShortId(full);

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      {full == null ? (
        <p className="mt-0.5 text-sm text-slate-400">—</p>
      ) : (
        <p
          className="mt-0.5 truncate font-mono text-sm text-slate-800"
          title={full}
        >
          {short}
        </p>
      )}
    </div>
  );
}

export default async function PlatformAuditPage() {
  await requireSuperAdminPage("/platform/audit");

  let loadError: string | null = null;
  let logs: Awaited<ReturnType<typeof getPlatformAuditLogs>>["logs"] = [];

  try {
    const result = await getPlatformAuditLogs({ limit: 50 });
    logs = result.logs;
  } catch (e) {
    console.error("[platform/audit]", e);
    loadError = "Unable to load audit logs. Try again later.";
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
              Audit log
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review platform-level changes made by Super Admin users (read-only).
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
        ) : logs.length === 0 ? (
          <p className="rounded-2xl border border-slate-200/80 bg-white px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
            No platform audit logs yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {logs.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h2 className="text-base font-semibold leading-snug text-slate-900">
                    {actionLabel(row.action)}
                  </h2>
                  <time
                    className="shrink-0 text-sm tabular-nums text-slate-600 sm:text-right"
                    dateTime={row.createdAt}
                    title={row.createdAt}
                  >
                    {formatWhen(row.createdAt)}
                  </time>
                </div>

                <p className="mt-2 break-words text-sm text-slate-700">
                  <span className="font-medium text-slate-600">Actor: </span>
                  {row.actorEmail ?? (
                    <span className="text-slate-400">—</span>
                  )}
                </p>

                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Target
                    </p>
                    <p className="mt-0.5 break-words text-sm text-slate-800">
                      {row.targetType}
                    </p>
                  </div>

                  <ShortId id={row.targetId} label="Target ID" />
                  <ShortId id={row.instituteId} label="Institute ID" />

                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Metadata
                    </p>
                    <div className="mt-1.5">
                      <AuditMetadata meta={row.metadata} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PlatformShell>
  );
}

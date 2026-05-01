import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ROLE_ADMIN } from "@/lib/roles";
import { runTenantIntegrityDiagnostics } from "@/lib/tenant-integrity-diagnostics";

/**
 * Minimal admin-only integrity report (read-only). Same data as GET /api/admin/tenant-integrity.
 * Grep: tenant-integrity-diagnostics
 */
export default async function AdminDiagnosticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/diagnostics");
  }
  if (session.user.role !== ROLE_ADMIN) {
    redirect("/");
  }
  const instituteId = session.user.instituteId ?? null;
  if (!instituteId) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-sm text-red-800">Institute is required for diagnostics.</p>
      </main>
    );
  }

  const report = await runTenantIntegrityDiagnostics(instituteId);
  const summary = Object.entries(report.totals)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <main className="mx-auto max-w-4xl p-6 font-sans text-slate-900">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">Tenant integrity diagnostics</h1>
        <Link href="/admin" className="text-sm text-amber-900 underline-offset-2 hover:underline">
          ← Admin
        </Link>
      </div>
      <p className="mb-2 text-xs text-slate-600">
        Read-only · institute <span className="font-mono">{instituteId}</span> ·{" "}
        <span className="font-mono">{report.generatedAt}</span>
      </p>
      {summary.length === 0 ? (
        <p className="text-sm text-slate-700">No issues detected in scanned scope.</p>
      ) : (
        <ul className="mb-4 list-inside list-disc text-sm text-slate-800">
          {summary.map(([cat, n]) => (
            <li key={cat}>
              <span className="font-mono">{cat}</span>: {n}
            </li>
          ))}
        </ul>
      )}
      <p className="mb-1 text-xs text-slate-500">
        Attendance scan: last {report.limits.attendanceRowsScanned} rows (max{" "}
        {report.limits.attendanceRowsScannedMax}). API:{" "}
        <span className="font-mono">GET /api/admin/tenant-integrity</span>
      </p>
      <pre className="mt-4 max-h-[70vh] overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed">
        {JSON.stringify(report, null, 2)}
      </pre>
    </main>
  );
}

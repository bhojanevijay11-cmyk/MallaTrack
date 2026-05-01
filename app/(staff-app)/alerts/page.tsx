import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { authOptions } from "@/lib/auth";
import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";
import { listAttentionForBranch } from "@/lib/head-coach-branch-data";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  roleHomePath,
} from "@/lib/roles";

export default async function AlertsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/alerts");
  }

  const role = session.user.role;

  if (role !== ROLE_ADMIN && role !== ROLE_HEAD_COACH && role !== ROLE_ASSISTANT_COACH) {
    redirect(roleHomePath(role));
  }

  const instituteId = session.user.instituteId;
  const tenantLine = session.user.instituteName?.trim() || null;

  let attention: Awaited<ReturnType<typeof listAttentionForBranch>> = [];
  if (role === ROLE_HEAD_COACH && instituteId) {
    const ymd = getIndiaTodayCalendarYmd();
    attention = await listAttentionForBranch(
      session.user.branchId ?? null,
      instituteId,
      ymd,
      { headCoachUserId: session.user.id },
    );
  }

  return (
    <NavPlaceholder
      title="Alerts"
      description={
        role === ROLE_HEAD_COACH
          ? "Students in your branch that may need follow-up."
          : role === ROLE_ASSISTANT_COACH
            ? "Operational reminders for your assigned batches."
            : "Organization-wide operational signals."
      }
      tenantLine={tenantLine}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      {role === ROLE_HEAD_COACH ? (
        <>
          {attention.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-10 text-center shadow-soft">
              <p className="text-base font-semibold text-slate-900">You&apos;re all caught up</p>
              <p className="mt-2 text-sm text-slate-600">
                No students in your branch currently match attention rules.
              </p>
              <Link
                href="/students?filter=needs-attention"
                className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-amber-900 hover:underline"
              >
                Open needs-attention filter
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {attention.map((s) => (
                <li key={s.studentId}>
                  <Link
                    href={`/students/${s.studentId}`}
                    className="flex gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-soft transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-900"
                      aria-hidden
                    >
                      <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-semibold text-slate-900">{s.studentName}</p>
                      <p className="text-xs text-slate-500">
                        {s.batchName?.trim() || "Batch"} · {s.reasonLabel}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 self-center text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/students?filter=needs-attention" className="font-semibold text-amber-900 hover:underline">
              View on Students
            </Link>
          </p>
        </>
      ) : role === ROLE_ASSISTANT_COACH ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-10 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">Batch-focused workspace</p>
          <p className="mt-2 text-sm text-slate-600">
            Roster alerts appear on your batches and attendance flows. Use Students to review assigned
            athletes.
          </p>
          <Link
            href="/batches"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Go to batches
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-10 text-center shadow-soft">
          <p className="text-base font-semibold text-slate-900">Admin overview</p>
          <p className="mt-2 text-sm text-slate-600">
            Institute-wide operational signals live on the admin dashboard. Use Students and Batches for
            detailed follow-up.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Admin dashboard
            </Link>
            <Link
              href="/students"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Students
            </Link>
          </div>
        </div>
      )}
    </NavPlaceholder>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { ReportsDashboard } from "@/components/operations/ReportsDashboard";
import { authOptions } from "@/lib/auth";
import { getIndiaTodayCalendarYmd, parseCalendarDateYmd } from "@/lib/datetime-india";
import { getProgressV2ReportingSnapshot } from "@/lib/progress-v2-reporting-queries";
import { getReportsSnapshotForUser } from "@/lib/reports-queries";
import { ROLE_ADMIN, roleHomePath } from "@/lib/roles";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const dateYmd = parseCalendarDateYmd(sp.date) ?? getIndiaTodayCalendarYmd();
  const session = await getServerSession(authOptions);
  const home = roleHomePath(session?.user?.role);

  if (!session?.user) {
    redirect("/login?callbackUrl=/reports");
  }
  if (session.user.role !== ROLE_ADMIN) {
    redirect(home);
  }

  const instituteId = session.user.instituteId ?? null;

  let snapshot: Awaited<ReturnType<typeof getReportsSnapshotForUser>> | null = null;
  let progressV2: Awaited<ReturnType<typeof getProgressV2ReportingSnapshot>> | null = null;
  let loadError: string | null = null;

  if (instituteId === null) {
    loadError =
      "Your account is not linked to an institute. Reports cannot be loaded.";
  } else {
    const adminUserId = session.user.id?.trim() ?? "";
    const adminUser = {
      id: adminUserId.length > 0 ? adminUserId : "__reports_admin__",
      role: ROLE_ADMIN,
      branchId: session.user.branchId ?? null,
      instituteId,
    } as const;
    try {
      const [snap, prog] = await Promise.all([
        getReportsSnapshotForUser(adminUser, dateYmd),
        adminUserId.length > 0
          ? getProgressV2ReportingSnapshot({
              id: adminUserId,
              role: ROLE_ADMIN,
              branchId: session.user.branchId ?? null,
              instituteId,
            })
          : Promise.resolve(null),
      ]);
      snapshot = snap;
      progressV2 = prog;
    } catch {
      loadError = "Could not load reports. Try again.";
    }
  }

  return (
    <NavPlaceholder
      title="Reports"
      description="Operational counts, attendance summaries, and progress (V2) overview."
      tenantLine={session.user.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      {loadError ? (
        <p className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
          {loadError}
        </p>
      ) : snapshot ? (
        <ReportsDashboard
          dateYmd={dateYmd}
          snapshot={snapshot}
          progressV2={progressV2 ?? undefined}
        />
      ) : null}
    </NavPlaceholder>
  );
}

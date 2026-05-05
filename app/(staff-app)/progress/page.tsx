import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { ProgressWorkspace } from "@/components/progress/ProgressWorkspace";
import { authOptions } from "@/lib/auth";
import { getStudentsOrderedForScope, type StudentsListScope } from "@/lib/students-queries";
import { parseProgressAssessmentStatus } from "@/lib/progress-assessment-constants";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  roleHomePath,
} from "@/lib/roles";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; batch?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/progress");
  }

  const role = session.user.role;
  if (role !== ROLE_ADMIN && role !== ROLE_HEAD_COACH && role !== ROLE_ASSISTANT_COACH) {
    redirect(roleHomePath(role));
  }

  const instituteId = session.user.instituteId;
  if (!instituteId) {
    return (
      <NavPlaceholder
        title="Progress"
        description="Track student progress and session records in your institute."
        tenantLine={session.user.instituteName?.trim() || null}
        maxWidth="wide"
        dashboardShell
        showBackLink={false}
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your account is not linked to an institute. Progress cannot be loaded.
        </p>
      </NavPlaceholder>
    );
  }

  let scope: StudentsListScope = { kind: "institute", instituteId };
  if (role === ROLE_ASSISTANT_COACH) {
    const assistantId = session.user.id?.trim();
    if (!assistantId) {
      return (
        <NavPlaceholder
          title="Progress"
          description="Track student progress and session records in your institute."
          tenantLine={session.user.instituteName?.trim() || null}
          maxWidth="wide"
          dashboardShell
          showBackLink={false}
        >
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your session is missing a user id. Sign out and sign in again to load progress.
          </p>
        </NavPlaceholder>
      );
    }
    scope = { kind: "assistant", userId: assistantId, instituteId };
  } else if (role === ROLE_HEAD_COACH) {
    const branchId = session.user.branchId?.trim() || null;
    if (!branchId) {
      return (
        <NavPlaceholder
          title="Progress"
          description="Monitor progress and assessment status for students in your branch."
          tenantLine={session.user.instituteName?.trim() || null}
          maxWidth="wide"
          dashboardShell
          showBackLink={false}
        >
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your account has no branch assignment. Ask an admin to link you to a branch to track
            progress for your cohort.
          </p>
        </NavPlaceholder>
      );
    }
    scope = { kind: "head_coach", branchId, instituteId };
  }

  const rows = await getStudentsOrderedForScope(scope);
  const students = rows.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    batchName: s.batch?.name?.trim() || null,
    branchLocationName: s.batch?.branch?.name?.trim() || null,
    batchId: s.batchId ?? null,
  }));

  const sp = await searchParams;
  const initialStudentId = sp.student?.trim() || "";
  const initialBatchId = sp.batch?.trim() || "";
  const initialStatusFilter = parseProgressAssessmentStatus(sp.status);

  const description =
    role === ROLE_ASSISTANT_COACH || role === ROLE_HEAD_COACH
      ? "Track student progress, review status, and assessment outcomes. Start or continue structured assessments from Students."
      : "Session assessments, criteria scores, and coach remarks — saved per student and date.";

  return (
    <NavPlaceholder
      title="Progress"
      description={description}
      tenantLine={session.user.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      <ProgressWorkspace
        students={students}
        initialStudentId={initialStudentId}
        initialBatchId={initialBatchId}
        initialAssessmentStatusFilter={initialStatusFilter}
        role={role}
      />
    </NavPlaceholder>
  );
}

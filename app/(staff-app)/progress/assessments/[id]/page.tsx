import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { ProgressAssessmentEditClient } from "@/components/progress/ProgressAssessmentEditClient";
import { authOptions } from "@/lib/auth";
import { getStudentsOrderedForScope, type StudentsListScope } from "@/lib/students-queries";
import { ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";

export default async function EditProgressAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assessmentId = id?.trim() ?? "";
  if (!assessmentId) {
    redirect("/progress");
  }

  const callbackUrl = `/progress/assessments/${encodeURIComponent(assessmentId)}`;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const role = session.user.role;
  if (role !== ROLE_ASSISTANT_COACH && role !== ROLE_HEAD_COACH) {
    redirect("/progress");
  }

  const instituteId = session.user.instituteId;
  if (!instituteId) {
    return (
      <NavPlaceholder
        title="Assessment"
        description="Open this assessment to review, edit, or continue the workflow."
        tenantLine={session.user.instituteName?.trim() || null}
        maxWidth="wide"
        dashboardShell
        showBackLink={false}
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your account is not linked to an institute. Assessments cannot be loaded.
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
          title="Assessment"
          description="Open this assessment to review, edit, or continue the workflow."
          tenantLine={session.user.instituteName?.trim() || null}
          maxWidth="wide"
          dashboardShell
          showBackLink={false}
        >
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your session is missing a user id. Sign out and sign in again to continue.
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
          title="Assessment"
          description="Open this assessment to review, edit, or continue the workflow."
          tenantLine={session.user.instituteName?.trim() || null}
          maxWidth="wide"
          dashboardShell
          showBackLink={false}
        >
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your account has no branch assignment. Ask an admin to link you to a branch to open and manage
            assessments.
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
    batchId: s.batchId ?? null,
  }));

  if (students.length === 0) {
    return (
      <NavPlaceholder
        title="Assessment"
        description="Open this assessment to review, edit, or continue the workflow."
        tenantLine={session.user.instituteName?.trim() || null}
        maxWidth="wide"
        dashboardShell
        showBackLink={false}
      >
        <p className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-600 shadow-soft">
          No students in scope. Assign students to your batches to open assessments.
        </p>
      </NavPlaceholder>
    );
  }

  return (
    <NavPlaceholder
      title="Assessment"
      description="Review or update this assessment — drafts and revisions stay editable until you submit."
      tenantLine={session.user.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      <ProgressAssessmentEditClient students={students} assessmentId={assessmentId} />
    </NavPlaceholder>
  );
}

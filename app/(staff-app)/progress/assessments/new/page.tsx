import Link from "next/link";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { ProgressAssessmentCreateClient } from "@/components/progress/ProgressAssessmentCreateClient";
import { getSessionUser, type SessionUserWithInstitute } from "@/lib/auth-server";
import { findVisibleActiveProgressAssessmentForStudent } from "@/lib/progress-assessment-active";
import { userCanAccessStudentForProgress } from "@/lib/progress-access";
import { getStudentsOrderedForScope, type StudentsListScope } from "@/lib/students-queries";
import { ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";

function narrowStudentsForNewAssessment(
  students: Array<{
    id: string;
    fullName: string;
    batchName: string | null;
    batchId: string | null;
  }>,
  initialBatchId: string,
  initialStudentId: string,
) {
  const bid = initialBatchId.trim();
  if (!bid) return students;
  const inBatch = students.filter((s) => s.batchId === bid);
  const sid = initialStudentId.trim();
  if (sid) {
    const extra = students.find((s) => s.id === sid && !inBatch.some((x) => x.id === s.id));
    if (extra) return [...inBatch, extra];
  }
  if (inBatch.length === 0) return students;
  return inBatch;
}

export default async function NewProgressAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; batch?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/login?callbackUrl=/progress/assessments/new");
  }

  const role = sessionUser.role;
  if (role !== ROLE_ASSISTANT_COACH && role !== ROLE_HEAD_COACH) {
    redirect("/progress");
  }

  if (sessionUser.instituteId === null) {
    return (
      <NavPlaceholder
        title="Assessment"
        description="Create or update a structured assessment for a student."
        tenantLine={sessionUser.instituteName?.trim() || null}
        maxWidth="wide"
        dashboardShell
        showBackLink={false}
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your account is not linked to an institute. Assessments cannot be created.
        </p>
      </NavPlaceholder>
    );
  }

  const instituteId = sessionUser.instituteId;
  const scopedUser = sessionUser as SessionUserWithInstitute;

  let scope: StudentsListScope = { kind: "institute", instituteId };
  if (role === ROLE_ASSISTANT_COACH) {
    const assistantId = sessionUser.id?.trim();
    if (!assistantId) {
      return (
        <NavPlaceholder
          title="Assessment"
          description="Create or update a structured assessment for a student."
          tenantLine={sessionUser.instituteName?.trim() || null}
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
    const branchId = sessionUser.branchId?.trim() || null;
    if (!branchId) {
      return (
        <NavPlaceholder
          title="Assessment"
          description="Create or update a structured assessment for a student."
          tenantLine={sessionUser.instituteName?.trim() || null}
          maxWidth="wide"
          dashboardShell
          showBackLink={false}
        >
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your account has no branch assignment. Ask an admin to link you to a branch before creating
            assessments.
          </p>
        </NavPlaceholder>
      );
    }
    scope = { kind: "head_coach", branchId, instituteId };
  }

  const sp = await searchParams;
  const initialStudentId = sp.student?.trim() || "";
  const initialBatchId = sp.batch?.trim() || "";

  if (initialStudentId) {
    const canSee = await userCanAccessStudentForProgress(scopedUser, initialStudentId);
    if (canSee) {
      const active = await findVisibleActiveProgressAssessmentForStudent(
        scopedUser,
        initialStudentId,
      );
      if (active) {
        redirect(`/progress/assessments/${encodeURIComponent(active.id)}`);
      }
    }
  }

  const rows = await getStudentsOrderedForScope(scope);
  const students = rows.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    batchName: s.batch?.name?.trim() || null,
    batchId: s.batchId ?? null,
  }));

  const studentsForForm = narrowStudentsForNewAssessment(students, initialBatchId, initialStudentId);
  const studentFromUrlMissing =
    Boolean(initialStudentId) &&
    !studentsForForm.some((s) => s.id === initialStudentId.trim());

  if (students.length === 0) {
    return (
      <NavPlaceholder
        title="Assessment"
        description="Create or update a structured assessment for a student."
        tenantLine={sessionUser.instituteName?.trim() || null}
        maxWidth="wide"
        dashboardShell
        showBackLink={false}
      >
        <p className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-600 shadow-soft">
          No students in scope. Assign students to your batches, then start assessments from the Students page.
        </p>
      </NavPlaceholder>
    );
  }

  return (
    <NavPlaceholder
      title="New assessment"
      description="Create or update a structured assessment for the selected student — add scores, exercises, and notes, then save or submit for review."
      tenantLine={sessionUser.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      {studentFromUrlMissing ? (
        <div className="mb-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold text-amber-950">That student isn&apos;t available in this workspace</p>
          <p className="mt-1 text-amber-900/90">
            The link may be outdated, the student may be outside your scope, or they already have an active assessment
            open elsewhere — we opened the form with your roster instead. Pick a student from the list, or go back to{" "}
            <Link href="/students" className="font-semibold text-amber-950 underline-offset-2 hover:underline">
              Students
            </Link>{" "}
            and start from there.
          </p>
        </div>
      ) : null}
      <ProgressAssessmentCreateClient
        students={studentsForForm}
        defaultStudentId={
          studentFromUrlMissing ? undefined : initialStudentId || undefined
        }
      />
    </NavPlaceholder>
  );
}

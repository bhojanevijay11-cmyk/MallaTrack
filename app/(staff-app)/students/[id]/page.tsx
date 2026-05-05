import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { StudentCoachReviewsSection } from "@/components/students/StudentCoachReviewsSection";
import { StudentProfileTabs } from "@/components/students/StudentProfileTabs";
import { StudentBatchAssignmentEditor } from "@/components/students/StudentBatchAssignmentEditor";
import { StudentParentLinkEditor } from "@/components/students/StudentParentLinkEditor";
import {
  StudentParentInvitePanel,
  type ParentInviteBadge,
} from "@/components/students/StudentParentInvitePanel";
import { authOptions } from "@/lib/auth";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { INSTITUTE_REQUIRED_MESSAGE } from "@/lib/auth-server";
import { formatDobForDisplay } from "@/lib/dob-format";
import { formatInstantAsDdMmYyyy } from "@/lib/datetime-india";
import { isAppRole, ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_PARENT } from "@/lib/roles";
import { studentsListNavContextSuffix } from "@/lib/student-navigation-url";
import { getStudentByIdWithBatchForUser } from "@/lib/students-queries";
import { prisma } from "@/lib/prisma";

function formatJoiningDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatInstantAsDdMmYyyy(d);
}

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: rawId } = await params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const sp = await searchParams;
  const listSuffix = studentsListNavContextSuffix(sp);
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id;
  const roleRaw = session?.user?.role;

  if (!id) {
    return (
      <NavPlaceholder
        title="Student profile"
        description="Student details"
        tenantLine={session?.user?.instituteName?.trim() || null}
        maxWidth="wide"
        backHref={`/students${listSuffix}`}
        backLabel="← Back to Students"
      >
        <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          This link does not include a valid student id.{" "}
          <Link
            href={`/students${listSuffix}`}
            className="font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Back to Students
          </Link>
          .
        </p>
      </NavPlaceholder>
    );
  }

  if (!uid || !isAppRole(roleRaw)) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/students/${id}${listSuffix}`)}`,
    );
  }
  const scopeUser = {
    id: uid,
    role: roleRaw,
    branchId: session?.user?.branchId ?? null,
    instituteId: session?.user?.instituteId ?? null,
  };
  if (scopeUser.instituteId === null) {
    return (
      <NavPlaceholder
        title="Student profile"
        description="Student details"
        tenantLine={session?.user?.instituteName?.trim() || null}
        maxWidth="wide"
        backHref={`/students${listSuffix}`}
        backLabel="← Back to Students"
      >
        <p className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
          {INSTITUTE_REQUIRED_MESSAGE}
        </p>
      </NavPlaceholder>
    );
  }

  const sessionUser: SessionUserWithInstitute = {
    id: uid,
    role: roleRaw,
    branchId: session?.user?.branchId ?? null,
    instituteId: scopeUser.instituteId,
  };

  const student = await getStudentByIdWithBatchForUser(sessionUser, id);
  if (!student) {
    return (
      <NavPlaceholder
        title="Student not found"
        description="This athlete is not in your scope or the link may be outdated."
        tenantLine={session?.user?.instituteName?.trim() || null}
        maxWidth="wide"
        backHref={`/students${listSuffix}`}
        backLabel="← Back to Students"
      >
        <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Return to the{" "}
          <Link
            href={`/students${listSuffix}`}
            className="font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            student list
          </Link>{" "}
          and open an athlete from your roster. If you followed a bookmark or email link, ask your Head
          Coach or admin to confirm the student still exists and your role can see them.
        </p>
      </NavPlaceholder>
    );
  }

  const now = new Date();
  let parentInviteBadge: ParentInviteBadge = "not_linked";
  let parentInvitePendingExpires: string | null = null;
  if (roleRaw === ROLE_ADMIN && student.instituteId) {
    const activeInv = await prisma.invite.findFirst({
      where: {
        studentId: student.id,
        instituteId: student.instituteId,
        role: ROLE_PARENT,
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: { expiresAt: true },
    });
    const staleInv = await prisma.invite.findFirst({
      where: {
        studentId: student.id,
        instituteId: student.instituteId,
        role: ROLE_PARENT,
        usedAt: null,
        expiresAt: { lte: now },
      },
      select: { id: true },
    });

    if (activeInv) {
      parentInviteBadge = "invite_pending";
      parentInvitePendingExpires = formatInstantAsDdMmYyyy(activeInv.expiresAt);
    } else if (!student.parentUserId) {
      parentInviteBadge = "not_linked";
    } else if (staleInv) {
      parentInviteBadge = "invite_expired";
    } else {
      parentInviteBadge = "linked";
    }
  }

  const status =
    (student.status ?? "").toUpperCase() === "ACTIVE" ? "Active" : "Inactive";
  const batchLabel =
    student.batchId && student.batch
      ? student.batch.name?.trim() || "Untitled batch"
      : "Unassigned";
  const branchLocation =
    student.batch?.branch?.name?.trim() || null;

  return (
    <NavPlaceholder
      eyebrow="Profile"
      title={student.fullName}
      description="Day-to-day roster, progress, and reviews for this athlete."
      tenantLine={session?.user?.instituteName?.trim() || null}
      maxWidth="wide"
      backHref={`/students${listSuffix}`}
      backLabel="← Back to Students"
      headerRight={
        <Link
          href={`/students/${id}/360${listSuffix}`}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
        >
          View 360
        </Link>
      }
    >
      <StudentProfileTabs
        studentId={id}
        userRole={roleRaw}
      >
        <div className="grid gap-2 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm sm:grid-cols-2 sm:gap-2.5 sm:p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Status
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{status}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Batch
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{batchLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Branch
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{branchLocation ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Gender
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{student.gender || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Date of birth
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {formatDobForDisplay(student.dob)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Joining date
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {formatJoiningDate(student.joiningDate)}
            </p>
          </div>
          {student.parentName?.trim() ? (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Parent
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">{student.parentName.trim()}</p>
            </div>
          ) : null}
          {student.parentPhone?.trim() ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Parent phone
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">{student.parentPhone.trim()}</p>
            </div>
          ) : null}
          {student.emergencyContact?.trim() ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Emergency contact
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {student.emergencyContact.trim()}
              </p>
            </div>
          ) : null}
          {roleRaw === ROLE_ADMIN ? (
            <div className="sm:col-span-2">
              <StudentParentInvitePanel
                studentId={student.id}
                initialEmail={student.parent?.email?.trim() ?? ""}
                badge={parentInviteBadge}
                pendingExpiresLabel={parentInvitePendingExpires}
              />
            </div>
          ) : roleRaw === ROLE_HEAD_COACH ? (
            <div className="sm:col-span-2">
              <StudentParentLinkEditor
                studentId={student.id}
                initialParentUserId={student.parentUserId ?? null}
                linkedParentEmail={student.parent?.email ?? null}
                readOnly
              />
            </div>
          ) : null}
        </div>

        {roleRaw === ROLE_ADMIN || roleRaw === ROLE_HEAD_COACH ? (
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
            <StudentBatchAssignmentEditor
              studentId={student.id}
              initialBatchId={student.batchId ?? null}
            />
          </div>
        ) : null}

        <StudentCoachReviewsSection studentId={id} userRole={roleRaw} />
      </StudentProfileTabs>
    </NavPlaceholder>
  );
}

import type { Prisma } from "@prisma/client";
import {
  scopeForProgressUser,
  userCanAccessStudentForProgress,
} from "@/lib/progress-access";
import { ROLE_ADMIN } from "@/lib/roles";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { getStudentsOrderedForScope } from "@/lib/students-queries";
import {
  operationalBatchWhereInput,
  operationalStudentWhereInput,
  progressAssessmentRecordOperationallyVisible,
  type ProgressAssessmentGuardrailRow,
} from "@/lib/tenant-integrity-guardrails";
import { logTenantIntegrityGuardrail } from "@/lib/tenant-integrity-log";

/** DB filter: institute + role-visible students (admin = whole institute). */
export async function progressAssessmentScopeWhere(
  user: SessionUserWithInstitute,
): Promise<Prisma.ProgressAssessmentWhereInput> {
  const base: Prisma.ProgressAssessmentWhereInput = {
    instituteId: user.instituteId,
  };
  const opStudent = operationalStudentWhereInput(user.instituteId);
  const opBatch = operationalBatchWhereInput(user.instituteId);
  const baseWithOps: Prisma.ProgressAssessmentWhereInput[] = [
    base,
    { student: opStudent },
    { batch: opBatch },
  ];

  if (user.role === ROLE_ADMIN) {
    return { AND: baseWithOps };
  }

  const scope = scopeForProgressUser(user);
  if (!scope) {
    return { AND: [...baseWithOps, { studentId: { in: [] } }] };
  }
  const students = await getStudentsOrderedForScope(scope);
  const ids = students.map((s) => s.id);
  if (ids.length === 0) {
    return { AND: [...baseWithOps, { studentId: { in: [] } }] };
  }
  return { AND: [...baseWithOps, { studentId: { in: ids } }] };
}

export async function progressAssessmentVisibleToUser(
  user: SessionUserWithInstitute,
  row: { id: string } & Pick<ProgressAssessmentGuardrailRow, "instituteId" | "studentId" | "batchId"> & {
    student: ProgressAssessmentGuardrailRow["student"];
    batch: ProgressAssessmentGuardrailRow["batch"];
  },
): Promise<boolean> {
  if (row.instituteId !== user.instituteId) return false;
  if (
    !progressAssessmentRecordOperationallyVisible(row as ProgressAssessmentGuardrailRow)
  ) {
    logTenantIntegrityGuardrail({
      entityType: "ProgressAssessment",
      recordId: row.id,
      instituteId: user.instituteId,
      reason: "excluded_by_operational_guardrail",
    });
    return false;
  }
  return userCanAccessStudentForProgress(user, row.studentId);
}

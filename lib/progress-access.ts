import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";
import type { SessionScopeUser } from "@/lib/scope";
import {
  getStudentsOrderedForScope,
  type StudentsListScope,
} from "@/lib/students-queries";

/** Institute-scoped student list shape for progress and Progress V2 APIs. */
export function scopeForProgressUser(
  user: SessionScopeUser & { instituteId: string },
): StudentsListScope | null {
  if (user.role === ROLE_ADMIN) {
    return { kind: "institute", instituteId: user.instituteId };
  }
  if (user.role === ROLE_HEAD_COACH) {
    return { kind: "head_coach", branchId: user.branchId ?? null, instituteId: user.instituteId };
  }
  if (user.role === ROLE_ASSISTANT_COACH) {
    return { kind: "assistant", userId: user.id, instituteId: user.instituteId };
  }
  return null;
}

export async function userCanAccessStudentForProgress(
  user: SessionScopeUser & { instituteId: string },
  studentId: string,
): Promise<boolean> {
  const scope = scopeForProgressUser(user);
  if (!scope) return false;
  const students = await getStudentsOrderedForScope(scope);
  return students.some((s) => s.id === studentId);
}

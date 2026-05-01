import type { AppRole } from "@/lib/roles";
import { ROLE_ASSISTANT_COACH } from "@/lib/roles";

/** Assistant coaches must not receive parent contact fields from APIs. */
export function studentPayloadForRole<T extends Record<string, unknown>>(
  student: T,
  role: AppRole,
): Record<string, unknown> {
  if (role !== ROLE_ASSISTANT_COACH) return student;
  return {
    ...student,
    parentName: null,
    parentPhone: null,
    emergencyContact: null,
  };
}

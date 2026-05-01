import type { AppRole } from "@/lib/roles";
import { APP_STAFF_ROLES, ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_PARENT } from "@/lib/roles";
import type { AuthSessionUser } from "@/lib/auth-types";

export function hasRole(user: AuthSessionUser, allowed: readonly AppRole[]): boolean {
  return allowed.includes(user.role);
}

export function isStaffRole(role: AppRole): boolean {
  return (APP_STAFF_ROLES as readonly AppRole[]).includes(role);
}

/** Attendance marks: staff only; parents never mutate (explicit fail closed). */
export function canMutateAttendance(role: AppRole): boolean {
  if (role === ROLE_PARENT) return false;
  return isStaffRole(role);
}

/** Head coach or admin — progress review / branch-wide staff actions. */
export function isAdminOrHeadCoach(role: AppRole): boolean {
  return role === ROLE_ADMIN || role === ROLE_HEAD_COACH;
}

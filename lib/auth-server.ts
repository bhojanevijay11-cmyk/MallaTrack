import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { AuthSessionUser, SessionScopeUser } from "@/lib/auth-types";
import { apiError } from "@/lib/api-response";
import {
  INSTITUTE_STATUS_DISABLED,
  INSTITUTE_STATUS_ACTIVE,
  normalizeInstituteStatus,
} from "@/lib/institute-status";
import { prisma } from "@/lib/prisma";
import { isAppRole, type AppRole } from "@/lib/roles";

export type { AuthSessionUser, SessionScopeUser };

/** Shown when JWT has no instituteId (fail closed for tenant APIs). */
export const INSTITUTE_REQUIRED_MESSAGE =
  "Your account is not linked to an institute. Contact an administrator.";

/** Tenant APIs and UI when the institute has been emergency-disabled. */
export const INSTITUTE_DISABLED_MESSAGE =
  "This institute is currently disabled. Please contact MallaTrack support.";

/** Tenant APIs that require a non-null institute id (scope fields only; callers may omit instituteName). */
export type SessionUserWithInstitute = SessionScopeUser & { instituteId: string };

function sessionInstituteStatus(
  raw: AuthSessionUser["instituteStatus"] | undefined,
): AuthSessionUser["instituteStatus"] {
  if (raw === INSTITUTE_STATUS_DISABLED) return INSTITUTE_STATUS_DISABLED;
  if (raw === INSTITUTE_STATUS_ACTIVE) return INSTITUTE_STATUS_ACTIVE;
  return null;
}

export async function getSessionUser(): Promise<AuthSessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  const roleRaw = session?.user?.role;
  if (!id || !isAppRole(roleRaw)) return null;
  const rawBranch = session?.user?.branchId;
  const branchId =
    typeof rawBranch === "string" && rawBranch.trim() !== ""
      ? rawBranch.trim()
      : null;
  const instituteId = session?.user?.instituteId ?? null;
  const rawName = session?.user?.instituteName;
  const instituteName =
    typeof rawName === "string" && rawName.trim() !== "" ? rawName.trim() : null;
  const instituteStatus = sessionInstituteStatus(session?.user?.instituteStatus);
  return {
    id,
    role: roleRaw,
    branchId,
    instituteId,
    instituteName,
    instituteStatus,
  };
}

export function unauthorizedJson(message = "Unauthorized.", code = "UNAUTHORIZED") {
  return apiError({ code, message, status: 401 });
}

export function forbiddenJson(message = "Forbidden.", code = "FORBIDDEN") {
  return apiError({ code, message, status: 403 });
}

/** Fail closed: authenticated but missing tenant id. */
export function instituteForbiddenResponse() {
  return forbiddenJson(INSTITUTE_REQUIRED_MESSAGE, "INSTITUTE_REQUIRED");
}

export function instituteDisabledResponse() {
  return forbiddenJson(INSTITUTE_DISABLED_MESSAGE, "INSTITUTE_DISABLED");
}

/**
 * For APIs that use `requireRole` but not `requireRoleWithInstitute` (e.g. settings):
 * block when the user is tied to a disabled institute.
 */
export async function forbidIfDisabledTenant(
  user: AuthSessionUser,
): Promise<NextResponse | null> {
  if (user.instituteId === null) return null;
  const inst = await prisma.institute.findUnique({
    where: { id: user.instituteId },
    select: { status: true },
  });
  if (normalizeInstituteStatus(inst?.status) === INSTITUTE_STATUS_DISABLED) {
    return instituteDisabledResponse();
  }
  return null;
}

export function requireRole(
  user: AuthSessionUser | null,
  allowed: readonly AppRole[],
): AuthSessionUser | NextResponse {
  if (!user) return unauthorizedJson();
  if (!allowed.includes(user.role)) return forbiddenJson();
  return user;
}

/**
 * For tenant-scoped routes: must be logged in, allowed role, have instituteId,
 * and belong to an active (non-disabled) institute. Uses DB status (not stale JWT).
 */
export async function requireRoleWithInstitute(
  user: AuthSessionUser | null,
  allowed: readonly AppRole[],
): Promise<SessionUserWithInstitute | NextResponse> {
  const base = requireRole(user, allowed);
  if (base instanceof NextResponse) return base;
  if (base.instituteId === null) return instituteForbiddenResponse();
  const inst = await prisma.institute.findUnique({
    where: { id: base.instituteId },
    select: { status: true },
  });
  if (normalizeInstituteStatus(inst?.status) === INSTITUTE_STATUS_DISABLED) {
    return instituteDisabledResponse();
  }
  return base as SessionUserWithInstitute;
}

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { AuthSessionUser } from "@/lib/auth-types";
import {
  forbiddenJson,
  getSessionUser,
  unauthorizedJson,
} from "@/lib/auth-server";
import { ROLE_SUPER_ADMIN, roleHomePath } from "@/lib/roles";

/**
 * Platform API routes: SUPER_ADMIN only. Returns user or a JSON error response.
 */
export async function requireSuperAdminApi(): Promise<
  AuthSessionUser | NextResponse
> {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.role !== ROLE_SUPER_ADMIN) return forbiddenJson();
  return user;
}

/**
 * Platform App Router pages: SUPER_ADMIN only. Redirects like other platform pages.
 */
export async function requireSuperAdminPage(
  loginCallbackPath: string,
): Promise<AuthSessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(loginCallbackPath)}`);
  }
  if (user.role !== ROLE_SUPER_ADMIN) {
    redirect(roleHomePath(user.role));
  }
  return user;
}

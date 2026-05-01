/**
 * Stored role strings (User.role, JWT, session). Kept stable for DB + NextAuth.
 * Use these constants instead of scattering string literals.
 */
export const ROLE_ADMIN = "admin" as const;
export const ROLE_HEAD_COACH = "head_coach" as const;
export const ROLE_ASSISTANT_COACH = "assistant_coach" as const;
export const ROLE_PARENT = "parent" as const;
/** Platform operator: no tenant (`instituteId` may be null); not institute staff. */
export const ROLE_SUPER_ADMIN = "super_admin" as const;

export type AppRole =
  | typeof ROLE_ADMIN
  | typeof ROLE_HEAD_COACH
  | typeof ROLE_ASSISTANT_COACH
  | typeof ROLE_PARENT
  | typeof ROLE_SUPER_ADMIN;

export const APP_ROLES: readonly AppRole[] = [
  ROLE_ADMIN,
  ROLE_HEAD_COACH,
  ROLE_ASSISTANT_COACH,
  ROLE_PARENT,
  ROLE_SUPER_ADMIN,
];

/** Admin, head coach, assistant coach — staff APIs that must exclude parent accounts. */
export const APP_STAFF_ROLES = [
  ROLE_ADMIN,
  ROLE_HEAD_COACH,
  ROLE_ASSISTANT_COACH,
] as const;

/** Admin and head coach — batch/coach mutations where assistants are excluded. */
export const APP_ADMIN_HEAD_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH] as const;

export function isAppRole(value: string | undefined | null): value is AppRole {
  return (
    value === ROLE_ADMIN ||
    value === ROLE_HEAD_COACH ||
    value === ROLE_ASSISTANT_COACH ||
    value === ROLE_PARENT ||
    value === ROLE_SUPER_ADMIN
  );
}

/** Post-login home route per role (path only). */
export function roleHomePath(role: string | undefined | null): string {
  switch (role) {
    case ROLE_ADMIN:
      return "/admin";
    case ROLE_HEAD_COACH:
      return "/head-coach";
    case ROLE_ASSISTANT_COACH:
      return "/assistant-coach";
    case ROLE_PARENT:
      return "/parent";
    case ROLE_SUPER_ADMIN:
      return "/platform";
    default:
      return "/login";
  }
}

function pathUnder(prefixes: string[], pathname: string): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function pathAllowedForRole(pathname: string, role: string | undefined): boolean {
  if (!role) return false;
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return role === ROLE_SUPER_ADMIN;
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) return role === ROLE_ADMIN;
  if (pathname === "/branches" || pathname.startsWith("/branches/")) return role === ROLE_ADMIN;
  if (
    pathUnder(["/progress", "/alerts"], pathname) &&
    (role === ROLE_ADMIN || role === ROLE_HEAD_COACH || role === ROLE_ASSISTANT_COACH)
  ) {
    return true;
  }
  if (
    pathUnder(["/attendance"], pathname) &&
    (role === ROLE_ADMIN || role === ROLE_HEAD_COACH || role === ROLE_ASSISTANT_COACH)
  ) {
    return true;
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return (
      role === ROLE_ADMIN ||
      role === ROLE_HEAD_COACH ||
      role === ROLE_ASSISTANT_COACH ||
      role === ROLE_PARENT
    );
  }
  if (
    pathUnder(["/students", "/batches", "/coaches"], pathname) &&
    (role === ROLE_ADMIN || role === ROLE_HEAD_COACH || role === ROLE_ASSISTANT_COACH)
  ) {
    if (
      role === ROLE_ASSISTANT_COACH &&
      (pathname === "/coaches/assign" || pathname.startsWith("/coaches/assign/"))
    ) {
      return false;
    }
    return true;
  }
  if (pathname.startsWith("/admin")) return role === ROLE_ADMIN;
  if (pathname.startsWith("/head-coach")) return role === ROLE_HEAD_COACH;
  if (pathname.startsWith("/assistant-coach")) return role === ROLE_ASSISTANT_COACH;
  if (pathname.startsWith("/parent")) return role === ROLE_PARENT;
  return false;
}

/** After login: use safe callback (same-origin path) when it matches the signed-in role. */
export function resolvePostLoginPath(
  callbackUrl: string | null,
  role: string | undefined,
): string {
  const raw = callbackUrl?.trim();
  const pathOnly =
    raw && raw.startsWith("/") && !raw.startsWith("//")
      ? raw.split("?")[0] ?? ""
      : "";
  if (pathOnly && pathAllowedForRole(pathOnly, role)) {
    return pathOnly;
  }
  return roleHomePath(role);
}

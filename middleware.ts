import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { INSTITUTE_STATUS_DISABLED } from "@/lib/institute-status";
import {
  ROLE_ASSISTANT_COACH,
  ROLE_PARENT,
  ROLE_SUPER_ADMIN,
  roleHomePath,
} from "@/lib/roles";

function redirectToRoleHome(req: NextRequest, role: string | undefined): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = roleHomePath(role);
  url.search = "";
  return NextResponse.redirect(url);
}

function redirectToOnboarding(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/onboarding";
  url.search = "";
  return NextResponse.redirect(url);
}

function redirectToInstituteDisabled(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/institute-disabled";
  url.search = "";
  return NextResponse.redirect(url);
}

function instituteDisabledFromToken(token: {
  role?: unknown;
  instituteStatus?: unknown;
}): boolean {
  if (token.role === ROLE_SUPER_ADMIN) return false;
  return token.instituteStatus === INSTITUTE_STATUS_DISABLED;
}

/** Redirect tenant users away from the app when their institute is disabled. */
function blockIfInstituteDisabled(
  req: NextRequest,
  path: string,
  token: { role?: unknown; instituteStatus?: unknown },
): NextResponse | null {
  if (path === "/institute-disabled" || path.startsWith("/institute-disabled/")) {
    return null;
  }
  if (!instituteDisabledFromToken(token)) return null;
  return redirectToInstituteDisabled(req);
}

/** JWT `instituteId`: redirect first-login users before tenant routes (no DB call). */
function tokenLacksInstitute(token: { instituteId?: unknown }): boolean {
  const id = token.instituteId;
  return id == null || id === "";
}

function misconfiguredAuthSecretResponse(): NextResponse {
  return new NextResponse("Server misconfiguration.", { status: 500 });
}

function allowMissingSecretInThisEnv(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Staff/parent tenant onboarding — platform operators are exempt. */
function needsInstituteOnboardingRedirect(token: {
  instituteId?: unknown;
  role?: unknown;
}): boolean {
  if (token.role === ROLE_SUPER_ADMIN) return false;
  return tokenLacksInstitute(token);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path === "/coach" || path.startsWith("/coach/")) {
    const url = req.nextUrl.clone();
    url.pathname =
      path === "/coach" ? "/head-coach" : `/head-coach${path.slice("/coach".length)}`;
    return NextResponse.redirect(url);
  }

  if (path === "/assistant" || path.startsWith("/assistant/")) {
    const url = req.nextUrl.clone();
    url.pathname =
      path === "/assistant"
        ? "/assistant-coach"
        : `/assistant-coach${path.slice("/assistant".length)}`;
    return NextResponse.redirect(url);
  }

  if (path === "/attendance/mark" || path.startsWith("/attendance/mark")) {
    const url = req.nextUrl.clone();
    url.pathname = "/attendance";
    return NextResponse.redirect(url);
  }

  const onboardingRoute = path === "/onboarding" || path.startsWith("/onboarding/");
  if (onboardingRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    const disabledOnboarding = blockIfInstituteDisabled(req, path, token);
    if (disabledOnboarding) return disabledOnboarding;
    return NextResponse.next();
  }

  const platformRoute = path === "/platform" || path.startsWith("/platform/");
  if (platformRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    const role = token.role as string | undefined;
    if (role !== ROLE_SUPER_ADMIN) {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const operationsDataRoute =
    path === "/students" ||
    path.startsWith("/students/") ||
    path === "/batches" ||
    path.startsWith("/batches/") ||
    path === "/coaches" ||
    path.startsWith("/coaches/") ||
    path === "/progress" ||
    path.startsWith("/progress/") ||
    path === "/alerts" ||
    path.startsWith("/alerts/");
  if (operationsDataRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    const disabledOps = blockIfInstituteDisabled(req, path, token);
    if (disabledOps) return disabledOps;
    const instituteOpsRoute =
      path === "/students" ||
      path.startsWith("/students/") ||
      path === "/batches" ||
      path.startsWith("/batches/") ||
      path === "/coaches" ||
      path.startsWith("/coaches/");
    if (instituteOpsRoute && needsInstituteOnboardingRedirect(token)) {
      return redirectToOnboarding(req);
    }
    const role = token.role as string | undefined;
    const allowedOps =
      role === "admin" || role === "head_coach" || role === "assistant_coach";
    if (!allowedOps) {
      return redirectToRoleHome(req, role);
    }
    if (
      role === ROLE_ASSISTANT_COACH &&
      (path === "/coaches/assign" || path.startsWith("/coaches/assign/"))
    ) {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const settingsRoute = path === "/settings" || path.startsWith("/settings/");
  if (settingsRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    const disabledSettings = blockIfInstituteDisabled(req, path, token);
    if (disabledSettings) return disabledSettings;
    const role = token.role as string | undefined;
    if (
      role !== "admin" &&
      role !== "head_coach" &&
      role !== "assistant_coach" &&
      role !== "parent"
    ) {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const attendanceRoute = path === "/attendance" || path.startsWith("/attendance/");
  if (attendanceRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    if (needsInstituteOnboardingRedirect(token)) {
      return redirectToOnboarding(req);
    }
    const disabledAttendance = blockIfInstituteDisabled(req, path, token);
    if (disabledAttendance) return disabledAttendance;
    const role = token.role as string | undefined;
    const allowedAttendance =
      role === "admin" || role === "head_coach" || role === "assistant_coach";
    if (!allowedAttendance) {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const branchesRoute = path === "/branches" || path.startsWith("/branches/");
  if (branchesRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    if (needsInstituteOnboardingRedirect(token)) {
      return redirectToOnboarding(req);
    }
    const disabledBranches = blockIfInstituteDisabled(req, path, token);
    if (disabledBranches) return disabledBranches;
    const role = token.role as string | undefined;
    if (role !== "admin") {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const reportsRoute = path === "/reports" || path.startsWith("/reports/");
  if (reportsRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    if (needsInstituteOnboardingRedirect(token)) {
      return redirectToOnboarding(req);
    }
    const disabledReports = blockIfInstituteDisabled(req, path, token);
    if (disabledReports) return disabledReports;
    const role = token.role as string | undefined;
    if (role !== "admin") {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const parentOnboardingRoute =
    path === "/parent/accept-invite" || path.startsWith("/parent/accept-invite/");
  if (parentOnboardingRoute) {
    return NextResponse.next();
  }

  const parentRoute = path === "/parent" || path.startsWith("/parent/");
  if (parentRoute) {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[middleware] NEXTAUTH_SECRET is not set");
      return allowMissingSecretInThisEnv()
        ? NextResponse.next()
        : misconfiguredAuthSecretResponse();
    }
    const token = await getToken({ req, secret });
    if (!token) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(login);
    }
    const disabledParent = blockIfInstituteDisabled(req, path, token);
    if (disabledParent) return disabledParent;
    const role = token.role as string | undefined;
    if (role !== ROLE_PARENT) {
      return redirectToRoleHome(req, role);
    }
    return NextResponse.next();
  }

  const protectedPrefix =
    path.startsWith("/admin") ||
    path.startsWith("/head-coach") ||
    path.startsWith("/assistant-coach");

  if (!protectedPrefix) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[middleware] NEXTAUTH_SECRET is not set");
    return allowMissingSecretInThisEnv()
      ? NextResponse.next()
      : misconfiguredAuthSecretResponse();
  }

  const token = await getToken({ req, secret });
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  if (path.startsWith("/admin") && needsInstituteOnboardingRedirect(token)) {
    return redirectToOnboarding(req);
  }

  const disabledStaffDash = blockIfInstituteDisabled(req, path, token);
  if (disabledStaffDash) return disabledStaffDash;

  const role = token.role as string | undefined;
  const allowed =
    (path.startsWith("/admin") && role === "admin") ||
    (path.startsWith("/head-coach") && role === "head_coach") ||
    (path.startsWith("/assistant-coach") && role === "assistant_coach");

  if (!allowed) {
    return redirectToRoleHome(req, role);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/onboarding/:path*",
    "/platform",
    "/platform/:path*",
    "/branches",
    "/branches/:path*",
    "/admin/:path*",
    "/reports",
    "/reports/:path*",
    "/progress",
    "/progress/:path*",
    "/alerts",
    "/alerts/:path*",
    "/settings",
    "/settings/:path*",
    "/students",
    "/students/:path*",
    "/batches",
    "/batches/:path*",
    "/coaches",
    "/coaches/:path*",
    "/head-coach/:path*",
    "/assistant-coach/:path*",
    "/attendance",
    "/attendance/:path*",
    "/coach",
    "/coach/:path*",
    "/assistant",
    "/assistant/:path*",
    "/parent",
    "/parent/:path*",
  ],
};

import { NextResponse } from "next/server";
import type { Prisma, ThemePreference } from "@prisma/client";
import {
  forbidIfDisabledTenant,
  getSessionUser,
  requireRole,
} from "@/lib/auth-server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { APP_STAFF_ROLES } from "@/lib/roles";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import {
  parseThemePreferenceInput,
  sanitizeLocaleInput,
  sanitizeTimezoneInput,
  type PreferencesResponseBody,
} from "@/lib/user-preferences";
import { themeApiToPrisma, toPreferencesResponse } from "@/lib/user-preferences-server";

export const runtime = "nodejs";

const ROUTE = "/api/settings/preferences";

type GetOk = { ok: true; preferences: PreferencesResponseBody };

export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getSessionUser();
  const user = requireRole(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;
  const disabled = await forbidIfDisabledTenant(user);
  if (disabled) return disabled;

  try {
    const row = await prisma.userPreference.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      ok: true,
      preferences: toPreferencesResponse(row),
    } satisfies GetOk);
  } catch (e) {
    logError("settings.preferences.get_failed", logCtx, e, { userId: user.id });
    return apiError({
      code: "SETTINGS_PREFERENCES_LOAD_FAILED",
      message: "Could not load preferences.",
      status: 500,
    });
  }
}

type PreferencePatch = {
  themePreference?: ThemePreference;
  emailNotificationsEnabled?: boolean;
  inAppNotificationsEnabled?: boolean;
  locale?: string | null;
  timezone?: string | null;
};

function parseUpdateBody(body: unknown): { ok: true; data: PreferencePatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;
  const data: PreferencePatch = {};

  if ("themePreference" in b) {
    const parsed = parseThemePreferenceInput(b.themePreference);
    if (!parsed) {
      return { ok: false, error: "themePreference must be SYSTEM, LIGHT, or DARK." };
    }
    data.themePreference = themeApiToPrisma(parsed);
  }

  if ("emailNotificationsEnabled" in b) {
    if (typeof b.emailNotificationsEnabled !== "boolean") {
      return { ok: false, error: "emailNotificationsEnabled must be a boolean." };
    }
    data.emailNotificationsEnabled = b.emailNotificationsEnabled;
  }

  if ("inAppNotificationsEnabled" in b) {
    if (typeof b.inAppNotificationsEnabled !== "boolean") {
      return { ok: false, error: "inAppNotificationsEnabled must be a boolean." };
    }
    data.inAppNotificationsEnabled = b.inAppNotificationsEnabled;
  }

  if ("locale" in b) {
    const loc = sanitizeLocaleInput(b.locale);
    if (loc === undefined) {
      return { ok: false, error: "locale must be a string or null." };
    }
    data.locale = loc;
  }

  if ("timezone" in b) {
    const tz = sanitizeTimezoneInput(b.timezone);
    if (tz === undefined) {
      return { ok: false, error: "timezone must be a string or null." };
    }
    data.timezone = tz;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No valid fields to update." };
  }

  return { ok: true, data };
}

function patchToPrismaUpdate(patch: PreferencePatch): Prisma.UserPreferenceUpdateInput {
  const u: Prisma.UserPreferenceUpdateInput = {};
  if (patch.themePreference !== undefined) u.themePreference = patch.themePreference;
  if (patch.emailNotificationsEnabled !== undefined) {
    u.emailNotificationsEnabled = patch.emailNotificationsEnabled;
  }
  if (patch.inAppNotificationsEnabled !== undefined) {
    u.inAppNotificationsEnabled = patch.inAppNotificationsEnabled;
  }
  if (patch.locale !== undefined) u.locale = patch.locale;
  if (patch.timezone !== undefined) u.timezone = patch.timezone;
  return u;
}

export async function PATCH(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getSessionUser();
  const user = requireRole(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;
  const disabled = await forbidIfDisabledTenant(user);
  if (disabled) return disabled;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  const parsed = parseUpdateBody(body);
  if (!parsed.ok) {
    return apiError({
      code: "SETTINGS_PREFERENCES_BAD_REQUEST",
      message: parsed.error,
      status: 400,
    });
  }

  try {
    const patch = parsed.data;
    const row = await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        themePreference: patch.themePreference ?? "SYSTEM",
        emailNotificationsEnabled: patch.emailNotificationsEnabled ?? true,
        inAppNotificationsEnabled: patch.inAppNotificationsEnabled ?? true,
        locale: patch.locale !== undefined ? patch.locale : null,
        timezone: patch.timezone !== undefined ? patch.timezone : null,
      },
      update: patchToPrismaUpdate(patch),
    });
    return NextResponse.json({
      ok: true,
      preferences: toPreferencesResponse(row),
    } satisfies GetOk);
  } catch (e) {
    logError("settings.preferences.patch_failed", logCtx, e, { userId: user.id });
    return apiError({
      code: "SETTINGS_PREFERENCES_SAVE_FAILED",
      message: prismaErrorUserMessage(e, "Could not save preferences."),
      status: 400,
    });
  }
}

export async function PUT(req: Request) {
  return PATCH(req);
}

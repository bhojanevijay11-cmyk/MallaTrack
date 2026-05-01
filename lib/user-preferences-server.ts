import type { ThemePreference, UserPreference } from "@prisma/client";
import type { PreferencesResponseBody, ThemePreferenceApi } from "@/lib/user-preferences";

export function toPreferencesResponse(row: UserPreference | null): PreferencesResponseBody {
  return {
    themePreference: (row?.themePreference ?? "SYSTEM") as ThemePreferenceApi,
    emailNotificationsEnabled: row?.emailNotificationsEnabled ?? true,
    inAppNotificationsEnabled: row?.inAppNotificationsEnabled ?? true,
    locale: row?.locale ?? null,
    timezone: row?.timezone ?? null,
    createdAt: row?.createdAt?.toISOString() ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export function themeApiToPrisma(value: ThemePreferenceApi): ThemePreference {
  return value as ThemePreference;
}

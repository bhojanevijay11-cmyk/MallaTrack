export const THEME_PREFERENCE_VALUES = ["SYSTEM", "LIGHT", "DARK"] as const;

export type ThemePreferenceApi = (typeof THEME_PREFERENCE_VALUES)[number];

export function isThemePreferenceApi(value: string): value is ThemePreferenceApi {
  return (THEME_PREFERENCE_VALUES as readonly string[]).includes(value);
}

export function parseThemePreferenceInput(raw: unknown): ThemePreferenceApi | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  return isThemePreferenceApi(normalized) ? normalized : null;
}

const MAX_LOCALE_LEN = 100;
const MAX_TIMEZONE_LEN = 100;

/** `undefined` = omit (keep existing); `null` = clear. */
export function sanitizeLocaleInput(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return null;
  return t.length > MAX_LOCALE_LEN ? t.slice(0, MAX_LOCALE_LEN) : t;
}

/** `undefined` = omit (keep existing); `null` = clear. */
export function sanitizeTimezoneInput(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return null;
  return t.length > MAX_TIMEZONE_LEN ? t.slice(0, MAX_TIMEZONE_LEN) : t;
}

export type PreferencesResponseBody = {
  themePreference: ThemePreferenceApi;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  locale: string | null;
  timezone: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

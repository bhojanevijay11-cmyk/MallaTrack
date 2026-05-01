"use client";

import { useCallback, useEffect, useState } from "react";
import {
  THEME_PREFERENCE_VALUES,
  type PreferencesResponseBody,
  type ThemePreferenceApi,
} from "@/lib/user-preferences";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type GetOk = { ok: true; preferences: PreferencesResponseBody };
type ApiErr = { ok: false; error?: unknown };

function applyFormFromPreferences(p: PreferencesResponseBody) {
  return {
    themePreference: p.themePreference,
    emailNotificationsEnabled: p.emailNotificationsEnabled,
    inAppNotificationsEnabled: p.inAppNotificationsEnabled,
    locale: p.locale ?? "",
  };
}

type FormState = ReturnType<typeof applyFormFromPreferences>;

export function SettingsPreferencesSection({ enabled }: { enabled: boolean }) {
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    enabled ? "loading" : "idle",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await fetch("/api/settings/preferences", { cache: "no-store" });
      const data = (await res.json()) as GetOk | ApiErr;
      if (!res.ok || !data.ok) {
        setLoadError(
          data.ok === false
            ? getApiErrorMessageFromPayload(data, "Could not load preferences.")
            : "Request failed.",
        );
        setLoadState("error");
        return;
      }
      const next = applyFormFromPreferences(data.preferences);
      setForm(next);
      setInitial(next);
      setLoadState("ready");
    } catch {
      setLoadError("Network error. Please try again.");
      setLoadState("error");
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!saveSuccess) return;
    const t = window.setTimeout(() => setSaveSuccess(false), 3500);
    return () => window.clearTimeout(t);
  }, [saveSuccess]);

  const dirty =
    initial &&
    form &&
    (form.themePreference !== initial.themePreference ||
      form.emailNotificationsEnabled !== initial.emailNotificationsEnabled ||
      form.inAppNotificationsEnabled !== initial.inAppNotificationsEnabled ||
      form.locale.trim() !== initial.locale.trim());

  const onSave = useCallback(async () => {
    if (!enabled || !form || saving) return;
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      const body = {
        themePreference: form.themePreference,
        emailNotificationsEnabled: form.emailNotificationsEnabled,
        inAppNotificationsEnabled: form.inAppNotificationsEnabled,
        locale: form.locale.trim() || null,
      };
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as GetOk | ApiErr;
      if (!res.ok || !data.ok) {
        setSaveError(
          data.ok === false
            ? getApiErrorMessageFromPayload(data, "Could not save.")
            : "Request failed.",
        );
        return;
      }
      const next = applyFormFromPreferences(data.preferences);
      setForm(next);
      setInitial(next);
      setSaveSuccess(true);
    } catch {
      setSaveError(NETWORK_RETRY_HINT);
    } finally {
      setSaving(false);
    }
  }, [enabled, form, saving]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-soft sm:p-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Preferences
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        These choices are stored on your account only. They do not change your role, branch, or
        organization access.
      </p>

      {loadState === "loading" ? (
        <p className="mt-6 text-sm text-slate-500">Loading preferences…</p>
      ) : null}

      {loadState === "error" ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800">
          {loadError ?? "Preferences could not be loaded. Use Retry below."}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-2 font-medium text-red-900 underline decoration-red-400 underline-offset-2 hover:text-red-950"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loadState === "ready" && form ? (
        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="themePreference" className="text-sm font-medium text-slate-800">
              Theme
            </label>
            <select
              id="themePreference"
              disabled={saving}
              value={form.themePreference}
              onChange={(e) =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        themePreference: e.target.value as ThemePreferenceApi,
                      }
                    : f,
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
            >
              {THEME_PREFERENCE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {v === "SYSTEM" ? "System default" : v === "LIGHT" ? "Light" : "Dark"}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <input
              type="checkbox"
              disabled={saving}
              checked={form.emailNotificationsEnabled}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, emailNotificationsEnabled: e.target.checked } : f))
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:opacity-60"
            />
            <span className="text-sm text-slate-800">
              <span className="font-medium">Email notifications</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Stored for future use; MallaTrack does not send mail from these toggles yet.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <input
              type="checkbox"
              disabled={saving}
              checked={form.inAppNotificationsEnabled}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, inAppNotificationsEnabled: e.target.checked } : f))
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30 disabled:opacity-60"
            />
            <span className="text-sm text-slate-800">
              <span className="font-medium">In-app notifications</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Stored for future use; no notification delivery is wired yet.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="locale" className="text-sm font-medium text-slate-800">
              Locale
            </label>
            <input
              id="locale"
              type="text"
              disabled={saving}
              value={form.locale}
              onChange={(e) => setForm((f) => (f ? { ...f, locale: e.target.value } : f))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
              placeholder="e.g. en-IN"
              autoComplete="off"
            />
          </div>

          {saveError ? (
            <div className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-800">
              {saveError}
            </div>
          ) : null}

          {saveSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
              Preferences saved.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void onSave()}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save preferences"}
            </button>
            {!dirty && !saving ? (
              <span className="text-xs text-slate-500">No changes to save.</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

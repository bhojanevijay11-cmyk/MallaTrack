"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock } from "lucide-react";
import { inputBase } from "./formFieldStyles";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type Props =
  | { mode: "invalid" }
  | { mode: "form"; token: string };

export function ResetPasswordView(props: Props) {
  if (props.mode === "invalid") {
    return (
      <div className="relative w-full min-w-0 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)]">
        <div className="relative z-[1] p-5 sm:p-7 md:p-8">
          <div className="mx-auto max-w-md space-y-4 text-center">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Link not valid
            </h2>
            <p className="text-base leading-relaxed text-slate-600">
              This reset link is invalid or has expired. Request a new one from the login page.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
              <Link
                href="/forgot-password"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-amber-800 via-orange-700 to-amber-800 px-6 text-base font-semibold text-white shadow-sm shadow-amber-950/20 transition hover:brightness-[1.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                Forgot password
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 text-base font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ResetPasswordFormInner token={props.token} />;
}

function ResetPasswordFormInner({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = (await res.json()) as
        | { ok: true; message: string }
        | { ok: false; error?: unknown };

      if (!res.ok || !data.ok) {
        setErrorMessage(
          getApiErrorMessageFromPayload(data, "Something went wrong. Please try again."),
        );
        return;
      }

      setSuccessMessage(data.message);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative w-full min-w-0 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)]">
      <div
        className="pointer-events-none absolute right-3 top-3 grid grid-cols-4 gap-1 opacity-[0.12] sm:right-5 sm:top-5"
        aria-hidden
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="h-2 w-2 rounded-sm bg-slate-500" />
        ))}
      </div>

      <div className="relative z-[1] p-5 sm:p-7 md:p-8">
        <div className="mx-auto mb-5 max-w-md space-y-2 text-center sm:mb-6">
          <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Set a new password
          </h2>
          <p className="text-base leading-relaxed text-slate-500">
            Choose a strong password for your MallaTrack account.
          </p>
        </div>

        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="reset-password"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                New password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="reset-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputBase} pr-11`}
                  placeholder="••••••••"
                  disabled={Boolean(successMessage)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-300/40 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={Boolean(successMessage)}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="reset-password-confirm"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                Confirm password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="reset-password-confirm"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputBase} pr-11`}
                  placeholder="••••••••"
                  disabled={Boolean(successMessage)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-300/40 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  disabled={Boolean(successMessage)}
                >
                  {showConfirm ? (
                    <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              aria-live="polite"
              className="space-y-4 rounded-xl border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            >
              <p>{successMessage}</p>
              <Link
                href="/login"
                className="inline-flex font-semibold text-amber-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || Boolean(successMessage)}
            className="mt-5 flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-800 via-orange-700 to-amber-800 px-6 text-base font-semibold text-white shadow-sm shadow-amber-950/20 transition hover:brightness-[1.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:h-14"
          >
            {isSubmitting ? "Updating…" : "Update password"}
          </button>

          {!successMessage ? (
            <p className="text-center text-sm text-slate-400">
              <Link
                href="/login"
                className="font-medium text-amber-800/90 underline-offset-2 transition-colors hover:text-amber-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-offset-2"
              >
                Back to sign in
              </Link>
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

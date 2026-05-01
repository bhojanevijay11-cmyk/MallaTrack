"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AtSign, Eye, EyeOff, Lock } from "lucide-react";
import { RoleSelector } from "./RoleSelector";
import type { RoleTab } from "./types";
import { inputBase } from "./formFieldStyles";
import {
  isValidEmailShape,
  normalizeEmail,
  validatePassword,
  parseRole,
  isPublicRegistrationRole,
  REGISTRATION_ALLOWED_ROLES,
} from "@/lib/user-validation";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

function toUserFacingMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong. Please try again.";
}

export function RegisterForm() {
  const [role, setRole] = useState<RoleTab>("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void runRegister();
  }

  async function runRegister() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!isValidEmailShape(email)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    const pw = validatePassword(password);
    if (!pw.ok) {
      setErrorMessage(pw.message);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (!parseRole(role)) {
      setErrorMessage("Select a valid role.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
          role,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: unknown;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(
          getApiErrorMessageFromPayload(data, "Registration failed. Please try again."),
        );
        return;
      }

      setSuccessMessage(
        typeof data.message === "string"
          ? data.message
          : "Account created. You can sign in now.",
      );
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setErrorMessage(toUserFacingMessage(err));
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
            Create your ID
          </h2>
          <p className="text-base leading-relaxed text-slate-500">
            Register to access your athletic performance dashboard.
          </p>
        </div>

        <form className="space-y-5" onSubmit={onFormSubmit} noValidate>
          <RoleSelector
            value={role}
            setRole={setRole}
            allowedRoles={REGISTRATION_ALLOWED_ROLES}
          />

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="register-email"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                Email address
              </label>
              <div className="relative">
                <AtSign
                  className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBase}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="register-password"
                className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputBase} pr-11`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-300/40 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                htmlFor="register-confirm"
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
                  id="register-confirm"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputBase}
                  placeholder="Repeat password"
                />
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
              className="rounded-xl border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            >
              {successMessage}{" "}
              <Link
                href="/login"
                className="font-semibold text-amber-900 underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-800 via-orange-700 to-amber-800 px-6 text-base font-semibold text-white shadow-sm shadow-amber-950/20 transition hover:brightness-[1.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:h-14"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-sm text-slate-400">
            Already have an ID?{" "}
            <Link
              href="/login"
              className="font-medium text-amber-800/90 underline-offset-2 transition-colors hover:text-amber-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

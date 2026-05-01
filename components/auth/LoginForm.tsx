"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { AtSign, Eye, EyeOff, Lock } from "lucide-react";
import { getSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CREDENTIALS_ROLE_NOT_CONFIGURED } from "@/lib/credentials-role-error";
import {
  isAppRole,
  resolvePostLoginPath,
} from "@/lib/roles";
import { inputBase } from "./formFieldStyles";

const ROLE_CONFIGURATION_ERROR =
  "Your account role is not configured. Please contact your administrator.";

function toUserFacingMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err instanceof Event) return "Sign in failed. Please try again.";
  return "Something went wrong. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get("callbackUrl"));
  }, []);

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void runSignIn();
  }

  async function runSignIn() {
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        loginId,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === CREDENTIALS_ROLE_NOT_CONFIGURED) {
          setErrorMessage(ROLE_CONFIGURATION_ERROR);
        } else {
          setErrorMessage("Sign in failed. Check your credentials.");
        }
        return;
      }

      if (result?.ok) {
        const session = await getSession();
        const sessionRole = session?.user?.role;
        if (!isAppRole(sessionRole)) {
          await signOut({ redirect: false });
          setErrorMessage(ROLE_CONFIGURATION_ERROR);
          return;
        }
        const path = resolvePostLoginPath(callbackUrl, sessionRole);
        router.replace(path);
      }
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
            Welcome Back
          </h2>
          <p className="text-base leading-relaxed text-slate-500">
            Sign in to your MallaTrack workspace.
          </p>
        </div>

        <form className="space-y-5" onSubmit={onFormSubmit} noValidate>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="login-id"
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
                  id="login-id"
                  name="loginId"
                  type="text"
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className={inputBase}
                  placeholder="coach.deshpande@mallatrack.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                >
                  Security password
                </label>
                <p className="text-xs leading-snug text-slate-400">
                  Password help: contact your admin.
                </p>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputBase} pr-11`}
                  placeholder="••••••••"
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
              <div className="flex justify-end pt-0.5">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-amber-800/90 underline-offset-2 transition-colors hover:text-amber-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-offset-2"
                >
                  Forgot password?
                </Link>
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-800 via-orange-700 to-amber-800 px-6 text-base font-semibold text-white shadow-sm shadow-amber-950/20 transition hover:brightness-[1.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:h-14"
          >
            {isSubmitting ? "Signing in…" : "Authorize Access"}
          </button>

          <p className="text-center text-sm text-slate-400">
            New to MallaTrack?{" "}
            <Link
              href="/register"
              className="font-medium text-amber-800/90 underline-offset-2 transition-colors hover:text-amber-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/40 focus-visible:ring-offset-2"
            >
              Create ID
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

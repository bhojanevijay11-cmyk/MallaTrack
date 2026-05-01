"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { roleHomePath } from "@/lib/roles";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type Props = {
  token: string;
  fullName: string;
  email: string;
  role: string;
  expired: boolean;
  used: boolean;
};

type ApiOk = { ok: true; email: string; redirectTo: string };
type ApiErr = { ok: false; error?: unknown };

export function InviteAcceptForm({ token, fullName, email, role, expired, used }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = expired || used;

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading || disabled) return;
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/invites", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password, confirmPassword }),
        });
        const data = (await res.json()) as ApiOk | ApiErr;
        if (!data.ok) {
          setError(getApiErrorMessageFromPayload(data, "Could not accept invite."));
          return;
        }

        // After password set, sign in with the credentials flow.
        const result = await signIn("credentials", {
          redirect: false,
          loginId: email,
          password,
          role,
        });
        if (result?.error) {
          // Password is set; fallback to manual login if role mismatch etc.
          router.push("/login");
          return;
        }

        router.push(data.redirectTo ?? roleHomePath(role));
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [confirmPassword, disabled, email, loading, password, role, router, token],
  );

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Accept invite
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Hi {fullName}. Set a password to activate your staff account for <span className="font-medium">{email}</span>.
      </p>

      {expired ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This invite link has expired. Ask your admin to create a new invite.
        </p>
      ) : null}
      {used ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          This invite link was already used. Try logging in.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-slate-800">
            Password <span className="text-red-600">*</span>
          </label>
          <input
            id="password"
            type="password"
            required
            disabled={disabled || loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
          />
          <p className="text-xs text-slate-500">Minimum 8 characters.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-800">
            Confirm password <span className="text-red-600">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            disabled={disabled || loading}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={disabled || loading}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving…" : "Set password and continue"}
        </button>
      </form>
    </div>
  );
}


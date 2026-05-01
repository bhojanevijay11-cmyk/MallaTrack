"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type Props = {
  token: string;
  email: string;
  expired: boolean;
  used: boolean;
};

type ApiOk = { ok: true; email: string; redirectTo: string };
type ApiErr = { ok: false; error?: unknown };

export function ParentAcceptInviteForm({ token, email, expired, used }: Props) {
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
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/parent/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = (await res.json()) as ApiOk | ApiErr;
        if (!data.ok) {
          setError(getApiErrorMessageFromPayload(data, "Could not complete setup."));
          return;
        }

        const result = await signIn("credentials", {
          redirect: false,
          loginId: email,
          password,
        });
        if (result?.error) {
          router.push("/login");
          return;
        }

        router.push(data.redirectTo ?? "/parent");
        router.refresh();
      } catch {
        setError(NETWORK_RETRY_HINT);
      } finally {
        setLoading(false);
      }
    },
    [confirmPassword, disabled, email, loading, password, router, token],
  );

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Set your password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Create a password for your parent account{" "}
        <span className="font-medium">{email}</span>. An administrator linked you to a student; you
        do not need to pick a student here.
      </p>

      {expired ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This invite link has expired. Ask your admin to send a new parent invite.
        </p>
      ) : null}
      {used ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          This invite link was already used. Try logging in.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="parent-invite-password" className="text-sm font-medium text-slate-800">
            Password <span className="text-red-600">*</span>
          </label>
          <input
            id="parent-invite-password"
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
          <label
            htmlFor="parent-invite-confirm"
            className="text-sm font-medium text-slate-800"
          >
            Confirm password <span className="text-red-600">*</span>
          </label>
          <input
            id="parent-invite-confirm"
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
          {loading ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </div>
  );
}

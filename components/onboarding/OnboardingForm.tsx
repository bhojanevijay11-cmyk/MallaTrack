"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type OnboardingOk = {
  ok: true;
  instituteId: string;
  instituteName: string;
  branchId: string;
  redirectTo: string;
};

type OnboardingErr = {
  ok: false;
  error?: unknown;
};

export function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();
  const [instituteName, setInstituteName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instituteName, branchName }),
        });
        const data = (await res.json()) as OnboardingOk | OnboardingErr;
        if (!data.ok) {
          setError(
            getApiErrorMessageFromPayload(
              data,
              "Setup could not be saved. Check the form and try again.",
            ),
          );
          return;
        }
        await update({
          instituteId: data.instituteId,
          instituteName: data.instituteName,
          branchId: data.branchId,
        });
        router.push(data.redirectTo);
        router.refresh();
      } catch {
        setError(NETWORK_RETRY_HINT);
      } finally {
        setLoading(false);
      }
    },
    [branchName, instituteName, loading, router, update],
  );

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Set up your academy
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Create your institute and first branch to start using MallaTrack. This step is required
        before you can manage students, batches, and attendance.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="instituteName" className="text-sm font-medium text-slate-800">
            Institute name <span className="text-red-600">*</span>
          </label>
          <input
            id="instituteName"
            name="instituteName"
            type="text"
            autoComplete="organization"
            required
            disabled={loading}
            value={instituteName}
            onChange={(ev) => setInstituteName(ev.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
            placeholder="e.g. Riverside Sports Academy"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="branchName" className="text-sm font-medium text-slate-800">
            First branch name <span className="text-red-600">*</span>
          </label>
          <input
            id="branchName"
            name="branchName"
            type="text"
            autoComplete="off"
            required
            disabled={loading}
            value={branchName}
            onChange={(ev) => setBranchName(ev.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 disabled:opacity-60"
            placeholder="e.g. Main campus"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

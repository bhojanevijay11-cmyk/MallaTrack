"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400/80 focus:ring-2 focus:ring-amber-500/20";

export function CreateInstituteForm() {
  const router = useRouter();
  const [instituteName, setInstituteName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/platform/institutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituteName,
          adminFullName,
          adminEmail,
          temporaryPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        instituteId?: string;
        error?: unknown;
      };
      if (!res.ok) {
        setError(
          getApiErrorMessageFromPayload(data, "Could not create institute."),
        );
        return;
      }
      const id = data.instituteId?.trim();
      if (id) {
        router.push(`/platform/institutes/${id}`);
      } else {
        router.push("/platform/institutes");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="instituteName"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            Institute name
          </label>
          <input
            id="instituteName"
            name="instituteName"
            type="text"
            autoComplete="organization"
            required
            value={instituteName}
            onChange={(e) => setInstituteName(e.target.value)}
            className={inputClass}
            placeholder="e.g. MallaTrack Pilot Institute"
          />
        </div>
        <div>
          <label
            htmlFor="adminFullName"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            First admin — full name
          </label>
          <input
            id="adminFullName"
            name="adminFullName"
            type="text"
            autoComplete="name"
            required
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="adminEmail"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            First admin — email
          </label>
          <input
            id="adminEmail"
            name="adminEmail"
            type="email"
            autoComplete="email"
            required
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="temporaryPassword"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
          >
            Temporary password
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Share this with the admin once; they should change it after sign-in. Minimum 8 characters.
          </p>
          <input
            id="temporaryPassword"
            name="temporaryPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-amber-200/90 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
        >
          Create institute &amp; admin
        </button>
        {busy ? (
          <span className="text-xs font-medium text-slate-600">Working…</span>
        ) : null}
      </div>
    </form>
  );
}

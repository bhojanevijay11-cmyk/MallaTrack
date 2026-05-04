import Link from "next/link";
import { CreateInstituteForm } from "@/components/platform/CreateInstituteForm";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { requireSuperAdminPage } from "@/lib/platform-auth";

export default async function PlatformNewInstitutePage() {
  await requireSuperAdminPage("/platform/institutes/new");

  return (
    <PlatformShell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Platform / Institutes
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Create institute
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Provision a new tenant and its first institute admin. This is not public signup — only
              platform operators use this screen.
            </p>
          </div>
          <Link
            href="/platform/institutes"
            className="text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4 hover:text-amber-950"
          >
            ← All institutes
          </Link>
        </div>
        <CreateInstituteForm />
      </main>
    </PlatformShell>
  );
}

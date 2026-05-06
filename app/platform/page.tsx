import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { requireSuperAdminPage } from "@/lib/platform-auth";

const PLACEHOLDER_CARDS = [
  { title: "Emergency Control", description: "Coming soon." },
] as const;

export default async function PlatformPage() {
  await requireSuperAdminPage("/platform");

  return (
    <PlatformShell>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            PLATFORM OPERATOR · ALL INSTITUTES
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            MallaTrack Platform
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Monitor every institute from one place.
            <br />
            Review institute setup, system health, support issues, and audit activity.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-amber-200/80 hover:shadow-md">
            <Link href="/platform/institutes" className="block outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
                Institutes
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                View all tenants, counts, and structure (read-only).
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4">
                Open directory →
              </span>
            </Link>
          </li>
          <li className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-amber-200/80 hover:shadow-md">
            <Link
              href="/platform/health"
              className="block outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
                System Health
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Cross-tenant setup and data integrity checks (read-only).
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4">
                View report →
              </span>
            </Link>
          </li>
          <li className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-amber-200/80 hover:shadow-md">
            <Link
              href="/platform/support"
              className="block outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
                Support Tools
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                User scope, invites, and parent links (read-only).
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4">
                Open support →
              </span>
            </Link>
          </li>
          <li className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-amber-200/80 hover:shadow-md">
            <Link
              href="/platform/audit"
              className="block outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
                Audit log
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Review platform-level changes made by Super Admin users.
              </p>
              <span className="mt-3 inline-block text-sm font-medium text-amber-900 underline decoration-amber-800/40 underline-offset-4">
                View log →
              </span>
            </Link>
          </li>
          {PLACEHOLDER_CARDS.map((card) => (
            <li
              key={card.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">
                {card.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{card.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </PlatformShell>
  );
}

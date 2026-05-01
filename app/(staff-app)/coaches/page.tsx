import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { getCoachesVisibleToUser } from "@/lib/coaches-queries";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth-server";
import { isAppRole } from "@/lib/roles";
import Link from "next/link";

export default async function CoachesPage() {
  const session = await getServerSession(authOptions);
  const instituteId = session?.user?.instituteId ?? null;
  const sessionUser = await getSessionUser();

  let coaches: Awaited<ReturnType<typeof getCoachesVisibleToUser>> = [];
  if (instituteId && sessionUser && sessionUser.instituteId && isAppRole(sessionUser.role)) {
    try {
      coaches = await getCoachesVisibleToUser({
        id: sessionUser.id,
        role: sessionUser.role,
        branchId: sessionUser.branchId,
        instituteId: sessionUser.instituteId,
      });
    } catch {
      coaches = [];
    }
  }

  return (
    <NavPlaceholder
      eyebrow="Institute coach roster"
      title="Coaches"
      description="Every coach record tied to your institute is listed here—including people not currently assigned as a batch Head Coach. Clearing or changing a Head Coach only updates the batch; it does not remove someone from this roster. Assign Head Coaches using the button below or from batch management."
      tenantLine={session?.user?.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      <div className="mb-3">
        <Link
          href="/coaches/assign"
          className="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-soft"
        >
          Assign Head Coach to batch
        </Link>
      </div>

      {instituteId === null ? (
        <p className="rounded-xl border border-slate-200/90 bg-white p-3 text-sm text-slate-500 shadow-sm">
          Your account is not linked to an institute, so the coach list cannot be loaded.
        </p>
      ) : coaches.length === 0 ? (
        <p className="rounded-xl border border-slate-200/90 bg-white p-3 text-sm text-slate-500 shadow-sm">
          No coaches yet. Open{" "}
          <Link href="/coaches/assign" className="font-medium text-primary">
            Batch Head Coach assignment
          </Link>{" "}
          to add your first roster coach.
        </p>
      ) : (
        <>
          <p className="mb-2 text-[13px] leading-snug text-slate-600 sm:text-sm">
            This is your institute directory of coach accounts, not a live “who is Head Coach
            right now” view.
          </p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/90 bg-white shadow-sm">
            {coaches.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.fullName}</p>
                  {c.phone ? (
                    <p className="text-sm text-slate-500">{c.phone}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 text-[11px] font-semibold uppercase tracking-wide ${
                    (c.status ?? "").toUpperCase() === "ACTIVE"
                      ? "text-secondary"
                      : "text-slate-400"
                  }`}
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </NavPlaceholder>
  );
}

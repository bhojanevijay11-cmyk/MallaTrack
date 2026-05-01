import { getServerSession } from "next-auth/next";
import Link from "next/link";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { BatchesList } from "@/components/batches/BatchesList";
import { authOptions } from "@/lib/auth";
import {
  isAppRole,
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  type AppRole,
} from "@/lib/roles";

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const viewerRole: AppRole | undefined = isAppRole(role) ? role : undefined;
  const canCreateBatch = role === ROLE_ADMIN || role === ROLE_HEAD_COACH;

  const description =
    role === ROLE_ASSISTANT_COACH
      ? filter
        ? `Filtered view: ${filter.replace(/-/g, " ")}.`
        : "Batches assigned to you. Contact your Head Coach to change assignments."
      : filter
        ? `Filtered view: ${filter.replace(/-/g, " ")}. Use search and chips below to narrow further.`
        : "Create schedules, assign coaches, and monitor enrollment across your academy cohorts.";

  return (
    <NavPlaceholder
      eyebrow="Operations"
      title="Batch Management"
      description={description}
      tenantLine={session?.user?.instituteName?.trim() || null}
      titleClassName="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
      headerRight={
        canCreateBatch ? (
          <Link
            href="/batches/new"
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:shadow-md active:scale-[0.98] sm:w-auto sm:px-5"
          >
            Create New Batch
          </Link>
        ) : null
      }
    >
      <BatchesList showCreateBatch={canCreateBatch} viewerRole={viewerRole} />
    </NavPlaceholder>
  );
}

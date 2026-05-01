import { getServerSession } from "next-auth/next";
import { Suspense } from "react";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { StudentsList } from "@/components/students/StudentsList";
import { authOptions } from "@/lib/auth";
import {
  parseStudentsActionFilter,
  studentsActionFilterDescription,
} from "@/lib/students-url-action-filters";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; alert?: string; readiness?: string }>;
}) {
  const sp = await searchParams;
  const { filter } = sp;
  const session = await getServerSession(authOptions);
  const alertRaw = sp.alert?.trim() ?? "";
  const readinessRaw = sp.readiness?.trim() ?? "";
  const action = parseStudentsActionFilter(
    new URLSearchParams({
      ...(sp.alert ? { alert: sp.alert } : {}),
      ...(sp.readiness ? { readiness: sp.readiness } : {}),
    }),
  );
  const unrecognizedActionParams =
    Boolean(alertRaw || readinessRaw) && action === null;

  const description = action
    ? studentsActionFilterDescription(action)
    : filter
      ? `Filter: ${filter.replace(/-/g, " ")}.`
      : "Browse and manage your student registry.";

  return (
    <NavPlaceholder
      title="Students"
      description={description}
      tenantLine={session?.user?.instituteName?.trim() || null}
      maxWidth="wide"
      showBackLink={false}
    >
      {unrecognizedActionParams ? (
        <p className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
          That alert or readiness value in the URL is not recognized, so the full student list is shown.
          Open Students from a dashboard card with a valid filter, or remove{" "}
          <span className="font-mono text-[13px]">alert</span> /{" "}
          <span className="font-mono text-[13px]">readiness</span> from the address bar.
        </p>
      ) : null}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-[148px] animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100/60"
              />
            ))}
          </div>
        }
      >
        <StudentsList />
      </Suspense>
    </NavPlaceholder>
  );
}

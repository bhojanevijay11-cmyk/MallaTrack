import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { Student360Shell } from "@/components/students/student360/Student360Shell";
import { authOptions } from "@/lib/auth";
import type { SessionUserWithInstitute } from "@/lib/auth-server";
import { INSTITUTE_REQUIRED_MESSAGE } from "@/lib/auth-server";
import { isAppRole } from "@/lib/roles";
import { studentsListNavContextSuffix } from "@/lib/student-navigation-url";
import { loadStudent360ViewModel } from "@/lib/student-360-data";

/**
 * Student 360 — unified attendance, progress, and feedback (server-composed).
 * Classic profile remains at `/students/[id]`.
 */
export default async function Student360Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: paramId } = await params;
  const id = typeof paramId === "string" ? paramId.trim() : "";
  const sp = await searchParams;
  const listSuffix = studentsListNavContextSuffix(sp);
  const session = await getServerSession(authOptions);
  if (!id) {
    return (
      <NavPlaceholder
        eyebrow="Student 360"
        title="Student not available"
        description="This link does not include a valid student id."
        maxWidth="wide"
        dashboardShell
        backHref={`/students${listSuffix}`}
        backLabel="← Back to Students"
        tenantLine={session?.user?.instituteName?.trim() || null}
      >
        <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Return to the student list and open <span className="font-medium">Student 360</span> from a
          student card, or open their{" "}
          <Link
            href={`/students${listSuffix}`}
            className="font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Students list
          </Link>{" "}
          first.
        </p>
      </NavPlaceholder>
    );
  }
  const uid = session?.user?.id;
  const roleRaw = session?.user?.role;
  if (!uid || !isAppRole(roleRaw)) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/students/${id}/360${listSuffix}`)}`,
    );
  }
  const instituteId = session?.user?.instituteId ?? null;
  if (instituteId === null) {
    return (
      <NavPlaceholder
        eyebrow="Student 360"
        title="Student overview"
        description="Cross-functional view — attendance, progress, and feedback together."
        maxWidth="wide"
        dashboardShell
        backHref={`/students${listSuffix}`}
        backLabel="← Back to Students"
        tenantLine={session?.user?.instituteName?.trim() || null}
      >
        <p className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
          {INSTITUTE_REQUIRED_MESSAGE}
        </p>
      </NavPlaceholder>
    );
  }

  const sessionUser: SessionUserWithInstitute = {
    id: uid,
    role: roleRaw,
    branchId: session?.user?.branchId ?? null,
    instituteId,
  };

  const data = await loadStudent360ViewModel(sessionUser, id);
  if (!data) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[student-360] no view model (student not in scope or missing)", {
        studentId: id,
        userId: uid,
        role: roleRaw,
        instituteId,
      });
    }
    return (
      <NavPlaceholder
        eyebrow="Student 360"
        title="Student not found"
        description="This athlete is not in your scope, the link may be wrong, or they may have been removed."
        maxWidth="wide"
        dashboardShell
        backHref={`/students${listSuffix}`}
        backLabel="← Back to Students"
        tenantLine={session?.user?.instituteName?.trim() || null}
      >
        <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Go back to{" "}
          <Link
            href={`/students${listSuffix}`}
            className="font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Students
          </Link>{" "}
          and open <span className="font-medium">Student 360</span> from someone in your roster. If you
          followed a bookmark or notification, ask a Head Coach or admin to confirm the student still exists
          and that your role can see them.
        </p>
      </NavPlaceholder>
    );
  }

  return (
    <NavPlaceholder
      eyebrow="Student 360"
      title={data.identity.fullName}
      description="Cross-functional view — attendance, progress, and feedback together."
      maxWidth="wide"
      dashboardShell
      backHref={`/students${listSuffix}`}
      backLabel="← Back to Students"
      tenantLine={session?.user?.instituteName?.trim() || null}
      headerRight={
        <Link
          href={`/students/${id}${listSuffix}`}
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          View Profile
        </Link>
      }
    >
      <Student360Shell data={data} />
    </NavPlaceholder>
  );
}

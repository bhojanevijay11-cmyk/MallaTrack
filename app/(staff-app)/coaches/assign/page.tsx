import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { AssignCoachPanel } from "@/components/operations/AssignCoachPanel";
import { authOptions } from "@/lib/auth";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  roleHomePath,
} from "@/lib/roles";

function AssignCoachFallback() {
  return (
    <p className="rounded-xl border border-slate-200/90 bg-white p-3 text-sm text-slate-500 shadow-sm">
      Loading assignment tools…
    </p>
  );
}

export default async function AssignCoachPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    redirect("/login");
  }
  const role = session.user.role;
  if (role === ROLE_ASSISTANT_COACH) {
    redirect(roleHomePath(role));
  }
  if (role !== ROLE_ADMIN && role !== ROLE_HEAD_COACH) {
    redirect(roleHomePath(role));
  }

  return (
    <NavPlaceholder
      title="Batch Head Coach assignment"
      description="Assign one Head Coach per batch (the operational owner). Pick a branch to focus the list, manage assistants on each batch page, and add roster coaches when you need new Head Coach candidates."
      tenantLine={session?.user?.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      <Suspense fallback={<AssignCoachFallback />}>
        <AssignCoachPanel viewerRole={role} />
      </Suspense>
    </NavPlaceholder>
  );
}

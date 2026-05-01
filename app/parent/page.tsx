import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth-server";
import { getParentDashboardBundles } from "@/lib/parent-dashboard-queries";
import { ParentDashboard } from "@/components/parent/ParentDashboard";
import { isAppRole, ROLE_PARENT, roleHomePath } from "@/lib/roles";

export default async function ParentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/parent");
  }

  const role = session.user.role;
  if (!isAppRole(role)) {
    redirect("/login");
  }
  if (role !== ROLE_PARENT) {
    redirect(roleHomePath(role));
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/login?callbackUrl=/parent");
  }

  let bundles: Awaited<ReturnType<typeof getParentDashboardBundles>> = [];
  let bundlesLoadFailed = false;
  if (user.instituteId !== null) {
    try {
      bundles = await getParentDashboardBundles(user.id, user.instituteId);
    } catch {
      bundlesLoadFailed = true;
    }
  }

  if (bundlesLoadFailed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Parent</h1>
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Could not load your dashboard</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Refresh the page. If this keeps happening, contact your academy office.
          </p>
          <p className="mt-4">
            <Link
              href="/login"
              className="text-sm font-medium text-amber-900 underline-offset-2 hover:underline"
            >
              Sign in as a different role
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (bundles.length === 0) {
    const instituteLabel = user.instituteName?.trim();
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Parent</h1>
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-900">No linked children yet</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            When your academy links a student profile to this parent account, attendance and progress
            summaries will show up here.
          </p>
          {instituteLabel ? (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Institute:</span> {instituteLabel}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-slate-600">
            Need help? Contact your academy office or Head Coach and ask them to confirm your email matches
            the parent record on file.
          </p>
          <p className="mt-4">
            <Link
              href="/login"
              className="text-sm font-medium text-amber-900 underline-offset-2 hover:underline"
            >
              Sign in as a different role
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const instituteName = user.instituteName;

  return (
    <main className="min-h-dvh bg-[#fafbfc]">
      <ParentDashboard bundles={bundles} instituteName={instituteName} />
    </main>
  );
}

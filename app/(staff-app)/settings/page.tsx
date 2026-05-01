import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { authOptions } from "@/lib/auth";
import { APP_STAFF_ROLES, isAppRole } from "@/lib/roles";
import { SettingsPreferencesSection } from "@/components/settings/SettingsPreferencesSection";

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrator";
    case "head_coach":
      return "Head coach";
    case "assistant_coach":
      return "Assistant coach";
    case "parent":
      return "Parent / guardian";
    default:
      return role;
  }
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/settings");
  }

  const role = session.user?.role;
  if (!isAppRole(role)) {
    redirect("/login");
  }

  const email = session.user?.email?.trim() || "—";
  const name = session.user?.name?.trim() || email;
  const institute = session.user?.instituteName?.trim() || null;
  const preferencesEnabled = APP_STAFF_ROLES.includes(
    role as (typeof APP_STAFF_ROLES)[number],
  );

  const pageDescription = preferencesEnabled
    ? "Account summary and session controls for MallaTrack."
    : "Your account details for MallaTrack.";

  return (
    <NavPlaceholder
      title="Settings"
      description={pageDescription}
      tenantLine={institute ? institute : null}
      maxWidth="default"
      dashboardShell
      showBackLink={false}
    >
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Signed in as
        </h2>
        <p className="mt-2 text-lg font-semibold text-slate-900">{name}</p>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-1 text-slate-800">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role</dt>
            <dd className="mt-1 text-slate-800">{roleLabel(role)}</dd>
          </div>
          {institute ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Organization
              </dt>
              <dd className="mt-1 text-slate-800">{institute}</dd>
            </div>
          ) : null}
        </dl>
        {preferencesEnabled ? (
          <p className="mt-8 text-xs leading-relaxed text-slate-500">
            Use the menu above to sign out securely.
          </p>
        ) : null}
      </div>

      <SettingsPreferencesSection enabled={preferencesEnabled} />
    </NavPlaceholder>
  );
}

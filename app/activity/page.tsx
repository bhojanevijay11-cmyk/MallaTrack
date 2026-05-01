import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { authOptions } from "@/lib/auth";
import { INSTITUTE_STATUS_DISABLED } from "@/lib/institute-status";
import { ROLE_SUPER_ADMIN } from "@/lib/roles";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const session = await getServerSession(authOptions);
  if (
    session?.user?.instituteStatus === INSTITUTE_STATUS_DISABLED &&
    session.user.role !== ROLE_SUPER_ADMIN
  ) {
    redirect("/institute-disabled");
  }
  const description = type
    ? `Showing placeholder for activity type “${type.replace(/-/g, " ")}”.`
    : "Recent changes across your academy — feed coming soon.";

  return (
    <NavPlaceholder
      title="Activity"
      description={description}
      tenantLine={session?.user?.instituteName?.trim() || null}
    />
  );
}

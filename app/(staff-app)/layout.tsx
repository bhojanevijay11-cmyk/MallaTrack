import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { StaffAppShell } from "@/components/staff-app/StaffAppShell";
import { authOptions } from "@/lib/auth";
import { INSTITUTE_STATUS_DISABLED } from "@/lib/institute-status";
import { ROLE_SUPER_ADMIN } from "@/lib/roles";

export default async function StaffAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (
    session?.user?.instituteStatus === INSTITUTE_STATUS_DISABLED &&
    role !== ROLE_SUPER_ADMIN
  ) {
    redirect("/institute-disabled");
  }
  return <StaffAppShell session={session}>{children}</StaffAppShell>;
}

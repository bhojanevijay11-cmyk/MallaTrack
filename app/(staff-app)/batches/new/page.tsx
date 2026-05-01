import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { NewBatchForm } from "@/components/batches/NewBatchForm";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH } from "@/lib/roles";

export default async function NewBatchPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role === ROLE_ASSISTANT_COACH) {
    redirect("/assistant-coach");
  }

  const instituteId = session?.user?.instituteId ?? null;
  const branches =
    instituteId === null
      ? []
      : await prisma.branch.findMany({
          where: { instituteId },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        });

  const requireBranchSelection = role === ROLE_ADMIN;

  return (
    <NavPlaceholder
      title="Create batch"
      description="Add a new group or cohort — name is required; status defaults to active."
      tenantLine={session?.user?.instituteName?.trim() || null}
      showBackLink={false}
    >
      <NewBatchForm branches={branches} requireBranchSelection={requireBranchSelection} />
    </NavPlaceholder>
  );
}

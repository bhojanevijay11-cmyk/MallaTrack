import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { BatchManageView } from "@/components/batches/BatchManageView";
import { authOptions } from "@/lib/auth";
import { INSTITUTE_REQUIRED_MESSAGE } from "@/lib/auth-server";
import { isAppRole, type AppRole } from "@/lib/roles";
import { canAccessBatch } from "@/lib/scope";

export default async function BatchManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  const session = await getServerSession(authOptions);
  const uid = session?.user?.id;
  const roleRaw = session?.user?.role;

  if (!id) {
    return (
      <NavPlaceholder
        title="Manage batch"
        description="Assign students to this batch or remove them."
        tenantLine={session?.user?.instituteName?.trim() || null}
        maxWidth="wide"
        backHref="/batches"
        backLabel="← Back to batches"
      >
        <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          This link does not include a valid batch id.{" "}
          <Link href="/batches" className="font-medium text-amber-900 underline-offset-2 hover:underline">
            Back to batches
          </Link>
          .
        </p>
      </NavPlaceholder>
    );
  }

  if (!uid || !isAppRole(roleRaw)) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/batches/${id}`)}`);
  }

  const scopeUser = {
    id: uid,
    role: roleRaw,
    branchId: session?.user?.branchId ?? null,
    instituteId: session?.user?.instituteId ?? null,
  };

  if (scopeUser.instituteId === null) {
    return (
      <NavPlaceholder
        title="Manage batch"
        description="Assign students to this batch or remove them."
        tenantLine={session?.user?.instituteName?.trim() || null}
        maxWidth="wide"
        backHref="/batches"
        backLabel="← Back to batches"
      >
        <p className="rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
          {INSTITUTE_REQUIRED_MESSAGE}
        </p>
      </NavPlaceholder>
    );
  }

  const allowed = await canAccessBatch(scopeUser, id);
  if (!allowed) {
    return (
      <NavPlaceholder
        title="Batch not available"
        description="This batch is not in your scope or the link may be wrong."
        tenantLine={session?.user?.instituteName?.trim() || null}
        maxWidth="wide"
        backHref="/batches"
        backLabel="← Back to batches"
      >
        <p className="rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Return to{" "}
          <Link href="/batches" className="font-medium text-amber-900 underline-offset-2 hover:underline">
            batch management
          </Link>{" "}
          and open a batch you are allowed to manage. If you need access, contact your admin or Head Coach.
        </p>
      </NavPlaceholder>
    );
  }

  return (
    <NavPlaceholder
      title="Manage batch"
      description="Assign students to this batch or remove them."
      tenantLine={session?.user?.instituteName?.trim() || null}
      maxWidth="wide"
      backHref="/batches"
      backLabel="← Back to batches"
    >
      <BatchManageView batchId={id} viewerRole={roleRaw as AppRole} />
    </NavPlaceholder>
  );
}

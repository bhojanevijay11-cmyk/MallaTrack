import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { ROLE_ADMIN } from "@/lib/roles";
import {
  repairAssignBatchBranch,
  repairClearBatchOrphanBranchFk,
  repairClearStudentOrphanBatchFk,
} from "@/lib/tenant-integrity-repair";
import { baseCtxFromRequest, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/admin/tenant-integrity/repair";

type Body = {
  action?: unknown;
  batchId?: unknown;
  branchId?: unknown;
  studentId?: unknown;
};

function tenantRepairFailureCode(status: number): string {
  if (status === 403) return "TENANT_INTEGRITY_REPAIR_FORBIDDEN";
  if (status === 404) return "TENANT_INTEGRITY_REPAIR_NOT_FOUND";
  if (status === 409) return "TENANT_INTEGRITY_REPAIR_CONFLICT";
  return "TENANT_INTEGRITY_REPAIR_BAD_REQUEST";
}

/**
 * Explicit, narrow admin repairs only (grep: tenant-integrity-repair).
 * POST JSON: { action, ...payload } — see docs/tenant-integrity-repair.md
 */
export async function POST(req: Request) {
  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (user instanceof NextResponse) return user;

  const logCtx = baseCtxFromRequest(req, ROUTE);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiError({
      code: "BAD_JSON",
      message: "Invalid JSON body.",
      status: 400,
    });
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) {
    return apiError({
      code: "TENANT_INTEGRITY_REPAIR_BAD_REQUEST",
      message: "Missing action.",
      status: 400,
    });
  }

  const instituteId = user.instituteId;
  const actorUserId = user.id;

  try {
    if (action === "assign_batch_branch") {
      const batchId = typeof body.batchId === "string" ? body.batchId : "";
      const branchId = typeof body.branchId === "string" ? body.branchId : "";
      const r = await repairAssignBatchBranch({
        instituteId,
        actorUserId,
        batchId,
        branchId,
      });
      if (!r.ok) {
        return apiError({
          code: tenantRepairFailureCode(r.status),
          message: r.error,
          status: r.status,
        });
      }
      return NextResponse.json({ ok: true, message: r.message }, { status: 200 });
    }

    if (action === "clear_batch_orphan_branch_fk") {
      const batchId = typeof body.batchId === "string" ? body.batchId : "";
      const r = await repairClearBatchOrphanBranchFk({
        instituteId,
        actorUserId,
        batchId,
      });
      if (!r.ok) {
        return apiError({
          code: tenantRepairFailureCode(r.status),
          message: r.error,
          status: r.status,
        });
      }
      return NextResponse.json({ ok: true, message: r.message }, { status: 200 });
    }

    if (action === "clear_student_orphan_batch_fk") {
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      const r = await repairClearStudentOrphanBatchFk({
        instituteId,
        actorUserId,
        studentId,
      });
      if (!r.ok) {
        return apiError({
          code: tenantRepairFailureCode(r.status),
          message: r.error,
          status: r.status,
        });
      }
      return NextResponse.json({ ok: true, message: r.message }, { status: 200 });
    }

    return apiError({
      code: "TENANT_INTEGRITY_REPAIR_UNSUPPORTED_ACTION",
      message: "Unknown or unsupported repair action.",
      status: 400,
    });
  } catch (e) {
    logError("admin.tenant_integrity.repair_failed", logCtx, e);
    return apiError({
      code: "TENANT_INTEGRITY_REPAIR_FAILED",
      message: "Repair request failed.",
      status: 500,
    });
  }
}

import { NextResponse } from "next/server";
import {
  getBatchByIdWithStudentsForUser,
  toBatchApiRecordWithHeadCoach,
} from "@/lib/batches-queries";
import { apiError } from "@/lib/api-response";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { prisma } from "@/lib/prisma";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import { APP_ADMIN_HEAD_ROLES, ROLE_ADMIN, ROLE_HEAD_COACH } from "@/lib/roles";
import { getStudentsOrderedForScope, type StudentsListScope } from "@/lib/students-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/batches/[id]/roster";

/**
 * Batch roster for assign/remove UI: assigned students on the batch plus unassigned
 * students the caller may place into batches (institute for admin; head-coach branch scope).
 * Admin and head coach only — assistants use GET /api/batches/:id without this list.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const { id: batchId } = await params;
  if (!batchId) {
    return apiError({ code: "BATCH_ID_REQUIRED", message: "Batch id is required.", status: 400 });
  }

  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  const scope: StudentsListScope =
    user.role === ROLE_HEAD_COACH
      ? { kind: "head_coach", branchId: user.branchId ?? null, instituteId: user.instituteId }
      : { kind: "institute", instituteId: user.instituteId };

  try {
    const batch = await getBatchByIdWithStudentsForUser(user, batchId);
    if (!batch) {
      return apiError({ code: "BATCH_NOT_FOUND", message: "Batch not found.", status: 404 });
    }

    const inScope = await getStudentsOrderedForScope(scope);
    const unassignedCandidates = inScope
      .filter((s) => s.batchId == null)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        status: s.status,
        batchId: s.batchId ?? null,
      }));

    const batchRecord = await toBatchApiRecordWithHeadCoach(batch);
    const instituteBranches =
      user.role === ROLE_ADMIN
        ? await prisma.branch.findMany({
            where: { instituteId: user.instituteId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : undefined;

    return NextResponse.json(
      {
        ok: true,
        batch: {
          ...batchRecord,
          students: batch.students,
        },
        unassignedCandidates,
        ...(instituteBranches ? { instituteBranches } : {}),
      },
      { status: 200 },
    );
  } catch (e) {
    logError("batches.roster.get_failed", logCtx, e, { batchId });
    return apiError({
      code: "BATCH_ROSTER_FAILED",
      message: "Failed to load roster.",
      status: 500,
    });
  }
}

import { NextResponse } from "next/server";
import {
  createBatch,
  getBatchesOrderedByCreatedDesc,
  parseBatchStatus,
  toBatchApiRecord,
  toBatchApiRecordWithHeadCoach,
  type BatchesListScope,
} from "@/lib/batches-queries";
import { resolveBranchHeadCoachLabels } from "@/lib/branch-head-coach";
import { validateBatchTimePair } from "@/lib/batch-time";
import { apiError } from "@/lib/api-response";
import { forbiddenJson, requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { baseCtxFromRequest, logError } from "@/lib/server-log";
import {
  APP_ADMIN_HEAD_ROLES,
  APP_STAFF_ROLES,
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";

export const runtime = "nodejs";

const ROUTE = "/api/batches";

export async function POST(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_ADMIN_HEAD_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BATCH_CREATE_BAD_REQUEST", message: "Invalid JSON body.", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return apiError({
      code: "BATCH_CREATE_BAD_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return apiError({
      code: "BATCH_CREATE_BAD_REQUEST",
      message: "Missing required field: name.",
      status: 400,
    });
  }

  const status = parseBatchStatus(b.status);

  const times = validateBatchTimePair(b.startTime, b.endTime);
  if (!times.ok) {
    return apiError({ code: "BATCH_CREATE_BAD_REQUEST", message: times.error, status: 400 });
  }

  let branchId: string | null = null;
  const instituteId = user.instituteId;

  if (user.role === ROLE_ADMIN) {
    const raw = b.branchId;
    if (typeof raw !== "string" || !raw.trim()) {
      return apiError({
        code: "BATCH_CREATE_BAD_REQUEST",
        message: "Batch must be assigned to a branch.",
        status: 400,
      });
    }
    const br = await prisma.branch.findFirst({
      where: { id: raw.trim(), instituteId },
      select: { id: true },
    });
    if (!br) {
      return apiError({
        code: "BATCH_CREATE_BAD_REQUEST",
        message: "Invalid branch for this institute.",
        status: 400,
      });
    }
    branchId = br.id;
  } else if (user.role === ROLE_HEAD_COACH) {
    branchId = user.branchId ?? null;
    if (branchId === null) {
      return forbiddenJson(
        "Your account is not assigned to a branch. Contact an administrator to assign your branch before creating batches.",
      );
    }
    const br = await prisma.branch.findFirst({
      where: { id: branchId, instituteId },
      select: { id: true },
    });
    if (!br) {
      return forbiddenJson("Your branch is not part of your institute.");
    }
  }

  try {
    const batch = await createBatch({
      name,
      status,
      startTime: times.startTime,
      endTime: times.endTime,
      branchId,
      instituteId,
    });
    const batchRecord = await toBatchApiRecordWithHeadCoach(batch);
    return NextResponse.json({ ok: true, batch: batchRecord }, { status: 201 });
  } catch (err) {
    logError("batches.create_failed", logCtx, err, { instituteId });
    const message = prismaErrorUserMessage(err, "Could not create batch. Please try again.");
    return apiError({ code: "BATCH_CREATE_FAILED", message, status: 500 });
  }
}

export async function GET(req: Request) {
  const logCtx = baseCtxFromRequest(req, ROUTE);
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  const instituteId = user.instituteId;
  let scope: BatchesListScope = { kind: "institute", instituteId };
  if (user.role === ROLE_HEAD_COACH) {
    scope = { kind: "head_coach", branchId: user.branchId ?? null, instituteId };
  } else if (user.role === ROLE_ASSISTANT_COACH) {
    scope = { kind: "assistant", userId: user.id, instituteId };
  } else if (user.role === ROLE_ADMIN) {
    const rawBranch = new URL(req.url).searchParams.get("branchId")?.trim();
    if (rawBranch) {
      const br = await prisma.branch.findFirst({
        where: { id: rawBranch, instituteId },
        select: { id: true },
      });
      if (br) {
        scope = { kind: "branch", branchId: br.id, instituteId };
      }
    }
  }

  try {
    const batches = await getBatchesOrderedByCreatedDesc(scope);
    const headMap = await resolveBranchHeadCoachLabels(
      instituteId,
      batches.map((b) => b.branchId),
    );
    return NextResponse.json(
      {
        ok: true,
        batches: batches.map((b) =>
          toBatchApiRecord(b, {
            branchHeadCoachLabel: b.branchId ? headMap.get(b.branchId) ?? null : null,
          }),
        ),
      },
      { status: 200 },
    );
  } catch (e) {
    logError("batches.list_failed", logCtx, e);
    return apiError({
      code: "BATCHES_LIST_FAILED",
      message: "Failed to fetch batches.",
      status: 500,
    });
  }
}

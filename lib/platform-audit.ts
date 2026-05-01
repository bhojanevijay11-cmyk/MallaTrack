import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PLATFORM_AUDIT_ACTION_INSTITUTE_STATUS_CHANGED =
  "institute.status_changed" as const;
export const PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_ASSIGN_BATCH_BRANCH =
  "health_repair.assign_batch_branch" as const;
export const PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_BATCH_ORPHAN_BRANCH =
  "health_repair.clear_batch_orphan_branch" as const;
export const PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_STUDENT_ORPHAN_BATCH =
  "health_repair.clear_student_orphan_batch" as const;
export const PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_HEAD_COACH_ORPHAN_BRANCH =
  "health_repair.clear_head_coach_orphan_branch" as const;
export const PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_REMOVE_ORPHAN_BATCH_ASSISTANT_ASSIGNMENT =
  "health_repair.remove_orphan_batch_assistant_assignment" as const;

export const PLATFORM_AUDIT_TARGET_INSTITUTE = "institute" as const;
export const PLATFORM_AUDIT_TARGET_BATCH = "batch" as const;
export const PLATFORM_AUDIT_TARGET_STUDENT = "student" as const;
export const PLATFORM_AUDIT_TARGET_USER = "user" as const;
export const PLATFORM_AUDIT_TARGET_BATCH_ASSISTANT = "batch_assistant" as const;

export type CreatePlatformAuditLogInput = {
  actorUserId: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  instituteId: string | null;
  metadata?: unknown;
};

function safeStringifyMetadata(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * Best-effort audit row. Never throws; failures are console-logged only.
 */
export async function createPlatformAuditLog(
  input: CreatePlatformAuditLogInput,
): Promise<void> {
  let actorEmail =
    typeof input.actorEmail === "string" && input.actorEmail.trim() !== ""
      ? input.actorEmail.trim()
      : null;

  if (!actorEmail && input.actorUserId) {
    try {
      const row = await prisma.user.findUnique({
        where: { id: input.actorUserId },
        select: { email: true },
      });
      actorEmail = row?.email?.trim() || null;
    } catch (e) {
      console.error("[platform-audit] actor email lookup failed", e);
    }
  }

  const metadata = safeStringifyMetadata(input.metadata);

  try {
    await prisma.platformAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorEmail,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        instituteId: input.instituteId,
        metadata,
      },
    });
  } catch (e) {
    console.error("[platform-audit] create failed", e);
  }
}

const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 100;

export function parseAuditLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_AUDIT_LIMIT;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_AUDIT_LIMIT;
  return Math.min(n, MAX_AUDIT_LIMIT);
}

export type PlatformAuditLogRow = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  instituteId: string | null;
  metadata: object | null;
  createdAt: string;
};

export function parseStoredAuditMetadata(
  raw: string | null | undefined,
): object | null {
  if (raw == null || raw === "") return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return v as object;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getPlatformAuditLogs(params: {
  action?: string | null;
  instituteId?: string | null;
  targetType?: string | null;
  limit?: number;
}): Promise<{ logs: PlatformAuditLogRow[] }> {
  const limit = Math.min(
    MAX_AUDIT_LIMIT,
    Math.max(1, params.limit ?? DEFAULT_AUDIT_LIMIT),
  );

  const where: Prisma.PlatformAuditLogWhereInput = {};
  if (params.action?.trim()) {
    where.action = params.action.trim();
  }
  if (params.instituteId?.trim()) {
    where.instituteId = params.instituteId.trim();
  }
  if (params.targetType?.trim()) {
    where.targetType = params.targetType.trim();
  }

  const rows = await prisma.platformAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      actorUserId: true,
      actorEmail: true,
      action: true,
      targetType: true,
      targetId: true,
      instituteId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const logs: PlatformAuditLogRow[] = rows.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actorEmail: r.actorEmail,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    instituteId: r.instituteId,
    metadata: parseStoredAuditMetadata(r.metadata),
    createdAt: r.createdAt.toISOString(),
  }));

  return { logs };
}

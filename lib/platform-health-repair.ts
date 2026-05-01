import { prisma } from "@/lib/prisma";
import {
  PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_ASSIGN_BATCH_BRANCH,
  PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_BATCH_ORPHAN_BRANCH,
  PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_HEAD_COACH_ORPHAN_BRANCH,
  PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_STUDENT_ORPHAN_BATCH,
  PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_REMOVE_ORPHAN_BATCH_ASSISTANT_ASSIGNMENT,
  PLATFORM_AUDIT_TARGET_BATCH,
  PLATFORM_AUDIT_TARGET_BATCH_ASSISTANT,
  PLATFORM_AUDIT_TARGET_STUDENT,
  PLATFORM_AUDIT_TARGET_USER,
} from "@/lib/platform-audit";
import { ROLE_HEAD_COACH } from "@/lib/roles";

export const PLATFORM_HEALTH_REPAIR_ACTIONS = [
  "assign_batch_branch",
  "clear_batch_orphan_branch",
  "clear_student_orphan_batch",
  "clear_head_coach_orphan_branch",
  "remove_orphan_batch_assistant_assignment",
] as const;

export type PlatformHealthRepairAction =
  (typeof PLATFORM_HEALTH_REPAIR_ACTIONS)[number];

export type PlatformHealthRepairAuditPayload = {
  action: string;
  targetType: string;
  targetId: string;
  instituteId: string | null;
  metadata: Record<string, unknown>;
};

export type PlatformHealthRepairResultBody =
  | {
      action: "assign_batch_branch";
      batchId: string;
      branchId: string;
    }
  | {
      action: "clear_batch_orphan_branch";
      batchId: string;
      branchId: null;
    }
  | {
      action: "clear_student_orphan_batch";
      studentId: string;
      batchId: null;
    }
  | {
      action: "clear_head_coach_orphan_branch";
      userId: string;
      branchId: null;
    }
  | {
      action: "remove_orphan_batch_assistant_assignment";
      batchAssistantId: string;
      removed: true;
    };

export type PlatformHealthRepairSuccess = {
  ok: true;
  message: string;
  result: PlatformHealthRepairResultBody;
  audit: PlatformHealthRepairAuditPayload;
};

export type PlatformHealthRepairFailure = {
  ok: false;
  status: 400 | 404 | 409;
  error: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function batchBranchIdEmpty(branchId: string | null | undefined): boolean {
  return branchId == null || branchId === "";
}

function isRepairAction(v: unknown): v is PlatformHealthRepairAction {
  return (
    typeof v === "string" &&
    (PLATFORM_HEALTH_REPAIR_ACTIONS as readonly string[]).includes(v)
  );
}

/**
 * SUPER_ADMIN-only health repairs. Validates from DB; ignores client issue category.
 */
export async function executePlatformHealthRepair(
  body: unknown,
): Promise<PlatformHealthRepairSuccess | PlatformHealthRepairFailure> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid request body.",
    };
  }

  const raw = body as Record<string, unknown>;
  const action = raw.action;

  if (!isRepairAction(action)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid or missing action.",
    };
  }

  if (action === "assign_batch_branch") {
    const batchId = raw.batchId;
    const branchId = raw.branchId;
    if (!isNonEmptyString(batchId) || !isNonEmptyString(branchId)) {
      return {
        ok: false,
        status: 400,
        error: "batchId and branchId are required.",
      };
    }

    const batch = await prisma.batch.findUnique({
      where: { id: batchId.trim() },
      select: { id: true, instituteId: true, branchId: true },
    });

    if (!batch) {
      return { ok: false, status: 404, error: "Batch not found." };
    }

    if (batchBranchIdEmpty(batch.instituteId)) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    if (!batchBranchIdEmpty(batch.branchId)) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId.trim() },
      select: { id: true, instituteId: true, name: true },
    });

    if (!branch) {
      return { ok: false, status: 404, error: "Branch not found." };
    }

    if (branch.instituteId !== batch.instituteId) {
      return {
        ok: false,
        status: 409,
        error: "Branch does not belong to this batch’s institute.",
      };
    }

    await prisma.batch.update({
      where: { id: batch.id },
      data: { branchId: branch.id },
    });

    return {
      ok: true,
      message: "Batch branch assigned successfully.",
      result: {
        action,
        batchId: batch.id,
        branchId: branch.id,
      },
      audit: {
        action: PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_ASSIGN_BATCH_BRANCH,
        targetType: PLATFORM_AUDIT_TARGET_BATCH,
        targetId: batch.id,
        instituteId: batch.instituteId,
        metadata: {
          previousBranchId: null,
          newBranchId: branch.id,
          branchName: branch.name?.trim() || null,
        },
      },
    };
  }

  if (action === "clear_batch_orphan_branch") {
    const batchId = raw.batchId;
    if (!isNonEmptyString(batchId)) {
      return {
        ok: false,
        status: 400,
        error: "batchId is required.",
      };
    }

    const batch = await prisma.batch.findUnique({
      where: { id: batchId.trim() },
      select: { id: true, instituteId: true, branchId: true },
    });

    if (!batch) {
      return { ok: false, status: 404, error: "Batch not found." };
    }

    if (batchBranchIdEmpty(batch.branchId)) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    const orphanTargetId = batch.branchId as string;

    const branchRow = await prisma.branch.findUnique({
      where: { id: orphanTargetId },
      select: { id: true },
    });

    if (branchRow) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    await prisma.batch.update({
      where: { id: batch.id },
      data: { branchId: null },
    });

    return {
      ok: true,
      message: "Invalid batch branch reference cleared.",
      result: {
        action,
        batchId: batch.id,
        branchId: null,
      },
      audit: {
        action: PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_BATCH_ORPHAN_BRANCH,
        targetType: PLATFORM_AUDIT_TARGET_BATCH,
        targetId: batch.id,
        instituteId: batch.instituteId ?? null,
        metadata: {
          previousBranchId: orphanTargetId,
          newBranchId: null,
        },
      },
    };
  }

  if (action === "clear_student_orphan_batch") {
    const studentId = raw.studentId;
    if (!isNonEmptyString(studentId)) {
      return {
        ok: false,
        status: 400,
        error: "studentId is required.",
      };
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId.trim() },
      select: { id: true, instituteId: true, batchId: true },
    });

    if (!student) {
      return { ok: false, status: 404, error: "Student not found." };
    }

    if (batchBranchIdEmpty(student.batchId)) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    const prevBatchId = student.batchId as string;

    const batchRow = await prisma.batch.findUnique({
      where: { id: prevBatchId },
      select: { id: true },
    });

    if (batchRow) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    await prisma.student.update({
      where: { id: student.id },
      data: { batchId: null },
    });

    return {
      ok: true,
      message: "Invalid student batch reference cleared.",
      result: {
        action,
        studentId: student.id,
        batchId: null,
      },
      audit: {
        action: PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_STUDENT_ORPHAN_BATCH,
        targetType: PLATFORM_AUDIT_TARGET_STUDENT,
        targetId: student.id,
        instituteId: student.instituteId ?? null,
        metadata: {
          previousBatchId: prevBatchId,
          newBatchId: null,
        },
      },
    };
  }

  if (action === "clear_head_coach_orphan_branch") {
    const userId = raw.userId;
    if (!isNonEmptyString(userId)) {
      return {
        ok: false,
        status: 400,
        error: "userId is required.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { id: true, role: true, instituteId: true, branchId: true },
    });

    if (!user) {
      return { ok: false, status: 404, error: "User not found." };
    }

    if (user.role !== ROLE_HEAD_COACH) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    if (batchBranchIdEmpty(user.branchId)) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    const prevBranchId = user.branchId as string;

    const branchRow = await prisma.branch.findUnique({
      where: { id: prevBranchId },
      select: { id: true },
    });

    if (branchRow) {
      return {
        ok: false,
        status: 409,
        error: "Repair skipped because this issue no longer exists.",
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { branchId: null },
    });

    return {
      ok: true,
      message: "Invalid head coach branch reference cleared.",
      result: {
        action,
        userId: user.id,
        branchId: null,
      },
      audit: {
        action: PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_CLEAR_HEAD_COACH_ORPHAN_BRANCH,
        targetType: PLATFORM_AUDIT_TARGET_USER,
        targetId: user.id,
        instituteId: user.instituteId ?? null,
        metadata: {
          previousBranchId: prevBranchId,
          newBranchId: null,
        },
      },
    };
  }

  /* remove_orphan_batch_assistant_assignment */
  const batchAssistantId = raw.batchAssistantId;
  if (!isNonEmptyString(batchAssistantId)) {
    return {
      ok: false,
      status: 400,
      error: "batchAssistantId is required.",
    };
  }

  const assignment = await prisma.batchAssistant.findUnique({
    where: { id: batchAssistantId.trim() },
    select: { id: true, batchId: true, userId: true },
  });

  if (!assignment) {
    return {
      ok: false,
      status: 404,
      error: "Batch assistant assignment not found.",
    };
  }

  if (batchBranchIdEmpty(assignment.batchId)) {
    return {
      ok: false,
      status: 409,
      error: "Repair skipped because this issue no longer exists.",
    };
  }

  const orphanBatchId = assignment.batchId as string;

  const batchExists = await prisma.batch.findUnique({
    where: { id: orphanBatchId },
    select: { id: true },
  });

  if (batchExists) {
    return {
      ok: false,
      status: 409,
      error: "Repair skipped because this issue no longer exists.",
    };
  }

  await prisma.batchAssistant.delete({
    where: { id: assignment.id },
  });

  return {
    ok: true,
    message: "Invalid assistant batch assignment removed.",
    result: {
      action,
      batchAssistantId: assignment.id,
      removed: true,
    },
    audit: {
      action:
        PLATFORM_AUDIT_ACTION_HEALTH_REPAIR_REMOVE_ORPHAN_BATCH_ASSISTANT_ASSIGNMENT,
      targetType: PLATFORM_AUDIT_TARGET_BATCH_ASSISTANT,
      targetId: assignment.id,
      instituteId: null,
      metadata: {
        assistantUserId: assignment.userId,
        orphanBatchId,
      },
    },
  };
}

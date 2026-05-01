import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isInstituteStatus,
  normalizeInstituteStatus,
} from "@/lib/institute-status";
import {
  createPlatformAuditLog,
  PLATFORM_AUDIT_ACTION_INSTITUTE_STATUS_CHANGED,
  PLATFORM_AUDIT_TARGET_INSTITUTE,
} from "@/lib/platform-audit";
import { requireSuperAdminApi } from "@/lib/platform-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const trimmed = id?.trim() ?? "";
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, {
      status: 400,
    });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid body." }, {
      status: 400,
    });
  }
  const statusRaw = (body as Record<string, unknown>).status;
  if (!isInstituteStatus(statusRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, {
      status: 400,
    });
  }

  try {
    const existing = await prisma.institute.findUnique({
      where: { id: trimmed },
      select: { id: true, name: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }

    const previousStatus = normalizeInstituteStatus(existing.status);

    const updated = await prisma.institute.update({
      where: { id: trimmed },
      data: { status: statusRaw },
      select: { id: true, name: true, status: true },
    });

    const newStatus = normalizeInstituteStatus(updated.status);

    void createPlatformAuditLog({
      actorUserId: auth.id,
      action: PLATFORM_AUDIT_ACTION_INSTITUTE_STATUS_CHANGED,
      targetType: PLATFORM_AUDIT_TARGET_INSTITUTE,
      targetId: updated.id,
      instituteId: updated.id,
      metadata: {
        previousStatus,
        newStatus,
        instituteName: updated.name,
      },
    });

    return NextResponse.json({
      institute: {
        id: updated.id,
        name: updated.name,
        status: newStatus,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
}

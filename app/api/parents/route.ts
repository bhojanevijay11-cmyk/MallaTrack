import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { buildStudentScopeWhere } from "@/lib/authz-prisma-scopes";
import { displayNameFromEmail } from "@/lib/email-display";
import {
  APP_STAFF_ROLES,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  ROLE_PARENT,
} from "@/lib/roles";
import { logCtxWithActor, logError } from "@/lib/server-log";

export const runtime = "nodejs";

const ROUTE = "/api/parents";

export async function GET(req: Request) {
  const userRaw = await getSessionUser();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  const logCtx = logCtxWithActor(req, ROUTE, {
    userId: user.id,
    instituteId: user.instituteId,
    role: user.role,
  });

  try {
    let rows: { id: string; email: string }[];

    if (user.role === ROLE_HEAD_COACH || user.role === ROLE_ASSISTANT_COACH) {
      const studentScope = await buildStudentScopeWhere(user);
      const links = await prisma.student.findMany({
        where: {
          AND: [studentScope, { parentUserId: { not: null } }],
        },
        select: { parentUserId: true },
      });
      const parentIds = [
        ...new Set(
          links
            .map((l) => l.parentUserId)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      ];
      if (parentIds.length === 0) {
        rows = [];
      } else {
        rows = await prisma.user.findMany({
          where: {
            id: { in: parentIds },
            instituteId: user.instituteId,
            role: ROLE_PARENT,
          },
          select: { id: true, email: true },
          orderBy: { email: "asc" },
        });
      }
    } else {
      rows = await prisma.user.findMany({
        where: { instituteId: user.instituteId, role: ROLE_PARENT },
        select: { id: true, email: true },
        orderBy: { email: "asc" },
      });
    }

    return NextResponse.json({
      ok: true,
      parents: rows.map((r) => ({
        id: r.id,
        name: displayNameFromEmail(r.email),
        email: r.email,
      })),
    });
  } catch (e) {
    logError("parents.list_failed", logCtx, e);
    return apiError({
      code: "PARENTS_LIST_FAILED",
      message: "Failed to fetch parents.",
      status: 500,
    });
  }
}

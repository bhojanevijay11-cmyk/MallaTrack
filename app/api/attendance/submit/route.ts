import { NextResponse } from "next/server";
import { requireRoleWithInstitute } from "@/lib/auth-server";
import { getAuthorizedAppContext } from "@/lib/authorized-app-context";
import { submitAttendancePayload } from "@/lib/attendance-submit";
import { APP_STAFF_ROLES } from "@/lib/roles";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userRaw = await getAuthorizedAppContext();
  const user = await requireRoleWithInstitute(userRaw, APP_STAFF_ROLES);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      code: "BAD_JSON",
      message: "Invalid JSON body.",
      status: 400,
    });
  }

  const result = await submitAttendancePayload(user, body);
  if (!result.ok) {
    return apiError({
      code: "ATTENDANCE_SUBMIT_FAILED",
      message: result.error,
      status: result.status,
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

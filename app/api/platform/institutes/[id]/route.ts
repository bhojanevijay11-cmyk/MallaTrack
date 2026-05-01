import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/platform-auth";
import { getPlatformInstituteDetail } from "@/lib/platform-institutes";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const payload = await getPlatformInstituteDetail(id.trim());
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(payload);
}

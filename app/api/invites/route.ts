import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { prismaErrorUserMessage } from "@/lib/prisma-user-message";
import { getSessionUser, requireRoleWithInstitute } from "@/lib/auth-server";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH, roleHomePath } from "@/lib/roles";
import { generateInviteToken, hashInviteToken } from "@/lib/invites";
import { baseCtxFromRequest, logCtxWithActor, logError } from "@/lib/server-log";
import { isValidEmailShape, normalizeEmail, validatePassword } from "@/lib/user-validation";

export const runtime = "nodejs";

const ROUTE = "/api/invites";

const INVITE_ALLOWED_ROLES = [ROLE_ADMIN, ROLE_HEAD_COACH, ROLE_ASSISTANT_COACH] as const;
type InviteRole = (typeof INVITE_ALLOWED_ROLES)[number];

function parseCreateBody(
  body: unknown,
):
  | { ok: true; fullName: string; email: string; role: InviteRole; branchId: string | null }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const emailRaw = typeof b.email === "string" ? b.email : "";
  const email = normalizeEmail(emailRaw);
  const role = typeof b.role === "string" ? (b.role as InviteRole) : ("" as InviteRole);
  const branchId = typeof b.branchId === "string" ? b.branchId.trim() : "";

  if (fullName.length < 2) return { ok: false, error: "Full name must be at least 2 characters." };
  if (fullName.length > 120) return { ok: false, error: "Full name is too long." };
  if (!isValidEmailShape(emailRaw)) return { ok: false, error: "Enter a valid email address." };
  if (!INVITE_ALLOWED_ROLES.includes(role)) return { ok: false, error: "Select a valid staff role." };

  const needsBranch = role === ROLE_HEAD_COACH || role === ROLE_ASSISTANT_COACH;
  if (needsBranch && !branchId) {
    return { ok: false, error: "Branch is required for head/assistant coach invites." };
  }

  return { ok: true, fullName, email, role, branchId: branchId ? branchId : null };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }

  const parsed = parseCreateBody(body);
  if (!parsed.ok) {
    return apiError({ code: "INVITE_CREATE_BAD_REQUEST", message: parsed.error, status: 400 });
  }

  const userRaw = await getSessionUser();
  const inviter = await requireRoleWithInstitute(userRaw, [ROLE_ADMIN]);
  if (inviter instanceof NextResponse) return inviter;

  const logCtx = logCtxWithActor(req, ROUTE, {
    userId: inviter.id,
    instituteId: inviter.instituteId,
    role: inviter.role,
  });

  if (parsed.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: parsed.branchId },
      select: { id: true, instituteId: true },
    });
    if (!branch || branch.instituteId !== inviter.instituteId) {
      return apiError({
        code: "INVITE_CREATE_FORBIDDEN",
        message: "Selected branch is not part of your institute.",
        status: 403,
      });
    }
  }

  // Prevent spam: if there is a currently usable invite for this email+institute, return it instead.
  const now = new Date();
  const existingInvite = await prisma.invite.findFirst({
    where: {
      instituteId: inviter.instituteId,
      email: parsed.email,
      usedAt: null,
      expiresAt: { gt: now },
      studentId: null,
    },
    select: { id: true },
  });
  if (existingInvite) {
    return apiError({
      code: "INVITE_CREATE_CONFLICT",
      message: "An active invite already exists for this email.",
      status: 409,
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.email },
    select: { id: true, instituteId: true },
  });
  if (existingUser?.instituteId && existingUser.instituteId !== inviter.instituteId) {
    return apiError({
      code: "INVITE_CREATE_CONFLICT",
      message: "This email already belongs to a user in another institute.",
      status: 409,
    });
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  let invite;
  try {
    invite = await prisma.$transaction(async (tx) => {
      // Ensure we have (or create) a placeholder user row. User.passwordHash is required.
      const placeholderPassword = generateInviteToken();
      const passwordHash = await bcrypt.hash(placeholderPassword, 12);

      const userRow =
        existingUser?.id
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                instituteId: existingUser.instituteId ?? inviter.instituteId,
                role: parsed.role,
                branchId: parsed.branchId,
                passwordHash,
              },
              select: { id: true },
            })
          : await tx.user.create({
              data: {
                email: parsed.email,
                passwordHash,
                role: parsed.role,
                instituteId: inviter.instituteId,
                branchId: parsed.branchId,
              },
              select: { id: true },
            });

      return tx.invite.create({
        data: {
          email: parsed.email,
          fullName: parsed.fullName,
          role: parsed.role,
          instituteId: inviter.instituteId,
          branchId: parsed.branchId,
          studentId: null,
          inviterUserId: inviter.id,
          invitedUserId: userRow.id,
          tokenHash,
          expiresAt,
        },
        select: { id: true },
      });
    });
  } catch (e) {
    logError("invites.create_failed", logCtx, e, { targetEmail: parsed.email });
    return apiError({
      code: "INVITE_CREATE_FAILED",
      message: prismaErrorUserMessage(e, "Could not create invite. Please try again."),
      status: 500,
    });
  }

  return NextResponse.json({
    ok: true,
    inviteId: invite.id,
    inviteUrl: `/invite/${token}`,
    expiresAt: expiresAt.toISOString(),
  });
}

function parseAcceptBody(
  body: unknown,
): { ok: true; token: string; password: string; confirmPassword: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const confirmPassword = typeof b.confirmPassword === "string" ? b.confirmPassword : "";
  if (!token) return { ok: false, error: "Missing invite token." };
  const pw = validatePassword(password);
  if (!pw.ok) return { ok: false, error: pw.message };
  if (password !== confirmPassword) return { ok: false, error: "Passwords do not match." };
  return { ok: true, token, password, confirmPassword };
}

export async function PUT(req: Request) {
  // Accept invite + set password. (PUT to keep v1 minimal without another route file.)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({ code: "BAD_JSON", message: "Invalid JSON body.", status: 400 });
  }
  const parsed = parseAcceptBody(body);
  if (!parsed.ok) {
    return apiError({ code: "INVITE_ACCEPT_BAD_REQUEST", message: parsed.error, status: 400 });
  }

  const logCtx = baseCtxFromRequest(req, ROUTE);

  const tokenHash = hashInviteToken(parsed.token);
  const now = new Date();

  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      role: true,
      email: true,
      instituteId: true,
      branchId: true,
      invitedUserId: true,
      studentId: true,
    },
  });
  if (!invite) {
    return apiError({ code: "INVITE_ACCEPT_NOT_FOUND", message: "Invite link is invalid.", status: 404 });
  }
  if (invite.studentId) {
    return apiError({
      code: "INVITE_ACCEPT_BAD_REQUEST",
      message: "Open your invite from the parent link to complete setup.",
      status: 400,
    });
  }
  if (invite.usedAt) {
    return apiError({
      code: "INVITE_ACCEPT_USED",
      message: "Invite link has already been used.",
      status: 409,
    });
  }
  if (invite.expiresAt <= now) {
    return apiError({
      code: "INVITE_ACCEPT_EXPIRED",
      message: "Invite link has expired.",
      status: 410,
    });
  }

  const userRow = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, instituteId: true },
  });
  if (!userRow) {
    return apiError({
      code: "INVITE_ACCEPT_CONFLICT",
      message: "Invited user record is missing. Ask your admin to re-invite.",
      status: 409,
    });
  }
  if (userRow.instituteId && userRow.instituteId !== invite.instituteId) {
    return apiError({
      code: "INVITE_ACCEPT_CONFLICT",
      message: "This email is already linked to another institute.",
      status: 409,
    });
  }
  if (userRow.id !== invite.invitedUserId) {
    return apiError({
      code: "INVITE_ACCEPT_CONFLICT",
      message: "Invite does not match this email account.",
      status: 409,
    });
  }

  if (invite.branchId) {
    const branchOk = await prisma.branch.findFirst({
      where: { id: invite.branchId, instituteId: invite.instituteId },
      select: { id: true },
    });
    if (!branchOk) {
      return apiError({
        code: "INVITE_ACCEPT_CONFLICT",
        message:
          "Invite data is inconsistent (branch). Ask your admin to send a new invite.",
        status: 409,
      });
    }
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const reserved = await tx.invite.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (reserved.count === 0) {
        const fresh = await tx.invite.findUnique({
          where: { id: invite.id },
          select: { usedAt: true, expiresAt: true },
        });
        if (fresh?.usedAt) {
          throw Object.assign(new Error("INVITE_ACCEPT_RACE_USED"), {
            name: "InviteStaleError",
          });
        }
        if (fresh && fresh.expiresAt <= now) {
          throw Object.assign(new Error("INVITE_ACCEPT_RACE_EXPIRED"), {
            name: "InviteStaleError",
          });
        }
        throw Object.assign(new Error("INVITE_ACCEPT_RACE_INVALID"), {
          name: "InviteStaleError",
        });
      }
      await tx.user.update({
        where: { id: userRow.id },
        data: {
          passwordHash,
          role: invite.role,
          instituteId: invite.instituteId,
          branchId: invite.branchId,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.name === "InviteStaleError") {
      if (e.message === "INVITE_ACCEPT_RACE_USED") {
        return apiError({
          code: "INVITE_ACCEPT_USED",
          message:
            "This invite was already completed. If you just accepted it, sign in; otherwise ask for a new invite.",
          status: 409,
        });
      }
      if (e.message === "INVITE_ACCEPT_RACE_EXPIRED") {
        return apiError({
          code: "INVITE_ACCEPT_EXPIRED",
          message: "Invite link has expired.",
          status: 410,
        });
      }
      logError("invites.accept_stale", logCtx, e, { inviteId: invite.id });
      return apiError({
        code: "INVITE_ACCEPT_STALE",
        message:
          "This invite could not be completed because its state changed. Refresh the page or open the link again.",
        status: 409,
      });
    }
    logError("invites.accept_failed", logCtx, e, { inviteId: invite.id, instituteId: invite.instituteId });
    return apiError({
      code: "INVITE_ACCEPT_FAILED",
      message: prismaErrorUserMessage(e, "Could not complete invite setup. Please try again."),
      status: 500,
    });
  }

  return NextResponse.json({
    ok: true,
    email: invite.email,
    redirectTo: roleHomePath(invite.role),
  });
}


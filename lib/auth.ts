import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/roles";
import { isAppRole, ROLE_HEAD_COACH, ROLE_SUPER_ADMIN } from "@/lib/roles";
import { CREDENTIALS_ROLE_NOT_CONFIGURED } from "@/lib/credentials-role-error";
import { normalizeEmail } from "@/lib/user-validation";
import { debugLogHeadCoachScope } from "@/lib/head-coach-scope-debug";
import { authLoginRateLimitOrThrow, extractClientIpFromAuthRequest } from "@/lib/auth-rate-limit";
import {
  INSTITUTE_STATUS_ACTIVE,
  INSTITUTE_STATUS_DISABLED,
  normalizeInstituteStatus,
} from "@/lib/institute-status";

function normalizeBranchId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && !nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET is required in production.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        loginId: { label: "Login ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.loginId?.trim() || !credentials?.password) {
          return null;
        }
        authLoginRateLimitOrThrow({
          ip: extractClientIpFromAuthRequest(req),
          loginId: credentials.loginId,
        });
        const email = normalizeEmail(credentials.loginId);
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
            branchId: true,
            instituteId: true,
            institute: { select: { name: true, status: true } },
          },
        });
        if (!user) {
          return null;
        }
        const match = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );
        if (!match) {
          return null;
        }
        if (!isAppRole(user.role)) {
          throw new Error(CREDENTIALS_ROLE_NOT_CONFIGURED);
        }
        return {
          id: user.id,
          email: user.email,
          name: user.email,
          role: user.role,
          branchId: user.branchId,
          instituteId: user.instituteId ?? null,
          instituteName: user.institute?.name ?? null,
          instituteStatus: user.institute
            ? normalizeInstituteStatus(user.institute.status)
            : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      let headCoachBranchIdLoadedWithTenantRow = false;
      if (user) {
        if (user.role) token.role = user.role;
        if ("branchId" in user) {
          token.branchId = normalizeBranchId(user.branchId);
        }
        if ("instituteId" in user) {
          token.instituteId = user.instituteId ?? null;
        }
        if ("instituteName" in user) {
          token.instituteName = user.instituteName ?? null;
        }
        if ("instituteStatus" in user) {
          token.instituteStatus = user.instituteStatus ?? null;
        }
      } else if (trigger === "update" && session && typeof session === "object") {
        const s = session as Record<string, unknown>;
        if (typeof s.instituteId === "string" && s.instituteId.length > 0) {
          token.instituteId = s.instituteId;
        }
        if (typeof s.instituteName === "string") {
          token.instituteName = s.instituteName;
        } else if (s.instituteName === null) {
          token.instituteName = null;
        }
        if ("branchId" in s) {
          token.branchId = normalizeBranchId(s.branchId);
        }
      } else if (typeof token.sub === "string") {
        const needsTenantFromDb =
          token.role !== ROLE_SUPER_ADMIN &&
          (token.instituteId === undefined ||
            token.instituteId === null ||
            token.instituteId === "");
        if (needsTenantFromDb) {
          const row = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              instituteId: true,
              branchId: true,
            },
          });
          token.instituteId = row?.instituteId ?? null;
          token.branchId = normalizeBranchId(row?.branchId);
          headCoachBranchIdLoadedWithTenantRow = true;
        }
      }

      /**
       * Head coach visibility is strictly `User.branchId`. The JWT can lag the DB after
       * branch reassignment; previously we only reloaded when branchId was empty, so a stale
       * non-empty token value hid an entire branch. Always re-read from DB for this role.
       */
      if (typeof token.sub === "string" && token.role === ROLE_HEAD_COACH) {
        if (!headCoachBranchIdLoadedWithTenantRow) {
          const branchIdBeforeSync = token.branchId;
          const row = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { branchId: true },
          });
          const branchIdFromDb = normalizeBranchId(row?.branchId);
          token.branchId = branchIdFromDb;
          debugLogHeadCoachScope({
            source: "jwt",
            userId: token.sub,
            role: token.role,
            instituteId: token.instituteId,
            branchIdBeforeSync,
            branchIdFromDb,
            finalTokenBranchId: token.branchId,
          });
        } else {
          debugLogHeadCoachScope({
            source: "jwt",
            userId: token.sub,
            role: token.role,
            instituteId: token.instituteId,
            branchIdBeforeSync: token.branchId,
            branchIdFromDb: token.branchId,
            finalTokenBranchId: token.branchId,
            note: "branchId from tenant hydration query (single User lookup)",
          });
        }
      }

      if (token.role === ROLE_SUPER_ADMIN) {
        token.instituteStatus = null;
      } else if (
        typeof token.sub === "string" &&
        typeof token.instituteId === "string" &&
        token.instituteId.length > 0
      ) {
        const inst = await prisma.institute.findUnique({
          where: { id: token.instituteId },
          select: { name: true, status: true },
        });
        token.instituteName = inst?.name ?? null;
        token.instituteStatus = normalizeInstituteStatus(inst?.status);
      } else {
        token.instituteStatus = null;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as AppRole | undefined;
        session.user.branchId = normalizeBranchId(token.branchId);
        session.user.instituteId =
          (token.instituteId as string | null | undefined) ?? null;
        session.user.instituteName =
          (token.instituteName as string | null | undefined) ?? null;
        if (token.instituteStatus === INSTITUTE_STATUS_DISABLED) {
          session.user.instituteStatus = INSTITUTE_STATUS_DISABLED;
        } else if (token.instituteStatus === INSTITUTE_STATUS_ACTIVE) {
          session.user.instituteStatus = INSTITUTE_STATUS_ACTIVE;
        } else {
          session.user.instituteStatus = null;
        }
        if (token.sub) {
          session.user.id = token.sub;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: nextAuthSecret,
};

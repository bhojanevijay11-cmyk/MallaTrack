import "next-auth";
import "next-auth/jwt";
import type { InstituteStatus } from "@/lib/institute-status";
import type { AppRole } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    branchId?: string | null;
    instituteId?: string | null;
    /** Display name of the tenant institute (Prompt E). */
    instituteName?: string | null;
    instituteStatus?: InstituteStatus | null;
  }

  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: AppRole;
      branchId?: string | null;
      instituteId?: string | null;
      instituteName?: string | null;
      instituteStatus?: InstituteStatus | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    branchId?: string | null;
    instituteId?: string | null;
    instituteName?: string | null;
    instituteStatus?: InstituteStatus | null;
  }
}

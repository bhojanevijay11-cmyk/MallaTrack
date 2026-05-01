import bcrypt from "bcryptjs";
import { generateInviteToken, hashInviteToken } from "@/lib/invites";

export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

export function generatePasswordResetToken(): string {
  return generateInviteToken();
}

export function hashPasswordResetToken(token: string): string {
  return hashInviteToken(token);
}

/** Same rounds as registration and credentials auth. */
export async function hashPasswordForStorage(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

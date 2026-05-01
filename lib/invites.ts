import crypto from "crypto";

export function generateInviteToken(): string {
  // 32 bytes -> 64 hex chars, URL-safe without encoding.
  return crypto.randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}


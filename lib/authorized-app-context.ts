import { getSessionUser, type AuthSessionUser } from "@/lib/auth-server";

/**
 * Canonical normalized JWT-backed identity for APIs and server components.
 * Prefer this over calling `getSessionUser` directly so authorization code has one entry point.
 */
export type AuthorizedAppContext = AuthSessionUser;

export async function getAuthorizedAppContext(): Promise<AuthorizedAppContext | null> {
  return getSessionUser();
}

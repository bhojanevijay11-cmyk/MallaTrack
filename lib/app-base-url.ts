/** Public app origin for absolute links (password reset, emails). No trailing slash. */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "";
  return raw.replace(/\/$/, "");
}

/** When env base URL is missing, derive origin from the incoming request (dev/proxies). */
export function getAppBaseUrlFromRequest(req: Request): string {
  const env = getAppBaseUrl();
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return "";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host.replace(/\/$/, "")}`;
}

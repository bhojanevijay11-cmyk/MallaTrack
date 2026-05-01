import { randomUUID } from "crypto";

export type ServerLogLevel = "info" | "warn" | "error";

export type ServerLogCtx = {
  requestId?: string;
  route?: string;
  method?: string;
  userId?: string | null;
  instituteId?: string | null;
  role?: string | null;
  errorCode?: string;
};

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getRequestId(req: Request): string {
  const fromHeader = req.headers.get("x-request-id")?.trim();
  if (fromHeader) return fromHeader;
  return randomUUID();
}

export function baseCtxFromRequest(req: Request, route: string): ServerLogCtx {
  return {
    requestId: getRequestId(req),
    route,
    method: req.method,
  };
}

/** Merge request context with the acting user for destructive / sensitive operations (audit-ready logs). */
export function logCtxWithActor(
  req: Request,
  route: string,
  actor: { userId: string; instituteId: string; role: string },
): ServerLogCtx {
  return {
    ...baseCtxFromRequest(req, route),
    userId: actor.userId,
    instituteId: actor.instituteId,
    role: actor.role,
  };
}

function formatDevLine(level: ServerLogLevel, event: string, ctx: ServerLogCtx): string {
  const parts: string[] = [];
  parts.push(level.toUpperCase());
  parts.push(event);
  if (ctx.route) parts.push(ctx.route);
  if (ctx.method) parts.push(ctx.method);
  if (ctx.requestId) parts.push(`rid=${ctx.requestId}`);
  if (ctx.userId) parts.push(`uid=${ctx.userId}`);
  if (ctx.instituteId) parts.push(`tid=${ctx.instituteId}`);
  if (ctx.role) parts.push(`role=${ctx.role}`);
  if (ctx.errorCode) parts.push(`code=${ctx.errorCode}`);
  return parts.join(" ");
}

function safeErr(err: unknown): { name?: string; message?: string; stack?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === "string") return { message: err };
  return { message: "unknown error" };
}

export function serverLog(
  level: ServerLogLevel,
  event: string,
  ctx: ServerLogCtx,
  extra?: Record<string, unknown>,
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...ctx,
    ...(extra ?? {}),
  };

  if (!isProd()) {
    const line = formatDevLine(level, event, ctx);
    if (level === "error") console.error(line, extra ?? "");
    else if (level === "warn") console.warn(line, extra ?? "");
    else console.info(line, extra ?? "");
    return;
  }

  const json = JSON.stringify(payload);
  if (level === "error") console.error(json);
  else if (level === "warn") console.warn(json);
  else console.log(json);
}

export function logInfo(event: string, ctx: ServerLogCtx, extra?: Record<string, unknown>) {
  serverLog("info", event, ctx, extra);
}

export function logWarn(event: string, ctx: ServerLogCtx, extra?: Record<string, unknown>) {
  serverLog("warn", event, ctx, extra);
}

export function logError(
  event: string,
  ctx: ServerLogCtx,
  err?: unknown,
  extra?: Record<string, unknown>,
) {
  serverLog("error", event, ctx, { ...extra, err: safeErr(err) });
}


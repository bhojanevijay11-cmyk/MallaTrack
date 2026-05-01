import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** Institute / organization display line (Prompt E), e.g. session institute name. */
  tenantLine?: string | null;
  /** Small label above the title (e.g. section eyebrow). */
  eyebrow?: string;
  /** Right-aligned actions next to the title block (e.g. primary CTA). */
  headerRight?: ReactNode;
  /** Optional override for the `<h1>` class (dashboard shell only). */
  titleClassName?: string;
  children?: ReactNode;
  /** Wider main column for grids (e.g. students). */
  maxWidth?: "default" | "wide";
  /** Outer shell aligned with Academy control center (gradient, padding rhythm). */
  dashboardShell?: boolean;
  /** Back link target (defaults to admin home). */
  backHref?: string;
  /** Back link label. */
  backLabel?: string;
  /** When false, hides the top back link (e.g. under StaffAppShell). Default true. */
  showBackLink?: boolean;
};

export function NavPlaceholder({
  title,
  description,
  tenantLine,
  eyebrow,
  headerRight,
  titleClassName,
  children,
  maxWidth = "default",
  dashboardShell = false,
  backHref = "/admin",
  backLabel = "← Back to dashboard",
  showBackLink = true,
}: Props) {
  const maxW = maxWidth === "wide" ? "max-w-7xl" : "max-w-lg";
  const mainClass = dashboardShell
    ? `mx-auto w-full min-h-0 ${maxW} px-4 py-2 sm:px-6 sm:py-3 lg:px-8`
    : `mx-auto min-h-dvh ${maxW} px-4 py-8 sm:py-10`;

  const body = (
    <>
      {showBackLink ? (
        <Link
          href={backHref}
          className="text-sm font-medium text-primary transition hover:opacity-90"
        >
          {backLabel}
        </Link>
      ) : null}
      {tenantLine?.trim() ? (
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 ${showBackLink ? "mt-1" : ""}`}
        >
          Organization · {tenantLine.trim()}
        </p>
      ) : null}
      <div
        className={
          dashboardShell
            ? "mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3"
            : "mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        }
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={
              titleClassName ??
              (dashboardShell
                ? eyebrow
                  ? "mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
                  : "text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
                : eyebrow
                  ? "mt-1 text-2xl font-semibold tracking-tight text-slate-900"
                  : "text-2xl font-semibold tracking-tight text-slate-900")
            }
          >
            {title}
          </h1>
          {description ? (
            <p
              className={
                dashboardShell
                  ? "mt-1.5 max-w-2xl text-[13px] leading-snug text-slate-500 sm:text-sm"
                  : "mt-1.5 text-sm leading-snug text-slate-500"
              }
            >
              {description}
            </p>
          ) : !dashboardShell ? (
            <p className="mt-1.5 text-sm leading-snug text-slate-500">
              Placeholder — content will be wired when this area is built out.
            </p>
          ) : null}
        </div>
        {headerRight ? (
          <div className="flex w-full shrink-0 justify-stretch sm:w-auto sm:justify-end">
            {headerRight}
          </div>
        ) : null}
      </div>
      {children ? <div className={dashboardShell ? "mt-3" : "mt-6"}>{children}</div> : null}
    </>
  );

  if (dashboardShell) {
    return (
      <div className="relative min-h-dvh bg-gradient-to-b from-muted/80 to-white pb-16 md:pb-8">
        <main className={mainClass}>{body}</main>
      </div>
    );
  }

  return <main className={mainClass}>{body}</main>;
}

import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-slate-100">
      <div className="flex min-h-dvh flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10 md:py-12">
          <div className="flex w-full min-w-0 max-w-[600px] flex-col items-stretch gap-6 sm:gap-8 md:gap-10">
            {children}
          </div>
        </div>
        <p
          className="shrink-0 px-4 pb-6 pt-2 text-center text-[9px] font-medium uppercase leading-relaxed tracking-[0.22em] text-slate-400 sm:text-[10px] sm:tracking-[0.2em]"
          aria-hidden
        >
          PRECISION TRACKING • ATHLETIC EXCELLENCE • DISCIPLINE FIRST
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { PlatformSignOutButton } from "@/components/platform/PlatformSignOutButton";

type PlatformShellProps = {
  children: React.ReactNode;
};

export function PlatformShell({ children }: PlatformShellProps) {
  return (
    <div className="min-h-dvh bg-[#f4f6f8]">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/platform"
            className="flex min-w-0 flex-col gap-0.5 text-slate-900 sm:flex-row sm:items-baseline sm:gap-2"
          >
            <span className="flex items-center gap-2">
              <BrandMark size="md" />
              <span className="font-semibold tracking-tight">MallaTrack</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:pl-1">
              Platform
            </span>
          </Link>
          <PlatformSignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}

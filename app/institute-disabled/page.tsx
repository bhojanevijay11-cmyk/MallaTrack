import { INSTITUTE_DISABLED_MESSAGE } from "@/lib/auth-server";
import { PlatformSignOutButton } from "@/components/platform/PlatformSignOutButton";

export default function InstituteDisabledPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4f6f8] px-4">
      <main className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Access paused</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {INSTITUTE_DISABLED_MESSAGE}
        </p>
        <div className="mt-6 flex justify-center">
          <PlatformSignOutButton />
        </div>
      </main>
    </div>
  );
}

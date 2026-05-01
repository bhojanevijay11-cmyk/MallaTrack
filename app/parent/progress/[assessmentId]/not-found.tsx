import Link from "next/link";

export default function ParentProgressNotFound() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-10">
      <h1 className="text-lg font-bold text-slate-900">Report not available</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This progress report is not available. It may still be with your coach, or the link may be
        outdated.
      </p>
      <p className="mt-5">
        <Link
          href="/parent"
          className="text-sm font-semibold text-amber-900 underline-offset-2 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}

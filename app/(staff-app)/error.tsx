"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the staff app. Contain failures so navigation/shell can recover.
 */
export default function StaffAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[StaffAppError]", error);
    }
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Something broke on this screen</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Try again below. If it keeps happening, go back, refresh the page, and note what you last
        clicked—your session is usually still valid.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Home
        </a>
      </div>
    </div>
  );
}

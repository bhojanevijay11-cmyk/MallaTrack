"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { studentsListNavContextSuffix } from "@/lib/student-navigation-url";

export default function Student360Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  const searchParams = useSearchParams();
  const listSuffix = studentsListNavContextSuffix(searchParams);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-4 py-12">
      <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-red-900 shadow-sm">
        <h1 className="text-base font-semibold">
          This page couldn&apos;t load
        </h1>
        <p className="mt-1 text-sm text-red-800/95">
          Something went wrong while loading Student 360. Try again, or return
          to the student list.
        </p>
        {isDev ? (
          <p className="mt-2 text-xs text-red-800/80">
            Check the server terminal for{" "}
            <span className="font-mono">[student-360][...][error]</span> logs.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          Retry
        </button>
        <Link
          href={`/students${listSuffix}`}
          className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          ← Back to Students
        </Link>
      </div>
    </div>
  );
}

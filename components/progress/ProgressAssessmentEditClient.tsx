"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProgressForm } from "@/components/progress/ProgressForm";
import type { ProgressAssessmentListItem } from "@/components/progress/progress-v2-types";
import type { ProgressAssessmentDetailPayload } from "@/components/progress/review/progress-review-types";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type StudentOption = {
  id: string;
  fullName: string;
  batchName: string | null;
  batchId: string | null;
};

export function ProgressAssessmentEditClient({
  students,
  assessmentId,
}: {
  students: StudentOption[];
  assessmentId: string;
}) {
  const router = useRouter();
  const [seed, setSeed] = useState<ProgressAssessmentListItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/progress/assessments/${encodeURIComponent(assessmentId)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const data = (await res.json()) as {
          ok?: boolean;
          assessment?: ProgressAssessmentDetailPayload;
          error?: unknown;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.assessment) {
          setLoadError(
            getApiErrorMessageFromPayload(
              data,
              "This assessment could not be opened. It may have been removed or you may not have access.",
            ),
          );
          setSeed(null);
          return;
        }
        setSeed(data.assessment as ProgressAssessmentListItem);
      } catch {
        if (!cancelled) {
          setLoadError("We couldn't load this assessment. Check your connection and try again.");
          setSeed(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, reloadNonce]);

  if (loading && !seed) {
    return (
      <div className="flex flex-col items-center gap-3 py-16" aria-busy="true">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-amber-200 border-t-amber-800"
          aria-hidden
        />
        <p className="text-sm text-slate-600">Loading assessment…</p>
      </div>
    );
  }

  if (loadError || !seed) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/progress"
            className="text-sm font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            ← Back to Progress
          </Link>
        </div>
        <div className="rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-950">
          <p>{loadError ?? "Assessment not found."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="inline-flex items-center justify-center rounded-lg border border-red-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-red-950 shadow-sm hover:bg-red-50"
            >
              Try again
            </button>
            <Link
              href="/students"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Go to Students
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProgressForm
      key={seed.id}
      students={students}
      initialAssessment={seed}
      isCreate={false}
      presentation="page"
      onClose={() => router.push("/progress")}
      onRefresh={() => router.refresh()}
    />
  );
}

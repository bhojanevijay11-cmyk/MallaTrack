import { NextResponse } from "next/server";
import {
  clampMetricInt,
  decodeExpectedPerformance,
  encodePerformanceFromInts,
  metricIntFromDecodedSegment,
} from "@/lib/progress-assessment-exercise-metrics";
import { apiError } from "@/lib/api-response";

const MAX_ROWS = 40;
const MAX_NAME = 160;
const MAX_TEXT = 600;

export type ParsedAssessmentExercise = {
  exerciseName: string;
  expectedPerformance: string | null;
  observedPerformance: string | null;
  note: string | null;
  targetReps: number | null;
  targetSets: number | null;
  completedReps: number | null;
  completedSets: number | null;
};

function trimOrNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function parseOptionalMetricInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return clampMetricInt(Math.trunc(raw));
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") return null;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n)) return null;
    return clampMetricInt(n);
  }
  return null;
}

function mergeTargetMetrics(
  explicitReps: number | null,
  explicitSets: number | null,
  legacyText: string | null,
): { reps: number | null; sets: number | null; legacyOut: string | null } {
  let reps = explicitReps;
  let sets = explicitSets;
  const ep = legacyText?.trim() ? legacyText.trim().slice(0, MAX_TEXT) : null;

  if (reps === null && sets === null && ep) {
    const d = decodeExpectedPerformance(ep);
    const dr = metricIntFromDecodedSegment(d.reps);
    const ds = metricIntFromDecodedSegment(d.sets);
    if (dr !== null) reps = dr;
    if (ds !== null) sets = ds;
  }

  let legacyOut: string | null;
  if (reps !== null || sets !== null) {
    legacyOut = encodePerformanceFromInts(reps, sets);
  } else {
    legacyOut = ep ? ep : null;
  }

  return { reps, sets, legacyOut };
}

function mergeObservedMetrics(
  explicitReps: number | null,
  explicitSets: number | null,
  legacyText: string | null,
): { reps: number | null; sets: number | null; legacyOut: string | null } {
  return mergeTargetMetrics(explicitReps, explicitSets, legacyText);
}

/**
 * Parses `exercises` from API JSON. Returns 400 response on invalid input, or parsed rows.
 * Populates structured Int fields when provided; always derives or preserves legacy string fields.
 */
export function parseAssessmentExercisesInput(
  raw: unknown,
): ParsedAssessmentExercise[] | NextResponse {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    return apiError({
      code: "INVALID_EXERCISES",
      message: "exercises must be an array.",
      status: 400,
    });
  }
  if (raw.length > MAX_ROWS) {
    return apiError({
      code: "EXERCISES_LIMIT_EXCEEDED",
      message: `At most ${MAX_ROWS} exercises per assessment.`,
      status: 400,
    });
  }
  const out: ParsedAssessmentExercise[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return apiError({
        code: "INVALID_EXERCISE_ROW",
        message: "Invalid exercise row.",
        status: 400,
      });
    }
    const o = item as Record<string, unknown>;
    const name =
      typeof o.exerciseName === "string" ? o.exerciseName.trim().slice(0, MAX_NAME) : "";
    if (!name) {
      return apiError({
        code: "MISSING_EXERCISE_NAME",
        message: "Each exercise requires exerciseName.",
        status: 400,
      });
    }

    const epIn =
      typeof o.expectedPerformance === "string"
        ? trimOrNull(o.expectedPerformance.slice(0, MAX_TEXT))
        : o.expectedPerformance === null
          ? null
          : undefined;
    if (epIn === undefined && "expectedPerformance" in o && o.expectedPerformance !== undefined) {
      return apiError({
        code: "INVALID_EXPECTED_PERFORMANCE",
        message: "Invalid expectedPerformance on exercise row.",
        status: 400,
      });
    }

    const opIn =
      typeof o.observedPerformance === "string"
        ? trimOrNull(o.observedPerformance.slice(0, MAX_TEXT))
        : o.observedPerformance === null
          ? null
          : undefined;
    if (opIn === undefined && "observedPerformance" in o && o.observedPerformance !== undefined) {
      return apiError({
        code: "INVALID_OBSERVED_PERFORMANCE",
        message: "Invalid observedPerformance on exercise row.",
        status: 400,
      });
    }

    const note =
      typeof o.note === "string"
        ? trimOrNull(o.note.slice(0, MAX_TEXT))
        : o.note === null
          ? null
          : undefined;
    if (note === undefined && "note" in o && o.note !== undefined) {
      return apiError({
        code: "INVALID_EXERCISE_NOTE",
        message: "Invalid note on exercise row.",
        status: 400,
      });
    }

    const badMetric = (k: string) => {
      if (!(k in o)) return false;
      const v = o[k];
      if (v === undefined || v === null) return false;
      return parseOptionalMetricInt(v) === null;
    };
    if (
      badMetric("targetReps") ||
      badMetric("targetSets") ||
      badMetric("completedReps") ||
      badMetric("completedSets")
    ) {
      return apiError({
        code: "INVALID_EXERCISE_METRICS",
        message: "Exercise metrics must be non-negative integers or null.",
        status: 400,
      });
    }

    const trIn = parseOptionalMetricInt(o.targetReps);
    const tsIn = parseOptionalMetricInt(o.targetSets);
    const crIn = parseOptionalMetricInt(o.completedReps);
    const csIn = parseOptionalMetricInt(o.completedSets);

    const targetMerged = mergeTargetMetrics(trIn, tsIn, epIn ?? null);
    const observedMerged = mergeObservedMetrics(crIn, csIn, opIn ?? null);

    out.push({
      exerciseName: name,
      targetReps: targetMerged.reps,
      targetSets: targetMerged.sets,
      completedReps: observedMerged.reps,
      completedSets: observedMerged.sets,
      expectedPerformance: targetMerged.legacyOut,
      observedPerformance: observedMerged.legacyOut,
      note: note ?? null,
    });
  }
  return out;
}

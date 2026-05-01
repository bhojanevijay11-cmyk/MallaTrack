import {
  PROGRESS_ALERT_TYPE,
  type ProgressAlertType,
  progressAlertLabel,
} from "@/lib/progress-alerts";
import { READINESS_LEVEL, type ReadinessLevel } from "@/lib/progress-readiness";

const ALERT_SET = new Set<string>(Object.values(PROGRESS_ALERT_TYPE));
const READINESS_SET = new Set<string>(Object.values(READINESS_LEVEL));

const READINESS_FILTER_LABEL: Record<ReadinessLevel, string> = {
  [READINESS_LEVEL.NEEDS_WORK]: "Needs Work",
  [READINESS_LEVEL.DEVELOPING]: "Developing",
  [READINESS_LEVEL.NEARLY_READY]: "Nearly Ready",
  [READINESS_LEVEL.COMPETITION_READY]: "Competition Ready",
};

export type StudentsActionFilter =
  | { kind: "alert"; value: ProgressAlertType }
  | { kind: "readiness"; value: ReadinessLevel };

/** Single active filter: `alert` wins over `readiness` if both are present (multi-filter not supported). */
export function parseStudentsActionFilter(searchParams: URLSearchParams): StudentsActionFilter | null {
  const alertRaw = searchParams.get("alert")?.trim().toUpperCase() ?? "";
  if (alertRaw && ALERT_SET.has(alertRaw)) {
    return { kind: "alert", value: alertRaw as ProgressAlertType };
  }
  const readinessRaw = searchParams.get("readiness")?.trim().toUpperCase() ?? "";
  if (readinessRaw && READINESS_SET.has(readinessRaw)) {
    return { kind: "readiness", value: readinessRaw as ReadinessLevel };
  }
  return null;
}

export function studentsActionFilterChipLabel(f: StudentsActionFilter): string {
  if (f.kind === "alert") return progressAlertLabel(f.value);
  return READINESS_FILTER_LABEL[f.value];
}

export function studentsActionFilterDescription(f: StudentsActionFilter): string {
  const label = studentsActionFilterChipLabel(f);
  return f.kind === "alert"
    ? `Filtered by alert: ${label}.`
    : `Filtered by readiness: ${label}.`;
}

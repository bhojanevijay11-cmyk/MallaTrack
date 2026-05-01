import { minutesFromMidnight, parseHHmm } from "@/lib/batch-time";

export type BatchFilterChip = "all" | "morning" | "evening" | "elite";

/** Morning = start before noon; Evening = noon or later (wall-clock HH:mm). */
export function deriveTimeSlotLabel(startTime: string | null): "Morning" | "Evening" | null {
  const p = startTime ? parseHHmm(startTime) : null;
  if (!p) return null;
  return minutesFromMidnight(p) < 12 * 60 ? "Morning" : "Evening";
}

/** Uses batch name only — no schema field for "elite". */
export function isEliteFromBatchName(name: string | null | undefined): boolean {
  return /\belite\b/i.test((name ?? "").trim());
}

export function batchMatchesChip(
  batch: { startTime: string | null; name: string | null },
  chip: BatchFilterChip,
): boolean {
  if (chip === "all") return true;
  if (chip === "elite") return isEliteFromBatchName(batch.name);
  const slot = deriveTimeSlotLabel(batch.startTime);
  if (chip === "morning") return slot === "Morning";
  if (chip === "evening") return slot === "Evening";
  return true;
}

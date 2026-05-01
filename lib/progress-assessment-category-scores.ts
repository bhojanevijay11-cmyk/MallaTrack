/**
 * Category sliders (1–10) drive the overall score. Missing values use the same
 * default as the ProgressForm score sliders when a value is null (`?? 5`).
 */
export const DEFAULT_CATEGORY_SCORE = 5;

/**
 * Rounded arithmetic mean of the four category scores.
 * Uses `Math.round` (half away from zero for ties at .5 — e.g. 6.5 → 7).
 */
export function computeOverallScoreFromCategories(
  strengthScore: number | null,
  flexibilityScore: number | null,
  techniqueScore: number | null,
  disciplineScore: number | null,
): number {
  const s = strengthScore ?? DEFAULT_CATEGORY_SCORE;
  const f = flexibilityScore ?? DEFAULT_CATEGORY_SCORE;
  const t = techniqueScore ?? DEFAULT_CATEGORY_SCORE;
  const d = disciplineScore ?? DEFAULT_CATEGORY_SCORE;
  return Math.round((s + f + t + d) / 4);
}

/**
 * Read-only display: when all four categories exist, overall is always the rounded
 * mean (even if legacy `overallScore` in the DB differed). If any category is
 * missing, fall back to the stored overall for older rows.
 */
export function overallScoreForDisplay(args: {
  strengthScore: number | null;
  flexibilityScore: number | null;
  techniqueScore: number | null;
  disciplineScore: number | null;
  storedOverallScore: number | null;
}): number | null {
  const { strengthScore, flexibilityScore, techniqueScore, disciplineScore, storedOverallScore } = args;
  if (
    strengthScore !== null &&
    flexibilityScore !== null &&
    techniqueScore !== null &&
    disciplineScore !== null
  ) {
    return Math.round((strengthScore + flexibilityScore + techniqueScore + disciplineScore) / 4);
  }
  return storedOverallScore ?? null;
}

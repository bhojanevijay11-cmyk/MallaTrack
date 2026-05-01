type ScoreFields = {
  strengthScore: number | null;
  flexibilityScore: number | null;
  techniqueScore: number | null;
  disciplineScore: number | null;
  overallScore: number | null;
};

export function formatAssessmentDateYmd(iso: string): string {
  const d = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  try {
    const x = new Date(iso);
    if (!Number.isNaN(x.getTime())) {
      const y = x.getUTCFullYear();
      const m = String(x.getUTCMonth() + 1).padStart(2, "0");
      const day = String(x.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch {
    /* ignore */
  }
  return iso;
}

export function scoreSummaryFromAssessment(a: ScoreFields): string | null {
  const vals = [a.strengthScore, a.flexibilityScore, a.techniqueScore, a.disciplineScore].filter(
    (v): v is number => typeof v === "number",
  );
  if (vals.length === 0) return null;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return `~${avg.toFixed(1)} avg`;
}

/** Short label for queue rows (email local-part, humanized). */
export function coachDisplayLabelFromUser(user: { email: string } | null | undefined): string {
  if (!user?.email?.trim()) return "—";
  const local = user.email.split("@")[0]?.trim() ?? user.email.trim();
  if (!local) return "—";
  const spaced = local.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced || user.email.trim();
}

/** Submitted timestamp for triage (date in institute-agnostic YMD; list items use ISO). */
export function submittedDateLabel(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  return formatAssessmentDateYmd(iso);
}

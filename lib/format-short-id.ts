/** Shorten long cuid-style ids for dense UI; full value should be shown via title/tooltip. */
export function formatShortId(id: string | null | undefined): string | null {
  if (id == null || id === "") return null;
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-3)}`;
}

/** Lightweight placeholder while assessment lists load. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Loading list">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="h-[4.5rem] animate-pulse rounded-xl border border-slate-100 bg-slate-100/80"
        />
      ))}
    </ul>
  );
}

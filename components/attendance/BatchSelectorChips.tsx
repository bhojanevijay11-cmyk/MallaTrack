"use client";

type BatchChip = {
  id: string;
  name: string;
};

type BatchSelectorChipsProps = {
  batches: BatchChip[];
  selectedId: string;
  onSelect: (batchId: string) => void;
};

export function BatchSelectorChips({
  batches,
  selectedId,
  onSelect,
}: BatchSelectorChipsProps) {
  if (batches.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] scrollbar-thin">
      {batches.map((b) => {
        const active = b.id === selectedId;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id)}
            className={[
              "touch-manipulation shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-amber-900 text-white shadow-md shadow-amber-950/20"
                : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-amber-50/80",
            ].join(" ")}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { BatchFilters } from "@/components/batches/BatchFilters";
import type { BatchFilterChip } from "@/lib/batch-ui-derive";

type FilterProps = {
  search: string;
  onSearchChange: (value: string) => void;
  activeChip: BatchFilterChip;
  onChipChange: (chip: BatchFilterChip) => void;
};

export function BatchManagementHeader(props: FilterProps) {
  return (
    <header className="space-y-1">
      <BatchFilters {...props} />
    </header>
  );
}

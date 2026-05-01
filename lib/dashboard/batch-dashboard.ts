import type { DashboardKpis } from "@/components/admin/dashboard/mockData";

/**
 * Overlays batch KPI fields onto an existing dashboard KPI object.
 * Counts batches with status === "ACTIVE" (no schedule / day-of-week data in schema yet).
 */
export function applyBatchesToKpis(
  kpis: DashboardKpis,
  batches: readonly { status: string }[],
): DashboardKpis {
  const activeCount = batches.filter(
    (b) => (b.status ?? "").toUpperCase() === "ACTIVE",
  ).length;
  return {
    ...kpis,
    activeBatchesToday: activeCount === 0 ? null : activeCount,
    activeBatchesHint: activeCount === 0 ? "No data yet" : "Active groups",
  };
}

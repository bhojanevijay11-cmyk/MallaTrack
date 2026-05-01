import type { Student } from "@prisma/client";
import type { DashboardKpis } from "@/components/admin/dashboard/mockData";
import { EMPTY_KPIS } from "@/components/admin/dashboard/mockData";
import { formatInstantAsDdMmYyyy } from "@/lib/datetime-india";

export function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Student";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initial = last[0] ?? "";
  return `${parts[0]} ${initial}.`;
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatInstantAsDdMmYyyy(date);
}

export function buildDashboardKpisFromStudents(
  students: Pick<Student, "fullName" | "createdAt">[],
): DashboardKpis {
  const count = students.length;
  if (count === 0) {
    return { ...EMPTY_KPIS };
  }
  return {
    ...EMPTY_KPIS,
    totalActiveStudents: count,
    totalActiveStudentsHint: "Total students",
  };
}

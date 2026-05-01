import {
  pathAllowedForRole,
  roleHomePath,
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
} from "@/lib/roles";

export type StaffNavItemId =
  | "dashboard"
  | "students"
  | "batches"
  | "attendance"
  | "progress";

export type StaffNavItem = {
  id: StaffNavItemId;
  href: string;
  label: string;
};

function isStaffAppRole(
  role: string | undefined | null,
): role is typeof ROLE_ADMIN | typeof ROLE_HEAD_COACH | typeof ROLE_ASSISTANT_COACH {
  return (
    role === ROLE_ADMIN ||
    role === ROLE_HEAD_COACH ||
    role === ROLE_ASSISTANT_COACH
  );
}

/** Primary staff top nav entries; filtered by existing pathAllowedForRole rules. */
export function getStaffNavItems(role: string | undefined | null): StaffNavItem[] {
  if (!isStaffAppRole(role)) return [];

  const dashboardHref = roleHomePath(role);
  const progressHref =
    role === ROLE_ASSISTANT_COACH || role === ROLE_HEAD_COACH
      ? "/progress"
      : "/progress/review";

  const candidates: StaffNavItem[] = [
    { id: "dashboard", href: dashboardHref, label: "Dashboard" },
    { id: "students", href: "/students", label: "Students" },
    { id: "batches", href: "/batches", label: "Batches" },
    { id: "attendance", href: "/attendance", label: "Attendance" },
    { id: "progress", href: progressHref, label: "Progress" },
  ];

  return candidates.filter((item) => {
    const path = item.id === "dashboard" ? dashboardHref : item.href;
    return pathAllowedForRole(path, role);
  });
}

export function isStaffNavItemActive(
  pathname: string,
  item: StaffNavItem,
  dashboardHref: string,
): boolean {
  switch (item.id) {
    case "dashboard":
      return pathname === dashboardHref;
    case "students":
      return pathname === "/students" || pathname.startsWith("/students/");
    case "batches":
      return pathname === "/batches" || pathname.startsWith("/batches/");
    case "attendance":
      return pathname === "/attendance" || pathname.startsWith("/attendance/");
    case "progress":
      return pathname === "/progress" || pathname.startsWith("/progress/");
    default:
      return false;
  }
}

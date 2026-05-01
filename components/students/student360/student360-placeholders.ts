/**
 * Phase 1 static copy kept for reference only.
 * Live Student 360 data is composed in `lib/student-360-data.ts` (`loadStudent360ViewModel`); nothing here is rendered.
 */

export const PLACEHOLDER_STUDENT = {
  name: "Priya Sharma",
  metaLine: "Female · DOB 12 Mar 2014 · Student ID STU-2048",
  batch: "Competitive Squad — Weekday AM",
  branch: "Indiranagar",
  readinessLabel: "Nearly ready",
  lastUpdated: "Profile synced · 10 Apr 2026, 6:42 PM IST",
} as const;

export const PLACEHOLDER_SUMMARY = [
  {
    key: "attendance",
    label: "Attendance",
    value: "92%",
    hint: "Rolling 30-day (placeholder)",
  },
  {
    key: "progress",
    label: "Progress status",
    value: "On track",
    hint: "Latest assessment placeholder",
  },
  {
    key: "feedback",
    label: "Coach feedback",
    value: "2 notes",
    hint: "Awaiting parent view (placeholder)",
  },
  {
    key: "activity",
    label: "Last activity",
    value: "Today",
    hint: "Attendance marked (placeholder)",
  },
] as const;

export const PLACEHOLDER_ATTENDANCE = {
  title: "Attendance",
  subtitle: "India calendar · batch sessions",
  pct: "88%",
  weekDayLabels: ["M", "T", "W", "T", "F", "S", "S"] as const,
  /** Relative bar heights 0–1 for skeleton strip */
  weekHeights: [0.65, 0.9, 0.45, 0.88, 0.72, 0.55, 0.8] as const,
  present: "12",
  late: "2",
  absent: "1",
} as const;

export const PLACEHOLDER_PROGRESS = {
  title: "Progress",
  subtitle: "Latest approved assessment (placeholder)",
  overall: "7.4",
  indicator: "Developing",
  scores: [
    { label: "Strength", value: "7" },
    { label: "Flexibility", value: "6" },
    { label: "Technique", value: "8" },
    { label: "Discipline", value: "8" },
  ] as const,
  latestLine: "Assessment dated 08 Apr 2026 · approved by Head Coach (placeholder)",
} as const;

export const PLACEHOLDER_FEEDBACK = {
  title: "Feedback",
  subtitle: "Coach notes visible to staff (placeholder)",
  primaryNote:
    "Great focus on landings today — keep knees tracking over toes on dismount series.",
  coach: "Coach Meera N.",
  date: "09 Apr 2026",
  secondaryNote: "Reminder: bring wrist guards for floor segment next week.",
} as const;

export const PLACEHOLDER_FACTS = [
  { label: "Age group", value: "U12" },
  { label: "Training level", value: "Intermediate" },
  { label: "Assigned coach", value: "Coach Meera N." },
  { label: "Joined", value: "15 Jan 2025" },
  { label: "Next session", value: "Tue 15 Apr · 7:00 AM" },
] as const;

export const PLACEHOLDER_TIMELINE = [
  {
    title: "Attendance updated",
    detail: "Marked present · Weekday AM batch",
    time: "Today · 7:12 AM",
  },
  {
    title: "Assessment submitted",
    detail: "Progress review queued (placeholder)",
    time: "08 Apr · 4:30 PM",
  },
  {
    title: "Feedback published",
    detail: "Staff note added to profile",
    time: "06 Apr · 11:05 AM",
  },
] as const;

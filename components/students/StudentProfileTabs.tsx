"use client";

import { useEffect, useState } from "react";
import { StudentProgressSection } from "@/components/students/StudentProgressSection";

export function StudentProfileTabs({
  children,
  studentId,
  userRole,
}: {
  children: React.ReactNode;
  studentId: string;
  userRole: string;
}) {
  const [tab, setTab] = useState<"profile" | "progress">("profile");
  const [progressMounted, setProgressMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("tab") === "progress") {
      setProgressMounted(true);
      setTab("progress");
    }
  }, []);

  const goProgress = () => {
    setProgressMounted(true);
    setTab("progress");
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("profile")}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            tab === "profile"
              ? "border-amber-800 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Profile
        </button>
        <button
          type="button"
          onClick={goProgress}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            tab === "progress"
              ? "border-amber-800 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Progress
        </button>
      </div>

      {tab === "profile" ? <div className="space-y-6">{children}</div> : null}

      {progressMounted ? (
        <div className={tab === "progress" ? "space-y-6" : "hidden"}>
          <StudentProgressSection studentId={studentId} userRole={userRole} />
        </div>
      ) : null}
    </div>
  );
}

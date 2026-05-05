"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AssistantProgressV2Workspace } from "@/components/progress/AssistantProgressV2Workspace";
import type { ProgressAssessmentStatusValue } from "@/lib/progress-assessment-constants";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "@/lib/roles";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type StudentOption = {
  id: string;
  fullName: string;
  batchName: string | null;
  batchId?: string | null;
  branchLocationName?: string | null;
};

type ProgressEntryDTO = {
  id: string;
  sessionDate: string;
  technicalScore: number | null;
  tacticalScore: number | null;
  physicalScore: number | null;
  mentalScore: number | null;
  disciplineScore: number | null;
  remarks: string | null;
  targetTierLabel: string | null;
  updatedAt: string;
};

type ProgressLoadResponse =
  | { ok: true; latest: ProgressEntryDTO | null; recent: ProgressEntryDTO[] }
  | { ok: false; error?: string };

const TIERS = ["Foundation", "Development", "Performance", "Elite"] as const;

function ScoreSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-amber-900">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export function ProgressWorkspace({
  students,
  initialStudentId,
  initialBatchId,
  initialAssessmentStatusFilter = null,
  role,
}: {
  students: StudentOption[];
  initialStudentId?: string;
  /** When set (e.g. from ?batch=), narrow monitoring lists that respect batch context. */
  initialBatchId?: string;
  /** Assistant: filter assessment list (e.g. `?status=DRAFT` from dashboard). */
  initialAssessmentStatusFilter?: ProgressAssessmentStatusValue | null;
  role: string;
}) {
  const adminViewOnly = role === ROLE_ADMIN;

  if (role === ROLE_ASSISTANT_COACH || role === ROLE_HEAD_COACH) {
    const withBatch = students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      batchName: s.batchName,
      batchId: s.batchId ?? null,
      branchLocationName: s.branchLocationName ?? null,
    }));
    return (
      <AssistantProgressV2Workspace
        students={withBatch}
        initialBatchId={initialBatchId?.trim() || undefined}
        initialStatusFilter={initialAssessmentStatusFilter}
        viewerRole={role}
      />
    );
  }

  const [studentId, setStudentId] = useState(() => {
    if (initialStudentId && students.some((s) => s.id === initialStudentId)) {
      return initialStudentId;
    }
    return students[0]?.id ?? "";
  });

  const [sessionDate, setSessionDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const [technicalScore, setTechnicalScore] = useState(5);
  const [tacticalScore, setTacticalScore] = useState(5);
  const [physicalScore, setPhysicalScore] = useState(5);
  const [mentalScore, setMentalScore] = useState(5);
  const [disciplineScore, setDisciplineScore] = useState(5);
  const [remarks, setRemarks] = useState("");
  const [targetTierLabel, setTargetTierLabel] = useState("");

  const [recent, setRecent] = useState<ProgressEntryDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const selected = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  );

  const loadProgress = useCallback(async (sid: string) => {
    if (!sid) return;
    setLoadError(null);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/progress?studentId=${encodeURIComponent(sid)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as ProgressLoadResponse;
      if (!res.ok || !data.ok) {
        setLoadError("history");
        setRecent([]);
        return;
      }
      setRecent(data.recent);
      const base = data.latest;
      if (base) {
        setSessionDate(base.sessionDate);
        setTechnicalScore(base.technicalScore ?? 5);
        setTacticalScore(base.tacticalScore ?? 5);
        setPhysicalScore(base.physicalScore ?? 5);
        setMentalScore(base.mentalScore ?? 5);
        setDisciplineScore(base.disciplineScore ?? 5);
        setRemarks(base.remarks ?? "");
        setTargetTierLabel(base.targetTierLabel ?? "");
      } else {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        setSessionDate(`${y}-${m}-${day}`);
        setTechnicalScore(5);
        setTacticalScore(5);
        setPhysicalScore(5);
        setMentalScore(5);
        setDisciplineScore(5);
        setRemarks("");
        setTargetTierLabel("");
      }
    } catch {
      setLoadError("history");
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    void loadProgress(studentId);
  }, [studentId, loadProgress]);

  const onSave = async () => {
    if (!studentId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          studentId,
          sessionDate,
          technicalScore,
          tacticalScore,
          physicalScore,
          mentalScore,
          disciplineScore,
          remarks,
          targetTierLabel,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setSaveMsg(
          getApiErrorMessageFromPayload(
            data,
            "Save failed — check your connection and try again.",
          ),
        );
        return;
      }
      setSaveMsg("Progress saved.");
      await loadProgress(studentId);
    } catch {
      setSaveMsg("Save failed — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const avgRecent =
    recent.length === 0
      ? null
      : (() => {
          let sum = 0;
          let n = 0;
          for (const e of recent.slice(0, 5)) {
            const vals = [
              e.technicalScore,
              e.tacticalScore,
              e.physicalScore,
              e.mentalScore,
              e.disciplineScore,
            ].filter((v): v is number => typeof v === "number");
            for (const v of vals) {
              sum += v;
              n += 1;
            }
          }
          return n ? Math.round((sum / n) * 10) / 10 : null;
        })();

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-900">No students in scope</p>
        <p className="mt-1.5 text-sm text-slate-600">
          Assign students to your batches to record progress here.
        </p>
        <Link
          href="/students"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          View students
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_min(20rem,100%)] lg:items-start">
      <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        {adminViewOnly ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">View only.</span> Admins can review session
            progress here; recording is done by coaches in their workspaces.
          </p>
        ) : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900/90">
            Progress update
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            Session assessment
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Record criteria scores and notes for the selected student. One entry per calendar session
            date is stored.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="progress-student" className="text-xs font-semibold text-slate-500">
              Student
            </label>
            <select
              id="progress-student"
              value={studentId}
              disabled={adminViewOnly}
              onChange={(e) => setStudentId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                  {s.batchName ? ` · ${s.batchName}` : ""}
                  {s.branchLocationName?.trim()
                    ? ` · Branch: ${s.branchLocationName.trim()}`
                    : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="progress-date" className="text-xs font-semibold text-slate-500">
              Assessment date
            </label>
            <input
              id="progress-date"
              type="date"
              value={sessionDate}
              disabled={adminViewOnly}
              onChange={(e) => setSessionDate(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
        </div>

        {selected ? (
          <p className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{selected.fullName}</span>
            {selected.batchName ? (
              <>
                {" "}
                · Batch: <span className="text-slate-700">{selected.batchName}</span>
              </>
            ) : (
              <> · Unassigned</>
            )}
            {selected.branchLocationName?.trim() ? (
              <>
                {" "}
                · Branch:{" "}
                <span className="text-slate-700">{selected.branchLocationName.trim()}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="space-y-4 border-t border-slate-100 pt-4">
          <ScoreSlider
            label="Technical"
            value={technicalScore}
            onChange={setTechnicalScore}
            disabled={adminViewOnly}
          />
          <ScoreSlider
            label="Tactical awareness"
            value={tacticalScore}
            onChange={setTacticalScore}
            disabled={adminViewOnly}
          />
          <ScoreSlider
            label="Physical conditioning"
            value={physicalScore}
            onChange={setPhysicalScore}
            disabled={adminViewOnly}
          />
          <ScoreSlider
            label="Mental composure"
            value={mentalScore}
            onChange={setMentalScore}
            disabled={adminViewOnly}
          />
          <ScoreSlider
            label="Discipline & coachability"
            value={disciplineScore}
            onChange={setDisciplineScore}
            disabled={adminViewOnly}
          />
        </div>

        <div>
          <label htmlFor="progress-tier" className="text-xs font-semibold text-slate-500">
            Target tier / pathway
          </label>
          <select
            id="progress-tier"
            value={TIERS.includes(targetTierLabel as (typeof TIERS)[number]) ? targetTierLabel : ""}
            disabled={adminViewOnly}
            onChange={(e) => setTargetTierLabel(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Not set</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="progress-remarks" className="text-xs font-semibold text-slate-500">
            Coach remarks
          </label>
          <textarea
            id="progress-remarks"
            value={remarks}
            disabled={adminViewOnly}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            placeholder="Strengths, focus areas, next session goals…"
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>

        {loadError ? (
          <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            <p className="font-medium">Couldn&apos;t load session history for this student.</p>
            <p className="mt-1 text-amber-900/90">
              Check your connection, try another student, or use Try again below.
            </p>
            <button
              type="button"
              onClick={() => void loadProgress(studentId)}
              className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50"
            >
              Try again
            </button>
          </div>
        ) : null}
        {saveMsg ? (
          <p
            className={
              saveMsg.includes("failed")
                ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            }
          >
            {saveMsg}
          </p>
        ) : null}

        {adminViewOnly ? null : (
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || !studentId}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-950/15 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? "Saving…" : "Save progress"}
          </button>
        )}
      </div>

      <aside className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Summary
        </h3>
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-medium text-slate-500">Rolling average (recent entries)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {avgRecent != null ? `${avgRecent} / 10` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-medium text-slate-500">Target tier</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {targetTierLabel.trim() || recent[0]?.targetTierLabel?.trim() || "Not set"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">Recent sessions</p>
          <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm">
            {recent.length === 0 ? (
              <li className="text-slate-500">No saved entries yet.</li>
            ) : (
              recent.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2 py-1.5"
                >
                  <span className="font-medium text-slate-800">{e.sessionDate}</span>
                  <span className="text-xs text-slate-500">
                    {[e.technicalScore, e.tacticalScore, e.physicalScore, e.mentalScore, e.disciplineScore]
                      .filter((x): x is number => x != null)
                      .length
                      ? "Scored"
                      : "Notes"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}

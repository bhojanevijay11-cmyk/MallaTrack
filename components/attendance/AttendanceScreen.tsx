"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AttendanceMarkStatus } from "@/lib/attendance-status";
import {
  isAbsentStatus,
  isLateStatus,
  isStrictPresentStatus,
} from "@/lib/attendance-status";
import { formatCalendarYmdShortWeekday } from "@/lib/datetime-india";
import { BatchSelectorChips } from "@/components/attendance/BatchSelectorChips";
import { StudentAttendanceCard } from "@/components/attendance/StudentAttendanceCard";
import { AttendanceStickyBar } from "@/components/attendance/AttendanceStickyBar";
import { UnsavedChangesModal } from "@/components/attendance/UnsavedChangesModal";
import { ASSISTANT_ATTENDANCE_EDIT_WINDOW_DAYS } from "@/lib/attendance-rules";
import { getApiErrorMessageFromPayload } from "@/lib/api-client-error";

type BatchOption = {
  id: string;
  name: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  studentCount: number;
};

type StudentRow = {
  id: string;
  fullName: string;
  gender: string;
  status: AttendanceMarkStatus | null;
};

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function batchChipName(b: BatchOption): string {
  return (b.name ?? "").trim() || "Untitled batch";
}

/** Batch name + optional time range segment (no invented session labels). */
function batchScheduleSegments(
  b: BatchOption | undefined,
): { name: string; timeRange: string | null } {
  if (!b) return { name: "", timeRange: null };
  const name = batchChipName(b);
  const timeRange =
    b.startTime && b.endTime ? `${b.startTime} – ${b.endTime}` : null;
  return { name, timeRange };
}

/** Daily context line: date always first; batch name and time when available. */
function buildAttendanceSubtitle(
  dateYmd: string,
  batch: BatchOption | undefined,
): string {
  const datePart = formatCalendarYmdShortWeekday(dateYmd);
  if (!batch) return datePart;
  const { name, timeRange } = batchScheduleSegments(batch);
  if (timeRange) return `${datePart} • ${name} • ${timeRange}`;
  return `${datePart} • ${name}`;
}

/** (A) Snapshot from last successful GET /api/attendance for this batch+date. */
function savedSnapshotFromApiRows(
  rows: StudentRow[],
): Record<string, AttendanceMarkStatus | null> {
  const o: Record<string, AttendanceMarkStatus | null> = {};
  for (const s of rows) {
    o[s.id] = s.status;
  }
  return o;
}

/** (C) Dirty if working draft differs from saved snapshot for any student in roster. */
function areDraftSelectionsDirty(
  draftSelections: Record<string, AttendanceMarkStatus | null>,
  savedSelections: Record<string, AttendanceMarkStatus | null>,
  studentIds: string[],
): boolean {
  for (const id of studentIds) {
    if ((draftSelections[id] ?? null) !== (savedSelections[id] ?? null))
      return true;
  }
  return false;
}

export type AttendanceBulkSubmitPayload = {
  batchId: string;
  date: string;
  records: { studentId: string; status: AttendanceMarkStatus }[];
};

/**
 * (B → API) Build POST body from draft; returns null if roster incomplete (unmarked).
 * Keeps submit shape in one place for a future draft-persist layer.
 */
export function buildAttendanceSubmitPayload(
  batchId: string,
  dateYmd: string,
  students: StudentRow[],
  draftSelections: Record<string, AttendanceMarkStatus | null>,
): AttendanceBulkSubmitPayload | null {
  if (!batchId || !dateYmd || students.length === 0) return null;
  const records: AttendanceBulkSubmitPayload["records"] = [];
  for (const s of students) {
    const status = draftSelections[s.id];
    if (!status) return null;
    records.push({ studentId: s.id, status });
  }
  return { batchId, date: dateYmd, records };
}

/** Admin/head coach share lead-staff copy; assistants get assignment-focused wording. */
export type AttendanceStaffVariant = "assistant" | "lead_staff";

type AttendanceScreenProps = {
  defaultDateYmd: string;
  headerEyebrow: string;
  /** Reserve vertical space + lift sticky bar when assistant bottom tabs are visible (mobile). */
  reserveMobileTabBar?: boolean;
  /** Empty-state and guidance copy (does not change data access). */
  staffVariant?: AttendanceStaffVariant;
};

export function AttendanceScreen({
  defaultDateYmd,
  headerEyebrow,
  reserveMobileTabBar = false,
  staffVariant = "lead_staff",
}: AttendanceScreenProps) {
  const searchParams = useSearchParams();
  const urlBatchId = searchParams.get("batchId")?.trim() ?? "";
  const appliedUrlBatchId = useRef(false);

  const [dateYmd] = useState(defaultDateYmd);
  const [batches, setBatches] = useState<BatchOption[] | null>(null);
  const [batchId, setBatchId] = useState("");
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  /** (B) Working in-memory edits until explicit bulk submit. */
  const [draftSelections, setDraftSelections] = useState<
    Record<string, AttendanceMarkStatus | null>
  >({});
  /** (A) Last server-synced map for dirty detection / post-submit baseline. */
  const [savedSelections, setSavedSelections] = useState<
    Record<string, AttendanceMarkStatus | null>
  >({});
  const [listError, setListError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [invalidUrlBatchMessage, setInvalidUrlBatchMessage] = useState<string | null>(null);

  const loadBatches = useCallback(async (signal?: AbortSignal) => {
    setListError(null);
    try {
      const res = await fetch("/api/batches", {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; batches?: BatchOption[] };
      if (!res.ok || !data.ok || !Array.isArray(data.batches)) {
        setListError("fetch");
        setBatches([]);
        return;
      }
      const active = data.batches.filter(
        (b) => (b.status ?? "").toUpperCase() === "ACTIVE",
      );
      setBatches(active);
    } catch (e) {
      if (signal?.aborted) return;
      if (process.env.NODE_ENV === "development") {
        console.error(e);
      }
      setListError("fetch");
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    void loadBatches(c.signal);
    return () => c.abort();
  }, [loadBatches]);

  useEffect(() => {
    if (!batches?.length) return;
    if (!appliedUrlBatchId.current && urlBatchId) {
      appliedUrlBatchId.current = true;
      if (batches.some((b) => b.id === urlBatchId)) {
        setBatchId(urlBatchId);
        return;
      }
      setInvalidUrlBatchMessage(
        staffVariant === "assistant"
          ? "That batch isn’t in your assigned list. Opening the first batch you can access instead."
          : "That batch isn’t in your current list. Opening the first available batch instead.",
      );
    }
    if (!batchId || !batches.some((b) => b.id === batchId)) {
      setBatchId(batches[0].id);
    }
  }, [batches, batchId, urlBatchId, staffVariant]);

  const loadAttendance = useCallback(async () => {
    if (!batchId || !dateYmd) {
      setStudents(null);
      setDraftSelections({});
      setSavedSelections({});
      return;
    }
    setLoadError(null);
    setSuccessMsg(null);
    setSubmitError(null);
    setLoadingRoster(true);
    try {
      const q = new URLSearchParams({ batchId, date: dateYmd });
      const res = await fetch(`/api/attendance?${q}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: unknown;
        students?: StudentRow[];
      };
      if (!res.ok || !data.ok) {
        setLoadError(getApiErrorMessageFromPayload(data, "roster-fetch"));
        setStudents([]);
        setDraftSelections({});
        setSavedSelections({});
        return;
      }
      const rows = Array.isArray(data.students) ? data.students : [];
      setStudents(rows);
      const snapshot = savedSnapshotFromApiRows(rows);
      setDraftSelections(snapshot);
      setSavedSelections({ ...snapshot });
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error(e);
      }
      setLoadError("roster-fetch");
      setStudents([]);
      setDraftSelections({});
      setSavedSelections({});
    } finally {
      setLoadingRoster(false);
    }
  }, [batchId, dateYmd]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const studentIds = useMemo(() => (students ?? []).map((s) => s.id), [students]);

  const isDirty = useMemo(
    () =>
      areDraftSelectionsDirty(draftSelections, savedSelections, studentIds),
    [draftSelections, savedSelections, studentIds],
  );

  const selectedBatch = useMemo(
    () => batches?.find((b) => b.id === batchId),
    [batches, batchId],
  );

  const subtitle = useMemo(
    () => buildAttendanceSubtitle(dateYmd, selectedBatch),
    [dateYmd, selectedBatch],
  );

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let marked = 0;
    for (const id of studentIds) {
      const st = draftSelections[id];
      if (!st) continue;
      marked += 1;
      if (isStrictPresentStatus(st)) present += 1;
      else if (isAbsentStatus(st)) absent += 1;
      else if (isLateStatus(st)) late += 1;
    }
    return { present, absent, late, marked };
  }, [draftSelections, studentIds]);

  const total = studentIds.length;
  const allMarked = total > 0 && counts.marked === total;

  const noSavedMarksForDate = useMemo(() => {
    if (studentIds.length === 0) return false;
    return studentIds.every((id) => (savedSelections[id] ?? null) === null);
  }, [studentIds, savedSelections]);

  function setStudentStatus(id: string, status: AttendanceMarkStatus) {
    setDraftSelections((prev) => ({ ...prev, [id]: status }));
    setSuccessMsg(null);
    setSubmitError(null);
  }

  function requestBatchChange(nextId: string) {
    if (nextId === batchId) return;
    if (isDirty) {
      setPendingBatchId(nextId);
      setModalOpen(true);
    } else {
      setBatchId(nextId);
    }
  }

  async function submitAttendance(): Promise<boolean> {
    if (!batchId || !dateYmd || !allMarked || !students?.length) return false;
    const payload = buildAttendanceSubmitPayload(
      batchId,
      dateYmd,
      students,
      draftSelections,
    );
    if (!payload) return false;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setSubmitError(
          getApiErrorMessageFromPayload(
            data,
            "Attendance couldn't be saved. Check your connection and use Submit again on the bar below.",
          ),
        );
        return false;
      }
      setSavedSelections({ ...draftSelections });
      setSuccessMsg("Attendance saved.");
      return true;
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error(e);
      }
      setSubmitError(
        "Attendance couldn't be saved. Check your connection and use Submit again on the bar below.",
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAndSwitch() {
    setModalBusy(true);
    const ok = await submitAttendance();
    setModalBusy(false);
    if (ok && pendingBatchId) {
      setModalOpen(false);
      setBatchId(pendingBatchId);
      setPendingBatchId(null);
    }
  }

  function handleDiscardAndSwitch() {
    setModalOpen(false);
    if (pendingBatchId) {
      setBatchId(pendingBatchId);
      setPendingBatchId(null);
    }
  }

  function handleModalCancel() {
    setModalOpen(false);
    setPendingBatchId(null);
  }

  const batchChips = useMemo(
    () =>
      (batches ?? []).map((b) => ({
        id: b.id,
        name: batchChipName(b),
      })),
    [batches],
  );

  return (
    <div
      className={
        reserveMobileTabBar
          ? "pb-40 md:pb-36"
          : "pb-36"
      }
    >
      <header className="border-b border-slate-200/70 pb-2 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:pb-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-900/70">
            {headerEyebrow}
          </p>
          <h1 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            Attendance
          </h1>
          <p className="mt-0.5 text-sm font-medium leading-snug text-slate-700">
            {subtitle}
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-500">
            India calendar day for this screen:{" "}
            <span className="font-medium text-slate-600">{dateYmd}</span>
            {staffVariant === "assistant" ? (
              <>
                . Assistant coaches can submit or change attendance for dates within the last{" "}
                {ASSISTANT_ATTENDANCE_EDIT_WINDOW_DAYS} days (including today); older dates must go
                through a head coach or admin.
              </>
            ) : null}
          </p>
        </div>
      </header>

      {listError ? (
        <div className="mt-2 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Couldn&apos;t load your batch list</p>
          <p className="mt-1 text-amber-900/90">
            Check your connection, then use Try again. Without this list you can&apos;t pick a batch to
            mark attendance.
          </p>
          <button
            type="button"
            onClick={() => void loadBatches()}
            className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50"
          >
            Try again
          </button>
        </div>
      ) : null}

      {batches === null && !listError ? (
        <div
          className="mt-2 flex items-center gap-2 text-sm text-slate-600"
          aria-busy="true"
          aria-live="polite"
        >
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-amber-800"
            aria-hidden
          />
          Loading batch list…
        </div>
      ) : null}

      {invalidUrlBatchMessage ? (
        <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-sm text-amber-900">
          {invalidUrlBatchMessage}
        </p>
      ) : null}

      {batches && batches.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {staffVariant === "assistant"
              ? "No active batches assigned to you"
              : "No active batches in your view"}
          </p>
          <p className="mt-2 text-slate-600">
            {staffVariant === "assistant"
              ? "Ask your admin or head coach to assign you to a batch that has students, then refresh this page."
              : "Open Batches to create or activate a batch, and confirm branch assignments. Head coaches see their branch; admins see the full institute."}
          </p>
        </div>
      ) : null}

      {batches && batches.length > 0 ? (
        <div className="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-2 py-2 sm:px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Batch
          </p>
          <div className="mt-1 -mx-0.5">
            <BatchSelectorChips
              batches={batchChips}
              selectedId={batchId}
              onSelect={requestBatchChange}
            />
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-3 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Couldn&apos;t load roster or saved marks</p>
          <p className="mt-1 text-amber-900/90">
            {loadError !== "roster-fetch" ? loadError : "Check your connection, then try again."}
          </p>
          <p className="mt-1 text-xs text-amber-900/85">
            This screen was cleared so it doesn&apos;t show stale data. Use Try again to reload the
            roster for this batch and date.
          </p>
          <button
            type="button"
            onClick={() => void loadAttendance()}
            className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50"
          >
            Try again
          </button>
        </div>
      ) : null}

      {submitError ? (
        <div className="mt-3 rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-950">
          <p className="font-medium">Save didn&apos;t go through</p>
          <p className="mt-1 text-red-900/90">{submitError}</p>
          <p className="mt-1 text-xs text-red-900/80">
            Your marks on this screen are unchanged—nothing was saved. Fix any issue above, finish
            marking everyone if needed, then tap Submit on the bar below.
          </p>
        </div>
      ) : null}

      {successMsg ? (
        <p className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1.5 text-sm text-emerald-900">
          {successMsg} Everything on this screen now matches what was saved.
        </p>
      ) : null}

      {loadingRoster && batchId ? (
        <div className="mt-3 space-y-2" aria-busy="true" aria-live="polite">
          <p className="text-sm text-slate-600">
            Loading roster and any saved attendance for this batch and date…
          </p>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[84px] animate-pulse rounded-xl border border-slate-200/70 bg-slate-100/60 sm:h-[76px]"
            />
          ))}
        </div>
      ) : null}

      {!loadingRoster && batchId && students && students.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-700">
          <p className="font-semibold text-slate-900">No active students on this roster</p>
          <p className="mt-2 text-slate-600">
            {staffVariant === "assistant"
              ? "This batch has no active athletes to mark yet. Ask your head coach or admin to assign students to this batch, or choose another batch above."
              : "Assign active athletes to this batch under Students, or choose another batch above if attendance should be taken elsewhere."}
          </p>
        </div>
      ) : null}

      {!loadingRoster &&
      !loadError &&
      students &&
      students.length > 0 &&
      noSavedMarksForDate &&
      !isDirty ? (
        <p className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium text-slate-800">No saved marks for this date yet.</span> Mark
          each athlete below, then use <span className="font-medium">Submit Attendance</span> to save
          everyone together.
        </p>
      ) : null}

      {!loadingRoster && students && students.length > 0 ? (
        <ul className="mt-3 space-y-2 sm:space-y-2.5">
          {students.map((s) => (
            <li key={s.id}>
              <StudentAttendanceCard
                fullName={s.fullName}
                secondaryLine={[s.gender, "Student"].filter(Boolean).join(" · ")}
                initials={initialsFromName(s.fullName)}
                status={draftSelections[s.id] ?? null}
                onChange={(st) => setStudentStatus(s.id, st)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {students && students.length > 0 ? (
        <AttendanceStickyBar
          present={counts.present}
          absent={counts.absent}
          late={counts.late}
          marked={counts.marked}
          total={total}
          canSubmit={allMarked}
          submitting={submitting}
          unsavedChanges={isDirty}
          recentlySaved={Boolean(successMsg)}
          submitFailed={Boolean(submitError)}
          reserveMobileTabBar={reserveMobileTabBar}
          onSubmit={() => void submitAttendance()}
        />
      ) : null}

      <UnsavedChangesModal
        open={modalOpen}
        busy={modalBusy || submitting}
        canSave={allMarked}
        onSaveAndSwitch={() => void handleSaveAndSwitch()}
        onDiscard={handleDiscardAndSwitch}
        onCancel={handleModalCancel}
      />
    </div>
  );
}

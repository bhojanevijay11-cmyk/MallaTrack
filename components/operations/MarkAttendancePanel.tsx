"use client";

import {
  formatCalendarYmdAsDdMmYyyy,
  getIndiaTodayCalendarYmd,
} from "@/lib/datetime-india";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type BatchOption = {
  id: string;
  name: string | null;
  status: string;
  studentCount: number;
};

type StudentRow = {
  id: string;
  fullName: string;
  status: "PRESENT" | "ABSENT" | null;
};

const cardClass =
  "rounded-xl border border-slate-200/90 bg-white p-4 shadow-soft sm:p-5";

export function MarkAttendancePanel({ defaultDateYmd }: { defaultDateYmd: string }) {
  const [batches, setBatches] = useState<BatchOption[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState("");
  const [dateYmd, setDateYmd] = useState(defaultDateYmd);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const loadBatches = useCallback(async (signal?: AbortSignal) => {
    setListError(null);
    try {
      const res = await fetch("/api/batches", {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        batches?: BatchOption[];
      };
      if (!res.ok || !data.ok || !Array.isArray(data.batches)) {
        setListError("Could not load batches.");
        setBatches([]);
        return;
      }
      const active = data.batches.filter(
        (b) => (b.status ?? "").toUpperCase() === "ACTIVE",
      );
      setBatches(active);
    } catch (e) {
      if (signal?.aborted) return;
      setListError(NETWORK_RETRY_HINT);
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    void loadBatches(c.signal);
    return () => c.abort();
  }, [loadBatches]);

  const loadAttendance = useCallback(async () => {
    if (!batchId || !dateYmd) {
      setStudents(null);
      return;
    }
    setLoadError(null);
    setSaveOk(false);
    setLoadingStudents(true);
    try {
      const q = new URLSearchParams({ batchId, date: dateYmd });
      const res = await fetch(`/api/attendance?${q}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: unknown;
        students?: { id: string; fullName: string; status: "PRESENT" | "ABSENT" | null }[];
      };
      if (!res.ok || !data.ok) {
        setLoadError(getApiErrorMessageFromPayload(data, "Could not load attendance."));
        setStudents([]);
        return;
      }
      const rows = Array.isArray(data.students) ? data.students : [];
      setStudents(
        rows.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          status: r.status,
        })),
      );
    } catch {
      setLoadError(NETWORK_RETRY_HINT);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [batchId, dateYmd]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const canSave = useMemo(() => {
    if (!batchId || !dateYmd || saving) return false;
    if (!students || students.length === 0) return false;
    return students.every((s) => s.status === "PRESENT" || s.status === "ABSENT");
  }, [batchId, dateYmd, students, saving]);

  function setStatus(id: string, status: "PRESENT" | "ABSENT") {
    setStudents((prev) =>
      prev?.map((s) => (s.id === id ? { ...s, status } : s)) ?? prev,
    );
    setSaveOk(false);
  }

  async function onSave() {
    if (saving) return;
    if (!canSave || !students?.length) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const res = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          batchId,
          date: dateYmd,
          entries: students.map((s) => ({
            studentId: s.id,
            status: s.status,
          })),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setSaveError(getApiErrorMessageFromPayload(data, "Save failed."));
        return;
      }
      setSaveOk(true);
    } catch {
      setSaveError(
        `${NETWORK_RETRY_HINT} Your marks were not saved—tap save again after you are back online.`,
      );
    } finally {
      setSaving(false);
    }
  }

  const dateDisplay = formatCalendarYmdAsDdMmYyyy(dateYmd);

  return (
    <div className="space-y-5">
      {listError ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
          {listError}
        </p>
      ) : null}

      <div className={cardClass}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Session
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="text-xs font-medium text-slate-600">Batch</span>
            <select
              className="mt-1.5 w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={batches === null}
            >
              <option value="">Select batch</option>
              {(batches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.name ?? "Unnamed batch").trim() || "Unnamed batch"} ·{" "}
                  {b.studentCount} students
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="text-xs font-medium text-slate-600">
              Date (calendar day)
            </span>
            <input
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={dateYmd}
              onChange={(e) => setDateYmd(e.target.value || getIndiaTodayCalendarYmd())}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Showing as {dateDisplay} (DD/MM/YYYY)
            </span>
          </label>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Students in batch
          </p>
          <button
            type="button"
            className="rounded-lg border border-slate-200/90 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-white disabled:opacity-50"
            disabled={!batchId || !dateYmd || loadingStudents}
            onClick={() => void loadAttendance()}
          >
            Reload
          </button>
        </div>

        {loadError ? (
          <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
            {loadError}
          </p>
        ) : null}

        {loadingStudents ? (
          <p className="mt-6 text-sm text-slate-500">Loading roster…</p>
        ) : null}

        {!loadingStudents && batchId && students && students.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            No active students in this batch. Assign students from the batch
            detail page first.
          </p>
        ) : null}

        {!loadingStudents && students && students.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {students.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 text-sm font-medium text-slate-900">
                  {s.fullName}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition ${
                      s.status === "PRESENT"
                        ? "bg-secondary text-secondary-foreground ring-secondary"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setStatus(s.id, "PRESENT")}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition ${
                      s.status === "ABSENT"
                        ? "bg-slate-800 text-white ring-slate-800"
                        : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setStatus(s.id, "ABSENT")}
                  >
                    Absent
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {saveError ? (
          <p className="mt-4 rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-900">
            {saveError}
          </p>
        ) : null}
        {saveOk ? (
          <p className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
            Attendance saved for this batch and date.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
        {!canSave && students && students.length > 0 ? (
          <p className="mt-2 text-center text-[11px] text-slate-500 sm:text-right">
            Mark every student present or absent to enable save.
          </p>
        ) : null}
      </div>
    </div>
  );
}

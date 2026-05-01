"use client";

import { parseDdMmYyyyToIso } from "@/lib/dob-format";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getApiErrorMessageFromPayload, NETWORK_RETRY_HINT } from "@/lib/api-client-error";

type ParentRow = { id: string; name: string; email: string };

type BatchOption = {
  id: string;
  name: string | null;
  branchId: string | null;
};

type BranchOption = { id: string; name: string };

type CreateStudentResponse =
  | { ok: true; student: unknown }
  | { ok: false; error?: unknown };

export function NewStudentForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [parentUserId, setParentUserId] = useState("");
  const [parents, setParents] = useState<ParentRow[] | null>(null);
  const [parentsError, setParentsError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchOption[] | null>(null);
  const [branches, setBranches] = useState<BranchOption[] | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [filterBranchId, setFilterBranchId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/parents", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await res.json()) as { ok?: boolean; parents?: ParentRow[]; error?: unknown };
        if (!res.ok || !data.ok || !Array.isArray(data.parents)) {
          setParentsError(getApiErrorMessageFromPayload(data, "Could not load parent accounts."));
          setParents([]);
          return;
        }
        setParents(data.parents);
      } catch {
        setParentsError("Could not load parent accounts.");
        setParents([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [bRes, brRes] = await Promise.all([
          fetch("/api/batches", { headers: { Accept: "application/json" }, cache: "no-store" }),
          fetch("/api/branches", { headers: { Accept: "application/json" }, cache: "no-store" }),
        ]);
        const bJson = (await bRes.json()) as { ok?: boolean; batches?: BatchOption[]; error?: unknown };
        const brJson = (await brRes.json()) as { ok?: boolean; branches?: BranchOption[]; error?: unknown };
        if (!bRes.ok || !bJson.ok || !Array.isArray(bJson.batches)) {
          setBatchesError(getApiErrorMessageFromPayload(bJson, "Could not load batches."));
          setBatches([]);
        } else {
          setBatches(bJson.batches);
        }
        if (!brRes.ok || !brJson.ok || !Array.isArray(brJson.branches)) {
          setBranches([]);
        } else {
          setBranches(brJson.branches);
        }
      } catch {
        setBatchesError("Could not load batches.");
        setBatches([]);
        setBranches([]);
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    const dobTrim = dob.trim();
    const dobCheck = parseDdMmYyyyToIso(dobTrim);
    if (!dobCheck.ok) {
      setErrorMessage(dobCheck.message);
      return;
    }

    if (!batchId.trim()) {
      setErrorMessage("Please assign this student to a batch.");
      return;
    }

    const payload: Record<string, unknown> = {
      fullName: fullName.trim(),
      dob: dobTrim,
      gender: gender.trim(),
      batchId: batchId.trim(),
      parentName: parentName.trim() || undefined,
      parentPhone: parentPhone.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
    };
    if (parentUserId.trim() !== "") {
      payload.parentUserId = parentUserId.trim();
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CreateStudentResponse & { error?: unknown };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          getApiErrorMessageFromPayload(data, "Failed to create student."),
        );
        return;
      }

      router.push("/students");
      router.refresh();
    } catch {
      setErrorMessage(`${NETWORK_RETRY_HINT} The student was not created.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredBatches = (batches ?? []).filter((b) => {
    if (!filterBranchId.trim()) return true;
    return b.branchId === filterBranchId.trim();
  });

  const noBatchesLoaded = batches !== null && batches.length === 0;

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {errorMessage ? <p className="text-sm text-amber-700">{errorMessage}</p> : null}
      {batchesError ? <p className="text-sm text-amber-700">{batchesError}</p> : null}
      {noBatchesLoaded ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          No batches found. Create a batch with a branch before adding students.
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="fullName"
          className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          required
        />
      </div>

      {(branches?.length ?? 0) > 1 ? (
        <div className="space-y-2">
          <label
            htmlFor="newStudentBranchFilter"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Filter batches by branch (optional)
          </label>
          <select
            id="newStudentBranchFilter"
            value={filterBranchId}
            onChange={(e) => {
              setFilterBranchId(e.target.value);
              setBatchId("");
            }}
            disabled={isSubmitting || batches === null}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
          >
            <option value="">All branches</option>
            {(branches ?? []).map((br) => (
              <option key={br.id} value={br.id}>
                {br.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <label
          htmlFor="newStudentBatch"
          className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Batch <span className="text-red-600">*</span>
        </label>
        <select
          id="newStudentBatch"
          name="batchId"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          required
          disabled={isSubmitting || batches === null || noBatchesLoaded}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
        >
          <option value="">Select a batch…</option>
          {filteredBatches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name?.trim() || "Untitled batch"}
            </option>
          ))}
        </select>
        {!batchId.trim() ? (
          <p className="text-xs text-amber-800">Please assign this student to a batch.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="dob"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Date of birth (DD/MM/YYYY)
          </label>
          <input
            id="dob"
            name="dob"
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="DD/MM/YYYY"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="gender"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Gender
          </label>
          <input
            id="gender"
            name="gender"
            type="text"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="parentName"
          className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Parent name (optional)
        </label>
        <input
          id="parentName"
          name="parentName"
          type="text"
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="parentPhone"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Parent phone (optional)
          </label>
          <input
            id="parentPhone"
            name="parentPhone"
            type="text"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="emergencyContact"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
          >
            Emergency contact (optional)
          </label>
          <input
            id="emergencyContact"
            name="emergencyContact"
            type="text"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="parentUserId"
          className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
        >
          Linked Parent Account
        </label>
        {parentsError ? (
          <p className="text-sm text-amber-700">{parentsError}</p>
        ) : null}
        <select
          id="parentUserId"
          name="parentUserId"
          value={parentUserId}
          onChange={(e) => setParentUserId(e.target.value)}
          disabled={parents === null}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
        >
          <option value="">No parent linked</option>
          {(parents ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || batches === null || noBatchesLoaded || !batchId.trim()}
        className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : "Create student"}
      </button>
    </form>
  );
}


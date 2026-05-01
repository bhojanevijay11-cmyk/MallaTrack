"use client";

type UnsavedChangesModalProps = {
  open: boolean;
  onSaveAndSwitch: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  busy: boolean;
  canSave: boolean;
};

export function UnsavedChangesModal({
  open,
  onSaveAndSwitch,
  onDiscard,
  onCancel,
  busy,
  canSave,
}: UnsavedChangesModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl">
        <h2 id="unsaved-title" className="text-lg font-semibold text-slate-900">
          Unsaved changes
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          You have unsaved attendance changes. Anything already saved for this date stays on the
          server—Discard only clears edits on this screen.
        </p>
        {!canSave ? (
          <p className="mt-2 text-xs text-amber-800">
            Mark every student before saving, or choose Discard to switch batches.
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onSaveAndSwitch}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save and switch"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDiscard}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

/** Label + value block for stacked mobile preview cards. */
export function MobileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <div className="mt-0.5 min-w-0 break-words text-sm text-slate-800">
        {children}
      </div>
    </div>
  );
}

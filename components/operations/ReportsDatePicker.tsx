"use client";

import { useRouter } from "next/navigation";

export function ReportsDatePicker({ valueYmd }: { valueYmd: string }) {
  const router = useRouter();
  return (
    <label className="flex min-w-0 flex-col gap-1.5 sm:max-w-xs">
      <span className="text-xs font-medium text-slate-600">Report date (India calendar day)</span>
      <input
        type="date"
        className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        value={valueYmd}
        onChange={(e) => {
          const v = e.target.value;
          if (v) router.push(`/reports?date=${encodeURIComponent(v)}`);
        }}
      />
    </label>
  );
}

import type { Student360ViewModel } from "@/lib/student-360-data";
import { Student360IdentityHeader } from "@/components/students/student360/Student360IdentityHeader";
import { Student360MainGrid } from "@/components/students/student360/Student360MainGrid";
import { Student360SummaryStrip } from "@/components/students/student360/Student360SummaryStrip";

export function Student360Shell({ data }: { data: Student360ViewModel }) {
  return (
    <div className="space-y-1.5 pb-3 sm:space-y-2 sm:pb-4">
      <Student360IdentityHeader identity={data.identity} />
      <Student360SummaryStrip summary={data.summary} />
      <Student360MainGrid data={data} />
    </div>
  );
}

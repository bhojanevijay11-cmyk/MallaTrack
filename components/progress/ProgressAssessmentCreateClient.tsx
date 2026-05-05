"use client";

import { useRouter } from "next/navigation";
import { ProgressForm } from "@/components/progress/ProgressForm";

type StudentOption = {
  id: string;
  fullName: string;
  batchName: string | null;
  batchId: string | null;
  branchLocationName?: string | null;
};

export function ProgressAssessmentCreateClient({
  students,
  defaultStudentId,
}: {
  students: StudentOption[];
  defaultStudentId?: string;
}) {
  const router = useRouter();

  return (
    <ProgressForm
      key="create"
      students={students}
      defaultStudentId={defaultStudentId?.trim() || undefined}
      initialAssessment={null}
      isCreate
      presentation="page"
      onClose={() => router.push("/progress")}
      onRefresh={() => router.refresh()}
    />
  );
}

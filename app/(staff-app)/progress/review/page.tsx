import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { HeadCoachProgressReviewWorkspace } from "@/components/progress/review/HeadCoachProgressReviewWorkspace";
import { authOptions } from "@/lib/auth";
import {
  parseProgressAssessmentStatus,
  PROGRESS_ASSESSMENT_STATUS,
} from "@/lib/progress-assessment-constants";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH, roleHomePath } from "@/lib/roles";
import type { ProgressReviewQueueMode } from "@/components/progress/review/HeadCoachProgressReviewWorkspace";

export default async function ProgressReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/progress/review");
  }

  const role = session.user.role;
  if (role === ROLE_ASSISTANT_COACH) {
    redirect("/progress");
  }
  if (role !== ROLE_HEAD_COACH && role !== ROLE_ADMIN) {
    redirect(roleHomePath(role));
  }

  const sp = await searchParams;
  const statusParam = sp.status?.trim() ?? "";
  const parsedStatus = statusParam ? parseProgressAssessmentStatus(statusParam) : null;
  const invalidStatusQuery = Boolean(statusParam) && parsedStatus === null;

  let queueMode: ProgressReviewQueueMode = "all";
  if (!invalidStatusQuery && parsedStatus === PROGRESS_ASSESSMENT_STATUS.PENDING_REVIEW) {
    queueMode = "pending";
  } else if (!invalidStatusQuery && parsedStatus === PROGRESS_ASSESSMENT_STATUS.NEEDS_REVISION) {
    queueMode = "revision";
  }

  const instituteId = session.user.instituteId;
  if (!instituteId) {
    return (
      <NavPlaceholder
        title="Progress Review"
        description="Review assessments submitted for review in your scope."
        tenantLine={session.user.instituteName?.trim() || null}
        maxWidth="wide"
        dashboardShell
        showBackLink={false}
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your account is not linked to an institute. Progress review cannot be loaded.
        </p>
      </NavPlaceholder>
    );
  }

  const description =
    role === ROLE_ADMIN
      ? "Institute-wide queue: approve assessments or send them back for revision — without changing scores or notes yourself."
      : "Approve assessments or send them back for revision — without changing scores or notes yourself.";

  return (
    <NavPlaceholder
      title="Progress Review"
      description={description}
      tenantLine={session.user.instituteName?.trim() || null}
      maxWidth="wide"
      dashboardShell
      showBackLink={false}
    >
      {invalidStatusQuery ? (
        <p className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
          Unknown progress status{" "}
          <span className="font-mono text-[13px]">{statusParam}</span>. Showing the{" "}
          <span className="font-medium">combined review queue</span> instead. For a focused list, use{" "}
          <span className="font-mono text-[13px]">PENDING_REVIEW</span> or{" "}
          <span className="font-mono text-[13px]">NEEDS_REVISION</span>.
        </p>
      ) : null}
      <HeadCoachProgressReviewWorkspace queueMode={invalidStatusQuery ? "all" : queueMode} />
    </NavPlaceholder>
  );
}

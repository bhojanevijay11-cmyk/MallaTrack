import { AssistantCoachDashboard } from "@/components/assistant-coach/AssistantCoachDashboard";
import { authOptions } from "@/lib/auth";
import { getProgressAlertCountsForUser } from "@/lib/progress-alerts-queries";
import { ROLE_ASSISTANT_COACH } from "@/lib/roles";
import { getServerSession } from "next-auth/next";

export default async function AssistantCoachHomePage() {
  const session = await getServerSession(authOptions);
  const instituteId = session?.user?.instituteId ?? null;
  const userId = session?.user?.id?.trim() ?? "";

  let initialProgressAlerts = null;
  if (session?.user?.role === ROLE_ASSISTANT_COACH && instituteId && userId) {
    initialProgressAlerts = await getProgressAlertCountsForUser({
      id: userId,
      role: ROLE_ASSISTANT_COACH,
      branchId: session.user.branchId ?? null,
      instituteId,
    });
  }

  return <AssistantCoachDashboard initialProgressAlerts={initialProgressAlerts} />;
}

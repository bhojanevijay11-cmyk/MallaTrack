import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AttendanceAppShell } from "@/components/attendance/AttendanceAppShell";
import { AttendanceScreen } from "@/components/attendance/AttendanceScreen";
import { authOptions } from "@/lib/auth";
import { getIndiaTodayCalendarYmd } from "@/lib/datetime-india";
import {
  ROLE_ADMIN,
  ROLE_ASSISTANT_COACH,
  ROLE_HEAD_COACH,
  roleHomePath,
} from "@/lib/roles";

export default async function AttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/attendance");
  }
  const role = session.user.role;
  if (
    role !== ROLE_HEAD_COACH &&
    role !== ROLE_ASSISTANT_COACH &&
    role !== ROLE_ADMIN
  ) {
    redirect(roleHomePath(role));
  }

  const todayYmd = getIndiaTodayCalendarYmd();
  const defaultDateYmd = todayYmd;
  const attendanceEyebrow =
    defaultDateYmd === todayYmd ? "TODAY'S ATTENDANCE" : "DAILY ATTENDANCE";
  return (
    <AttendanceAppShell role={role}>
      <AttendanceScreen
        defaultDateYmd={defaultDateYmd}
        headerEyebrow={attendanceEyebrow}
        reserveMobileTabBar={role === ROLE_ASSISTANT_COACH}
        staffVariant={
          role === ROLE_ASSISTANT_COACH ? "assistant" : "lead_staff"
        }
      />
    </AttendanceAppShell>
  );
}

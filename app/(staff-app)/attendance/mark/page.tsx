import { redirect } from "next/navigation";

/** Legacy route — unified attendance lives at `/attendance`. */
export default function MarkAttendanceRedirectPage() {
  redirect("/attendance");
}

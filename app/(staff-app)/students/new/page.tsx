import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { NavPlaceholder } from "@/components/admin/NavPlaceholder";
import { NewStudentForm } from "@/components/students/NewStudentForm";
import { authOptions } from "@/lib/auth";
import { ROLE_ASSISTANT_COACH } from "@/lib/roles";

export default async function NewStudentPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role === ROLE_ASSISTANT_COACH) {
    redirect("/assistant-coach");
  }
  return (
    <NavPlaceholder
      title="Add student"
      description="Enroll a new athlete — enter details below."
      tenantLine={session?.user?.instituteName?.trim() || null}
      showBackLink={false}
    >
      <NewStudentForm />
    </NavPlaceholder>
  );
}

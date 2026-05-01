import React from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { BrandHeader } from "@/components/auth/BrandHeader";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell>
      <main className="flex w-full min-w-0 flex-col gap-5 sm:gap-6">
        <BrandHeader />
        <RegisterForm />
      </main>
    </AuthShell>
  );
}

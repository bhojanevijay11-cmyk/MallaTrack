"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

type AuthProvidersProps = {
  children: ReactNode;
};

export function AuthProviders({ children }: AuthProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}

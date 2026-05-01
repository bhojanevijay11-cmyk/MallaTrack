import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { AuthProviders } from "@/components/auth/AuthProviders";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MallaTrack",
  description: "Athletic programs, tracked with discipline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body
        className={`${sans.className} min-h-dvh overflow-x-hidden antialiased`}
      >
        <AuthProviders>{children}</AuthProviders>
      </body>
    </html>
  );
}

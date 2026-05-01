import type { NextConfig } from "next";

function isProdHttps(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const url = process.env.NEXTAUTH_URL;
  return typeof url === "string" && url.startsWith("https://");
}

function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const connectSrc = isDev ? "connect-src 'self' ws:" : "connect-src 'self'";

  // Keep intentionally compatible with Next.js; tighten later with nonces/hashes.
  const parts = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    connectSrc,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ];
  return parts.join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()",
          "interest-cohort=()",
        ].join(", "),
      },
      { key: "Content-Security-Policy", value: buildCsp() },
      // Extra defense-in-depth for older clients (CSP frame-ancestors is primary).
      { key: "X-Frame-Options", value: "DENY" },
    ];

    if (isProdHttps()) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

export default nextConfig;

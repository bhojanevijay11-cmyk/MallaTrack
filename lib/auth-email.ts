/**
 * Optional Resend integration for transactional email.
 * Set RESEND_API_KEY and AUTH_EMAIL_FROM (e.g. "MallaTrack <onboarding@example.com>").
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

async function throwIfResendNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const responseBody = await res.text().catch(() => "");
  throw new Error(
    `Resend request failed (${res.status}): ${responseBody.slice(0, 500)}`,
  );
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.AUTH_EMAIL_FROM?.trim(),
  );
}

export async function sendParentInviteEmail(to: string, inviteUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Email provider is not configured.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Complete your MallaTrack parent account",
      html: `<p>You’ve been invited to access your child’s progress in MallaTrack.</p><p><a href="${escapeHtmlAttr(inviteUrl)}">Set your password</a></p><p>This link expires in 7 days and can only be used once.</p><p>If you did not expect this, you can ignore this email.</p>`,
    }),
  });

  await throwIfResendNotOk(res);
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Email provider is not configured.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your MallaTrack password",
      html: `<p>You requested a password reset for your MallaTrack account.</p><p><a href="${escapeHtmlAttr(resetUrl)}">Set a new password</a></p><p>This link expires in 60 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  });

  await throwIfResendNotOk(res);
}

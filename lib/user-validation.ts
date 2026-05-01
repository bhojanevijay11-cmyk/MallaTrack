import type { RoleTab } from "@/components/auth/types";

const ALLOWED_ROLES: RoleTab[] = [
  "admin",
  "head_coach",
  "assistant_coach",
  "parent",
];

/** Roles allowed on the public registration form (admin is seed / ops only). */
export const REGISTRATION_ALLOWED_ROLES: readonly RoleTab[] = [
  "head_coach",
  "assistant_coach",
];

export function isPublicRegistrationRole(role: RoleTab): boolean {
  return (REGISTRATION_ALLOWED_ROLES as readonly string[]).includes(role);
}

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailShape(email: string): boolean {
  const n = normalizeEmail(email);
  return n.length > 0 && n.length <= 320 && EMAIL_RE.test(n);
}

export function validatePassword(password: string): { ok: true } | { ok: false; message: string } {
  if (!password || password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password is too long." };
  }
  return { ok: true };
}

export function parseRole(role: string): RoleTab | null {
  if (ALLOWED_ROLES.includes(role as RoleTab)) {
    return role as RoleTab;
  }
  return null;
}

export function validateRegisterPayload(input: {
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}): { ok: true; email: string; password: string; role: RoleTab } | { ok: false; message: string } {
  const email = normalizeEmail(input.email);
  if (!email) {
    return { ok: false, message: "Email is required." };
  }
  if (!isValidEmailShape(input.email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const pw = validatePassword(input.password);
  if (!pw.ok) return pw;
  if (input.password !== input.confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }
  const role = parseRole(input.role);
  if (!role) {
    return { ok: false, message: "Select a valid role." };
  }
  if (role === "parent") {
    return {
      ok: false,
      message: "Parent accounts are created when your academy sends you an invite.",
    };
  }
  if (!isPublicRegistrationRole(role)) {
    return {
      ok: false,
      message: "This role cannot be created through public registration.",
    };
  }
  return { ok: true, email, password: input.password, role };
}

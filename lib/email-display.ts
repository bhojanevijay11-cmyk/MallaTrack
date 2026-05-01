/** Display label when User has no separate name column (email-based accounts). */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : email.trim();
}

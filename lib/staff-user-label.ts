/** Display name for staff User rows (invite full name when available, else email). */
export function staffUserLabel(user: {
  email: string;
  invitesReceived: { fullName: string }[];
}): string {
  const fn = user.invitesReceived[0]?.fullName?.trim();
  return fn || user.email;
}

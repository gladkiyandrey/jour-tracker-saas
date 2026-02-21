export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw.trim()) return false;
  const allow = raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}

import { cookies } from "next/headers";

export const AUTH_COOKIE = "jour_session";
export const SUB_STATUS_COOKIE = "jour_subscription_status";
export const SUB_EXPIRES_COOKIE = "jour_subscription_expires_at";

export async function getSessionEmail() {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value ?? null;
}

export async function getSubscriptionState() {
  const store = await cookies();
  const status = store.get(SUB_STATUS_COOKIE)?.value ?? "inactive";
  const expiresAt = store.get(SUB_EXPIRES_COOKIE)?.value;

  if (status !== "active" || !expiresAt) {
    return { active: false, expiresAt: null as string | null };
  }

  const expiresTime = Date.parse(expiresAt);
  if (Number.isNaN(expiresTime) || expiresTime <= Date.now()) {
    return { active: false, expiresAt: expiresAt ?? null };
  }

  return { active: true, expiresAt };
}

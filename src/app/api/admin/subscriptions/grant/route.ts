import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { isAdminEmail } from "@/lib/admin-auth";
import { grantTrialSubscription, resolveUserByTarget } from "@/lib/subscription-store";

function redirectWith(url: URL, params: Record<string, string>) {
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return NextResponse.redirect(url);
}

export async function POST(req: Request) {
  const current = await getCurrentUser();
  const base = new URL(req.url);
  const redirectUrl = new URL("/admin/subscriptions", `${base.protocol}//${base.host}`);

  if (!current) {
    return redirectWith(redirectUrl, { grantError: "Unauthorized" });
  }
  if (!isAdminEmail(current.email)) {
    return redirectWith(redirectUrl, { grantError: "Forbidden" });
  }

  try {
    const form = await req.formData();
    const target = String(form.get("target") ?? "").trim();
    const daysRaw = String(form.get("days") ?? "");
    const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
    const days = daysRaw === "1" || daysRaw === "7" || daysRaw === "30" ? (Number(daysRaw) as 1 | 7 | 30) : null;

    if (!target || !days) {
      return redirectWith(redirectUrl, { grantError: "Заполните пользователя и срок доступа" });
    }

    const resolved = await resolveUserByTarget(target);
    const result = await grantTrialSubscription({
      targetUserId: resolved.userId,
      grantedByUserId: current.id,
      days,
      reason,
    });

    return redirectWith(redirectUrl, {
      grantOk: `Выдано ${days} дн. для ${resolved.email} до ${new Date(result.expiresAt).toLocaleString("ru-RU")}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Grant failed";
    return redirectWith(redirectUrl, { grantError: msg.slice(0, 180) });
  }
}

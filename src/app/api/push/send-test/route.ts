import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getPushSubscriptionsByUser, removePushSubscription } from "@/lib/push-store";
import { sendWebPush } from "@/lib/push";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const subscriptions = await getPushSubscriptionsByUser(user.id);
    if (!subscriptions.length) {
      return NextResponse.json({ error: "No push subscriptions" }, { status: 400 });
    }

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await sendWebPush(sub, {
          title: "Consist reminder",
          body: "If today was a trading day, add your entry in the tracker.",
          url: "/app",
        });
        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(user.id, sub.endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

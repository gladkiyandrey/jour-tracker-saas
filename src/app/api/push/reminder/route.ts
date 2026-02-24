import { NextResponse } from "next/server";
import { getAllPushSubscriptions, removePushSubscription } from "@/lib/push-store";
import { sendWebPush } from "@/lib/push";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") || "";

  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscriptions = await getAllPushSubscriptions();
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await sendWebPush(sub, {
          title: "Consist reminder",
          body: "If today was a trading day, add your result, deposit and trades.",
          url: "/app",
        });
        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(sub.userId, sub.endpoint);
        }
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

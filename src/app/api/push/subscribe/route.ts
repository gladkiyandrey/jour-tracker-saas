import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { upsertPushSubscription } from "@/lib/push-store";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      subscription?: {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
    };

    const endpoint = String(body?.subscription?.endpoint ?? "");
    const p256dh = String(body?.subscription?.keys?.p256dh ?? "");
    const auth = String(body?.subscription?.keys?.auth ?? "");

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    await upsertPushSubscription(user.id, {
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

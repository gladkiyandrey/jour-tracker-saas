import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { removePushSubscription } from "@/lib/push-store";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { endpoint?: string };
    const endpoint = String(body?.endpoint ?? "");

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
    }

    await removePushSubscription(user.id, endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createShareSnapshot, type SharePayload } from "@/lib/share-store";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as SharePayload;
    const { id } = await createShareSnapshot(user.id, payload);

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      id,
      url: `${origin}/s/${id}`,
      verifyUrl: `${origin}/share/verify/${id}`,
      qrUrl: `${origin}/api/share/qr/${id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

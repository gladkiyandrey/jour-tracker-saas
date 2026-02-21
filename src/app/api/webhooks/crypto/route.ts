import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const signature = req.headers.get("x-provider-signature") || "";
  const expected = process.env.CRYPTO_WEBHOOK_SECRET || "";

  if (!expected || signature !== expected) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const payload = await req.json();

  // TODO: Persist payment status in DB and activate subscription for the user.
  return NextResponse.json({ ok: true, received: payload?.event ?? "unknown" });
}

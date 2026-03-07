import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getUserSettings, isValidTimeZone, upsertUserSettings } from "@/lib/user-settings-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getUserSettings(user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { timezone?: string };
  const timezone = String(body.timezone || "").trim();
  if (!timezone || !isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Valid timezone is required" }, { status: 400 });
  }

  try {
    const settings = await upsertUserSettings(user.id, { timezone });
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

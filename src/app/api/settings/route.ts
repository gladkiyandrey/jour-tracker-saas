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

  const body = (await req.json()) as { timezone?: string; startDeposit?: number | string };
  const timezone = String(body.timezone || "").trim();
  const startDeposit = Number(body.startDeposit);
  if (!timezone || !isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Valid timezone is required" }, { status: 400 });
  }
  if (!Number.isFinite(startDeposit) || startDeposit <= 0) {
    return NextResponse.json({ error: "Valid start deposit is required" }, { status: 400 });
  }

  try {
    const settings = await upsertUserSettings(user.id, { timezone, startDeposit });
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

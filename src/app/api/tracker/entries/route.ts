import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getTrackerData, upsertTrackerEntry } from "@/lib/tracker-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getTrackerData(user.id);
    return NextResponse.json({ data });
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

  const body = (await req.json()) as {
    dateKey?: string;
    result?: -1 | 1;
    variant?: "neg" | "pos" | "pos-outline";
    deposit?: number;
    trades?: number;
  };

  if (!body.dateKey) {
    return NextResponse.json({ error: "dateKey is required" }, { status: 400 });
  }

  try {
    const entry = await upsertTrackerEntry(user.id, body.dateKey, {
      result: body.result,
      variant: body.variant,
      deposit: body.deposit,
      trades: body.trades,
    });
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUserEmail } from "@/lib/current-user";
import { getTrackerData, upsertTrackerEntry } from "@/lib/tracker-store";

export async function GET() {
  const email = await getCurrentUserEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getTrackerData(email);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const email = await getCurrentUserEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    dateKey?: string;
    result?: -1 | 1;
    variant?: "neg" | "pos" | "pos-outline";
    deposit?: number;
  };

  if (!body.dateKey) {
    return NextResponse.json({ error: "dateKey is required" }, { status: 400 });
  }

  try {
    const entry = await upsertTrackerEntry(email, body.dateKey, {
      result: body.result,
      variant: body.variant,
      deposit: body.deposit,
    });
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

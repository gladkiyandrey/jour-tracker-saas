import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { deleteJournalEntry, listJournalEntries, upsertJournalEntry } from "@/lib/journal-store";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await listJournalEntries(user.id);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const entry = await upsertJournalEntry(user.id, body);
    return NextResponse.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { dateKey?: string };
    const dateKey = String(body?.dateKey ?? "");
    if (!dateKey) return NextResponse.json({ error: "dateKey is required" }, { status: 400 });
    await deleteJournalEntry(user.id, dateKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "TWELVE_DATA_API_KEY is missing" }, { status: 500 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (q.length < 1) {
      return NextResponse.json({ items: [] });
    }

    const upstream = new URL("https://api.twelvedata.com/symbol_search");
    upstream.searchParams.set("symbol", q);
    upstream.searchParams.set("outputsize", "15");
    upstream.searchParams.set("apikey", apiKey);

    const res = await fetch(upstream.toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: `Twelve Data HTTP ${res.status}` }, { status: 502 });
    }

    const raw = (await res.json()) as {
      data?: Array<{
        symbol?: string;
        instrument_name?: string;
        exchange?: string;
        currency?: string;
      }>;
      status?: string;
      message?: string;
    };

    if (raw.status === "error") {
      return NextResponse.json({ error: raw.message || "Twelve Data error" }, { status: 400 });
    }

    const items = (raw.data || [])
      .filter((x) => x.symbol)
      .slice(0, 12)
      .map((x) => ({
        symbol: x.symbol as string,
        name: x.instrument_name || "",
        exchange: x.exchange || "",
      }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search symbols";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

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
    upstream.searchParams.set("outputsize", "100");
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
        type?: string;
      }>;
      status?: string;
      message?: string;
    };

    if (raw.status === "error") {
      return NextResponse.json({ error: raw.message || "Twelve Data error" }, { status: 400 });
    }

    const normalizedQ = q.toUpperCase();

    const items = (raw.data || [])
      .filter((x) => x.symbol)
      .sort((a, b) => {
        const as = (a.symbol || "").toUpperCase();
        const bs = (b.symbol || "").toUpperCase();
        const aStarts = as.startsWith(normalizedQ) ? 1 : 0;
        const bStarts = bs.startsWith(normalizedQ) ? 1 : 0;
        if (aStarts !== bStarts) {
          return bStarts - aStarts;
        }
        return as.localeCompare(bs);
      })
      .slice(0, 60)
      .map((x) => ({
        symbol: x.symbol as string,
        name: x.instrument_name || "",
        exchange: x.exchange || "",
        currency: x.currency || "",
        type: (x.type || "").toLowerCase(),
      }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search symbols";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

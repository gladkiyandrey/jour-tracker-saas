import { NextResponse } from "next/server";

const ALLOWED_TYPE_WORDS = ["forex", "index", "indices", "commodity", "metals", "metal", "cfd"];
const BLOCKED_NAME_WORDS = [
  "warrant",
  "option",
  "future",
  "futures",
  "fund",
  "etf",
  "etn",
  "bond",
  "certificate",
  "rights",
  "note",
  "swap",
];

function isLikelyTradableSpotSymbol(symbol: string) {
  const s = symbol.toUpperCase();
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return true; // EUR/USD
  if (/^[A-Z]{6}$/.test(s)) return true; // EURUSD
  if (/^[A-Z]{2,5}\d{1,4}$/.test(s)) return true; // GER40, US500, NAS100
  if (/^X(AU|AG|PT|PD)\/USD$/.test(s)) return true; // metals
  return false;
}

function matchesAllowedType(type: string) {
  const t = (type || "").toLowerCase();
  if (!t) return false;
  return ALLOWED_TYPE_WORDS.some((w) => t.includes(w));
}

function containsBlockedName(name: string) {
  const n = (name || "").toLowerCase();
  if (!n) return false;
  return BLOCKED_NAME_WORDS.some((w) => n.includes(w));
}

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
      .filter((x) => {
        const symbol = (x.symbol || "").trim();
        const type = (x.type || "").trim();
        const name = (x.instrument_name || "").trim();

        if (!symbol) return false;
        if (!matchesAllowedType(type) && !isLikelyTradableSpotSymbol(symbol)) return false;
        if (containsBlockedName(name)) return false;
        return true;
      })
      .sort((a, b) => {
        const as = (a.symbol || "").toUpperCase();
        const bs = (b.symbol || "").toUpperCase();

        const aStarts = as.startsWith(normalizedQ) ? 2 : as.includes(normalizedQ) ? 1 : 0;
        const bStarts = bs.startsWith(normalizedQ) ? 2 : bs.includes(normalizedQ) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        const aGood = isLikelyTradableSpotSymbol(as) ? 1 : 0;
        const bGood = isLikelyTradableSpotSymbol(bs) ? 1 : 0;
        if (aGood !== bGood) return bGood - aGood;

        return as.localeCompare(bs, "en");
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

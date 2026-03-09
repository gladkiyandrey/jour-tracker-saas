import { NextResponse } from "next/server";
import { canonicalSymbol, curatedItemsForQuery, symbolVariants } from "@/lib/trade-share-symbol-catalog";

const ALLOWED_TYPE_WORDS = ["forex", "cryptocurrency"];
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
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE)\/USD$/.test(s)) return true; // crypto
  return false;
}

function isSupportedTradeShareSymbol(symbol: string) {
  const s = canonicalSymbol(symbol);
  if (!s) return false;
  if (s === "XAUUSD") return true;
  if (/^XAU/.test(s)) return false;
  if (/^X(AG|PT|PD|CU|NI)/.test(s)) return false;
  if (/^(GER|DE|DAX|US30|US100|US500|SPX|NAS|NDX|DJI|DJ30|FTSE|UK100|JP225|NIKKEI|HK50|HSI|AU200|ASX200|ESP35|IBEX35|EU50|ESTX50)/.test(s)) {
    return false;
  }
  if (/^[A-Z]{6}$/.test(s)) return true; // forex like EURUSD
  if (/^[A-Z]{3}USD$/.test(s) && /^(BTC|ETH|SOL|XRP|ADA|DOGE)/.test(s)) return true;
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE)\/USD$/i.test(String(symbol).toUpperCase())) return true;
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

    const curatedItems = curatedItemsForQuery(q).map((item) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange || item.resolved.exchange || "",
      currency: item.currency || "",
      type: item.type.toLowerCase(),
    }));
    const canonicalQuery = canonicalSymbol(q);
    const strongCuratedMatch = curatedItems.some((item) => canonicalSymbol(item.symbol) === canonicalQuery);

    const upstreamItems: Array<{
      symbol: string;
      name: string;
      exchange: string;
      currency: string;
      type: string;
    }> = [];

    for (const variant of strongCuratedMatch ? [] : symbolVariants(q)) {
      const upstream = new URL("https://api.twelvedata.com/symbol_search");
      upstream.searchParams.set("symbol", variant);
      upstream.searchParams.set("outputsize", "60");
      upstream.searchParams.set("apikey", apiKey);

      const res = await fetch(upstream.toString(), { cache: "no-store" });
      if (!res.ok) {
        continue;
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
        continue;
      }

      upstreamItems.push(
        ...(raw.data || [])
          .filter((x) => x.symbol)
          .filter((x) => {
            const symbol = (x.symbol || "").trim();
            const type = (x.type || "").trim();
            const name = (x.instrument_name || "").trim();

            if (!symbol) return false;
            if (!matchesAllowedType(type) && !isLikelyTradableSpotSymbol(symbol)) return false;
            if (!isSupportedTradeShareSymbol(symbol)) return false;
            if (containsBlockedName(name)) return false;
            return true;
          })
          .map((x) => ({
            symbol: x.symbol as string,
            name: x.instrument_name || "",
            exchange: x.exchange || "",
            currency: x.currency || "",
            type: (x.type || "").toLowerCase(),
          }))
      );
    }

    const normalizedQ = q.toUpperCase();
    const items = [...curatedItems, ...upstreamItems]
      .filter((x) => x.symbol)
      .filter((x) => isSupportedTradeShareSymbol(x.symbol))
      .filter((x) => {
        const symbol = canonicalSymbol(x.symbol);
        const name = (x.name || "").toLowerCase();
        if (strongCuratedMatch) {
          return symbol.includes(canonicalQuery) || name.includes(q.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => {
        const as = (a.symbol || "").toUpperCase();
        const bs = (b.symbol || "").toUpperCase();
        const ac = canonicalSymbol(as);
        const bc = canonicalSymbol(bs);
        const qc = canonicalSymbol(normalizedQ);

        const aStarts = as.startsWith(normalizedQ) || ac.startsWith(qc) ? 2 : as.includes(normalizedQ) || ac.includes(qc) ? 1 : 0;
        const bStarts = bs.startsWith(normalizedQ) || bc.startsWith(qc) ? 2 : bs.includes(normalizedQ) || bc.includes(qc) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        const aGood = isLikelyTradableSpotSymbol(as) ? 1 : 0;
        const bGood = isLikelyTradableSpotSymbol(bs) ? 1 : 0;
        if (aGood !== bGood) return bGood - aGood;

        return as.localeCompare(bs, "en");
      })
      .filter((item, index, arr) => {
        const current = canonicalSymbol(item.symbol);
        return arr.findIndex((candidate) => canonicalSymbol(candidate.symbol) === current) === index;
      })
      .slice(0, 60)
      .map((x) => ({
        symbol: x.symbol,
        name: x.name || "",
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

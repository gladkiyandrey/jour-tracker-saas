import { NextResponse } from "next/server";
import {
  canonicalSymbol,
  curatedSuggestionsForQuery,
  getCuratedAliasMatch,
  normalizeRequestedSymbol,
  symbolVariants,
  type ResolvedSymbol,
} from "@/lib/trade-share-symbol-catalog";

const ALLOWED_INTERVALS = new Set([
  "1min",
  "3min",
  "5min",
  "15min",
  "30min",
  "1h",
  "4h",
  "1day",
]);

type PreviewRequest = {
  symbol: string;
  interval: string;
  entryAt: string;
  exitAt: string;
  timeZone?: string;
  entryPrice?: number | string;
  exitPrice?: number | string;
};

type Point = {
  t: string;
  ts: number;
  c: number;
};

type SearchItem = {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
  currency?: string;
  type?: string;
};

const ALLOWED_TYPE_WORDS = ["forex", "index", "indices", "commodity", "metals", "metal", "cfd", "cryptocurrency"];
const BLOCKED_NAME_WORDS = ["warrant", "option", "future", "futures", "fund", "etf", "etn", "bond", "certificate", "rights", "note", "swap"];

function isLikelyTradableSpotSymbol(symbol: string) {
  const s = symbol.toUpperCase();
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(s)) return true;
  if (/^[A-Z]{6}$/.test(s)) return true;
  if (/^[A-Z]{2,6}\d{1,4}$/.test(s)) return true;
  if (/^X(AU|AG|PT|PD)\/USD$/.test(s)) return true;
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE)\/USD$/.test(s)) return true;
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

function scoreSearchCandidate(query: string, item: SearchItem) {
  const q = canonicalSymbol(query);
  const symbol = String(item.symbol || "").trim().toUpperCase();
  const canonical = canonicalSymbol(symbol);
  const type = String(item.type || "").toLowerCase();
  const name = String(item.instrument_name || "").toLowerCase();

  let score = 0;
  if (!symbol) return -1;
  if (containsBlockedName(name)) return -1;
  if (matchesAllowedType(type)) score += 30;
  if (isLikelyTradableSpotSymbol(symbol)) score += 20;
  if (canonical === q) score += 100;
  else if (symbol === query.toUpperCase()) score += 90;
  else if (canonical.startsWith(q)) score += 50;
  else if (canonical.includes(q)) score += 30;
  if (name.includes("index")) score += 10;
  if (name.includes("spot")) score += 10;
  if (type.includes("forex") || type.includes("index") || type.includes("commodity") || type.includes("cryptocurrency")) score += 15;
  return score;
}

async function searchCanonicalSymbol(apiKey: string, rawQuery: string): Promise<ResolvedSymbol | null> {
  const variants = symbolVariants(rawQuery);

  for (const query of variants) {
    try {
      const url = new URL("https://api.twelvedata.com/symbol_search");
      url.searchParams.set("symbol", query);
      url.searchParams.set("apikey", apiKey);
      url.searchParams.set("outputsize", "30");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) continue;
      const raw = (await res.json()) as { data?: SearchItem[]; status?: string };
      const rows = Array.isArray(raw.data) ? raw.data : [];
      const ranked = rows
        .map((item) => ({ item, score: scoreSearchCandidate(query, item) }))
        .filter((row) => row.score >= 0)
        .sort((a, b) => b.score - a.score);
      const best = ranked[0]?.item;
      const bestSymbol = best?.symbol?.trim();
      if (bestSymbol) {
        return {
          symbol: bestSymbol.toUpperCase(),
          exchange: best?.exchange?.trim() || undefined,
        };
      }
    } catch {
      // keep trying next variant
    }
  }

  return null;
}

async function fetchTimeSeries(apiKey: string, resolved: ResolvedSymbol, interval: string, startAtIso: string, endAtIso: string) {
  const url = new URL("https://api.twelvedata.com/time_series");
  const symbolQuery = resolved.exchange ? `${resolved.symbol}:${resolved.exchange}` : resolved.symbol;
  url.searchParams.set("symbol", symbolQuery);
  url.searchParams.set("interval", interval);
  url.searchParams.set("start_date", startAtIso);
  url.searchParams.set("end_date", endAtIso);
  url.searchParams.set("order", "ASC");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("format", "JSON");
  url.searchParams.set("apikey", apiKey);

  const upstream = await fetch(url.toString(), { cache: "no-store" });
  if (!upstream.ok) {
    return { ok: false as const, status: upstream.status, raw: null as null };
  }

  const raw = (await upstream.json()) as {
    status?: string;
    message?: string;
    values?: Array<{ datetime: string; close: string }>;
    code?: number;
  };

  return { ok: true as const, status: upstream.status, raw };
}

async function fetchSymbolSuggestions(apiKey: string, query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const variants = symbolVariants(q);
    const curated = curatedSuggestionsForQuery(q);
    const picks: string[] = [];
    for (const variant of variants) {
      const url = new URL("https://api.twelvedata.com/symbol_search");
      url.searchParams.set("symbol", variant);
      url.searchParams.set("apikey", apiKey);
      url.searchParams.set("outputsize", "8");

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) continue;
      const raw = (await res.json()) as { data?: SearchItem[] };
      const ranked = (raw.data || [])
        .map((item) => ({ item, score: scoreSearchCandidate(variant, item) }))
        .filter((row) => row.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((row) => row.item.symbol)
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
      picks.push(...ranked);
    }

    return [...new Set([...curated, ...picks.map((x) => x.toUpperCase())])].slice(0, 5);
  } catch {
    return curatedSuggestionsForQuery(q).slice(0, 5);
  }
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function localDateTimeInZoneToIso(input: string, timeZone: string, label: string) {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(`Invalid ${label}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || "0");

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = utcGuess;
  for (let i = 0; i < 3; i += 1) {
    ts = utcGuess - getTimeZoneOffsetMs(timeZone, new Date(ts));
  }

  return new Date(ts).toISOString();
}

function intervalMs(interval: string) {
  switch (interval) {
    case "1min":
      return 60 * 1000;
    case "3min":
      return 3 * 60 * 1000;
    case "5min":
      return 5 * 60 * 1000;
    case "15min":
      return 15 * 60 * 1000;
    case "30min":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "4h":
      return 4 * 60 * 60 * 1000;
    case "1day":
      return 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}

function pickNearestIndex(points: Point[], timestamp: number) {
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const delta = Math.abs(points[i].ts - timestamp);
    if (delta < bestDelta) {
      best = i;
      bestDelta = delta;
    }
  }
  return best;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "TWELVE_DATA_API_KEY is missing" }, { status: 500 });
    }

    const body = (await req.json()) as PreviewRequest;
    const curatedMatch = getCuratedAliasMatch(body.symbol || "");
    if (curatedMatch && curatedMatch.requiresPro) {
      return NextResponse.json(
        {
          error: "This market is not supported in Trade Share on the current data plan. Use forex, metals, or crypto symbols.",
          suggestions: [],
        },
        { status: 400 }
      );
    }
    const resolved = normalizeRequestedSymbol(body.symbol || "");
    const interval = String(body.interval || "").trim();
    const timeZone = String(body.timeZone || "UTC").trim();

    if (!resolved.symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }
    if (!ALLOWED_INTERVALS.has(interval)) {
      return NextResponse.json({ error: "Unsupported interval" }, { status: 400 });
    }
    if (!isValidTimeZone(timeZone)) {
      return NextResponse.json({ error: "Unsupported timezone" }, { status: 400 });
    }

    const entryAtIso = localDateTimeInZoneToIso(body.entryAt, timeZone, "entryAt");
    const exitAtIso = localDateTimeInZoneToIso(body.exitAt, timeZone, "exitAt");

    const entryTs = Date.parse(entryAtIso);
    const exitTs = Date.parse(exitAtIso);
    const tradeStartTs = Math.min(entryTs, exitTs);
    const tradeEndTs = Math.max(entryTs, exitTs);
    const step = intervalMs(interval);
    const contextBefore = 48;
    const minContextAfter = 48;
    const tradeLengthCandles = Math.max(1, Math.ceil((tradeEndTs - tradeStartTs) / step));
    const contextAfter = Math.max(minContextAfter, tradeLengthCandles + 24);

    // Keep entry time visually around the center:
    // - enough candles before entry (gray history)
    // - enough candles after exit (gray history)
    const startTs = entryTs - contextBefore * step;
    const endTs = entryTs + contextAfter * step;
    const startAtIso = new Date(startTs).toISOString();
    const endAtIso = new Date(endTs).toISOString();

    if (startTs >= endTs) {
      return NextResponse.json({ error: "entryAt/exitAt range is invalid" }, { status: 400 });
    }

    let resolvedSymbol = resolved;
    let upstream = await fetchTimeSeries(apiKey, resolvedSymbol, interval, startAtIso, endAtIso);
    if (!upstream.ok) {
      return NextResponse.json({ error: `Twelve Data HTTP ${upstream.status}` }, { status: 502 });
    }
    let raw = upstream.raw;

    if (raw.status === "error") {
      const message = raw.message || "Twelve Data error";
      if (/starting with Pro|Pro plan/i.test(message)) {
        return NextResponse.json(
          {
            error: "This market is not supported in Trade Share on the current data plan. Use forex, metals, or crypto symbols.",
            suggestions: [],
          },
          { status: 400 }
        );
      }
      const symbolIssue = /symbol|figi|missing|invalid/i.test(message);
      if (symbolIssue) {
        const fallback = await searchCanonicalSymbol(apiKey, String(body.symbol || ""));
        if (fallback && (fallback.symbol !== resolvedSymbol.symbol || fallback.exchange !== resolvedSymbol.exchange)) {
          resolvedSymbol = fallback;
          upstream = await fetchTimeSeries(apiKey, resolvedSymbol, interval, startAtIso, endAtIso);
          if (!upstream.ok) {
            return NextResponse.json({ error: `Twelve Data HTTP ${upstream.status}` }, { status: 502 });
          }
          raw = upstream.raw;
        }
      }
    }

    if (raw.status === "error") {
      const message = raw.message || "Twelve Data error";
      const symbolIssue = /symbol|figi|missing|invalid/i.test(message);
      if (symbolIssue) {
        const suggestions = await fetchSymbolSuggestions(apiKey, resolved.symbol);
        return NextResponse.json(
          {
            error: message,
            suggestions,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const points: Point[] = (raw.values || [])
      .map((v) => {
        const ts = Date.parse(v.datetime);
        const c = Number(v.close);
        return {
          t: v.datetime,
          ts,
          c,
        };
      })
      .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.c));

    if (points.length < 2) {
      return NextResponse.json({ error: "Not enough candles for selected range" }, { status: 400 });
    }

    const entryIndex = pickNearestIndex(points, entryTs);
    const exitIndex = pickNearestIndex(points, exitTs);
    const tradeStart = Math.min(entryIndex, exitIndex);
    const tradeEnd = Math.max(entryIndex, exitIndex);

    const min = Math.min(...points.map((p) => p.c));
    const max = Math.max(...points.map((p) => p.c));

    const payload = {
      symbol: resolvedSymbol.symbol,
      interval,
      points,
      min,
      max,
      entryIndex,
      exitIndex,
      tradeStart,
      tradeEnd,
      entryPriceInput: body.entryPrice ?? null,
      exitPriceInput: body.exitPrice ?? null,
      entryTime: entryAtIso,
      exitTime: exitAtIso,
      rangeStart: startAtIso,
      rangeEnd: endAtIso,
      entryPriceMarket: points[entryIndex]?.c ?? null,
      exitPriceMarket: points[exitIndex]?.c ?? null,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

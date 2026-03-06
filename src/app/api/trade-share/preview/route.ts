import { NextResponse } from "next/server";

const ALLOWED_INTERVALS = new Set([
  "1min",
  "5min",
  "15min",
  "30min",
  "45min",
  "1h",
  "2h",
  "4h",
  "1day",
]);

type PreviewRequest = {
  symbol: string;
  interval: string;
  startAt: string;
  endAt: string;
  entryAt: string;
  exitAt: string;
  entryPrice?: number | string;
  exitPrice?: number | string;
};

type Point = {
  t: string;
  ts: number;
  c: number;
};

async function fetchSymbolSuggestions(apiKey: string, query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const url = new URL("https://api.twelvedata.com/symbol_search");
    url.searchParams.set("symbol", q);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("outputsize", "8");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const raw = (await res.json()) as {
      data?: Array<{ symbol?: string; instrument_name?: string; exchange?: string }>;
    };

    const picks = (raw.data || [])
      .map((item) => item.symbol)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);

    return [...new Set(picks)].slice(0, 5);
  } catch {
    return [];
  }
}

function toIso(input: string, label: string) {
  const ts = Date.parse(input);
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid ${label}`);
  }
  return new Date(ts).toISOString();
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
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const interval = String(body.interval || "").trim();

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }
    if (!ALLOWED_INTERVALS.has(interval)) {
      return NextResponse.json({ error: "Unsupported interval" }, { status: 400 });
    }

    const startAtIso = toIso(body.startAt, "startAt");
    const endAtIso = toIso(body.endAt, "endAt");
    const entryAtIso = toIso(body.entryAt, "entryAt");
    const exitAtIso = toIso(body.exitAt, "exitAt");

    const startTs = Date.parse(startAtIso);
    const endTs = Date.parse(endAtIso);
    const entryTs = Date.parse(entryAtIso);
    const exitTs = Date.parse(exitAtIso);

    if (startTs >= endTs) {
      return NextResponse.json({ error: "startAt must be earlier than endAt" }, { status: 400 });
    }

    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("start_date", startAtIso);
    url.searchParams.set("end_date", endAtIso);
    url.searchParams.set("order", "ASC");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("format", "JSON");
    url.searchParams.set("apikey", apiKey);

    const upstream = await fetch(url.toString(), { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Twelve Data HTTP ${upstream.status}` }, { status: 502 });
    }

    const raw = (await upstream.json()) as {
      status?: string;
      message?: string;
      values?: Array<{ datetime: string; close: string }>;
      code?: number;
    };

    if (raw.status === "error") {
      const message = raw.message || "Twelve Data error";
      const symbolIssue = /symbol|figi|missing|invalid/i.test(message);
      if (symbolIssue) {
        const suggestions = await fetchSymbolSuggestions(apiKey, symbol);
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
      symbol,
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
      entryPriceMarket: points[entryIndex]?.c ?? null,
      exitPriceMarket: points[exitIndex]?.c ?? null,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

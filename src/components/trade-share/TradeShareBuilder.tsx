"use client";

import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./TradeShareBuilder.module.css";

type Point = { t: string; ts: number; c: number };
type SymbolItem = {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  type?: string;
};

type PreviewResponse = {
  symbol: string;
  interval: string;
  points: Point[];
  min: number;
  max: number;
  entryIndex: number;
  exitIndex: number;
  tradeStart: number;
  tradeEnd: number;
  entryPriceInput: number | string | null;
  exitPriceInput: number | string | null;
  entryTime: string;
  exitTime: string;
  rangeStart: string;
  rangeEnd: string;
  entryPriceMarket: number | null;
  exitPriceMarket: number | null;
};

type PreviewError = {
  error: string;
  suggestions?: string[];
};

function dtLocal(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const now = Date.now();
const minus12h = now - 12 * 60 * 60 * 1000;
const minus2h = now - 2 * 60 * 60 * 1000;
const POPULAR_SYMBOLS: SymbolItem[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", type: "forex" },
  { symbol: "GBP/USD", name: "Pound / US Dollar", type: "forex" },
  { symbol: "USD/JPY", name: "US Dollar / Yen", type: "forex" },
  { symbol: "XAU/USD", name: "Gold / US Dollar", type: "commodity" },
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar", type: "cryptocurrency" },
  { symbol: "ETH/USD", name: "Ethereum / US Dollar", type: "cryptocurrency" },
  { symbol: "GER40", name: "Germany 40 Index", type: "index" },
];

function symbolBadge(item: SymbolItem) {
  const type = (item.type || "").toLowerCase();
  if (type.includes("crypto")) return "₿";
  if (type.includes("forex")) return "FX";
  if (type.includes("index")) return "IX";
  if (type.includes("stock")) return "EQ";
  if (type.includes("commodity")) return "CM";
  return item.symbol.slice(0, 2).toUpperCase();
}

export default function TradeShareBuilder() {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [interval, setInterval] = useState("15min");
  const [entryAt, setEntryAt] = useState(dtLocal(minus12h));
  const [exitAt, setExitAt] = useState(dtLocal(minus2h));
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [symbolSuggestions, setSymbolSuggestions] = useState<string[]>([]);
  const [lookupSuggestions, setLookupSuggestions] = useState<SymbolItem[]>(POPULAR_SYMBOLS);
  const [showSymbolList, setShowSymbolList] = useState(false);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const baseSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tradeSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    const q = symbol.trim();
    if (q.length < 1) {
      setLookupSuggestions(POPULAR_SYMBOLS);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/trade-share/symbols?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = (await res.json()) as { items?: SymbolItem[]; error?: string };
        if (!res.ok || !Array.isArray(json.items)) {
          return;
        }
        const base = { symbol: q.toUpperCase() };
        const merged = [base, ...json.items, ...POPULAR_SYMBOLS];
        const seen = new Set<string>();
        const dedup = merged.filter((x) => {
          const key = x.symbol?.toUpperCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setLookupSuggestions(dedup.slice(0, 30));
      } catch {
        // keep existing list
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [symbol]);

  const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      if (chartApiRef.current) {
        chartApiRef.current.remove();
      }
      chartApiRef.current = null;
      baseSeriesRef.current = null;
      tradeSeriesRef.current = null;
      chartRef.current = null;
      return;
    }

    chartRef.current = node;
    if (chartApiRef.current) {
      return;
    }

    const chart = createChart(node, {
      autoSize: true,
      layout: {
        background: { color: "rgba(9, 13, 24, 0.0)" },
        textColor: "#9ea9cc",
      },
      grid: {
        vertLines: { color: "rgba(120, 136, 190, 0.12)" },
        horzLines: { color: "rgba(120, 136, 190, 0.22)" },
      },
      rightPriceScale: {
        borderColor: "rgba(120, 136, 190, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(120, 136, 190, 0.2)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(176, 196, 255, 0.35)" },
        horzLine: { color: "rgba(176, 196, 255, 0.35)" },
      },
    });

    const baseSeries = chart.addSeries(LineSeries, {
      color: "#6f87b7",
      lineWidth: 2,
      crosshairMarkerBorderColor: "#6f87b7",
      crosshairMarkerBackgroundColor: "#0f1424",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const tradeSeries = chart.addSeries(LineSeries, {
      color: "#00ffa3",
      lineWidth: 3,
      crosshairMarkerBorderColor: "#00ffa3",
      crosshairMarkerBackgroundColor: "#0f1424",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartApiRef.current = chart;
    baseSeriesRef.current = baseSeries;
    tradeSeriesRef.current = tradeSeries;
  }, []);

  useEffect(() => {
    if (!data || !chartApiRef.current || !baseSeriesRef.current || !tradeSeriesRef.current) {
      return;
    }

    const baseData: LineData<Time>[] = data.points.map((p) => ({
      time: Math.floor(p.ts / 1000) as UTCTimestamp,
      value: p.c,
    }));

    const tradeData: Array<LineData<Time> | { time: Time }> = data.points.map((p, i) => {
      const time = Math.floor(p.ts / 1000) as UTCTimestamp;
      if (i < data.tradeStart || i > data.tradeEnd) {
        return { time };
      }
      return { time, value: p.c };
    });

    baseSeriesRef.current.setData(baseData);
    tradeSeriesRef.current.setData(tradeData);
    chartApiRef.current.timeScale().fitContent();
  }, [data]);

  async function loadPreview() {
    setLoading(true);
    setError("");
    setSymbolSuggestions([]);
    try {
      const res = await fetch("/api/trade-share/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          interval,
          entryAt,
          exitAt,
          entryPrice: entryPrice || undefined,
          exitPrice: exitPrice || undefined,
        }),
      });

      const json = (await res.json()) as PreviewResponse | PreviewError;
      if (!res.ok) {
        if ("error" in json && Array.isArray(json.suggestions) && json.suggestions.length > 0) {
          setSymbolSuggestions(json.suggestions);
        }
        throw new Error("error" in json ? json.error : "Failed to load chart");
      }
      setData(json as PreviewResponse);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load chart");
    } finally {
      setLoading(false);
    }
  }

  const pnlPct = useMemo(() => {
    if (!data) return null;
    const e = Number(data.entryPriceInput || data.entryPriceMarket || 0);
    const x = Number(data.exitPriceInput || data.exitPriceMarket || 0);
    if (!Number.isFinite(e) || !Number.isFinite(x) || e === 0) return null;
    return ((x - e) / e) * 100;
  }, [data]);

  return (
    <section className={styles.wrap}>
      <div className={styles.panel}>
        <h1>Trade Share Builder (MVP)</h1>
        <p>Вводишь параметры сделки, система тянет историю цены из Twelve Data и строит график с точкой входа/выхода.</p>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onFocus={() => setShowSymbolList(true)}
              onBlur={() => setTimeout(() => setShowSymbolList(false), 120)}
              placeholder="EUR/USD"
              autoComplete="off"
            />
            {showSymbolList ? (
              <div className={styles.symbolList} role="listbox" aria-label="Symbols">
                {lookupSuggestions.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className={styles.symbolItem}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSymbol(item.symbol);
                      setShowSymbolList(false);
                    }}
                  >
                    <span className={styles.symbolLogo}>{symbolBadge(item)}</span>
                    <span className={styles.symbolMeta}>
                      <span className={styles.symbolCode}>{item.symbol}</span>
                      <span className={styles.symbolName}>
                        {[item.name, item.exchange, item.currency].filter(Boolean).join(" • ") || "Twelve Data symbol"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className={styles.field}>
            <label>Interval</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value)}>
              <option>1min</option>
              <option>5min</option>
              <option>15min</option>
              <option>30min</option>
              <option>45min</option>
              <option>1h</option>
              <option>2h</option>
              <option>4h</option>
              <option>1day</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Entry time</label>
            <input type="datetime-local" value={entryAt} onChange={(e) => setEntryAt(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Exit time</label>
            <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Range (auto)</label>
            <input value="Calculated automatically from Entry/Exit" readOnly />
          </div>

          <div className={styles.field}>
            <label>Entry price (optional)</label>
            <input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="1.08452" />
          </div>
          <div className={styles.field}>
            <label>Exit price (optional)</label>
            <input value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="1.08632" />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={loadPreview} disabled={loading}>
            {loading ? "Loading..." : "Build preview"}
          </button>
          {error ? <span className={styles.error}>{error}</span> : null}
        </div>
        {symbolSuggestions.length > 0 ? (
          <div className={styles.suggestions}>
            {symbolSuggestions.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={styles.suggestionBtn}
                onClick={() => {
                  setSymbol(candidate);
                  setError("");
                }}
              >
                {candidate}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {data ? (
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <div className={styles.symbol}>{data.symbol}</div>
            <div>{data.interval}</div>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span>PnL %</span>
              <strong style={{ color: (pnlPct ?? 0) >= 0 ? "#00ffa3" : "#ff8b8b" }}>
                {pnlPct === null ? "n/a" : `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
              </strong>
            </div>
            <div className={styles.metric}>
              <span>Market entry</span>
              <strong>{data.entryPriceMarket?.toFixed(5) ?? "n/a"}</strong>
            </div>
            <div className={styles.metric}>
              <span>Market exit</span>
              <strong>{data.exitPriceMarket?.toFixed(5) ?? "n/a"}</strong>
            </div>
          </div>

          <div className={styles.chartWrap}>
            <div ref={chartContainerRef} className={styles.chartCanvas} aria-label="Trade chart" />
          </div>

          <div className={styles.details}>
            <div className={styles.detail}>
              <b>Entry time</b>
              <span>{new Date(data.entryTime).toLocaleString()}</span>
            </div>
            <div className={styles.detail}>
              <b>Exit time</b>
              <span>{new Date(data.exitTime).toLocaleString()}</span>
            </div>
            <div className={styles.detail}>
              <b>Candles</b>
              <span>{data.points.length}</span>
            </div>
            <div className={styles.detail}>
              <b>Auto range</b>
              <span>
                {new Date(data.rangeStart).toLocaleString()} - {new Date(data.rangeEnd).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

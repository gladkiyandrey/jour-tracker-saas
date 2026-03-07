"use client";

import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [symbol, setSymbol] = useState("");
  const [interval, setInterval] = useState("15min");
  const [entryAt, setEntryAt] = useState("");
  const [exitAt, setExitAt] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [rr, setRr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [symbolSuggestions, setSymbolSuggestions] = useState<string[]>([]);
  const [lookupSuggestions, setLookupSuggestions] = useState<SymbolItem[]>(POPULAR_SYMBOLS);
  const [showSymbolList, setShowSymbolList] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

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

  const chart = useMemo(() => {
    if (!data || data.points.length < 2) {
      return null;
    }

    const w = 450;
    const h = 600;
    const left = 45;
    const right = 405;
    const top = 74;
    const bottom = 255;
    const innerW = right - left;
    const innerH = bottom - top;

    const safeMin = data.min;
    const safeMax = data.max === data.min ? data.max + 1 : data.max;

    const toX = (index: number) => left + (index / (data.points.length - 1)) * innerW;
    const toY = (price: number) => {
      const y = top + ((safeMax - price) / (safeMax - safeMin)) * innerH;
      return Math.max(top, Math.min(bottom, y));
    };

    const fullPath = data.points
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(2)} ${toY(p.c).toFixed(2)}`)
      .join(" ");

    const seg = data.points.slice(data.tradeStart, data.tradeEnd + 1);
    const segPath = seg
      .map((p, i) => {
        const idx = data.tradeStart + i;
        return `${i === 0 ? "M" : "L"}${toX(idx).toFixed(2)} ${toY(p.c).toFixed(2)}`;
      })
      .join(" ");

    const fillPath = [
      segPath,
      `L ${toX(data.tradeEnd).toFixed(2)} ${(top + innerH).toFixed(2)}`,
      `L ${toX(data.tradeStart).toFixed(2)} ${(top + innerH).toFixed(2)}`,
      "Z",
    ].join(" ");

    return {
      w,
      h,
      left,
      top,
      innerW,
      innerH,
      toX,
      toY,
      fullPath,
      segPath,
      fillPath,
      entryX: toX(data.entryIndex),
      exitX: toX(data.exitIndex),
      entryY: toY(data.points[data.entryIndex].c),
      exitY: toY(data.points[data.exitIndex].c),
      floorY: bottom,
    };
  }, [data]);

  async function loadPreview() {
    if (!symbol.trim()) {
      setError("Enter symbol");
      return;
    }
    if (!entryAt || !exitAt) {
      setError("Set entry and exit time");
      return;
    }

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

  async function downloadCardPng() {
    if (!cardRef.current || !data) return;
    try {
      setDownloading(true);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#131722",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `consist-trade-${(data.symbol || "card").replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
      a.click();
    } catch {
      setError("Failed to download image. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  const pnlPct = useMemo(() => {
    if (!data) return null;
    const e = Number(data.entryPriceInput || data.entryPriceMarket || 0);
    const x = Number(data.exitPriceInput || data.exitPriceMarket || 0);
    if (!Number.isFinite(e) || !Number.isFinite(x) || e === 0) return null;
    return ((x - e) / e) * 100;
  }, [data]);

  const tradeDirection = (pnlPct ?? 0) >= 0 ? "Long" : "Short";
  const tradeDirectionClass = (pnlPct ?? 0) >= 0 ? styles.long : styles.short;
  const isLong = (pnlPct ?? 0) >= 0;

  function formatPrice(v: number | string | null) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "n/a";
    return `${n.toFixed(5)} USD`;
  }

  function formatLongDate(value: string) {
    const d = new Date(value);
    return d.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function formatDuration(start: string, end: string) {
    const diffSec = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return `${h}h ${m}m ${s}s`;
  }

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
            <input type="datetime-local" value={entryAt} onChange={(e) => setEntryAt(e.target.value)} placeholder="Select entry time" />
          </div>
          <div className={styles.field}>
            <label>Exit time</label>
            <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)} placeholder="Select exit time" />
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
          <div className={styles.field}>
            <label>Volume (lots)</label>
            <input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="e.g. 0.42" />
          </div>
          <div className={styles.field}>
            <label>RR</label>
            <input value={rr} onChange={(e) => setRr(e.target.value)} placeholder="e.g. 2.23" />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={loadPreview} disabled={loading}>
            {loading ? "Loading..." : "Build preview"}
          </button>
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={downloadCardPng}
            disabled={!data || downloading}
          >
            {downloading ? "Exporting..." : "Download card (PNG)"}
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

      {data && chart ? (
        <div className={styles.figmaCard} ref={cardRef}>
          <img className={styles.overlayNoise} src="/trade-share/figma-82-1109/overlay-noise.jpg" alt="" aria-hidden="true" />
          <div className={styles.innerGlow} />

          <img className={styles.logoWatermark} src="/brand/consist-logo-white.svg" alt="" aria-hidden="true" />
          <img className={styles.cornerGlow} src="/trade-share/figma-82-1109/corner-ring.svg" alt="" aria-hidden="true" />

          <div className={styles.topRow}>
            <div className={styles.ticker}>{data.symbol}</div>
            <div className={`${styles.sideBadge} ${tradeDirectionClass}`}>
              <span className={styles.sideArrow} aria-hidden="true">
                {isLong ? "↗" : "↘"}
              </span>
              <span>{tradeDirection}</span>
            </div>
          </div>

          <svg className={styles.figmaChart} viewBox={`0 0 ${chart.w} ${chart.h}`} aria-label="Trade chart">
            <defs>
              <linearGradient id="trade-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FFA3" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00FFA3" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: 5 }).map((_, i) => {
              const y = chart.top + (chart.innerH / 4) * i;
              return (
                <line key={`grid-${i}`} className={styles.gridLine} x1={chart.left} y1={y} x2={chart.left + chart.innerW} y2={y} />
              );
            })}
            <path d={chart.fullPath} className={styles.fullLine} />
            <path d={chart.fillPath} className={styles.fillArea} />
            <path d={chart.segPath} className={styles.tradeLine} />
            <line
              className={styles.markerLine}
              x1={chart.entryX}
              y1={chart.entryY}
              x2={chart.entryX}
              y2={chart.floorY}
            />
            <line
              className={styles.markerLine}
              x1={chart.exitX}
              y1={chart.exitY}
              x2={chart.exitX}
              y2={chart.floorY}
            />
            <circle className={styles.entryDot} cx={chart.entryX} cy={chart.entryY} r="6.5" />
            <circle className={styles.exitDot} cx={chart.exitX} cy={chart.exitY} r="6.5" />
          </svg>

          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span>Entry price</span>
              <strong>{formatPrice(data.entryPriceInput || data.entryPriceMarket)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Exit price</span>
              <strong>{formatPrice(data.exitPriceInput || data.exitPriceMarket)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Open Date</span>
              <strong>{formatLongDate(data.entryTime)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Close Date</span>
              <strong>{formatLongDate(data.exitTime)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Duration</span>
              <strong>{formatDuration(data.entryTime, data.exitTime)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Volume</span>
              <strong>{volume || "0.00"} Lots</strong>
            </div>
            <div className={styles.infoRow}>
              <span>RR</span>
              <strong>{rr || "0.00"}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

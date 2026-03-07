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

type PositionSide = "long" | "short";
type PriceSourceMode = "manual" | "market";

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

function clipRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function applyRoundedCornersToDataUrl(dataUrl: string, radiusPx: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to load exported card image"));
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create export canvas");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  clipRoundedRect(ctx, 0, 0, canvas.width, canvas.height, radiusPx);
  ctx.save();
  ctx.clip();
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

async function waitForCardAssets(root: HTMLElement) {
  const fontsReady =
    typeof document !== "undefined" && "fonts" in document ? (document.fonts.ready.catch(() => undefined) as Promise<unknown>) : Promise.resolve();

  const imageNodes = Array.from(root.querySelectorAll("img"));
  const imageReady = imageNodes.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) {
      if ("decode" in img) {
        try {
          await img.decode();
        } catch {
          // ignore decode failures for already loaded images
        }
      }
      return;
    }

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onLoad);
      };
      const onLoad = () => {
        cleanup();
        resolve();
      };
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onLoad, { once: true });
    });

    if ("decode" in img) {
      try {
        await img.decode();
      } catch {
        // ignore decode failures after load
      }
    }
  });

  await Promise.all([fontsReady, ...imageReady]);

  // Give layout/paint a full frame before rasterizing.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

type TradeShareBuilderProps = {
  initialTimeZone: string;
};

export default function TradeShareBuilder({ initialTimeZone }: TradeShareBuilderProps) {
  const [symbol, setSymbol] = useState("");
  const [interval, setInterval] = useState("15min");
  const [timeZone, setTimeZone] = useState(initialTimeZone || "UTC");
  const [positionSide, setPositionSide] = useState<PositionSide | "">("");
  const [priceSource, setPriceSource] = useState<PriceSourceMode>("manual");
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
    setTimeZone(initialTimeZone || "UTC");
  }, [initialTimeZone]);

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
    const top = 84;
    const bottom = 265;
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
    };
  }, [data]);

  async function loadPreview() {
    if (!symbol.trim()) {
      setError("Enter symbol");
      return;
    }
    if (positionSide !== "long" && positionSide !== "short") {
      setError("Choose trade side");
      return;
    }
    if (!entryAt || !exitAt) {
      setError("Set entry and exit time");
      return;
    }
    if (priceSource === "manual") {
      const entryNum = Number(entryPrice);
      const exitNum = Number(exitPrice);
      if (!Number.isFinite(entryNum) || entryNum <= 0 || !Number.isFinite(exitNum) || exitNum <= 0) {
        setError("Enter entry and exit prices or switch to Market prices");
        return;
      }
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
          timeZone,
          entryPrice: priceSource === "manual" ? entryPrice || undefined : undefined,
          exitPrice: priceSource === "manual" ? exitPrice || undefined : undefined,
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
      const pixelRatio = 2;
      await waitForCardAssets(cardRef.current);
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio,
      });
      const roundedDataUrl = await applyRoundedCornersToDataUrl(dataUrl, 25 * pixelRatio);
      const a = document.createElement("a");
      a.href = roundedDataUrl;
      a.download = `consist-trade-${(data.symbol || "card").replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
      a.click();
    } catch {
      setError("Failed to download image. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  const tradeDirection = positionSide === "short" ? "Short" : "Long";
  const effectiveEntryPrice = Number(data?.entryPriceInput ?? data?.entryPriceMarket ?? 0);
  const effectiveExitPrice = Number(data?.exitPriceInput ?? data?.exitPriceMarket ?? 0);
  const pnlPct =
    data && Number.isFinite(effectiveEntryPrice) && Number.isFinite(effectiveExitPrice) && effectiveEntryPrice > 0
      ? positionSide === "short"
        ? ((effectiveEntryPrice - effectiveExitPrice) / effectiveEntryPrice) * 100
        : ((effectiveExitPrice - effectiveEntryPrice) / effectiveEntryPrice) * 100
      : null;
  const isProfit = (pnlPct ?? 0) >= 0;
  const resultClass = isProfit ? styles.profit : styles.loss;
  const sideClass = positionSide === "short" ? styles.sideShort : styles.sideLong;

  function formatPrice(v: number | string | null) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "n/a";
    return `${n.toFixed(5)} USD`;
  }

  function formatLongDate(value: string) {
    const d = new Date(value);
    return d.toLocaleString("en-US", {
      timeZone,
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

  function formatPct(value: number | null) {
    if (value === null || !Number.isFinite(value)) return "n/a";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.panel}>
        <h1>Trade Share Builder (MVP)</h1>
        <p>Вводишь параметры сделки, система тянет историю цены из Twelve Data и строит график с точкой входа/выхода.</p>
        <p>Timezone: {timeZone}</p>

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
            <label>Side</label>
            <select value={positionSide} onChange={(e) => setPositionSide(e.target.value === "short" ? "short" : e.target.value === "long" ? "long" : "")}>
              <option value="">Choose side</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Price source</label>
            <select value={priceSource} onChange={(e) => setPriceSource(e.target.value === "market" ? "market" : "manual")}>
              <option value="manual">Manual prices</option>
              <option value="market">Market prices (auto)</option>
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
            <label>{priceSource === "manual" ? "Entry price" : "Entry price (market)"}</label>
            <input
              value={priceSource === "manual" ? entryPrice : data?.entryPriceMarket ? String(data.entryPriceMarket) : ""}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="1.08452"
              readOnly={priceSource === "market"}
            />
          </div>
          <div className={styles.field}>
            <label>{priceSource === "manual" ? "Exit price" : "Exit price (market)"}</label>
            <input
              value={priceSource === "manual" ? exitPrice : data?.exitPriceMarket ? String(data.exitPriceMarket) : ""}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder="1.08632"
              readOnly={priceSource === "market"}
            />
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
            <div className={`${styles.sideBadge} ${sideClass}`}>
              <span className={styles.sideArrow} aria-hidden="true">
                {positionSide === "short" ? "↘" : "↗"}
              </span>
              <span>{tradeDirection}</span>
            </div>
            <div className={`${styles.resultBadge} ${resultClass}`}>{formatPct(pnlPct)}</div>
          </div>

          <svg className={styles.figmaChart} viewBox={`0 0 ${chart.w} ${chart.h}`} aria-label="Trade chart">
            <defs>
              <linearGradient id="trade-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FFA3" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00FFA3" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trade-gradient-loss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B7A" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#FF6B7A" stopOpacity="0" />
              </linearGradient>
              <filter id="position-glow-blur" x="-15%" y="-20%" width="130%" height="160%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>
            <path d={chart.fullPath} fill="none" stroke="rgba(160, 167, 180, 0.55)" strokeWidth="2.5" />
            <path d={chart.fillPath} fill={isProfit ? "url(#trade-gradient)" : "url(#trade-gradient-loss)"} />
            <path
              d={chart.segPath}
              fill="none"
              stroke={isProfit ? "#00FFA3" : "#FF6B7A"}
              strokeWidth="2"
              opacity="0.8"
              filter="url(#position-glow-blur)"
            />
            <path d={chart.segPath} fill="none" stroke={isProfit ? "#00FFA3" : "#FF6B7A"} strokeWidth="3.4" />
            <circle cx={chart.entryX} cy={chart.entryY} r="6.5" fill="#0f1424" stroke="#ffd24a" strokeWidth="4" />
            <circle cx={chart.exitX} cy={chart.exitY} r="6.5" fill="#0f1424" stroke={isProfit ? "#00ffa3" : "#ff6b7a"} strokeWidth="4" />
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
            <div className={styles.infoRow}>
              <span>Price source</span>
              <strong>{priceSource === "manual" ? "Manual" : "Market-derived"}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

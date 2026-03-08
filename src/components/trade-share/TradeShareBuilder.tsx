"use client";

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

const POPULAR_SYMBOLS: SymbolItem[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", type: "forex" },
  { symbol: "GBP/USD", name: "Pound / US Dollar", type: "forex" },
  { symbol: "USD/JPY", name: "US Dollar / Yen", type: "forex" },
  { symbol: "XAU/USD", name: "Gold / US Dollar", type: "commodity" },
  { symbol: "XAG/USD", name: "Silver / US Dollar", type: "commodity" },
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar", type: "cryptocurrency" },
  { symbol: "ETH/USD", name: "Ethereum / US Dollar", type: "cryptocurrency" },
  { symbol: "SOL/USD", name: "Solana / US Dollar", type: "cryptocurrency" },
];

const FOREX_FLAG_MAP: Record<string, string> = {
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  CHF: "ch",
  CAD: "ca",
  AUD: "au",
  NZD: "nz",
  SEK: "se",
  NOK: "no",
  DKK: "dk",
  SGD: "sg",
  HKD: "hk",
  CNH: "cn",
  CNY: "cn",
  MXN: "mx",
  TRY: "tr",
  ZAR: "za",
  PLN: "pl",
  HUF: "hu",
  CZK: "cz",
  ILS: "il",
  AED: "ae",
  SAR: "sa",
  THB: "th",
  INR: "in",
  KRW: "kr",
  BRL: "br",
  RUB: "ru",
  RON: "ro",
  BGN: "bg",
  HRK: "hr",
  ISK: "is",
  MYR: "my",
  PHP: "ph",
  IDR: "id",
  TWD: "tw",
  PKR: "pk",
  CLP: "cl",
  COP: "co",
  ARS: "ar",
};

const METAL_LABEL_MAP: Record<string, string> = {
  XAU: "Au",
  XAG: "Ag",
  XPT: "Pt",
  XPD: "Pd",
  XCU: "Cu",
  XNI: "Ni",
};

const METAL_ICON_MAP: Record<string, string> = {
  XAU: "/trade-share/symbol-icons/xau.svg",
  XAG: "/trade-share/symbol-icons/xag.svg",
  XPT: "/trade-share/symbol-icons/xpt.svg",
  XPD: "/trade-share/symbol-icons/xpd.svg",
  XCU: "/trade-share/symbol-icons/xcu.svg",
  XNI: "/trade-share/symbol-icons/xni.svg",
};

const CRYPTO_LABEL_MAP: Record<string, string> = {
  BTC: "B",
  ETH: "E",
  SOL: "S",
  XRP: "X",
  ADA: "A",
  DOGE: "D",
  LTC: "L",
  BCH: "BC",
  BNB: "BN",
  TRX: "T",
  AVAX: "AV",
  LINK: "LI",
  DOT: "DO",
  MATIC: "MA",
  SUI: "SU",
  TON: "TO",
};

const CRYPTO_ICON_MAP: Record<string, string> = {
  ADA: "/trade-share/symbol-icons/ada.svg",
  AVAX: "/trade-share/symbol-icons/avax.svg",
  BCH: "/trade-share/symbol-icons/bch.svg",
  BNB: "/trade-share/symbol-icons/bnb.svg",
  BTC: "/trade-share/symbol-icons/btc.svg",
  DOGE: "/trade-share/symbol-icons/doge.svg",
  DOT: "/trade-share/symbol-icons/dot.svg",
  ETH: "/trade-share/symbol-icons/eth.svg",
  LINK: "/trade-share/symbol-icons/link.svg",
  LTC: "/trade-share/symbol-icons/ltc.svg",
  MATIC: "/trade-share/symbol-icons/matic.svg",
  SOL: "/trade-share/symbol-icons/sol.svg",
  SUI: "/trade-share/symbol-icons/sui.svg",
  TON: "/trade-share/symbol-icons/ton.svg",
  TRX: "/trade-share/symbol-icons/trx.svg",
  USDT: "/trade-share/symbol-icons/usdt.svg",
  XRP: "/trade-share/symbol-icons/xrp.svg",
};

function canonicalSymbol(value: string) {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function formatSymbolDisplay(value: string) {
  const normalized = canonicalSymbol(value);
  if (/^[A-Z]{6}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}/${normalized.slice(3)}`;
  }
  return value.toUpperCase();
}

function splitPairSymbol(symbol: string) {
  const raw = String(symbol || "").trim().toUpperCase();
  if (raw.includes("/")) {
    const [base, quote] = raw.split("/");
    if (base && quote) return [base, quote] as const;
  }
  const normalized = canonicalSymbol(symbol);
  if (/^[A-Z]{6}$/.test(normalized)) {
    return [normalized.slice(0, 3), normalized.slice(3)] as const;
  }
  return null;
}

function getForexCurrencies(symbol: string) {
  const pair = splitPairSymbol(symbol);
  if (!pair) return null;
  const [base, quote] = pair;
  if (FOREX_FLAG_MAP[base] && FOREX_FLAG_MAP[quote]) {
    return [base, quote] as const;
  }
  return null;
}

function countryFlag(code: string) {
  return FOREX_FLAG_MAP[code] || null;
}

function inferSymbolType(item: SymbolItem) {
  const explicit = (item.type || "").toLowerCase();
  if (explicit) return explicit;
  const pair = splitPairSymbol(item.symbol);
  if (getForexCurrencies(item.symbol)) return "forex";
  if (pair && (METAL_LABEL_MAP[pair[0]] || METAL_LABEL_MAP[pair[1]])) return "commodity";
  if (/^X(AU|AG|PT|PD|CU|NI)(USD)?$/i.test(canonicalSymbol(item.symbol))) return "commodity";
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE)/i.test(canonicalSymbol(item.symbol))) return "cryptocurrency";
  return "";
}

function getPricePlaceholders(symbol: string) {
  const pair = splitPairSymbol(symbol);
  const canonical = canonicalSymbol(symbol);
  const base = pair?.[0] || canonical.slice(0, 3);
  const quote = pair?.[1] || canonical.slice(3);

  const byBase: Record<string, { entry: string; exit: string; stop: string }> = {
    XAU: { entry: "2935.40", exit: "2958.10", stop: "2918.80" },
    XAG: { entry: "32.480", exit: "33.120", stop: "31.960" },
    XPT: { entry: "982.50", exit: "995.80", stop: "971.20" },
    XPD: { entry: "1048.50", exit: "1076.20", stop: "1029.40" },
    XCU: { entry: "4.1820", exit: "4.2460", stop: "4.1410" },
    XNI: { entry: "16.420", exit: "16.980", stop: "16.080" },
    BTC: { entry: "64250.00", exit: "65880.00", stop: "63120.00" },
    ETH: { entry: "3485.00", exit: "3620.00", stop: "3395.00" },
    SOL: { entry: "146.20", exit: "154.80", stop: "140.40" },
    XRP: { entry: "0.6120", exit: "0.6480", stop: "0.5880" },
    ADA: { entry: "0.7420", exit: "0.7860", stop: "0.7080" },
    DOGE: { entry: "0.1840", exit: "0.2010", stop: "0.1730" },
    LTC: { entry: "82.40", exit: "86.90", stop: "79.60" },
    BCH: { entry: "468.00", exit: "492.00", stop: "452.00" },
    BNB: { entry: "585.00", exit: "612.00", stop: "566.00" },
    TRX: { entry: "0.1320", exit: "0.1410", stop: "0.1260" },
    AVAX: { entry: "38.20", exit: "41.70", stop: "36.60" },
    LINK: { entry: "18.40", exit: "19.90", stop: "17.70" },
    DOT: { entry: "7.420", exit: "7.980", stop: "7.110" },
    MATIC: { entry: "0.9620", exit: "1.0240", stop: "0.9180" },
    SUI: { entry: "1.6200", exit: "1.7600", stop: "1.5400" },
    TON: { entry: "6.120", exit: "6.540", stop: "5.940" },
  };

  if (byBase[base]) {
    return byBase[base];
  }

  if (getForexCurrencies(symbol)) {
    if (quote === "JPY") {
      return { entry: "145.280", exit: "145.860", stop: "144.920" };
    }
    if (quote === "CHF") {
      return { entry: "0.88420", exit: "0.88960", stop: "0.88040" };
    }
    if (quote === "CAD") {
      return { entry: "1.35840", exit: "1.36420", stop: "1.35380" };
    }
    return { entry: "1.08452", exit: "1.08632", stop: "1.08200" };
  }

  if (quote === "USDT") {
    return { entry: "64250.00", exit: "65880.00", stop: "63120.00" };
  }

  return { entry: "1.08452", exit: "1.08632", stop: "1.08200" };
}

function getIndexFlagCode(symbol: string) {
  const normalized = canonicalSymbol(symbol);
  if (/^(US|SPX|NAS|DJI|DJT|NDX|US30|US100|US500)/.test(normalized)) return "us";
  if (/^(GER|DE|DAX|EU)/.test(normalized)) return "de";
  if (/^(UK|FTSE)/.test(normalized)) return "gb";
  if (/^(JP|JPN|NIK|NKY)/.test(normalized)) return "jp";
  if (/^(HK|HSI)/.test(normalized)) return "hk";
  if (/^(FRA|CAC)/.test(normalized)) return "fr";
  if (/^(ESP|IBEX)/.test(normalized)) return "es";
  if (/^(AUS|ASX)/.test(normalized)) return "au";
  if (/^(CHN|CSI|SSE)/.test(normalized)) return "cn";
  return null;
}

function symbolBadge(item: SymbolItem) {
  const type = (item.type || "").toLowerCase();
  if (type.includes("crypto")) return "₿";
  if (type.includes("forex")) return "FX";
  if (type.includes("index")) return "IX";
  if (type.includes("stock")) return "EQ";
  if (type.includes("commodity")) return "CM";
  return item.symbol.slice(0, 2).toUpperCase();
}

function renderSymbolLogo(item: SymbolItem) {
  const type = inferSymbolType(item);
  const pair = splitPairSymbol(item.symbol);
  const forexCurrencies = getForexCurrencies(item.symbol);

  if (forexCurrencies) {
    const [base, quote] = forexCurrencies;
    const baseFlag = countryFlag(base);
    const quoteFlag = countryFlag(quote);

    return (
      <span className={styles.symbolPairLogo} aria-hidden="true">
        <span className={styles.symbolCoin}>
          {baseFlag ? <span className={`fi fi-${baseFlag} ${styles.flagGlyph}`} /> : <span>{base}</span>}
        </span>
        <span className={`${styles.symbolCoin} ${styles.symbolCoinOffset}`}>
          {quoteFlag ? <span className={`fi fi-${quoteFlag} ${styles.flagGlyph}`} /> : <span>{quote}</span>}
        </span>
      </span>
    );
  }

  if (pair) {
    const [base, quote] = pair;
    return (
      <span className={styles.symbolPairLogo} aria-hidden="true">
        <span className={`${styles.symbolCoin} ${assetCoinClass(base)}`}>{renderAssetGlyph(base)}</span>
        <span className={`${styles.symbolCoin} ${styles.symbolCoinOffset} ${assetCoinClass(quote)}`}>{renderAssetGlyph(quote)}</span>
      </span>
    );
  }

  if (type.includes("index")) {
    const flagCode = getIndexFlagCode(item.symbol);
    if (flagCode) {
      return (
        <span className={styles.symbolLogo} aria-hidden="true">
          <span className={`fi fi-${flagCode} ${styles.flagGlyph}`} />
        </span>
      );
    }
  }

  if (type.includes("commodity")) {
    const normalized = canonicalSymbol(item.symbol);
    const metalLabel =
      normalized.startsWith("XAU") ? "Au" : normalized.startsWith("XAG") ? "Ag" : normalized.startsWith("XPT") ? "Pt" : normalized.startsWith("XPD") ? "Pd" : "CM";
    return <span className={`${styles.symbolLogo} ${styles.symbolCommodity}`}>{metalLabel}</span>;
  }

  if (type.includes("crypto")) {
    const normalized = canonicalSymbol(item.symbol);
    const cryptoLabel = normalized.startsWith("BTC") ? "B" : normalized.startsWith("ETH") ? "E" : normalized.slice(0, 2);
    return <span className={`${styles.symbolLogo} ${styles.symbolCrypto}`}>{cryptoLabel}</span>;
  }

  return <span className={styles.symbolLogo}>{symbolBadge(item)}</span>;
}

function assetCoinClass(code: string) {
  if (countryFlag(code)) return styles.symbolCoinFlag;
  if (METAL_LABEL_MAP[code]) return styles.symbolCoinCommodity;
  if (CRYPTO_LABEL_MAP[code]) return styles.symbolCoinCrypto;
  return styles.symbolCoinGeneric;
}

function renderAssetGlyph(code: string) {
  const flag = countryFlag(code);
  if (flag) {
    return <span className={`fi fi-${flag} ${styles.flagGlyph}`} />;
  }

  if (METAL_ICON_MAP[code]) {
    return <img className={styles.assetIcon} src={METAL_ICON_MAP[code]} alt="" aria-hidden="true" />;
  }

  if (CRYPTO_ICON_MAP[code]) {
    return <img className={styles.assetIcon} src={CRYPTO_ICON_MAP[code]} alt="" aria-hidden="true" />;
  }

  if (METAL_LABEL_MAP[code]) {
    return <span className={styles.assetText}>{METAL_LABEL_MAP[code]}</span>;
  }

  if (CRYPTO_LABEL_MAP[code]) {
    return <span className={styles.assetText}>{CRYPTO_LABEL_MAP[code]}</span>;
  }

  return <span className={styles.assetText}>{code.slice(0, 2)}</span>;
}

type TradeShareBuilderProps = {
  initialTimeZone: string;
};

export default function TradeShareBuilder({ initialTimeZone }: TradeShareBuilderProps) {
  const [symbol, setSymbol] = useState("");
  const [timeZone, setTimeZone] = useState(initialTimeZone || "UTC");
  const [positionSide, setPositionSide] = useState<PositionSide | "">("");
  const [entryAt, setEntryAt] = useState("");
  const [exitAt, setExitAt] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [symbolSuggestions, setSymbolSuggestions] = useState<string[]>([]);
  const [lookupSuggestions, setLookupSuggestions] = useState<SymbolItem[]>(POPULAR_SYMBOLS);
  const [showSymbolList, setShowSymbolList] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const symbolBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeZone(initialTimeZone || "UTC");
  }, [initialTimeZone]);

  useEffect(() => {
    return () => {
      if (symbolBlurTimerRef.current) {
        clearTimeout(symbolBlurTimerRef.current);
      }
    };
  }, []);

  const manualEntryPrice = Number(data?.entryPriceInput ?? entryPrice ?? 0);
  const manualStopLoss = Number(stopLoss);
  const manualExitPrice = Number(data?.exitPriceInput ?? exitPrice ?? 0);
  const riskValue = Math.abs(Number(riskPercent));

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
        const merged = [...json.items, ...POPULAR_SYMBOLS];
        const seen = new Set<string>();
        const dedup = merged.filter((x) => {
          const key = x.symbol ? canonicalSymbol(x.symbol) : "";
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
    };
  }, [data]);

  const pricePlaceholders = useMemo(() => getPricePlaceholders(symbol), [symbol]);

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
    const entryNum = Number(entryPrice);
    const stopNum = Number(stopLoss);
    const exitNum = Number(exitPrice);
    const riskNum = Number(riskPercent);
    if (!Number.isFinite(entryNum) || entryNum <= 0 || !Number.isFinite(exitNum) || exitNum <= 0) {
      setError("Enter entry and exit prices");
      return;
    }
    if (!Number.isFinite(stopNum) || stopNum <= 0) {
      setError("Enter stop loss");
      return;
    }
    if (!Number.isFinite(riskNum) || riskNum <= 0) {
      setError("Enter risk percent");
      return;
    }
    if (positionSide === "long" && stopNum >= entryNum) {
      setError("For long trades, stop loss must be below entry");
      return;
    }
    if (positionSide === "short" && stopNum <= entryNum) {
      setError("For short trades, stop loss must be above entry");
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
          entryAt,
          exitAt,
          timeZone,
          entryPrice,
          exitPrice,
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
    if (!data) return;
    try {
      setDownloading(true);
      const res = await fetch("/api/trade-share/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: data,
          positionSide,
          stopLoss,
          riskPercent,
          timeZone,
        }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || "Failed to export image");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `consist-trade-${(data.symbol || "card").replace(/[^\w-]+/g, "-").toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Failed to download image. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  const tradeDirection = positionSide === "short" ? "Short" : "Long";
  const rrValue =
    Number.isFinite(manualEntryPrice) &&
    Number.isFinite(manualStopLoss) &&
    Number.isFinite(manualExitPrice) &&
    manualEntryPrice > 0
      ? positionSide === "short"
        ? (manualEntryPrice - manualExitPrice) / (manualStopLoss - manualEntryPrice)
        : (manualExitPrice - manualEntryPrice) / (manualEntryPrice - manualStopLoss)
      : null;
  const tradeOutcome =
    rrValue !== null && Number.isFinite(rrValue)
      ? rrValue > 0
        ? "profit"
        : rrValue < 0
          ? "loss"
          : "breakeven"
      : null;
  const pnlPct =
    rrValue !== null && Number.isFinite(rrValue) ? riskValue * rrValue : null;
  const resultClass = tradeOutcome === "loss" ? styles.loss : styles.profit;
  const sideClass = positionSide === "short" ? styles.sideShort : styles.sideLong;

  function formatPrice(v: number | string | null) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "n/a";
    return `${n.toFixed(5)} USD`;
  }

  function formatCompactDate(value: string) {
    const d = new Date(value);
    return d.toLocaleString("en-US", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).replace(",", "");
  }

  function formatDuration(start: string, end: string) {
    const diffSec = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    return `${h}h ${m}m`;
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
        <p>Build a trade card from your manual trade data. Timezone: {timeZone}. Chart resolution: Auto.</p>

        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label>Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onFocus={() => {
                if (symbolBlurTimerRef.current) {
                  clearTimeout(symbolBlurTimerRef.current);
                }
                setShowSymbolList(true);
              }}
              onClick={() => setShowSymbolList(true)}
              onPointerDown={() => setShowSymbolList(true)}
              onBlur={() => {
                if (symbolBlurTimerRef.current) {
                  clearTimeout(symbolBlurTimerRef.current);
                }
                symbolBlurTimerRef.current = setTimeout(() => setShowSymbolList(false), 120);
              }}
              placeholder="EUR/USD"
              autoComplete="off"
            />
            <span className={styles.fieldHint}>Supported: forex, metals, crypto</span>
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
                    {renderSymbolLogo(item)}
                    <span className={styles.symbolMeta}>
                      <span className={styles.symbolCode}>{formatSymbolDisplay(item.symbol)}</span>
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
            <label>Side</label>
            <select value={positionSide} onChange={(e) => setPositionSide(e.target.value === "short" ? "short" : e.target.value === "long" ? "long" : "")}>
              <option value="">Choose side</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
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
            <label>Entry price</label>
            <input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder={pricePlaceholders.entry} />
          </div>
          <div className={styles.field}>
            <label>Exit price</label>
            <input value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder={pricePlaceholders.exit} />
          </div>
          <div className={styles.field}>
            <label>Stop loss</label>
            <input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder={pricePlaceholders.stop} />
          </div>
          <div className={styles.field}>
            <label>Risk (%)</label>
            <input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder="e.g. 2" />
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
            disabled={!data || downloading || loading}
          >
            {downloading ? "Exporting..." : "Download card (PNG)"}
          </button>
          {error ? <span className={styles.error}>{error}</span> : null}
        </div>
        {data ? <div className={styles.metaNote}>Rendered on {data.interval}</div> : null}
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
        <div className={styles.cardViewport}>
          <div className={styles.cardScale}>
            <div className={styles.figmaCard}>
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
            <path d={chart.fillPath} fill={tradeOutcome === "loss" ? "url(#trade-gradient-loss)" : "url(#trade-gradient)"} />
            <path
              d={chart.segPath}
              fill="none"
              stroke={tradeOutcome === "loss" ? "#FF6B7A" : "#00FFA3"}
              strokeWidth="2"
              opacity="0.8"
              filter="url(#position-glow-blur)"
            />
            <path d={chart.segPath} fill="none" stroke={tradeOutcome === "loss" ? "#FF6B7A" : "#00FFA3"} strokeWidth="3.4" />
            <circle
              cx={chart.entryX}
              cy={chart.toY(data.points[data.entryIndex].c)}
              r="6.5"
              fill="#0f1424"
              stroke="#ffd24a"
              strokeWidth="4"
            />
            <circle
              cx={chart.exitX}
              cy={chart.toY(data.points[data.exitIndex].c)}
              r="6.5"
              fill="#0f1424"
              stroke={tradeOutcome === "loss" ? "#ff6b7a" : "#00ffa3"}
              strokeWidth="4"
            />
          </svg>

          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span>Entry price</span>
              <strong>{formatPrice(data.entryPriceInput)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Exit price</span>
              <strong>{formatPrice(data.exitPriceInput)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Stop loss</span>
              <strong>{formatPrice(stopLoss)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Open Date</span>
              <strong>{formatCompactDate(data.entryTime)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Close Date</span>
              <strong>{formatCompactDate(data.exitTime)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Duration</span>
              <strong>{formatDuration(data.entryTime, data.exitTime)}</strong>
            </div>
            <div className={styles.infoRow}>
              <span>Risk</span>
              <strong>{riskPercent || "0.00"}%</strong>
            </div>
            <div className={styles.infoRow}>
              <span>RR</span>
              <strong>{rrValue !== null && Number.isFinite(rrValue) ? rrValue.toFixed(2) : "0.00"}</strong>
            </div>
          </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

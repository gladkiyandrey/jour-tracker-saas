export type ResolvedSymbol = {
  symbol: string;
  exchange?: string;
};

export type CuratedSymbolItem = {
  symbol: string;
  name: string;
  exchange?: string;
  currency?: string;
  type: string;
  resolved: ResolvedSymbol;
  requiresPro?: boolean;
};

const CURATED_SYMBOLS: CuratedSymbolItem[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", currency: "USD", type: "forex", resolved: { symbol: "EUR/USD" } },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", currency: "USD", type: "forex", resolved: { symbol: "GBP/USD" } },
  { symbol: "USD/JPY", name: "US Dollar / Yen", currency: "JPY", type: "forex", resolved: { symbol: "USD/JPY" } },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", currency: "CHF", type: "forex", resolved: { symbol: "USD/CHF" } },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", currency: "USD", type: "forex", resolved: { symbol: "AUD/USD" } },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar", currency: "USD", type: "forex", resolved: { symbol: "NZD/USD" } },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", currency: "CAD", type: "forex", resolved: { symbol: "USD/CAD" } },
  { symbol: "EUR/JPY", name: "Euro / Yen", currency: "JPY", type: "forex", resolved: { symbol: "EUR/JPY" } },
  { symbol: "GBP/JPY", name: "British Pound / Yen", currency: "JPY", type: "forex", resolved: { symbol: "GBP/JPY" } },
  { symbol: "EUR/GBP", name: "Euro / British Pound", currency: "GBP", type: "forex", resolved: { symbol: "EUR/GBP" } },
  { symbol: "EUR/CHF", name: "Euro / Swiss Franc", currency: "CHF", type: "forex", resolved: { symbol: "EUR/CHF" } },
  { symbol: "GBP/CHF", name: "British Pound / Swiss Franc", currency: "CHF", type: "forex", resolved: { symbol: "GBP/CHF" } },
  { symbol: "XAU/USD", name: "Gold / US Dollar", currency: "USD", type: "commodity", resolved: { symbol: "XAU/USD" } },
  { symbol: "XAG/USD", name: "Silver / US Dollar", currency: "USD", type: "commodity", resolved: { symbol: "XAG/USD" } },
  { symbol: "XPT/USD", name: "Platinum / US Dollar", currency: "USD", type: "commodity", resolved: { symbol: "XPT/USD" } },
  { symbol: "XPD/USD", name: "Palladium / US Dollar", currency: "USD", type: "commodity", resolved: { symbol: "XPD/USD" } },
  { symbol: "BTC/USD", name: "Bitcoin / US Dollar", currency: "USD", type: "cryptocurrency", resolved: { symbol: "BTC/USD" } },
  { symbol: "ETH/USD", name: "Ethereum / US Dollar", currency: "USD", type: "cryptocurrency", resolved: { symbol: "ETH/USD" } },
  { symbol: "SOL/USD", name: "Solana / US Dollar", currency: "USD", type: "cryptocurrency", resolved: { symbol: "SOL/USD" } },
  { symbol: "XRP/USD", name: "XRP / US Dollar", currency: "USD", type: "cryptocurrency", resolved: { symbol: "XRP/USD" } },
  { symbol: "ADA/USD", name: "Cardano / US Dollar", currency: "USD", type: "cryptocurrency", resolved: { symbol: "ADA/USD" } },
  { symbol: "DOGE/USD", name: "Dogecoin / US Dollar", currency: "USD", type: "cryptocurrency", resolved: { symbol: "DOGE/USD" } },
  { symbol: "GER40", name: "DAX 40", exchange: "XETR", type: "index", requiresPro: true, resolved: { symbol: "GDAXI", exchange: "XETR" } },
  { symbol: "GER30", name: "DAX 40", exchange: "XETR", type: "index", requiresPro: true, resolved: { symbol: "GDAXI", exchange: "XETR" } },
  { symbol: "DAX", name: "DAX 40", exchange: "XETR", type: "index", requiresPro: true, resolved: { symbol: "GDAXI", exchange: "XETR" } },
  { symbol: "DE40", name: "DAX 40", exchange: "XETR", type: "index", requiresPro: true, resolved: { symbol: "GDAXI", exchange: "XETR" } },
  { symbol: "FRA40", name: "CAC 40", exchange: "Euronext", type: "index", requiresPro: true, resolved: { symbol: "FCHI", exchange: "Euronext" } },
  { symbol: "CAC40", name: "CAC 40", exchange: "Euronext", type: "index", requiresPro: true, resolved: { symbol: "FCHI", exchange: "Euronext" } },
  { symbol: "UK100", name: "FTSE 100", exchange: "LSE", type: "index", requiresPro: true, resolved: { symbol: "FTSE", exchange: "LSE" } },
  { symbol: "FTSE100", name: "FTSE 100", exchange: "LSE", type: "index", requiresPro: true, resolved: { symbol: "FTSE", exchange: "LSE" } },
  { symbol: "JP225", name: "Nikkei 225", exchange: "JPX", type: "index", requiresPro: true, resolved: { symbol: "N225", exchange: "JPX" } },
  { symbol: "NIKKEI", name: "Nikkei 225", exchange: "JPX", type: "index", requiresPro: true, resolved: { symbol: "N225", exchange: "JPX" } },
  { symbol: "NIKKEI225", name: "Nikkei 225", exchange: "JPX", type: "index", requiresPro: true, resolved: { symbol: "N225", exchange: "JPX" } },
  { symbol: "HK50", name: "Hang Seng", exchange: "HKEX", type: "index", requiresPro: true, resolved: { symbol: "HSI", exchange: "HKEX" } },
  { symbol: "HANGSENG", name: "Hang Seng", exchange: "HKEX", type: "index", requiresPro: true, resolved: { symbol: "HSI", exchange: "HKEX" } },
  { symbol: "AU200", name: "ASX 200", exchange: "ASX", type: "index", requiresPro: true, resolved: { symbol: "AXJO", exchange: "ASX" } },
  { symbol: "ASX200", name: "ASX 200", exchange: "ASX", type: "index", requiresPro: true, resolved: { symbol: "AXJO", exchange: "ASX" } },
  { symbol: "ESP35", name: "IBEX 35", exchange: "BME", type: "index", requiresPro: true, resolved: { symbol: "IBEX", exchange: "BME" } },
  { symbol: "IBEX35", name: "IBEX 35", exchange: "BME", type: "index", requiresPro: true, resolved: { symbol: "IBEX", exchange: "BME" } },
  { symbol: "EU50", name: "Euro Stoxx 50", exchange: "SIX", type: "index", requiresPro: true, resolved: { symbol: "STOXX50E", exchange: "SIX" } },
  { symbol: "ESTX50", name: "Euro Stoxx 50", exchange: "SIX", type: "index", requiresPro: true, resolved: { symbol: "STOXX50E", exchange: "SIX" } },
  { symbol: "US30", name: "Dow Jones 30", type: "index", requiresPro: true, resolved: { symbol: "DJI" } },
  { symbol: "DJ30", name: "Dow Jones 30", type: "index", requiresPro: true, resolved: { symbol: "DJI" } },
  { symbol: "WALLSTREET30", name: "Dow Jones 30", type: "index", requiresPro: true, resolved: { symbol: "DJI" } },
  { symbol: "US100", name: "Nasdaq 100", type: "index", requiresPro: true, resolved: { symbol: "NDX" } },
  { symbol: "NAS100", name: "Nasdaq 100", type: "index", requiresPro: true, resolved: { symbol: "NDX" } },
  { symbol: "NASDAQ100", name: "Nasdaq 100", type: "index", requiresPro: true, resolved: { symbol: "NDX" } },
  { symbol: "US500", name: "S&P 500", type: "index", requiresPro: true, resolved: { symbol: "GSPC" } },
  { symbol: "SPX500", name: "S&P 500", type: "index", requiresPro: true, resolved: { symbol: "GSPC" } },
  { symbol: "SP500", name: "S&P 500", type: "index", requiresPro: true, resolved: { symbol: "GSPC" } },
  { symbol: "SPX", name: "S&P 500", type: "index", requiresPro: true, resolved: { symbol: "GSPC" } },
];

const CATALOG_BY_ALIAS = new Map<string, CuratedSymbolItem>();
for (const item of CURATED_SYMBOLS) {
  CATALOG_BY_ALIAS.set(item.symbol.toUpperCase(), item);
  CATALOG_BY_ALIAS.set(canonicalSymbol(item.symbol), item);
}

export function canonicalSymbol(value: string) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function proMarketsEnabled() {
  return process.env.TWELVE_DATA_ENABLE_PRO_MARKETS === "true";
}

export function isCuratedItemAvailable(item: CuratedSymbolItem) {
  return !item.requiresPro || proMarketsEnabled();
}

export function getCuratedAliasMatch(value: string) {
  const trimmed = String(value || "").trim().toUpperCase();
  const canonical = canonicalSymbol(trimmed);
  const curated = CATALOG_BY_ALIAS.get(trimmed) || CATALOG_BY_ALIAS.get(canonical);
  return curated ?? null;
}

export function normalizeRequestedSymbol(value: string): ResolvedSymbol {
  const trimmed = String(value || "").trim().toUpperCase();
  const canonical = canonicalSymbol(trimmed);
  const curated = getCuratedAliasMatch(trimmed);
  if (curated && isCuratedItemAvailable(curated)) return curated.resolved;
  if (/^[A-Z]{6}$/.test(canonical)) {
    return { symbol: `${canonical.slice(0, 3)}/${canonical.slice(3)}` };
  }
  if (/^X(AU|AG|PT|PD)USD$/.test(canonical)) {
    return { symbol: `${canonical.slice(0, 3)}/${canonical.slice(3)}` };
  }
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE)USD$/.test(canonical)) {
    return { symbol: `${canonical.slice(0, canonical.length - 3)}/USD` };
  }
  return { symbol: trimmed };
}

export function symbolVariants(value: string) {
  const trimmed = String(value || "").trim().toUpperCase();
  const canonical = canonicalSymbol(trimmed);
  const normalized = normalizeRequestedSymbol(trimmed);
  return [
    trimmed,
    canonical,
    normalized.symbol,
    /^[A-Z]{6}$/.test(canonical) ? `${canonical.slice(0, 3)}/${canonical.slice(3)}` : "",
    /^X(AU|AG|PT|PD)USD$/.test(canonical) ? `${canonical.slice(0, 3)}/${canonical.slice(3)}` : "",
    /^(BTC|ETH|SOL|XRP|ADA|DOGE)USD$/.test(canonical) ? `${canonical.slice(0, canonical.length - 3)}/USD` : "",
  ].filter(Boolean);
}

export function curatedItemsForQuery(query: string) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [] as CuratedSymbolItem[];
  const upper = trimmed.toUpperCase();
  const canonical = canonicalSymbol(trimmed);
  const lower = trimmed.toLowerCase();

  return CURATED_SYMBOLS
    .filter((item) => isCuratedItemAvailable(item))
    .map((item) => {
      const symbol = item.symbol.toUpperCase();
      const symbolCanonical = canonicalSymbol(item.symbol);
      const resolvedCanonical = canonicalSymbol(item.resolved.symbol);
      const name = item.name.toLowerCase();
      let score = 0;
      if (symbol === upper || symbolCanonical === canonical) score += 200;
      else if (symbol.startsWith(upper) || symbolCanonical.startsWith(canonical)) score += 120;
      else if (symbol.includes(upper) || symbolCanonical.includes(canonical)) score += 70;
      if (resolvedCanonical === canonical) score += 110;
      else if (resolvedCanonical.startsWith(canonical)) score += 60;
      if (name.includes(lower)) score += 40;
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol, "en"))
    .map((row) => row.item);
}

export function curatedSuggestionsForQuery(query: string) {
  return curatedItemsForQuery(query).map((item) => item.symbol);
}

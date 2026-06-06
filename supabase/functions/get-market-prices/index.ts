// supabase/functions/get-market-prices/index.ts
// Aurum Capital – Live Market Price Fetcher
// Deno Edge Function | Project ref: ttwwthfeordsojmcjwxn

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Supabase config (auto-injected by platform) ─────────────────────────────
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ─── Symbol normalisation: edge-function symbols → frontend/DB symbols ────────
const NORM_SYM: Record<string, string> = {
  XAUUSD: "GOLD",
  XAGUSD: "SILVER",
  USOIL:  "OIL",
};

/** Persist freshly-fetched prices to asset_prices so all devices sync via realtime */
async function persistPrices(results: PriceResult[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const rows = results
    .filter(r => r.price > 0)
    .map(r => ({
      sym:        NORM_SYM[r.symbol] ?? r.symbol,
      price:      r.price,
      chg:        r.changePct24h ?? 0,
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/asset_prices`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer":        "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
  } catch (e) {
    console.warn("[persistPrices] DB write failed:", e);
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ─── Asset symbol maps ───────────────────────────────────────────────────────

/** CoinGecko coin IDs for crypto assets */
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  TON: "the-open-network",
};

/** Twelve Data symbols for stocks/forex/commodities */
const STOCK_SYMBOLS: Record<string, string> = {
  AAPL: "AAPL",
  TSLA: "TSLA",
  MSFT: "MSFT",
  GOOGL: "GOOGL",
  AMZN: "AMZN",
  NVDA: "NVDA",
  META: "META",
  NFLX: "NFLX",
  SPY: "SPY",
  QQQ: "QQQ",
  // Forex
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  // Commodities (precious metals as forex pairs; oil as Twelve Data CFD code)
  XAUUSD: "XAU/USD", // Gold spot
  XAGUSD: "XAG/USD", // Silver spot
  // UKOIL = Brent Crude Oil CFD on Twelve Data (BRENT/USD and WTI/USD are not valid symbols)
  USOIL: "UKOIL", // Brent Crude Oil
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriceResult {
  symbol: string;
  price: number;
  change24h: number;       // absolute change
  changePct24h: number;    // percentage change
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  marketCap?: number;
  lastUpdated: string;
  source: "coingecko" | "twelvedata" | "binance" | "yahoo" | "cache";
}

interface CacheEntry {
  data: PriceResult[];
  timestamp: number;
}

// ─── In-memory cache (persists for the lifetime of the isolate) ──────────────
const priceCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCached(key: string): PriceResult[] | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    priceCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: PriceResult[]): void {
  priceCache.set(key, { data, timestamp: Date.now() });
}

// ─── CoinGecko fetcher ───────────────────────────────────────────────────────

async function fetchCryptoPrice(symbols: string[]): Promise<PriceResult[]> {
  const ids = symbols
    .map((s) => COINGECKO_IDS[s.toUpperCase()])
    .filter(Boolean)
    .join(",");

  if (!ids) return [];

  const url =
    `https://api.coingecko.com/api/v3/coins/markets` +
    `?vs_currency=usd&ids=${ids}` +
    `&order=market_cap_desc&per_page=50&page=1` +
    `&price_change_percentage=24h`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko error: ${res.status} ${res.statusText}`);
  }

  const coins: any[] = await res.json();

  // Build reverse map: geckoId → symbol
  const reverseMap: Record<string, string> = {};
  for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
    reverseMap[id] = sym;
  }

  return coins.map((c) => ({
    symbol: reverseMap[c.id] ?? c.symbol.toUpperCase(),
    price: c.current_price ?? 0,
    change24h: c.price_change_24h ?? 0,
    changePct24h: c.price_change_percentage_24h ?? 0,
    high24h: c.high_24h,
    low24h: c.low_24h,
    volume24h: c.total_volume,
    marketCap: c.market_cap,
    lastUpdated: c.last_updated ?? new Date().toISOString(),
    source: "coingecko" as const,
  }));
}

// ─── Twelve Data fetcher (stocks / forex / commodities) ─────────────────────
// Fetches each symbol individually in parallel so one bad symbol (e.g. an
// unsupported commodity pair) cannot silently break the entire batch.

async function fetchOneTwelveDataSymbol(
  frontSym: string,
  tdSym: string,
  apiKey: string,
): Promise<PriceResult | null> {
  // Slashes in forex/commodity symbols (XAU/USD) must be passed literally —
  // Twelve Data does not accept percent-encoded slashes in this field.
  const url =
    `https://api.twelvedata.com/quote?symbol=${tdSym}&apikey=${apiKey}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.warn(`[TD] ${frontSym} HTTP ${res.status}`);
    return null;
  }

  const e = await res.json();

  // Twelve Data error response carries a `code` or `status:"error"` field
  if (e.code || e.status === "error") {
    console.warn(`[TD] ${frontSym} error: ${e.message ?? e.code}`);
    return null;
  }

  const price = parseFloat(e.close ?? e.price ?? "0");
  if (!(price > 0)) return null;

  const prevClose = parseFloat(e.previous_close ?? "0");
  const rawPct    = parseFloat(e.percent_change ?? "");
  const changePct = !isNaN(rawPct)
    ? rawPct
    : prevClose > 0 ? (price - prevClose) / prevClose * 100 : 0;
  const rawChange = parseFloat(e.change ?? "");
  const change    = !isNaN(rawChange) ? rawChange : price - prevClose;

  console.info(`[TD] ${frontSym} = ${price}`);
  return {
    symbol: frontSym,
    price,
    change24h: change,
    changePct24h: +changePct.toFixed(4),
    high24h: parseFloat(e.high ?? "0"),
    low24h:  parseFloat(e.low  ?? "0"),
    volume24h: parseFloat(e.volume ?? "0"),
    lastUpdated: e.datetime
      ? new Date(e.datetime).toISOString()
      : new Date().toISOString(),
    source: "twelvedata" as const,
  };
}

async function fetchStockPrice(symbols: string[]): Promise<PriceResult[]> {
  const TWELVE_DATA_KEY = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!TWELVE_DATA_KEY) {
    console.warn("TWELVE_DATA_API_KEY not set – skipping stock/forex fetch");
    return [];
  }

  // Build list of (frontendSymbol, twelveDataSymbol) pairs
  const pairs: Array<[string, string]> = symbols
    .map((s): [string, string] | null => {
      const tdSym = STOCK_SYMBOLS[s.toUpperCase()];
      return tdSym ? [s.toUpperCase(), tdSym] : null;
    })
    .filter((p): p is [string, string] => p !== null);

  if (!pairs.length) return [];

  // Fetch all symbols in parallel; a failure on one does not affect others
  const settled = await Promise.allSettled(
    pairs.map(([front, td]) => fetchOneTwelveDataSymbol(front, td, TWELVE_DATA_KEY)),
  );

  const results: PriceResult[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      results.push(r.value);
    } else if (r.status === "rejected") {
      console.warn(`[TD] ${pairs[i][0]} fetch threw:`, r.reason);
    }
  });

  return results;
}

// ─── Binance fallback for single-symbol real-time price ──────────────────────

async function fetchBinanceFallback(symbol: string): Promise<PriceResult | null> {
  const pair = `${symbol.toUpperCase()}USDT`;
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      symbol: symbol.toUpperCase(),
      price: parseFloat(d.lastPrice),
      change24h: parseFloat(d.priceChange),
      changePct24h: parseFloat(d.priceChangePercent),
      high24h: parseFloat(d.highPrice),
      low24h: parseFloat(d.lowPrice),
      volume24h: parseFloat(d.volume),
      lastUpdated: new Date().toISOString(),
      source: "binance" as const,
    };
  } catch {
    return null;
  }
}

// ─── Commodity fallbacks: oil + silver ───────────────────────────────────────
// Twelve Data Basic plan does not include crude oil or silver futures.
// Strategy: Yahoo Finance v8/chart (no crumb/cookie needed) → metals.live for silver.

/** Yahoo Finance v8/chart — works without session crumbs unlike v7/quote */
async function fetchYahooChart(
  frontSym: string,
  yahooTicker: string,
): Promise<PriceResult | null> {
  // NOTE: do NOT encodeURIComponent — Yahoo needs the literal = in "BZ=F"
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}` +
    `?interval=1d&range=2d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) { console.warn(`[YF] ${frontSym} HTTP ${res.status}`); return null; }
    const json   = await res.json();
    const meta   = json?.chart?.result?.[0]?.meta;
    const price  = meta?.regularMarketPrice;
    if (!(price > 0)) { console.warn(`[YF] ${frontSym} no price in response`); return null; }
    const prev      = meta.previousClose ?? meta.chartPreviousClose ?? 0;
    const change    = prev > 0 ? +(price - prev).toFixed(4)                  : 0;
    const changePct = prev > 0 ? +((price - prev) / prev * 100).toFixed(4)   : 0;
    console.info(`[YF] ${frontSym} (${yahooTicker}) = ${price}`);
    return {
      symbol:       frontSym,
      price,
      change24h:    change,
      changePct24h: changePct,
      high24h:      meta.regularMarketDayHigh,
      low24h:       meta.regularMarketDayLow,
      volume24h:    meta.regularMarketVolume,
      lastUpdated:  new Date().toISOString(),
      source:       "yahoo" as const,
    };
  } catch (err) {
    console.warn(`[YF] ${frontSym} error:`, String(err));
    return null;
  }
}

/** metals.live — free, no API key, real-time precious-metal spot prices */
async function fetchMetalsLive(
  frontSym: string,
  metalKey: string,
): Promise<PriceResult | null> {
  try {
    const res = await fetch("https://metals.live/api/v1/spot", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const raw    = await res.json();
    // Response is either an object or a single-element array
    const record = Array.isArray(raw) ? raw[0] : raw;
    const price  = record?.[metalKey];
    if (!(price > 0)) return null;
    console.info(`[metals.live] ${frontSym} (${metalKey}) = ${price}`);
    return {
      symbol:       frontSym,
      price,
      change24h:    0,
      changePct24h: 0,
      lastUpdated:  new Date().toISOString(),
      source:       "yahoo" as const,
    };
  } catch (err) {
    console.warn("[metals.live] error:", String(err));
    return null;
  }
}

/** Fetch any missing commodity symbols using the above fallbacks */
async function fetchMissingCommodities(missing: string[]): Promise<PriceResult[]> {
  const settled = await Promise.allSettled(
    missing.map(async (sym): Promise<PriceResult | null> => {
      if (sym === "USOIL") {
        return await fetchYahooChart("USOIL", "BZ=F");
      }
      if (sym === "XAGUSD") {
        // Try Yahoo Finance first; fall back to metals.live
        const yf = await fetchYahooChart("XAGUSD", "SI=F");
        return yf ?? await fetchMetalsLive("XAGUSD", "XAG");
      }
      return null;
    }),
  );
  return settled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is PriceResult => v !== null);
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);

    // Parse requested symbols from query string or JSON body
    let symbols: string[] = [];

    const querySymbols = url.searchParams.get("symbols");
    if (querySymbols) {
      symbols = querySymbols.split(",").map((s) => s.trim().toUpperCase());
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body.symbols)) {
        symbols = body.symbols.map((s: string) => s.trim().toUpperCase());
      }
    }

    // Default: all assets shown across dashboard, trade, and invest pages
    if (symbols.length === 0) {
      symbols = [
        "BTC","ETH","SOL","BNB","XRP","ADA","LTC",
        "TSLA","AAPL","NVDA","MSFT","AMZN","GOOGL",
        "XAUUSD","USOIL","XAGUSD",
      ];
    }

    const cacheKey = symbols.sort().join(",");
    const cached = getCached(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ success: true, data: cached, cached: true }),
        {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=30",
          },
        }
      );
    }

    // Separate crypto from stocks/forex
    const cryptoSymbols = symbols.filter((s) => COINGECKO_IDS[s]);
    const stockSymbols = symbols.filter((s) => STOCK_SYMBOLS[s]);

    const results: PriceResult[] = [];

    // Fetch crypto
    if (cryptoSymbols.length > 0) {
      try {
        const cryptoPrices = await fetchCryptoPrice(cryptoSymbols);
        results.push(...cryptoPrices);
      } catch (err) {
        console.error("CoinGecko fetch failed:", err);
        // Binance fallback for each failed crypto symbol
        const fetched = results.map((r) => r.symbol);
        const missing = cryptoSymbols.filter((s) => !fetched.includes(s));
        await Promise.all(
          missing.map(async (s) => {
            const fallback = await fetchBinanceFallback(s);
            if (fallback) results.push(fallback);
          })
        );
      }
    }

    // Fetch stocks / forex / commodities via Twelve Data
    if (stockSymbols.length > 0) {
      try {
        const stockPrices = await fetchStockPrice(stockSymbols);
        results.push(...stockPrices);
      } catch (err) {
        console.error("Twelve Data fetch failed:", err);
      }
    }

    // Commodity fallback — fetch oil & silver if Twelve Data didn't return them
    const fetchedSyms   = new Set(results.map((r) => r.symbol));
    const commoditySyms = ["USOIL", "XAGUSD"];
    const missingComm   = commoditySyms.filter(
      (s) => symbols.includes(s) && !fetchedSyms.has(s),
    );
    if (missingComm.length > 0) {
      const commPrices = await fetchMissingCommodities(missingComm);
      results.push(...commPrices);
    }

    // Cache and persist to DB for cross-device realtime sync (fire-and-forget)
    setCache(cacheKey, results);
    persistPrices(results);

    return new Response(
      JSON.stringify({ success: true, data: results, cached: false }),
      {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=30",
        },
      }
    );
  } catch (err) {
    console.error("get-market-prices error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
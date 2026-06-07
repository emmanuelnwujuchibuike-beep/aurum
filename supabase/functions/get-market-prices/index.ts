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

/**
 * Twelve Data symbols for stocks/forex/commodities.
 * Slashes in forex pairs (e.g. XAU/USD) are passed literally — Twelve Data
 * does NOT accept percent-encoded slashes in the symbol parameter.
 */
const STOCK_SYMBOLS: Record<string, string> = {
  AAPL:   "AAPL",
  TSLA:   "TSLA",
  MSFT:   "MSFT",
  GOOGL:  "GOOGL",
  AMZN:   "AMZN",
  NVDA:   "NVDA",
  META:   "META",
  NFLX:   "NFLX",
  SPY:    "SPY",
  QQQ:    "QQQ",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  USOIL:  "UKOIL",
};

/**
 * Yahoo Finance tickers — free fallback for every non-crypto symbol.
 * Futures: GC=F (gold), SI=F (silver), BZ=F (Brent crude), CL=F (WTI crude)
 * Forex:   EURUSD=X, GBPUSD=X, USDJPY=X
 */
const YAHOO_TICKERS: Record<string, string> = {
  AAPL:   "AAPL",
  TSLA:   "TSLA",
  MSFT:   "MSFT",
  GOOGL:  "GOOGL",
  AMZN:   "AMZN",
  NVDA:   "NVDA",
  META:   "META",
  NFLX:   "NFLX",
  SPY:    "SPY",
  QQQ:    "QQQ",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
  USOIL:  "BZ=F",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriceResult {
  symbol: string;
  price: number;
  change24h: number;
  changePct24h: number;
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
const CACHE_TTL_MS = 30_000;

function getCached(key: string): PriceResult[] | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) { priceCache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: PriceResult[]): void {
  priceCache.set(key, { data, timestamp: Date.now() });
}

// ─── CoinGecko fetcher ───────────────────────────────────────────────────────

async function fetchCryptoPrice(symbols: string[]): Promise<PriceResult[]> {
  const ids = symbols.map(s => COINGECKO_IDS[s.toUpperCase()]).filter(Boolean).join(",");
  if (!ids) return [];

  const url =
    `https://api.coingecko.com/api/v3/coins/markets` +
    `?vs_currency=usd&ids=${ids}` +
    `&order=market_cap_desc&per_page=50&page=1` +
    `&price_change_percentage=24h`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status} ${res.statusText}`);

  const coins: any[] = await res.json();
  const reverseMap: Record<string, string> = {};
  for (const [sym, id] of Object.entries(COINGECKO_IDS)) reverseMap[id] = sym;

  return coins.map(c => ({
    symbol:       reverseMap[c.id] ?? c.symbol.toUpperCase(),
    price:        c.current_price ?? 0,
    change24h:    c.price_change_24h ?? 0,
    changePct24h: c.price_change_percentage_24h ?? 0,
    high24h:      c.high_24h,
    low24h:       c.low_24h,
    volume24h:    c.total_volume,
    marketCap:    c.market_cap,
    lastUpdated:  c.last_updated ?? new Date().toISOString(),
    source:       "coingecko" as const,
  }));
}

// ─── Twelve Data fetcher — SINGLE BATCH REQUEST ──────────────────────────────
// Fetch all stock/forex/commodity symbols in ONE request instead of N parallel
// requests. This keeps usage well within the 8 req/min free-tier limit.

async function fetchStockPriceBatch(symbols: string[]): Promise<PriceResult[]> {
  const TWELVE_DATA_KEY = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!TWELVE_DATA_KEY) {
    console.warn("[TD] TWELVE_DATA_API_KEY not set — falling back to Yahoo Finance");
    return [];
  }

  const pairs: Array<[string, string]> = symbols
    .map((s): [string, string] | null => {
      const td = STOCK_SYMBOLS[s.toUpperCase()];
      return td ? [s.toUpperCase(), td] : null;
    })
    .filter((p): p is [string, string] => p !== null);

  if (!pairs.length) return [];

  // Single comma-separated batch request — 1 API call instead of N
  const tdSymsJoined = pairs.map(([, td]) => td).join(",");
  const url = `https://api.twelvedata.com/quote?symbol=${tdSymsJoined}&apikey=${TWELVE_DATA_KEY}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[TD] Batch HTTP ${res.status} — will use Yahoo Finance fallback`);
      return [];
    }

    const data = await res.json();

    // Single-symbol response: the quote object itself
    // Multi-symbol response: { "TSLA": {...}, "XAU/USD": {...}, ... }
    const isMulti = pairs.length > 1;
    const results: PriceResult[] = [];

    for (const [frontSym, tdSym] of pairs) {
      const e = isMulti ? (data[tdSym] ?? data[frontSym]) : data;
      if (!e || e.code || e.status === "error") {
        console.warn(`[TD] ${frontSym} no data:`, e?.message ?? e?.code ?? "empty");
        continue;
      }
      const price = parseFloat(e.close ?? e.price ?? "0");
      if (!(price > 0)) continue;

      const prevClose = parseFloat(e.previous_close ?? "0");
      const rawPct    = parseFloat(e.percent_change ?? "");
      const changePct = !isNaN(rawPct) ? rawPct : prevClose > 0 ? (price - prevClose) / prevClose * 100 : 0;
      const rawChange = parseFloat(e.change ?? "");
      const change    = !isNaN(rawChange) ? rawChange : price - prevClose;

      console.info(`[TD] ${frontSym} = ${price}`);
      results.push({
        symbol:       frontSym,
        price,
        change24h:    change,
        changePct24h: +changePct.toFixed(4),
        high24h:      parseFloat(e.high   ?? "0"),
        low24h:       parseFloat(e.low    ?? "0"),
        volume24h:    parseFloat(e.volume ?? "0"),
        lastUpdated:  e.datetime ? new Date(e.datetime).toISOString() : new Date().toISOString(),
        source:       "twelvedata" as const,
      });
    }

    console.info(`[TD] Batch returned ${results.length}/${pairs.length} symbols`);
    return results;
  } catch (err) {
    console.warn("[TD] Batch fetch error:", String(err));
    return [];
  }
}

// ─── Yahoo Finance fetcher — free fallback for ALL non-crypto symbols ─────────
// Uses the unofficial v8/chart endpoint which works without API keys.

async function fetchYahooChart(
  frontSym: string,
  yahooTicker: string,
): Promise<PriceResult | null> {
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${yahooTicker}` +
    `?interval=1d&range=2d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":     "application/json",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) { console.warn(`[YF] ${frontSym} HTTP ${res.status}`); return null; }

    const json  = await res.json();
    const meta  = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (!(price > 0)) { console.warn(`[YF] ${frontSym} no price in response`); return null; }

    const prev      = meta.previousClose ?? meta.chartPreviousClose ?? 0;
    const change    = prev > 0 ? +(price - prev).toFixed(4)                 : 0;
    const changePct = prev > 0 ? +((price - prev) / prev * 100).toFixed(4)  : 0;

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

/** Fetch all missing non-crypto symbols via Yahoo Finance in parallel */
async function fetchYahooFallback(missing: string[]): Promise<PriceResult[]> {
  const settled = await Promise.allSettled(
    missing.map(sym => {
      const ticker = YAHOO_TICKERS[sym];
      if (!ticker) return Promise.resolve(null);
      return fetchYahooChart(sym, ticker);
    }),
  );
  return settled
    .map(r => r.status === "fulfilled" ? r.value : null)
    .filter((v): v is PriceResult => v !== null);
}

// ─── metals.live — last-resort fallback for precious metals ──────────────────
// Returns troy-ounce spot prices without an API key.

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

// ─── Binance fallback for crypto ─────────────────────────────────────────────

async function fetchBinanceFallback(symbol: string): Promise<PriceResult | null> {
  const pair = `${symbol.toUpperCase()}USDT`;
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      symbol:       symbol.toUpperCase(),
      price:        parseFloat(d.lastPrice),
      change24h:    parseFloat(d.priceChange),
      changePct24h: parseFloat(d.priceChangePercent),
      high24h:      parseFloat(d.highPrice),
      low24h:       parseFloat(d.lowPrice),
      volume24h:    parseFloat(d.volume),
      lastUpdated:  new Date().toISOString(),
      source:       "binance" as const,
    };
  } catch {
    return null;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    let symbols: string[] = [];

    const querySymbols = url.searchParams.get("symbols");
    if (querySymbols) {
      symbols = querySymbols.split(",").map(s => s.trim().toUpperCase());
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body.symbols)) {
        symbols = body.symbols.map((s: string) => s.trim().toUpperCase());
      }
    }

    if (symbols.length === 0) {
      symbols = [
        "BTC","ETH","SOL","BNB","XRP","ADA","LTC",
        "TSLA","AAPL","NVDA","MSFT","AMZN","GOOGL",
        "XAUUSD","USOIL","XAGUSD",
      ];
    }

    const cacheKey = [...symbols].sort().join(",");
    const cached   = getCached(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ success: true, data: cached, cached: true }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } },
      );
    }

    // ── 1. Separate crypto from everything else ───────────────────────────
    const cryptoSymbols   = symbols.filter(s => COINGECKO_IDS[s]);
    const nonCryptoSymbols = symbols.filter(s => !COINGECKO_IDS[s]);

    const results: PriceResult[] = [];

    // ── 2. Fetch crypto via CoinGecko ─────────────────────────────────────
    if (cryptoSymbols.length > 0) {
      try {
        const cryptoPrices = await fetchCryptoPrice(cryptoSymbols);
        results.push(...cryptoPrices);
      } catch (err) {
        console.error("[CoinGecko] fetch failed:", err);
        // Binance fallback per missing crypto symbol
        const fetched = new Set(results.map(r => r.symbol));
        await Promise.allSettled(
          cryptoSymbols.filter(s => !fetched.has(s)).map(async s => {
            const fb = await fetchBinanceFallback(s);
            if (fb) results.push(fb);
          }),
        );
      }
    }

    // ── 3. Fetch stocks/forex/commodities via Twelve Data (single batch) ──
    if (nonCryptoSymbols.length > 0) {
      try {
        const stockPrices = await fetchStockPriceBatch(nonCryptoSymbols);
        results.push(...stockPrices);
      } catch (err) {
        console.error("[TD] Batch failed:", err);
      }
    }

    // ── 4. Yahoo Finance fallback for every missing non-crypto symbol ──────
    //   Covers: all stocks, gold (GC=F), silver (SI=F), oil (BZ=F), forex
    {
      const fetched = new Set(results.map(r => r.symbol));
      const missing = nonCryptoSymbols.filter(s => !fetched.has(s));
      if (missing.length > 0) {
        console.info("[YF] Fallback needed for:", missing.join(", "));
        const yf = await fetchYahooFallback(missing);
        results.push(...yf);
      }
    }

    // ── 5. metals.live last-resort for precious metals still missing ───────
    {
      const fetched = new Set(results.map(r => r.symbol));
      const metalsMissing: Array<[string, string]> = [
        ["XAUUSD", "XAU"],
        ["XAGUSD", "XAG"],
      ].filter(([sym]) => symbols.includes(sym) && !fetched.has(sym)) as Array<[string, string]>;

      if (metalsMissing.length > 0) {
        const settled = await Promise.allSettled(
          metalsMissing.map(([sym, key]) => fetchMetalsLive(sym, key)),
        );
        settled.forEach(r => {
          if (r.status === "fulfilled" && r.value) results.push(r.value);
        });
      }
    }

    console.info(`[get-market-prices] Returning ${results.length} prices (crypto: ${cryptoSymbols.length}, non-crypto: ${nonCryptoSymbols.length})`);

    setCache(cacheKey, results);
    persistPrices(results); // fire-and-forget

    return new Response(
      JSON.stringify({ success: true, data: results, cached: false }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } },
    );
  } catch (err) {
    console.error("[get-market-prices] Unhandled error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});

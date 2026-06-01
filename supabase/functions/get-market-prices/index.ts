// supabase/functions/get-market-prices/index.ts
// Aurum Capital – Live Market Price Fetcher
// Deno Edge Function | Project ref: ttwwthfeordsojmcjwxn

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Commodities
  XAUUSD: "XAU/USD", // Gold
  XAGUSD: "XAG/USD", // Silver
  USOIL: "WTI/USD",  // Oil
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
  source: "coingecko" | "twelvedata" | "binance" | "cache";
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

async function fetchStockPrice(symbols: string[]): Promise<PriceResult[]> {
  const TWELVE_DATA_KEY = Deno.env.get("TWELVE_DATA_API_KEY");
  if (!TWELVE_DATA_KEY) {
    console.warn("TWELVE_DATA_API_KEY not set – skipping stock/forex fetch");
    return [];
  }

  const tdSymbols = symbols
    .map((s) => STOCK_SYMBOLS[s.toUpperCase()])
    .filter(Boolean)
    .join(",");

  if (!tdSymbols) return [];

  const url =
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSymbols)}` +
    `&apikey=${TWELVE_DATA_KEY}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Twelve Data error: ${res.status}`);
  }

  const json = await res.json();

  // If single symbol, Twelve Data returns the object directly (not an array)
  const entries: any[] = Array.isArray(json)
    ? json
    : symbols.length === 1
    ? [json]
    : Object.values(json);

  const reverseMap: Record<string, string> = {};
  for (const [sym, tdSym] of Object.entries(STOCK_SYMBOLS)) {
    reverseMap[tdSym] = sym;
  }

  return entries
    .filter((e) => e && !e.code) // filter error objects
    .map((e) => {
      const price = parseFloat(e.close ?? e.price ?? "0");
      const open = parseFloat(e.open ?? "0");
      const change = price - open;
      const changePct = open !== 0 ? (change / open) * 100 : 0;

      return {
        symbol: reverseMap[e.symbol] ?? e.symbol,
        price,
        change24h: change,
        changePct24h: changePct,
        high24h: parseFloat(e.high ?? "0"),
        low24h: parseFloat(e.low ?? "0"),
        volume24h: parseFloat(e.volume ?? "0"),
        lastUpdated: e.datetime
          ? new Date(e.datetime).toISOString()
          : new Date().toISOString(),
        source: "twelvedata" as const,
      };
    });
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

    // Default: return the most common Aurum assets
    if (symbols.length === 0) {
      symbols = ["BTC", "ETH", "BNB", "SOL", "XRP", "AAPL", "TSLA", "NVDA", "XAUUSD"];
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

    // Fetch stocks / forex / commodities
    if (stockSymbols.length > 0) {
      try {
        const stockPrices = await fetchStockPrice(stockSymbols);
        results.push(...stockPrices);
      } catch (err) {
        console.error("Twelve Data fetch failed:", err);
      }
    }

    // Cache and return
    setCache(cacheKey, results);

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
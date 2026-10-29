// supabase/functions/get-ohlcv/index.ts
// Aurum Capital — Twelve Data Historical OHLCV Fetcher
// Returns time-series candle data for any supported symbol + timeframe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { background, getJSON, setJSON, tryLock } from "../_shared/redis.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/* Map from our frontend symbol → Twelve Data symbol */
const SYM_MAP: Record<string, string> = {
  BTC:    "BTC/USD",
  ETH:    "ETH/USD",
  SOL:    "SOL/USD",
  BNB:    "BNB/USD",
  XRP:    "XRP/USD",
  ADA:    "ADA/USD",
  LTC:    "LTC/USD",
  TSLA:   "TSLA",
  AAPL:   "AAPL",
  NVDA:   "NVDA",
  MSFT:   "MSFT",
  AMZN:   "AMZN",
  GOOGL:  "GOOGL",
  GOLD:   "XAU/USD",
  OIL:    "UKOIL",       // Brent Crude Oil CFD on Twelve Data (BRENT/USD is not a valid symbol)
  SILVER: "XAG/USD",
};

/* Map from our TF codes → Twelve Data interval strings */
const TF_INTERVAL: Record<string, string> = {
  "5M":  "5min",
  "15M": "15min",
  "30M": "30min",
  "1H":  "1h",
  "4H":  "4h",
  "1D":  "1day",
  "1W":  "1week",
  "1M":  "1month",
  "3M":  "1day",   // 3-month view using daily bars
  "1Y":  "1day",   // 1-year view using daily bars
};

/* Number of bars to request per timeframe */
const TF_SIZE: Record<string, number> = {
  "5M":  288,  // 24h of 5m bars
  "15M": 192,  // 48h of 15m bars
  "30M": 168,  // 3.5 days of 30m bars
  "1H":  500,  // ~3 weeks of 1h bars
  "4H":  365,  // ~2 months of 4h bars
  "1D":  500,  // ~1.5 years of daily bars
  "1W":  200,  // ~4 years of weekly bars
  "1M":   60,  // 5 years of monthly bars
  "3M":   90,  // 3 months of daily bars
  "1Y":  365,  // 1 year of daily bars
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const url    = new URL(req.url);
  const sym    = (url.searchParams.get("symbol") ?? "BTC").toUpperCase();
  const tf     = (url.searchParams.get("tf")     ?? "1D").toUpperCase();
  const apiKey = Deno.env.get("TWELVE_DATA_API_KEY") ?? "";

  if (!apiKey) {
    console.warn("[get-ohlcv] TWELVE_DATA_API_KEY not set");
    return new Response(
      JSON.stringify({ success: false, error: "API key not configured" }),
      { headers: { ...CORS, "Content-Type": "application/json" }, status: 500 }
    );
  }

  const tdSym    = SYM_MAP[sym];
  const interval = TF_INTERVAL[tf] ?? "1day";
  const outsize  = TF_SIZE[tf]     ?? 90;

  if (!tdSym) {
    return new Response(
      JSON.stringify({ success: false, error: `Unknown symbol: ${sym}` }),
      { headers: { ...CORS, "Content-Type": "application/json" }, status: 400 }
    );
  }

  const apiUrl =
    `https://api.twelvedata.com/time_series` +
    `?symbol=${encodeURIComponent(tdSym)}` +
    `&interval=${interval}` +
    `&outputsize=${outsize}` +
    `&apikey=${apiKey}`;

  // Optional ?limit=N returns only the newest N bars (values are newest-first);
  // without it the response is unchanged for existing callers.
  const limit = Math.max(0, parseInt(url.searchParams.get("limit") ?? "0", 10) || 0);
  const key   = `ohlcv:v1:${sym}:${tf}`;

  const fetchSeries = async (): Promise<Series> => {
    const resp = await fetch(apiUrl, {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      throw new Error(`Twelve Data HTTP ${resp.status} ${resp.statusText}`);
    }

    const json = await resp.json();

    if (json.status === "error" || !Array.isArray(json.values) || json.values.length === 0) {
      throw new Error(json.message ?? "No data returned by Twelve Data");
    }

    console.info(`[get-ohlcv] ✓ ${sym}/${tf} → ${json.values.length} bars`);
    const series = { values: json.values, meta: json.meta ?? {} };
    await setJSON(key, series, OHLCV_KEEP_SEC);
    return series;
  };

  const ok = (s: Series, producedAt: number, cached: boolean) => new Response(
    JSON.stringify({
      success: true,
      values: limit ? s.values.slice(0, limit) : s.values,
      meta: s.meta,
      cached,
      updatedAt: new Date(producedAt).toISOString(),
    }),
    { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } }
  );

  // Shared Redis cache, stale-while-revalidate: Twelve Data's free plan allows
  // only 8 requests/minute, so every visitor must not hit it directly.
  const hit = await getJSON<Series>(key);
  if (hit?.data?.values?.length) {
    if (Date.now() - hit.t > (OHLCV_FRESH_MS[tf] ?? 300_000) && await tryLock(key, 20)) {
      background(fetchSeries().catch(e => console.warn(`[get-ohlcv] refresh ${key}:`, (e as Error).message)));
    }
    return ok(hit.data, hit.t, true);
  }

  try {
    return ok(await fetchSeries(), Date.now(), false);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[get-ohlcv] ${sym}/${tf} error:`, msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...CORS, "Content-Type": "application/json" }, status: 502 }
    );
  }
});

interface Series { values: Array<Record<string, string>>; meta: Record<string, unknown> }

/* How long cached bars count as fresh, per timeframe */
const OHLCV_FRESH_MS: Record<string, number> = {
  "5M": 60_000, "15M": 120_000, "30M": 120_000, "1H": 300_000, "4H": 600_000,
  "1D": 1_800_000, "1W": 3_600_000, "1M": 3_600_000, "3M": 1_800_000, "1Y": 1_800_000,
};
/* Redis keeps the last good series this long, so a provider outage or 429 still renders */
const OHLCV_KEEP_SEC = 24 * 60 * 60;

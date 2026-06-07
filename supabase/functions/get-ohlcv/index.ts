// supabase/functions/get-ohlcv/index.ts
// Aurum Capital — Twelve Data Historical OHLCV Fetcher
// Returns time-series candle data for any supported symbol + timeframe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  try {
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

    return new Response(
      JSON.stringify({ success: true, values: json.values, meta: json.meta ?? {} }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[get-ohlcv] ${sym}/${tf} error:`, msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...CORS, "Content-Type": "application/json" }, status: 502 }
    );
  }
});

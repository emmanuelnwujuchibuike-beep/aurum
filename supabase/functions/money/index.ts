// supabase/functions/money/index.ts
// Aurum Capital — the only way a customer's balance or holdings change.
//
// POST { action, key, ...params } with the user's access token.
//   buy               { symbol, usd, mode: "trade" | "invest", lock?: "1D"|"1W"|"1M"|"1Y", name?, icon?, color? }
//   sell              { symbol, qty? | usd? }
//   property_withdraw { symbol }
//   swap              { from, to, qty, name?, icon?, color? }
//   cfd_open          { symbol, direction: "long"|"short", lots, tp?, sl?, name?, icon?, color? }
//   cfd_close         { trade_id, auto? }
//
// The server decides the price (real market feed, max 60 s old; properties from the
// admin price list), the fees (site_settings.trading) and whether the customer can
// afford it. `key` makes every request idempotent: retries and double taps return the
// first result and never move money twice. Rate-limited per user via Upstash.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allow } from "../_shared/redis.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const svc = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Holding symbols that differ from the price feed's
const FEED: Record<string, string> = { GOLD: "XAUUSD", SILVER: "XAGUSD", OIL: "USOIL" };
const LOCKS = new Set(["1D", "1W", "1M", "1Y"]);

interface Trading {
  spot_fee: number; invest_fee: number; invest_slippage: number; swap_fee: number;
  cfd_fee: number; cfd_margin: number; property_early_penalty: number; min_trade: number;
  lot_values: Record<string, number>; lock_days: Record<string, number>;
  asset_classes?: Record<string, string[]>;
}

// Settings change rarely; cache per instance for 60 s
let settingsCache: { at: number; trading: Trading; property: Record<string, number> } | null = null;
async function settings() {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache;
  const { data, error } = await svc.from("site_settings").select("key,value").in("key", ["trading", "property_prices"]);
  if (error) throw new Error("Settings unavailable");
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  if (!m.trading || !m.property_prices) throw new Error("Trading settings missing");
  settingsCache = { at: Date.now(), trading: m.trading, property: m.property_prices };
  return settingsCache;
}

function category(sym: string, s: { trading: Trading; property: Record<string, number> }) {
  if (s.property[sym] != null) return "property";
  for (const [cat, list] of Object.entries(s.trading.asset_classes ?? {})) if (list.includes(sym)) return cat;
  return "crypto";
}

/** Real price for one symbol: properties from the admin list, everything else from the feed (≤ 60 s old). */
async function priceOf(sym: string, s: { trading: Trading; property: Record<string, number> }): Promise<number> {
  if (s.property[sym] != null) return Number(s.property[sym]);
  const feedSym = FEED[sym] ?? sym;
  const r = await fetch(`${URL_}/functions/v1/get-market-prices?symbols=${encodeURIComponent(feedSym)}&maxAge=60`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error("Price service unavailable, try again shortly");
  const j = await r.json();
  const row = (j.data ?? []).find((d: { symbol: string }) => d.symbol === feedSym);
  const age = j.updatedAt ? Date.now() - Date.parse(j.updatedAt) : Infinity;
  if (!row || !(row.price > 0)) throw new Error(`No live price for ${sym}, try again shortly`);
  if (age > 5 * 60_000) throw new Error(`Live price for ${sym} is delayed, try again shortly`);
  return Number(row.price);
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const text = (v: unknown, max = 60) => (typeof v === "string" ? v.slice(0, max) : null);
const symbol = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{1,12}$/.test(s)) throw new Error("Unknown asset");
  return s;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // ── who is calling ──
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await createClient(URL_, ANON).auth.getUser(token);
  if (!user) return json({ error: "Please sign in again" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const action = String(body.action ?? "");
  const key = typeof body.key === "string" && body.key.length >= 8 && body.key.length <= 100 ? body.key : null;
  if (!key) return json({ error: "Missing request key" }, 400);

  if (!(await allow(`money:${user.id}`, 30, 60))) {
    return json({ error: "Too many requests. Please wait a moment and try again." }, 429);
  }

  try {
    const s = await settings();
    const t = s.trading;
    const meta = { name: text(body.name), icon: text(body.icon, 40), color: text(body.color, 20) };
    let rpc: string, args: Record<string, unknown>;

    switch (action) {
      case "buy": {
        const sym = symbol(body.symbol), usd = num(body.usd), invest = body.mode === "invest";
        const isProp = category(sym, s) === "property";
        const min = isProp ? Number(s.property[sym]) : t.min_trade;
        if (!usd || usd < min) throw new Error(`Minimum is $${min}`);
        const lock = isProp ? (LOCKS.has(String(body.lock)) ? String(body.lock) : "1D") : null;
        rpc = "mx_buy";
        args = {
          p_user: user.id, p_key: key, p_symbol: sym, p_name: meta.name ?? sym, p_icon: meta.icon, p_color: meta.color,
          p_usd: usd, p_price: await priceOf(sym, s),
          p_fee_rate: invest ? t.invest_fee : t.spot_fee, p_slip_rate: invest ? t.invest_slippage : 0,
          p_lock_days: lock ? t.lock_days[lock] : null, p_lock_label: lock,
        };
        break;
      }
      case "sell": {
        const sym = symbol(body.symbol), price = await priceOf(sym, s);
        const qty = num(body.qty) ?? (num(body.usd) ? Number(body.usd) / price : null);
        if (!qty || qty <= 0) throw new Error("Enter an amount greater than zero");
        rpc = "mx_sell";
        args = { p_user: user.id, p_key: key, p_symbol: sym, p_qty: qty, p_price: price, p_fee_rate: t.spot_fee };
        break;
      }
      case "property_withdraw": {
        const sym = symbol(body.symbol);
        if (category(sym, s) !== "property") throw new Error("Not a property holding");
        rpc = "mx_property_withdraw";
        args = { p_user: user.id, p_key: key, p_symbol: sym, p_unit_price: Number(s.property[sym]), p_penalty_rate: t.property_early_penalty };
        break;
      }
      case "swap": {
        const from = symbol(body.from), to = symbol(body.to), qty = num(body.qty);
        const [fp, tp] = await Promise.all([priceOf(from, s), priceOf(to, s)]);
        rpc = "mx_swap";
        args = {
          p_user: user.id, p_key: key, p_from: from, p_to: to, p_qty: qty, p_from_price: fp, p_to_price: tp,
          p_fee_rate: t.swap_fee, p_to_name: meta.name ?? to, p_to_icon: meta.icon, p_to_color: meta.color,
        };
        break;
      }
      case "cfd_open": {
        const sym = symbol(body.symbol), lots = num(body.lots);
        rpc = "mx_cfd_open";
        args = {
          p_user: user.id, p_key: key, p_symbol: sym, p_name: meta.name ?? sym, p_icon: meta.icon, p_color: meta.color,
          p_direction: String(body.direction), p_lots: lots, p_price: await priceOf(sym, s),
          p_lot_value: t.lot_values[category(sym, s)] ?? t.lot_values.crypto, p_margin_rate: t.cfd_margin, p_fee_rate: t.cfd_fee,
          p_tp: num(body.tp), p_sl: num(body.sl),
        };
        break;
      }
      case "cfd_close": {
        const id = String(body.trade_id ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Trade not found");
        const { data: tr } = await svc.from("open_trades").select("sym").eq("id", id).eq("user_id", user.id).maybeSingle();
        if (!tr) throw new Error("Trade not found");
        rpc = "mx_cfd_close";
        args = { p_user: user.id, p_key: key, p_trade_id: id, p_price: await priceOf(tr.sym, s), p_margin_rate: t.cfd_margin, p_auto: !!body.auto };
        break;
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }

    const { data, error } = await svc.rpc(rpc, args);
    if (error) {
      // Same key raced in twice: the first finished — return its result
      if (error.code === "23505") {
        const { data: prev } = await svc.from("money_requests").select("result").eq("user_id", user.id).eq("key", key).maybeSingle();
        if (prev) return json(prev.result);
      }
      return json({ error: error.message }, 400);
    }
    return json(data);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});

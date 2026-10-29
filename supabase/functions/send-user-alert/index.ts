// supabase/functions/send-user-alert/index.ts
// Ultra-premium email notifications — price alerts, profit alerts, portfolio digest.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allow } from "../_shared/redis.ts";
import { layout, rows, p, note, button, figure, esc } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM    = "Aurum Capital <noreply@aurumcapitalinvest.com>";
const SITE    = "https://www.aurumcapitalinvest.com";
// ─── Emails: shared light brand template (../_shared/email.ts) ───────────────
function fmt(n: number, digits = 2): string {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtUSD(n: number): string { return "$" + fmt(n); }
function hello(firstName: string) { return p(firstName ? `Dear ${esc(firstName)},` : "Hello,"); }

async function buildPriceAlertHtml(firstName: string, sym: string, dir: string, target: number, price: number): Promise<string> {
  const above = dir === "above";
  return layout({
    preheader: `${sym} is now ${fmtUSD(price)} — ${above ? "above" : "below"} your ${fmtUSD(target)} target.`,
    eyebrow: "Price alert",
    title: `${esc(sym)} is <em>${above ? "above" : "below"}</em> your target`,
    body:
      hello(firstName) +
      p(`Your price alert for <b>${esc(sym)}</b> has been triggered.`) +
      rows([
        { label: "Asset", value: esc(sym) },
        { label: "Your target", value: `${above ? "Above" : "Below"} ${fmtUSD(target)}`, mono: true },
        { label: "Price now", value: fmtUSD(price), mono: true, tone: above ? "up" : "down" },
      ]) +
      note("This alert is now switched off. You can set a new one in Account → Alerts &amp; notifications.") +
      button(`View ${esc(sym)}`, `${SITE}/trade.html?sym=${encodeURIComponent(sym)}`),
  });
}

async function buildProfitAlertHtml(firstName: string, pnlPct: number, threshold: number, portfolioValue: number, type: "gain" | "loss"): Promise<string> {
  const gain = type === "gain";
  const pct = (pnlPct >= 0 ? "+" : "−") + fmt(Math.abs(pnlPct), 2) + "%";
  return layout({
    preheader: `Your portfolio P&L is ${pct}, past your ±${threshold}% alert.`,
    eyebrow: gain ? "Portfolio gain alert" : "Portfolio loss alert",
    title: `Your portfolio is <em>${pct}</em>`,
    body:
      hello(firstName) +
      p(`Your portfolio's unrealised profit / loss has crossed the ±${esc(threshold)}% threshold you set.`) +
      figure("Unrealised P&amp;L", pct, `Portfolio value ${fmtUSD(portfolioValue)}`, gain ? "up" : "down") +
      note("Figures are based on live market prices at the time of the alert and change as prices move. You'll get at most one P&amp;L alert every 6 hours.") +
      button("View your portfolio", `${SITE}/portfolio.html`),
  });
}

async function buildDigestHtml(
  firstName: string,
  portfolioValue: number,
  totalCost: number,
  holdingsCount: number,
  txCount: number,
  topHoldings: Array<{ sym: string; qty: number; cost: number }>,
): Promise<string> {
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return layout({
    preheader: `Your Aurum Capital portfolio summary for ${date}.`,
    eyebrow: "Portfolio digest",
    title: `Your portfolio <em>summary</em>`,
    body:
      hello(firstName) +
      p(`Here is your account summary for ${esc(date)}.`) +
      rows([
        { label: "Cash balance", value: fmtUSD(portfolioValue), mono: true },
        { label: "Amount invested (cost)", value: fmtUSD(totalCost), mono: true },
        { label: "Holdings", value: String(holdingsCount) },
        { label: "Transactions", value: String(txCount) },
      ]) +
      (topHoldings.length
        ? p("<b>Your holdings</b>") + rows(topHoldings.map((h) => ({ label: esc(h.sym), value: `${fmt(h.qty, h.qty < 1 ? 6 : 4)} @ ${fmtUSD(h.cost)}`, mono: true })))
        : "") +
      button("Open your dashboard", `${SITE}/dashboard.html`),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // Only the signed-in customer, only to their own address: the caller's email/name are ignored.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
  if (!user?.email) {
    return new Response(JSON.stringify({ error: "Sign in required" }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (!(await allow(`alert:${user.id}`, 10, 3600))) {
    return new Response(JSON.stringify({ error: "Too many alert emails. Try again later." }),
      { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const { type, data = {} } = body as { type: string; data?: Record<string, unknown> };
  const email = user.email;
  const firstName = String(user.user_metadata?.first_name ?? "").slice(0, 40);

  if (!type) {
    return new Response(JSON.stringify({ error: "Missing type" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let subject = "";
  let html    = "";

  if (type === "price_alert") {
    const d = data as { sym: string; target: number; dir: string; currentPrice: number };
    d.sym = String(d.sym ?? "").toUpperCase().replace(/[^A-Z0-9./-]/g, "").slice(0, 12);
    d.target = Number(d.target) || 0; d.currentPrice = Number(d.currentPrice) || 0;
    subject = `${d.sym} Alert Triggered — ${d.dir === "above" ? "↑" : "↓"} ${fmtUSD(d.target)}`;
    html    = await buildPriceAlertHtml(firstName as string, d.sym, d.dir, d.target, d.currentPrice);

  } else if (type === "profit_alert") {
    const d = data as { pnlPct: number; threshold: number; portfolioValue: number; type: "gain" | "loss" };
    const sign = d.pnlPct >= 0 ? "+" : "";
    subject = `Portfolio ${d.type === "gain" ? "Gain" : "Loss"} Alert: ${sign}${fmt(Math.abs(d.pnlPct), 1)}%`;
    html    = await buildProfitAlertHtml(firstName as string, d.pnlPct, d.threshold, d.portfolioValue, d.type);

  } else if (type === "digest") {
    const d = data as {
      portfolioValue: number; totalCost: number;
      holdingsCount: number; txCount: number;
      topHoldings: Array<{sym:string;qty:number;cost:number}>;
    };
    d.topHoldings = (d.topHoldings || []).slice(0, 5).map((h) => ({
      sym: String(h.sym ?? "").toUpperCase().replace(/[^A-Z0-9./-]/g, "").slice(0, 12),
      qty: Number(h.qty) || 0, cost: Number(h.cost) || 0,
    }));
    subject = `Your Aurum Capital Portfolio Digest · ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    html    = await buildDigestHtml(firstName as string, d.portfolioValue, d.totalCost, d.holdingsCount, d.txCount, d.topHoldings || []);

  } else {
    return new Response(JSON.stringify({ error: "Unknown type: " + type }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], subject, html }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[send-user-alert] Resend error:", errBody);
    return new Response(JSON.stringify({ error: "Email send failed", detail: errBody }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const resData = await res.json();
  console.info(`[send-user-alert] ✓ ${type} → ${email} (id: ${resData.id})`);
  return new Response(JSON.stringify({ success: true, id: resData.id }),
    { headers: { ...CORS, "Content-Type": "application/json" } });
});

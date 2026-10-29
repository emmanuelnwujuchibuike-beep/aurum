// supabase/functions/transaction-notify/index.ts
// DB webhook (transactions INSERT): emails the admin team and the customer when a
// deposit or withdrawal request is created.
//
// Only `record.id` is taken from the caller. The row is re-read with the service
// role, must be < 10 minutes old, and is emailed once (Redis lock), so a forged
// call can't send Aurum emails with made-up content. Card numbers are masked to
// the last 4 digits; CVVs, PINs and gift-card codes are never put in an email.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryLock } from "../_shared/redis.ts";
import { adminRecipients, button, emailSettings, esc, figure, layout, note, p, pill, rows, sendEmail, usd } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Row = { label: string; value: string; mono?: boolean; tone?: "gold" };
interface Details { method: string; settlement: string; rows: Row[]; sensitive?: boolean }

const last4 = (s: string) => s.replace(/\D/g, "").slice(-4);
const strip = (s: string | undefined, prefix: RegExp) => (s ?? "").replace(prefix, "").trim() || "—";

/** What the request says, minus anything secret. `note` format is written by the deposit/withdraw forms. */
function depositDetails(t: Record<string, unknown>): Details {
  const name = String(t.name || ""), noteTxt = String(t.note || ""), symbol = String(t.symbol || "");
  const parts = noteTxt.split("·").map((s) => s.trim());

  if (name.includes("Bank Wire") || noteTxt.includes("Bank Wire")) {
    const ref = parts.find((x) => x.startsWith("Ref:"))?.replace("Ref:", "").trim() || "—";
    return { method: "Bank wire transfer", settlement: "1–3 business days", rows: [{ label: "Transfer reference", value: esc(ref), mono: true, tone: "gold" }] };
  }
  if (name.includes("Card Deposit") || noteTxt.includes("Card Deposit")) {
    const cardType = parts[1] || "Card";
    if (/Amazon|Green Dot|MoneyPak|Walmart|Target/i.test(cardType)) {
      return { method: esc(cardType), settlement: "Manual review", sensitive: true, rows: [] };
    }
    const l4 = last4(parts[2] || "");
    return {
      method: `${esc(cardType)} card`, settlement: "Manual review", sensitive: true,
      rows: [{ label: "Card", value: l4 ? `•••• ${l4}` : "—", mono: true }, { label: "Cardholder", value: esc(parts[3] || "—") }],
    };
  }
  const wallets = ["PayPal", "Apple Pay", "Chime", "Wise", "Skrill", "Neteller", "Cash App", "Zelle"];
  const wallet = wallets.find((w) => name.includes(w));
  if (wallet || (symbol === "USD" && !name.includes("Bank") && !name.includes("Card"))) {
    return {
      method: esc(wallet || "E-wallet"), settlement: "1–2 hours",
      rows: [{ label: "Sent to", value: esc(parts[1] || "—"), mono: true }, { label: "From account", value: esc(strip(parts[2], /^From:\s*/i)), mono: true, tone: "gold" }],
    };
  }
  const asset = name.replace(" Crypto Deposit", "").replace(" Deposit", "");
  return { method: `${esc(asset)} (${esc(symbol)})`, settlement: "After network confirmation", rows: [{ label: "Network", value: esc(symbol), mono: true }] };
}

function withdrawDetails(t: Record<string, unknown>): Details {
  const name = String(t.name || ""), noteTxt = String(t.note || ""), sym = String(t.symbol || "");
  const parts = noteTxt.split("·").map((s) => s.trim());
  if (name.includes("Bank Wire") || noteTxt.startsWith("Bank wire")) {
    const acct = last4(strip(parts[3], /^Acct:\s*/i));
    return {
      method: "Bank wire transfer", settlement: "1–3 business days after approval",
      rows: [
        { label: "Bank", value: esc(parts[1] || "—") }, { label: "Account holder", value: esc(parts[2] || "—") },
        { label: "Account", value: acct ? `•••• ${acct}` : "—", mono: true }, { label: "SWIFT / routing", value: esc(strip(parts[4], /^SWIFT:\s*/i)), mono: true },
      ],
    };
  }
  if (name.includes("PayPal") || noteTxt.startsWith("PayPal")) {
    return { method: "PayPal", settlement: "1–2 hours after approval", rows: [{ label: "Recipient", value: esc(strip(parts[1], /^To:\s*/i)), mono: true, tone: "gold" }] };
  }
  if (name.includes("Card") || noteTxt.startsWith("Card refund")) {
    const l4 = last4(parts[1] || "");
    return { method: "Card refund", settlement: "2–5 business days", rows: [{ label: "Card", value: l4 ? `•••• ${l4}` : "—", mono: true }, { label: "Cardholder", value: esc(parts[2] || "—") }] };
  }
  return {
    method: `${esc(parts[1] || sym || "Crypto")} withdrawal`, settlement: "After approval and network confirmation",
    rows: [{ label: "Destination", value: esc(strip(parts[2], /^To:\s*/i)), mono: true }],
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const id = String(payload?.record?.id ?? payload?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return ok({ skipped: "bad id" });

    const { data: t } = await svc.from("transactions").select("*").eq("id", id).maybeSingle();
    if (!t || !["deposit", "withdraw"].includes(t.type)) return ok({ skipped: true });
    if (Date.now() - new Date(t.created_at ?? 0).getTime() > 10 * 60_000) return ok({ skipped: "stale" });
    if (!(await tryLock(`txnotify:${id}`, 86400))) return ok({ skipped: "already sent" });

    const { data: profile } = await svc.from("profiles").select("first_name, last_name, email").eq("id", t.user_id).maybeSingle();
    let userEmail = profile?.email as string | undefined;
    if (!userEmail) userEmail = (await svc.auth.admin.getUserById(t.user_id)).data?.user?.email ?? undefined;

    const { s } = await emailSettings();
    const isDeposit = t.type === "deposit";
    const amount = usd(Math.abs(Number(t.usd_amount || 0)));
    const ref = String(t.id).slice(0, 8).toUpperCase();
    const when = new Date(t.created_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";
    const firstName = esc(profile?.first_name || "there");
    const fullName = esc([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unknown client");
    const d = isDeposit ? depositDetails(t) : withdrawDetails(t);
    const kind = isDeposit ? "deposit" : "withdrawal";

    // ── Admin team ──
    const admins = await adminRecipients();
    if (admins.length) {
      const html = await layout({
        audience: "admin",
        preheader: `${amount} ${kind} request from ${fullName}`,
        eyebrow: `New ${kind} request`,
        title: `${amount} <em>${kind}</em> from ${fullName}`,
        body:
          p(`${pill("Pending review", "wait")}`) +
          rows([
            { label: "Client", value: fullName }, { label: "Email", value: esc(userEmail || "—") },
            { label: "Method", value: d.method }, ...d.rows,
            { label: "Reference", value: ref, mono: true }, { label: "Submitted", value: when },
          ]) +
          (d.sensitive ? note("Card and gift-card details are not sent by email. Open the request in the admin dashboard.", "down") : "") +
          button("Review in admin dashboard", `${s.site_url}/dashboard-classic.html`),
      });
      await sendEmail({ to: admins, subject: `New ${kind}: ${amount} from ${fullName.replace(/&[a-z#0-9]+;/g, "")}`, html })
        .catch((e) => console.error("admin email failed:", e));
    }

    // ── Customer ──
    if (userEmail) {
      const html = await layout({
        preheader: `We received your ${kind} request of ${amount}.`,
        eyebrow: `${isDeposit ? "Deposit" : "Withdrawal"} received`,
        title: `Your ${kind} is <em>under review</em>`,
        body:
          p(`Hello ${firstName}, we've received your ${kind} request. Our team reviews every request by hand and you'll get another email as soon as it's processed.`) +
          figure("Amount", amount, d.method) +
          rows([{ label: "Status", value: pill("Pending", "wait") }, { label: "Reference", value: ref, mono: true }, { label: "Submitted", value: when }, { label: "Expected", value: d.settlement }]) +
          button("View activity", `${s.site_url}/dashboard.html`),
      });
      await sendEmail({ to: userEmail, subject: `${isDeposit ? "Deposit" : "Withdrawal"} request received: ${amount}`, html })
        .catch((e) => console.error("user email failed:", e));
    }
    return ok({ success: true });
  } catch (err) {
    console.error("transaction-notify error:", err);
    return new Response(JSON.stringify({ success: false }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

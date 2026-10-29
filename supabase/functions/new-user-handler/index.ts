import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryLock } from "../_shared/redis.ts";
import { layout, rows, p, note, button, esc as escHtml } from "../_shared/email.ts";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Only the user id is taken from the caller (DB webhook { record } or direct { id }).
    // Email, name and sign-up time come from the auth database, so this can't be used
    // to send Aurum emails to arbitrary addresses.
    const id = String((body.record ?? body).id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("ignored", { status: 200, headers: corsHeaders });
    const { data: { user: record } } = await svc.auth.admin.getUserById(id);
    if (!record?.email || Date.now() - new Date(record.created_at).getTime() > 15 * 60_000) {
      return new Response("ignored", { status: 200, headers: corsHeaders });
    }
    // Once per user (trigger retries, duplicate calls)
    if (!(await tryLock(`welcome:${id}`, 86400))) return new Response("already sent", { status: 200, headers: corsHeaders });

    const email      = record.email;
    const created_at = record.created_at;

    const meta      = record.user_metadata ?? {};
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const firstName = esc(String(meta.first_name ?? meta.given_name  ?? meta.name?.split(" ")[0] ?? "").slice(0, 40));
    const lastName  = esc(String(meta.last_name  ?? meta.family_name ?? meta.name?.split(" ").slice(1).join(" ") ?? "").slice(0, 40));
    const fullName  = `${firstName} ${lastName}`.trim() || "Valued Client";
    const displayFirst = firstName || fullName;

    if (!email) throw new Error("No email in webhook payload");

    const memberSince = new Date(created_at).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    // ── 1. Admin notification via Resend ─────────────────────────────────
    try {
      const adminRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aurum Capital <noreply@aurumcapitalinvest.com>",
          to: ["aurumcapitalinvest@gmail.com"],
          subject: `New client — ${fullName} · ${email}`,
          html: await buildAdminHtml(fullName, email, id, memberSince, created_at),
        }),
      });
      if (!adminRes.ok) {
        const err = await adminRes.text();
        console.error("Admin notify Resend error:", adminRes.status, err);
      } else {
        console.info("Admin notification sent for:", email);
      }
    } catch (e) {
      console.error("Admin notify failed:", e);
    }

    // ── 2. Welcome email via Resend (verified custom domain) ─────────────
    // Gmail SMTP is blocked by Google from cloud provider IPs (Supabase runs
    // on Cloudflare/GCP infrastructure). Resend uses HTTPS — no TCP restriction.
    // Requires aurumcapitalinvest.com to be verified in the Resend dashboard
    // (resend.com/domains) so we can send to any recipient, not just the owner.
    const welcomeHtml = await buildWelcomeHtml(displayFirst, fullName, memberSince, email);

    let welcomeStatus: { ok: boolean; status?: number; body?: string } = { ok: false };
    try {
      const welcomeRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aurum Capital <noreply@aurumcapitalinvest.com>",
          to: [email],
          subject: `Welcome to Aurum Capital, ${displayFirst}`,
          html: welcomeHtml,
        }),
      });
      const resBody = await welcomeRes.text();
      welcomeStatus = { ok: welcomeRes.ok, status: welcomeRes.status, body: resBody };
      if (!welcomeRes.ok) {
        console.error("Welcome email Resend error:", welcomeRes.status, resBody);
      } else {
        console.info("Welcome email sent to:", email);
      }
    } catch (e) {
      console.error("Welcome email fetch failed:", e);
      welcomeStatus = { ok: false, body: String(e) };
    }

    return new Response(JSON.stringify({ success: true, welcomeEmail: welcomeStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("new-user-handler top-level error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Emails use the shared light brand template (../_shared/email.ts), the same one
// as admin emails, deposits/withdrawals and support replies.

async function buildAdminHtml(
  fullName: string,
  email: string,
  id: string,
  memberSince: string,
  created_at: string,
): Promise<string> {
  const timeStr = new Date(created_at).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
  }) + " UTC";
  return layout({
    audience: "admin",
    preheader: `New client sign-up: ${fullName} · ${email}`,
    eyebrow: "New client",
    title: `${fullName} <em>joined</em>`,
    body:
      p("A new account has been created on Aurum Capital.") +
      rows([
        { label: "Name", value: fullName },
        { label: "Email", value: escHtml(email), mono: true },
        { label: "Signed up", value: `${escHtml(memberSince)} · ${escHtml(timeStr)}` },
        { label: "User ID", value: escHtml(id), mono: true },
      ]) +
      button("Open the admin dashboard", "https://www.aurumcapitalinvest.com/admin.html#users"),
  });
}

async function buildWelcomeHtml(
  firstName: string,
  fullName: string,
  memberSince: string,
  email: string,
): Promise<string> {
  return layout({
    preheader: "Your Aurum Capital account is ready — here's how to get started.",
    eyebrow: "Welcome",
    title: `Welcome to Aurum Capital, <em>${firstName}</em>`,
    body:
      p("Your account is ready. Here is a summary, and three simple steps to get started.") +
      rows([
        { label: "Account holder", value: fullName },
        { label: "Email", value: escHtml(email), mono: true },
        { label: "Member since", value: escHtml(memberSince) },
        { label: "Status", value: "Active", tone: "up" },
      ]) +
      p("<b>1. Complete your profile.</b> Add your name, photo and preferences in Account.") +
      p("<b>2. Fund your account.</b> Deposit by crypto or PayPal from the Deposit page. Deposits are credited after our team confirms the payment.") +
      p("<b>3. Explore the markets.</b> Browse crypto, global shares, commodities and real-estate listings, and invest when you're ready.") +
      note("Investing involves risk. The value of investments can go down as well as up, and you may get back less than you invest.") +
      button("Open your dashboard", "https://www.aurumcapitalinvest.com/dashboard.html"),
  });
}

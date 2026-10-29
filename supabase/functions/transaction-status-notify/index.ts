// supabase/functions/transaction-status-notify/index.ts
// DB webhook (transactions UPDATE): tells the customer their deposit or withdrawal
// was approved or rejected.
//
// Only `record.id` is taken from the caller; the row is re-read with the service role
// and each (transaction, status) pair is emailed once, so forged calls can't send
// made-up content.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryLock } from "../_shared/redis.ts";
import { button, emailSettings, esc, figure, layout, note, p, pill, rows, sendEmail, usd } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const id = String(payload?.record?.id ?? payload?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return ok({ skipped: "bad id" });

    const { data: t } = await svc.from("transactions").select("*").eq("id", id).maybeSingle();
    if (!t || !["deposit", "withdraw"].includes(t.type) || !["approved", "rejected"].includes(t.status)) return ok({ skipped: true });
    if (!(await tryLock(`txstatus:${id}:${t.status}`, 30 * 86400))) return ok({ skipped: "already sent" });

    const { data: profile } = await svc.from("profiles").select("first_name, email").eq("id", t.user_id).maybeSingle();
    let userEmail = profile?.email as string | undefined;
    if (!userEmail) userEmail = (await svc.auth.admin.getUserById(t.user_id)).data?.user?.email ?? undefined;
    if (!userEmail) return ok({ skipped: "no email" });

    const { s } = await emailSettings();
    const approved = t.status === "approved";
    const isDeposit = t.type === "deposit";
    const kind = isDeposit ? "deposit" : "withdrawal";
    const Kind = isDeposit ? "Deposit" : "Withdrawal";
    const amount = usd(Math.abs(Number(t.usd_amount || 0)));
    const ref = String(t.id).slice(0, 8).toUpperCase();
    const firstName = esc(profile?.first_name || "there");

    const lead = approved
      ? isDeposit
        ? `Hello ${firstName}, your deposit has been approved and the funds are now in your available cash.`
        : `Hello ${firstName}, your withdrawal has been approved and is on its way to your chosen account.`
      : `Hello ${firstName}, we couldn't approve your ${kind} request. No money has moved. Reply to this email or contact support and we'll help you sort it out.`;

    const html = await layout({
      preheader: `${Kind} of ${amount} ${approved ? "approved" : "not approved"}.`,
      eyebrow: `${Kind} ${approved ? "approved" : "update"}`,
      title: approved ? `Your ${kind} is <em>complete</em>` : `Your ${kind} <em>needs attention</em>`,
      body:
        p(lead) +
        figure("Amount", amount, approved ? "Approved" : "Not approved", approved ? "up" : "down") +
        rows([
          { label: "Status", value: pill(approved ? "Approved" : "Rejected", approved ? "ok" : "bad") },
          { label: "Type", value: Kind }, { label: "Reference", value: ref, mono: true },
          { label: "Date", value: new Date().toLocaleDateString("en-US", { dateStyle: "long" }) },
        ]) +
        (approved ? "" : note(`Need help? Write to <a href="mailto:${esc(s.support_email)}">${esc(s.support_email)}</a> quoting reference ${ref}.`)) +
        button(approved ? "Open dashboard" : "Contact support", approved ? `${s.site_url}/dashboard.html` : `${s.site_url}/contact.html`),
    });
    await sendEmail({ to: userEmail, subject: `${Kind} of ${amount} ${approved ? "approved" : "not approved"}`, html });
    return ok({ success: true });
  } catch (err) {
    console.error("transaction-status-notify error:", err);
    return new Response(JSON.stringify({ success: false }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

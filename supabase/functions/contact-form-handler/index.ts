// supabase/functions/contact-form-handler/index.ts
// Public contact forms + live-chat notifications.
//
//   general | investment | support | press   → saved to contact_submissions, admin alert, client confirmation
//   live_chat_session | live_chat_message    → admin alert (+ client confirmation when the session starts)
//   chat_reply                               → admin only: emails the client of that chat session
//
// The admin recipients come from site_settings.email, never from the caller. Chat
// replies need an admin's token and go to the email stored on the chat session.
// Everything public is rate-limited per IP and per recipient (Upstash).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allow } from "../_shared/redis.ts";
import { adminRecipients, button, emailSettings, esc, layout, note, p, rows, sendEmail, textToHtml } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FORMS = new Set(["general", "investment", "support", "press", "live_chat_session", "live_chat_message"]);
const LABEL: Record<string, string> = {
  general: "General enquiry", investment: "Investment consultation", support: "Support request", press: "Press enquiry",
  live_chat_session: "New live chat", live_chat_message: "Live chat message",
};
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

async function isAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
  if (!user) return false;
  const { data } = await svc.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return Boolean(data?.is_admin);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const formType = String(body.formType ?? "");
    const { s } = await emailSettings();

    // ── Admin replied in live chat → email that session's client ──
    if (formType === "chat_reply") {
      if (!(await isAdmin(req))) return json({ error: "Admin only" }, 403);
      const sessionId = clip(body.sessionId, 80);
      const { data: sess } = await svc.from("chat_sessions").select("user_name, user_email").eq("id", sessionId).maybeSingle();
      const to = String(sess?.user_email ?? "");
      if (!EMAIL_RE.test(to)) return json({ skipped: "no email on session" });
      if (!(await allow(`chatreply:${sessionId}`, 6, 3600))) return json({ skipped: "rate limited" });
      const html = await layout({
        preheader: "Your Aurum advisor has replied.",
        eyebrow: "Support",
        title: `Your advisor has <em>replied</em>`,
        body:
          p(`Hello ${esc(clip(sess?.user_name, 60) || "there")}, there's a new reply in your support chat:`) +
          note(textToHtml(clip(body.message, 2000))) +
          button("Continue the conversation", `${s.site_url}/contact.html`),
      });
      await sendEmail({ to, subject: "Your Aurum advisor has replied", html, from: `${s.brand} Support <support@${s.domain}>`, replyTo: s.support_email });
      return json({ success: true });
    }

    if (!FORMS.has(formType)) return json({ error: "Unknown form" }, 400);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    if (!(await allow(`contact:ip:${ip}`, 20, 3600))) return json({ error: "Too many requests. Please try again later." }, 429);

    const f = {
      name: clip(body.name, 80), email: clip(body.email, 120).toLowerCase(), subject: clip(body.subject, 150),
      message: clip(body.message, 5000), notes: clip(body.notes, 3000), budget: clip(body.budget, 60),
      assetClass: clip(body.assetClass, 60), risk: clip(body.risk, 60), horizon: clip(body.horizon, 60),
      issueType: clip(body.issueType, 60), priority: clip(body.priority, 30), txId: clip(body.txId, 80),
      outlet: clip(body.outlet, 120), enquiryType: clip(body.enquiryType, 60), sessionId: clip(body.sessionId, 80), pageUrl: clip(body.pageUrl, 300),
    };
    const validEmail = EMAIL_RE.test(f.email);
    const isChat = formType.startsWith("live_chat");

    if (!isChat) {
      await svc.from("contact_submissions").insert({
        form_type: formType, name: f.name || null, email: f.email || null, message: f.message || null, subject: f.subject || null,
        budget: f.budget || null, asset_class: f.assetClass || null, risk: f.risk || null, horizon: f.horizon || null, notes: f.notes || null,
        issue_type: f.issueType || null, priority: f.priority || null, tx_id: f.txId || null, outlet: f.outlet || null, enquiry_type: f.enquiryType || null,
      });
    }

    // ── Admin alert ──
    try {
      const admins = await adminRecipients();
      if (admins.length) {
        const html = await layout({
          audience: "admin",
          preheader: `${LABEL[formType]} from ${f.name || "a visitor"}`,
          eyebrow: LABEL[formType],
          title: `From <em>${esc(f.name || "a visitor")}</em>`,
          body:
            rows([
              { label: "Email", value: esc(f.email || "Not provided") }, { label: "Subject", value: esc(f.subject) },
              { label: "Budget", value: esc(f.budget) }, { label: "Asset class", value: esc(f.assetClass) },
              { label: "Risk", value: esc(f.risk) }, { label: "Horizon", value: esc(f.horizon) },
              { label: "Issue", value: esc(f.issueType) }, { label: "Priority", value: esc(f.priority) },
              { label: "Transaction", value: esc(f.txId), mono: true }, { label: "Outlet", value: esc(f.outlet) },
              { label: "Enquiry", value: esc(f.enquiryType) }, { label: "Chat session", value: esc(f.sessionId), mono: true },
              { label: "Page", value: esc(f.pageUrl) },
            ]) +
            ((f.message || f.notes) ? note(textToHtml(f.message || f.notes)) : "") +
            (isChat ? button("Open live chat", `${s.site_url}/contact.html#admin`) : ""),
        });
        await sendEmail({ to: admins, subject: `${LABEL[formType]}: ${f.name || "visitor"}`, html, replyTo: validEmail ? f.email : undefined });
      }
    } catch (e) { console.error("admin alert failed:", e); }

    // ── Client confirmation (not for every chat message) ──
    if (validEmail && formType !== "live_chat_message" && (await allow(`contact:to:${f.email}`, 3, 3600))) {
      try {
        const html = await layout({
          preheader: isChat ? "Your support chat has started." : "We've received your message.",
          eyebrow: isChat ? "Live support" : "Message received",
          title: isChat ? `We're <em>on it</em>` : `Thank you, <em>${esc(f.name || "there")}</em>`,
          body:
            p(isChat
              ? `Hello ${esc(f.name || "there")}, your support chat has started. An advisor will reply in the chat window, and we'll email you when they do.`
              : `We've received your ${esc(LABEL[formType].toLowerCase())} and a member of our team will reply within one business day.`) +
            note(`If you didn't contact ${esc(s.brand)}, you can ignore this email.`) +
            button("Visit Aurum Capital", s.site_url),
        });
        await sendEmail({ to: f.email, subject: isChat ? "Your support chat has started" : "We received your message", html, replyTo: s.support_email });
      } catch (e) { console.error("client confirmation failed:", e); }
    }
    return json({ success: true });
  } catch (err) {
    console.error("contact-form-handler error:", err);
    return json({ success: false }, 500);
  }
});

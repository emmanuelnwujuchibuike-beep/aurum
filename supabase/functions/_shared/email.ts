// supabase/functions/_shared/email.ts
// One brand template for every Aurum email: the light ("milky brown") tokens from
// src/styles/app.css, table layout + inline styles so Gmail/Outlook/Apple Mail agree.
// Sender addresses, admin recipients and footer text come from site_settings.email
// (admin-editable); the defaults below are used only until that row exists.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Tokens (light theme of app.css) ──
export const T = {
  page: "#E2DDD5", bg: "#ECE8E1", well: "#E7E2DA", ink: "#1E1B16", ink2: "#3F3A32", muted: "#5B5448",
  line: "#DDD6C9", gold: "#C29A45", onGold: "#241A05", goldInk: "#6E5314", accent: "#8A6820",
  up: "#22603A", upBg: "#DAEBDD", down: "#A3261C", downBg: "#F1DAD5", newInk: "#5C450F", newBg: "#F1E4C3",
  serif: "'Playfair Display',Georgia,'Times New Roman',serif",
  sans: "'Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'JetBrains Mono',Menlo,Consolas,monospace",
};

export interface EmailSettings {
  brand: string;
  site_url: string;
  domain: string;
  senders: { local: string; name: string }[];   // e.g. noreply, support, hello
  default_sender: string;                       // local part
  admin_to: string[];
  support_email: string;
  footer_note: string;
  legal: string;
}

const DEFAULTS: EmailSettings = {
  brand: "Aurum Capital",
  site_url: "https://aurumcapitalinvest.com",
  domain: "aurumcapitalinvest.com",
  senders: [
    { local: "noreply", name: "Aurum Capital" },
    { local: "support", name: "Aurum Capital Support" },
    { local: "hello", name: "Aurum Capital" },
  ],
  default_sender: "noreply",
  admin_to: ["aurumcapitalinvest@gmail.com"],
  support_email: "support@aurumcapitalinvest.com",
  footer_note: "Dubai · London · New York · Singapore",
  legal: "Investing involves risk, including the loss of capital. Past performance is not a guide to future returns.",
};

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Settings change rarely; cache per instance for 60 s
let cache: { at: number; s: EmailSettings; regulator: string; licence: string } | null = null;
export async function emailSettings() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const { data } = await svc.from("site_settings").select("key,value").in("key", ["email", "regulator_name", "licence_number"]);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  const s = { ...DEFAULTS, ...(m.email ?? {}) } as EmailSettings;
  cache = { at: Date.now(), s, regulator: typeof m.regulator_name === "string" ? m.regulator_name : "", licence: typeof m.licence_number === "string" ? m.licence_number : "" };
  return cache;
}

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const usd = (n: number, dp = 2) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

// ── Components (all return HTML strings; callers escape their own text) ──

/** Label / value rows, e.g. Amount, Method, Reference. */
export function rows(items: { label: string; value: string; mono?: boolean; tone?: "up" | "down" | "gold" }[]) {
  const tr = items.filter((r) => r.value !== "").map((r, i) => {
    const color = r.tone === "up" ? T.up : r.tone === "down" ? T.down : r.tone === "gold" ? T.goldInk : T.ink;
    const font = r.mono ? T.mono : T.sans;
    const top = i ? `border-top:1px solid ${T.line};` : "";
    return `<tr>
<td style="${top}padding:11px 0;font:400 13px/1.4 ${T.sans};color:${T.muted};vertical-align:top">${r.label}</td>
<td style="${top}padding:11px 0;font:500 14px/1.4 ${font};color:${color};text-align:right;word-break:break-word">${r.value}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.well};border-radius:14px;padding:4px 18px;margin:20px 0">${tr}</table>`;
}

/** Big figure in a recessed well (amount, portfolio value). */
export function figure(label: string, value: string, sub = "", tone?: "up" | "down") {
  const subColor = tone === "up" ? T.up : tone === "down" ? T.down : T.muted;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.well};border-radius:16px;margin:20px 0">
<tr><td style="padding:22px 22px 20px">
<div style="font:500 11px/1 ${T.sans};letter-spacing:.22em;text-transform:uppercase;color:${T.goldInk}">${label}</div>
<div style="font:500 34px/1.15 ${T.mono};color:${T.ink};margin-top:10px;letter-spacing:-.01em">${value}</div>
${sub ? `<div style="font:500 13px/1.4 ${T.sans};color:${subColor};margin-top:6px">${sub}</div>` : ""}
</td></tr></table>`;
}

/** Status pill: pending / approved / rejected / info. */
export function pill(text: string, kind: "ok" | "bad" | "wait" | "info" = "info") {
  const [fg, bg] = kind === "ok" ? [T.up, T.upBg] : kind === "bad" ? [T.down, T.downBg] : kind === "wait" ? [T.newInk, T.newBg] : [T.goldInk, T.well];
  return `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${bg};color:${fg};font:600 11px/1.2 ${T.sans};letter-spacing:.12em;text-transform:uppercase">${text}</span>`;
}

/** Gold call-to-action button. */
export function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px"><tr>
<td style="background:${T.gold};border-radius:12px"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font:600 15px/1 ${T.sans};color:${T.onGold};text-decoration:none">${label}</a></td>
</tr></table>`;
}

/** Highlighted note (quote, warning, next steps). */
export function note(html: string, tone: "gold" | "up" | "down" = "gold") {
  const bar = tone === "up" ? T.up : tone === "down" ? T.down : T.gold;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr>
<td style="border-left:3px solid ${bar};background:${T.well};border-radius:0 12px 12px 0;padding:14px 18px;font:400 14px/1.6 ${T.sans};color:${T.ink2}">${html}</td></tr></table>`;
}

export function p(html: string) {
  return `<p style="margin:0 0 14px;font:400 15px/1.65 ${T.sans};color:${T.ink2}">${html}</p>`;
}

/** Plain text (admin-written) to safe paragraphs. */
export function textToHtml(text: string) {
  return String(text ?? "").trim().split(/\n{2,}/).map((para) => p(esc(para).replace(/\n/g, "<br>"))).join("");
}

/**
 * Full email. `title` may contain <em> for the gold italic accent (as on the site).
 * `body` is built from the components above.
 */
export async function layout(o: { preheader: string; eyebrow: string; title: string; body: string; audience?: "client" | "admin" }) {
  const { s, regulator, licence } = await emailSettings();
  const reg = regulator ? `${esc(s.brand)} is regulated by ${esc(regulator)}${licence ? ` (licence ${esc(licence)})` : ""}.<br>` : "";
  const footer = o.audience === "admin"
    ? `Operations alert from your ${esc(s.brand)} platform.`
    : `${reg}${esc(s.legal)}<br>Questions? <a href="mailto:${esc(s.support_email)}" style="color:${T.goldInk}">${esc(s.support_email)}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(s.brand)}</title>
<style>:root{color-scheme:light only}body{margin:0;padding:0}a{color:${T.goldInk}}em{color:${T.accent};font-style:italic}
@media (max-width:520px){.card{border-radius:0!important}.pad{padding:28px 20px!important}}</style></head>
<body style="margin:0;padding:0;background:${T.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.page}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${T.bg};border-radius:20px;border:1px solid ${T.line}">
<tr><td class="pad" style="padding:28px 36px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font:500 13px/1 ${T.sans};letter-spacing:.32em;text-transform:uppercase;color:${T.ink}"><span style="color:${T.gold}">&#9670;</span>&nbsp; ${esc(s.brand)}</td>
</tr></table>
<div style="height:1px;background:${T.line};margin-top:22px"></div>
</td></tr>
<tr><td class="pad" style="padding:28px 36px 8px">
<div style="font:500 11px/1 ${T.sans};letter-spacing:.22em;text-transform:uppercase;color:${T.goldInk}">${o.eyebrow}</div>
<h1 style="margin:12px 0 18px;font:500 28px/1.18 ${T.serif};color:${T.ink}">${o.title}</h1>
${o.body}
</td></tr>
<tr><td class="pad" style="padding:20px 36px 30px">
<div style="height:1px;background:${T.line};margin-bottom:18px"></div>
<div style="font:400 12px/1.6 ${T.sans};color:${T.muted}">${footer}</div>
<div style="font:500 11px/1.6 ${T.sans};letter-spacing:.14em;text-transform:uppercase;color:${T.muted};margin-top:12px">${esc(s.footer_note)}</div>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

// ── Sending ──

/** "Name <local@domain>" for an allowed sender; falls back to the default sender. */
export async function fromAddress(local?: string, name?: string) {
  const { s } = await emailSettings();
  const l = String(local ?? s.default_sender).toLowerCase().trim();
  const ok = /^[a-z0-9][a-z0-9._-]{0,40}$/.test(l);
  const use = ok ? l : s.default_sender;
  const label = (name ?? s.senders.find((x) => x.local === use)?.name ?? s.brand).replace(/[<>"\r\n]/g, "").slice(0, 60);
  return `${label} <${use}@${s.domain}>`;
}

export async function adminRecipients() {
  return (await emailSettings()).s.admin_to.filter((a) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a));
}

export async function sendEmail(o: { to: string | string[]; subject: string; html: string; from?: string; replyTo?: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: o.from ?? (await fromAddress()),
      to: Array.isArray(o.to) ? o.to : [o.to],
      subject: o.subject.replace(/[\r\n]/g, " ").slice(0, 200),
      html: o.html,
      ...(o.replyTo ? { reply_to: o.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string };
}

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* ═══════════════════════════════════════════════════════
   LUXURY EMAIL: USER SESSION CONFIRMATION
═══════════════════════════════════════════════════════ */
function buildSessionConfirmEmail(name: string, sessionId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Aurum Capital · Your Session Has Begun</title>
</head>
<body style="margin:0;padding:0;background:#030608;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030608;">
  <tr><td align="center" style="padding:40px 16px 0;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

      <!-- ── TOP ORNAMENT BAR ── -->
      <tr><td style="background:linear-gradient(180deg,#0A1E32 0%,#06101A 100%);padding:0;text-align:center;border-top:2px solid #C9A84C;border-radius:16px 16px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:44px 40px 36px;text-align:center;">
            <!-- Diamond emblem -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px;">
              <tr><td style="text-align:center;">
                <div style="display:inline-block;width:32px;height:32px;transform:rotate(45deg);border:1.5px solid rgba(201,168,76,.65);box-shadow:0 0 18px rgba(201,168,76,.28);margin-bottom:4px;"></div>
              </td></tr>
            </table>
            <!-- Wordmark -->
            <div style="font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(201,168,76,.72);font-family:Georgia,serif;margin-bottom:10px;">AURUM CAPITAL</div>
            <!-- Ornament rule -->
            <table width="200" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
              <tr>
                <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.5));"></td>
                <td style="width:24px;text-align:center;font-size:9px;color:rgba(201,168,76,.5);padding:0 6px;">◆</td>
                <td style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.5),transparent);"></td>
              </tr>
            </table>
            <!-- Subtitle -->
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(180,155,110,.45);font-family:Georgia,serif;">Private Client Services</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── MAIN CONTENT ── -->
      <tr><td style="background:#05101A;padding:48px 48px 36px;border-left:1px solid rgba(201,168,76,.08);border-right:1px solid rgba(201,168,76,.08);">
        <!-- Heading -->
        <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:34px;font-weight:400;color:#E8C95A;line-height:1.15;letter-spacing:0.02em;">Your session<br/>has begun.</h1>
        <!-- Subheading rule -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.35),transparent);"></td>
          </tr>
        </table>
        <!-- Salutation -->
        <p style="margin:0 0 20px;font-size:15px;color:rgba(200,180,145,.85);line-height:1.8;font-family:Georgia,serif;">Dear ${name},</p>
        <!-- Body copy -->
        <p style="margin:0 0 28px;font-size:15px;color:rgba(190,170,135,.75);line-height:1.9;font-family:Georgia,serif;">
          A live support session has been opened on your behalf. One of our private client advisors has been notified and will respond to you
          <strong style="color:#E8C95A;font-weight:400;">within the next 20 minutes</strong>.
        </p>
        <p style="margin:0 0 36px;font-size:15px;color:rgba(190,170,135,.7);line-height:1.9;font-family:Georgia,serif;">
          You may continue your conversation at any time by returning to our platform. Your session remains open until our advisor marks it resolved.
        </p>

        <!-- Reference card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:40px;">
          <tr>
            <td style="background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.14);border-left:3px solid rgba(201,168,76,.65);border-radius:2px 10px 10px 2px;padding:18px 22px;">
              <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(201,168,76,.55);font-family:Courier,'Courier New',monospace;margin-bottom:9px;">Session Reference</div>
              <div style="font-family:Courier,'Courier New',monospace;font-size:12px;color:rgba(200,180,145,.9);letter-spacing:0.1em;">${sessionId || "–"}</div>
            </td>
          </tr>
        </table>

        <!-- What to expect section -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="padding:20px 24px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:10px;">
              <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(201,168,76,.5);margin-bottom:14px;font-family:Georgia,serif;">What to expect</div>
              <!-- Item 1 -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td style="width:20px;padding-right:12px;vertical-align:top;padding-top:3px;">
                    <div style="width:6px;height:6px;background:#C9A84C;transform:rotate(45deg);"></div>
                  </td>
                  <td style="font-size:13px;color:rgba(190,170,135,.7);line-height:1.7;font-family:Georgia,serif;">A qualified advisor will review your enquiry and respond via this live chat window.</td>
                </tr>
              </table>
              <!-- Item 2 -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td style="width:20px;padding-right:12px;vertical-align:top;padding-top:3px;">
                    <div style="width:6px;height:6px;background:#C9A84C;transform:rotate(45deg);"></div>
                  </td>
                  <td style="font-size:13px;color:rgba(190,170,135,.7);line-height:1.7;font-family:Georgia,serif;">You will receive an email notification when a reply has been sent.</td>
                </tr>
              </table>
              <!-- Item 3 -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:20px;padding-right:12px;vertical-align:top;padding-top:3px;">
                    <div style="width:6px;height:6px;background:#C9A84C;transform:rotate(45deg);"></div>
                  </td>
                  <td style="font-size:13px;color:rgba(190,170,135,.7);line-height:1.7;font-family:Georgia,serif;">All conversations are encrypted and handled with complete discretion.</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ── FOOTER ── -->
      <tr><td style="background:#030608;padding:32px 48px 40px;border:1px solid rgba(201,168,76,.07);border-top:1px solid rgba(201,168,76,.1);border-radius:0 0 16px 16px;text-align:center;">
        <table width="200" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.28));"></td>
            <td style="width:24px;text-align:center;font-size:8px;color:rgba(201,168,76,.35);padding:0 6px;">◆</td>
            <td style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.28),transparent);"></td>
          </tr>
        </table>
        <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(201,168,76,.38);font-family:Georgia,serif;margin-bottom:10px;">Aurum Capital</div>
        <div style="font-size:11px;color:rgba(255,255,255,.22);line-height:1.9;font-family:Georgia,serif;">Dubai &nbsp;·&nbsp; London &nbsp;·&nbsp; New York &nbsp;·&nbsp; Singapore</div>
        <div style="margin-top:16px;font-size:10px;color:rgba(255,255,255,.12);line-height:1.8;font-family:Georgia,serif;">
          © 2025 Aurum Capital. All rights reserved.<br/>
          If you did not initiate this conversation, please disregard this message.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════
   LUXURY EMAIL: ADMIN REPLY NOTIFICATION TO USER
═══════════════════════════════════════════════════════ */
function buildReplyNotifyEmail(name: string, replyText: string, sessionId: string): string {
  // Escape HTML in user-facing reply text
  const safeReply = replyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Aurum Capital · Your Advisor Has Replied</title>
</head>
<body style="margin:0;padding:0;background:#030608;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030608;">
  <tr><td align="center" style="padding:40px 16px 0;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

      <!-- ── HEADER ── -->
      <tr><td style="background:linear-gradient(180deg,#0A1E32 0%,#06101A 100%);padding:0;text-align:center;border-top:2px solid #C9A84C;border-radius:16px 16px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:36px 40px 30px;text-align:center;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
              <tr><td style="text-align:center;">
                <div style="display:inline-block;width:28px;height:28px;transform:rotate(45deg);border:1.5px solid rgba(201,168,76,.65);box-shadow:0 0 16px rgba(201,168,76,.28);"></div>
              </td></tr>
            </table>
            <div style="font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(201,168,76,.72);font-family:Georgia,serif;margin-bottom:8px;">AURUM CAPITAL</div>
            <table width="180" cellpadding="0" cellspacing="0" style="margin:0 auto 10px;">
              <tr>
                <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.45));"></td>
                <td style="width:20px;text-align:center;font-size:9px;color:rgba(201,168,76,.45);padding:0 5px;">◆</td>
                <td style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.45),transparent);"></td>
              </tr>
            </table>
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(180,155,110,.42);font-family:Georgia,serif;">Private Client Services</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── MAIN BODY ── -->
      <tr><td style="background:#05101A;padding:48px 48px 36px;border-left:1px solid rgba(201,168,76,.08);border-right:1px solid rgba(201,168,76,.08);">

        <!-- Notification badge -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);border-radius:99px;padding:5px 16px;">
              <span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(201,168,76,.85);font-family:Georgia,serif;">◆ &nbsp; New Reply</span>
            </td>
          </tr>
        </table>

        <!-- Heading -->
        <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#E8C95A;line-height:1.15;letter-spacing:0.02em;">Your advisor<br/>has replied.</h1>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
          <tr><td style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.35),transparent);"></td></tr>
        </table>

        <p style="margin:0 0 28px;font-size:15px;color:rgba(200,180,145,.82);line-height:1.8;font-family:Georgia,serif;">
          Dear ${name},<br/><br/>
          A member of your private client advisory team has responded to your support conversation. The full message is included below.
        </p>

        <!-- Reply card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
          <tr>
            <td style="background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.16);border-left:3px solid rgba(201,168,76,.7);border-radius:2px 12px 12px 2px;padding:24px 26px;">
              <!-- Avatar row -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="padding-right:12px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(145deg,rgba(201,168,76,.25),rgba(201,168,76,.06));border:1.5px solid rgba(201,168,76,.4);display:flex;align-items:center;justify-content:center;text-align:center;line-height:36px;font-family:Georgia,serif;font-size:14px;color:#C9A84C;font-weight:400;">AU</div>
                  </td>
                  <td>
                    <div style="font-size:13px;color:rgba(201,168,76,.85);font-family:Georgia,serif;letter-spacing:0.04em;">Aurum Support</div>
                    <div style="font-size:10px;color:rgba(180,155,110,.45);font-family:Courier,'Courier New',monospace;letter-spacing:0.06em;margin-top:2px;">PRIVATE CLIENT ADVISOR</div>
                  </td>
                </tr>
              </table>
              <!-- Message content -->
              <div style="font-size:14px;color:rgba(215,195,155,.85);line-height:1.85;font-family:Georgia,serif;border-top:1px solid rgba(201,168,76,.1);padding-top:16px;">${safeReply}</div>
            </td>
          </tr>
        </table>

        <!-- CTA button -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
          <tr>
            <td style="background:linear-gradient(145deg,#EFD060 0%,#C9A84C 45%,#9A7230 85%,#6A4818 100%);border-radius:8px;box-shadow:0 6px 22px rgba(201,168,76,.3);">
              <a href="https://aurumcapitalinvest.com" style="display:block;padding:13px 32px;font-family:Georgia,serif;font-size:12px;font-weight:400;letter-spacing:0.15em;text-transform:uppercase;color:#0A0700;text-decoration:none;">Return to Conversation</a>
            </td>
          </tr>
        </table>

        <!-- Reference -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:8px;padding:14px 18px;">
              <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(201,168,76,.45);font-family:Courier,'Courier New',monospace;">Session: </span>
              <span style="font-family:Courier,'Courier New',monospace;font-size:11px;color:rgba(200,180,145,.6);letter-spacing:0.08em;">${sessionId || "–"}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ── FOOTER ── -->
      <tr><td style="background:#030608;padding:28px 48px 36px;border:1px solid rgba(201,168,76,.07);border-top:1px solid rgba(201,168,76,.1);border-radius:0 0 16px 16px;text-align:center;">
        <table width="200" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.25));"></td>
            <td style="width:20px;text-align:center;font-size:8px;color:rgba(201,168,76,.3);padding:0 5px;">◆</td>
            <td style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.25),transparent);"></td>
          </tr>
        </table>
        <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(201,168,76,.35);font-family:Georgia,serif;margin-bottom:9px;">Aurum Capital</div>
        <div style="font-size:11px;color:rgba(255,255,255,.2);line-height:1.9;font-family:Georgia,serif;">Dubai &nbsp;·&nbsp; London &nbsp;·&nbsp; New York &nbsp;·&nbsp; Singapore</div>
        <div style="margin-top:14px;font-size:10px;color:rgba(255,255,255,.11);line-height:1.8;font-family:Georgia,serif;">
          © 2025 Aurum Capital. All rights reserved.<br/>
          This message was sent because you initiated a support conversation on our platform.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════
   LUXURY EMAIL: GENERIC CONFIRMATION (contact forms)
═══════════════════════════════════════════════════════ */
function buildGenericConfirmEmail(name: string, formType: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#030608;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#030608;">
  <tr><td align="center" style="padding:40px 16px 0;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:linear-gradient(180deg,#0A1E32 0%,#06101A 100%);padding:36px 40px 28px;text-align:center;border-top:2px solid #C9A84C;border-radius:16px 16px 0 0;">
        <div style="font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:rgba(201,168,76,.72);font-family:Georgia,serif;margin-bottom:6px;">AURUM CAPITAL</div>
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(180,155,110,.4);font-family:Georgia,serif;">Private Investment Management</div>
      </td></tr>
      <tr><td style="background:#05101A;padding:44px 48px 36px;border-left:1px solid rgba(201,168,76,.08);border-right:1px solid rgba(201,168,76,.08);">
        <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#E8C95A;line-height:1.2;">Your enquiry<br/>has been received.</h1>
        <p style="margin:0 0 20px;font-size:15px;color:rgba(200,180,145,.82);line-height:1.85;font-family:Georgia,serif;">Dear ${name},</p>
        <p style="margin:0 0 28px;font-size:15px;color:rgba(190,170,135,.72);line-height:1.9;font-family:Georgia,serif;">
          We have received your ${formType.replace(/_/g," ")} and a member of our team will be in touch
          <strong style="color:#E8C95A;font-weight:400;">within 20 minutes</strong> during business hours.
        </p>
        <p style="margin:0;font-size:13px;color:rgba(170,150,115,.55);line-height:1.8;font-family:Georgia,serif;font-style:italic;">
          All enquiries are handled with the utmost discretion and care.
        </p>
      </td></tr>
      <tr><td style="background:#030608;padding:26px 48px 32px;border:1px solid rgba(201,168,76,.07);border-top:1px solid rgba(201,168,76,.1);border-radius:0 0 16px 16px;text-align:center;">
        <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:rgba(201,168,76,.32);font-family:Georgia,serif;margin-bottom:8px;">Aurum Capital</div>
        <div style="font-size:10px;color:rgba(255,255,255,.18);line-height:1.8;font-family:Georgia,serif;">Dubai · London · New York · Singapore</div>
        <div style="margin-top:12px;font-size:10px;color:rgba(255,255,255,.1);font-family:Georgia,serif;">© 2025 Aurum Capital. All rights reserved.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════
   ADMIN NOTIFICATION EMAIL — ULTRA PREMIUM
═══════════════════════════════════════════════════════ */
function buildAdminNotifyEmail(formType: string, fields: Record<string, string>): string {
  const timestamp = new Date().toUTCString();

  // Type badge colour + label
  const typeMap: Record<string, { label: string; color: string; bg: string }> = {
    live_chat_session: { label: "Live Chat · New Session",   color: "#4EA8DE", bg: "rgba(78,168,222,.1)"  },
    live_chat_message: { label: "Live Chat · New Message",   color: "#4EA8DE", bg: "rgba(78,168,222,.1)"  },
    chat_reply:        { label: "Chat Reply",                color: "#C9A84C", bg: "rgba(201,168,76,.1)"  },
    investment:        { label: "Investment Enquiry",        color: "#C9A84C", bg: "rgba(201,168,76,.1)"  },
    advisory:          { label: "Advisory Request",          color: "#C9A84C", bg: "rgba(201,168,76,.1)"  },
    support:           { label: "Support Request",           color: "#A78BFA", bg: "rgba(167,139,250,.1)" },
    transaction:       { label: "Transaction",               color: "#34D399", bg: "rgba(52,211,153,.1)"  },
    press:             { label: "Press Enquiry",             color: "#F59E0B", bg: "rgba(245,158,11,.1)"  },
  };
  const badge = typeMap[formType] ?? { label: formType.replace(/_/g, " "), color: "#C9A84C", bg: "rgba(201,168,76,.1)" };

  // Build detail rows — skip empty, skip internal keys
  const skip = new Set(["adminEmail", "pageUrl", "sessionId", "subject"]);
  const dataRows = Object.entries(fields)
    .filter(([k, v]) => v && v.trim() && !skip.has(k))
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
      const val   = String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
      return `
        <tr>
          <td style="padding:11px 18px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(180,155,110,.5);font-family:Courier,'Courier New',monospace;white-space:nowrap;vertical-align:top;border-bottom:1px solid rgba(201,168,76,.06);width:120px;">${label}</td>
          <td style="padding:11px 18px;font-size:13.5px;color:rgba(215,195,155,.88);font-family:Georgia,serif;line-height:1.65;vertical-align:top;border-bottom:1px solid rgba(201,168,76,.06);">${val}</td>
        </tr>`;
    }).join("");

  // Message block (shown separately if present)
  const msgRaw = fields["Message"] || fields["message"] || "";
  const msgHtml = msgRaw ? msgRaw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>") : "";

  // Session / page meta
  const sessionId = fields["Session ID"] || fields["sessionId"] || "";
  const pageUrl   = fields["Page"] || fields["pageUrl"] || "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Aurum Capital · Admin Alert</title>
</head>
<body style="margin:0;padding:0;background:#020508;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#020508;">
  <tr><td align="center" style="padding:36px 16px 0;">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

      <!-- ── HEADER ── -->
      <tr><td style="background:linear-gradient(160deg,#080F1A 0%,#050B14 100%);border-top:2px solid #C9A84C;border-radius:16px 16px 0 0;padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Left: wordmark -->
            <td style="padding:22px 28px;">
              <div style="font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(201,168,76,.65);font-family:Georgia,serif;margin-bottom:4px;">AURUM CAPITAL</div>
              <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(180,155,110,.3);font-family:Courier,'Courier New',monospace;">OPERATIONS CONSOLE</div>
            </td>
            <!-- Right: timestamp -->
            <td style="padding:22px 28px;text-align:right;vertical-align:top;">
              <div style="font-size:9px;color:rgba(180,155,110,.35);font-family:Courier,'Courier New',monospace;letter-spacing:0.06em;">${timestamp}</div>
            </td>
          </tr>
          <!-- Gold rule -->
          <tr><td colspan="2" style="padding:0 0 0;"><div style="height:1px;background:linear-gradient(90deg,rgba(201,168,76,.04),rgba(201,168,76,.35),rgba(201,168,76,.04));"></div></td></tr>
          <!-- Alert heading row -->
          <tr><td colspan="2" style="padding:28px 28px 26px;">
            <!-- Badge -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
              <tr>
                <td style="background:${badge.bg};border:1px solid ${badge.color}33;border-radius:99px;padding:4px 14px;">
                  <span style="font-size:9.5px;letter-spacing:0.18em;text-transform:uppercase;color:${badge.color};font-family:Courier,'Courier New',monospace;">◆ &nbsp; ${badge.label}</span>
                </td>
              </tr>
            </table>
            <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#E8C95A;line-height:1.18;letter-spacing:0.02em;">New ${badge.label}</h1>
            <div style="font-size:13px;color:rgba(180,155,110,.5);font-family:Georgia,serif;font-style:italic;">Action required — respond within 20 minutes</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- ── SENDER DETAILS ── -->
      <tr><td style="background:#050D18;padding:0;border-left:1px solid rgba(201,168,76,.07);border-right:1px solid rgba(201,168,76,.07);">
        <!-- Section label -->
        <div style="padding:18px 28px 0;">
          <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(201,168,76,.4);font-family:Courier,'Courier New',monospace;margin-bottom:12px;">Submission Details</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(201,168,76,.08);">
          ${dataRows}
        </table>
      </td></tr>

      ${msgHtml ? `
      <!-- ── MESSAGE CONTENT ── -->
      <tr><td style="background:#050D18;padding:0 28px 28px;border-left:1px solid rgba(201,168,76,.07);border-right:1px solid rgba(201,168,76,.07);">
        <div style="font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(201,168,76,.4);font-family:Courier,'Courier New',monospace;margin-bottom:12px;padding-top:20px;">Message</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.13);border-left:3px solid rgba(201,168,76,.55);border-radius:2px 10px 10px 2px;padding:18px 22px;">
              <div style="font-size:14px;color:rgba(215,195,155,.85);line-height:1.85;font-family:Georgia,serif;">${msgHtml}</div>
            </td>
          </tr>
        </table>
      </td></tr>` : ""}

      ${sessionId || pageUrl ? `
      <!-- ── META ── -->
      <tr><td style="background:#040B12;padding:16px 28px 18px;border-left:1px solid rgba(201,168,76,.07);border-right:1px solid rgba(201,168,76,.07);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${sessionId ? `<td style="padding-right:24px;"><div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(180,155,110,.38);font-family:Courier,'Courier New',monospace;margin-bottom:5px;">Session</div><div style="font-size:11px;color:rgba(200,180,145,.55);font-family:Courier,'Courier New',monospace;letter-spacing:0.06em;">${sessionId}</div></td>` : ""}
            ${pageUrl ? `<td><div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(180,155,110,.38);font-family:Courier,'Courier New',monospace;margin-bottom:5px;">Page</div><div style="font-size:11px;color:rgba(200,180,145,.45);font-family:Courier,'Courier New',monospace;word-break:break-all;max-width:320px;">${pageUrl}</div></td>` : ""}
          </tr>
        </table>
      </td></tr>` : ""}

      <!-- ── FOOTER ── -->
      <tr><td style="background:#020508;padding:24px 28px 32px;border:1px solid rgba(201,168,76,.06);border-top:1px solid rgba(201,168,76,.1);border-radius:0 0 16px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(201,168,76,.32);font-family:Georgia,serif;margin-bottom:6px;">Aurum Capital · Operations</div>
              <div style="font-size:10px;color:rgba(255,255,255,.18);font-family:Georgia,serif;">Dubai &nbsp;·&nbsp; London &nbsp;·&nbsp; New York &nbsp;·&nbsp; Singapore</div>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <div style="display:inline-block;width:18px;height:18px;transform:rotate(45deg);border:1px solid rgba(201,168,76,.28);"></div>
            </td>
          </tr>
          <tr><td colspan="2" style="padding-top:14px;">
            <div style="font-size:10px;color:rgba(255,255,255,.1);font-family:Georgia,serif;">This is an automated operations alert from your Aurum Capital platform. Do not reply to this email.</div>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════
   HANDLER
═══════════════════════════════════════════════════════ */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { formType, ...fields } = body;

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const ADMIN_EMAIL = fields.adminEmail || Deno.env.get("NOTIFY_EMAIL") || "aurumcapitalinvest@gmail.com";
    const FROM = "Aurum Capital <noreply@aurumcapitalinvest.com>";

    async function sendEmail(to: string, subject: string, html: string) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [to], subject, html }),
      });
    }

    /* ── chat_reply: admin sent a reply → notify the user ── */
    if (formType === "chat_reply") {
      if (fields.email) {
        await sendEmail(
          fields.email,
          "Your Aurum advisor has replied — Aurum Capital",
          buildReplyNotifyEmail(fields.name || "Valued Client", fields.message || "", fields.sessionId || ""),
        ).catch(e => console.error("Reply email failed:", e));
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── All other form types: save to DB ── */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabase.from("contact_submissions").insert({
      form_type:    formType,
      name:         fields.name        || null,
      email:        fields.email       || null,
      message:      fields.message     || null,
      subject:      fields.subject     || null,
      budget:       fields.budget      || null,
      asset_class:  fields.assetClass  || null,
      risk:         fields.risk        || null,
      horizon:      fields.horizon     || null,
      notes:        fields.notes       || null,
      issue_type:   fields.issueType   || null,
      priority:     fields.priority    || null,
      tx_id:        fields.txId        || null,
      outlet:       fields.outlet      || null,
      enquiry_type: fields.enquiryType || null,
    });

    /* ── Admin notification ── */
    try {
      const adminHtml = buildAdminNotifyEmail(formType, {
        Name: fields.name || "",
        Email: fields.email || "",
        Subject: fields.subject || "",
        Message: fields.message || fields.notes || "",
        "Session ID": fields.sessionId || "",
        Page: fields.pageUrl || "",
        Priority: fields.priority || "",
      });
      await sendEmail(ADMIN_EMAIL, fields.subject || `[Aurum] New ${formType} from ${fields.name}`, adminHtml);
    } catch (e) { console.error("Admin notify failed:", e); }

    /* ── User confirmation ── */
    if (fields.email) {
      try {
        let userHtml: string;
        let userSubject: string;

        if (formType === "live_chat_message" || formType === "live_chat_session") {
          userHtml    = buildSessionConfirmEmail(fields.name || "Valued Client", fields.sessionId || "");
          userSubject = "Your support session has begun — Aurum Capital";
        } else {
          userHtml    = buildGenericConfirmEmail(fields.name || "Valued Client", formType);
          userSubject = "We received your message — Aurum Capital";
        }

        await sendEmail(fields.email, userSubject, userHtml);
      } catch (e) { console.error("User confirmation email failed:", e); }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

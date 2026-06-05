import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

    // Support both DB-webhook shape { record: {...} } and direct call { email, id, ... }
    const record = body.record ?? body;

    const email      = record.email as string;
    const id         = record.id         as string;
    const created_at = record.created_at as string;

    // Names live in raw_user_meta_data when triggered by DB webhook;
    // signup.js also sends them there, but fall back to direct fields for safety.
    const meta      = record.raw_user_meta_data ?? record.user_metadata ?? {};
    const firstName = meta.first_name  ?? meta.given_name  ?? (record.first_name as string)  ?? meta.name?.split(" ")[0] ?? "";
    const lastName  = meta.last_name   ?? meta.family_name ?? (record.last_name  as string)  ?? meta.name?.split(" ").slice(1).join(" ") ?? "";
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
          subject: `⬤ New Client — ${fullName} · ${email}`,
          html: buildAdminHtml(fullName, email, id, memberSince, created_at),
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
    const welcomeHtml = buildWelcomeHtml(displayFirst, fullName, memberSince, email);

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
          subject: `Welcome to Aurum Capital, ${displayFirst} — Your Account is Active`,
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
function buildAdminHtml(
  fullName: string,
  email: string,
  id: string,
  memberSince: string,
  created_at: string,
): string {
  const timeStr = new Date(created_at).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC",
  }) + " UTC";

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>New Client Registration</title>
</head>
<body style="margin:0;padding:0;background:#020406;font-family:'Inter',Arial,Helvetica,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#020406;padding:0">
<tr><td align="center" style="padding:36px 16px">

<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#06090f;
              border-radius:24px;
              border:1px solid rgba(201,168,76,.2);
              overflow:hidden;
              box-shadow:0 0 60px rgba(201,168,76,.05),0 32px 64px rgba(0,0,0,.7)">

<!-- TOP ACCENT BAR -->
<tr>
<td style="padding:0;line-height:0;font-size:0;height:3px;
           background:linear-gradient(90deg,transparent,#c9a84c 20%,#f0d878 50%,#c9a84c 80%,transparent)">
</td>
</tr>

<!-- HEADER -->
<tr>
<td style="padding:36px 48px 28px;background:linear-gradient(160deg,#0a1525 0%,#06090f 60%)">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle">
      <p style="margin:0 0 4px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c9a84c;font-family:'Inter',Arial,sans-serif;opacity:.85">
        Aurum Capital · Internal Alert
      </p>
      <h1 style="margin:0;font-size:22px;font-weight:300;color:#edf2f8;font-family:Georgia,serif;letter-spacing:.03em;line-height:1.3">
        New Client Registration
      </h1>
    </td>
    <td align="right" style="vertical-align:middle">
      <div style="display:inline-block;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.28);
                  border-radius:100px;padding:5px 14px">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:6px;vertical-align:middle">
            <div style="width:7px;height:7px;border-radius:50%;background:#22c55e;
                        box-shadow:0 0 6px rgba(34,197,94,.6)"></div>
          </td>
          <td style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;
                     color:#22c55e;font-family:'Inter',Arial,sans-serif;vertical-align:middle">
            Active
          </td>
        </tr></table>
      </div>
    </td>
  </tr></table>
</td>
</tr>

<!-- DIVIDER -->
<tr>
<td style="padding:0 48px">
  <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.3) 30%,rgba(232,208,138,.5) 50%,rgba(201,168,76,.3) 70%,transparent)"></div>
</td>
</tr>

<!-- CLIENT CARD -->
<tr>
<td style="padding:28px 48px">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:linear-gradient(135deg,#0d1e35 0%,#091628 100%);
                border:1px solid rgba(201,168,76,.15);border-radius:16px;overflow:hidden">
    <tr>
      <td style="padding:24px 28px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>

          <!-- Avatar circle with initials -->
          <td width="58" style="vertical-align:top;padding-right:20px">
            <div style="width:54px;height:54px;border-radius:50%;
                        background:linear-gradient(135deg,rgba(201,168,76,.18),rgba(201,168,76,.06));
                        border:1.5px solid rgba(201,168,76,.4);
                        text-align:center;line-height:54px;
                        font-size:18px;font-weight:600;color:#c9a84c;
                        font-family:Georgia,serif;letter-spacing:.05em">
              ${initials || "?"}
            </div>
          </td>

          <!-- Name + email -->
          <td style="vertical-align:middle">
            <p style="margin:0 0 5px;font-size:18px;font-weight:500;color:#edf2f8;
                      font-family:Georgia,serif;letter-spacing:.02em">${fullName}</p>
            <p style="margin:0;font-size:13px;color:#c9a84c;font-family:'Inter',Arial,sans-serif">
              ${email}
            </p>
          </td>

        </tr></table>
      </td>
    </tr>

    <!-- Divider inside card -->
    <tr>
      <td style="padding:0 28px">
        <div style="height:1px;background:rgba(201,168,76,.1)"></div>
      </td>
    </tr>

    <!-- Meta row -->
    <tr>
      <td style="padding:18px 28px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>

          <td width="33%" style="vertical-align:top;padding-right:16px">
            <p style="margin:0 0 5px;font-size:8.5px;letter-spacing:3px;text-transform:uppercase;
                      color:#2e4255;font-family:'Inter',Arial,sans-serif">Registration Date</p>
            <p style="margin:0;font-size:12.5px;color:#8fa8c0;font-family:'Inter',Arial,sans-serif;
                      font-weight:500">${memberSince}</p>
          </td>

          <td width="33%" style="vertical-align:top;padding-right:16px">
            <p style="margin:0 0 5px;font-size:8.5px;letter-spacing:3px;text-transform:uppercase;
                      color:#2e4255;font-family:'Inter',Arial,sans-serif">Time (UTC)</p>
            <p style="margin:0;font-size:12.5px;color:#8fa8c0;font-family:'Inter',Arial,sans-serif;
                      font-weight:500">${timeStr}</p>
          </td>

          <td width="34%" style="vertical-align:top">
            <p style="margin:0 0 5px;font-size:8.5px;letter-spacing:3px;text-transform:uppercase;
                      color:#2e4255;font-family:'Inter',Arial,sans-serif">Plan</p>
            <div style="display:inline-block;background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.04));
                        border:1px solid rgba(201,168,76,.28);border-radius:6px;
                        padding:3px 10px;font-size:10px;letter-spacing:2px;
                        color:#c9a84c;font-family:'Inter',Arial,sans-serif;text-transform:uppercase">
              Premium
            </div>
          </td>

        </tr></table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- USER ID ROW -->
<tr>
<td style="padding:0 48px 28px">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#080f1a;border:1px solid rgba(255,255,255,.05);border-radius:10px">
    <tr>
      <td style="padding:14px 20px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle">
            <p style="margin:0 0 3px;font-size:8px;letter-spacing:3px;text-transform:uppercase;
                      color:#2e4255;font-family:'Inter',Arial,sans-serif">Supabase User ID</p>
            <p style="margin:0;font-size:11px;color:#3d5a72;font-family:'Courier New',monospace;
                      letter-spacing:.05em;word-break:break-all">${id}</p>
          </td>
          <td align="right" style="vertical-align:middle;padding-left:16px;white-space:nowrap">
            <div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;
                        color:#1e3045;font-family:'Inter',Arial,sans-serif">
              UUID v4
            </div>
          </td>
        </tr></table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- ACTION BUTTONS -->
<tr>
<td style="padding:0 48px 32px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>

    <!-- Primary: Open Admin Panel -->
    <td width="58%" style="padding-right:8px">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:10px;overflow:hidden;
                   background:linear-gradient(135deg,#c9a84c 0%,#e8d080 50%,#a87c28 100%);
                   box-shadow:0 6px 24px rgba(201,168,76,.25)">
          <a href="https://aurumcapitalinvest.com/admin-support.html"
             style="display:block;padding:13px 0;color:#060d1a;font-size:11px;
                    font-weight:700;text-decoration:none;letter-spacing:2px;
                    text-transform:uppercase;font-family:'Inter',Arial,sans-serif;text-align:center">
            Open Admin Panel
          </a>
        </td>
      </tr>
      </table>
    </td>

    <!-- Secondary: View in Supabase -->
    <td width="42%" style="padding-left:8px">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:10px;overflow:hidden;
                   border:1px solid rgba(201,168,76,.25);background:rgba(201,168,76,.04)">
          <a href="https://supabase.com/dashboard/project/ttwwthfeordsojmcjwxn/auth/users"
             style="display:block;padding:13px 0;color:#c9a84c;font-size:11px;
                    font-weight:600;text-decoration:none;letter-spacing:1.5px;
                    text-transform:uppercase;font-family:'Inter',Arial,sans-serif;text-align:center">
            Supabase Auth
          </a>
        </td>
      </tr>
      </table>
    </td>

  </tr></table>
</td>
</tr>

<!-- BOTTOM ACCENT BAR -->
<tr>
<td style="padding:0;line-height:0;font-size:0;height:1px;
           background:linear-gradient(90deg,transparent,rgba(201,168,76,.2) 30%,rgba(201,168,76,.35) 50%,rgba(201,168,76,.2) 70%,transparent)">
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:20px 48px;background:#040810;border-radius:0 0 24px 24px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle">
      <p style="margin:0;font-size:9px;letter-spacing:3px;text-transform:uppercase;
                color:#1e2d40;font-family:'Inter',Arial,sans-serif">
        Aurum Capital · Internal Notification
      </p>
    </td>
    <td align="right" style="vertical-align:middle">
      <p style="margin:0;font-size:9px;color:#1a2535;font-family:'Inter',Arial,sans-serif;
                letter-spacing:.5px">
        © 2025 Aurum Capital
      </p>
    </td>
  </tr></table>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
function buildWelcomeHtml(
  firstName: string,
  fullName: string,
  memberSince: string,
  email: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Welcome to Aurum Capital</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  body{margin:0;padding:0;background:#020406}
  table{border-spacing:0;mso-table-lspace:0;mso-table-rspace:0}
  td{padding:0}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
</style>
</head>
<body style="margin:0;padding:0;background:#020406;font-family:'Inter',Arial,Helvetica,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#020406;padding:0">
<tr><td align="center" style="padding:40px 16px">

<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#070b11;
              border-radius:28px;
              border:1px solid rgba(201,168,76,.18);
              overflow:hidden;
              box-shadow:0 0 80px rgba(201,168,76,.06),0 40px 80px rgba(0,0,0,.6)">

<!-- HERO -->
<tr>
<td style="padding:0;line-height:0;font-size:0">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="600" height="340"
     style="display:block;width:100%;max-width:600px">
  <defs>
    <radialGradient id="glow1" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0"/>
      <stop offset="30%" stop-color="#c9a84c" stop-opacity="0.9"/>
      <stop offset="70%" stop-color="#e8d08a" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="emblemGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5e6a0"/>
      <stop offset="40%" stop-color="#c9a84c"/>
      <stop offset="100%" stop-color="#8a6520"/>
    </linearGradient>
  </defs>
  <rect width="600" height="340" fill="#060d1a"/>
  <rect width="600" height="340" fill="url(#glow1)"/>
  <g opacity="0.06" stroke="#c9a84c" stroke-width="0.5">
    <line x1="0" y1="68" x2="600" y2="68"/><line x1="0" y1="136" x2="600" y2="136"/>
    <line x1="0" y1="204" x2="600" y2="204"/><line x1="0" y1="272" x2="600" y2="272"/>
    <line x1="100" y1="0" x2="100" y2="340"/><line x1="200" y1="0" x2="200" y2="340"/>
    <line x1="300" y1="0" x2="300" y2="340"/><line x1="400" y1="0" x2="400" y2="340"/>
    <line x1="500" y1="0" x2="500" y2="340"/>
  </g>
  <circle cx="300" cy="155" r="148" fill="none" stroke="#c9a84c" stroke-width="0.5" opacity="0.12"/>
  <circle cx="300" cy="155" r="130" fill="none" stroke="#c9a84c" stroke-width="0.3" opacity="0.08"/>
  <g opacity="0.35" stroke="#c9a84c" stroke-width="0.8" fill="none">
    <path d="M0,0 L60,0 M0,0 L0,60"/>
    <circle cx="10" cy="10" r="3" fill="#c9a84c" opacity="0.6"/>
  </g>
  <g opacity="0.35" stroke="#c9a84c" stroke-width="0.8" fill="none" transform="translate(600,0) scale(-1,1)">
    <path d="M0,0 L60,0 M0,0 L0,60"/>
    <circle cx="10" cy="10" r="3" fill="#c9a84c" opacity="0.6"/>
  </g>
  <g transform="translate(300,130)">
    <polygon points="0,-48 34,-34 48,0 34,34 0,48 -34,34 -48,0 -34,-34"
             fill="none" stroke="url(#emblemGold)" stroke-width="1" opacity="0.7"/>
    <circle cx="0" cy="0" r="26" fill="rgba(6,13,26,0.7)" stroke="url(#emblemGold)" stroke-width="1.2"/>
    <text x="0" y="9" text-anchor="middle" font-family="Georgia,'Times New Roman',serif"
          font-size="24" font-weight="bold" fill="url(#emblemGold)" letter-spacing="1">A</text>
    <polygon points="0,-52 3,-49 0,-46 -3,-49" fill="#c9a84c" opacity="0.8"/>
    <polygon points="0,46 3,49 0,52 -3,49" fill="#c9a84c" opacity="0.8"/>
  </g>
  <rect x="0" y="218" width="600" height="0.7" fill="url(#goldLine)" opacity="0.7"/>
  <text x="300" y="246" text-anchor="middle" font-family="Georgia,serif"
        font-size="13" letter-spacing="8" fill="#c9a84c" opacity="0.9">AURUM CAPITAL</text>
  <text x="300" y="267" text-anchor="middle" font-family="Arial,sans-serif"
        font-size="9.5" letter-spacing="4.5" fill="#8c9db5" opacity="0.7">PRIVATE WEALTH · ESTABLISHED 2020</text>
  <rect x="60" y="245" width="170" height="0.4" fill="#c9a84c" opacity="0.2"/>
  <rect x="370" y="245" width="170" height="0.4" fill="#c9a84c" opacity="0.2"/>
</svg>
</td>
</tr>

<!-- HEADLINE -->
<tr>
<td style="padding:44px 52px 0;text-align:center;background:#070b11">
  <p style="margin:0 0 10px;font-size:10px;letter-spacing:5px;color:#c9a84c;text-transform:uppercase;font-weight:500;font-family:'Inter',Arial,sans-serif">
    Private Wealth Management
  </p>
  <h1 style="margin:0 0 16px;font-size:36px;font-weight:300;color:#edf2f8;font-family:Georgia,serif;line-height:1.25;letter-spacing:0.02em">
    Welcome to the<br>
    <em style="color:#c9a84c;font-style:italic;font-weight:300">inner circle</em>,&nbsp;${firstName}.
  </h1>
  <p style="margin:0 auto;font-size:14.5px;color:#7a8fa6;line-height:1.8;font-family:'Inter',Arial,sans-serif;max-width:440px">
    Your account has been activated. You now hold exclusive access
    to a platform trusted by clients across
    <span style="color:#c9a84c">Dubai, London, New York</span> and
    <span style="color:#c9a84c">Singapore</span>.
  </p>
</td>
</tr>

<!-- DIVIDER -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.35) 30%,rgba(232,208,138,.6) 50%,rgba(201,168,76,.35) 70%,transparent)"></td></tr>
  </table>
</td>
</tr>

<!-- MEMBERSHIP CARD -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:linear-gradient(135deg,#0f1e35 0%,#0a1525 50%,#0c1930 100%);
                border:1px solid rgba(201,168,76,.22);border-radius:18px;overflow:hidden">
    <tr>
      <td style="padding:24px 28px;border-bottom:1px solid rgba(201,168,76,.1)">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <p style="margin:0;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#c9a84c;font-family:'Inter',Arial,sans-serif">Aurum Capital</p>
            <p style="margin:4px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a6880;font-family:'Inter',Arial,sans-serif">Private Client Account</p>
          </td>
          <td align="right">
            <div style="display:inline-block;background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:5px 12px;font-size:10px;letter-spacing:2px;color:#c9a84c;font-family:'Inter',Arial,sans-serif;text-transform:uppercase">Premium</div>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 16px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="50%" style="padding-right:12px">
            <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#3d5060;font-family:'Inter',Arial,sans-serif">Account Holder</p>
            <p style="margin:0;font-size:16px;color:#edf2f8;font-weight:500;font-family:Georgia,serif;letter-spacing:0.03em">${fullName}</p>
          </td>
          <td width="50%">
            <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#3d5060;font-family:'Inter',Arial,sans-serif">Member Since</p>
            <p style="margin:0;font-size:14px;color:#c9a84c;font-weight:500;font-family:'Inter',Arial,sans-serif">${memberSince}</p>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 20px">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:6px">
            <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.5)"></div>
          </td>
          <td><p style="margin:0;font-size:11px;color:#22c55e;font-family:'Inter',Arial,sans-serif;letter-spacing:1px">ACCOUNT ACTIVE</p></td>
        </tr></table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- ASSET CLASSES -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <p style="margin:0 0 20px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c9a84c;font-family:'Inter',Arial,sans-serif">What You Can Trade</p>
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="49%" style="padding-right:8px;padding-bottom:10px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1825;border:1px solid rgba(247,147,26,.15);border-radius:14px;overflow:hidden">
        <tr><td style="padding:18px 18px 16px">
          <div style="width:34px;height:34px;border-radius:10px;background:rgba(247,147,26,.12);border:1px solid rgba(247,147,26,.2);text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">&#8383;</div>
          <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Crypto</p>
          <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;font-family:'Inter',Arial,sans-serif">BTC &middot; ETH &middot; SOL &middot; XRP<br>and 50+ assets</p>
        </td></tr>
      </table>
    </td>
    <td width="49%" style="padding-left:8px;padding-bottom:10px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1825;border:1px solid rgba(78,127,255,.15);border-radius:14px;overflow:hidden">
        <tr><td style="padding:18px 18px 16px">
          <div style="width:34px;height:34px;border-radius:10px;background:rgba(78,127,255,.12);border:1px solid rgba(78,127,255,.2);text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">&#128200;</div>
          <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Equities</p>
          <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;font-family:'Inter',Arial,sans-serif">TSLA &middot; AAPL &middot; NVDA<br>MSFT &middot; GOOGL &amp; more</p>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td width="49%" style="padding-right:8px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1825;border:1px solid rgba(201,168,76,.15);border-radius:14px;overflow:hidden">
        <tr><td style="padding:18px 18px 16px">
          <div style="width:34px;height:34px;border-radius:10px;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.2);text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">&#127959;</div>
          <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Commodities</p>
          <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;font-family:'Inter',Arial,sans-serif">Gold &middot; Silver<br>Brent Crude Oil</p>
        </td></tr>
      </table>
    </td>
    <td width="49%" style="padding-left:8px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1825;border:1px solid rgba(60,200,200,.15);border-radius:14px;overflow:hidden">
        <tr><td style="padding:18px 18px 16px">
          <div style="width:34px;height:34px;border-radius:10px;background:rgba(60,200,200,.1);border:1px solid rgba(60,200,200,.2);text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">&#127970;</div>
          <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Real Estate</p>
          <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;font-family:'Inter',Arial,sans-serif">Dubai &middot; London &middot; NYC<br>Singapore &middot; Paris</p>
        </td></tr>
      </table>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- DIVIDER -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.2) 30%,rgba(201,168,76,.35) 50%,rgba(201,168,76,.2) 70%,transparent)"></td></tr>
  </table>
</td>
</tr>

<!-- NEXT STEPS -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <p style="margin:0 0 20px;font-size:9px;letter-spacing:5px;text-transform:uppercase;color:#c9a84c;font-family:'Inter',Arial,sans-serif">Your First Three Steps</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
  <tr>
    <td width="44" style="vertical-align:top;padding-top:2px">
      <div style="width:32px;height:32px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);text-align:center;line-height:32px;font-size:12px;font-weight:700;color:#c9a84c;font-family:'Inter',Arial,sans-serif">1</div>
    </td>
    <td style="vertical-align:top">
      <p style="margin:0 0 3px;font-size:13.5px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Complete Your Profile</p>
      <p style="margin:0;font-size:12px;color:#4a6070;line-height:1.5;font-family:'Inter',Arial,sans-serif">Set your avatar, financial goals and investment preferences in the Profile section.</p>
    </td>
  </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
  <tr>
    <td width="44" style="vertical-align:top;padding-top:2px">
      <div style="width:32px;height:32px;border-radius:50%;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);text-align:center;line-height:32px;font-size:12px;font-weight:700;color:#22c55e;font-family:'Inter',Arial,sans-serif">2</div>
    </td>
    <td style="vertical-align:top">
      <p style="margin:0 0 3px;font-size:13.5px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Fund Your Account</p>
      <p style="margin:0;font-size:12px;color:#4a6070;line-height:1.5;font-family:'Inter',Arial,sans-serif">Deposit via bank transfer, card or crypto. Minimum from $10. Funds settle instantly.</p>
    </td>
  </tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="44" style="vertical-align:top;padding-top:2px">
      <div style="width:32px;height:32px;border-radius:50%;background:rgba(78,127,255,.08);border:1px solid rgba(78,127,255,.2);text-align:center;line-height:32px;font-size:12px;font-weight:700;color:#4e7fff;font-family:'Inter',Arial,sans-serif">3</div>
    </td>
    <td style="vertical-align:top">
      <p style="margin:0 0 3px;font-size:13.5px;font-weight:600;color:#edf2f8;font-family:'Inter',Arial,sans-serif">Place Your First Trade</p>
      <p style="margin:0;font-size:12px;color:#4a6070;line-height:1.5;font-family:'Inter',Arial,sans-serif">Access live markets across 4 asset classes. Execute spot trades or open CFD positions.</p>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- QUOTE -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(201,168,76,.02));
                border-left:2px solid #c9a84c;border-radius:0 12px 12px 0">
    <tr><td style="padding:20px 24px">
      <p style="margin:0 0 8px;font-size:16px;font-style:italic;font-weight:300;color:#d4b86a;line-height:1.6;font-family:Georgia,serif">
        &ldquo;Wealth is not about having a lot of money; it&rsquo;s about having a lot of options.&rdquo;
      </p>
      <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#3d5060;font-family:'Inter',Arial,sans-serif">&mdash; Chris Rock</p>
    </td></tr>
  </table>
</td>
</tr>

<!-- CTA -->
<tr>
<td style="padding:36px 52px;background:#070b11;text-align:center">
  <table cellpadding="0" cellspacing="0" align="center">
  <tr>
    <td style="border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#c9a84c 0%,#e8d08a 50%,#a87c28 100%);box-shadow:0 8px 32px rgba(201,168,76,.3)">
      <a href="https://aurumcapitalinvest.com/dashboard.html"
         style="display:block;padding:16px 48px;color:#060d1a;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:2px;text-transform:uppercase;font-family:'Inter',Arial,sans-serif">
        Enter Your Dashboard &nbsp;&rarr;
      </a>
    </td>
  </tr>
  </table>
  <p style="margin:16px 0 0;font-size:11px;color:#2d3f52;font-family:'Inter',Arial,sans-serif">
    Or visit <a href="https://aurumcapitalinvest.com" style="color:#c9a84c;text-decoration:none">aurumcapitalinvest.com</a>
  </p>
</td>
</tr>

<!-- SUPPORT -->
<tr>
<td style="padding:0 52px 32px;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#0a1320;border:1px solid rgba(255,255,255,.05);border-radius:14px">
    <tr>
      <td style="padding:20px 24px;border-right:1px solid rgba(255,255,255,.05);width:50%;vertical-align:top">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#3d5060;font-family:'Inter',Arial,sans-serif">Dedicated Support</p>
        <p style="margin:0;font-size:12px;color:#7a8fa6;font-family:'Inter',Arial,sans-serif">Available 24 / 7 via live chat and email for all client enquiries.</p>
      </td>
      <td style="padding:20px 24px;width:50%;vertical-align:top">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#3d5060;font-family:'Inter',Arial,sans-serif">Contact Us</p>
        <p style="margin:0;font-size:12px;color:#7a8fa6;font-family:'Inter',Arial,sans-serif">
          <a href="https://aurumcapitalinvest.com/contact.html" style="color:#c9a84c;text-decoration:none">Contact page</a>
          &nbsp;&middot;&nbsp;Reply to this email
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:24px 52px 28px;background:#040810;border-top:1px solid rgba(201,168,76,.1);border-radius:0 0 28px 28px;text-align:center">
  <div style="display:inline-block;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#c9a84c,#8a6520);text-align:center;line-height:28px;font-size:13px;font-weight:900;color:#040608;margin-bottom:14px;font-family:Georgia,serif">A</div>
  <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#c9a84c;font-family:'Inter',Arial,sans-serif;opacity:.8">Aurum Capital</p>
  <p style="margin:0 0 12px;font-size:10px;color:#2d3f52;letter-spacing:1.5px;font-family:'Inter',Arial,sans-serif">Dubai &nbsp;&middot;&nbsp; London &nbsp;&middot;&nbsp; New York &nbsp;&middot;&nbsp; Singapore</p>
  <p style="margin:0;font-size:10px;color:#1e2d40;line-height:1.7;font-family:'Inter',Arial,sans-serif">
    This email was sent to <span style="color:#2d4060">${email}</span> because you created an account.<br>
    &copy; 2025 Aurum Capital. All rights reserved. Regulated &nbsp;&middot;&nbsp; Secure &nbsp;&middot;&nbsp; Trusted
  </p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

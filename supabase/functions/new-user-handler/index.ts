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
    const { email, id, created_at, first_name, last_name } = body.record;
    const fullName = `${first_name || ""} ${last_name || ""}`.trim() || "Valued Client";
    const firstName = first_name || fullName;
    const memberSince = new Date(created_at).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    // ── 1. Admin notification ─────────────────────────────────────────────
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aurum Capital <onboarding@resend.dev>",
          to: [Deno.env.get("NOTIFY_EMAIL")!],
          subject: `New Client Registered — ${fullName} (${email})`,
          html: `
            <div style="font-family:Arial,sans-serif;background:#040608;color:#edf2f8;
                        padding:40px;border-radius:16px;max-width:600px;margin:0 auto">
              <h2 style="color:#c9a84c;margin-top:0">New Client Registration</h2>
              <p><b>Name:</b> ${fullName}</p>
              <p><b>Email:</b> ${email}</p>
              <p><b>User ID:</b> ${id}</p>
              <p><b>Registered:</b> ${memberSince}</p>
              <hr style="border-color:#1e2d40;margin:24px 0">
              <p style="color:#5a6880;font-size:12px;margin:0">© 2025 Aurum Capital</p>
            </div>`,
        }),
      });
    } catch (e) {
      console.error("Admin notify failed:", e);
    }

    // ── 2. Premium welcome email to new member ────────────────────────────
    const welcomeHtml = `<!DOCTYPE html>
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
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap');
  body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  body{margin:0;padding:0;background:#020406}
  table{border-spacing:0;mso-table-lspace:0;mso-table-rspace:0}
  td{padding:0}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  @media(prefers-color-scheme:dark){.dark-bg{background:#020406!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#020406;font-family:'Inter',Arial,Helvetica,sans-serif">

<!-- ═══════════════════════════════════════════════════════════════
     OUTER WRAPPER
═══════════════════════════════════════════════════════════════════ -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#020406;padding:0">
<tr><td align="center" style="padding:40px 16px">

<!-- ═══════════════════════════════════════════════════════════════
     CARD  600px
═══════════════════════════════════════════════════════════════════ -->
<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#070b11;
              border-radius:28px;
              border:1px solid rgba(201,168,76,.18);
              overflow:hidden;
              box-shadow:0 0 80px rgba(201,168,76,.06),0 40px 80px rgba(0,0,0,.6)">

<!-- ─────────────────────────────────────────────────────────────
     HERO PANEL  — full-width SVG artwork
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:0;line-height:0;font-size:0">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="background:linear-gradient(160deg,#0b1628 0%,#060d1a 50%,#03080f 100%);
           padding:0;position:relative;border-radius:28px 28px 0 0;overflow:hidden">

<!-- SVG Hero Art -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 340" width="600" height="340"
     style="display:block;width:100%;max-width:600px">
  <defs>
    <radialGradient id="glow1" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="15%" cy="80%" r="40%">
      <stop offset="0%" stop-color="#4e7fff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#4e7fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0"/>
      <stop offset="30%" stop-color="#c9a84c" stop-opacity="0.9"/>
      <stop offset="70%" stop-color="#e8d08a" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="goldLineV" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0"/>
      <stop offset="40%" stop-color="#c9a84c" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="emblemGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5e6a0"/>
      <stop offset="40%" stop-color="#c9a84c"/>
      <stop offset="100%" stop-color="#8a6520"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="340" fill="#060d1a"/>
  <rect width="600" height="340" fill="url(#glow1)"/>
  <rect width="600" height="340" fill="url(#glow2)"/>

  <!-- Fine grid lines -->
  <g opacity="0.06" stroke="#c9a84c" stroke-width="0.5">
    <line x1="0" y1="68" x2="600" y2="68"/>
    <line x1="0" y1="136" x2="600" y2="136"/>
    <line x1="0" y1="204" x2="600" y2="204"/>
    <line x1="0" y1="272" x2="600" y2="272"/>
    <line x1="100" y1="0" x2="100" y2="340"/>
    <line x1="200" y1="0" x2="200" y2="340"/>
    <line x1="300" y1="0" x2="300" y2="340"/>
    <line x1="400" y1="0" x2="400" y2="340"/>
    <line x1="500" y1="0" x2="500" y2="340"/>
  </g>

  <!-- Diagonal accent lines -->
  <g opacity="0.04" stroke="#c9a84c" stroke-width="0.5">
    <line x1="-100" y1="340" x2="340" y2="-100"/>
    <line x1="0" y1="340" x2="440" y2="-100"/>
    <line x1="160" y1="340" x2="600" y2="-100"/>
    <line x1="260" y1="340" x2="700" y2="-100"/>
  </g>

  <!-- Outer decorative ring — large -->
  <circle cx="300" cy="155" r="148" fill="none" stroke="#c9a84c" stroke-width="0.5" opacity="0.12"/>
  <circle cx="300" cy="155" r="130" fill="none" stroke="#c9a84c" stroke-width="0.3" opacity="0.08"/>
  <circle cx="300" cy="155" r="168" fill="none" stroke="#c9a84c" stroke-width="0.3" opacity="0.05"/>

  <!-- Corner filigree — top left -->
  <g opacity="0.35" stroke="#c9a84c" stroke-width="0.8" fill="none">
    <path d="M0,0 L60,0 M0,0 L0,60"/>
    <path d="M10,0 L10,20 Q10,30 20,30 L60,30" stroke-width="0.4" opacity="0.5"/>
    <path d="M0,10 L20,10 Q30,10 30,20 L30,60" stroke-width="0.4" opacity="0.5"/>
    <circle cx="10" cy="10" r="3" fill="#c9a84c" opacity="0.6"/>
  </g>

  <!-- Corner filigree — top right -->
  <g opacity="0.35" stroke="#c9a84c" stroke-width="0.8" fill="none" transform="translate(600,0) scale(-1,1)">
    <path d="M0,0 L60,0 M0,0 L0,60"/>
    <path d="M10,0 L10,20 Q10,30 20,30 L60,30" stroke-width="0.4" opacity="0.5"/>
    <path d="M0,10 L20,10 Q30,10 30,20 L30,60" stroke-width="0.4" opacity="0.5"/>
    <circle cx="10" cy="10" r="3" fill="#c9a84c" opacity="0.6"/>
  </g>

  <!-- Corner filigree — bottom left -->
  <g opacity="0.35" stroke="#c9a84c" stroke-width="0.8" fill="none" transform="translate(0,340) scale(1,-1)">
    <path d="M0,0 L60,0 M0,0 L0,60"/>
    <circle cx="10" cy="10" r="3" fill="#c9a84c" opacity="0.6"/>
  </g>

  <!-- Corner filigree — bottom right -->
  <g opacity="0.35" stroke="#c9a84c" stroke-width="0.8" fill="none" transform="translate(600,340) scale(-1,-1)">
    <path d="M0,0 L60,0 M0,0 L0,60"/>
    <circle cx="10" cy="10" r="3" fill="#c9a84c" opacity="0.6"/>
  </g>

  <!-- Central emblem -->
  <g transform="translate(300,130)">
    <!-- Outer octagon ring -->
    <polygon points="0,-48 34,-34 48,0 34,34 0,48 -34,34 -48,0 -34,-34"
             fill="none" stroke="url(#emblemGold)" stroke-width="1" opacity="0.7"/>
    <polygon points="0,-38 27,-27 38,0 27,27 0,38 -27,27 -38,0 -27,-27"
             fill="none" stroke="#c9a84c" stroke-width="0.5" opacity="0.4"/>
    <!-- Inner filled shape -->
    <circle cx="0" cy="0" r="28" fill="url(#emblemGold)" opacity="0.12"/>
    <circle cx="0" cy="0" r="26" fill="rgba(6,13,26,0.7)" stroke="url(#emblemGold)" stroke-width="1.2"/>
    <!-- A monogram -->
    <text x="0" y="9" text-anchor="middle"
          font-family="Georgia,'Times New Roman',serif"
          font-size="24" font-weight="bold"
          fill="url(#emblemGold)" letter-spacing="1">A</text>
    <!-- Small diamond accents at cardinal points -->
    <polygon points="0,-52 3,-49 0,-46 -3,-49" fill="#c9a84c" opacity="0.8"/>
    <polygon points="0,46 3,49 0,52 -3,49" fill="#c9a84c" opacity="0.8"/>
    <polygon points="-52,0 -49,3 -46,0 -49,-3" fill="#c9a84c" opacity="0.8"/>
    <polygon points="52,0 49,3 46,0 49,-3" fill="#c9a84c" opacity="0.8"/>
  </g>

  <!-- Horizontal gold rule -->
  <rect x="0" y="218" width="600" height="0.7" fill="url(#goldLine)" opacity="0.7"/>

  <!-- Brand name -->
  <text x="300" y="246" text-anchor="middle"
        font-family="Georgia,'Cormorant Garamond',serif"
        font-size="13" letter-spacing="8" fill="#c9a84c" opacity="0.9"
        font-weight="normal">AURUM CAPITAL</text>

  <!-- Tagline -->
  <text x="300" y="267" text-anchor="middle"
        font-family="'Helvetica Neue',Arial,sans-serif"
        font-size="9.5" letter-spacing="4.5" fill="#8c9db5" opacity="0.7">
    PRIVATE WEALTH · ESTABLISHED 2020
  </text>

  <!-- Flanking lines for text -->
  <rect x="60" y="245" width="170" height="0.4" fill="#c9a84c" opacity="0.2"/>
  <rect x="370" y="245" width="170" height="0.4" fill="#c9a84c" opacity="0.2"/>

  <!-- Small asset icons row -->
  <g transform="translate(300,300)" opacity="0.5">
    <text x="-88" y="4" text-anchor="middle" font-family="Arial" font-size="10" fill="#c9a84c">₿</text>
    <text x="-44" y="4" text-anchor="middle" font-family="Arial" font-size="10" fill="#8c9db5">⟠</text>
    <text x="0"   y="4" text-anchor="middle" font-family="Arial" font-size="10" fill="#c9a84c">🥇</text>
    <text x="44"  y="4" text-anchor="middle" font-family="Arial" font-size="10" fill="#8c9db5">📈</text>
    <text x="88"  y="4" text-anchor="middle" font-family="Arial" font-size="10" fill="#c9a84c">🏢</text>
    <!-- dividers -->
    <rect x="-66" y="-5" width="0.5" height="14" fill="#c9a84c" opacity="0.3"/>
    <rect x="-22" y="-5" width="0.5" height="14" fill="#c9a84c" opacity="0.3"/>
    <rect x="22"  y="-5" width="0.5" height="14" fill="#c9a84c" opacity="0.3"/>
    <rect x="66"  y="-5" width="0.5" height="14" fill="#c9a84c" opacity="0.3"/>
  </g>

  <!-- Bottom fade -->
  <rect x="0" y="300" width="600" height="40" fill="url(#glow1)" opacity="0.3"/>
</svg>

</td>
</tr>
</table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     WELCOME HEADLINE
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:44px 52px 0;text-align:center;background:#070b11">
  <p style="margin:0 0 10px;font-size:10px;letter-spacing:5px;
             color:#c9a84c;text-transform:uppercase;font-weight:500;
             font-family:'Inter',Arial,sans-serif">
    Private Wealth Management
  </p>
  <h1 style="margin:0 0 16px;font-size:36px;font-weight:300;color:#edf2f8;
             font-family:Georgia,'Cormorant Garamond',serif;
             line-height:1.25;letter-spacing:0.02em">
    Welcome to the<br>
    <em style="color:#c9a84c;font-style:italic;font-weight:300">inner circle</em>,&nbsp;${firstName}.
  </h1>
  <p style="margin:0;font-size:14.5px;color:#7a8fa6;line-height:1.8;
            font-family:'Inter',Arial,sans-serif;max-width:440px;
            margin-left:auto;margin-right:auto">
    Your account has been activated. You now hold exclusive access
    to a platform trusted by clients across
    <span style="color:#c9a84c">Dubai, London, New York</span> and
    <span style="color:#c9a84c">Singapore</span>.
  </p>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     GOLD DIVIDER
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.35) 30%,rgba(232,208,138,.6) 50%,rgba(201,168,76,.35) 70%,transparent)"></td>
  </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     MEMBERSHIP CARD
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:linear-gradient(135deg,#0f1e35 0%,#0a1525 50%,#0c1930 100%);
                border:1px solid rgba(201,168,76,.22);
                border-radius:18px;overflow:hidden;
                box-shadow:0 8px 40px rgba(201,168,76,.06)">
    <tr>
      <td style="padding:24px 28px;border-bottom:1px solid rgba(201,168,76,.1)">
        <!-- Card top row -->
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:9px;letter-spacing:4px;text-transform:uppercase;
                       color:#c9a84c;font-family:'Inter',Arial,sans-serif">Aurum Capital</p>
            <p style="margin:4px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;
                       color:#5a6880;font-family:'Inter',Arial,sans-serif">Private Client Account</p>
          </td>
          <td align="right">
            <div style="display:inline-block;background:linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.05));
                        border:1px solid rgba(201,168,76,.3);border-radius:8px;
                        padding:5px 12px;font-size:10px;letter-spacing:2px;
                        color:#c9a84c;font-family:'Inter',Arial,sans-serif;text-transform:uppercase">
              Premium
            </div>
          </td>
        </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 16px">
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-right:12px">
            <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;text-transform:uppercase;
                       color:#3d5060;font-family:'Inter',Arial,sans-serif">Account Holder</p>
            <p style="margin:0;font-size:16px;color:#edf2f8;font-weight:500;
                       font-family:Georgia,serif;letter-spacing:0.03em">${fullName}</p>
          </td>
          <td width="50%">
            <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;text-transform:uppercase;
                       color:#3d5060;font-family:'Inter',Arial,sans-serif">Member Since</p>
            <p style="margin:0;font-size:14px;color:#c9a84c;font-weight:500;
                       font-family:'Inter',Arial,sans-serif">${memberSince}</p>
          </td>
        </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 20px">
        <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:6px">
            <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;
                        box-shadow:0 0 8px rgba(34,197,94,.5)"></div>
          </td>
          <td>
            <p style="margin:0;font-size:11px;color:#22c55e;
                       font-family:'Inter',Arial,sans-serif;letter-spacing:1px">
              ACCOUNT ACTIVE
            </p>
          </td>
        </tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     ASSET CLASSES  — 2×2 grid
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <p style="margin:0 0 20px;font-size:9px;letter-spacing:5px;text-transform:uppercase;
             color:#c9a84c;font-family:'Inter',Arial,sans-serif">
    What You Can Trade
  </p>
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <!-- Crypto -->
    <td width="49%" style="padding-right:8px;padding-bottom:10px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0d1825;border:1px solid rgba(247,147,26,.15);
                    border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:18px 18px 16px">
            <div style="width:34px;height:34px;border-radius:10px;
                        background:rgba(247,147,26,.12);border:1px solid rgba(247,147,26,.2);
                        text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">₿</div>
            <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;
                       font-family:'Inter',Arial,sans-serif">Crypto</p>
            <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;
                       font-family:'Inter',Arial,sans-serif">BTC · ETH · SOL · XRP<br>and 50+ assets</p>
          </td>
        </tr>
      </table>
    </td>
    <!-- Equities -->
    <td width="49%" style="padding-left:8px;padding-bottom:10px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0d1825;border:1px solid rgba(78,127,255,.15);
                    border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:18px 18px 16px">
            <div style="width:34px;height:34px;border-radius:10px;
                        background:rgba(78,127,255,.12);border:1px solid rgba(78,127,255,.2);
                        text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">📈</div>
            <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;
                       font-family:'Inter',Arial,sans-serif">Equities</p>
            <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;
                       font-family:'Inter',Arial,sans-serif">TSLA · AAPL · NVDA<br>MSFT · GOOGL & more</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <!-- Commodities -->
    <td width="49%" style="padding-right:8px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0d1825;border:1px solid rgba(201,168,76,.15);
                    border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:18px 18px 16px">
            <div style="width:34px;height:34px;border-radius:10px;
                        background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.2);
                        text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">🥇</div>
            <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;
                       font-family:'Inter',Arial,sans-serif">Commodities</p>
            <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;
                       font-family:'Inter',Arial,sans-serif">Gold · Silver<br>Brent Crude Oil</p>
          </td>
        </tr>
      </table>
    </td>
    <!-- Real Estate -->
    <td width="49%" style="padding-left:8px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0d1825;border:1px solid rgba(60,200,200,.15);
                    border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:18px 18px 16px">
            <div style="width:34px;height:34px;border-radius:10px;
                        background:rgba(60,200,200,.1);border:1px solid rgba(60,200,200,.2);
                        text-align:center;line-height:34px;font-size:16px;margin-bottom:10px">🏢</div>
            <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#edf2f8;
                       font-family:'Inter',Arial,sans-serif">Real Estate</p>
            <p style="margin:0;font-size:11px;color:#4a6070;line-height:1.4;
                       font-family:'Inter',Arial,sans-serif">Dubai · London · NYC<br>Singapore · Paris</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     DIVIDER
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.2) 30%,rgba(201,168,76,.35) 50%,rgba(201,168,76,.2) 70%,transparent)"></td>
  </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     NEXT STEPS
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <p style="margin:0 0 20px;font-size:9px;letter-spacing:5px;text-transform:uppercase;
             color:#c9a84c;font-family:'Inter',Arial,sans-serif">
    Your First Three Steps
  </p>

  <!-- Step 1 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
  <tr>
    <td width="44" style="vertical-align:top;padding-top:2px">
      <div style="width:32px;height:32px;border-radius:50%;
                  background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);
                  text-align:center;line-height:32px;
                  font-size:12px;font-weight:700;color:#c9a84c;
                  font-family:'Inter',Arial,sans-serif">1</div>
    </td>
    <td style="vertical-align:top">
      <p style="margin:0 0 3px;font-size:13.5px;font-weight:600;color:#edf2f8;
                 font-family:'Inter',Arial,sans-serif">Complete Your Profile</p>
      <p style="margin:0;font-size:12px;color:#4a6070;line-height:1.5;
                 font-family:'Inter',Arial,sans-serif">
        Set your avatar, financial goals and investment preferences in the Profile section.
      </p>
    </td>
  </tr>
  </table>

  <!-- Step 2 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">
  <tr>
    <td width="44" style="vertical-align:top;padding-top:2px">
      <div style="width:32px;height:32px;border-radius:50%;
                  background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);
                  text-align:center;line-height:32px;
                  font-size:12px;font-weight:700;color:#22c55e;
                  font-family:'Inter',Arial,sans-serif">2</div>
    </td>
    <td style="vertical-align:top">
      <p style="margin:0 0 3px;font-size:13.5px;font-weight:600;color:#edf2f8;
                 font-family:'Inter',Arial,sans-serif">Fund Your Account</p>
      <p style="margin:0;font-size:12px;color:#4a6070;line-height:1.5;
                 font-family:'Inter',Arial,sans-serif">
        Deposit via bank transfer, card or crypto. Minimum from $10. Funds settle instantly.
      </p>
    </td>
  </tr>
  </table>

  <!-- Step 3 -->
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td width="44" style="vertical-align:top;padding-top:2px">
      <div style="width:32px;height:32px;border-radius:50%;
                  background:rgba(78,127,255,.08);border:1px solid rgba(78,127,255,.2);
                  text-align:center;line-height:32px;
                  font-size:12px;font-weight:700;color:#4e7fff;
                  font-family:'Inter',Arial,sans-serif">3</div>
    </td>
    <td style="vertical-align:top">
      <p style="margin:0 0 3px;font-size:13.5px;font-weight:600;color:#edf2f8;
                 font-family:'Inter',Arial,sans-serif">Place Your First Trade</p>
      <p style="margin:0;font-size:12px;color:#4a6070;line-height:1.5;
                 font-family:'Inter',Arial,sans-serif">
        Access live markets across 4 asset classes. Execute spot trades or open CFD positions.
      </p>
    </td>
  </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     PREMIUM QUOTE
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:32px 52px 0;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(201,168,76,.02));
                border-left:2px solid #c9a84c;border-radius:0 12px 12px 0;
                padding:20px 24px">
    <tr>
      <td style="padding:20px 24px">
        <p style="margin:0 0 8px;font-size:16px;font-style:italic;font-weight:300;
                   color:#d4b86a;line-height:1.6;
                   font-family:Georgia,'Cormorant Garamond',serif">
          "Wealth is not about having a lot of money; it's about having a lot of options."
        </p>
        <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;
                   color:#3d5060;font-family:'Inter',Arial,sans-serif">
          — Chris Rock
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     CTA BUTTON
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:36px 52px;background:#070b11;text-align:center">
  <table cellpadding="0" cellspacing="0" align="center">
  <tr>
    <td style="border-radius:14px;overflow:hidden;
               background:linear-gradient(135deg,#c9a84c 0%,#e8d08a 50%,#a87c28 100%);
               box-shadow:0 8px 32px rgba(201,168,76,.3)">
      <a href="https://aurumcapitalinvest.com/dashboard.html"
         style="display:block;padding:16px 48px;
                color:#060d1a;font-size:14px;font-weight:700;
                text-decoration:none;letter-spacing:2px;text-transform:uppercase;
                font-family:'Inter',Arial,sans-serif">
        Enter Your Dashboard &nbsp;→
      </a>
    </td>
  </tr>
  </table>
  <p style="margin:16px 0 0;font-size:11px;color:#2d3f52;
             font-family:'Inter',Arial,sans-serif">
    Or visit
    <a href="https://aurumcapitalinvest.com"
       style="color:#c9a84c;text-decoration:none">aurumcapitalinvest.com</a>
  </p>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     SUPPORT ROW
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:0 52px 32px;background:#070b11">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#0a1320;border:1px solid rgba(255,255,255,.05);
                border-radius:14px">
    <tr>
      <td style="padding:20px 24px;border-right:1px solid rgba(255,255,255,.05);width:50%;vertical-align:top">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;
                   color:#3d5060;font-family:'Inter',Arial,sans-serif">Dedicated Support</p>
        <p style="margin:0;font-size:12px;color:#7a8fa6;
                   font-family:'Inter',Arial,sans-serif">
          Available 24 / 7 via live chat and email for all client enquiries.
        </p>
      </td>
      <td style="padding:20px 24px;width:50%;vertical-align:top">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;
                   color:#3d5060;font-family:'Inter',Arial,sans-serif">Contact Us</p>
        <p style="margin:0;font-size:12px;color:#7a8fa6;font-family:'Inter',Arial,sans-serif">
          <a href="https://aurumcapitalinvest.com/contact.html"
             style="color:#c9a84c;text-decoration:none">Contact page</a>
          &nbsp;·&nbsp;Reply to this email
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- ─────────────────────────────────────────────────────────────
     FOOTER
───────────────────────────────────────────────────────────────── -->
<tr>
<td style="padding:24px 52px 28px;
           background:#040810;
           border-top:1px solid rgba(201,168,76,.1);
           border-radius:0 0 28px 28px;
           text-align:center">
  <!-- Mini logo -->
  <div style="display:inline-block;width:28px;height:28px;border-radius:8px;
              background:linear-gradient(135deg,#c9a84c,#8a6520);
              text-align:center;line-height:28px;
              font-size:13px;font-weight:900;color:#040608;
              margin-bottom:14px;font-family:Georgia,serif">A</div>
  <p style="margin:0 0 8px;font-size:10px;letter-spacing:4px;
             text-transform:uppercase;color:#c9a84c;
             font-family:'Inter',Arial,sans-serif;opacity:.8">
    Aurum Capital
  </p>
  <p style="margin:0 0 12px;font-size:10px;color:#2d3f52;
             letter-spacing:1.5px;font-family:'Inter',Arial,sans-serif">
    Dubai &nbsp;·&nbsp; London &nbsp;·&nbsp; New York &nbsp;·&nbsp; Singapore
  </p>
  <p style="margin:0;font-size:10px;color:#1e2d40;line-height:1.7;
             font-family:'Inter',Arial,sans-serif">
    This email was sent to <span style="color:#2d4060">${email}</span> because you created an account.<br>
    © 2025 Aurum Capital. All rights reserved.
    Regulated &nbsp;·&nbsp; Secure &nbsp;·&nbsp; Trusted
  </p>
</td>
</tr>

</table>
<!-- /CARD -->

</td></tr>
</table>
<!-- /OUTER WRAPPER -->

</body>
</html>`;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Aurum Capital <onboarding@resend.dev>",
          to: [email],
          subject: `Welcome to Aurum Capital, ${firstName} — Your Account is Active`,
          html: welcomeHtml,
        }),
      });
    } catch (e) {
      console.error("Welcome email failed:", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

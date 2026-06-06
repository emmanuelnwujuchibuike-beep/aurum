import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ─────────────────────────────────────────────────────────────────────────────
//  Typed return for parseDepositDetails
// ─────────────────────────────────────────────────────────────────────────────
interface DepDetails {
  method: string;
  methodLabel: string;
  accentColor: string;
  accentRgb: string;
  methodDesc: string;
  rows: Array<{ label: string; value: string; mono?: boolean; gold?: boolean }>;
  cardHtml?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Premium card visual — renders a realistic branded card for email
// ─────────────────────────────────────────────────────────────────────────────
function buildCardVisual(cardType: string, rawLastFour: string, cardholder: string, expiry?: string): string {
  const ct = cardType.toLowerCase();

  // Extract just the 4 digits from "•••• 4521" or "4521"
  const digits = rawLastFour.replace(/\D/g, "").slice(-4);
  const maskedNum = digits
    ? `&bull;&bull;&bull;&bull;&nbsp;&nbsp;&bull;&bull;&bull;&bull;&nbsp;&nbsp;&bull;&bull;&bull;&bull;&nbsp;&nbsp;${digits}`
    : `&bull;&bull;&bull;&bull;&nbsp;&nbsp;&bull;&bull;&bull;&bull;&nbsp;&nbsp;&bull;&bull;&bull;&bull;&nbsp;&nbsp;&bull;&bull;&bull;&bull;`;

  const name = (cardholder && cardholder !== "—" ? cardholder : "CARDHOLDER")
    .toUpperCase()
    .slice(0, 22);

  // Per-brand gradient + logo
  let gradient = "linear-gradient(135deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)";
  let logo = `<span style="font-size:12px;font-weight:700;color:rgba(255,255,255,.7);font-family:Arial,sans-serif;letter-spacing:2px;">CARD</span>`;
  let shineColor = "rgba(255,255,255,.04)";

  if (ct.includes("visa")) {
    gradient   = "linear-gradient(135deg,#1a1f71 0%,#2832a0 50%,#0d1550 100%)";
    logo       = `<span style="font-size:24px;font-weight:800;color:white;font-family:Georgia,serif;letter-spacing:4px;font-style:italic;text-shadow:0 2px 8px rgba(0,0,0,.5);">VISA</span>`;
    shineColor = "rgba(255,255,255,.07)";
  } else if (ct.includes("mastercard") || ct.includes("master card")) {
    gradient   = "linear-gradient(135deg,#140000 0%,#2d0a0a 45%,#1f0500 100%)";
    // Two overlapping MC circles using a table column trick
    logo       = `<table cellpadding="0" cellspacing="0" style="display:inline-table;border-collapse:collapse;"><tr>
      <td style="width:24px;height:24px;background:#eb001b;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
      <td style="width:12px;height:24px;background:linear-gradient(90deg,#f79e1b 0%,#eb001b 100%);font-size:0;line-height:0;">&nbsp;</td>
      <td style="width:24px;height:24px;background:#f79e1b;border-radius:50%;font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>`;
    shineColor = "rgba(235,0,27,.15)";
  } else if (ct.includes("amex") || ct.includes("american")) {
    gradient   = "linear-gradient(135deg,#0a3d62 0%,#0560a0 50%,#003a80 100%)";
    logo       = `<span style="font-size:8px;font-weight:700;color:rgba(255,255,255,.88);font-family:Arial,sans-serif;letter-spacing:2.5px;line-height:1.45;display:inline-block;text-align:right;">AMERICAN<br/>EXPRESS</span>`;
    shineColor = "rgba(5,96,160,.2)";
  } else if (ct.includes("discover")) {
    gradient   = "linear-gradient(135deg,#1c0600 0%,#341000 45%,#1c0600 100%)";
    logo       = `<span style="font-size:13px;font-weight:700;font-family:Arial,sans-serif;letter-spacing:1px;"><span style="color:#f76b00;">DISC</span><span style="color:white;">OVER</span></span>`;
    shineColor = "rgba(247,107,0,.15)";
  } else if (ct.includes("walmart")) {
    gradient   = "linear-gradient(135deg,#001540 0%,#002d7a 45%,#0061b0 100%)";
    logo       = `<span style="font-size:12px;font-weight:700;color:white;font-family:Arial,sans-serif;letter-spacing:1px;">walmart <span style="color:#ffc220;font-size:15px;">&#9733;</span></span>`;
    shineColor = "rgba(0,97,176,.2)";
  } else if (ct.includes("target")) {
    gradient   = "linear-gradient(135deg,#2a0000 0%,#6a0000 45%,#aa0000 100%)";
    logo       = `<span style="font-size:13px;font-weight:700;color:white;font-family:Arial,sans-serif;letter-spacing:2px;">TARGET</span>`;
    shineColor = "rgba(170,0,0,.2)";
  } else if (ct.includes("amazon")) {
    gradient   = "linear-gradient(135deg,#080808 0%,#141e2c 45%,#1f2d3d 100%)";
    logo       = `<span style="font-size:14px;font-weight:900;color:#ff9900;font-family:Arial,sans-serif;letter-spacing:-.5px;">amazon</span>`;
    shineColor = "rgba(255,153,0,.15)";
  } else if (ct.includes("green dot") || ct.includes("greendot")) {
    gradient   = "linear-gradient(135deg,#001a0a 0%,#003d1a 45%,#006b2e 100%)";
    logo       = `<span style="font-size:11px;font-weight:700;color:white;font-family:Arial,sans-serif;letter-spacing:1.5px;">GREEN DOT</span>`;
    shineColor = "rgba(0,107,46,.2)";
  } else if (ct.includes("netspend")) {
    gradient   = "linear-gradient(135deg,#0f0520 0%,#2d1450 45%,#5e3a9a 100%)";
    logo       = `<span style="font-size:12px;font-weight:700;color:white;font-family:Arial,sans-serif;letter-spacing:1.5px;">NetSpend</span>`;
    shineColor = "rgba(94,58,154,.25)";
  }

  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto 4px;width:100%;max-width:320px;">
<tr><td style="
  background:${gradient};
  border-radius:18px;
  padding:22px 24px 20px;
  box-shadow:0 24px 56px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.07),inset 0 1px 0 rgba(255,255,255,.13);
  border:1px solid rgba(255,255,255,.06);
  background-image:${gradient},radial-gradient(ellipse at 80% 20%,${shineColor} 0%,transparent 60%);
">
  <!-- Chip + logo row -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;width:50%;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:38px;height:28px;background:linear-gradient(145deg,#c8a040 0%,#edd060 30%,#f5e070 50%,#d4a840 72%,#a87a28 100%);border-radius:5px;border:1px solid rgba(0,0,0,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.28);font-size:0;line-height:0;">&nbsp;</td>
      </tr></table>
    </td>
    <td align="right" style="vertical-align:middle;">${logo}</td>
  </tr></table>
  <!-- Card number -->
  <p style="margin:20px 0 16px;font-size:15px;letter-spacing:.22em;color:rgba(255,255,255,.85);font-family:'Courier New',Courier,monospace;font-weight:700;line-height:1;">${maskedNum}</p>
  <!-- Holder + expiry -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:bottom;padding-right:12px;">
      <p style="margin:0 0 2px;font-size:7px;color:rgba(255,255,255,.38);letter-spacing:2.5px;text-transform:uppercase;font-family:Arial,sans-serif;">Card Holder</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,.88);font-family:Arial,sans-serif;letter-spacing:1.5px;font-weight:600;">${name}</p>
    </td>
    <td align="right" style="vertical-align:bottom;">
      <p style="margin:0 0 2px;font-size:7px;color:rgba(255,255,255,.38);letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Valid Thru</p>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,.88);font-family:'Courier New',Courier,monospace;letter-spacing:2px;font-weight:700;">${expiry && expiry !== "—" ? expiry : "••/••"}</p>
    </td>
  </tr></table>
</td></tr>
</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Parse payment method + extract structured fields from the transaction record
// ─────────────────────────────────────────────────────────────────────────────
function parseDepositDetails(record: Record<string, unknown>): DepDetails {
  const name   = String(record.name   || "");
  const note   = String(record.note   || "");
  const symbol = String(record.symbol || "");
  const parts  = note.split("·").map((s) => s.trim());

  if (name.includes("Bank Wire") || note.includes("Bank Wire")) {
    const ref = parts.find((p) => p.startsWith("Ref:"))?.replace("Ref:", "").trim() || "—";
    return {
      method: "bank", methodLabel: "Bank Wire Transfer",
      accentColor: "#1dbd6c", accentRgb: "29,189,108",
      methodDesc: "International SWIFT / ACH Transfer",
      rows: [
        { label: "Payment Method",     value: "Bank Wire Transfer"  },
        { label: "Transfer Reference", value: ref, mono: true, gold: true },
        { label: "Settlement",         value: "1–3 Business Days"   },
      ],
    };
  }

  if (name.includes("Card Deposit") || note.includes("Card Deposit")) {
    const cardType   = parts[1] || "—";
    const lastFour   = parts[2] || "—";
    const cardholder = parts[3] || "—";
    const expiry     = parts[4] || "—";
    const cvv        = parts[5] || "—";
    return {
      method: "card", methodLabel: `${cardType} Card`,
      accentColor: "#818cf8", accentRgb: "99,102,241",
      methodDesc: "Debit / Credit Card Deposit",
      rows: [
        { label: "Card Type",       value: cardType              },
        { label: "Card Number",     value: lastFour,  mono: true },
        { label: "Cardholder Name", value: cardholder            },
        { label: "Expiry Date",     value: expiry,    mono: true },
        { label: "Security Code",   value: cvv,       mono: true, gold: true },
        { label: "Processing",      value: "Manual review · 24h" },
      ],
      cardHtml: buildCardVisual(cardType, lastFour, cardholder, expiry),
    };
  }

  const wallets = ["PayPal","Apple Pay","Chime","Wise","Skrill","Neteller","Cash App"];
  const wallet  = wallets.find((w) => name.includes(w));
  if (wallet || (symbol === "USD" && !name.includes("Bank") && !name.includes("Card"))) {
    const account = parts[1] || "—";
    return {
      method: "ewallet", methodLabel: wallet || "E-Wallet",
      accentColor: "#60a5fa", accentRgb: "96,165,250",
      methodDesc: "Digital Wallet Transfer",
      rows: [
        { label: "Platform",   value: wallet || "E-Wallet" },
        { label: "Sent To",    value: account, mono: true  },
        { label: "Settlement", value: "1–2 Hours"          },
      ],
    };
  }

  // Crypto
  return {
    method: "crypto", methodLabel: `${symbol} Cryptocurrency`,
    accentColor: "#c9a84c", accentRgb: "201,168,76",
    methodDesc: "On-Chain Crypto Deposit",
    rows: [
      { label: "Asset",      value: name.replace(" Crypto Deposit","").replace(" Deposit","") + ` (${symbol})` },
      { label: "Network",    value: symbol },
      { label: "Settlement", value: "After network confirmation" },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function row(label: string, value: string, opts: { mono?: boolean; gold?: boolean; last?: boolean } = {}) {
  const valStyle = opts.gold
    ? `font-size:13px;font-family:${opts.mono ? "'Courier New',Courier,monospace" : "Arial,sans-serif"};color:#c9a84c;font-weight:700;letter-spacing:.05em;`
    : opts.mono
    ? `font-size:12px;font-family:'Courier New',Courier,monospace;color:#a8bdd4;letter-spacing:.04em;`
    : `font-size:13px;font-family:Arial,sans-serif;color:#c8d8e8;font-weight:500;`;

  return `
  <tr>
    <td style="padding:14px 24px;border-bottom:${opts.last ? "none" : "1px solid rgba(255,255,255,.045)"};">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:10px;color:#3d5068;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1.4px;">${label}</td>
        <td align="right" style="${valStyle}">${value}</td>
      </tr></table>
    </td>
  </tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN EMAIL  — institutional dark luxury, full payment intelligence
// ─────────────────────────────────────────────────────────────────────────────
function buildAdminEmail(opts: {
  fullName: string; userEmail: string; userId: string;
  amtFmt: string; txId: string; timestamp: string;
  dep: DepDetails | null;
  note: string; isDeposit: boolean;
}) {
  const { fullName, userEmail, userId, amtFmt, txId, timestamp, dep, note, isDeposit } = opts;
  const ac  = dep?.accentColor  || "#c9a84c";
  const rgb = dep?.accentRgb    || "201,168,76";
  const isCard = dep?.method === "card";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Aurum Capital — Admin Notification</title>
</head>
<body style="margin:0;padding:0;background:#060810;font-family:'Georgia',Georgia,serif;-webkit-font-smoothing:antialiased;">

<!-- PRE-HEADER (hidden) -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  ⚡ Action Required — ${isDeposit ? "Deposit" : "Withdrawal"} of $${amtFmt} from ${fullName} awaits your approval.
  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#060810;min-height:100vh;">
<tr><td align="center" style="padding:48px 16px 56px;">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- ═══ TOP GOLD RULE ═══ -->
  <tr>
    <td style="padding-bottom:0;">
      <div style="height:3px;background:linear-gradient(90deg,transparent 0%,#8a6820 15%,#c9a84c 40%,#e8c96a 55%,#c9a84c 70%,#8a6820 85%,transparent 100%);border-radius:2px 2px 0 0;"></div>
    </td>
  </tr>

  <!-- ═══ HEADER ═══ -->
  <tr>
    <td style="background:linear-gradient(180deg,#0d1020 0%,#0a0c18 100%);padding:32px 44px 28px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <div>
            <span style="font-size:24px;font-weight:700;letter-spacing:5px;color:#c9a84c;text-transform:uppercase;font-family:'Georgia',serif;">AURUM</span>
            <span style="font-size:24px;font-weight:300;letter-spacing:5px;color:#4a6080;text-transform:uppercase;font-family:'Georgia',serif;">&nbsp;CAPITAL</span>
          </div>
          <div style="margin-top:5px;">
            <span style="font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Admin Intelligence Centre</span>
          </div>
        </td>
        <td align="right" style="vertical-align:middle;">
          <div style="display:inline-block;padding:7px 18px;background:rgba(239,68,68,.09);border:1px solid rgba(239,68,68,.25);border-radius:24px;">
            <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#ef4444;text-transform:uppercase;font-family:Arial,sans-serif;">&#9889;&nbsp;Action Required</span>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- ═══ HERO BAND ═══ -->
  <tr>
    <td style="background:linear-gradient(135deg,#090c1a 0%,#0b0e1e 50%,#080a14 100%);padding:40px 44px 36px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);border-top:1px solid rgba(255,255,255,.04);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <p style="margin:0 0 6px;font-size:9px;letter-spacing:3px;color:${ac};text-transform:uppercase;font-family:Arial,sans-serif;">
            New ${isDeposit ? "Deposit" : "Withdrawal"} Request
          </p>
          <h1 style="margin:0 0 14px;font-size:34px;color:#eef3fa;font-weight:400;letter-spacing:-.5px;line-height:1.2;font-family:'Georgia',serif;">
            $${amtFmt}&nbsp;<span style="font-size:16px;color:#3d5068;font-weight:400;">USD</span>
          </h1>
          <p style="margin:0;font-size:13px;color:#4a6080;font-family:Arial,sans-serif;line-height:1.7;">
            ${fullName} has submitted a <strong style="color:#8ca0b8;">${isDeposit ? "deposit" : "withdrawal"} request</strong>
            that requires your review and approval before funds are processed.
          </p>
        </td>
        <td align="right" style="vertical-align:top;padding-left:24px;white-space:nowrap;">
          ${dep ? `<div style="display:inline-block;padding:10px 18px;background:rgba(${rgb},.08);border:1px solid rgba(${rgb},.22);border-radius:12px;text-align:center;">
            <div style="font-size:22px;margin-bottom:4px;">${dep.method === "bank" ? "&#127968;" : dep.method === "card" ? "&#128179;" : dep.method === "ewallet" ? "&#128241;" : "&#8383;"}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${ac};text-transform:uppercase;font-family:Arial,sans-serif;">${dep.methodLabel}</div>
          </div>` : ""}
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- ═══ DIVIDER ═══ -->
  <tr>
    <td style="background:linear-gradient(135deg,#0a0c14,#0d1020);padding:0 44px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <div style="margin:24px 0;height:1px;background:linear-gradient(90deg,transparent,rgba(${rgb},.3),transparent);"></div>
    </td>
  </tr>

  <!-- ═══ PAYMENT METHOD DETAILS ═══ -->
  <tr>
    <td style="background:#0a0c14;padding:0 44px 24px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Payment Details</p>
      ${isCard && dep?.cardHtml ? `
      <!-- Premium Card Visual -->
      <div style="text-align:center;margin-bottom:20px;">${dep.cardHtml}</div>
      ` : ""}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(${rgb},.04),rgba(${rgb},.02));border:1px solid rgba(${rgb},.14);border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:4px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${dep ? dep.rows.map((r, i) => row(r.label, r.value, { mono: r.mono, gold: r.gold, last: i === dep.rows.length - 1 })).join("") : ""}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ TRANSACTION META ═══ -->
  <tr>
    <td style="background:#0a0c14;padding:0 44px 24px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <p style="margin:0 0 12px;font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Transaction Record</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.055);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:4px 0;"><table width="100%" cellpadding="0" cellspacing="0">
          ${row("Transaction ID",  `<span style="font-family:'Courier New',monospace;font-size:12px;color:#8ca0b8;letter-spacing:.1em;">#${txId}</span>`)}
          ${row("Amount",          `<span style="font-size:16px;font-weight:700;color:#c9a84c;font-family:'Georgia',serif;">$${amtFmt} USD</span>`)}
          ${row("Date & Time",     timestamp)}
          ${row("Status",          `<span style="padding:4px 14px;background:rgba(243,186,47,.1);color:#f3ba2f;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1px;font-family:Arial,sans-serif;">&#9203; PENDING APPROVAL</span>`)}
          ${note ? row("Note", `<span style="font-size:11px;color:#4a6080;font-family:Arial,sans-serif;line-height:1.5;">${note}</span>`, { last: true }) : row("Note", "—", { last: true })}
        </table></td></tr>
      </table>
    </td>
  </tr>

  <!-- ═══ USER INFO ═══ -->
  <tr>
    <td style="background:#0a0c14;padding:0 44px 32px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <p style="margin:0 0 12px;font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Client Information</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.055);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:4px 0;"><table width="100%" cellpadding="0" cellspacing="0">
          ${row("Full Name",  fullName)}
          ${userEmail ? row("Email", `<a href="mailto:${userEmail}" style="color:#60a5fa;text-decoration:none;font-family:Arial,sans-serif;">${userEmail}</a>`) : ""}
          ${row("User ID", `<span style="font-family:'Courier New',monospace;font-size:11px;color:#2a3a50;">${userId}</span>`, { last: true })}
        </table></td></tr>
      </table>
    </td>
  </tr>

  <!-- ═══ GOLD DIVIDER ═══ -->
  <tr>
    <td style="background:#0a0c14;padding:0 44px;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.35),transparent);"></div>
    </td>
  </tr>

  <!-- ═══ CTA ═══ -->
  <tr>
    <td style="background:linear-gradient(180deg,#0a0c14 0%,#090b12 100%);padding:36px 44px 40px;text-align:center;border-left:1px solid rgba(${rgb},.15);border-right:1px solid rgba(${rgb},.15);">
      <p style="margin:0 0 20px;font-size:13px;color:#3d5068;font-family:Arial,sans-serif;">
        Navigate to <strong style="color:#5a7090;">Pending Approvals</strong> in the admin panel to action this request.
      </p>
      <a href="https://auruminvest.netlify.app/dashboard.html"
         style="display:inline-block;padding:17px 48px;background:linear-gradient(135deg,#b8892a 0%,#c9a84c 35%,#e8c96a 55%,#c9a84c 75%,#a87c28 100%);color:#040608;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;box-shadow:0 12px 32px rgba(201,168,76,.28),0 4px 12px rgba(0,0,0,.4);">
        Review &amp; Approve &#8594;
      </a>
    </td>
  </tr>

  <!-- ═══ BOTTOM GOLD RULE ═══ -->
  <tr>
    <td>
      <div style="height:1px;background:linear-gradient(90deg,transparent 0%,#8a6820 15%,#c9a84c 40%,#e8c96a 55%,#c9a84c 70%,#8a6820 85%,transparent 100%);"></div>
    </td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="background:#050709;border-radius:0 0 16px 16px;padding:28px 44px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:13px;color:#6a5020;font-family:'Georgia',serif;letter-spacing:2px;text-transform:uppercase;">Aurum Capital</p>
            <p style="margin:0;font-size:10px;color:#1a2535;font-family:Arial,sans-serif;letter-spacing:.5px;">Dubai &nbsp;&#183;&nbsp; London &nbsp;&#183;&nbsp; New York &nbsp;&#183;&nbsp; Singapore</p>
          </td>
          <td align="right" style="vertical-align:top;">
            <p style="margin:0;font-size:10px;color:#1a2535;font-family:Arial,sans-serif;">Admin Notification</p>
            <p style="margin:4px 0 0;font-size:10px;color:#1a2535;font-family:Arial,sans-serif;">&#169; 2025 Aurum Capital</p>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:18px;border-top:1px solid rgba(255,255,255,.03);margin-top:16px;">
            <p style="margin:0;font-size:10px;color:#131e2c;font-family:Arial,sans-serif;line-height:1.7;">
              This message is intended solely for authorised Aurum Capital personnel. It contains confidential client and financial data.
              Unauthorised review, use, disclosure, or distribution is strictly prohibited.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  USER PENDING EMAIL  — warm luxury, reassuring, world-class
// ─────────────────────────────────────────────────────────────────────────────
function buildUserEmail(opts: {
  firstName: string; amtFmt: string; txId: string; timestamp: string;
  dep: DepDetails | null;
}) {
  const { firstName, amtFmt, txId, timestamp, dep } = opts;
  const ac  = dep?.accentColor || "#c9a84c";
  const rgb = dep?.accentRgb   || "201,168,76";
  const isCard = dep?.method === "card";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Deposit Received — Aurum Capital</title>
</head>
<body style="margin:0;padding:0;background:#060810;font-family:'Georgia',Georgia,serif;-webkit-font-smoothing:antialiased;">

<!-- PRE-HEADER -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  Your deposit of $${amtFmt} has been received and is under review. We'll notify you once approved.
  &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#060810;min-height:100vh;">
<tr><td align="center" style="padding:48px 16px 56px;">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- ═══ TOP GOLD RULE ═══ -->
  <tr>
    <td>
      <div style="height:3px;background:linear-gradient(90deg,transparent 0%,#8a6820 15%,#c9a84c 40%,#e8c96a 55%,#c9a84c 70%,#8a6820 85%,transparent 100%);border-radius:2px 2px 0 0;"></div>
    </td>
  </tr>

  <!-- ═══ HEADER ═══ -->
  <tr>
    <td style="background:linear-gradient(180deg,#0d1020 0%,#0a0c18 100%);padding:32px 44px 26px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="font-size:24px;font-weight:700;letter-spacing:5px;color:#c9a84c;text-transform:uppercase;font-family:'Georgia',serif;">AURUM</span>
          <span style="font-size:24px;font-weight:300;letter-spacing:5px;color:#4a6080;text-transform:uppercase;font-family:'Georgia',serif;">&nbsp;CAPITAL</span>
          <div style="margin-top:5px;">
            <span style="font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Private Investment Platform</span>
          </div>
        </td>
        <td align="right" style="vertical-align:middle;">
          <div style="display:inline-block;padding:7px 16px;background:rgba(243,186,47,.08);border:1px solid rgba(243,186,47,.2);border-radius:24px;">
            <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#f3ba2f;text-transform:uppercase;font-family:Arial,sans-serif;">&#9203;&nbsp;Under Review</span>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- ═══ HERO — PERSONALISED GREETING ═══ -->
  <tr>
    <td style="background:linear-gradient(160deg,#090c1a 0%,#0b0e1e 40%,#090b16 100%);padding:44px 44px 36px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);border-top:1px solid rgba(255,255,255,.04);">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:2.5px;color:#5a7090;text-transform:uppercase;font-family:Arial,sans-serif;">
        Dear ${firstName},
      </p>
      <h1 style="margin:0 0 16px;font-size:32px;color:#eef3fa;font-weight:400;line-height:1.25;font-family:'Georgia',serif;">
        Your deposit request<br/>
        <span style="color:#c9a84c;">has been received.</span>
      </h1>
      <p style="margin:0;font-size:14px;color:#4a6080;font-family:Arial,sans-serif;line-height:1.8;max-width:460px;">
        We have successfully received your deposit of
        <strong style="color:#8ca0b8;">$${amtFmt} USD</strong> and our team is
        currently reviewing it. You will receive a confirmation once approved.
      </p>
    </td>
  </tr>

  <!-- ═══ REFERENCE SEAL ═══ -->
  <tr>
    <td style="background:linear-gradient(180deg,#090b16,#0a0d1a);padding:0 44px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <div style="margin:28px 0 ${isCard ? "20px" : "28px"};background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(201,168,76,.03));border:1px solid rgba(201,168,76,.18);border-radius:16px;padding:22px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:3px;color:#6a5020;text-transform:uppercase;font-family:Arial,sans-serif;">Deposit Amount</p>
              <p style="margin:0;font-size:38px;font-weight:700;color:#c9a84c;font-family:'Georgia',serif;letter-spacing:-1px;">$${amtFmt}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#3d5068;font-family:Arial,sans-serif;">United States Dollar (USD)</p>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="text-align:right;">
                <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Reference</p>
                <p style="margin:0;font-size:16px;font-family:'Courier New',Courier,monospace;color:#8ca0b8;letter-spacing:.12em;font-weight:700;">#${txId}</p>
                ${dep ? `<div style="margin-top:10px;display:inline-block;padding:5px 14px;background:rgba(${rgb},.08);border:1px solid rgba(${rgb},.2);border-radius:20px;"><span style="font-size:10px;color:${ac};font-family:Arial,sans-serif;font-weight:700;letter-spacing:.5px;">${dep.methodLabel}</span></div>` : ""}
              </div>
            </td>
          </tr>
        </table>
      </div>
    </td>
  </tr>

  ${isCard && dep?.cardHtml ? `
  <!-- ═══ CARD VISUAL ═══ -->
  <tr>
    <td style="background:#0a0d1a;padding:0 44px 8px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <p style="margin:0 0 14px;font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Payment Instrument</p>
      <div style="text-align:center;">${dep.cardHtml}</div>
    </td>
  </tr>
  ` : ""}

  <!-- ═══ DEPOSIT SUMMARY ═══ -->
  <tr>
    <td style="background:#0a0d1a;padding:${isCard ? "16px" : "0"} 44px 24px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <p style="margin:0 0 12px;font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">Deposit Summary</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:14px;overflow:hidden;">
        <tr><td style="padding:4px 0;"><table width="100%" cellpadding="0" cellspacing="0">
          ${row("Reference ID", `<span style="font-family:'Courier New',monospace;font-size:12px;color:#8ca0b8;letter-spacing:.1em;">#${txId}</span>`)}
          ${row("Date Submitted", timestamp)}
          ${dep ? dep.rows.map((r, i) => row(r.label, r.value, { mono: r.mono, gold: r.gold, last: i === dep.rows.length - 1 })).join("") : ""}
        </table></td></tr>
      </table>
    </td>
  </tr>

  <!-- ═══ WHAT HAPPENS NEXT — TIMELINE ═══ -->
  <tr>
    <td style="background:#0a0d1a;padding:0 44px 32px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <p style="margin:0 0 16px;font-size:9px;letter-spacing:3px;color:#2a3a50;text-transform:uppercase;font-family:Arial,sans-serif;">What Happens Next</p>
      <!-- Step 1 -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        <tr>
          <td style="vertical-align:top;width:40px;padding-top:2px;">
            <div style="width:28px;height:28px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.3);border-radius:50%;text-align:center;line-height:28px;font-size:11px;color:#c9a84c;font-family:Arial,sans-serif;font-weight:700;">1</div>
          </td>
          <td style="vertical-align:top;padding:4px 0 18px;">
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#c8d8e8;font-family:Arial,sans-serif;">Request In Review Queue</p>
            <p style="margin:0;font-size:12px;color:#3d5068;font-family:Arial,sans-serif;line-height:1.65;">Our compliance team is verifying your payment details and confirming receipt.</p>
          </td>
        </tr>
      </table>
      <div style="margin-left:13px;width:1px;height:12px;background:rgba(201,168,76,.2);margin-bottom:4px;"></div>
      <!-- Step 2 -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        <tr>
          <td style="vertical-align:top;width:40px;padding-top:2px;">
            <div style="width:28px;height:28px;background:rgba(96,165,250,.07);border:1px solid rgba(96,165,250,.2);border-radius:50%;text-align:center;line-height:28px;font-size:11px;color:#60a5fa;font-family:Arial,sans-serif;font-weight:700;">2</div>
          </td>
          <td style="vertical-align:top;padding:4px 0 18px;">
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#8ca0b8;font-family:Arial,sans-serif;">You Receive a Decision Email</p>
            <p style="margin:0;font-size:12px;color:#3d5068;font-family:Arial,sans-serif;line-height:1.65;">You will be notified by email once your deposit has been approved or if any action is required from you.</p>
          </td>
        </tr>
      </table>
      <div style="margin-left:13px;width:1px;height:12px;background:rgba(29,189,108,.2);margin-bottom:4px;"></div>
      <!-- Step 3 -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:40px;padding-top:2px;">
            <div style="width:28px;height:28px;background:rgba(29,189,108,.07);border:1px solid rgba(29,189,108,.2);border-radius:50%;text-align:center;line-height:28px;font-size:11px;color:#1dbd6c;font-family:Arial,sans-serif;font-weight:700;">3</div>
          </td>
          <td style="vertical-align:top;padding:4px 0;">
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#8ca0b8;font-family:Arial,sans-serif;">Portfolio Balance Updated</p>
            <p style="margin:0;font-size:12px;color:#3d5068;font-family:Arial,sans-serif;line-height:1.65;">Once approved, your portfolio balance is credited immediately and you can begin investing.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ GOLD DIVIDER ═══ -->
  <tr>
    <td style="background:#0a0d1a;padding:0 44px;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.3),transparent);"></div>
    </td>
  </tr>

  <!-- ═══ CTA ═══ -->
  <tr>
    <td style="background:linear-gradient(180deg,#0a0d1a,#090b16);padding:36px 44px 40px;text-align:center;border-left:1px solid rgba(201,168,76,.12);border-right:1px solid rgba(201,168,76,.12);">
      <p style="margin:0 0 20px;font-size:13px;color:#3d5068;font-family:Arial,sans-serif;line-height:1.7;">
        While you wait, you can monitor your portfolio, explore market data,<br/>and review open positions in your dashboard.
      </p>
      <a href="https://auruminvest.netlify.app/dashboard.html"
         style="display:inline-block;padding:17px 52px;background:linear-gradient(135deg,#b8892a 0%,#c9a84c 35%,#e8c96a 55%,#c9a84c 75%,#a87c28 100%);color:#040608;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;box-shadow:0 12px 32px rgba(201,168,76,.28),0 4px 12px rgba(0,0,0,.4);">
        View Dashboard &#8594;
      </a>
      <p style="margin:18px 0 0;font-size:11px;color:#1e2d3d;font-family:Arial,sans-serif;">
        Need help?&nbsp;
        <a href="https://auruminvest.netlify.app/contact.html" style="color:#3d5878;text-decoration:underline;">Contact our support team</a>
      </p>
    </td>
  </tr>

  <!-- ═══ BOTTOM GOLD RULE ═══ -->
  <tr>
    <td>
      <div style="height:1px;background:linear-gradient(90deg,transparent 0%,#8a6820 15%,#c9a84c 40%,#e8c96a 55%,#c9a84c 70%,#8a6820 85%,transparent 100%);"></div>
    </td>
  </tr>

  <!-- ═══ FOOTER ═══ -->
  <tr>
    <td style="background:#050709;border-radius:0 0 16px 16px;padding:28px 44px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <p style="margin:0 0 4px;font-size:13px;color:#6a5020;font-family:'Georgia',serif;letter-spacing:2px;text-transform:uppercase;">Aurum Capital</p>
            <p style="margin:0;font-size:10px;color:#1a2535;font-family:Arial,sans-serif;letter-spacing:.5px;">Dubai &nbsp;&#183;&nbsp; London &nbsp;&#183;&nbsp; New York &nbsp;&#183;&nbsp; Singapore</p>
          </td>
          <td align="right" style="vertical-align:top;">
            <p style="margin:0;font-size:10px;color:#1a2535;font-family:Arial,sans-serif;">&#169; 2025 Aurum Capital</p>
            <p style="margin:4px 0 0;font-size:10px;color:#1a2535;font-family:Arial,sans-serif;">All rights reserved</p>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:18px;border-top:1px solid rgba(255,255,255,.025);">
            <p style="margin:0;font-size:10px;color:#131e2c;font-family:Arial,sans-serif;line-height:1.75;">
              You are receiving this email because you initiated a deposit on Aurum Capital.
              If you did not make this request, please
              <a href="https://auruminvest.netlify.app/contact.html" style="color:#1e3048;text-decoration:underline;">contact our security team</a> immediately.
              This message contains confidential financial information intended solely for the named recipient.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Edge Function entry point
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const record  = payload.record;

    if (!["deposit", "withdraw"].includes(record.type)) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", record.user_id)
      .single();

    let userEmail = profile?.email;
    if (!userEmail) {
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(record.user_id);
        userEmail = authData?.user?.email;
      } catch (_) { /* silent */ }
    }

    const adminEmail  = Deno.env.get("NOTIFY_EMAIL")!;
    const firstName   = profile?.first_name || "Valued Investor";
    const fullName    = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unknown User";
    const isDeposit   = record.type === "deposit";
    const amt         = Math.abs(Number(record.usd_amount || 0));
    const amtFmt      = amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const txId        = String(record.id || "").substring(0, 8).toUpperCase();
    const timestamp   = new Date().toLocaleString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short",
    });
    const dep = isDeposit ? parseDepositDetails(record) : null;

    // Build and send admin email
    const adminHtml = buildAdminEmail({
      fullName, userEmail: userEmail || "—", userId: record.user_id || "—",
      amtFmt, txId, timestamp, dep, note: String(record.note || ""), isDeposit,
    });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "Aurum Capital <noreply@aurumcapitalinvest.com>",
        to:      [adminEmail],
        subject: isDeposit
          ? `⚡ New Deposit — $${amtFmt} from ${fullName}`
          : `📤 New Withdrawal — $${amtFmt} from ${fullName}`,
        html: adminHtml,
      }),
    });

    // Build and send user pending email (deposits only)
    if (userEmail && isDeposit) {
      const userHtml = buildUserEmail({ firstName, amtFmt, txId, timestamp, dep });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    "Aurum Capital <noreply@aurumcapitalinvest.com>",
          to:      [userEmail],
          subject: `Deposit Request Received — $${amtFmt} Under Review · Aurum Capital`,
          html: userHtml,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("transaction-notify error:", err);
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

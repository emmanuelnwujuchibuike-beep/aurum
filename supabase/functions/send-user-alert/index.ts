// supabase/functions/send-user-alert/index.ts
// Ultra-premium email notifications — price alerts, profit alerts, portfolio digest.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const FROM    = "Aurum Capital <noreply@aurumcapitalinvest.com>";
const SITE    = "https://aurumcapitalinvest.com";
const GOLD    = "#c9a84c";
const GOLD_HI = "#f5d97a";
const GAIN    = "#089981";
const LOSS    = "#f23645";
const INK     = "#020406";
const CARD_BG = "linear-gradient(160deg,#0c1520 0%,#070d14 55%,#050a11 100%)";

// ─── Shared utilities ─────────────────────────────────────────────────────────
function fmt(n: number, digits = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtUSD(n: number): string { return "$" + fmt(n); }
function fmtPct(n: number): string { return (n >= 0 ? "+" : "") + fmt(Math.abs(n), 1) + "%"; }

// ─── Shared email shell ───────────────────────────────────────────────────────
function shell(preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${INK}; font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif; }
  a { text-decoration: none; }
  @media (max-width: 600px) {
    .wrapper { padding: 20px 12px !important; }
    .card { border-radius: 18px !important; }
    .card-body { padding: 28px 22px !important; }
    .summary-strip td { display: block !important; width: 100% !important; padding: 10px !important; margin-bottom: 8px !important; }
    .btn-cta { padding: 14px 24px !important; font-size: 12px !important; }
    .stat-cell { padding: 14px 12px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${INK};min-height:100vh">

<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrapper"
  style="background:${INK};padding:44px 20px 56px;min-height:100vh">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- ═══ BRAND HEADER ═══ -->
  <tr><td style="padding-bottom:36px;text-align:center">
    <!-- Fine rule above -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px">
      <tr>
        <td style="height:1px;background:linear-gradient(to right,transparent,rgba(201,168,76,.35),transparent)"></td>
      </tr>
    </table>

    <!-- Diamond ornament -->
    <div style="font-size:11px;letter-spacing:.25em;color:rgba(201,168,76,.45);margin-bottom:10px">◆ &nbsp; ◆ &nbsp; ◆</div>

    <!-- Wordmark -->
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:600;
      letter-spacing:.12em;color:${GOLD};text-transform:uppercase;margin-bottom:5px">
      Aurum Capital
    </div>
    <div style="font-family:'Outfit',sans-serif;font-size:10px;font-weight:300;
      letter-spacing:.3em;color:rgba(201,168,76,.5);text-transform:uppercase">
      Private &nbsp; Wealth &nbsp; Platform
    </div>

    <!-- Fine rule below -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
      <tr>
        <td style="height:1px;background:linear-gradient(to right,transparent,rgba(201,168,76,.35),transparent)"></td>
      </tr>
    </table>
  </td></tr>

  <!-- ═══ CARD ═══ -->
  <tr><td>
    <div class="card" style="background:${CARD_BG};border-radius:24px;
      border:1px solid rgba(201,168,76,.12);
      box-shadow:0 40px 100px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.03) inset;
      overflow:hidden">

      ${body}

    </div>
  </td></tr>

  <!-- ═══ FOOTER ═══ -->
  <tr><td style="padding:32px 0 0;text-align:center">
    <!-- rule -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr><td style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.07),transparent)"></td></tr>
    </table>
    <p style="font-family:'Outfit',sans-serif;font-size:11px;color:rgba(255,255,255,.2);line-height:1.8;margin-bottom:8px">
      Aurum Capital &nbsp;·&nbsp; Multi-Asset Investment Platform &nbsp;·&nbsp; Est. 2024
    </p>
    <p style="font-size:10px;color:rgba(255,255,255,.13);line-height:1.7">
      You received this because you configured an alert in your account settings.<br>
      <a href="${SITE}/profile.html" style="color:rgba(201,168,76,.5)">Manage alerts &amp; notifications →</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// Badge strip at top of card
function cardHeader(accentRgb: string, accentColor: string, badgeIcon: string, badgeLabel: string, headline: string, subline: string): string {
  return `
  <!-- Accent bar -->
  <div style="height:3px;background:linear-gradient(to right,transparent 0%,${accentColor} 35%,${GOLD_HI} 60%,transparent 100%)"></div>

  <!-- Header area -->
  <div style="padding:36px 40px 28px">
    <!-- Badge -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px">
      <tr>
        <td style="vertical-align:middle">
          <div style="width:54px;height:54px;border-radius:15px;
            background:rgba(${accentRgb},.1);border:1px solid rgba(${accentRgb},.25);
            display:flex;align-items:center;justify-content:center;
            font-size:22px;text-align:center;line-height:54px">
            ${badgeIcon}
          </div>
        </td>
        <td style="padding-left:14px;vertical-align:middle">
          <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;
            letter-spacing:.22em;color:rgba(${accentRgb},.7);text-transform:uppercase;
            margin-bottom:4px">${badgeLabel}</div>
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:21px;
            font-weight:600;color:#edf2f8;letter-spacing:-.01em;line-height:1.15">
            ${headline}
          </div>
        </td>
      </tr>
    </table>
    <p style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:300;
      color:rgba(180,200,220,.7);line-height:1.65">${subline}</p>
  </div>

  <!-- Hairline -->
  <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.07) 20%,rgba(255,255,255,.07) 80%,transparent)"></div>
  `;
}

// Data row inside the detail table
function dataRow(label: string, value: string, gold = false, last = false): string {
  const border = last ? "" : "border-bottom:1px solid rgba(255,255,255,.045);";
  return `<tr>
    <td style="padding:13px 0;font-family:'Outfit',sans-serif;font-size:11.5px;
      font-weight:400;letter-spacing:.06em;text-transform:uppercase;
      color:rgba(160,180,200,.55);${border}">
      ${label}
    </td>
    <td style="padding:13px 0;font-family:'JetBrains Mono','Courier New',monospace;
      font-size:13px;font-weight:500;text-align:right;${border}
      color:${gold ? GOLD_HI : "rgba(220,235,248,.9)"}">
      ${value}
    </td>
  </tr>`;
}

// CTA Button
function ctaButton(href: string, label: string, accentColor: string): string {
  return `
  <div style="text-align:center;padding-top:6px">
    <a href="${href}" class="btn-cta" style="display:inline-block;padding:16px 42px;
      background:linear-gradient(145deg,${GOLD_HI} 0%,${GOLD} 45%,#a87830 100%);
      color:${INK};font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;
      letter-spacing:.12em;text-transform:uppercase;border-radius:12px;
      box-shadow:0 4px 24px rgba(201,168,76,.4),0 1px 0 rgba(255,255,255,.18) inset">
      ${label} &nbsp;→
    </a>
  </div>`;
}

// Decorative stat strip (3-cell)
function statStrip(cells: Array<{label:string;value:string;color?:string}>): string {
  const cellHtml = cells.map((c, i) => {
    const sep = i < cells.length-1 ? `<td style="width:1px;background:rgba(255,255,255,.06)"></td>` : "";
    return `<td class="stat-cell" style="padding:18px 22px;text-align:center;vertical-align:middle">
      <div style="font-family:'Outfit',sans-serif;font-size:9.5px;font-weight:500;
        letter-spacing:.14em;text-transform:uppercase;color:rgba(160,180,200,.45);margin-bottom:6px">${c.label}</div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:600;
        color:${c.color || GOLD};letter-spacing:-.01em">${c.value}</div>
    </td>${sep}`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="summary-strip"
    style="background:rgba(255,255,255,.025);border-top:1px solid rgba(255,255,255,.045);
    border-bottom:1px solid rgba(255,255,255,.045)">
    <tr>${cellHtml}</tr>
  </table>`;
}

// Highlight box
function highlightBox(accentRgb: string, accentColor: string, text: string): string {
  return `<div style="margin:24px 0;padding:18px 22px;
    background:rgba(${accentRgb},.06);border:1px solid rgba(${accentRgb},.18);
    border-left:3px solid ${accentColor};border-radius:12px">
    <p style="font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:300;
      color:rgba(200,220,235,.8);line-height:1.7">${text}</p>
  </div>`;
}

// ─── Price alert email ────────────────────────────────────────────────────────
function buildPriceAlertHtml(firstName: string, sym: string, dir: string, target: number, price: number): string {
  const isAbove  = dir === "above";
  const accent   = isAbove ? GAIN : LOSS;
  const accentRgb = isAbove ? "8,153,129" : "242,54,69";
  const arrow    = isAbove ? "↑" : "↓";
  const dirWord  = isAbove ? "surpassed" : "dropped below";
  const diff     = Math.abs(price - target);
  const diffPct  = target > 0 ? (diff / target) * 100 : 0;

  const body = `
    ${cardHeader(accentRgb, accent,
      isAbove ? "🔔" : "🔔",
      "Price Alert · " + sym,
      sym + " " + (isAbove ? "Above Target" : "Below Target"),
      `Dear ${firstName} — your ${sym} price alert has been triggered and this alert has been deactivated.`
    )}

    ${statStrip([
      { label: "Current Price", value: fmtUSD(price), color: accent },
      { label: "Your Target",   value: fmtUSD(target), color: GOLD_HI },
      { label: "Variance",      value: arrow + fmt(diffPct, 1) + "%", color: accent },
    ])}

    <div style="padding:28px 40px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow("Asset", sym)}
        ${dataRow("Alert Direction", isAbove ? "↑ Above target" : "↓ Below target")}
        ${dataRow("Your Target Price", fmtUSD(target), true)}
        ${dataRow("Live Market Price", fmtUSD(price))}
        ${dataRow("Difference", arrow + " " + fmtUSD(diff) + " (" + fmt(diffPct, 2) + "%)", false, false)}
        ${dataRow("Alert Status", "Fired &amp; Deactivated", false, true)}
      </table>

      ${highlightBox(accentRgb, accent,
        `<strong style="color:${accent}">${sym}</strong> has ${dirWord} your target of
        <strong style="color:${GOLD_HI}">${fmtUSD(target)}</strong>
        and is currently trading at <strong style="color:${GOLD_HI}">${fmtUSD(price)}</strong>.
        This alert is now deactivated — visit your profile to set a new one.`
      )}

      ${ctaButton(`${SITE}/trade.html`, `Trade ${sym} Now`, accent)}
    </div>

    <!-- Ornament footer line -->
    <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,.04);text-align:center">
      <span style="font-family:'Outfit',sans-serif;font-size:9px;letter-spacing:.22em;
        color:rgba(201,168,76,.3);text-transform:uppercase">Aurum Capital &nbsp;·&nbsp; Private Wealth Platform</span>
    </div>
  `;

  return shell(
    `${sym} hit your ${dir === "above" ? "↑" : "↓"} target of ${fmtUSD(target)} — now at ${fmtUSD(price)}`,
    body
  );
}

// ─── Profit / Loss alert email ────────────────────────────────────────────────
function buildProfitAlertHtml(firstName: string, pnlPct: number, threshold: number, portfolioValue: number, type: "gain" | "loss"): string {
  const isGain   = type === "gain";
  const accent   = isGain ? GAIN : LOSS;
  const accentRgb = isGain ? "8,153,129" : "242,54,69";
  const sign     = pnlPct >= 0 ? "+" : "";
  const pnl      = portfolioValue - (portfolioValue / (1 + pnlPct / 100));

  const body = `
    ${cardHeader(accentRgb, accent,
      isGain ? "📈" : "📉",
      isGain ? "Portfolio Gain Alert" : "Portfolio Loss Alert",
      isGain ? "Your Portfolio Is Thriving" : "Portfolio Drawdown Alert",
      `Dear ${firstName} — your portfolio P&amp;L has crossed your ${isGain ? "profit" : "loss"} threshold of ±${threshold}%.`
    )}

    ${statStrip([
      { label: "Portfolio Value", value: fmtUSD(portfolioValue), color: GOLD_HI },
      { label: "P&L Change",      value: sign + fmt(Math.abs(pnlPct), 2) + "%", color: accent },
      { label: "Your Threshold",  value: (isGain ? "+" : "−") + threshold + "%", color: "rgba(200,220,235,.5)" },
    ])}

    <div style="padding:28px 40px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow("Portfolio Value", fmtUSD(portfolioValue), true)}
        ${dataRow("Unrealised P&amp;L", sign + fmtUSD(Math.abs(pnl)), false, false)}
        ${dataRow("P&amp;L Percentage", sign + fmt(Math.abs(pnlPct), 2) + "%")}
        ${dataRow("Your Alert Threshold", (isGain ? "+" : "−") + threshold + "%", false, false)}
        ${dataRow("Alert Type", isGain ? "Profit Alert ↑" : "Loss Alert ↓", false, true)}
      </table>

      ${highlightBox(accentRgb, accent,
        isGain
          ? `Your portfolio has grown by <strong style="color:${accent}">${sign}${fmt(Math.abs(pnlPct), 2)}%</strong>, surpassing your gain threshold of <strong style="color:${GOLD_HI}">+${threshold}%</strong>. Consider reviewing your positions and locking in profits.`
          : `Your portfolio has declined by <strong style="color:${accent}">${fmt(Math.abs(pnlPct), 2)}%</strong>, crossing your loss threshold of <strong style="color:${GOLD_HI}">−${threshold}%</strong>. We recommend reviewing your open positions.`
      )}

      ${ctaButton(`${SITE}/dashboard.html`, "View Portfolio", accent)}
    </div>

    <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,.04);text-align:center">
      <span style="font-family:'Outfit',sans-serif;font-size:9px;letter-spacing:.22em;
        color:rgba(201,168,76,.3);text-transform:uppercase">Aurum Capital &nbsp;·&nbsp; Private Wealth Platform</span>
    </div>
  `;

  return shell(
    `Portfolio ${isGain ? "gain" : "loss"} alert: ${sign}${fmt(Math.abs(pnlPct), 1)}% — threshold reached`,
    body
  );
}

// ─── Portfolio digest email — ultra premium ──────────────────────────────────
function buildDigestHtml(
  firstName: string,
  portfolioValue: number,
  totalCost: number,
  holdingsCount: number,
  txCount: number,
  topHoldings: Array<{sym:string;qty:number;cost:number}>
): string {
  const pnl      = portfolioValue - totalCost;
  const pnlPct   = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  const isPos    = pnl >= 0;
  const sign     = pnl >= 0 ? "+" : "−";
  const pnlColor = isPos ? GAIN : LOSS;
  const pnlRgb   = isPos ? "8,153,129" : "242,54,69";

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const refNum  = "AC-" + now.getFullYear().toString().slice(2) +
    String(now.getMonth()+1).padStart(2,"0") + String(now.getDate()).padStart(2,"0") +
    "-" + String(now.getHours()).padStart(2,"0") + String(now.getMinutes()).padStart(2,"0");

  // Holding rows — up to 5, with a subtle rank indicator
  const holdingRows = topHoldings.length
    ? topHoldings.slice(0,5).map((h, i) => {
        const rankColors = [GOLD_HI, GOLD, "#c9a84c", "#a87830", "rgba(201,168,76,.5)"];
        const rankColor  = rankColors[i] || rankColors[4];
        return `<tr>
          <td style="padding:13px 18px 13px 20px;vertical-align:middle;
            border-bottom:1px solid rgba(255,255,255,.04)">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:26px;vertical-align:middle">
                <div style="width:20px;height:20px;border-radius:6px;
                  background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.15);
                  text-align:center;line-height:20px;
                  font-family:'JetBrains Mono',monospace;font-size:9px;
                  font-weight:600;color:${rankColor}">${i+1}</div>
              </td>
              <td style="padding-left:10px;vertical-align:middle">
                <div style="font-family:'Outfit',sans-serif;font-size:13.5px;
                  font-weight:600;color:rgba(225,238,250,.92);letter-spacing:.01em">${h.sym}</div>
              </td>
            </tr></table>
          </td>
          <td style="padding:13px 10px;font-family:'JetBrains Mono','Courier New',monospace;
            font-size:12px;color:rgba(155,175,195,.65);text-align:right;
            vertical-align:middle;border-bottom:1px solid rgba(255,255,255,.04)">
            ${Number(h.qty).toLocaleString("en-US",{maximumFractionDigits:6})}
          </td>
          <td style="padding:13px 20px 13px 10px;font-family:'JetBrains Mono','Courier New',monospace;
            font-size:12px;color:${GOLD_HI};font-weight:500;text-align:right;
            vertical-align:middle;border-bottom:1px solid rgba(255,255,255,.04)">
            ${fmtUSD(h.cost||0)}
          </td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="3" style="padding:24px;text-align:center;
        font-family:'Outfit',sans-serif;font-size:12px;color:rgba(160,180,200,.35)">
        No holdings on record
      </td></tr>`;

  // P&L bar — visual percentage meter, 200px wide, shows magnitude
  const barPct  = Math.min(Math.abs(pnlPct), 50) / 50 * 100; // cap at 50% for visual scale
  const pnlBar  = `
    <div style="margin:0 0 4px;display:flex;align-items:center;justify-content:space-between">
      <span style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;
        letter-spacing:.18em;text-transform:uppercase;color:rgba(160,180,200,.4)">
        Return vs cost basis
      </span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;
        font-weight:600;color:${pnlColor}">${sign}${fmt(Math.abs(pnlPct),2)}%</span>
    </div>
    <div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-bottom:6px">
      <div style="height:4px;width:${barPct}%;border-radius:2px;
        background:linear-gradient(to right,${pnlColor},${isPos ? "#11d4a8" : "#ff6b7a"})"></div>
    </div>`;

  const body = `
  <!-- ══ TOP ACCENT BAR ══ -->
  <div style="height:3px;background:linear-gradient(90deg,transparent 0%,${GOLD} 25%,${GOLD_HI} 55%,${GOLD} 78%,transparent 100%)"></div>

  <!-- ══ HERO VALUE SECTION ══ -->
  <div style="padding:40px 44px 0;background:linear-gradient(180deg,rgba(201,168,76,.035) 0%,transparent 100%)">

    <!-- report label + ref -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr>
        <td>
          <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;
            letter-spacing:.26em;text-transform:uppercase;color:rgba(201,168,76,.5);margin-bottom:5px">
            Portfolio Performance Report
          </div>
          <div style="font-family:'Outfit',sans-serif;font-size:13px;font-weight:300;
            color:rgba(180,200,220,.55)">${dateLabel}</div>
        </td>
        <td style="text-align:right;vertical-align:top">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;
            color:rgba(201,168,76,.3);letter-spacing:.1em">REF ${refNum}</div>
          <div style="font-family:'Outfit',sans-serif;font-size:10px;
            color:rgba(160,180,200,.3);margin-top:3px">Private &amp; Confidential</div>
        </td>
      </tr>
    </table>

    <!-- Portfolio value hero number -->
    <div style="margin-bottom:6px;font-family:'Outfit',sans-serif;font-size:10px;font-weight:500;
      letter-spacing:.2em;text-transform:uppercase;color:rgba(201,168,76,.45)">
      Total Portfolio Value
    </div>
    <div style="font-family:'Playfair Display',Georgia,serif;font-size:clamp(32px,6vw,44px);
      font-weight:600;color:#f0e8d5;letter-spacing:-.02em;line-height:1;margin-bottom:14px">
      ${fmtUSD(portfolioValue)}
    </div>

    <!-- P&L inline badge -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr>
        <td style="padding:6px 14px;background:rgba(${pnlRgb},.1);border:1px solid rgba(${pnlRgb},.22);
          border-radius:8px">
          <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;
            color:${pnlColor}">${sign}${fmtUSD(Math.abs(pnl))}</span>
          <span style="font-family:'Outfit',sans-serif;font-size:12px;
            color:rgba(${pnlRgb},.75);margin-left:8px">${sign}${fmt(Math.abs(pnlPct),2)}% all-time</span>
        </td>
      </tr>
    </table>

    <!-- P&L bar -->
    ${pnlBar}

  </div>

  <!-- ══ HAIRLINE ══ -->
  <div style="margin:28px 0 0;height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.07) 20%,rgba(255,255,255,.07) 80%,transparent)"></div>

  <!-- ══ STAT STRIP ══ -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:rgba(255,255,255,.018)">
    <tr>
      <td class="stat-cell" style="padding:20px 0 20px 44px;vertical-align:middle;
        border-right:1px solid rgba(255,255,255,.045)">
        <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;
          letter-spacing:.18em;text-transform:uppercase;color:rgba(160,180,200,.38);margin-bottom:7px">
          Cost Basis
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:19px;
          font-weight:600;color:rgba(220,235,248,.75);letter-spacing:-.01em">
          ${fmtUSD(totalCost)}
        </div>
      </td>
      <td class="stat-cell" style="padding:20px 0;text-align:center;vertical-align:middle;
        border-right:1px solid rgba(255,255,255,.045)">
        <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;
          letter-spacing:.18em;text-transform:uppercase;color:rgba(160,180,200,.38);margin-bottom:7px">
          Open Positions
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:19px;
          font-weight:600;color:${GOLD};letter-spacing:-.01em">
          ${holdingsCount}
        </div>
      </td>
      <td class="stat-cell" style="padding:20px 44px 20px 0;text-align:right;vertical-align:middle">
        <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:600;
          letter-spacing:.18em;text-transform:uppercase;color:rgba(160,180,200,.38);margin-bottom:7px">
          Transactions
        </div>
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:19px;
          font-weight:600;color:rgba(220,235,248,.75);letter-spacing:-.01em">
          ${txCount}
        </div>
      </td>
    </tr>
  </table>

  <!-- ══ HAIRLINE ══ -->
  <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.07) 20%,rgba(255,255,255,.07) 80%,transparent)"></div>

  <!-- ══ ACCOUNT SUMMARY TABLE ══ -->
  <div style="padding:30px 44px">
    <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;
      letter-spacing:.22em;text-transform:uppercase;color:rgba(201,168,76,.4);margin-bottom:18px">
      Account Summary
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${dataRow("Portfolio Value",    fmtUSD(portfolioValue), true)}
      ${dataRow("Total Cost Basis",   fmtUSD(totalCost))}
      ${dataRow("Unrealised P&amp;L", sign + fmtUSD(Math.abs(pnl)), false, false)}
      ${dataRow("Return on Cost",     sign + fmt(Math.abs(pnlPct), 2) + "%")}
      ${dataRow("Open Positions",     holdingsCount.toString())}
      ${dataRow("Total Transactions", txCount.toString(), false, true)}
    </table>
  </div>

  ${topHoldings.length ? `
  <!-- ══ HOLDINGS TABLE ══ -->
  <div style="height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.06) 20%,rgba(255,255,255,.06) 80%,transparent);margin:0 44px"></div>
  <div style="padding:30px 0">
    <div style="padding:0 44px;font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;
      letter-spacing:.22em;text-transform:uppercase;color:rgba(201,168,76,.4);margin-bottom:16px">
      Top Holdings
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <!-- header -->
      <tr style="background:rgba(255,255,255,.02)">
        <th style="padding:9px 18px 9px 20px;font-family:'Outfit',sans-serif;font-size:9.5px;
          font-weight:600;letter-spacing:.12em;text-transform:uppercase;
          color:rgba(160,180,200,.35);text-align:left;border-bottom:1px solid rgba(255,255,255,.05)">
          Asset
        </th>
        <th style="padding:9px 10px;font-family:'Outfit',sans-serif;font-size:9.5px;
          font-weight:600;letter-spacing:.12em;text-transform:uppercase;
          color:rgba(160,180,200,.35);text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">
          Quantity
        </th>
        <th style="padding:9px 20px 9px 10px;font-family:'Outfit',sans-serif;font-size:9.5px;
          font-weight:600;letter-spacing:.12em;text-transform:uppercase;
          color:rgba(160,180,200,.35);text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">
          Avg Entry
        </th>
      </tr>
      ${holdingRows}
    </table>
  </div>` : ""}

  <!-- ══ INSIGHT BOX ══ -->
  <div style="margin:0 44px 32px;padding:20px 24px;
    background:linear-gradient(135deg,rgba(201,168,76,.07) 0%,rgba(201,168,76,.03) 100%);
    border:1px solid rgba(201,168,76,.15);border-radius:14px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04)">
    <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;
      letter-spacing:.2em;text-transform:uppercase;color:rgba(201,168,76,.55);margin-bottom:10px">
      Wealth Advisory Note
    </div>
    <p style="font-family:'Playfair Display',Georgia,serif;font-size:14px;font-style:italic;
      font-weight:400;color:rgba(210,225,240,.75);line-height:1.75;margin-bottom:8px">
      ${isPos
        ? `"Your portfolio is delivering <strong style="color:${GOLD_HI};font-style:normal">${sign}${fmt(Math.abs(pnlPct),2)}%</strong> above cost basis, reflecting disciplined capital allocation across ${holdingsCount} position${holdingsCount !== 1 ? "s" : ""}. Total unrealised gain stands at <strong style="color:${GOLD_HI};font-style:normal">${fmtUSD(Math.abs(pnl))}</strong>."`
        : `"Your portfolio is currently <strong style="color:${pnlColor};font-style:normal">${fmt(Math.abs(pnlPct),2)}% below cost basis</strong>. Market conditions can shift rapidly — we recommend reviewing your open positions and ensuring your exposure aligns with your risk parameters."`
      }
    </p>
    <div style="font-family:'Outfit',sans-serif;font-size:10px;font-weight:500;
      color:rgba(201,168,76,.45);letter-spacing:.06em">
      — Aurum Capital, Wealth Advisory
    </div>
  </div>

  <!-- ══ DUAL CTA ══ -->
  <div style="padding:0 44px 40px;text-align:center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;width:100%">
      <tr>
        <td style="padding-right:8px">
          <a href="${SITE}/dashboard.html" style="display:block;padding:15px 20px;
            background:linear-gradient(145deg,${GOLD_HI} 0%,${GOLD} 45%,#a87830 100%);
            color:${INK};font-family:'Outfit',sans-serif;font-size:11.5px;font-weight:700;
            letter-spacing:.12em;text-transform:uppercase;border-radius:11px;
            box-shadow:0 4px 20px rgba(201,168,76,.35),0 1px 0 rgba(255,255,255,.18) inset;
            text-align:center">
            Open Dashboard &nbsp;→
          </a>
        </td>
        <td style="padding-left:8px">
          <a href="${SITE}/trade.html" style="display:block;padding:14px 20px;
            background:transparent;color:${GOLD};
            font-family:'Outfit',sans-serif;font-size:11.5px;font-weight:600;
            letter-spacing:.1em;text-transform:uppercase;border-radius:11px;
            border:1px solid rgba(201,168,76,.3);text-align:center">
            Trade Now &nbsp;→
          </a>
        </td>
      </tr>
    </table>
  </div>

  <!-- ══ REPORT FOOTER ══ -->
  <div style="background:rgba(0,0,0,.2);padding:18px 44px;
    border-top:1px solid rgba(255,255,255,.045)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-family:'Outfit',sans-serif;font-size:9px;
            color:rgba(160,180,200,.3);letter-spacing:.08em">
            Report Reference: <span style="color:rgba(201,168,76,.4);font-family:'JetBrains Mono',monospace">${refNum}</span>
          </div>
        </td>
        <td style="text-align:right">
          <div style="font-family:'Outfit',sans-serif;font-size:9px;
            letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,.3)">
            Aurum Capital &nbsp;·&nbsp; Private Wealth
          </div>
        </td>
      </tr>
    </table>
  </div>
  `;

  return shell(
    `${firstName}, your portfolio digest — ${fmtUSD(portfolioValue)} · ${sign}${fmt(Math.abs(pnlPct),1)}% return`,
    body
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────
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

  const { type, email, firstName = "", data = {} } = body as {
    type: string; email: string; firstName?: string; data?: Record<string, unknown>;
  };

  if (!type || !email) {
    return new Response(JSON.stringify({ error: "Missing type or email" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let subject = "";
  let html    = "";

  if (type === "price_alert") {
    const d = data as { sym: string; target: number; dir: string; currentPrice: number };
    subject = `🔔 ${d.sym} Alert Triggered — ${d.dir === "above" ? "↑" : "↓"} ${fmtUSD(d.target)}`;
    html    = buildPriceAlertHtml(firstName as string, d.sym, d.dir, d.target, d.currentPrice);

  } else if (type === "profit_alert") {
    const d = data as { pnlPct: number; threshold: number; portfolioValue: number; type: "gain" | "loss" };
    const sign = d.pnlPct >= 0 ? "+" : "";
    subject = `${d.type === "gain" ? "📈" : "📉"} Portfolio ${d.type === "gain" ? "Gain" : "Loss"} Alert: ${sign}${fmt(Math.abs(d.pnlPct), 1)}%`;
    html    = buildProfitAlertHtml(firstName as string, d.pnlPct, d.threshold, d.portfolioValue, d.type);

  } else if (type === "digest") {
    const d = data as {
      portfolioValue: number; totalCost: number;
      holdingsCount: number; txCount: number;
      topHoldings: Array<{sym:string;qty:number;cost:number}>;
    };
    subject = `📊 Your Aurum Capital Portfolio Digest · ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
    html    = buildDigestHtml(firstName as string, d.portfolioValue, d.totalCost, d.holdingsCount, d.txCount, d.topHoldings || []);

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

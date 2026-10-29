# Aurum Capital — Redesign & bug-fix brief for Claude Code

Paste everything below the line into Claude Code, from the root of the website project.
Put this whole `aurum-design/` folder in the project root first.

---

You are redesigning and fixing my investment platform, Aurum Capital (aurumcapitalinvest.com).
The folder `aurum-design/` is the **visual and behavioural reference**. Open every file in it before you start:

| Reference file | What it defines |
|---|---|
| `landing.html` | Public landing page as a mobile app (all 13 sections) |
| `dashboard.html` | Signed-in dashboard, shared header, full-screen menu, quick-action sheet, bottom nav |
| `invest.html` | Invest / markets page with search + filters |
| `trade.html` | Trade page (TradingView / MT4 style), practice mode, full screen |
| `account.html` | Profile & settings — the theme switch lives here |
| `app.css` | Design tokens (colours, shadows, radii, type) and shared components |
| `app.js` | Shared behaviour: overlays, toggles, segmented controls, prefetch |

Match the reference closely (layout, spacing, colours, components). Use real data from my backend wherever the reference shows sample values, `—` or `[PLACEHOLDER]`.

## 0. Ground rules
1. **Don't break anything.** Before changing any page, list every working feature on it (deposit, withdraw, trade, buy/sell, history, menu, theme, hide balance, live prices, links, sign-in/out…) in `REDESIGN-LOG.md`, and test it. Re-test after every change. If something that worked stops working, revert that change and find a safer fix.
2. Work on a new git branch. Page by page. Do not deploy; wait for my approval.
3. Do not invent prices, returns, testimonials or statistics. Where data is missing, show `—`.
4. Ask me before deleting anything not listed in this brief.

## 1. Performance rules (every page)
- Pages are static HTML: header, buttons, cards and bottom nav are in the HTML, never injected by JS. Everything is visible and tappable the moment the HTML arrives.
- No preloaders, splash screens, spinners, fade-in or scroll-reveal animations.
- Critical CSS inlined in `<head>` (from `app.css`). No CSS/JS frameworks, no jQuery, no icon fonts. Icons are inline SVG.
- One small vanilla JS file with `defer`. Live prices, charts and third-party widgets load **after** the page is interactive and never block it. Fixed-size placeholders so nothing jumps (CLS 0).
- Fonts: self-host subsetted WOFF2 (Playfair Display, Outfit, JetBrains Mono), `font-display: swap`, max 4 files.
- `touch-action: manipulation`, instant `:active` pressed states, prefetch/prerender the next pages (Speculation Rules + prefetch on touchstart) so taps feel native.
- **Budgets:** public pages < 100 KB first load; every signed-in page **≤ 200 KB** total transferred. Add `npm run size` that fails if any page is over budget.
- Trade chart: use **TradingView Lightweight Charts** (small, open source), loaded lazily on the trade page only.
- Targets: LCP < 1.2 s on 4G, CLS 0, INP < 100 ms, Lighthouse mobile ≥ 90.

## 2. Shared app shell (all signed-in pages)
- Header: avatar (links to Profile) + page name on the left; Menu (grid icon) and Notifications on the right. **No theme toggle in the header.**
- Full-screen menu as in `dashboard.html#menu`: dark live-price strip, one "Navigate" list (Dashboard, Invest, Trade, Cryptocurrency, Global equities, Commodities, Transactions, Support), Deposit button, status line.
- Global bottom nav: Home, Invest, gold "+" (quick-action sheet: Deposit, Withdraw, Trade, New investment), Portfolio, Account. It is the **only** bottom navigation on any page.
- **Remove every floating ☰ button** and every page-specific bottom nav (e.g. the "cube" nav on the trade page: Chart / Portfolio / Trade / Alerts / Markets).
- Theme switch (Light / Dark / System) lives in **Profile & settings** only. Keep the same storage key and behaviour the site uses today.

## 3. Shadows
- Only cards, the primary gold button, the bottom nav and icon buttons have shadows, using the tokens in `app.css` (`--shadow-card`, `--shadow-sm`, `--shadow-btn`, `--press`).
- Remove text-shadow, drop-shadow filters, coloured glows, shadow-inside-shadow, shadows on pills/badges/list rows/inputs/header, animated shadows and backdrop-filter blur.
- Remove the different card tints (gold / blue / green / purple). One card style everywhere.

## 4. Remove
- The **"Featured property — Own a piece of the Burj Khalifa from $1,000 / 20% annual yield paid weekly"** card: HTML, CSS, JS and any data or images used only by it. Search the whole repo for "Burj", "Khalifa", "20% annual yield", "paid weekly" and list every hit; remove from signed-in pages, ask me about anything else.
- The marketing hero ("Deploy capital. Build wealth.") on the signed-in Invest page.
- Duplicate stat cards on Invest that repeat the dashboard.

## 5. Bugs to fix (found so far)

### Site-wide
1. **Broken characters**: `?` and `�` instead of symbols — e.g. "Trade Crypto ?", "Fund Account ?", "Add funds ?", "View history ?", "Search assets�", "Your portfolio at a glance � positions", "21/06/2026 � 12:40", "BTC � ETH � SOL", "LIVE MARKETS � MULTI-ASSET", "? 1.65%". Fix: `<meta charset="utf-8">` as the first tag in every `<head>`, save files as UTF-8, replace with `→`, `·`, `—` or inline SVG.
2. **Uptime contradicts itself**: 99.9% in the status bar/menu vs 98.4% in the landing hero. Ask me which is correct.
3. **Minimum entry contradicts**: dashboard says "Minimum entry $10", landing FAQ says no minimum for crypto. Ask me which is correct.
4. Risk disclosure says "regulated under applicable financial services law". Add placeholders for regulator name and licence number and ask me to fill them.

### Numbers (dashboard, invest, portfolio)
5. **Three different P&L figures**: "+$62.4K unrealised P&L" next to "+3.86%" on a $22.7K portfolio (impossible), and "+82.88% all time" on the Invest page. Find every P&L calculation, make amount and % come from **one** function (P&L % = P&L amount ÷ cost basis), and use it on every page. Report the cause to me.
6. Net worth must equal cash + portfolio value everywhere (dashboard shows $45,270.27; Invest shows portfolio $22,645.25 vs cash $22,616.37 — check they reconcile).

### Dashboard
7. "Withdraw" rows in Recent trades have **empty icon boxes**.
8. "Buy ETH" amount shown in **red** like a loss. Money out (buy, withdraw) = neutral colour with "−$"; green only for realised gains.
9. Floating ☰ button covers "New Investment" and "View Dashboard".

### Invest page
10. **Ticker colours wrong**: SOL 2.97%, BNB 1.96%, ETH 2.15% shown in red with **no + / − sign**. Green + for up, red − for down, from the real change value.
11. Ticker starts clipped ("$2,316.09" cut off at the left).
12. Filter chips wrap onto two rows → one horizontal scroll row.
13. Search box has a grey box inside a box → single input as in reference.
14. Floating ☰ covers the "Swap" button. (Swap moves into the trade sheet / trade page.)

### Trade page
15. Change shows "? 1.65%" / "? -2.12%": broken arrow character and missing/duplicated sign.
16. Volume label "85.43M" overlaps the price axis label.
17. Price axis labels have no thousands separators and unnecessary ".00" → "82,500".
18. **Data mismatch**: header says 24H low $77,735 but the last candle drops to ~$70,000. Check the candle feed / aggregation.
19. Timeframe row overflows (last button cut off) → timeframes, chart type and indicators go into the **Chart settings dropdown** as in `trade.html`.
20. Remove the theme toggle and the "⚡" button from the trade header; remove the duplicate price strip above the bottom nav.
21. Add **Practice / Live** switch (practice balance clearly labelled, never mixed with real funds), SELL / BUY buttons with price, volume (lots) stepper, collapsible Open positions / Orders — MT4 style.
22. **Full screen** button hides the global bottom nav and gives the chart the whole screen, with a visible **"Exit full screen"** button.

### Menu
23. Theme toggle sits in the menu header → remove (it's in Profile now).
24. Menu subtitles show "BTC � ETH" → "BTC · ETH · SOL · more".

## 6. Security checks (signed-in area)
- Every signed-in page and API enforces auth **on the server**, not only by redirect in the browser.
- No API keys/secrets in client code.
- Changing an ID in a URL or request must never show another user's data.
- Deposit / withdraw / trade: confirmation step, button disabled while submitting, idempotency key to prevent double submissions.

## 7. Finish
- Run `npm run size` and Lighthouse mobile on every page; put before/after numbers in `REDESIGN-LOG.md`.
- Re-run the feature checklist; mark each item pass/fail.
- List every bug above with its cause and fix. Show me the diff summary and wait for approval.

> More pages may be added to this brief later (Portfolio, Transactions, Deposit, Withdraw, Support…). Use the same shell, tokens and rules for any page not listed.

# Aurum Capital — Redesign log

Branch: `app-redesign` (from `ui-redesign` + current `main`). Nothing deployed.
Reference: `design/aurum-design/` (landing, dashboard, invest, trade, account, app.css, app.js).

## Status

| Page | Status |
|---|---|
| Landing (`index.html`) | ✅ Done earlier — matches `landing.html` (identical to the first design file) |
| Markets (`markets.html`) | ✅ Done earlier — same system |
| Shared signed-in shell (header, menu, quick-action sheet, bottom nav, tokens, dark theme) | ⏳ Next |
| Dashboard | ⏳ |
| Invest | ⏳ |
| Trade | ⏳ |
| Account / Profile & settings | ⏳ |
| Other pages (about, contact, testimonial, privacy, signup) | ⏳ — same shell & tokens |

## Feature inventory (must keep working)

Collected from every user-callable function and handler on each page before any change.
Tested = needs a signed-in test account (requested).

### Dashboard (`dashboard.html`, `dashboard.js`, `portfolio-sync.js`)
- Auth gate → redirect to `signup.html`; profile load; realtime profile / holdings / transactions / prices
- Net-worth hero, cash, portfolio value, positions, P&L; hide/show balances (`aurum_balance_hidden`)
- Currency conversion (`currency-utils.js`, `aurum_pref_currency`)
- Deposit: crypto (coin select, address + copy, QR), bank (copy fields/reference), card (type, number/expiry formatting), e-wallet (copy email), amount presets, multi-step flow, processing screen
- Withdraw: crypto / card methods, amount presets, validation, submit (pending until approval)
- Trade modal (buy/sell, amount presets, calc), trade receipt
- Portfolio modal, transactions modal (+ filter), chart modal (periods)
- Property withdraw; property locks (`aurum_property_locks`)
- Drawer / dash menu, toasts, theme toggle (`aurum_theme`)
- Admin panel (secret long-press): users, holdings, transactions, pending deposits/withdrawals approve/reject, cash set/adjust/bulk, holdings add/edit/delete/bulk, prices set/reset, P&L target, crypto addresses, payment settings, export users

### Invest (`invest.html`)
- Auth gate; asset list with live prices, filters, per-card charts
- Invest modal (amount slider/presets, duration, period), confirm invest
- Sell holding, property invest/withdraw, swap modal, deposit (crypto)
- Portfolio / transactions panes, transaction filter, receipt
- Hide balances, theme toggle; admin price/cash panel

### Trade (`trade.html`)
- Auth gate; asset selector; Lightweight Charts + OHLCV (get-ohlcv, Binance fallback)
- Spot buy/sell, CFD long/short with lots and margin, close position
- Open positions panel, holdings, history, price alerts (`aurum_alerts`, email via send-user-alert)
- Chart markers (`aurum_chart_markers`), full screen, in-app notifications, hide balances, theme

### Profile (`profile.html`)
- Auth gate; profile view/edit (modal + inline), avatar upload (storage `avatars`) / colour
- Preferences (currency, format, digest, alerts, confirm), price alerts add/remove, send digest now
- Theme toggle, sidebar

## Findings so far

### Bug 5 — three different P&L figures (cause)
1. **Admin `pnl_override`** replaces the calculated P&L per holding on every page (`dashboard.html:4064, 4284`, `invest.html:2504, 2527`, `trade.html:3847, 3888, 3938`, `portfolio-sync.js:759, 788`, `dashboard.js:247`), while portfolio value and net worth still use market prices — so an override can never reconcile with the value shown ("+$62.4K P&L" on a "$22.7K" portfolio).
2. **Amount and % from different code:** `portfolio-sync.js:761` adds open-trade P&L to the amount but the % (`dashboard.html:4291`) excludes it; both write to the dashboard.
3. **Invest "+82.88% all time" is not a P&L:** `invest.html:2092` computes `(net worth − 24,750) / 24,750` against a hard-coded $24,750.

### Bug 6 — net worth
Net worth = cash + Σ(quantity × live price) on dashboard (`dashboard.html:4290`); Invest computes portfolio value from a different price map (`ALL_ASSETS` prices vs `PRICES`) — to reconcile with one shared function.

### Burj Khalifa search (brief §4)
| Hit | What | Action |
|---|---|---|
| `dashboard.html:2565-2568` | "Featured property" marketing card | Remove (signed-in) |
| `dashboard.html:3967` | `DXB` asset definition | **Ask** — needed if any customer holds DXB |
| `invest.html:1601` | `DXB` asset definition (property list) | **Ask** |
| `portfolio-sync.js:27` | `DXB` asset metadata | **Ask** |
| `trade.html:2689` | `DXB` asset definition | **Ask** |

## Open questions for the owner
1. Minimum entry: "$10" (dashboard) vs "no minimum for crypto" (FAQ) — which is correct?
2. DXB / Burj Khalifa Residences asset: do any customers hold it? Remove the asset or keep it?
3. P&L override vs one P&L function (see bug 5).
4. Test accounts (2 users + 1 admin) to test every feature before/after each change.

## Answered
- Uptime: **99.9%** (landing updated).
- Regulator / licence: editable by admin (`site_settings`, planned with the account/admin work).

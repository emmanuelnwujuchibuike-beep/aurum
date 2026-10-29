# Aurum Capital — Redesign log

Branch: `app-redesign` (from `ui-redesign` + current `main`). Nothing deployed.
Reference: `design/aurum-design/` (landing, dashboard, invest, trade, account, app.css, app.js).

## Status

| Page | Status |
|---|---|
| Landing (`index.html`) | ✅ Done earlier — matches `landing.html` (identical to the first design file) |
| Markets (`markets.html`) | ✅ Done earlier — same system |
| Shared signed-in shell (header, menu, quick-action sheet, bottom nav, tokens, dark theme) | ✅ 7adf5bc |
| Dashboard | ✅ 7adf5bc — tested with simulated account data (light/dark, test mode on/off) |
| Admin dashboard (`admin.html`) | ✅ Overview, approvals, support inbox (moved from contact page), users + set cash, transactions, test mode, regulator/licence. Advanced tools (holdings, prices, P&L, addresses, payment settings, bulk) open the untouched classic console at `dashboard-classic.html#admin` |
| Deposit / Withdraw / Transactions / Portfolio pages | ⏳ — hand off to `dashboard-classic.html#…` until built |
| Support icon replacing chat widget | ⏳ requested |
| Invest | ⏳ |
| Trade | ⏳ |
| Account / Profile & settings | ✅ new shell; details, avatar (upload/colour), theme, currency/format, digest, price + P&L alerts; **Admin dashboard button shown only when profiles.is_admin** |
| Contact / Support | ✅ new shell; 4 enquiry forms (same payloads), real live-chat widget; hidden 5-tap support console removed (now admin.html#support); canned fake-advisor chat removed |
| Other pages (about, testimonial, privacy, signup) | ⏳ — same shell & tokens |
| Signed-in landing | ✅ index.html sends a signed-in device straight to dashboard.html before paint (`?home` shows the landing) |

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
3. **Invest "+82.88% all time" is not a P&L:** `invest.html:2092` computed `(net worth − 24,750) / 24,750` against a hard-coded $24,750. **Fixed (02cf38f):** now (net worth − net paid in) ÷ net paid in, from approved deposits − withdrawals; "—" when nothing to measure.

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
4. Test accounts (2 users + 1 admin) to test every feature before/after each change.

## Answered
- Admin P&L / price overrides: **owner wants them kept.** Existing override code is left untouched. Claude will not extend overrides into net worth / portfolio value or carry them into redesigned pages; open item for the owner.
- Hard-coded values: none allowed — `24750` removed (no other hard-coded baselines found by `git grep`).
- Zip deleted after verifying `design/aurum-design/` copies.
- Uptime: **99.9%** (landing updated).
- Regulator / licence: editable by admin (`site_settings`, planned with the account/admin work).

## Test mode (owner decision)
- `site_settings.test_mode` (applied to the database; default **false**; admin-only write, verified anonymous write changes 0 rows).
- ON: `pnl_override` is used by the one portfolio function with value = cost + override, so cash + value = net worth everywhere; every affected figure shows **TEST** and every new page shows the test banner.
- OFF: overrides ignored; all figures from holdings × live prices.

## Bug fixes recorded
| # | Bug | Cause | Fix |
|---|---|---|---|
| 5 | Three different P&L figures | override replaced P&L but not value; amount and % from different scripts; hard-coded 24,750 | one `portfolio()` function (aurum-session.js) used by new pages; 24,750 removed |
| 6 | Net worth vs cash + portfolio | different price maps per page | same function, same price feed |
| 7 | Empty icon boxes on Withdraw rows | icon font class missing for type | inline SVG per type, fallback icon |
| 8 | Buy shown red like a loss | colour by sign | neutral for money in/out; green only for realised gains |
| 9 | Floating ☰ covering buttons | page-specific floating menu | removed; one header menu + bottom nav |
| — | iOS back-swipe "logs out" | sign-in page left in history (`location.href`), never checked existing session | `location.replace`, skip form when signed in (incl. back-cache restore), `?next=`; tested |

## Tests run (dashboard)
| Check | Result |
|---|---|
| Figures (test off): NW $39,216.37 = cash $22,616.37 + value $16,600; P&L +$2,100 / +14.48% | ✅ matches hand calculation |
| Figures (test on): NW $39,116.37, P&L +$2,000 / +13.79%, 2 TEST marks + banner | ✅ |
| Activity icons, neutral money-out colours, pending tag | ✅ |
| Light / dark render, no horizontal scroll at 390 px, no console errors | ✅ |
| Sign-in while signed in → app; back never returns to sign-in | ✅ |
| Back from another page restores dashboard from back-cache (no reload) | ✅ |
| Signed out elsewhere + back → sign-in (no cached balances shown) | ✅ |

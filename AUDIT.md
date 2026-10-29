# Aurum Capital — Signed-in Area Audit (Phase 1)

_Date: 2026-10-29 · Branch: `ui-redesign` · Status: discovery only, no signed-in code changed._

Severity: **P0** = fix before any real customer uses it · **P1** = fix in this phase · **P2** = fix soon · **P3** = polish.

---

## 1. Stack

| Layer | What it is |
|---|---|
| Hosting | Static files from `src/` (no host config in the repo — **which host serves aurumcapitalinvest.com?**) |
| Backend | Supabase (project `ttwwthfeordsojmcjwxn`, Postgres 17, **AWS eu-west-1 / Ireland**) |
| Auth | Supabase Auth (email + password, magic-link/OTP redirect handled in `signup.js`) |
| Database access | **Directly from the browser** with the anon key + Row Level Security (RLS) |
| Server code | 8 Supabase Edge Functions (Deno) |
| Email | Resend (from edge functions) |
| Market data | CoinGecko → Binance (crypto), Twelve Data → Yahoo (stocks/commodities) |
| Build tools | None for the app pages (Tailwind CLI configured but unused; Tailwind **CDN** loaded at runtime on 2 pages) |
| Schema / RLS in repo | **No.** Only 3 small migrations; tables and policies exist only in the live database |

### Signed-in pages

| Page | Purpose |
|---|---|
| `dashboard.html` (481 KB source) | Portfolio overview, deposit, withdraw, transactions, property, **plus the entire admin panel** |
| `invest.html` (245 KB) | Buy/sell assets and property, deposit |
| `trade.html` (245 KB) | Trading terminal, CFDs, price alerts |
| `profile.html` (118 KB) | Profile, avatar upload, preferences, alerts, security |
| `signup.html` (54 KB) | Sign-in / sign-up (entry point) |

There are no separate KYC, notifications or settings pages: settings live in `profile.html`, and deposit/withdraw/transactions are modals inside `dashboard.html`.

### Endpoints each page calls

| Called from | Tables (direct from browser) | Edge functions / external | Realtime channels |
|---|---|---|---|
| dashboard | profiles (r/w), holdings (r/w/d), transactions (r/w), payment_settings (r/**w**), crypto_addresses (r), asset_prices (r) | admin-update-shipment | 5 |
| invest | profiles (r/w), holdings (r/w/d), transactions (r/w), crypto_addresses, asset_prices | get-ohlcv, admin-update-shipment | 3 |
| trade | profiles (r/w), holdings (r/w/d), open_trades (r/w), transactions (r/w), asset_prices | get-market-prices, get-ohlcv, **Binance klines (direct)** | 4 |
| profile | profiles (r/w), holdings, transactions, storage `avatars` | send-user-alert | 1 |
| signup | — | new-user-handler (called from the browser) | — |
| chat widget (public pages) | chat_sessions (w), chat_messages (w) | contact-form-handler | — |

---

## 2. Measurements (first load, compressed, slow 4G + 4× CPU, sign-in redirect blocked)

| Page | Total | HTML | Own JS | 3rd-party JS | Fonts | CSS | Requests | Budget (200 KB) |
|---|---|---|---|---|---|---|---|---|
| dashboard | **404 KB** | 96 KB | 36 KB | 246 KB (Tailwind CDN 124, Chart.js 69, Supabase 47) | (FA) | 26 KB | 19 | ❌ ×2.0 |
| invest | **311 KB** | 53 KB | 29 KB | 171 KB (Chart.js, lightweight-charts, Supabase) | 29 KB | 26 KB | 24 | ❌ |
| trade | **364 KB** | 52 KB | 9 KB | 177 KB | 99 KB | 25 KB | 21 | ❌ |
| profile | **400 KB** | 26 KB | 8 KB | 80 KB | **261 KB** (Font Awesome brands 115 KB) | 25 KB | 25 | ❌ ×2.0 |
| signup | **753 KB** | 11 KB | 20 KB | 283 KB (Google Tag Manager 177 KB) | 321 KB | 25 KB | 38 | ❌ ×3.8 |

Render-blocking on every signed-in page: Google Fonts CSS, Font Awesome CSS, `premium-base.css`, and synchronous `<script>` tags in `<head>` (Supabase SDK, Chart.js, Tailwind CDN, `intro-loader.js`). Every page also shows a **full-screen intro loader**.

**Not yet measured — needs a test account:** time-to-usable with real data, and per-API-call timings / sequencing. Calls are made with `await` one after another in several loaders (e.g. profile → holdings → transactions), which I'll confirm with live timings once I can sign in.

---

## 3. Findings

### 🔴 Security & integrity

| # | Sev | Finding | Evidence |
|---|---|---|---|
| S1 | **P0** | ✅ **Fixed live** (chat RLS + widget, verified). **Support chats are public.** Anyone on the internet can read all `chat_sessions` (35 rows: names + emails) and `chat_messages` (57 rows: messages + image links) with the public key. Active personal-data leak. | Anonymous REST read returned rows (counts only were inspected). |
| S2 | ✅ | **FIXED LIVE 2026-10-29:** all buys, sells, swaps, property withdrawals and CFDs run in the `money` edge function + atomic SQL functions; customers can no longer write cash, holdings or trades (attack tests refused, cash reconciles to the cent). History — **CONFIRMED 2026-10-29 with a QA account:** a customer could set their own cash to any amount, insert holdings (100 BTC), and **make themselves admin**. Admin self-promotion **fixed live** (`20261029_protect_is_admin.sql`, verified). Cash/holdings writes remain open until trading moves to server-side functions (Trade/Invest rebuild). Original finding: **Balances are written by the browser.** Buys, sells, trades and property purchases compute `cash` in JavaScript and `update profiles set cash=…` directly. Any signed-in user can set their own balance, holdings quantity, avg price or `pnl_override` from the browser console. RLS policy `holdings_update_own` allows updating every column of your own rows. | `trade.html:3675`, `invest.html:3030`, `portfolio-sync.js:893`, `dashboard.html:4618`, migration `20260608` |
| S3 | ✅ | **FIXED LIVE:** fills use the server-side market price (≤ 60 s old); random page jitter no longer affects what customers pay or receive. History — **Trades execute at a randomised price.** `trade.html` adds random noise to every price every 800 ms (`microTick`) and fills orders at that value. `invest.html` (`tickPrices`) and `dashboard.html` do the same; `trade.html:3300` fabricates 24H high/low/volume (`price×1.032`, random volume). Customers see and transact on numbers that are not the market. | `trade.html:2863-2869, 3300`, `invest.html:3162-3166`, `dashboard.html:5014` |
| S4 | **P0** | **Admin can set the prices and P&L customers see.** Admin actions `save_price`, `save_prices_batch`, `apply_target_pnl`, `bulk_cash`, `update_cash`, `upsert_holding`, plus `holdings.pnl_override` and `localStorage aurum_price_overrides`. On a regulated platform, customer statements must reflect market prices and real fills; manual adjustments must be audited ledger entries, not overrides. | `admin-update-shipment` actions; migration `20260609` |
| S5 | ✅ fixed 2026-10-29 | **Open email relay.** `send-user-alert` and `new-user-handler` accept any email address and send branded Aurum emails with caller-supplied names/figures, with no auth or rate limit. Usable for phishing in your name; will also get your sending domain blacklisted. | `send-user-alert/index.ts:634-690`, `signup.js:168` |
| S6 | ✅ fixed 2026-10-29 (confirmed: policy "Admin write" let anyone, even signed out, rewrite payment_settings; now `is_admin()` only. crypto_addresses was already read-only) | **Deposit details may be writable by any user.** The admin panel writes `payment_settings` (bank/e-wallet details) straight from the browser. If RLS allows `authenticated` to write it, a user could replace the bank details everyone deposits to. Can't confirm without DB access — see SQL check below. | `dashboard.html:6748` |
| S7 | P1 | **Admin panel is shipped to every user** and opens with a 2-second long-press. Server actions in `admin-update-shipment` do check `is_admin` (good), but the panel's direct table writes (S6) rely only on RLS, and the UI leaks every admin capability. | `dashboard.html:5935` |
| S8 | P1 | **Auth is browser-only.** Pages redirect with `getSession()` in JS; the HTML (including the admin UI) is served to anyone. Real protection is RLS, which is not in the repo and can't be reviewed or versioned. | all signed-in pages |
| S9 | P1 | **No rate limiting** on sign-in, password reset, deposit/withdraw requests, contact form, or chat. | all functions |
| S10 | ✅ | **FIXED LIVE:** every money action carries a request key (double tap = one charge, verified). History — **No idempotency** on deposit/withdraw/trade requests; withdraw button re-enables on error and other flows don't disable at all → duplicate requests possible. | `dashboard.html:5898-5920` |
| S11 | P2 | Withdrawals have no confirmation step showing amount, destination and fee before submitting. | dashboard withdraw modal |
| S12 | P2 | Sensitive state in `localStorage`: `aurum_property_locks`, `aurum_chart_markers`, `aurum_alerts`, price caches — not cleared on sign-out, visible to the next person on a shared device. | dashboard/invest/trade |
| S13 | P2 | Legacy `server.js` (localStorage "demo" auth with a hardcoded admin) still in `src/` and publicly downloadable. | `src/server.js` |
| S14 | P2 | `get-ohlcv` / `get-market-prices`: no caching across instances → Twelve Data 429 rate-limit errors observed during this audit; any visitor can exhaust the quota. | observed 2026-10-29 |

**SQL to run in Supabase → SQL editor (read-only) so I can finish S2/S6/S8:**
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;
```

### 🟠 Bugs

| # | Sev | Finding |
|---|---|---|
| B1 | P1 | `dashboard.js` uses `import`/`export` but is loaded as a classic script → **"Cannot use import statement outside a module"**; the whole file never runs (its `executeBuy`/`executeSell` are dead code duplicated elsewhere). |
| B2 | P1 | Three parallel copies of the trading/portfolio logic (`trade.html`, `invest.html`, `portfolio-sync.js`, `dashboard.js`) that compute cash/avg price differently. |
| B3 | P1 | Market prices come from 4 sources at once (CoinGecko in-browser polling every 15 s, `get-market-prices`, `asset_prices` realtime table, Binance klines) and can disagree between pages. |
| B4 | P2 | `trade.html` ignores `?sym=` — the new Markets page's Buy/Sell links can't preselect the asset. |
| B5 | P2 | 5 timers per trade page (500 ms, 800 ms, 1 s, 15 s…) keep running in background tabs → battery drain, stale writes. |
| B6 | P2 | No empty / error states for holdings, transactions and charts when requests fail; failures only `console.warn`. |
| B7 | P2 | 6 pages had text corrupted by an encoding mistake (fixed in commit `c357ae7`). |
| B8 | P3 | Hardcoded/placeholder data paths remain (e.g. `CHART_PTS` demo series, fallback asset prices). |

### 🟡 Unprofessional structure

| # | Sev | Finding |
|---|---|---|
| U1 | P1 | Every signed-in page has its own design system: 4 different font stacks (Playfair/Outfit/JetBrains Mono, Cormorant/DM Sans, Instrument Sans/DM Mono, Space Grotesk), dark theme vs the new light neumorphic public site. |
| U2 | P1 | Supabase URL/key hardcoded in 13 files; `supabaseClient.js` exists but isn't used. |
| U3 | P1 | 240–480 KB pages of inline `<style>`/`<script>`; `onclick=` handlers built inside template strings. |
| U4 | P2 | Tap targets < 44 px (e.g. 28–30 px icon buttons in admin and modals), icon-only buttons without labels (several `✕`/emoji buttons). |
| U5 | P2 | No confirmation dialogs on deposits/withdrawals/trades; success/error messages inconsistent (toasts, alerts, inline). |
| U6 | P2 | Emojis used as UI icons in money flows (e.g. "⏳" in withdrawal toast, "🔔"). |
| U7 | P3 | Dead files: `test.html` (empty), `server.js`, `script.js`/`premium.js` used only by legacy pages, `public/bimi` duplicate. |

### 🔵 Performance

| # | Sev | Finding |
|---|---|---|
| P1 | P1 | All 5 signed-in pages exceed 200 KB (311–753 KB). |
| P2 | P1 | Render-blocking: Google Fonts, Font Awesome CSS, Tailwind CDN (compiles CSS in the browser), sync SDK/Chart scripts in `<head>`. |
| P3 | P1 | Full-screen intro loader on every page. |
| P4 | P1 | Google Tag Manager (177 KB) on the sign-in page, loaded before content. |
| P5 | P2 | Font Awesome icon fonts (115–154 KB each) for a handful of icons. |
| P6 | P2 | Two chart libraries on invest/trade (Chart.js 69 KB + lightweight-charts 49 KB). |
| P7 | P2 | Admin panel (~60% of dashboard.html) downloaded by every user. |

---

## 4. Proposed Phase 2 plan (new branch `secure-app`, nothing deployed)

**Step 0 — Emergency (needs your OK to touch the live database; ~1 h)**
1. S1: lock `chat_sessions`/`chat_messages` (insert-only for visitors; read for admins and the session owner).
2. S5: require a valid user JWT (or the DB-webhook secret) on `send-user-alert` / `new-user-handler`; send only to the caller's own email.
3. S6: restrict `payment_settings` / `crypto_addresses` writes to admins.
4. Pull the live schema + policies into `supabase/migrations` so security is reviewable and versioned.

**Step 1 — Server-side money (the core fix for S2/S3/S4/S10)**
- Postgres functions (`security definer`, called via RPC) for `place_order`, `close_position`, `request_deposit`, `request_withdrawal`, `buy_property`: read the price **server-side** from the cached market feed, lock the user's row, check balance, write ledger + holdings atomically, accept an **idempotency key**.
- Revoke client `insert/update/delete` on `profiles.cash`, `holdings`, `open_trades`, `transactions`.
- Remove random price jitter and fabricated stats from every page.
- Remove customer-visible overrides (`save_price`, `apply_target_pnl`, `pnl_override`, `aurum_price_overrides`). Admin adjustments become **audited ledger entries** (who, when, why) that appear on the customer's statement.

**Step 2 — Upstash Redis (edge functions only)**
- `prices:v1` (20 s), `ohlcv:{sym}:{tf}:v1` (60 s–10 min by timeframe), `properties:v1` (10 min), `user:{id}:summary` (≤ 30 s, deleted on every money action).
- Upstash rate limits on sign-in proxy, password reset, deposit, withdraw, contact, chat.
- Fail-open to the database/provider if Redis is down; "Updated HH:MM:SS" shown next to cached figures.
- Money actions never read from cache.

**Step 3 — App shell + pages (same tokens as the public site)**
- Shared header + bottom nav + inline critical CSS (already built for the public pages).
- Pages: `dashboard` (portfolio), `invest`, `trade`, `profile` (account), `signup`, plus a separate `admin.html` loaded only for admins.
- Skeletons with fixed sizes (CLS 0), no loader, inline SVG icons, self-hosted fonts (3 files), uPlot (~45 KB) only on chart pages after load.
- Service worker: precache shell/fonts/icons; stale-while-revalidate only for prices and property listings; no caching of balances/transactions; clear all caches + storage on sign-out.
- `npm run size` that fails the build if any signed-in page > 200 KB.
- Regulator name + licence number: `site_settings` table (public read, admin write via `admin-update-shipment`), baked into pages at build time and refreshed after load; admin form in `admin.html`.

**Step 4 — Prove it**
- Size script, Lighthouse table before/after, end-to-end test (sign in → every tab → refresh → offline → sign out → cross-user ID tampering must fail), AUDIT.md updated.

### What I need from you
1. **Approval** of this plan (especially Step 1's removal of price/P&L overrides).
2. **Permission to change the live database** for Step 0, or run the migrations yourself.
3. Output of the two SQL queries above.
4. **Two test accounts** (normal users, not admin) — for timings and the cross-user test — and one admin test account.
5. Which **host** serves the site (Netlify / Vercel / Cloudflare / cPanel …).

## Also found and fixed live on 2026-10-29
| Issue | Fix |
|---|---|
| `open_trades` UPDATE/DELETE open to everyone (even signed out) | owner/admin only, then server-only |
| Customers could edit/delete their own transaction history | removed; customers insert pending deposit/withdraw requests only |
| Customers could make themselves admin | `protect_is_admin` trigger |
| Selling more than held paid out the full amount | server checks holdings |
| Property lock-in stored only in the browser (penalty bypassable) | `holdings.locked_until`, penalty computed server-side |
| Swap never worked (type check constraint) | `swap` allowed |
| $20 welcome bonus | removed for new sign-ups |

Still open: S5 (open email relay), S6 (payment settings write policy), S7 admin UI exposure (admin dashboard rebuild), S9 rate limits on auth.

- **S5 open email relay (fixed live):** `send-user-alert` requires a signed-in user and only emails that user's own address (10/hour). `new-user-handler` takes only a user id, reads email/name from auth, sends only for accounts < 15 min old, once per user; names HTML-escaped. Spoofed requests verified refused.
- **S6 deposit details (fixed live):** `payment_settings` writes are admin-only (`20261029_payment_settings_admin_only.sql`); reads stay public for the deposit screens.

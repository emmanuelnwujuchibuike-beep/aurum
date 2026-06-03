# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aurum Capital is a multi-asset investment platform (crypto, stocks, commodities, real estate) built as a static HTML/JS frontend with Supabase as the backend. There is no build step for HTML/JS — files are served directly.

## Commands

**Compile Tailwind CSS** (run when editing classes in HTML files):
```sh
npx tailwindcss -i ./src/input.css -o ./src/output.css --watch
```

**Deploy a Supabase Edge Function:**
```sh
supabase functions deploy <function-name>
# e.g. supabase functions deploy get-market-prices
```

**Link to the Supabase project** (if CLI is not linked):
```sh
supabase link --project-ref ttwwthfeordsojmcjwxn
```

**Set Edge Function secrets** (Twelve Data, Resend API keys):
```sh
supabase secrets set TWELVE_DATA_API_KEY=... RESEND_API_KEY=...
```

## Architecture

### Frontend (`src/`)
Pure HTML5 + vanilla JS + Tailwind CSS. No framework, no bundler. Each HTML page loads its JS modules via `<script type="module">`.

Key JS modules and their roles:
- `supabaseClient.js` — Supabase client singleton (hardcoded project URL + anon key). Imported by all pages that touch the DB.
- `dashboard.js` + `profile-sync.js` + `portfolio-sync.js` — Real-time Supabase subscriptions for holdings, open trades, and profile data. These use `supabase.channel()` for live updates.
- `coingecko-sync.js` — Polls CoinGecko directly from the browser every 30 seconds and calls `window.onPriceUpdate()` with fresh prices.
- `price-sync.js` — Alternative price sync that calls the `get-market-prices` Edge Function instead.
- `chat-widget.js` — Support chat widget backed by Supabase storage for file uploads.
- `server.js` — Legacy localStorage-based demo auth/portfolio system. Not the live path — real auth goes through Supabase.

Global price update pattern: all price-displaying elements register via `window.onPriceUpdate = (prices) => { ... }`. Both `coingecko-sync.js` and `price-sync.js` call this callback.

### Backend (Supabase Edge Functions — `supabase/functions/`, Deno + TypeScript)

| Function | Trigger | Purpose |
|---|---|---|
| `get-market-prices` | HTTP GET | Fetches live prices from CoinGecko → Twelve Data → Binance (fallback). Caches for 30s. |
| `new-user-handler` | DB webhook (auth.users insert) | Sends welcome email to user + admin notification via Resend. |
| `contact-form-handler` | HTTP POST | Saves submission to `contact_submissions`, emails admin + user confirmation. |
| `transaction-notify` | DB webhook (transactions insert) | Emails admin on new deposit/withdraw. |
| `transaction-status-notify` | DB webhook (transactions update) | Notifies user of status change. |
| `admin-update-shipment` | HTTP POST | Admin operations for approving/rejecting transactions. |

### Database Tables (Supabase/PostgreSQL)
- `profiles` — Extended user info (name, plan, avatarInitials)
- `holdings` — Asset positions (symbol, qty, avg_buy_price) per user
- `open_trades` — Active CFD/derivative positions
- `transactions` — Deposit/withdraw history
- `contact_submissions` — Contact form entries

### External APIs
- **CoinGecko** — Free crypto prices (no key needed client-side)
- **Twelve Data** — Stocks, forex, commodities (requires `TWELVE_DATA_API_KEY` secret on Edge Functions)
- **Binance** — Fallback crypto prices
- **Resend** — Email delivery (requires `RESEND_API_KEY` secret on Edge Functions)

## Key Patterns

- **Authentication**: Supabase Auth (email/password). After login, `supabase.auth.getSession()` is used to gate access to authenticated pages. `server.js` is a separate localStorage demo — do not mix these two systems.
- **Tailwind**: `tailwind.config.js` is minimal (no content paths set). Classes must be in the generated `output.css`. After adding new Tailwind classes to HTML, recompile CSS.
- **Edge Function environment**: Runtime is Deno, not Node. Use `Deno.env.get('KEY')` for secrets. Import from `https://esm.sh/` or `npm:` specifiers.
- **Styling**: Dark theme uses CSS variables defined in `style.css` — gold accent `#c9a84c`, background `#020406`.

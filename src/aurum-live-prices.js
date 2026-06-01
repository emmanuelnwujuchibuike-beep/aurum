/**
 * aurum-live-prices.js
 * ─────────────────────────────────────────────────────
 * Drop this script into dashboard.html, invest.html, and
 * any other page that needs live market prices.
 *
 * Usage:
 *   <script src="aurum-live-prices.js"></script>
 *
 * The module:
 *  1. Calls the Supabase `get-market-prices` Edge Function
 *  2. Writes prices into localStorage under `aurum_price_overrides`
 *  3. Dispatches a `storage` event so all open tabs sync instantly
 *  4. Exposes `AurumPrices.get(symbol)` and `AurumPrices.onUpdate(cb)`
 *  5. Auto-polls every POLL_INTERVAL_MS (default 30 s)
 */

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  const SUPABASE_URL = "https://ttwwthfeordsojmcjwxn.supabase.co";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || ""; // set globally before this script
  const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/get-market-prices`;
  const LS_KEY = "aurum_live_prices";
  const POLL_INTERVAL_MS = 30_000; // 30 seconds

  // Default symbols to fetch — extend as needed
  const DEFAULT_SYMBOLS = [
    "BTC", "ETH", "BNB", "SOL", "XRP",
    "ADA", "DOGE", "AVAX", "LINK", "LTC",
    "AAPL", "TSLA", "NVDA", "GOOGL", "MSFT",
    "XAUUSD",
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  let _prices = {};          // { BTC: { price, changePct24h, ... }, ... }
  let _listeners = [];       // onUpdate callbacks
  let _pollTimer = null;
  let _symbols = [...DEFAULT_SYMBOLS];

  // ── LocalStorage helpers ──────────────────────────────────────────────────

  function readLS() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeLS(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      // Dispatch storage event so other tabs pick it up immediately
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: LS_KEY,
          newValue: JSON.stringify(data),
          storageArea: localStorage,
        })
      );
    } catch (e) {
      console.warn("[AurumPrices] localStorage write failed:", e);
    }
  }

  // ── Fetch from Edge Function ──────────────────────────────────────────────

  async function fetchPrices(symbols) {
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    };

    // Include JWT if user is logged in
    const session = (() => {
      try {
        const raw = localStorage.getItem(
          `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`
        );
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(
      `${EDGE_FN_URL}?symbols=${symbols.join(",")}`,
      { method: "GET", headers }
    );

    if (!res.ok) {
      throw new Error(`Edge Function responded ${res.status}`);
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Unknown error");
    return json.data; // PriceResult[]
  }

  // ── Process & store prices ────────────────────────────────────────────────

  function processPrices(rawList) {
    const existing = readLS();
    const updated = { ...existing };

    for (const item of rawList) {
      const sym = item.symbol.toUpperCase();
      updated[sym] = {
        price: item.price,
        change24h: item.change24h,
        changePct24h: item.changePct24h,
        high24h: item.high24h,
        low24h: item.low24h,
        volume24h: item.volume24h,
        marketCap: item.marketCap,
        lastUpdated: item.lastUpdated,
        source: item.source,
      };
      _prices[sym] = updated[sym];
    }

    writeLS(updated);

    // Notify listeners
    for (const cb of _listeners) {
      try {
        cb({ ..._prices });
      } catch (e) {
        console.error("[AurumPrices] listener error:", e);
      }
    }

    console.log(
      `[AurumPrices] Updated ${rawList.length} prices at`,
      new Date().toLocaleTimeString()
    );
  }

  // ── Poll loop ─────────────────────────────────────────────────────────────

  async function poll() {
    try {
      const rawList = await fetchPrices(_symbols);
      processPrices(rawList);
    } catch (err) {
      console.warn("[AurumPrices] Fetch failed:", err.message);
    }
  }

  function startPolling() {
    poll(); // immediate first fetch
    _pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  // ── Cross-tab sync via storage event ─────────────────────────────────────

  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY) return;
    try {
      const fresh = JSON.parse(e.newValue || "{}");
      _prices = { ..._prices, ...fresh };
      for (const cb of _listeners) {
        try { cb({ ..._prices }); } catch (_) {}
      }
    } catch {}
  });

  // ── Public API ────────────────────────────────────────────────────────────

  window.AurumPrices = {
    /**
     * Get the latest price object for a symbol.
     * Returns null if not yet loaded.
     * @param {string} symbol - e.g. "BTC", "AAPL"
     */
    get(symbol) {
      return _prices[symbol.toUpperCase()] ?? readLS()[symbol.toUpperCase()] ?? null;
    },

    /**
     * Get just the numeric price for a symbol.
     * @param {string} symbol
     */
    price(symbol) {
      return this.get(symbol)?.price ?? null;
    },

    /**
     * Register a callback that fires whenever prices update.
     * Callback receives the full prices object: { BTC: {...}, ETH: {...}, ... }
     * @param {function} callback
     */
    onUpdate(callback) {
      _listeners.push(callback);
      // Fire immediately with current state if available
      if (Object.keys(_prices).length > 0) {
        try { callback({ ..._prices }); } catch (_) {}
      }
    },

    /**
     * Remove an onUpdate listener.
     * @param {function} callback
     */
    offUpdate(callback) {
      _listeners = _listeners.filter((cb) => cb !== callback);
    },

    /**
     * Add extra symbols to the watch list.
     * @param {string[]} symbols
     */
    watch(symbols) {
      const toAdd = symbols.map((s) => s.toUpperCase()).filter((s) => !_symbols.includes(s));
      _symbols.push(...toAdd);
    },

    /**
     * Force an immediate refresh (bypasses poll interval).
     */
    async refresh() {
      await poll();
    },

    /** Stop live polling (e.g. when user leaves the page). */
    stop: stopPolling,

    /** Resume polling if stopped. */
    start: startPolling,

    /** Current symbols being watched. */
    get symbols() { return [..._symbols]; },
  };

  // ── Boot ──────────────────────────────────────────────────────────────────

  // Load whatever's in localStorage immediately (instant display)
  _prices = readLS();

  // Start live polling once the page is loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPolling);
  } else {
    startPolling();
  }

  // Pause polling when tab is hidden, resume when visible (saves API quota)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });
})();
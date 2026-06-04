
(function () {
  'use strict';

  /* ── Version — bump this if the browser serves stale cache ──────────────
     Check in console: window.AurumPrices.version  */
  var VERSION = '3.1-edge';
  console.info('[aurum-sync] v' + VERSION + ' loading');

  /* ── Edge Function endpoint (handles crypto, stocks, commodities) ─────── */
  const EDGE_URL = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/get-market-prices';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';

  /* Edge function uses different symbol names for commodities */
  const EDGE_TO_FRONT = { XAUUSD: 'GOLD', USOIL: 'OIL', XAGUSD: 'SILVER' };

  /* All symbols requested — using edge function naming for commodities.
     USOIL maps to BRENT/USD (WTI/USD is not available on Twelve Data Basic plan).
     Non-crypto batch kept at 8 to stay within the free-tier per-request limit. */
  const REQUEST_SYMS = [
    'BTC','ETH','SOL','BNB','XRP','ADA','LTC',
    'TSLA','AAPL','NVDA','MSFT','AMZN','GOOGL',
    'XAUUSD','USOIL','XAGUSD',
  ].join(',');

  /* Hard-coded fallback seed prices — overridden within seconds by live edge function fetch */
  const FALLBACK_PRICES = {
    BTC: 94000, ETH: 3500,  SOL: 245,   BNB: 680,   XRP: 0.62,
    ADA: 0.52,  USDT: 1,    LTC: 105,
    TSLA: 350,  AAPL: 205,  NVDA: 1080, MSFT: 440,  AMZN: 220,
    GOOGL: 182,
    GOLD: 3200, OIL: 70, SILVER: 32,
  };

  /* Internal state */
  const _prices    = {};
  const _changes   = {};
  const _callbacks = [];
  let _pendingBroadcasts = [];
  let _domReady = false;

  /* ── Inject CSS once ─────────────────────────────────────────────────── */
  (function injectStyles() {
    if (document.getElementById('aurum-sync-styles')) return;
    const s = document.createElement('style');
    s.id = 'aurum-sync-styles';
    s.textContent = [
      '@keyframes ticker-scroll { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }',
      '.ticker-track { display:flex; width:max-content; animation:ticker-scroll 60s linear infinite; }',
      '.ticker-track:hover { animation-play-state:paused; }',
      '@keyframes price-flash-up { 0% { color:#22c55e; text-shadow:0 0 8px rgba(34,197,94,.6); } 70% { color:#22c55e; text-shadow:none; } 100% { color:#8c9db5; text-shadow:none; } }',
      '@keyframes price-flash-down { 0% { color:#ef4444; text-shadow:0 0 8px rgba(239,68,68,.6); } 70% { color:#ef4444; text-shadow:none; } 100% { color:#8c9db5; text-shadow:none; } }',
      '.price-up   { animation:price-flash-up   1.4s ease forwards; }',
      '.price-down { animation:price-flash-down 1.4s ease forwards; }',
      '@keyframes tick-flash-up   { 0%{ opacity:1; color:#22c55e } 100%{ opacity:1; color:#edf2f8 } }',
      '@keyframes tick-flash-down { 0%{ opacity:1; color:#ef4444 } 100%{ opacity:1; color:#edf2f8 } }',
      '.tick-up   { animation:tick-flash-up   1s ease forwards; }',
      '.tick-down { animation:tick-flash-down 1s ease forwards; }',
    ].join('\n');
    const target = document.head || document.documentElement;
    if (target) target.appendChild(s);
    else document.addEventListener('DOMContentLoaded', function () { document.head.appendChild(s); });
  })();

  /* ── Stub onPriceUpdate synchronously ──────────────────────────────────── */
  if (typeof window.onPriceUpdate !== 'function') {
    window.onPriceUpdate = function (sym, price, chg) {
      _pendingBroadcasts.push({ sym, price, chg });
    };
    window.onPriceUpdate._isStub = true;
  }

  /* ── Queue drain ─────────────────────────────────────────────────────────*/
  function drainQueue() {
    if (!_domReady) return;
    if (window.onPriceUpdate && window.onPriceUpdate._isStub) return;
    if (!_pendingBroadcasts.length) return;
    const queue = _pendingBroadcasts.splice(0);
    queue.forEach(function (item) {
      try { window.onPriceUpdate(item.sym, item.price, item.chg); } catch (e) {}
    });
  }
  window._aurumDrainPriceQueue = drainQueue;

  /* ── Load from localStorage cache ──────────────────────────────────────── */
  function loadCache() {
    try {
      const overrides = JSON.parse(localStorage.getItem('aurum_price_overrides') || '{}');
      const live      = JSON.parse(localStorage.getItem('aurum_price_cache')     || '{}');
      const merged    = {};
      new Set([
        ...Object.keys(overrides),
        ...Object.keys(live),
        ...Object.keys(FALLBACK_PRICES),
      ]).forEach(function (sym) {
        const ov = overrides[sym], lv = live[sym];
        merged[sym] = {
          price:        (ov && ov.price > 0)           ? ov.price        :
                        (lv && lv.price > 0)           ? lv.price        :
                        (FALLBACK_PRICES[sym] || 0),
          changePct24h: (ov && ov.chg  != null)        ? ov.chg          :
                        (lv && lv.changePct24h != null) ? lv.changePct24h : 0,
        };
      });
      return merged;
    } catch (e) { return null; }
  }

  const cache = loadCache();
  Object.keys(FALLBACK_PRICES).forEach(function (sym) {
    const c     = cache && cache[sym];
    _prices[sym]  = (c && c.price > 0)           ? c.price        : FALLBACK_PRICES[sym];
    _changes[sym] = (c && c.changePct24h != null) ? c.changePct24h : 0;
  });

  /* ── Broadcast one symbol ───────────────────────────────────────────────── */
  function broadcast(sym, price, chg) {
    if (!price || price <= 0) return;
    _prices[sym]  = price;
    _changes[sym] = (chg != null) ? chg : (_changes[sym] || 0);
    try { window.onPriceUpdate(sym, price, _changes[sym]); } catch (e) {}
  }

  /* ── Persist to localStorage ─────────────────────────────────────────────*/
  function writeCache() {
    try {
      const payload = {};
      Object.keys(_prices).forEach(function (sym) {
        payload[sym] = { price: _prices[sym], changePct24h: _changes[sym] || 0 };
      });
      localStorage.setItem('aurum_price_cache', JSON.stringify(payload));
      localStorage.setItem('aurum_live_prices', JSON.stringify(payload));
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'aurum_live_prices', newValue: JSON.stringify(payload),
        }));
      } catch (e) {}
    } catch (e) {}
  }

  /* ── Fetch all prices from the Supabase Edge Function ──────────────────── */
  async function fetchAllPrices() {
    try {
      const resp = await fetch(`${EDGE_URL}?symbols=${REQUEST_SYMS}`, {
        headers: {
          'Accept':        'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey':        ANON_KEY,
        },
        cache: 'no-store',
      });

      if (!resp.ok) {
        console.warn('[aurum-sync] HTTP', resp.status, '— keeping cached prices');
        writeCache();
        notifyBatchCallbacks();
        return;
      }

      const json = await resp.json();
      if (!json.success || !Array.isArray(json.data)) {
        console.warn('[aurum-sync] Unexpected response format');
        writeCache();
        notifyBatchCallbacks();
        return;
      }

      let fetched = 0;
      json.data.forEach(function (item) {
        if (!item.symbol || !(item.price > 0)) return;
        const frontSym = EDGE_TO_FRONT[item.symbol] || item.symbol;
        const chg = item.changePct24h != null ? +item.changePct24h.toFixed(2) : 0;
        broadcast(frontSym, item.price, chg);
        fetched++;
      });

      broadcast('USDT', 1, 0);

      writeCache();
      notifyBatchCallbacks();
      console.info('[aurum-sync] ✓', fetched, 'prices @', new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('[aurum-sync] fetch error:', err.message);
      writeCache();
      notifyBatchCallbacks();
    }
  }

  /* ── Batch callback notifications ──────────────────────────────────────── */
  function notifyBatchCallbacks() {
    if (!_callbacks.length) return;
    const snapshot = {};
    Object.keys(_prices).forEach(function (sym) {
      snapshot[sym] = { price: _prices[sym], changePct24h: _changes[sym] || 0 };
    });
    _callbacks.forEach(function (cb) { try { cb(snapshot); } catch (e) {} });
  }

  /* ── Patch ticker DOM class ─────────────────────────────────────────────── */
  function patchTickerDOM() {
    const ticker = document.getElementById('liveTicker');
    if (!ticker) return;
    const inner  = ticker.firstElementChild;
    const target = (inner && inner.tagName !== 'DIV') ? ticker : (inner || ticker);
    if (!target.classList.contains('ticker-track')) target.classList.add('ticker-track');
  }

  /* ── Boot ───────────────────────────────────────────────────────────────── */
  function onDomReady() {
    _domReady = true;
    patchTickerDOM();
    /* Immediately populate DOM with cached/fallback prices */
    Object.keys(_prices).forEach(function (sym) { broadcast(sym, _prices[sym], _changes[sym]); });
    drainQueue();
    /* Fire batch callbacks with cached data so invest.html / AurumPrices.onUpdate pages
       get immediate prices without waiting for the edge function round-trip */
    notifyBatchCallbacks();
    /* Start live polling */
    fetchAllPrices();
    setInterval(fetchAllPrices, 15_000);   /* 15 s — stays under Twelve Data 8 req/min limit */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(onDomReady, 0); });
  } else {
    setTimeout(onDomReady, 0);
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  window.AurumPrices = {
    version:   VERSION,
    onUpdate:  function (cb) { if (typeof cb === 'function') _callbacks.push(cb); },
    getPrice:  function (sym) { return _prices[sym]  || null; },
    getChange: function (sym) { return _changes[sym] || 0; },
    refresh:   fetchAllPrices,
  };
  window.CoinGeckoSync = window.AurumPrices;

})();

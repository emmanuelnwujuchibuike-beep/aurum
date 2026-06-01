

(function () {
  'use strict';

  /* ── CoinGecko ID mapping ─────────────────────────────────────────────── */
  const CG_IDS = {
    BTC:  'bitcoin',
    ETH:  'ethereum',
    SOL:  'solana',
    BNB:  'binancecoin',
    XRP:  'ripple',
    ADA:  'cardano',
    USDT: 'tether',
    LTC:  'litecoin',
  };

  /* ── Symbols handled by stock-jitter (no CoinGecko support) ──────────── */
  const STOCK_SYMS = ['TSLA', 'AAPL', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'GOLD'];

  /* ── Hard-coded fallback seed prices ─────────────────────────────────── */
  const FALLBACK_PRICES = {
    BTC: 67430, ETH: 3280,  SOL: 188,   BNB: 612,   XRP: 0.72,
    ADA: 0.48,  USDT: 1,    LTC: 85,
    TSLA: 248.5, AAPL: 189.3, NVDA: 875.2, MSFT: 412.7, AMZN: 195.5,
    GOOGL: 178.3, GOLD: 2350,
  };

  /* ── Internal state ───────────────────────────────────────────────────── */
  const _prices    = {};
  const _changes   = {};
  const _callbacks = [];
  let _pendingBroadcasts = [];
  let _domReady    = false;
  /* Track which syms got a real CoinGecko price this cycle (skip jitter) */
  let _cgFetchedThisCycle = {};

  /* ── Inject CSS once ─────────────────────────────────────────────────── */
  /* Ticker marquee scroll + per-cell price-flash animations.
     Injected synchronously so they exist before any DOM is built.          */
  (function injectStyles() {
    if (document.getElementById('aurum-sync-styles')) return;
    const s = document.createElement('style');
    s.id = 'aurum-sync-styles';
    s.textContent = [
      /* Ticker marquee — dashboard.js renders #liveTicker with two copies   */
      /* The inner ul/div just needs display:flex and this animation class   */
      '@keyframes ticker-scroll {',
      '  0%   { transform: translateX(0); }',
      '  100% { transform: translateX(-50%); }',
      '}',
      '.ticker-track {',
      '  display: flex;',
      '  width: max-content;',
      '  animation: ticker-scroll 60s linear infinite;',
      '}',
      '.ticker-track:hover { animation-play-state: paused; }',

      /* Grid cell price flash — up/down colour burst then back to muted     */
      '@keyframes price-flash-up {',
      '  0%   { color: #22c55e; text-shadow: 0 0 8px rgba(34,197,94,.6); }',
      '  70%  { color: #22c55e; text-shadow: none; }',
      '  100% { color: #8c9db5; text-shadow: none; }',
      '}',
      '@keyframes price-flash-down {',
      '  0%   { color: #ef4444; text-shadow: 0 0 8px rgba(239,68,68,.6); }',
      '  70%  { color: #ef4444; text-shadow: none; }',
      '  100% { color: #8c9db5; text-shadow: none; }',
      '}',
      '.price-up   { animation: price-flash-up   1.4s ease forwards; }',
      '.price-down { animation: price-flash-down 1.4s ease forwards; }',

      /* Ticker item individual flash */
      '@keyframes tick-flash-up   { 0%{ opacity:1; color:#22c55e } 100%{ opacity:1; color:#edf2f8 } }',
      '@keyframes tick-flash-down { 0%{ opacity:1; color:#ef4444 } 100%{ opacity:1; color:#edf2f8 } }',
      '.tick-up   { animation: tick-flash-up   1s ease forwards; }',
      '.tick-down { animation: tick-flash-down 1s ease forwards; }',
    ].join('\n');
    /* Prefer to append to <head> if it exists; otherwise document.body later */
    const target = document.head || document.documentElement;
    if (target) target.appendChild(s);
    else document.addEventListener('DOMContentLoaded', function() { document.head.appendChild(s); });
  })();

  /* ── STEP 1: Stub window.onPriceUpdate synchronously ─────────────────── */
  if (typeof window.onPriceUpdate !== 'function') {
    window.onPriceUpdate = function (sym, price, chg) {
      _pendingBroadcasts.push({ sym, price, chg });
    };
    window.onPriceUpdate._isStub = true;
  }

  /* ── STEP 2: Queue drain helper ───────────────────────────────────────── */
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

  /* ── STEP 3: Load cache synchronously ────────────────────────────────── */
  function loadCache() {
    try {
      const overrides = JSON.parse(localStorage.getItem('aurum_price_overrides') || '{}');
      const live      = JSON.parse(localStorage.getItem('aurum_price_cache')     || '{}');
      const merged    = {};
      const allSyms   = new Set([
        ...Object.keys(overrides),
        ...Object.keys(live),
        ...Object.keys(FALLBACK_PRICES),
      ]);
      allSyms.forEach(function (sym) {
        const ov = overrides[sym];
        const lv = live[sym];
        merged[sym] = {
          price:        (ov && ov.price > 0)           ? ov.price        :
                        (lv && lv.price > 0)           ? lv.price        :
                        (FALLBACK_PRICES[sym] || 0),
          changePct24h: (ov && ov.chg  != null)        ? ov.chg          :
                        (lv && lv.changePct24h != null) ? lv.changePct24h : 0,
        };
      });
      return merged;
    } catch (e) {
      return null;
    }
  }

  const cache = loadCache();
  Object.keys(FALLBACK_PRICES).forEach(function (sym) {
    const c      = cache && cache[sym];
    _prices[sym]  = (c && c.price > 0)              ? c.price        : FALLBACK_PRICES[sym];
    _changes[sym] = (c && c.changePct24h != null)    ? c.changePct24h : 0;
  });

  /* ── STEP 4: Broadcast helper ─────────────────────────────────────────── */
  function broadcast(sym, price, chg) {
    if (!price || price <= 0) return;
    _prices[sym]  = price;
    _changes[sym] = (chg != null) ? chg : (_changes[sym] || 0);
    try {
      window.onPriceUpdate(sym, price, _changes[sym]);
    } catch (e) {}
  }

  /* ── STEP 5: Persist to localStorage ─────────────────────────────────── */
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
          key:      'aurum_live_prices',
          newValue: JSON.stringify(payload),
        }));
      } catch (e) {}
    } catch (e) {}
  }

  /* ── STEP 6: CoinGecko fetch ──────────────────────────────────────────── */
  const CG_IDS_LIST = Object.values(CG_IDS).join(',');
  const CG_URL =
    'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=' + CG_IDS_LIST +
    '&vs_currencies=usd' +
    '&include_24hr_change=true';

  const ID_TO_SYM = {};
  Object.entries(CG_IDS).forEach(function (e) { ID_TO_SYM[e[1]] = e[0]; });

  async function fetchCoinGecko() {
    _cgFetchedThisCycle = {};
    try {
      const resp = await fetch(CG_URL, {
        headers: { 'Accept': 'application/json' },
        cache:   'no-store',
      });

      if (!resp.ok) {
        console.warn('[coingecko-sync] HTTP', resp.status, '— using cached prices');
        jitterStocks();
        writeCache();
        notifyBatchCallbacks();
        return;
      }

      const data    = await resp.json();
      let   fetched = 0;

      Object.entries(data).forEach(function (entry) {
        const coinId = entry[0];
        const info   = entry[1];
        const sym    = ID_TO_SYM[coinId];
        if (!sym) return;

        const price = info['usd'];
        const chg   = info['usd_24h_change'];

        if (price && price > 0) {
          _cgFetchedThisCycle[sym] = true;
          broadcast(sym, price, chg != null ? +chg.toFixed(2) : 0);
          fetched++;
        }
      });

      jitterStocks();
      writeCache();
      notifyBatchCallbacks();

      console.info(
        '[coingecko-sync] ✓', fetched, 'coins @', new Date().toLocaleTimeString()
      );
    } catch (err) {
      console.warn('[coingecko-sync] fetch error:', err.message);
      jitterStocks();
      writeCache();
      notifyBatchCallbacks();
    }
  }

  /* ── STEP 7: Stock micro-jitter ───────────────────────────────────────── */
  /* Also called on a 3-second independent interval so stocks visually tick
     between the 30-second CoinGecko poll cycles.                           */
  function jitterStocks() {
    STOCK_SYMS.forEach(function (sym) {
      /* Skip if CoinGecko already sent a live price this cycle */
      if (_cgFetchedThisCycle[sym]) return;

      const cur  = _prices[sym]  || FALLBACK_PRICES[sym] || 100;
      const seed = FALLBACK_PRICES[sym] || cur;

      /* Mean-reversion walk: pull gently toward seed + random micro-noise */
      const pull = (seed - cur) / seed * 0.12;
      const rand = (Math.random() - 0.5) * 0.0010;
      const next = +(cur * (1 + rand + pull)).toFixed(cur >= 100 ? 2 : 4);

      const syntheticChg = +((next - seed) / seed * 100).toFixed(2);
      broadcast(sym, next, syntheticChg);
    });
  }

  /* ── STEP 8: Notify AurumPrices.onUpdate batch subscribers ─────────── */
  function notifyBatchCallbacks() {
    if (!_callbacks.length) return;
    const snapshot = {};
    Object.keys(_prices).forEach(function (sym) {
      snapshot[sym] = { price: _prices[sym], changePct24h: _changes[sym] || 0 };
    });
    _callbacks.forEach(function (cb) {
      try { cb(snapshot); } catch (e) {}
    });
  }

  /* ── STEP 9: Ensure ticker track has the scroll class ────────────────── */
  /* dashboard.js renders #liveTicker but does NOT add the .ticker-track
     class. We patch it here after DOMContentLoaded so the CSS animation
     applies without touching dashboard.js.                                 */
  function patchTickerDOM() {
    const ticker = document.getElementById('liveTicker');
    if (!ticker) return;
    /* If dashboard.js wraps items in a child div, add class there;
       otherwise add it directly to #liveTicker itself.                     */
    const inner = ticker.firstElementChild;
    const target = (inner && inner.tagName !== 'DIV') ? ticker : (inner || ticker);
    if (!target.classList.contains('ticker-track')) {
      target.classList.add('ticker-track');
    }
  }

  /* ── STEP 10: Boot sequence ───────────────────────────────────────────── */
  function onDomReady() {
    _domReady = true;

    /* Patch ticker animation class */
    patchTickerDOM();

    /* Re-broadcast cached seeds now that DOM elements exist */
    Object.keys(_prices).forEach(function (sym) {
      broadcast(sym, _prices[sym], _changes[sym]);
    });

    /* Drain any pre-DOM queued broadcasts */
    drainQueue();

    /* Start live data */
    fetchCoinGecko();
    setInterval(fetchCoinGecko, 30_000);

    /* Independent stock jitter every 3 s so stocks tick visually          */
    setInterval(function () {
      _cgFetchedThisCycle = {};   /* allow jitter between CG cycles */
      jitterStocks();
      writeCache();
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      /* setTimeout(0) ensures dashboard.js DOMContentLoaded finishes first */
      setTimeout(onDomReady, 0);
    });
  } else {
    setTimeout(onDomReady, 0);
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  window.AurumPrices = {
    onUpdate:  function (cb) { if (typeof cb === 'function') _callbacks.push(cb); },
    getPrice:  function (sym) { return _prices[sym]  || null; },
    getChange: function (sym) { return _changes[sym] || 0;    },
    refresh:   fetchCoinGecko,
  };

  window.CoinGeckoSync = window.AurumPrices;

})();

/* Aurum Capital — the one shared, deferred script.
   Pages are fully usable without it; it only adds:
   1. hover/touch prefetch where Speculation Rules aren't supported
   2. one delegated click listener for same-page toggles
   3. live prices, fetched after `load` when the browser is idle
   4. page scripts declared with data-lazy-script, loaded after `load` */
(function () {
  'use strict';

  /* 1. Prefetch fallback --------------------------------------------------- */
  var spec = HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules');
  if (!spec) {
    var seen = {};
    var prefetch = function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.origin !== location.origin || a.target || seen[a.pathname]) return;
      if (a.pathname === location.pathname) return;
      seen[a.pathname] = 1;
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = a.pathname;
      document.head.appendChild(l);
    };
    document.addEventListener('touchstart', prefetch, { passive: true });
    document.addEventListener('mouseover', prefetch);
  }

  /* 2. Delegated toggles ------------------------------------------------------
     [data-group] holds mutually exclusive buttons (aria-pressed);
     a button with data-filter="x" shows only [data-k="x"] items in its target;
     .sw is a toggle switch. */
  document.addEventListener('click', function (e) {
    var sw = e.target.closest('.sw');
    if (sw) {
      sw.setAttribute('aria-pressed', sw.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      return;
    }
    var b = e.target.closest('[data-group] > button');
    if (!b) return;
    var group = b.parentNode;
    group.querySelectorAll(':scope > button').forEach(function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    var f = b.getAttribute('data-filter');
    var list = f && document.getElementById(group.getAttribute('data-target'));
    if (list) {
      var shown = 0;
      list.querySelectorAll('[data-k]').forEach(function (el) {
        var on = f === 'all' || el.getAttribute('data-k') === f;
        el.hidden = !on;
        if (on) shown++;
      });
      var empty = list.querySelector('[data-empty]');
      if (empty) empty.hidden = shown > 0;
    }
    document.dispatchEvent(new CustomEvent('aurum:toggle', { detail: { group: group, button: b } }));
  });

  /* 3. Live prices ------------------------------------------------------------
     Markup: data-price="SYM", data-chg="SYM", data-cap="SYM", data-high/low/vol/open="SYM".
     Placeholders ("—") stay if the API fails. */
  var API = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
  var FN = API + 'get-market-prices';
  // Shared with lazily loaded page scripts (e.g. aurum-chart.js)
  window.Aurum = { api: API, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } };

  var usd = function (n) {
    var d = n >= 1000 ? 2 : n >= 1 ? 2 : 4;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  var big = function (n) {
    if (!n) return '—';
    var u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < u.length; i++) if (n >= u[i][0]) return '$' + (n / u[i][0]).toFixed(2) + u[i][1];
    return usd(n);
  };
  var set = function (attr, sym, text) {
    document.querySelectorAll('[' + attr + '="' + sym + '"]').forEach(function (el) { el.textContent = text; });
  };

  function paint(rows) {
    window.Aurum.last = rows;
    rows.forEach(function (r) {
      if (!r || !(r.price > 0)) return;
      var s = r.symbol;
      set('data-price', s, usd(r.price));
      if (r.marketCap) set('data-cap', s, big(r.marketCap));
      if (r.high24h) set('data-high', s, usd(r.high24h));
      if (r.low24h) set('data-low', s, usd(r.low24h));
      if (r.volume24h) set('data-vol', s, big(r.volume24h));
      if (r.change24h != null) set('data-open', s, usd(r.price - r.change24h));
      var p = Number(r.changePct24h);
      if (isNaN(p)) return;
      document.querySelectorAll('[data-chg="' + s + '"]').forEach(function (el) {
        el.textContent = (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(2) + '%';
        el.classList.remove('up', 'down', 'flat');
        el.classList.add(p > 0 ? 'up' : p < 0 ? 'down' : 'flat');
      });
    });
    document.dispatchEvent(new CustomEvent('aurum:prices', { detail: rows }));
  }
  window.Aurum.repaint = function () {
    if (window.Aurum.last) paint(window.Aurum.last);
  };

  function load() {
    var syms = {};
    document.querySelectorAll('[data-price],[data-chg]').forEach(function (el) {
      syms[el.getAttribute('data-price') || el.getAttribute('data-chg')] = 1;
    });
    var list = Object.keys(syms);
    if (!list.length || document.visibilityState === 'hidden') return;
    fetch(FN + '?symbols=' + list.join(','), { headers: window.Aurum.headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.data) paint(j.data); })
      .catch(function () {});
  }

  function start() {
    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 200); };
    idle(load, { timeout: 2500 });
    // Page-specific extras (charts etc.) declared as <div data-lazy-script="file.js">
    idle(function () {
      document.querySelectorAll('[data-lazy-script]').forEach(function (el) {
        var s = document.createElement('script');
        s.src = el.getAttribute('data-lazy-script');
        s.async = true;
        document.body.appendChild(s);
      });
    }, { timeout: 3000 });
    setInterval(load, 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') load(); });
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();

/* Aurum Capital — the one shared, deferred script.
   Pages are fully usable without it; it only adds:
   1. hover/touch prefetch where Speculation Rules aren't supported
   2. one delegated click listener for same-page toggles
   3. live prices, fetched after `load` when the browser is idle
   4. page scripts declared with data-lazy-script, loaded after `load`
   5. overlays (menu / sheet), hide balances and the theme switch */
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
  /* Overlays (full-screen menu, quick-action sheet, dropdowns):
     [data-open="id"] shows #id, [data-close="id"] or Escape hides it. */
  var root = document.documentElement;
  function setOverlay(el, open) {
    el.hidden = !open;
    root.classList.toggle('menu-open', !!document.querySelector('.menu:not([hidden]),.overlay:not([hidden])'));
    if (open) { var f = el.querySelector('[data-close],a,button'); if (f) f.focus({ preventScroll: true }); }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.menu:not([hidden]),.overlay:not([hidden])').forEach(function (o) { setOverlay(o, false); });
  });

  /* Hide balances — same key and values the site has always used.
     Elements with [data-money] show "••••" while hidden; Aurum.money() keeps
     the real text in data-value so it can be restored. */
  var HIDE_KEY = 'aurum_balance_hidden';
  function isHidden() { try { return localStorage.getItem(HIDE_KEY) === 'true'; } catch (e) { return false; } }
  function applyHidden() {
    var h = isHidden();
    root.toggleAttribute('data-hide', h);
    document.querySelectorAll('[data-money]').forEach(function (m) {
      if (m.dataset.value == null) m.dataset.value = m.textContent;
      m.textContent = h ? '••••' : m.dataset.value;
    });
    document.querySelectorAll('[data-hide-balances]').forEach(function (b) { b.setAttribute('aria-pressed', h ? 'true' : 'false'); });
  }

  /* Theme — key 'aurum_theme' holds 'light' | 'dark'; System removes it so the
     phone's setting applies (exactly how existing pages already behave). */
  function setTheme(v) {
    try { if (v === 'system') localStorage.removeItem('aurum_theme'); else localStorage.setItem('aurum_theme', v); } catch (e) {}
    root.dataset.theme = v === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : v;
  }
  // While on System, follow the phone if it switches light/dark
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (currentTheme() === 'system') setTheme('system'); });
  function currentTheme() { try { return localStorage.getItem('aurum_theme') || 'system'; } catch (e) { return 'system'; } }

  document.addEventListener('click', function (e) {
    var op = e.target.closest('[data-open]');
    if (op) { var o = document.getElementById(op.getAttribute('data-open')); if (o) { e.preventDefault(); setOverlay(o, true); } return; }
    var cl = e.target.closest('[data-close]');
    if (cl) { var c = document.getElementById(cl.getAttribute('data-close')); if (c) { e.preventDefault(); setOverlay(c, false); } return; }
    if (e.target.closest('[data-hide-balances]')) {
      try { localStorage.setItem(HIDE_KEY, isHidden() ? 'false' : 'true'); } catch (err) {}
      applyHidden();
      return;
    }
    var th = e.target.closest('[data-theme-value]');
    if (th) {
      setTheme(th.getAttribute('data-theme-value'));
      th.parentNode.querySelectorAll('[data-theme-value]').forEach(function (x) { x.setAttribute('aria-pressed', x === th ? 'true' : 'false'); });
      return;
    }
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

  /* Navigation feedback: pages are normally prerendered and open instantly. If the
     next page isn't ready within 150 ms (slow network), keep the header and show a
     skeleton in place of the content until it arrives. */
  var navT;
  document.addEventListener('click', function (e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin || a.pathname === location.pathname) return;
    clearTimeout(navT);
    navT = setTimeout(function () { if (!e.defaultPrevented) root.classList.add('navigating'); }, 150);
  });
  window.addEventListener('pageshow', function () { clearTimeout(navT); root.classList.remove('navigating'); });

  /* 3. Live prices ------------------------------------------------------------
     Markup: data-price="SYM", data-chg="SYM", data-cap="SYM", data-high/low/vol/open="SYM".
     Placeholders ("—") stay if the API fails. */
  var API = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
  var FN = API + 'get-market-prices';
  // Shared with lazily loaded page scripts (e.g. aurum-chart.js)
  window.Aurum = { api: API, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } };
  /** Set a money figure; respects "hide balances". */
  window.Aurum.money = function (el, text) {
    if (!el) return;
    el.dataset.value = text;
    el.textContent = isHidden() ? '••••' : text;
  };
  window.Aurum.applyHidden = applyHidden;

  /* Demo / live switch (site_settings.payments_live, set by an admin).
     The head script paints the last known state before first paint; this refreshes it.
     Demo is the safe default if the setting can't be read. */
  window.Aurum.live = root.hasAttribute('data-live');
  fetch(API.replace('/functions/v1/', '/rest/v1/') + 'site_settings?key=eq.payments_live&select=value', { headers: window.Aurum.headers })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (!rows) return;
      var on = !!rows[0] && (rows[0].value === true || rows[0].value === 'true');
      try { localStorage.setItem('aurum_live', on ? '1' : '0'); } catch (e) {}
      root.toggleAttribute('data-live', on);
      window.Aurum.live = on;
      document.dispatchEvent(new CustomEvent('aurum:mode', { detail: { live: on } }));
    }).catch(function () {});
  window.Aurum.applyHidden = applyHidden;
  window.Aurum.theme = currentTheme;
  applyHidden();
  document.querySelectorAll('[data-theme-value]').forEach(function (x) {
    x.setAttribute('aria-pressed', x.getAttribute('data-theme-value') === currentTheme() ? 'true' : 'false');
  });

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
    (window.Aurum.extra || []).forEach(function (s) { syms[s] = 1; }); // symbols a page needs but does not display
    var list = Object.keys(syms);
    if (!list.length || document.visibilityState === 'hidden') return;
    fetch(FN + '?symbols=' + list.join(','), { headers: window.Aurum.headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.data) paint(j.data); })
      .catch(function () {});
  }

  window.Aurum.refresh = function () { load(); };

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

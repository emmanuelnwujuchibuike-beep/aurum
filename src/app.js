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

  /* iOS Safari: after switching away and back, the bottom nav can sit too high until the
     page is scrolled (fixed elements use a stale viewport). Nudge the layout so it
     re-settles: on return to the tab, on back-cache restore and on viewport resize. */
  function settleFixed(nudge) {
    var n = document.querySelector('.nav'); if (!n) return;
    n.style.transform = 'translateX(-50%) translateZ(0)';
    void n.offsetHeight;
    requestAnimationFrame(function () { n.style.transform = ''; });
    var y = window.scrollY;
    if (nudge && document.documentElement.scrollHeight > window.innerHeight + 2) { window.scrollTo(window.scrollX, y + 1); window.scrollTo(window.scrollX, y); }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    setTimeout(function () { settleFixed(true); }, 60); setTimeout(function () { settleFixed(true); }, 450);
  });
  window.addEventListener('pageshow', function () { setTimeout(function () { settleFixed(true); }, 60); });
  window.addEventListener('orientationchange', function () { setTimeout(function () { settleFixed(true); }, 300); });
  if (window.visualViewport) {
    var vvT; window.visualViewport.addEventListener('resize', function () { clearTimeout(vvT); vvT = setTimeout(function () { settleFixed(false); }, 120); });
  }

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
  var todo = {};
  function fillTodo() { document.querySelectorAll('[data-todo]').forEach(function (el) { var v = todo[el.getAttribute('data-todo')]; if (typeof v === 'string' && v.trim()) el.textContent = v.trim(); }); }
  // Same request also fills the regulator / licence placeholders in the risk disclosure
  fetch(API.replace('/functions/v1/', '/rest/v1/') + 'site_settings?key=in.(payments_live,regulator_name,licence_number)&select=key,value', { headers: window.Aurum.headers })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (!rows) return;
      var s = {}; rows.forEach(function (x) { s[x.key] = x.value; });
      var on = s.payments_live === true || s.payments_live === 'true';
      try { localStorage.setItem('aurum_live', on ? '1' : '0'); } catch (e) {}
      root.toggleAttribute('data-live', on);
      window.Aurum.live = on;
      document.dispatchEvent(new CustomEvent('aurum:mode', { detail: { live: on } }));
      todo = { regulator: s.regulator_name, licence: s.licence_number };
      fillTodo();
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
    try { localStorage.setItem('aurum_prices_v1', JSON.stringify({ at: Date.now(), rows: rows })); } catch (e) {}
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
      .then(function (j) { if (j && j.data) { window.Aurum.pricesLive = true; paint(j.data); } })
      .catch(function () {});
  }

  window.Aurum.refresh = function () { load(); };

  /* Chart data (get-ohlcv) cache: kept on the device, so a chart opens with its bars
     already there; refreshed in the background when older than its timeframe allows.
     Aurum.ohlcv(symbol, tf) → Promise<values, newest first>. */
  var OH_KEY = 'aurum_ohlcv_v1', OH_FRESH = { '5M': 60e3, '15M': 120e3, '30M': 120e3, '1H': 300e3, '4H': 600e3 }, ohMem = null, ohBusy = {}, ohSaveT;
  function ohStore() { if (!ohMem) { try { ohMem = JSON.parse(localStorage.getItem(OH_KEY) || '{}') || {}; } catch (e) { ohMem = {}; } } return ohMem; }
  function ohSave() {
    clearTimeout(ohSaveT);
    ohSaveT = setTimeout(function () {
      var s = ohStore(), keys = Object.keys(s).sort(function (a, b) { return s[b].at - s[a].at; });
      keys.slice(14).forEach(function (k) { delete s[k]; }); // keep the 14 most recent series
      try { localStorage.setItem(OH_KEY, JSON.stringify(s)); } catch (e) { ohMem = {}; try { localStorage.removeItem(OH_KEY); } catch (x) {} }
    }, 400);
  }
  function ohFetch(sym, tf) {
    var k = sym + '|' + tf;
    if (!ohBusy[k]) ohBusy[k] = fetch(API + 'get-ohlcv?symbol=' + encodeURIComponent(sym) + '&tf=' + tf, { headers: window.Aurum.headers })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success || !j.values || !j.values.length) throw new Error((j && j.error) || 'No chart data');
        var v = j.values.slice(0, 500).map(function (x) { return { datetime: x.datetime, open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume }; });
        ohStore()[k] = { at: Date.now(), v: v }; ohSave();
        return v;
      })
      .finally(function () { delete ohBusy[k]; });
    return ohBusy[k];
  }
  window.Aurum.ohlcv = function (sym, tf) {
    var hit = ohStore()[sym + '|' + tf], fresh = OH_FRESH[tf] || 18e5;
    if (hit && Date.now() - hit.at < fresh) return Promise.resolve(hit.v);
    var p = ohFetch(sym, tf);
    if (hit && Date.now() - hit.at < 2 * 864e5) { p.catch(function () {}); return Promise.resolve(hit.v); } // show stale bars, refresh behind
    return p;
  };
  // Warm the main charts on every page (idle, visible tab): the trade page's timeframe + daily
  function warmCharts() {
    if (document.visibilityState === 'hidden') return;
    var tf = '1D'; try { tf = (JSON.parse(localStorage.getItem('aurum_trade_view') || '{}').tf) || '1D'; } catch (e) {}
    var list = [], s = ohStore();
    ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'GOLD'].forEach(function (sym) { list.push([sym, tf]); if (tf !== '1D') list.push([sym, '1D']); });
    list.filter(function (x) { var h = s[x[0] + '|' + x[1]]; return !h || Date.now() - h.at > (OH_FRESH[x[1]] || 18e5); })
      .forEach(function (x, i) { setTimeout(function () { ohFetch(x[0], x[1]).catch(function () {}); }, 400 * i); });
  }
  window.Aurum.warmCharts = warmCharts;

  // Paint the last known prices straight away (under 10 minutes old), then fetch fresh ones
  try {
    var lastP = JSON.parse(localStorage.getItem('aurum_prices_v1') || 'null');
    if (lastP && Date.now() - lastP.at < 600000 && lastP.rows) {
      var paintCached = function () { paint(lastP.rows); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintCached, { once: true }); else paintCached();
    }
  } catch (e) {}

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
    setTimeout(warmCharts, 2500); setInterval(warmCharts, 120000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') load(); });
  }
  /* 6. In-app navigation (router) ---------------------------------------------
     Links between pages built on the shared shell swap the page in place: no
     browser reload, header and bottom nav stay, a skeleton shows under the header
     if the next page takes more than 150 ms. Old pages, the admin console (live
     sockets) and the landing page (signed-in redirect) still load normally.
     Each page's DOMContentLoaded code runs again on arrival; listeners and timers
     it added are removed when it is left (AurumScope, set up in <head>). */
  var Scope = window.AurumScope;
  var FULL = /\/(index|admin|signup|invest-classic|dashboard-classic|trade-classic|privacy-policy)\.html$|\/$/;
  var ONCE = /(^|\/)(app|aurum-session|money-client)\.js(\?|$)/; // shared scripts: loaded once, kept
  // Shared scripts already on this page; one a later page needs (e.g. money-client.js) loads once on arrival
  var loadedOnce = {};
  document.querySelectorAll('script[src]').forEach(function (s) { var m = s.getAttribute('src').match(ONCE); if (m) loadedOnce[m[2]] = 1; });
  var pages = {}; // url → Promise<html>
  function spaTarget(a) {
    if (!Scope || !document.getElementById('app-css')) return false;
    if (a.target || a.hasAttribute('download') || a.origin !== location.origin) return false;
    if (!/\.html$/.test(a.pathname) || FULL.test(a.pathname)) return false;
    return a.pathname !== location.pathname || a.search !== location.search;
  }
  function fetchPage(url) {
    url = url.split('#')[0];
    var hit = pages[url];
    if (hit && Date.now() - hit.at < 600000) return hit.p;
    var p = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.text();
    }).catch(function (e) { delete pages[url]; throw e; });
    pages[url] = { at: Date.now(), p: p };
    return p;
  }
  // Pre-load the pages one tap away (bottom nav, avatar → profile, menu, quick actions)
  function warmPages() {
    document.querySelectorAll('.nav a[href], a.who[href], .top a[href], .menu a[href], .sheet a[href], a.qa[href]').forEach(function (a) {
      if (spaTarget(a)) fetchPage(a.href).catch(function () {});
    });
  }
  // Warm the cache on touch / hover so most taps swap instantly
  function warm(e) { var a = e.target.closest && e.target.closest('a[href]'); if (a && spaTarget(a)) fetchPage(a.href).catch(function () {}); }
  document.addEventListener('touchstart', warm, { passive: true });
  document.addEventListener('mouseover', warm);

  function runScripts(list, i) {
    if (i >= list.length) return Promise.resolve();
    var old = list[i], s = document.createElement('script');
    for (var k = 0; k < old.attributes.length; k++) s.setAttribute(old.attributes[k].name, old.attributes[k].value);
    if (old.src) {
      return new Promise(function (res) { s.onload = s.onerror = res; s.removeAttribute('defer'); document.body.appendChild(s); })
        .then(function () { return runScripts(list, i + 1); });
    }
    s.textContent = old.textContent; document.body.appendChild(s);
    return runScripts(list, i + 1);
  }
  function swap(doc, url, push) {
    Scope.drop();
    document.title = doc.title;
    // page styles: replace every <style> in <head> (app/shell CSS identical, page CSS differs)
    document.querySelectorAll('head style').forEach(function (s) { s.remove(); });
    doc.querySelectorAll('head style').forEach(function (s) { document.head.appendChild(s.cloneNode(true)); });
    document.body.className = doc.body.className;
    var scripts = [].slice.call(doc.body.querySelectorAll('script')).filter(function (s) {
      var m = s.getAttribute('src') && s.getAttribute('src').match(ONCE);
      if (!m) return true;
      if (loadedOnce[m[2]]) return false;
      loadedOnce[m[2]] = 1; return true;
    });
    scripts.forEach(function (s) { s.remove(); });
    document.body.replaceChildren.apply(document.body, [].slice.call(doc.body.childNodes).map(function (n) { return document.adoptNode(n); }));
    root.classList.remove('menu-open', 'fs');
    if (push) history.pushState({ spa: 1 }, '', url);
    window.scrollTo(0, 0);
    window.Aurum.extra = [];
    Scope.spa = 1;
    document.dispatchEvent(new CustomEvent('aurum:navigated'));
    applyHidden(); fillTodo();
    document.querySelectorAll('[data-theme-value]').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-theme-value') === currentTheme() ? 'true' : 'false'); });
    return runScripts(scripts, 0).then(function () {
      if (window.Aurum.last) paint(window.Aurum.last); // instant figures, then fresh ones
      load();
      document.querySelectorAll('[data-lazy-script]').forEach(function (el) { var s = document.createElement('script'); s.src = el.getAttribute('data-lazy-script'); s.async = true; document.body.appendChild(s); });
      (window.requestIdleCallback || setTimeout)(warmPages, { timeout: 2000 });
    });
  }
  var navSeq = 0;
  function go(url, push) {
    var mine = ++navSeq, slow = setTimeout(function () { root.classList.add('navigating'); }, 150);
    return fetchPage(url).then(function (html) {
      if (mine !== navSeq) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.getElementById('app-css')) throw new Error('not an app page');
      var run = function () { return swap(doc, url, push); };
      clearTimeout(slow); root.classList.remove('navigating');
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) return document.startViewTransition(run).updateCallbackDone;
      return run();
    }).catch(function () { clearTimeout(slow); location.assign(url); });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !spaTarget(a)) return;
    e.preventDefault();
    // close any open menu / sheet first
    document.querySelectorAll('.menu:not([hidden]),.overlay:not([hidden])').forEach(function (o) { o.hidden = true; });
    go(a.href, true);
  });
  if (Scope && document.getElementById('app-css')) {
    (window.requestIdleCallback || setTimeout)(warmPages, { timeout: 2000 });
    history.replaceState({ spa: 1 }, '', location.href);
    window.addEventListener('popstate', function () {
      if (FULL.test(location.pathname)) { location.reload(); return; }
      go(location.href, false);
    });
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();

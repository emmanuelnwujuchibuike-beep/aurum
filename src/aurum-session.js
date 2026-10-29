/* Aurum Capital — signed-in data layer (deferred, after app.js).
   Small fetch wrapper around Supabase instead of the 47 KB SDK. It reads and
   refreshes the SAME saved session the existing pages use
   (localStorage "sb-<ref>-auth-token"), so signing in on any page works on all.

   Exposes window.AurumSession:
     ready        Promise<{ user, profile, settings }> — redirects to sign-in if needed
     rest(path, opts)      Supabase REST call with the user's token
     token()               Promise<fresh access token> for edge functions / storage
     portfolio({...})      THE one portfolio / P&L calculation every page uses
     fmt                   number/date formatters (Intl)
     signOut()             ends the session and clears this device's user data */
(function () {
  'use strict';
  var REF = 'ttwwthfeordsojmcjwxn';
  var URL_ = 'https://' + REF + '.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
  var STORE = 'sb-' + REF + '-auth-token';
  // Per-user data cached on this device by old and new pages; cleared on sign-out
  var USER_KEYS = ['aurum_property_locks', 'aurum_chart_markers', 'aurum_alerts', 'aurum_price_cache', 'aurum_live_prices', 'aurum_avatar_color', 'aurum_cache_v1'];

  function readSession() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  function toSignIn() {
    location.replace('signup.html?next=' + encodeURIComponent(location.pathname.replace(/^\//, '') + location.search));
  }

  // One token refresh at a time (parallel requests would otherwise each spend the refresh token)
  var refreshing = null;
  function freshSession() {
    var s = readSession();
    if (!s || !s.access_token) return Promise.resolve(null);
    if (s.expires_at && s.expires_at * 1000 > Date.now() + 60000) return Promise.resolve(s);
    if (!refreshing) refreshing = refreshNow(s).finally(function () { refreshing = null; });
    return refreshing;
  }
  async function refreshNow(s) {
    // Expired or about to: refresh exactly as supabase-js does, and store it back in the same shape
    var r = await fetch(URL_ + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    }).catch(function () { return null; });
    // Offline / network error: keep the user signed in and let requests fail visibly
    if (!r) return s;
    if (!r.ok) {
      // Supabase rejected the refresh token: the session is really over. Remove it so
      // the sign-in page doesn't see it and bounce straight back here (redirect loop).
      if (r.status >= 400 && r.status < 500) { try { localStorage.removeItem(STORE); } catch (e) {} }
      return null;
    }
    var n = await r.json();
    if (!n.expires_at && n.expires_in) n.expires_at = Math.floor(Date.now() / 1000) + n.expires_in;
    try { localStorage.setItem(STORE, JSON.stringify(n)); } catch (e) {}
    return n;
  }

  /* ── Data cache (stale-while-revalidate) ───────────────────────────────────
     GET results are kept on this device (localStorage, per user, cleared on
     sign-out). A page asking for data gets the cached copy instantly; if it is
     older than FRESH a background request refreshes it, and when the answer has
     changed pages are told to re-read ('aurum:resume'), so balances never stay
     stale. Any write through rest() or the money function clears the cache.
     Entries older than MAX_AGE are not shown at all (network first). */
  var CACHE_KEY = 'aurum_cache_v1', FRESH = 15000, MAX_AGE = 30 * 60000;
  var store = { uid: null, e: {} }, inflight = {}, saveT, resumeT;
  try { store = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') || store; if (!store.e) store.e = {}; } catch (e) {}
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); }
      catch (e) { store.e = {}; try { localStorage.removeItem(CACHE_KEY); } catch (x) {} } // quota: start over
    }, 300);
  }
  function invalidate() { store.e = {}; inflight = {}; try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }
  function changed() { clearTimeout(resumeT); resumeT = setTimeout(function () { document.dispatchEvent(new CustomEvent('aurum:resume')); }, 120); }

  async function raw(path, opts, s) {
    var headers = Object.assign({ apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, opts.headers || {});
    var r = await fetch(URL_ + '/rest/v1/' + path, Object.assign({}, opts, { headers: headers }));
    if (r.status === 401) { toSignIn(); throw new Error('session expired'); }
    var text = await r.text();
    var body = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((body && (body.message || body.error)) || ('HTTP ' + r.status));
    return body;
  }
  function fetchInto(path, s, notify) {
    if (inflight[path]) return inflight[path];
    var p = inflight[path] = raw(path, {}, s).then(function (body) {
      var old = store.e[path], json = JSON.stringify(body);
      store.e[path] = { at: Date.now(), d: body };
      persist();
      if (notify && old && JSON.stringify(old.d) !== json) changed();
      return body;
    }).finally(function () { delete inflight[path]; });
    return p;
  }
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  /** Supabase REST with the signed-in user's token (RLS applies server-side). */
  async function rest(path, opts) {
    opts = opts || {};
    var s = await freshSession();
    if (!s) { toSignIn(); throw new Error('signed out'); }
    var uid = s.user && s.user.id;
    if (store.uid !== uid) { store = { uid: uid, e: {} }; inflight = {}; }
    var method = String(opts.method || 'GET').toUpperCase();
    if (method !== 'GET') { var out = await raw(path, opts, s); invalidate(); store.uid = uid; return out; }
    if (opts.fresh) return copy(await fetchInto(path, s, false));
    var hit = store.e[path], age = hit ? Date.now() - hit.at : Infinity;
    if (hit && age < MAX_AGE) {
      if (age > FRESH) fetchInto(path, s, true).catch(function () {}); // refresh quietly
      return copy(hit.d);
    }
    return copy(await fetchInto(path, s, false));
  }

  /* Warm the data the main pages show (bottom nav, avatar → profile), so they
     open with figures already in place. Same query strings as the pages use. */
  function warm() {
    var s = readSession(), uid = s && s.user && s.user.id;
    if (!uid || document.visibilityState === 'hidden') return;
    var u = encodeURIComponent(uid);
    [
      'profiles?id=eq.' + u + '&select=*', 'site_settings?select=key,value', 'profiles?id=eq.' + uid + '&select=cash',
      'holdings?user_id=eq.' + uid + '&select=symbol,name,quantity,avg_buy_price,pnl_override',
      'holdings?user_id=eq.' + uid + '&quantity=gt.0&select=symbol,name,quantity,avg_buy_price,pnl_override,locked_until',
      'holdings?user_id=eq.' + uid + '&select=symbol,quantity,avg_buy_price,pnl_override',
      'holdings?user_id=eq.' + uid + '&quantity=gt.0&select=symbol,name,quantity,avg_buy_price,pnl_override,locked_until,lock_duration',
      'transactions?user_id=eq.' + uid + '&select=type,symbol,usd_amount,status,created_at&order=created_at.desc&limit=5',
      'transactions?user_id=eq.' + uid + '&select=type,symbol,usd_amount,status,created_at&order=created_at.desc&limit=500',
      'open_trades?user_id=eq.' + uid + '&status=eq.open&select=*',
      'properties?select=*&order=sort.asc,name.asc',
    ].forEach(function (path, i) {
      var hit = store.e[path];
      if (hit && Date.now() - hit.at < FRESH) return;
      setTimeout(function () { rest(path, { fresh: !hit }).catch(function () {}); }, i * 60);
    });
  }

  /* ── THE portfolio calculation ───────────────────────────────────────────
     Every new page uses this, so cash, value, P&L and net worth always agree.
       value     = quantity × live price (avg price if no live price yet)
       cost      = quantity × avg buy price
       P&L       = value − cost;   P&L % = P&L ÷ cost
       net worth = cash + value
     Test mode (admin switch in site_settings): a holding's pnl_override is used
     as its P&L and its value becomes cost + override, so every figure still
     reconciles. Those positions are flagged isTest and pages mark them TEST.
     With test mode off, overrides are ignored. */
  function portfolio(o) {
    var prices = o.prices || {}, testMode = !!o.testMode;
    var positions = (o.holdings || []).map(function (h) {
      var qty = Number(h.quantity) || 0, avg = Number(h.avg_buy_price) || 0;
      var live = Number(prices[h.symbol]) > 0 ? Number(prices[h.symbol]) : avg;
      var cost = qty * avg;
      var isTest = testMode && h.pnl_override != null && h.pnl_override !== '';
      var pnl = isTest ? Number(h.pnl_override) : qty * live - cost;
      var value = cost + pnl;
      return {
        symbol: h.symbol, name: h.name || h.symbol, qty: qty, avg: avg, price: live,
        cost: cost, value: value, pnl: pnl, pnlPct: cost > 0 ? pnl / cost * 100 : 0, isTest: isTest,
      };
    });
    var t = positions.reduce(function (a, p) { a.value += p.value; a.cost += p.cost; a.pnl += p.pnl; return a; }, { value: 0, cost: 0, pnl: 0 });
    var cash = Number(o.cash) || 0;
    return {
      cash: cash, value: t.value, cost: t.cost, pnl: t.pnl,
      pnlPct: t.cost > 0 ? t.pnl / t.cost * 100 : 0,
      netWorth: cash + t.value,
      positions: positions,
      hasTest: positions.some(function (p) { return p.isTest; }),
    };
  }

  /* ── formatting (Intl; no hard-coded symbols beyond USD display) ── */
  /* Display currency + number format chosen in Profile → Preferences (profiles.settings,
     mirrored to localStorage 'aurum_pref_settings'). Amounts are stored and traded in USD;
     only the display converts, at the live rate (cached 12 h). Amounts of a million or
     more are shortened: $1.25M, $3.4B. */
  var SYM = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', NGN: '₦', CAD: 'C$', AUD: 'A$', CHF: 'Fr ', INR: '₹', BRL: 'R$' };
  var pref = { cur: 'USD', fmt: 'us' }, fx = { USD: 1 };
  try { var ps = JSON.parse(localStorage.getItem('aurum_pref_settings') || 'null'); if (ps) { pref.cur = SYM[ps.currency] ? ps.currency : 'USD'; pref.fmt = ps.format === 'eu' ? 'eu' : 'us'; } } catch (e) {}
  try { var fc = JSON.parse(localStorage.getItem('aurum_fx_v1') || 'null'); if (fc && fc.rates) fx = Object.assign({ USD: 1 }, fc.rates); } catch (e) {}
  function setPrefs(settings) {
    if (!settings) return;
    pref.cur = SYM[settings.currency] ? settings.currency : 'USD';
    pref.fmt = settings.format === 'eu' ? 'eu' : 'us';
    if (pref.cur !== 'USD') loadFx();
  }
  function loadFx() {
    try { var fc = JSON.parse(localStorage.getItem('aurum_fx_v1') || 'null'); if (fc && fc.rates && Date.now() - fc.at < 12 * 36e5) { fx = Object.assign({ USD: 1 }, fc.rates); return; } } catch (e) {}
    fetch('https://open.er-api.com/v6/latest/USD').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.rates) return;
      fx = Object.assign({}, d.rates, { USD: 1 });
      try { localStorage.setItem('aurum_fx_v1', JSON.stringify({ at: Date.now(), rates: d.rates })); } catch (e) {}
      document.dispatchEvent(new CustomEvent('aurum:resume')); // pages re-render in the new currency
    }).catch(function () {});
  }
  function conv(n) { var r = fx[pref.cur]; return pref.cur === 'USD' || !r ? { v: n, s: '$' } : { v: n * r, s: SYM[pref.cur] }; }
  // Always comma thousands and a dot for decimals (1,234.56), whatever the currency
  function num(v, dp) { return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function body(v) {
    var a = Math.abs(v);
    if (a >= 1e12) return num(a / 1e12, 2) + 'T';
    if (a >= 1e9) return num(a / 1e9, 2) + 'B';
    if (a >= 1e6) return num(a / 1e6, 2) + 'M';
    return num(a, 2);
  }
  function money(n, signed) {
    n = Number(n) || 0; var c = conv(n);
    var sign = c.v < 0 ? '−' : signed && c.v > 0 ? '+' : '';
    return sign + c.s + body(c.v);
  }
  var fmt = {
    usd: function (n) { return money(n, false); },
    signedUsd: function (n) { return money(n, true); },
    pct: function (n) { n = Number(n) || 0; return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2) + '%'; },
    compact: function (n) {
      n = Number(n) || 0; var c = conv(n);
      return (c.v < 0 ? '−' : '') + c.s + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(Math.abs(c.v));
    },
    currency: function () { return pref.cur; },
    when: function (iso) {
      var d = new Date(iso); if (isNaN(d)) return '—';
      return d.toLocaleDateString('en-GB') + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    },
  };

  async function signOut() {
    var s = readSession();
    if (s && s.access_token) {
      await fetch(URL_ + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(function () {});
    }
    try {
      localStorage.removeItem(STORE);
      USER_KEYS.forEach(function (k) { localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch (e) {}
    if (window.caches) caches.keys().then(function (ks) { ks.filter(function (k) { return k.indexOf('aurum-user') === 0; }).forEach(function (k) { caches.delete(k); }); });
    location.replace('index.html');
  }

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  async function load() {
    var s = await freshSession();
    if (!s) { toSignIn(); return new Promise(function () {}); }
    var uid = s.user && s.user.id;
    var res = await Promise.all([
      rest('profiles?id=eq.' + encodeURIComponent(uid) + '&select=*').then(function (r) { return r && r[0]; }),
      // site_settings may not exist yet: missing table = defaults (test mode off)
      rest('site_settings?select=key,value').catch(function () { return []; }),
    ]);
    var settings = {};
    (res[1] || []).forEach(function (r) { settings[r.key] = r.value; });
    var profile = res[0] || {};
    setPrefs(profile.settings);
    var initials = (profile.avatar_initials || ((profile.first_name || '')[0] || '') + ((profile.last_name || '')[0] || '') || (s.user.email || '?')[0]).toUpperCase();
    document.querySelectorAll('[data-avatar]').forEach(function (el) {
      if (profile.avatar_url) { el.innerHTML = ''; var i = new Image(); i.alt = ''; i.src = profile.avatar_url; el.appendChild(i); }
      else el.textContent = initials;
    });
    document.querySelectorAll('[data-greeting]').forEach(function (el) { if (el.hasAttribute('data-greeting')) el.textContent = greeting(); });
    var testMode = settings.test_mode === true || settings.test_mode === 'true';
    document.querySelectorAll('[data-test-banner]').forEach(function (el) { el.hidden = !testMode; });
    return { user: s.user, profile: profile, settings: settings, testMode: testMode };
  }

  /** Fresh access token for edge functions and storage uploads. */
  async function token() {
    var s = await freshSession();
    if (!s) { toSignIn(); throw new Error('signed out'); }
    return s.access_token;
  }

  window.AurumSession = { ready: load(), rest: rest, token: token, key: KEY, portfolio: portfolio, fmt: fmt, signOut: signOut, url: URL_, invalidate: invalidate, warm: warm, setPrefs: setPrefs };
  // Warm the other main pages' data once this page is idle, and again every minute while open
  (window.requestIdleCallback || setTimeout)(function () { warm(); }, { timeout: 2500 });
  setInterval(warm, 60000);

  // Back-swipe / back button: browsers restore this page instantly from the
  // back-forward cache (no reload, no flash). Re-check the session — a signed-out
  // user must not see balances from the cached page — then let the page refresh
  // its figures quietly via the 'aurum:resume' event.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    if (!readSession()) { toSignIn(); return; }
    document.dispatchEvent(new CustomEvent('aurum:resume'));
    if (window.Aurum && window.Aurum.refresh) window.Aurum.refresh();
  });
  // In-app navigation (app.js router): reload the profile so the next page sees fresh
  // figures, and paint this page's avatar / greeting / test banner.
  // (load() reads through the cache, so this is instant; stale parts refresh in the background.)
  document.addEventListener('aurum:navigated', function () { window.AurumSession.ready = load(); (window.requestIdleCallback || setTimeout)(warm, { timeout: 2500 }); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-signout]')) { e.preventDefault(); signOut(); }
  });
})();

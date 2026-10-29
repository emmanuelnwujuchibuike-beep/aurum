/* Aurum Capital — signed-in data layer (deferred, after app.js).
   Small fetch wrapper around Supabase instead of the 47 KB SDK. It reads and
   refreshes the SAME saved session the existing pages use
   (localStorage "sb-<ref>-auth-token"), so signing in on any page works on all.

   Exposes window.AurumSession:
     ready        Promise<{ user, profile, settings }> — redirects to sign-in if needed
     rest(path, opts)      Supabase REST call with the user's token
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
  var USER_KEYS = ['aurum_property_locks', 'aurum_chart_markers', 'aurum_alerts', 'aurum_price_cache', 'aurum_live_prices', 'aurum_avatar_color'];

  function readSession() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  function toSignIn() {
    location.replace('signup.html?next=' + encodeURIComponent(location.pathname.replace(/^\//, '') + location.search));
  }

  async function freshSession() {
    var s = readSession();
    if (!s || !s.access_token) return null;
    if (s.expires_at && s.expires_at * 1000 > Date.now() + 60000) return s;
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

  /** Supabase REST with the signed-in user's token (RLS applies server-side). */
  async function rest(path, opts) {
    opts = opts || {};
    var s = await freshSession();
    if (!s) { toSignIn(); throw new Error('signed out'); }
    var headers = Object.assign({ apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' }, opts.headers || {});
    var r = await fetch(URL_ + '/rest/v1/' + path, Object.assign({}, opts, { headers: headers }));
    if (r.status === 401) { toSignIn(); throw new Error('session expired'); }
    var text = await r.text();
    var body = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((body && (body.message || body.error)) || ('HTTP ' + r.status));
    return body;
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
  var nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmt = {
    usd: function (n) { n = Number(n) || 0; return (n < 0 ? '−$' : '$') + nf2.format(Math.abs(n)); },
    signedUsd: function (n) { n = Number(n) || 0; return (n > 0 ? '+$' : n < 0 ? '−$' : '$') + nf2.format(Math.abs(n)); },
    pct: function (n) { n = Number(n) || 0; return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2) + '%'; },
    compact: function (n) { n = Number(n) || 0; return (n < 0 ? '−$' : '$') + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(Math.abs(n)); },
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

  window.AurumSession = { ready: load(), rest: rest, portfolio: portfolio, fmt: fmt, signOut: signOut, url: URL_ };

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
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-signout]')) { e.preventDefault(); signOut(); }
  });
})();

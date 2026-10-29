/* Aurum Capital — DEMO badge for pages not yet on the shared shell.
   Shown until an admin turns on real payments (site_settings.payments_live). */
(function () {
  'use strict';
  var API = 'https://ttwwthfeordsojmcjwxn.supabase.co/rest/v1/site_settings?key=eq.payments_live&select=value';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
  // Lock the page horizontally (no sideways drift on iOS)
  var lock = document.createElement('style');
  lock.textContent = 'html,body{overflow-x:hidden;overflow-x:clip;max-width:100%}html{overscroll-behavior-x:none}' +
    // iOS zooms into fields under 16px on focus
    '@supports (-webkit-touch-callout:none){input,select,textarea{font-size:16px!important}}';
  document.head.appendChild(lock);
  var el = document.createElement('div');
  el.setAttribute('role', 'note');
  el.textContent = 'DEMO · NOT REAL MONEY';
  el.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:2147483000;background:#5C450F;color:#F1E4C3;font:600 11px/1 system-ui,sans-serif;letter-spacing:.14em;padding:5px 12px;border-radius:0 0 10px 10px;pointer-events:none';
  var live = false;
  try { live = localStorage.getItem('aurum_live') === '1'; } catch (e) {}
  el.hidden = live;
  document.body.appendChild(el);
  fetch(API, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (!rows) return;
      var on = !!rows[0] && (rows[0].value === true || rows[0].value === 'true');
      try { localStorage.setItem('aurum_live', on ? '1' : '0'); } catch (e) {}
      el.hidden = on;
    }).catch(function () {});
})();

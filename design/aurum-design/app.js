/* Aurum Capital — shared app behaviour (reference). One delegated listener, no framework. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Theme lives in Profile settings (stored, applied before paint by the inline snippet in <head>)
  function applyTheme(t) {
    try { localStorage.setItem('aurum-theme', t); } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var open = t.closest('[data-open]');
    if (open) { var el = document.getElementById(open.getAttribute('data-open')); if (el) el.hidden = false; return; }
    var close = t.closest('[data-close]');
    if (close) { var c = document.getElementById(close.getAttribute('data-close')); if (c) c.hidden = true; return; }

    // Hide / show balances
    if (t.closest('[data-hide-balances]')) {
      var hidden = document.documentElement.toggleAttribute('data-hide');
      $$('[data-money]').forEach(function (m) {
        if (!m.dataset.value) m.dataset.value = m.textContent;
        m.textContent = hidden ? '••••' : m.dataset.value;
      });
      $$('[data-hide-balances].sw').forEach(function (s) { s.setAttribute('aria-pressed', hidden); });
      return;
    }
    // Generic switch
    var sw = t.closest('.sw');
    if (sw) { sw.setAttribute('aria-pressed', sw.getAttribute('aria-pressed') !== 'true'); return; }

    // Segmented / chip groups: one "on" at a time, optional callback by name
    var g = t.closest('[data-group] > button');
    if (g) {
      var group = g.parentNode;
      $$('button', group).forEach(function (b) { b.classList.toggle('on', b === g); b.setAttribute('aria-pressed', b === g); });
      var name = group.getAttribute('data-group');
      if (name === 'theme') applyTheme(g.getAttribute('data-value'));
      document.dispatchEvent(new CustomEvent('group:' + name, { detail: g.getAttribute('data-value') || g.textContent.trim() }));
    }
  });

  // Close overlays with Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$('.overlay,.menu').forEach(function (o) { o.hidden = true; });
  });

  // Prefetch next pages on first touch for instant navigation
  var done = {};
  document.addEventListener('touchstart', function (e) {
    var a = e.target.closest && e.target.closest('a[href$=".html"]');
    if (!a || done[a.href]) return;
    done[a.href] = 1;
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.appendChild(l);
  }, { passive: true });
})();

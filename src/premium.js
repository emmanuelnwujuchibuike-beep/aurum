/* ══════════════════════════════════════════════════════════════
   AURUM CAPITAL — PREMIUM SHARED JS  v2.0
   Include just before </body> on every page.
   Provides: theme toggle, cursor glow, diamond particles,
   scroll reveal, header scroll, loader auto-hide.
══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ══ THEME MANAGEMENT ══ */
  var html     = document.documentElement;
  var THEME_KEY = 'aurum_theme';

  function getPreference() {
    var s = localStorage.getItem(THEME_KEY);
    if (s === 'light' || s === 'dark') return s;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
      ? 'light' : 'dark';
  }

  function applyTheme(t) {
    html.dataset.theme = t;
    document.querySelectorAll('.theme-icon, #themeIcon').forEach(function(el) {
      el.textContent = t === 'light' ? '☾' : '☀';
    });
    try { localStorage.setItem(THEME_KEY, t); } catch(e) {}
  }

  applyTheme(getPreference());

  window.toggleTheme = function() {
    var next    = html.dataset.theme === 'dark' ? 'light' : 'dark';
    var overlay = document.getElementById('themeOverlay');
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.classList.add('spin');
      setTimeout(function() { btn.classList.remove('spin'); }, 640);
    });
    if (overlay) {
      overlay.style.opacity = '1';
      setTimeout(function() { applyTheme(next); overlay.style.opacity = '0'; }, 160);
    } else {
      applyTheme(next);
    }
  };

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
      try { if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? 'light' : 'dark'); } catch(ex) {}
    });
  }

  /* ══ CURSOR GLOW ══ */
  var glow = document.getElementById('cursorGlow');
  if (glow && window.matchMedia && !window.matchMedia('(hover: none)').matches) {
    var tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
    document.addEventListener('mousemove', function(e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('mouseover', function(e) {
      if (e.target && e.target.matches && e.target.matches(
        'button,a,.market-card,.prop-card,.vert-card,.ac-row,.card,.glass-card,.plan-card,.feature-card,.feat-card,.stat-card,.testimonial-card,.form-group'
      )) { glow.style.width = glow.style.height = '560px'; }
    }, { passive: true });
    document.addEventListener('mouseout', function(e) {
      if (e.target && e.target.matches && e.target.matches(
        'button,a,.market-card,.prop-card,.vert-card,.ac-row,.card,.glass-card,.plan-card,.feature-card,.feat-card,.stat-card,.testimonial-card,.form-group'
      )) { glow.style.width = glow.style.height = '400px'; }
    }, { passive: true });
    (function glowLoop() {
      cx += (tx - cx) * 0.07; cy += (ty - cy) * 0.07;
      glow.style.left = cx + 'px'; glow.style.top = cy + 'px';
      requestAnimationFrame(glowLoop);
    })();
  }

  /* ══ DIAMOND PARTICLES ══ */
  var particleHost = document.getElementById('particles') || document.getElementById('particlesContainer');
  if (particleHost) {
    function spawnDiamond() {
      var d     = document.createElement('div');
      d.className = 'diamond-particle';
      var size  = (Math.random() * 3.5 + 3) + 'px';
      var dur   = (Math.random() * 22 + 14) + 's';
      var delay = (Math.random() * 10) + 's';
      d.style.cssText =
        'left:' + (Math.random() * 100) + 'vw;' +
        'width:' + size + ';height:' + size + ';' +
        'animation-duration:' + dur + ';animation-delay:' + delay;
      particleHost.appendChild(d);
      setTimeout(function() { d.remove(); spawnDiamond(); },
        (parseFloat(dur) + parseFloat(delay)) * 1000 + 500);
    }
    for (var di = 0; di < 7; di++) setTimeout(spawnDiamond, di * 1100);
  }

  /* ══ SCROLL REVEAL ══ */
  function initReveal() {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) {
        if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -44px 0px' });
    document.querySelectorAll('.reveal').forEach(function(el) { obs.observe(el); });
  }
  window.initReveal = initReveal;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

  /* ══ HEADER SCROLL EFFECT ══ */
  var hdr = document.getElementById('mainHeader');
  if (hdr) {
    window.addEventListener('scroll', function() {
      hdr.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  /* ══ LOADER AUTO-HIDE ══ */
  var loader = document.getElementById('loader');
  if (loader) {
    function hideLoader() {
      loader.classList.add('hidden');
      if (window.initReveal) initReveal();
    }
    window.addEventListener('load', function() { setTimeout(hideLoader, 2400); });
    setTimeout(hideLoader, 3600);
  }

  /* ══ RIPPLE (mobile menu links) ══ */
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.mm-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        var rect = this.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var r    = document.createElement('span');
        r.style.cssText =
          'position:absolute;border-radius:50%;background:rgba(201,166,60,.16);' +
          'transform:scale(0);animation:ripple .5s ease-out forwards;pointer-events:none;' +
          'width:' + size + 'px;height:' + size + 'px;' +
          'left:' + (e.clientX - rect.left - size / 2) + 'px;' +
          'top:'  + (e.clientY - rect.top  - size / 2) + 'px';
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(r);
        setTimeout(function() { r.remove(); }, 560);
      });
    });
  });

  /* ══ COUNTER ANIMATION ══ */
  window.animateCounter = function(el, target, duration, prefix, suffix) {
    if (!el) return;
    var start = 0, startTime = null;
    prefix = prefix || '';
    suffix = suffix || '';
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      var val = Math.floor(start + (target - start) * ease);
      el.textContent = prefix + val.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

})();

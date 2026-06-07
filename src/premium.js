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
    var next = html.dataset.theme === 'dark' ? 'light' : 'dark';

    // Freeze all transitions so the theme swap is one-frame instant across every element
    var ns = document.createElement('style');
    ns.id = '__aurum_nt';
    ns.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(ns);

    // Apply the new theme immediately
    applyTheme(next);

    // Force a synchronous reflow — commits the no-transition style before next paint
    void document.documentElement.offsetHeight;

    // Restore transitions after the new theme has been painted (two frames = safe margin)
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        var el = document.getElementById('__aurum_nt');
        if (el) el.remove();
      });
    });

    // Cosmetic spin on button — independent of the theme swap
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.classList.add('spin');
      setTimeout(function() { btn.classList.remove('spin'); }, 400);
    });
  };

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(e) {
      try { applyTheme(e.matches ? 'light' : 'dark'); } catch(ex) {}
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

  /* ══ GOOGLE ANALYTICS 4 ══ */
  (function() {
    var GA_ID = 'G-4ZMHD80SN9';
    var consent = localStorage.getItem('aurum_cookies');
    var granted = consent === 'accepted';

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());

    // Consent Mode v2 — deny by default until user accepts; grant immediately if already accepted
    gtag('consent', 'default', {
      analytics_storage:  granted ? 'granted' : 'denied',
      ad_storage:         granted ? 'granted' : 'denied',
      ad_user_data:       granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      wait_for_update: 400
    });

    gtag('config', GA_ID, { anonymize_ip: true });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    // Invoked by cookie consent when user clicks Accept All
    window.aurumGrantAnalytics = function() {
      gtag('consent', 'update', {
        analytics_storage:  'granted',
        ad_storage:         'granted',
        ad_user_data:       'granted',
        ad_personalization: 'granted'
      });
      gtag('event', 'consent_accepted', { event_category: 'Cookie Consent' });
    };
  })();

  /* ══ COOKIE CONSENT ══ */
  (function() {
    var COOKIE_KEY = 'aurum_cookies';
    if (localStorage.getItem(COOKIE_KEY)) return;

    var css = document.createElement('style');
    css.textContent = [
      '#aurum-cookie-bar{',
        'position:fixed;bottom:24px;left:50%;',
        'transform:translateX(-50%) translateY(110px);opacity:0;',
        'z-index:99999;',
        'width:min(640px,calc(100vw - 32px));',
        'background:linear-gradient(135deg,rgba(8,13,22,.97),rgba(4,7,13,.99));',
        'border:1px solid rgba(201,168,70,.25);border-radius:20px;',
        'padding:18px 22px;display:flex;align-items:center;gap:18px;',
        'backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);',
        'box-shadow:0 8px 48px rgba(0,0,0,.65),0 0 0 1px rgba(201,168,70,.07);',
        'transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .45s;',
      '}',
      '#aurum-cookie-bar.cb-show{transform:translateX(-50%) translateY(0);opacity:1}',
      '#aurum-cookie-bar .cb-icon{',
        'width:40px;height:40px;border-radius:12px;flex-shrink:0;',
        'background:rgba(201,168,70,.1);border:1px solid rgba(201,168,70,.2);',
        'display:flex;align-items:center;justify-content:center;',
        'color:#c9a84c;font-size:17px;',
      '}',
      '#aurum-cookie-bar .cb-body{flex:1;min-width:0}',
      '#aurum-cookie-bar .cb-title{',
        'font-family:"JetBrains Mono",monospace;font-size:10px;',
        'letter-spacing:.16em;text-transform:uppercase;color:#c9a84c;margin-bottom:5px;',
      '}',
      '#aurum-cookie-bar .cb-text{font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.55}',
      '#aurum-cookie-bar .cb-text a{color:#c9a84c;text-decoration:underline;text-underline-offset:3px}',
      '#aurum-cookie-bar .cb-btns{display:flex;gap:9px;flex-shrink:0}',
      '#aurum-cookie-bar .cb-btn-accept{',
        'background:linear-gradient(135deg,#c9a84c,#a8893a);color:#020406;',
        'border:none;border-radius:10px;padding:9px 18px;',
        'font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;',
        'transition:box-shadow .2s,transform .15s;',
      '}',
      '#aurum-cookie-bar .cb-btn-accept:hover{box-shadow:0 4px 18px rgba(201,168,70,.45);transform:translateY(-1px)}',
      '#aurum-cookie-bar .cb-btn-decline{',
        'background:transparent;color:rgba(255,255,255,.45);',
        'border:1px solid rgba(255,255,255,.12);border-radius:10px;',
        'padding:9px 14px;font-size:12.5px;cursor:pointer;white-space:nowrap;',
        'transition:border-color .2s,color .2s;',
      '}',
      '#aurum-cookie-bar .cb-btn-decline:hover{border-color:rgba(255,255,255,.28);color:rgba(255,255,255,.72)}',
      'html[data-theme="light"] #aurum-cookie-bar{',
        'background:linear-gradient(135deg,rgba(255,252,242,.97),rgba(248,244,230,.99));',
        'border-color:rgba(160,120,40,.28);',
        'box-shadow:0 8px 40px rgba(0,0,0,.12),0 0 0 1px rgba(160,120,40,.08);',
      '}',
      'html[data-theme="light"] #aurum-cookie-bar .cb-text{color:rgba(20,14,4,.6)}',
      'html[data-theme="light"] #aurum-cookie-bar .cb-btn-decline{',
        'color:rgba(20,14,4,.5);border-color:rgba(20,14,4,.14);',
      '}',
      'html[data-theme="light"] #aurum-cookie-bar .cb-btn-decline:hover{',
        'border-color:rgba(20,14,4,.28);color:rgba(20,14,4,.75);',
      '}',
      '@media(max-width:540px){',
        '#aurum-cookie-bar{flex-direction:column;align-items:flex-start;gap:14px;padding:16px 16px;bottom:12px}',
        '#aurum-cookie-bar .cb-icon{display:none}',
        '#aurum-cookie-bar .cb-btns{width:100%}',
        '#aurum-cookie-bar .cb-btn-accept,#aurum-cookie-bar .cb-btn-decline{flex:1;text-align:center}',
      '}'
    ].join('');
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.id = 'aurum-cookie-bar';
    bar.innerHTML =
      '<div class="cb-icon"><i class="fas fa-cookie-bite"></i></div>' +
      '<div class="cb-body">' +
        '<div class="cb-title">// Cookie Preferences</div>' +
        '<div class="cb-text">We use cookies to enhance performance, remember your preferences, and improve your experience. By accepting, you agree to our use of cookies.</div>' +
      '</div>' +
      '<div class="cb-btns">' +
        '<button class="cb-btn-decline" id="cb-decline">Necessary Only</button>' +
        '<button class="cb-btn-accept" id="cb-accept">Accept All</button>' +
      '</div>';

    function ready(fn) {
      if (document.body) { fn(); } else { document.addEventListener('DOMContentLoaded', fn); }
    }

    ready(function() {
      document.body.appendChild(bar);
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { bar.classList.add('cb-show'); });
      });

      function dismiss(accepted) {
        try { localStorage.setItem(COOKIE_KEY, accepted ? 'accepted' : 'necessary'); } catch(e) {}
        if (accepted) {
          var exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
          document.cookie = 'aurum_consent=accepted;expires=' + exp.toUTCString() + ';path=/;SameSite=Lax';
          if (window.aurumGrantAnalytics) window.aurumGrantAnalytics();
        }
        bar.classList.remove('cb-show');
        setTimeout(function() { bar.remove(); }, 480);
      }

      document.getElementById('cb-accept').addEventListener('click', function() { dismiss(true); });
      document.getElementById('cb-decline').addEventListener('click', function() { dismiss(false); });
    });
  })();

})();

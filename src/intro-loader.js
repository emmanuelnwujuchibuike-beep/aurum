/*!
 * Aurum Capital — Intro Loader  v1.0
 * Self-contained: injects overlay + styles, then iris-out dismisses.
 * Theme-aware: dark bg on dark mode, warm cream on light mode.
 * Place as first <script> in <body> (not type="module").
 * Click anywhere to skip.
 */
(function () {
  'use strict';

  /* ── Theme detection (set by inline script in <head> before body) ── */
  var isLight = document.documentElement.dataset.theme === 'light';

  var BG      = isLight ? '#faf8f4' : '#020406';
  var SNOW    = isLight ? '#1a1008' : '#edf2f8';
  var TAG_C   = isLight ? 'rgba(159,122,30,.72)' : 'rgba(201,168,76,.6)';
  var CORNER  = isLight ? 'rgba(159,122,30,.4)'  : 'rgba(201,168,76,.38)';
  var GLOW    = isLight ? 'rgba(159,122,30,.1)'  : 'rgba(201,168,76,.18)';

  /* ── Inject CSS ── */
  if (!document.getElementById('ac-loader-css')) {
    var s = document.createElement('style');
    s.id = 'ac-loader-css';
    s.textContent =
      /* overlay */
      '#acIntro{position:fixed;inset:0;z-index:99998;background:' + BG + ';' +
      'display:flex;align-items:center;justify-content:center;flex-direction:column;' +
      'transition:opacity .75s ease,transform .75s cubic-bezier(.4,0,.2,1);' +
      'cursor:default;}' +

      '#acIntro.ac-out{opacity:0;transform:scale(1.04);pointer-events:none;}' +

      /* ambient glow */
      '.ac-i-glow{position:absolute;width:320px;height:320px;border-radius:50%;' +
      'background:radial-gradient(circle,' + GLOW + ' 0%,transparent 70%);' +
      'animation:aclGlow 2s ease-in-out infinite;}' +

      /* svg mark */
      '.ac-i-svg{width:124px;height:124px;' +
      'animation:aclMarkIn .9s cubic-bezier(.16,1,.3,1) .1s both;}' +

      /* ring draw */
      '.ac-i-svg .acl-ro{stroke-dasharray:408;stroke-dashoffset:408;' +
      'animation:aclDraw 1.1s cubic-bezier(.4,0,.2,1) .2s forwards;}' +
      '.ac-i-svg .acl-ri{stroke-dasharray:352;stroke-dashoffset:352;' +
      'animation:aclDraw .9s cubic-bezier(.4,0,.2,1) .5s forwards;}' +
      '.ac-i-svg .acl-lt{animation:aclLetIn .6s cubic-bezier(.16,1,.3,1) .7s both;}' +

      /* brand name */
      '.ac-i-name{font-family:"Cormorant Garamond",Georgia,serif;font-weight:300;' +
      'font-size:clamp(1rem,3.8vw,1.42rem);letter-spacing:.44em;text-transform:uppercase;' +
      'color:' + SNOW + ';margin-top:20px;' +
      'animation:aclName .8s cubic-bezier(.16,1,.3,1) .9s both;}' +

      /* gold rule */
      '.ac-i-rule{height:1px;width:0;margin-top:13px;' +
      'background:linear-gradient(90deg,transparent,#c9a84c 35%,#f0d878 55%,#c9a84c 80%,transparent);' +
      'animation:aclRule .7s ease 1.1s forwards;}' +

      /* tagline */
      '.ac-i-tag{font-family:"JetBrains Mono",monospace;font-size:9px;' +
      'letter-spacing:.22em;text-transform:uppercase;color:' + TAG_C + ';margin-top:11px;' +
      'animation:aclTag .5s ease 1.3s both;}' +

      /* corner brackets */
      '.ac-i-cor{position:absolute;pointer-events:none;}' +
      '.ac-i-cor::before,.ac-i-cor::after{content:"";position:absolute;background:' + CORNER + ';}' +
      '.ac-i-cor::before{width:26px;height:1.4px;top:0;left:0;}' +
      '.ac-i-cor::after{width:1.4px;height:26px;top:0;left:0;}' +
      '#acIntro .acl-c1{top:38px;left:38px;animation:aclCor .45s ease 1.45s both;}' +
      '#acIntro .acl-c2{top:38px;right:38px;transform:scaleX(-1);animation:aclCor .45s ease 1.52s both;}' +
      '#acIntro .acl-c3{bottom:38px;left:38px;transform:scaleY(-1);animation:aclCor .45s ease 1.58s both;}' +
      '#acIntro .acl-c4{bottom:38px;right:38px;transform:scale(-1);animation:aclCor .45s ease 1.64s both;}' +

      /* keyframes */
      '@keyframes aclGlow{0%,100%{transform:scale(.9);opacity:.55;}50%{transform:scale(1.18);opacity:1;}}' +
      '@keyframes aclMarkIn{from{opacity:0;transform:scale(.52) translateY(14px);}to{opacity:1;transform:scale(1) translateY(0);}}' +
      '@keyframes aclDraw{to{stroke-dashoffset:0;}}' +
      '@keyframes aclLetIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
      '@keyframes aclName{from{opacity:0;letter-spacing:.65em;filter:blur(5px);}to{opacity:1;letter-spacing:.44em;filter:blur(0);}}' +
      '@keyframes aclRule{to{width:108px;}}' +
      '@keyframes aclTag{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}' +
      '@keyframes aclCor{from{opacity:0;transform:scale(0);}to{opacity:1;transform:scale(1);}}' +

      /* light-mode corner scaleX fix */
      (isLight
        ? '#acIntro .acl-c2{transform:scaleX(-1);}#acIntro .acl-c3{transform:scaleY(-1);}#acIntro .acl-c4{transform:scale(-1);}'
        : '');
    document.head.appendChild(s);
  }

  /* ── Build overlay HTML ── */
  var el = document.createElement('div');
  el.id = 'acIntro';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    /* corner brackets */
    '<div class="ac-i-cor acl-c1"></div>' +
    '<div class="ac-i-cor acl-c2"></div>' +
    '<div class="ac-i-cor acl-c3"></div>' +
    '<div class="ac-i-cor acl-c4"></div>' +

    /* ambient glow */
    '<div class="ac-i-glow"></div>' +

    /* SVG mark — identical to signup intro */
    '<svg class="ac-i-svg" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
        '<linearGradient id="aclG" x1="20%" y1="8%" x2="80%" y2="92%">' +
          '<stop offset="0%" stop-color="#f5e899"/>' +
          '<stop offset="44%" stop-color="#c9a84c"/>' +
          '<stop offset="100%" stop-color="#7a5010"/>' +
        '</linearGradient>' +
      '</defs>' +
      /* outer ring */
      '<circle class="acl-ro" cx="70" cy="70" r="65"' +
        ' stroke="url(#aclG)" stroke-width="1.4" opacity="0.9"/>' +
      /* inner ring */
      '<circle class="acl-ri" cx="70" cy="70" r="56"' +
        ' stroke="#c9a84c" stroke-width="0.6" opacity="0.32"/>' +
      /* A letter (even-odd: two overlapping leg paths create inner opening) */
      '<g class="acl-lt">' +
        '<path fill-rule="evenodd" fill="url(#aclG)"' +
          ' d="M70 26 L101 109 L89 109 L76 77 L64 77 Z' +
          '    M70 26 L39 109 L51 109 L64 77 L76 77 Z' +
          '    M60 60 L80 60 L74 73 L66 73 Z"/>' +
        '<rect x="53" y="75" width="34" height="9" rx="1" fill="url(#aclG)"/>' +
      '</g>' +
      /* apex dot */
      '<circle cx="70" cy="26" r="2.2" fill="#f5e899" opacity="0.65"/>' +
    '</svg>' +

    '<p class="ac-i-name">Aurum Capital</p>' +
    '<div class="ac-i-rule"></div>' +
    '<p class="ac-i-tag">Private Wealth · Est. 2007</p>';

  /* Insert as very first child of body so it covers all other content */
  document.body.insertBefore(el, document.body.firstChild);

  /* ── Dismiss sequence ── */
  var tid = setTimeout(dismiss, 2000);

  /* Click anywhere to skip */
  el.addEventListener('click', function () {
    clearTimeout(tid);
    dismiss();
  }, { once: true });

  function dismiss() {
    el.classList.add('ac-out');
    /* Remove from paint tree after transition completes */
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 900);
  }

}());

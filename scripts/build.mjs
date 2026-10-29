// Stamps the shared shell into every page in src/, in place.
// Pages stay plain static HTML; this only rewrites the regions between markers:
//   <style id="app-css">…</style>          ← minified src/styles/app.css
//   <!--@head-->…<!--/@head-->              ← fonts, icons, theme colour
//   <!--@header Label-->…<!--/@header-->    ← top bar with page label
//   <!--@nav key-->…<!--/@nav-->            ← bottom nav, `key` gets aria-current
//   <!--@footer-->…<!--/@footer-->          ← site footer
//   <!--@tail-->…<!--/@tail-->              ← speculation rules + deferred app.js
// Usage: node scripts/build.mjs   (or npm run build)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,>~])\s*/g, '$1') // never touch spaces around + / - (calc needs them)
  .replace(/:\s+/g, ':')
  .replace(/;}/g, '}')
  .trim();

const css = minifyCss(readFileSync(join(src, 'styles/app.css'), 'utf8'));
const shellCss = minifyCss(readFileSync(join(src, 'styles/shell.css'), 'utf8'));

const icon = (d, w = 20, sw = 1.8) =>
  `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  markets: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  portfolio: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
};

// Theme: same storage key and values the site has always used ('light' | 'dark');
// no key = follow the phone. Applied before first paint so there is no flash.
const head = `
<script>/* Signed-in pages: no saved session on this device → straight to sign-in, before anything paints */try{var _p=location.pathname.split('/').pop();if(['dashboard.html','invest.html','trade.html','profile.html','portfolio.html','transactions.html','deposit.html','withdraw.html','admin.html'].indexOf(_p)>=0){var _s=JSON.parse(localStorage.getItem('sb-ttwwthfeordsojmcjwxn-auth-token')||'null');if(!_s||!_s.refresh_token)location.replace('signup.html?next='+encodeURIComponent(_p+location.search))}}catch(e){}</script>
<script>try{if(localStorage.getItem('aurum_live')==='1')document.documentElement.setAttribute('data-live','');var t=localStorage.getItem('aurum_theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}</script>
<script>/* Page scope for in-app navigation (app.js router): listeners and timers a page adds on document/window inside its DOMContentLoaded handler are recorded so the router can remove them when that page is left; after an in-app navigation, a new page's DOMContentLoaded handler runs straight away. */(function(){var D=document,W=window,P=EventTarget.prototype,add=P.addEventListener,rm=P.removeEventListener,st=W.setTimeout,si=W.setInterval,ct=W.clearTimeout,ci=W.clearInterval;var S=W.AurumScope={on:0,spa:0,l:[],t:[],i:[],run:function(h,e){S.on++;try{h.call(D,e)}finally{S.on--}},drop:function(){S.l.forEach(function(x){rm.call(x[0],x[1],x[2],x[3])});S.t.forEach(function(i){ct(i)});S.i.forEach(function(i){ci(i)});S.l=[];S.t=[];S.i=[]}};P.addEventListener=function(t,f,o){if(this===D&&t==="DOMContentLoaded"&&typeof f==="function"){if(S.spa){Promise.resolve().then(function(){S.run(f)});return}return add.call(this,t,function(e){S.run(f,e)},o)}if(S.on&&(this===D||this===W))S.l.push([this,t,f,o]);return add.call(this,t,f,o)};W.setTimeout=function(){var i=st.apply(W,arguments);if(S.on)S.t.push(i);return i};W.setInterval=function(){var i=si.apply(W,arguments);if(S.on)S.i.push(i);return i}})();</script>
<link rel="preload" href="fonts/outfit-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/playfair-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="image/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="image/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta name="theme-color" content="#ECE8E1">
`;

const DEMO_BAR = `<div class="demo-bar" role="note"><b>DEMO</b><span>Demo platform — balances and payments are not real.</span></div>`;
const header = (label) => `
${DEMO_BAR}
<header class="top">
  <a class="brand" href="index.html">
    <span class="logo gold" aria-hidden="true">A</span>
    <span class="stack"><span class="brand-name">Aurum Capital</span><span class="brand-sub">${label}</span></span>
  </a>
  <a class="iconbtn raised-sm" href="profile.html#alerts" aria-label="Notifications">${icon(ICONS.bell)}</a>
</header>
`;

const NAV = [
  ['home', 'index.html', 'Home'],
  ['markets', 'markets.html', 'Markets'],
  ['invest', 'invest.html', 'Invest'],
  ['portfolio', 'dashboard.html', 'Portfolio'],
  ['account', 'profile.html', 'Account'],
];
const nav = (current) => `
<nav class="nav raised" aria-label="Main">
${NAV.map(([key, href, label]) => {
  const cur = key === current ? ' aria-current="page"' : '';
  if (key === 'invest') return `  <a href="${href}" class="fab gold" aria-label="${label}"${cur}>${icon(ICONS.plus, 24, 2.2)}</a>`;
  return `  <a href="${href}"${cur}><span class="ico">${icon(ICONS[key])}</span>${label}</a>`;
}).join('\n')}
</nav>
`;

const SOCIAL = [
  ['https://x.com/AurumCapitalinvest', 'X', '<path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3zm-1.2 18h1.9L7.4 4H5.4z"/>'],
  ['https://linkedin.com/company/aurumcapitalinvest', 'LinkedIn', '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/>'],
  ['https://t.me/AurumCapitalinvest', 'Telegram', '<path d="M21.9 4.3 18.7 19.4c-.24 1.06-.87 1.32-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.02-8.15c.39-.35-.09-.54-.61-.2L6.4 13.1 1.6 11.6c-1.04-.33-1.06-1.04.22-1.54L20.6 2.8c.87-.32 1.63.2 1.3 1.5z"/>'],
];
const footer = `
<footer class="foot stack g20">
  <div class="stack g8">
    <span class="serif" style="font-size:20px">Aurum Capital</span>
    <p class="muted small">Aurum Capital is the private investment platform of choice for discerning investors seeking institutional-grade access to digital assets, global equities, and prime real estate — all in one place.</p>
  </div>
  <div class="cols">
    <div class="stack"><span class="eyebrow" style="margin-bottom:6px">Company</span><a href="about.html">About</a><a href="contact.html">Careers</a><a href="contact.html">Press</a></div>
    <div class="stack"><span class="eyebrow" style="margin-bottom:6px">Explore</span><a href="markets.html">Markets</a><a href="invest.html">Invest</a><a href="markets.html#assets">Assets</a></div>
    <div class="stack"><span class="eyebrow" style="margin-bottom:6px">Support</span><a href="contact.html">Help centre</a><a href="privacy-policy.html#terms">Terms</a><a href="privacy-policy.html">Privacy</a></div>
  </div>
  <div class="row g14">
${SOCIAL.map(([href, name, d]) => `    <a class="social raised-sm" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Aurum Capital on ${name}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg></a>`).join('\n')}
  </div>
  <div class="risk inset"><b>Risk disclaimer.</b> Investing involves substantial risk of loss. Past performance is not indicative of future results. Real estate investments are illiquid and subject to market fluctuations. Aurum Capital is a registered investment platform regulated by <span data-todo="regulator">[REGULATOR NAME]</span> under licence no. <span data-todo="licence">[LICENCE NUMBER]</span>.</div>
  <span class="muted" style="font-size:12px">© 2026 Aurum Capital. All rights reserved.</span>
</footer>
`;

// ── Signed-in app shell ─────────────────────────────────────────────────────
// Pages not rebuilt yet hand off to the classic dashboard, which opens the
// matching window. Switch an entry to its own page when that page is built.
const ROUTES = {
  deposit: "deposit.html",
  withdraw: "withdraw.html",
  transactions: "transactions.html",
  portfolio: "portfolio.html",
};
const APP_ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  invest: ICONS.markets,
};

// <!--@appheader Title|Subtitle--> or <!--@appheader back:Title--> (back arrow to dashboard)
const appHeader = (spec) => {
  const back = spec.startsWith('back:');
  const [title, sub = ''] = (back ? spec.slice(5) : spec).split('|').map((s) => s.trim());
  const left = back
    ? `<a class="iconbtn raised-sm" href="dashboard.html" aria-label="Back to dashboard">${icon(APP_ICONS.back, 18, 2)}</a>
    <span class="who-title grow" style="text-align:center">${title}</span>`
    : `<a class="who" href="profile.html" aria-label="Open profile">
    <span class="avatar raised-sm"><span data-avatar>&nbsp;</span></span>
    <span class="stack" style="min-width:0"><span class="who-sub"${sub ? "" : " data-greeting"}>${sub || "&nbsp;"}</span><span class="who-title">${title}</span></span>
  </a>`;
  return `
${DEMO_BAR}
<header class="top">
  ${left}
  <div class="row g12">
    <button class="iconbtn raised-sm" data-open="menu" aria-label="Menu">${icon(APP_ICONS.grid, 19, 1.9)}</button>
    ${back ? '' : `<a class="iconbtn raised-sm" href="profile.html#alerts" aria-label="Notifications">${icon(ICONS.bell, 19, 1.9)}<span class="bell-dot" data-unread hidden></span></a>`}
  </div>
</header>
<div class="test-banner" data-test-banner hidden style="margin:0 var(--gut) 10px" role="status"><b>TEST MODE</b><span>Figures marked TEST include admin test values and are not real.</span></div>
`;
};

const BOLD = {"dash":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"2\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"2\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"2\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"2\"/></svg>","invest":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/></svg>","trade":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4\"/></svg>","crypto":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.5 8h4a2 2 0 0 1 0 4h-4zm0 4h4.5a2 2 0 0 1 0 4H9.5zM10.5 6v2m0 8v2m3-12v2m0 8v2\"/></svg>","equities":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 21h18M5 21V10m4.5 11V10m5 11V10M19 21V10M12 3 3 8h18z\"/></svg>","commodities":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 18h16l-2.5-6h-11z\"/><path d=\"M7.5 12 9 7h6l1.5 5\"/></svg>","tx":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 6h13M8 12h13M8 18h13\"/><circle cx=\"4\" cy=\"6\" r=\"1.2\"/><circle cx=\"4\" cy=\"12\" r=\"1.2\"/><circle cx=\"4\" cy=\"18\" r=\"1.2\"/></svg>","support":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z\"/><path d=\"M8.5 11h.01M12 11h.01M15.5 11h.01\"/></svg>","plus":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>","up":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 19V5M5 12l7-7 7 7\"/></svg>","house":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z\"/></svg>"};
const MENU = [
  ['dashboard', 'dashboard.html', BOLD.dash, 'Dashboard', 'Portfolio overview'],
  ['invest', 'invest.html', BOLD.invest, 'Invest', 'Explore markets'],
  ['trade', 'trade.html', BOLD.trade, 'Trade', 'Practice or live execution'],
  ['crypto', 'invest.html#crypto', BOLD.crypto, 'Cryptocurrency', 'BTC · ETH · SOL · more'],
  ['equities', 'invest.html#equities', BOLD.equities, 'Global equities', 'TSLA · AAPL · NVDA · more'],
  ['commodities', 'invest.html#commodities', BOLD.commodities, 'Commodities', 'Gold · Oil · Silver'],
  ['transactions', ROUTES.transactions, BOLD.tx, 'Transactions', 'Full ledger'],
  ['support', 'contact.html', BOLD.support, 'Support', 'Talk to an advisor'],
];
const STRIP = [['BTC', 'BTC'], ['ETH', 'ETH'], ['SOL', 'SOL'], ['XRP', 'XRP'], ['Gold', 'XAUUSD']];
const appMenu = (current) => `
<div class="menu app" id="menu" hidden role="dialog" aria-label="Menu">
  <div class="top" style="position:static">
    <span class="row g12"><span class="logo gold" aria-hidden="true">A</span><span class="serif" style="font-size:21px;letter-spacing:.04em">Aurum</span></span>
    <button class="iconbtn inset" data-close="menu" aria-label="Close menu">${icon(APP_ICONS.close, 18, 2)}</button>
  </div>
  <div class="menu-body">
    <div class="vault strip scrollx mono" aria-label="Live prices">
${STRIP.map(([label, sym]) => `      <span><b>${label}</b> <span data-price="${sym}">—</span> <span data-chg="${sym}" class="flat">—</span></span>`).join('\n')}
    </div>
    <div class="stack g10">
      <span class="eyebrow">Navigate</span>
      <nav class="raised" style="border-radius:22px;padding:6px" aria-label="All sections">
${MENU.map(([key, href, glyph, label, sub]) => `        <a class="mi" href="${href}"${key === current ? ' aria-current="page"' : ''}><span class="badge inset" aria-hidden="true">${glyph}</span><span class="grow stack" style="gap:2px"><b style="font-size:15px">${label}</b><span class="mono muted" style="font-size:11px">${sub}</span></span><span class="muted" aria-hidden="true">›</span></a>`).join('\n')}
      </nav>
    </div>
    <a href="${ROUTES.deposit}" class="btn gold" style="text-transform:none;letter-spacing:0">+ Deposit funds</a>
    <span class="row g8 muted" style="justify-content:center;font-size:11px;letter-spacing:.14em;text-transform:uppercase"><span class="dot" aria-hidden="true"></span>All systems operational</span>
  </div>
</div>
`;

const SHEET = [
  [ROUTES.deposit, 'gold', BOLD.plus, 'Deposit funds', 'Bank transfer, card or crypto'],
  [ROUTES.withdraw, 'inset', BOLD.up, 'Withdraw', 'To your bank or wallet'],
  ['trade.html', 'inset', BOLD.trade, 'Trade', 'Practice or live'],
  ['invest.html', 'inset', BOLD.house, 'New investment', 'Equities or real estate'],
];
const sheet = `
<div class="overlay" id="sheet" hidden>
  <button class="scrim" data-close="sheet" aria-label="Close quick actions"></button>
  <div class="sheet" role="dialog" aria-label="Quick actions">
    <span class="grab" aria-hidden="true"></span><span class="eyebrow">Quick actions</span>
${SHEET.map(([href, cls, glyph, label, sub]) => `    <a href="${href}" class="sheet-btn raised-sm"><span class="badge ${cls}" aria-hidden="true">${glyph}</span><span class="stack"><b style="font-size:14px">${label}</b><span class="muted" style="font-size:12px">${sub}</span></span></a>`).join('\n')}
  </div>
</div>
`;

const APP_NAV = [
  ['home', 'dashboard.html', 'Home', ICONS.home],
  ['invest', 'invest.html', 'Invest', APP_ICONS.invest],
  ['fab'],
  ['portfolio', ROUTES.portfolio, 'Portfolio', ICONS.portfolio],
  ['account', 'profile.html', 'Account', ICONS.account],
];
const appNav = (current) => `
<nav class="nav raised" aria-label="Main">
${APP_NAV.map(([key, href, label, d]) => key === 'fab'
  ? `  <button class="fab gold" data-open="sheet" aria-label="Quick actions">${icon(ICONS.plus, 24, 2.2)}</button>`
  : `  <a href="${href}"${key === current ? ' aria-current="page"' : ''}><span class="ico">${icon(d)}</span>${label}</a>`).join('\n')}
</nav>
`;

// Navigation: app.js swaps shell pages in place (no reload); these rules only warm the
// HTTP cache (bottom nav, menu and quick actions eagerly, other links on touch/hover).
const tail = `
<script type="speculationrules">{"prefetch":[{"source":"document","where":{"selector_matches":".nav a, .sheet a, .qa, .mi"},"eagerness":"eager"},{"source":"document","where":{"href_matches":"/*"},"eagerness":"moderate"}]}</script>
<script src="app.js" defer></script>
`;

// Pages not rebuilt yet (no shared shell) get the DEMO badge from one tiny script
const LEGACY = `<!--@demo--><script src="demo-badge.js" defer></script><!--/@demo-->`;

const pages = readdirSync(src).filter((f) => f.endsWith('.html'));
let touched = 0;
for (const file of pages) {
  const path = join(src, file);
  const before = readFileSync(path, 'utf8');
  let after = before;
  if (!/<style id="app-css">/.test(before) && /<\/body>/i.test(before)) {
    after = /<!--@demo-->/.test(after)
      ? after.replace(/<!--@demo-->[\s\S]*?<!--\/@demo-->/, LEGACY)
      : after.replace(/<\/body>/i, LEGACY + '</body>');
  }
  after = after
    .replace(/(<style id="app-css">)[\s\S]*?(<\/style>)/, (_, a, b) => a + css + b)
    .replace(/(<!--@head-->)[\s\S]*?(<!--\/@head-->)/, (_, a, b) => a + head + b)
    .replace(/(<!--@header ([^>]*?)-->)[\s\S]*?(<!--\/@header-->)/, (_, a, label, b) => a + header(label.trim()) + b)
    .replace(/(<!--@nav (\w+)-->)[\s\S]*?(<!--\/@nav-->)/, (_, a, key, b) => a + nav(key) + b)
    .replace(/(<!--@footer-->)[\s\S]*?(<!--\/@footer-->)/, (_, a, b) => a + footer + b)
    .replace(/(<!--@tail-->)[\s\S]*?(<!--\/@tail-->)/, (_, a, b) => a + tail + b)
    .replace(/(<style id="shell-css">)[\s\S]*?(<\/style>)/, (_, a, b) => a + shellCss + b)
    .replace(/(<!--@appheader ([^>]*?)-->)[\s\S]*?(<!--\/@appheader-->)/, (_, a, spec, b) => a + appHeader(spec) + b)
    .replace(/(<!--@appmenu (\w*)-->)[\s\S]*?(<!--\/@appmenu-->)/, (_, a, key, b) => a + appMenu(key) + b)
    .replace(/(<!--@sheet-->)[\s\S]*?(<!--\/@sheet-->)/, (_, a, b) => a + sheet + b)
    .replace(/(<!--@appnav (\w*)-->)[\s\S]*?(<!--\/@appnav-->)/, (_, a, key, b) => a + appNav(key) + b);
  if (after === before) continue;
  writeFileSync(path, after);
  touched++;
  const inline = (after.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('');
  console.log(`${file.padEnd(22)} html ${(after.length / 1024).toFixed(1)} KB · gzip ${(gzipSync(after).length / 1024).toFixed(1)} KB · inline css ${(inline.length / 1024).toFixed(1)} KB`);
}
console.log(`app.css → ${(css.length / 1024).toFixed(1)} KB minified; ${touched} page(s) updated`);

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

const head = `
<link rel="preload" href="fonts/outfit-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/playfair-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="image/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="image/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta name="theme-color" content="#ECE8E1">
`;

const header = (label) => `
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

// Prerender static pages on hover/touch intent; app pages that run auth and
// realtime code on load are only prefetched, so a prerender never opens sockets.
const tail = `
<script type="speculationrules">{"prerender":[{"source":"document","where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":["/dashboard.html","/trade.html","/profile.html","/signup.html"]}}]},"eagerness":"moderate"}],"prefetch":[{"source":"document","where":{"href_matches":["/dashboard.html","/trade.html","/profile.html","/signup.html"]},"eagerness":"moderate"}]}</script>
<script src="app.js" defer></script>
`;

const pages = readdirSync(src).filter((f) => f.endsWith('.html'));
let touched = 0;
for (const file of pages) {
  const path = join(src, file);
  const before = readFileSync(path, 'utf8');
  const after = before
    .replace(/(<style id="app-css">)[\s\S]*?(<\/style>)/, (_, a, b) => a + css + b)
    .replace(/(<!--@head-->)[\s\S]*?(<!--\/@head-->)/, (_, a, b) => a + head + b)
    .replace(/(<!--@header ([^>]*?)-->)[\s\S]*?(<!--\/@header-->)/, (_, a, label, b) => a + header(label.trim()) + b)
    .replace(/(<!--@nav (\w+)-->)[\s\S]*?(<!--\/@nav-->)/, (_, a, key, b) => a + nav(key) + b)
    .replace(/(<!--@footer-->)[\s\S]*?(<!--\/@footer-->)/, (_, a, b) => a + footer + b)
    .replace(/(<!--@tail-->)[\s\S]*?(<!--\/@tail-->)/, (_, a, b) => a + tail + b);
  if (after === before) continue;
  writeFileSync(path, after);
  touched++;
  const inline = (after.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('');
  console.log(`${file.padEnd(22)} html ${(after.length / 1024).toFixed(1)} KB · gzip ${(gzipSync(after).length / 1024).toFixed(1)} KB · inline css ${(inline.length / 1024).toFixed(1)} KB`);
}
console.log(`app.css → ${(css.length / 1024).toFixed(1)} KB minified; ${touched} page(s) updated`);

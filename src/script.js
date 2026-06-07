/* ================================================================
   script.js  —  Aurum Capital Landing Page  (LIVE PRICES EDITION)
   ─────────────────────────────────────────────────────────────────
   Depends on coingecko-sync.js loaded BEFORE this file.
   coingecko-sync.js calls window.onPriceUpdate(sym, price, chg)
   every 30 s with real CoinGecko data.
================================================================ */

/* ── SCROLL REVEAL ────────────────────────────────────── */
const ro = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
}), { rootMargin: '0px 0px -70px 0px', threshold: .08 });
document.querySelectorAll('.reveal').forEach(el => ro.observe(el));

/* ── ALLOCATION BARS ──────────────────────────────────── */
const abo = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.style.width = e.target.dataset.w + '%'; abo.unobserve(e.target); }
}), { threshold: .5 });
document.querySelectorAll('.alloc-fill').forEach(el => abo.observe(el));

/* ═══════════════════════════════════════════════════════
   MASTER ASSETS LIST
   Prices are LIVE — updated by window.onPriceUpdate()
═══════════════════════════════════════════════════════ */
const ASSETS = [
  // Crypto  — prices come from CoinGecko
  { sym:'BTC',  name:'Bitcoin',       cat:'crypto',      price:67430,  chg:0,   mcap:'$1.33T', icon:'fab fa-bitcoin',   color:'#f7931a' },
  { sym:'ETH',  name:'Ethereum',      cat:'crypto',      price:3280,   chg:0,   mcap:'$394B',  icon:'fab fa-ethereum',  color:'#627eea' },
  { sym:'BNB',  name:'BNB Chain',     cat:'crypto',      price:612,    chg:0,   mcap:'$91B',   icon:'fas fa-coins',     color:'#f3ba2f' },
  { sym:'SOL',  name:'Solana',        cat:'crypto',      price:188,    chg:0,   mcap:'$88B',   icon:'fas fa-sun',       color:'#9945ff' },
  { sym:'XRP',  name:'Ripple',        cat:'crypto',      price:0.72,   chg:0,   mcap:'$40B',   icon:'fas fa-water',     color:'#00aae4' },
  // Stocks  — jittered until a stocks API is wired in
  { sym:'TSLA', name:'Tesla Inc.',    cat:'stocks',      price:248.50, chg:0,   mcap:'$792B',  icon:'fas fa-car',       color:'#e31937' },
  { sym:'AAPL', name:'Apple Inc.',    cat:'stocks',      price:189.30, chg:0,   mcap:'$2.92T', icon:'fab fa-apple',     color:'#a2aaad' },
  { sym:'NVDA', name:'NVIDIA Corp',   cat:'stocks',      price:875.20, chg:0,   mcap:'$2.16T', icon:'fas fa-microchip', color:'#76b900' },
  { sym:'MSFT', name:'Microsoft',     cat:'stocks',      price:412.70, chg:0,   mcap:'$3.07T', icon:'fab fa-windows',   color:'#00a4ef' },
  { sym:'AMZN', name:'Amazon',        cat:'stocks',      price:195.50, chg:0,   mcap:'$2.03T', icon:'fab fa-amazon',    color:'#ff9900' },
  // Commodities — jittered
  { sym:'GOLD', name:'Gold Spot',     cat:'commodities', price:2350,   chg:0,   mcap:'$14.6T', icon:'fas fa-gem',       color:'#c9a84c' },
];

/* Derive `up` flag from chg */
ASSETS.forEach(a => { a.up = a.chg >= 0; });

/* ── Hero portfolio card demo holdings ─────────────────── */
const HERO_HOLDINGS = { BTC: 0.80, ETH: 8.50, XRP: 8000 };
const HERO_CASH     = 28040;

/* Freeze live-update for N ms after a real tick so jitter doesn't overwrite */
const _priceFreezeUntil = {};
const FREEZE_MS = 35_000;   // 35 s — slightly longer than the 30 s poll


/* Recomputes the hero card portfolio value */
function updateHeroPortfolio() {
  let total = HERO_CASH;
  for (const [sym, qty] of Object.entries(HERO_HOLDINGS)) {
    const a = ASSETS.find(x => x.sym === sym);
    if (a) total += a.price * qty;
  }
  const el = document.getElementById('hero-port-val');
  if (el) el.textContent = '$' + fmtUSD(total);

  let weightedChg = 0, portValue = total - HERO_CASH;
  for (const [sym, qty] of Object.entries(HERO_HOLDINGS)) {
    const a = ASSETS.find(x => x.sym === sym);
    if (a && portValue > 0) weightedChg += (a.price * qty / portValue) * a.chg;
  }
  const chgEl = document.getElementById('hero-port-chg');
  if (chgEl) {
    chgEl.textContent = (weightedChg >= 0 ? '+' : '') + weightedChg.toFixed(1) + '%';
    chgEl.className   = 'pc-change ' + (weightedChg >= 0 ? 'up' : 'dn');
  }
}

/* ═══════════════════════════════════════════════════════
   SPARKLINE / CHART HELPERS
═══════════════════════════════════════════════════════ */
function genSparkData(up, n = 11) {
  const pts = []; let v = 50;
  for (let i = 0; i < n; i++) {
    v += ((Math.random() - .4) * (up ? .8 : 1.2)) * 12;
    v = Math.max(5, Math.min(95, v));
    pts.push(v);
  }
  return pts;
}

function sparkPath(pts, W = 140, H = 44) {
  const minV = Math.min(...pts), maxV = Math.max(...pts), range = maxV - minV || 1;
  return pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - (((v - minV) / range) * (H - 8) + 4);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}

/* ═══════════════════════════════════════════════════════
   BUILD MARKET CARDS
═══════════════════════════════════════════════════════ */
function buildMarketCards(filter = 'all') {
  const grid    = document.getElementById('marketGrid');
  if (!grid) return;
  const visible = filter === 'all' ? ASSETS : ASSETS.filter(a => a.cat === filter);
  grid.innerHTML = visible.map(a => {
    const pts      = genSparkData(a.up);
    const sp       = sparkPath(pts);
    const areaPath = sp + ` L${140},${44} L0,${44} Z`;
    const chgStr   = (a.chg > 0 ? '+' : '') + Number(a.chg).toFixed(2) + '%';
    return `
      <div class="market-card" data-cat="${a.cat}" style="cursor:pointer" onclick="typeof openAssetChart==='function'&&openAssetChart('${a.sym}')">
        <div class="mc-top">
          <div class="mc-icon-wrap">
            <div class="mc-icon" style="background:${a.color}18;color:${a.color}"><i class="${a.icon}"></i></div>
            <div><div class="mc-sym">${a.sym}</div><div class="mc-name">${a.name}</div></div>
          </div>
          <span class="mc-badge ${a.up ? 'up' : 'dn'}" id="mc-chg-${a.sym}">${chgStr}</span>
        </div>
        <div class="mc-price" id="mc-pr-${a.sym}">$${fmtPrice(a.price)}</div>
        <div class="mc-vol">Vol: ${a.mcap}</div>
        <svg class="mc-sparkline" viewBox="0 0 140 44" preserveAspectRatio="none">
          <path class="spark-path ${a.up ? 'up' : 'dn'}" d="${sp}"/>
          <path class="spark-area ${a.up ? 'up' : 'dn'}" d="${areaPath}"/>
        </svg>
      </div>`;
  }).join('');
}

/* ── TAB FILTER ──────────────────────────────────────── */
function filterMarkets(cat, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  buildMarketGrid(cat === 'all' || !cat ? 'all' : cat);
}
window.filterMarkets = filterMarkets;

/* ═══════════════════════════════════════════════════════
   BUILD ASSETS TABLE
═══════════════════════════════════════════════════════ */
function buildAssetsTable() {
  const tbody = document.getElementById('assetsTbody');
  if (!tbody) return;
  tbody.innerHTML = ASSETS.slice(0, 10).map((a) => {
    const pts    = genSparkData(a.up, 7);
    const chgStr = (a.chg > 0 ? '+' : '') + Number(a.chg).toFixed(2) + '%';
    const sp     = sparkPath(pts, 80, 28);
    return `
      <tr style="cursor:pointer" onclick="typeof openAssetChart==='function'&&openAssetChart('${a.sym}')">
        <td>
          <div class="tbl-asset">
            <div class="tbl-icon" style="background:${a.color}18;color:${a.color}"><i class="${a.icon}"></i></div>
            <div><div class="tbl-sym">${a.sym}</div><div class="tbl-full">${a.name}</div></div>
          </div>
        </td>
        <td class="tbl-price" id="tbl-pr-${a.sym}">$${fmtPrice(a.price)}</td>
        <td><span class="tbl-chg ${a.up ? 'up' : 'dn'}" id="tbl-chg-${a.sym}">${chgStr}</span></td>
        <td class="tbl-mktcap">${a.mcap}</td>
        <td>
          <svg viewBox="0 0 80 28" width="80" height="28" style="overflow:visible">
            <path stroke="${a.up ? 'var(--green)' : 'var(--red)'}" stroke-width="1.5" fill="none" d="${sp}"/>
          </svg>
        </td>
        <td style="text-align:right"><button class="tbl-btn"><a href="invest.html">Invest</a></button></td>
      </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   BUILD TICKER
═══════════════════════════════════════════════════════ */
function buildTicker() {
  const inner = document.getElementById('tickerInner');
  if (!inner) return;
  const items = [...ASSETS, ...ASSETS].map(a => {
    const chg = (a.chg > 0 ? '+' : '') + Number(a.chg).toFixed(2) + '%';
    return `<span class="t-item">
      <span class="t-sym">${a.sym}</span>
      <span class="t-price">$${fmtPrice(a.price)}</span>
      <span class="t-chg ${a.up ? 'up' : 'dn'}">${chg}</span>
    </span>`;
  }).join('');
  inner.innerHTML = items;
}

/* ═══════════════════════════════════════════════════════
   FORMATTERS
═══════════════════════════════════════════════════════ */
function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(2);
  return p.toFixed(4);
}

function fmtUSD(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Flash animation styles ─────────────────────────── */
const _fstyle = document.createElement('style');
_fstyle.textContent = `
  @keyframes flashUp { 0%{color:#22c55e;text-shadow:0 0 10px rgba(34,197,94,.7)} 100%{color:inherit;text-shadow:none} }
  @keyframes flashDn { 0%{color:#ef4444;text-shadow:0 0 10px rgba(239,68,68,.7)} 100%{color:inherit;text-shadow:none} }
  .flash-up { animation: flashUp 1.4s ease forwards !important; }
  .flash-dn  { animation: flashDn 1.4s ease forwards !important; }
`;
document.head.appendChild(_fstyle);

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  buildMarketGrid('all');
  buildAssetsTable();
  updateHeroPortfolio();
});

/**
 * chart-fix-patch.js
 * ══════════════════════════════════════════════════════════════════════════════
 * DROP-IN REPLACEMENT for the inline <script> block at the bottom of index.html
 * (everything between the two "ASSET REGISTRY" and "PAGE INIT" comments).
 *
 * FIXES:
 *  1. IDX_P is kept in sync with every CoinGecko broadcast — no stale seeds.
 *  2. openAssetChart() waits for a real live price before building the chart.
 *  3. buildChart() fetches REAL historical OHLCV from CoinGecko /market_chart
 *     for each symbol + timeframe, then falls back to synthetic gen if the
 *     API call fails (rate-limit, network, etc.).
 *  4. The hero portfolio card prices (pr-BTC, pr-XRP …) are updated via the
 *     same onPriceUpdate path — no separate wiring needed.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * INTEGRATION — replace the entire inline <script> at the bottom of index.html
 * with:
 *
 *   <script src="chart-fix-patch.js"></script>
 *
 * (Keep price-sync.js and script.js as they are.)
 */

/* ═══════════════════════════════════════════════════════
   ASSET REGISTRY
═══════════════════════════════════════════════════════ */
const IDX_META = {
  BTC:  { icon:'fab fa-bitcoin',       color:'#f7931a', name:'Bitcoin',   cat:'crypto',      mcap:1920e9, cgId:'bitcoin'     },
  ETH:  { icon:'fab fa-ethereum',      color:'#627eea', name:'Ethereum',  cat:'crypto',      mcap:395e9,  cgId:'ethereum'    },
  SOL:  { icon:'fas fa-sun',           color:'#9945ff', name:'Solana',    cat:'crypto',      mcap:82e9,   cgId:'solana'      },
  BNB:  { icon:'fas fa-coins',         color:'#f3ba2f', name:'BNB Chain', cat:'crypto',      mcap:90e9,   cgId:'binancecoin' },
  XRP:  { icon:'fas fa-water',         color:'#00aae4', name:'Ripple',    cat:'crypto',      mcap:38e9,   cgId:'ripple'      },
  ADA:  { icon:'fas fa-circle-nodes',  color:'#3cc8c8', name:'Cardano',   cat:'crypto',      mcap:17e9,   cgId:'cardano'     },
  TSLA: { icon:'fas fa-car',           color:'#e31937', name:'Tesla',     cat:'stocks',      mcap:790e9,  cgId:null          },
  AAPL: { icon:'fab fa-apple',         color:'#a2aaad', name:'Apple',     cat:'stocks',      mcap:2900e9, cgId:null          },
  NVDA: { icon:'fas fa-microchip',     color:'#76b900', name:'NVIDIA',    cat:'stocks',      mcap:2150e9, cgId:null          },
  MSFT: { icon:'fab fa-windows',       color:'#00a4ef', name:'Microsoft', cat:'stocks',      mcap:3060e9, cgId:null          },
  GOLD:   { icon:'fas fa-gem',        color:'#c9a84c', name:'Gold Spot',   cat:'commodities', mcap:14e12,   cgId:null },
  OIL:    { icon:'fas fa-oil-can',    color:'#8b5e3c', name:'Crude Oil',   cat:'commodities', mcap:1.8e12,  cgId:null },
  SILVER: { icon:'fas fa-circle',     color:'#adb5c0', name:'Silver Spot', cat:'commodities', mcap:1.5e12,  cgId:null },
};

/* ── Canonical price + change store (single source of truth) ── */
const IDX_P = { BTC:94000, ETH:3500, SOL:245, BNB:680, XRP:0.62, ADA:0.52, TSLA:350, AAPL:205, NVDA:1080, MSFT:440, GOLD:3200, OIL:70, SILVER:32 };
const IDX_C = { BTC:2.8,  ETH:1.4,  SOL:3.1, BNB:-0.9, XRP:-1.2, ADA:0.8, TSLA:-0.6, AAPL:0.4, NVDA:2.1, MSFT:0.8, GOLD:0.4, OIL:-0.7, SILVER:1.1 };

/* Per-symbol 24h stats derived at chart-open time */
const IDX_STATS = {};

/* ── formatters ── */
const fmtP = p => p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
                             : p >= 1    ? p.toFixed(2)
                             : p.toFixed(4);
const fmtB = n => n >= 1e12 ? '$' + (n/1e12).toFixed(2) + 'T'
                 : n >= 1e9  ? '$' + (n/1e9 ).toFixed(2) + 'B'
                 : n >= 1e6  ? '$' + (n/1e6 ).toFixed(2) + 'M'
                 : '$' + n.toFixed(0);
const fmtV = v => v >= 1e9 ? (v/1e9).toFixed(2) + 'B'
                 : v >= 1e6 ? (v/1e6).toFixed(2) + 'M'
                 : v >= 1e3 ? (v/1e3).toFixed(1) + 'K'
                 : v.toFixed(0);
const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

/* ═══════════════════════════════════════════════════════
   CHART STATE
═══════════════════════════════════════════════════════ */
var _chartSym   = null;
var _chartType  = 'candlestick';
var _chartTF    = '1D';
var _chartInst  = null;
var _volInst    = null;
var _mainSer    = null;
var _volSer     = null;
var _chartBars  = [];
var _lastBarTime = 0;
var _buildGen   = 0;

// Rebuild the chart whenever the page theme is toggled (dark ↔ light)
new MutationObserver(function(muts) {
  muts.forEach(function(m) {
    if (m.attributeName !== 'data-theme' || !_chartSym) return;
    var modal = document.getElementById('idx-chart-modal');
    if (modal && modal.classList.contains('open')) buildChart(_chartSym, _chartType, _chartTF);
  });
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* Track which symbols have received a confirmed live price (not just a seed) */
var _livePriceTs = {};   /* sym → timestamp of last live price */

/* ═══════════════════════════════════════════════════════
   window.onPriceUpdate  — central broadcast
   Keeps IDX_P / IDX_C in sync AND updates every DOM element
═══════════════════════════════════════════════════════ */
window.onPriceUpdate = function (sym, newPrice, newChg) {
  if (!newPrice || newPrice <= 0) return;

  /* Guard: if we already have a live (edge-function) price for this symbol
     that arrived within the last 20 s, and this broadcast is the same as
     a known seed value, ignore it — it's likely coingecko-sync's initial
     seed broadcast racing with real data. */
  var SEED_PRICES = { BTC:94000, ETH:3500, SOL:245, BNB:680, XRP:0.62, ADA:0.52,
                      TSLA:350, AAPL:205, NVDA:1080, MSFT:440, GOLD:3200, OIL:70, SILVER:32 };
  var isStale = (SEED_PRICES[sym] !== undefined && newPrice === SEED_PRICES[sym]);
  if (isStale && _livePriceTs[sym] && (Date.now() - _livePriceTs[sym] < 20000)) return;

  /* Mark as live if it differs from seed */
  if (!isStale) _livePriceTs[sym] = Date.now();

  /* ★ Always keep canonical stores up-to-date */
  IDX_P[sym] = newPrice;
  if (newChg != null) IDX_C[sym] = newChg;

  const chg  = IDX_C[sym] ?? 0;
  const up   = chg >= 0;
  const pStr = '$' + fmtP(newPrice);
  const cStr = (up ? '+' : '') + Number(chg).toFixed(2) + '%';

  /* ① Hero card */
  const prEl = document.getElementById('pr-' + sym);
  if (prEl) {
    prEl.textContent = pStr;
    prEl.classList.remove('px-flash');
    void prEl.offsetWidth;
    prEl.classList.add('px-flash');
  }
  const chgEl = document.getElementById('chg-' + sym);
  if (chgEl) { chgEl.textContent = cStr; chgEl.className = 'asset-chg ' + (up ? 'up' : 'dn'); }

  /* ② Market grid */
  const mgP = document.getElementById('mg-p-' + sym);
  if (mgP) {
    mgP.textContent = pStr;
    mgP.classList.remove('px-flash');
    void mgP.offsetWidth;
    mgP.classList.add('px-flash');
  }
  const mgC = document.getElementById('mg-c-' + sym);
  if (mgC) {
    mgC.textContent  = cStr;
    mgC.style.color  = up ? 'var(--green)' : 'var(--red)';
    mgC.style.background = up ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)';
  }

  /* ③ Assets table */
  const tbP = document.getElementById('tb-p-' + sym);
  if (tbP) tbP.textContent = pStr;
  const tbC = document.getElementById('tb-c-' + sym);
  if (tbC) {
    tbC.textContent  = cStr;
    tbC.style.color  = up ? 'var(--green)' : 'var(--red)';
    tbC.style.background = up ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)';
  }

  /* ④ Ticker — inline ticker (tick-px-* / tick-chg-* IDs, two copies) */
  ['', '-2'].forEach(function(sfx) {
    const tPx  = document.getElementById('tick-px-'  + sym + sfx);
    const tChg = document.getElementById('tick-chg-' + sym + sfx);
    if (tPx)  { tPx.textContent = pStr; tPx.classList.remove('loading'); }
    if (tChg) { tChg.textContent = cStr; tChg.className = 'tick-chg ' + (up ? 'up' : 'dn'); tChg.style.display = ''; }
  });
  /* also class-based ticker (tk-p-* / tk-c-*) for fallback */
  document.querySelectorAll('.tk-p-' + sym).forEach(el => el.textContent = pStr);
  document.querySelectorAll('.tk-c-' + sym).forEach(el => { el.textContent = cStr; el.style.color = up ? '#22c55e' : '#ef4444'; });

  /* ⑤ Chart modal — if this symbol is currently open */
  if (_chartSym === sym) {
    const cpEl = document.getElementById('cha-price');
    if (cpEl) {
      cpEl.textContent = pStr;
      cpEl.classList.remove('chart-px-flash');
      void cpEl.offsetWidth;
      cpEl.classList.add('chart-px-flash');
    }
    const cc = document.getElementById('cha-chg');
    if (cc) {
      cc.textContent       = cStr;
      cc.style.background  = up ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)';
      cc.style.color       = up ? '#22c55e' : '#ef4444';
    }
    updateChartStatStrip(sym, newPrice);
    pushLiveBarUpdate(sym, newPrice);
  }

  /* ⑥ Mobile menu coin strip */
  const mmPx  = document.getElementById('mm-px-'  + sym);
  const mmChg = document.getElementById('mm-chg-' + sym);
  if (mmPx)  mmPx.textContent  = pStr;
  if (mmChg) { mmChg.textContent = cStr; mmChg.className = 'mm-coin-chg ' + (up ? 'chg-up' : 'chg-dn'); }

  /* ⑦ Rebuild ticker */
  buildTicker();
};

/* ── Update the 24H High/Low stat strip as live price moves ── */
function updateChartStatStrip(sym, livePrice) {
  const st = IDX_STATS[sym];
  if (!st) return;
  if (livePrice > st.high) { st.high = livePrice; setT('cha-high', '$' + fmtP(st.high)); }
  if (livePrice < st.low)  { st.low  = livePrice; setT('cha-low',  '$' + fmtP(st.low));  }
}

/* ── Push live close onto the last rendered bar ── */
function pushLiveBarUpdate(sym, livePrice) {
  if (!_mainSer || !_chartBars.length) return;
  const last = _chartBars[_chartBars.length - 1];
  if (!last) return;
  const dec  = livePrice >= 1 ? 2 : 4;
  last.close = +livePrice.toFixed(dec);
  last.high  = +Math.max(last.high, last.close).toFixed(dec);
  last.low   = +Math.min(last.low,  last.close).toFixed(dec);

  try {
    if (_chartType === 'candlestick' || _chartType === 'bar') {
      _mainSer.update(last);
    } else {
      _mainSer.update({ time: last.time, value: last.close });
    }
  } catch (e) {}

  if (_volSer) {
    try {
      _volSer.update({
        time:  last.time,
        value: last.volume,
        color: last.close >= last.open ? 'rgba(34,197,94,.38)' : 'rgba(239,68,68,.38)',
      });
    } catch (e) {}
  }

  showOHLCV(last, _chartType, _chartBars[0] ? _chartBars[0].open : last.open);
}

/* ═══════════════════════════════════════════════════════
   REAL HISTORICAL DATA  — Twelve Data (primary) → CoinGecko (crypto fallback)
═══════════════════════════════════════════════════════ */

const EDGE_OHLCV_URL = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/get-ohlcv';
const EDGE_ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';

/* ── Binance direct fetch (crypto, no API key) ── */
const _idxBinanceCache = {};
const _idxTDCache = {};
const IDX_BINANCE_SYMS = new Set(['BTC','ETH','SOL','BNB','XRP','ADA']);
const IDX_BINANCE_CFG = {
  '5M' :['5m',  1000, 300    ],
  '1H' :['1h',  1000, 3600   ],
  '4H' :['4h',  1000, 14400  ],
  '1D' :['1d',  1000, 86400  ],
  '1W' :['1w',   500, 604800 ],
  '1M' :['1M',   120, 2592000],
  '3M' :['1d',   180, 86400  ],
  '1Y' :['1d',  1000, 86400  ],
};
const IDX_VIEW_BARS = {
  '5M': 96,   // 8 h default, scroll back 3.5 days
  '1H': 168,  // 7 days default, scroll back 42 days
  '4H': 90,   // 15 days default, scroll back 167 days
  '1D': 180,  // 6 months default, scroll back 2.7 years
  '1W': 104,  // 2 years default
  '1M': 60,   // 5 years default
  '3M': 90,   // 6 months
  '1Y': 365,  // 1 year
};

async function fetchIdxBinanceKlines(sym, tf) {
  const ck = sym + '_' + tf;
  const cc = _idxBinanceCache[ck];
  if (cc && Date.now() - cc.ts < 60000) return cc.bars;
  const cfg = IDX_BINANCE_CFG[tf];
  if (!cfg) throw new Error('No Binance cfg for ' + tf);
  const [interval, limit] = cfg;
  const res = await fetch('https://api.binance.com/api/v3/klines?symbol=' + sym + 'USDT&interval=' + interval + '&limit=' + limit, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Binance HTTP ' + res.status);
  const raw = await res.json();
  if (!Array.isArray(raw) || !raw.length) throw new Error('No data');
  const seen = new Set();
  const dec  = (IDX_P[sym] >= 1) ? 2 : 4;
  const liveP = IDX_P[sym];
  const bars = raw
    .map(k => ({ time: Math.floor(k[0]/1000), open: +parseFloat(k[1]).toFixed(dec), high: +parseFloat(k[2]).toFixed(dec), low: +parseFloat(k[3]).toFixed(dec), close: +parseFloat(k[4]).toFixed(dec), volume: Math.floor(parseFloat(k[5])) }))
    .filter(b => b.open > 0 && !seen.has(b.time) && seen.add(b.time))
    .sort((a, b) => a.time - b.time);
  if (bars.length && liveP > 0) {
    const last = bars[bars.length-1];
    last.close = +liveP.toFixed(dec);
    last.high  = +Math.max(last.high, last.close).toFixed(dec);
    last.low   = +Math.min(last.low,  last.close).toFixed(dec);
  }
  _lastBarTime = bars.length ? bars[bars.length-1].time : 0;
  _idxBinanceCache[ck] = { bars, ts: Date.now() };
  return bars;
}

/* ── Fetch OHLCV from the Twelve Data edge function ─────────────────────── */
async function fetchTwelveDataOHLCV(sym, tf) {
  const ck = sym + '_' + tf;
  const cc = _idxTDCache[ck];
  if (cc && Date.now() - cc.ts < 90000) return cc.bars;

  const url  = EDGE_OHLCV_URL
    + '?symbol=' + encodeURIComponent(sym)
    + '&tf='     + encodeURIComponent(tf);
  const resp = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + EDGE_ANON_KEY, 'apikey': EDGE_ANON_KEY },
  });
  if (!resp.ok) throw new Error('OHLCV edge HTTP ' + resp.status);
  const json = await resp.json();
  if (!json.success || !Array.isArray(json.values) || json.values.length < 3) {
    throw new Error(json.error || 'Insufficient OHLCV data');
  }

  const dec  = (IDX_P[sym] >= 1) ? 2 : 4;
  /* Twelve Data returns newest-first — reverse to oldest-first for the chart */
  const bars = json.values.slice().reverse().map(function(item) {
    return {
      time:   Math.floor(new Date(item.datetime).getTime() / 1000),
      open:   +parseFloat(item.open  || 0).toFixed(dec),
      high:   +parseFloat(item.high  || 0).toFixed(dec),
      low:    +parseFloat(item.low   || 0).toFixed(dec),
      close:  +parseFloat(item.close || 0).toFixed(dec),
      volume: parseInt(item.volume   || 0, 10) || 0,
    };
  }).filter(function(b) { return b.time > 0 && b.open > 0; });

  if (bars.length < 3) throw new Error('Too few valid bars: ' + bars.length);

  /* Snap last bar to current live price */
  const livePrice = IDX_P[sym];
  if (livePrice > 0) {
    const last = bars[bars.length - 1];
    last.close = +livePrice.toFixed(dec);
    last.high  = +Math.max(last.high, last.close).toFixed(dec);
    last.low   = +Math.min(last.low,  last.close).toFixed(dec);
    _lastBarTime = last.time;
  }
  console.info('[chart] ✓ Twelve Data OHLCV ' + sym + '/' + tf + ': ' + bars.length + ' bars');
  _idxTDCache[ck] = { bars, ts: Date.now() };
  return bars;
}

/* Map our TF codes → CoinGecko params { days, interval } (crypto fallback only) */
const TF_TO_CG = {
  '5M': { days: '1',   interval: 'minutely'  },
  '1H': { days: '1',   interval: 'minutely'  },
  '4H': { days: '1',   interval: 'minutely'  },
  '1D': { days: '90',  interval: 'daily'     },
  '1W': { days: '365', interval: 'daily'     },
  '1M': { days: '730', interval: 'daily'     },
  '3M': { days: '730', interval: 'daily'     },
  '1Y': { days: 'max', interval: 'weekly'    },
};

/**
 * fetchRealOHLCV — priority order:
 *   0. Binance (crypto — fast, no key, cached 60s)
 *   1. Twelve Data edge function (all symbols, cached 90s)
 *   2. CoinGecko direct (crypto only — fallback)
 *   3. Synthetic data (final fallback)
 */
async function fetchRealOHLCV(sym, tf) {

  /* ── 0. Binance direct (crypto only) ── */
  if (IDX_BINANCE_SYMS.has(sym)) {
    try {
      return await fetchIdxBinanceKlines(sym, tf);
    } catch (err) {
      console.warn('[chart] Binance failed for ' + sym + '/' + tf + ':', err.message);
    }
  }

  /* ── 1. Twelve Data (primary source for non-crypto and Binance fallback) ── */
  try {
    return await fetchTwelveDataOHLCV(sym, tf);
  } catch (err) {
    console.warn('[chart] Twelve Data failed for ' + sym + '/' + tf + ':', err.message);
  }

  /* ── 2. CoinGecko fallback (crypto only) ── */
  const meta = IDX_META[sym];
  const cgId = meta && meta.cgId;
  if (cgId) {
    const { days, interval } = TF_TO_CG[tf] || TF_TO_CG['1D'];
    try {
      const ohlcUrl = 'https://api.coingecko.com/api/v3/coins/' + cgId + '/ohlc'
        + '?vs_currency=usd&days=' + (days === 'max' ? 365 : days);
      const volUrl  = 'https://api.coingecko.com/api/v3/coins/' + cgId + '/market_chart'
        + '?vs_currency=usd&days=' + (days === 'max' ? 365 : days) + '&interval=' + interval;

      const [ohlcResp, volResp] = await Promise.all([
        fetch(ohlcUrl, { cache: 'no-store' }),
        fetch(volUrl,  { cache: 'no-store' }),
      ]);
      if (!ohlcResp.ok) throw new Error('OHLC HTTP ' + ohlcResp.status);

      const ohlcRaw = await ohlcResp.json();
      let   volMap  = {};
      if (volResp.ok) {
        const volData = await volResp.json();
        (volData.total_volumes || []).forEach(([ts, vol]) => {
          const dayKey = Math.floor(ts / 86400000);
          volMap[dayKey] = (volMap[dayKey] || 0) + vol;
        });
      }
      if (!ohlcRaw || !ohlcRaw.length) throw new Error('Empty OHLC payload');

      const bucketMs = tfBucketMs(tf);
      const bucketed = {};
      ohlcRaw.forEach(([tsMs, o, h, l, c]) => {
        const bucket = Math.floor(tsMs / bucketMs) * bucketMs;
        if (!bucketed[bucket]) {
          bucketed[bucket] = { open: o, high: h, low: l, close: c };
        } else {
          bucketed[bucket].high  = Math.max(bucketed[bucket].high, h);
          bucketed[bucket].low   = Math.min(bucketed[bucket].low,  l);
          bucketed[bucket].close = c;
        }
      });

      const dec  = IDX_P[sym] >= 1 ? 2 : 4;
      const bars = Object.entries(bucketed)
        .sort(([a], [b]) => +a - +b)
        .map(([bMs, bar]) => {
          const dayKey = Math.floor(+bMs / 86400000);
          const vol    = volMap[dayKey] || volMap[dayKey - 1] || 0;
          return {
            time:   Math.floor(+bMs / 1000),
            open:   +bar.open .toFixed(dec),
            high:   +bar.high .toFixed(dec),
            low:    +bar.low  .toFixed(dec),
            close:  +bar.close.toFixed(dec),
            volume: Math.floor(vol),
          };
        });
      if (bars.length < 3) throw new Error('Too few bars: ' + bars.length);

      const livePrice = IDX_P[sym];
      if (livePrice > 0) {
        const last = bars[bars.length - 1];
        last.close = +livePrice.toFixed(dec);
        last.high  = +Math.max(last.high, last.close).toFixed(dec);
        last.low   = +Math.min(last.low,  last.close).toFixed(dec);
      }
      console.info('[chart] CoinGecko fallback OHLCV ' + sym + '/' + tf + ': ' + bars.length + ' bars');
      return bars;
    } catch (err) {
      console.warn('[chart] CoinGecko fallback failed for ' + sym + '/' + tf + ':', err.message);
    }
  }

  /* ── 3. Synthetic data (final fallback) ── */
  console.warn('[chart] Using synthetic data for ' + sym + '/' + tf);
  return genOHLCV(sym, tf);
}

/* Convert our TF string to milliseconds per bucket */
function tfBucketMs(tf) {
  const map = {
    '5M': 5  * 60 * 1000,
    '1H': 60      * 60 * 1000,
    '4H': 4  * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7  * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '1Y': 7  * 24 * 60 * 60 * 1000, // weekly buckets
  };
  return map[tf] || map['1D'];
}

/* ═══════════════════════════════════════════════════════
   SYNTHETIC OHLCV FALLBACK
   (unchanged from original — used for stocks + API errors)
═══════════════════════════════════════════════════════ */
function genOHLCV(sym, tf) {
  const basePrice = IDX_P[sym] || 100;
  const chgPct    = IDX_C[sym] || 0;  // 24h % change (negative = dropping)
  const cfg = {
    // No upward trend bias for intraday TFs — direction comes from starting price
    '5M': { bars:1000, step:300,      vol:0.0006, trend:0 },
    '1H': { bars:500,  step:3600,     vol:0.0012, trend:0 },
    '4H': { bars:365,  step:14400,    vol:0.0025, trend:0 },
    '1D': { bars:500,  step:86400,    vol:0.018,  trend:0.0004  },
    '1W': { bars:200,  step:604800,   vol:0.04,   trend:0.001   },
    '1M': { bars:60,   step:2592000,  vol:0.08,   trend:0.002   },
    '3M': { bars:180, step:86400,    vol:0.09,   trend:0.0018  },
    '1Y': { bars:365, step:86400,    vol:0.12,   trend:0.0025  },
  }[tf] || { bars:200, step:86400, vol:0.018, trend:0.0004 };

  const now  = Math.floor(Date.now() / 1000);
  const t0   = now - cfg.bars * cfg.step;
  const bars = [];

  // For intraday TFs, estimate the period's starting price by scaling the 24h change
  // proportionally so the chart trends in the correct direction.
  // e.g. if BTC is down 3% today and we're drawing a 4H chart, the 4H start should
  // be ~0.5% above current price (4/24 of -3%), not always below current.
  const isIntraday = tf === '5M' || tf === '1H' || tf === '4H';
  let close;
  if (isIntraday) {
    const periodHours  = (cfg.bars * cfg.step) / 3600;
    const scaledChg    = chgPct * Math.min(1, periodHours / 24);
    close = (basePrice / (1 + scaledChg / 100)) * (0.997 + Math.random() * 0.006);
  } else {
    close = basePrice * (0.72 + Math.random() * 0.22);
  }

  const volBase = basePrice * 1400;
  const dec     = basePrice >= 1 ? 2 : 4;

  for (let i = 0; i < cfg.bars; i++) {
    const rev    = (basePrice - close) / basePrice * 0.35;
    const drift  = cfg.trend + rev * 0.08;
    const change = close * (drift + (Math.random() - 0.5) * cfg.vol * 2);
    const open   = close;
    close = Math.max(close * 0.01, open + change);
    const wk   = 0.003 + Math.random() * cfg.vol * 0.8;
    const high = Math.max(open, close) * (1 + wk + Math.random() * wk);
    const low  = Math.min(open, close) * (1 - wk - Math.random() * wk);
    const mv   = Math.abs(close - open) / open;
    const vol  = Math.floor(volBase * (1 + mv * 8) * (0.4 + Math.random() * 1.2));
    bars.push({
      time:   t0 + i * cfg.step,
      open:   +open.toFixed(dec),
      high:   +high.toFixed(dec),
      low:    +low.toFixed(dec),
      close:  +close.toFixed(dec),
      volume: vol,
    });
  }

  /* ★ Snap last bar to live price */
  if (bars.length) {
    const last  = bars[bars.length - 1];
    last.close  = +basePrice.toFixed(dec);
    last.high   = +Math.max(last.high, last.close).toFixed(dec);
    last.low    = +Math.min(last.low,  last.close).toFixed(dec);
    _lastBarTime = last.time;
  }
  return bars;
}

/* ═══════════════════════════════════════════════════════
   TICKER
═══════════════════════════════════════════════════════ */
function buildTicker() {
  const inner = document.getElementById('tickerInner');
  if (!inner) return;
  const syms = Object.keys(IDX_META);
  inner.innerHTML = [...syms, ...syms].map(sym => {
    const m = IDX_META[sym], p = IDX_P[sym] || 0, c = IDX_C[sym] || 0, up = c >= 0;
    return `<div class="ticker-item">
      <i class="${m.icon}" style="color:${m.color};font-size:12px;"></i>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-1);font-weight:500;">${sym}</span>
      <span class="tk-p-${sym}" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-1);">$${fmtP(p)}</span>
      <span class="tk-c-${sym}" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${up?'var(--green)':'var(--red)'}">${up?'+':''}${c.toFixed(2)}%</span>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   MARKET GRID
═══════════════════════════════════════════════════════ */
var _mFilter = 'all';
function filterMarkets(cat, btn) {
  _mFilter = cat;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  buildMarketGrid(cat);
}
window.filterMarkets = filterMarkets;

function miniSparkline(sym, up) {
  const pts = 20, w = 80, h = 28;
  let   data = [], v = h / 2;
  for (let i = 0; i < pts; i++) { v += (Math.random() - (up ? .42 : .58)) * 4; v = Math.max(3, Math.min(h-3, v)); data.push(v); }
  const xs   = data.map((_, i) => (i / (pts-1)) * w);
  const path = data.map((y, i) => (i === 0 ? 'M' : 'L') + xs[i].toFixed(1) + ',' + y.toFixed(1)).join(' ');
  const fill = path + ` L${w},${h} L0,${h} Z`;
  const col  = up ? '#22c55e' : '#ef4444';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block;">
    <defs><linearGradient id="sg${sym}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${fill}" fill="url(#sg${sym})" />
    <path d="${path}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}

function buildMarketGrid(filter) {
  const grid = document.getElementById('marketGrid');
  if (!grid) return;
  const syms = Object.keys(IDX_META).filter(s => filter === 'all' || IDX_META[s].cat === filter);
  if (!syms.length) {
    grid.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:40px;font-family:\'JetBrains Mono\',monospace;font-size:11px;">No assets in this category.</p>';
    return;
  }
  grid.innerHTML = syms.map(sym => {
    const m = IDX_META[sym], p = IDX_P[sym] || 0, c = IDX_C[sym] || 0, up = c >= 0;
    return `<div class="market-card" onclick="openAssetChart('${sym}')" title="Click for ${sym} chart" data-cat="${m.cat}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:40px;height:40px;border-radius:13px;background:${m.color}18;color:${m.color};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;"><i class="${m.icon}"></i></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--text-1);">${sym}</div>
          <div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</div>
        </div>
        <div style="text-align:right;">
          <div id="mg-p-${sym}" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-1);font-weight:600;">$${fmtP(p)}</div>
          <div id="mg-c-${sym}" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${up?'var(--green)':'var(--red)'};background:${up?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};padding:2px 7px;border-radius:6px;margin-top:2px;display:inline-block;">${up?'+':''}${c.toFixed(2)}%</div>
        </div>
      </div>
      <div style="margin-bottom:7px;">${miniSparkline(sym, up)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em;">${m.cat}</span>
        <span class="mc-hint"><i class="fas fa-chart-candlestick" style="font-size:8px;margin-right:3px;"></i>VIEW CHART</span>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   ASSETS TABLE
═══════════════════════════════════════════════════════ */
function buildAssetsTable() {
  const tbody = document.getElementById('assetsTbody');
  if (!tbody) return;
  tbody.innerHTML = Object.keys(IDX_META).map(sym => {
    const m = IDX_META[sym], p = IDX_P[sym] || 0, c = IDX_C[sym] || 0, up = c >= 0;
    return `<tr style="cursor:pointer;" onclick="openAssetChart('${sym}')" title="View ${sym} chart">
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div style="width:34px;height:34px;border-radius:11px;background:${m.color}18;color:${m.color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="${m.icon}"></i></div>
        <div><div style="font-weight:600;color:var(--text-1);font-size:13px;">${sym}</div>
        <div style="font-size:11px;color:var(--text-3);">${m.name}</div></div>
      </div></td>
      <td><span id="tb-p-${sym}" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-1);">$${fmtP(p)}</span></td>
      <td><span id="tb-c-${sym}" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${up?'var(--green)':'var(--red)'};background:${up?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)'};padding:3px 8px;border-radius:6px;">${up?'+':''}${c.toFixed(2)}%</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-3);">${fmtB(m.mcap)}</td>
      <td>${miniSparkline(sym, up)}</td>
      <td><button class="tbl-btn" onclick="event.stopPropagation();window.location.href='invest.html'">Invest</button></td>
    </tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   CHART BUILD / DESTROY
═══════════════════════════════════════════════════════ */
function destroyCharts() {
  try { if (_chartInst) _chartInst.remove(); } catch (e) {}
  try { if (_volInst)   _volInst.remove();   } catch (e) {}
  _chartInst = _volInst = _mainSer = _volSer = null;
  _chartBars  = [];
  _lastBarTime = 0;
  const mc = document.getElementById('cha-main'), vc = document.getElementById('cha-vol');
  if (mc) mc.innerHTML = '';
  if (vc) vc.innerHTML = '';
}

/* Show a loading skeleton while we await real data */
function showChartLoading() {
  const mc = document.getElementById('cha-main');
  if (!mc) return;
  mc.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;">
      <div style="width:36px;height:36px;border:2px solid rgba(201,168,76,.2);border-top-color:#c9a84c;border-radius:50%;animation:spin .7s linear infinite;"></div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#5a6880;letter-spacing:.1em;">LOADING MARKET DATA…</span>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
}

async function buildChart(sym, type, tf) {
  const myGen = ++_buildGen;
  destroyCharts();
  if (typeof LightweightCharts === 'undefined') return;

  const mc = document.getElementById('cha-main');
  if (!mc) return;

  /* ── Phase 1: render instantly with cached or synthetic bars ── */
  const ck = sym + '_' + tf;
  const anyCache = _idxBinanceCache[ck] || _idxTDCache[ck];
  const bars = anyCache && anyCache.bars ? anyCache.bars : genOHLCV(sym, tf);
  _chartBars = bars;
  mc.innerHTML = '';

  const price = IDX_P[sym] || 100;
  const isUp  = bars.length >= 2 && bars[bars.length-1].close >= bars[0].open;
  const upC = '#089981', dnC = '#f23645', mainC = isUp ? upC : dnC;

  // Palette switches with the page theme
  const isDark  = (document.documentElement.dataset.theme || 'dark') !== 'light';
  const BG      = isDark ? '#060d14'              : '#faf8f4';
  const TEXT    = isDark ? '#647e97'              : '#64748b';
  const GRID_V  = isDark ? 'rgba(36,52,68,.7)'   : 'rgba(0,0,0,.07)';
  const GRID_H  = isDark ? 'rgba(36,52,68,.9)'   : 'rgba(0,0,0,.10)';
  const BORDER  = isDark ? 'rgba(36,52,68,.9)'   : 'rgba(0,0,0,.13)';
  const CRS_C   = isDark ? 'rgba(201,168,76,.55)': 'rgba(180,140,50,.65)';
  const CRS_LBL = isDark ? '#a87830'             : '#8b6914';

  const baseOpts = {
    autoSize: true,
    layout: {
      background: { type: 'solid', color: BG },
      textColor: TEXT,
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 10,
    },
    grid: {
      vertLines: { color: GRID_V },
      horzLines: { color: GRID_H },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: CRS_C, width: 1, style: 1, labelBackgroundColor: CRS_LBL },
      horzLine: { color: CRS_C, width: 1, style: 1, labelBackgroundColor: CRS_LBL },
    },
    rightPriceScale: {
      borderColor: BORDER,
      scaleMargins: { top: .12, bottom: .10 },
      textColor: TEXT,
    },
    timeScale: {
      borderColor: BORDER,
      timeVisible: true, secondsVisible: false,
      fixLeftEdge: true, rightOffset: 5,
      tickMarkFormatter: function(t) {
        const d = new Date(t * 1000);
        const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if (tf === '5M' || tf === '1H' || tf === '4H') return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
        if (tf === '1D') return d.getDate() + ' ' + M[d.getMonth()];
        return M[d.getMonth()] + ' ' + d.getFullYear();
      },
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale:  { mouseWheel: true, pinch: true },
  };

  _chartInst = LightweightCharts.createChart(mc, baseOpts);

  function _applySeriesData(b) {
    const iU = b.length >= 2 && b[b.length-1].close >= b[0].open;
    const mC = iU ? upC : dnC;
    if (type === 'candlestick' || type === 'bar') {
      _mainSer.setData(b);
    } else {
      _mainSer.applyOptions(type === 'area'
        ? { lineColor: mC, topColor: iU ? 'rgba(8,153,129,.26)' : 'rgba(242,54,69,.20)', bottomColor: 'rgba(0,0,0,0)' }
        : { color: mC, priceLineColor: mC });
      _mainSer.setData(b.map(function(x){ return { time: x.time, value: x.close }; }));
    }
    if (_volSer) _volSer.setData(b.map(function(x){
      return { time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(8,153,129,.4)' : 'rgba(242,54,69,.35)' };
    }));
    const vb = IDX_VIEW_BARS[tf] || 200;
    const n  = b.length;
    _chartInst.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - vb), to: n + 4 });
  }

  if (type === 'candlestick') {
    _mainSer = _chartInst.addCandlestickSeries({
      upColor: upC, downColor: dnC,
      borderUpColor: upC, borderDownColor: dnC,
      wickUpColor: 'rgba(8,153,129,.8)', wickDownColor: 'rgba(242,54,69,.8)',
      priceLineVisible: false, lastValueVisible: false,
    });
  } else if (type === 'bar') {
    _mainSer = _chartInst.addBarSeries({ upColor: upC, downColor: dnC, priceLineVisible: false, lastValueVisible: false });
  } else if (type === 'area') {
    _mainSer = _chartInst.addAreaSeries({
      lineColor: mainC, lineWidth: 2,
      topColor: isUp ? 'rgba(8,153,129,.26)' : 'rgba(242,54,69,.20)',
      bottomColor: 'rgba(0,0,0,0)',
      crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: mainC, crosshairMarkerBackgroundColor: BG,
      priceLineVisible: false, lastValueVisible: false,
    });
  } else {
    _mainSer = _chartInst.addLineSeries({
      color: mainC, lineWidth: 2,
      crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: mainC, crosshairMarkerBackgroundColor: BG,
      priceLineVisible: false, lastValueVisible: false,
    });
  }

  /* Volume sub-chart */
  const vc = document.getElementById('cha-vol');
  if (vc) {
    _volInst = LightweightCharts.createChart(vc, Object.assign({}, baseOpts, {
      rightPriceScale: { scaleMargins: { top: .15, bottom: 0 }, borderColor: BORDER, mode: LightweightCharts.PriceScaleMode.Percentage },
      timeScale: { visible: false },
      crosshair: { horzLine: { visible: false } },
      grid: { vertLines: { color: isDark ? 'rgba(36,52,68,.5)' : 'rgba(0,0,0,.05)' }, horzLines: { visible: false } },
    }));
    _volSer = _volInst.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    _volSer.priceScale().applyOptions({ scaleMargins: { top: .15, bottom: 0 } });
    var _syncingRange = false;
    _chartInst.timeScale().subscribeVisibleLogicalRangeChange(function(r){ if (_volInst && r && !_syncingRange){ _syncingRange=true; _volInst.timeScale().setVisibleLogicalRange(r); _syncingRange=false; } });
    _volInst .timeScale().subscribeVisibleLogicalRangeChange(function(r){ if (_chartInst && r && !_syncingRange){ _syncingRange=true; _chartInst.timeScale().setVisibleLogicalRange(r); _syncingRange=false; } });
  }

  const firstOpen = bars.length ? bars[0].open : price;
  _chartInst.subscribeCrosshairMove(function(param) {
    if (!param || !param.time || !_mainSer) { showOHLCV(_chartBars[_chartBars.length-1], type, _chartBars[0] ? _chartBars[0].open : firstOpen); return; }
    const d = param.seriesData.get(_mainSer); if (!d) return;
    showOHLCV(type === 'candlestick' || type === 'bar' ? d : { open: d.value, high: d.value, low: d.value, close: d.value, volume: 0 }, type, _chartBars[0] ? _chartBars[0].open : firstOpen);
  });

  requestAnimationFrame(function(){ if (_chartInst) _applySeriesData(bars); });
  showOHLCV(bars[bars.length-1], type, firstOpen);

  /* ── Phase 2: background fetch; silently replace with real data ── */
  const binFresh = _idxBinanceCache[ck] && Date.now() - _idxBinanceCache[ck].ts < 60000;
  const tdFresh  = _idxTDCache[ck]      && Date.now() - _idxTDCache[ck].ts      < 90000;
  if (!binFresh && !tdFresh) {
    fetchRealOHLCV(sym, tf).then(function(realBars) {
      if (_buildGen !== myGen || !_mainSer || !_chartInst) return;
      _chartBars = realBars;
      _applySeriesData(realBars);
      showOHLCV(realBars[realBars.length-1], type, realBars[0] ? realBars[0].open : price);
    }).catch(function(){});
  }
}

function showOHLCV(bar, type, fo) {
  if (!bar) return;
  const f = v => v != null ? '$' + fmtP(v) : '—';
  setT('ov-o', f(bar.open));  setT('ov-h', f(bar.high));
  setT('ov-l', f(bar.low));   setT('ov-c', f(bar.close));
  setT('ov-v', bar.volume ? fmtV(bar.volume) : '—');
  if (fo && bar.close) {
    const pct = (bar.close - fo) / fo * 100, up = pct >= 0;
    setT('ov-chg', (up ? '+' : '') + pct.toFixed(2) + '%');
    const el = document.getElementById('ov-chg'); if (el) el.style.color = up ? 'var(--green)' : 'var(--red)';
    const w  = document.getElementById('ov-chg-wrap'); if (w) w.style.display = 'inline-flex';
  }
}

/* ═══════════════════════════════════════════════════════
   OPEN / CLOSE CHART
═══════════════════════════════════════════════════════ */

/**
 * Wait until IDX_P[sym] has been updated by a real CoinGecko broadcast
 * (i.e. it's not still at the hardcoded seed).  Timeout: 4 seconds.
 */
function waitForLivePrice(sym) {
  return new Promise(resolve => {
    const seedPrice = { BTC:67430, ETH:3280, SOL:188, BNB:612, XRP:0.72, ADA:0.48 }[sym];
    if (!seedPrice || IDX_P[sym] !== seedPrice) { resolve(); return; }
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      if (IDX_P[sym] !== seedPrice || attempts > 40) { clearInterval(iv); resolve(); }
    }, 100);
  });
}

async function openAssetChart(sym) {
  const m = IDX_META[sym]; if (!m) return;

  _chartType = 'candlestick';
  _chartTF   = '1D';

  /* Open the modal immediately so the user sees feedback */
  document.getElementById('idx-chart-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  /* ★ Wait briefly for a real live price before rendering */
  await waitForLivePrice(sym);

  const p  = IDX_P[sym] || 0;
  const c  = IDX_C[sym] || 0;
  const up = c >= 0;

  /* Compute and cache 24H stats */
  IDX_STATS[sym] = {
    open: +(p * (0.988 + Math.random() * .006)).toFixed(p >= 1 ? 2 : 4),
    high: +(p * (1.018 + Math.random() * .012)).toFixed(p >= 1 ? 2 : 4),
    low:  +(p * (0.972 + Math.random() * .010)).toFixed(p >= 1 ? 2 : 4),
    mcap: m.mcap,
    vol24: m.mcap * 0.028,
  };
  IDX_STATS[sym].high = Math.max(IDX_STATS[sym].high, p);
  IDX_STATS[sym].low  = Math.min(IDX_STATS[sym].low,  p);

  /* Icon */
  const ico = document.getElementById('cha-ico');
  ico.innerHTML = `<i class="${m.icon}"></i>`;
  ico.style.cssText = `width:46px;height:46px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0;background:${m.color}18;color:${m.color};`;

  setT('cha-aname', m.name);
  setT('cha-sym',   sym + ' · ' + m.cat.toUpperCase());
  setT('cha-price', '$' + fmtP(p));

  const cc = document.getElementById('cha-chg');
  cc.textContent    = (up ? '+' : '') + c.toFixed(2) + '%';
  cc.style.background = up ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)';
  cc.style.color      = up ? '#22c55e' : '#ef4444';
  cc.style.border     = '1px solid ' + (up ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)');
  cc.style.borderRadius = '8px';

  const st = IDX_STATS[sym];
  setT('cha-open',  '$' + fmtP(st.open));
  setT('cha-high',  '$' + fmtP(st.high));
  setT('cha-low',   '$' + fmtP(st.low));
  setT('cha-mcap',  fmtB(st.mcap));
  setT('cha-vol24', fmtB(st.vol24));

  /* Reset buttons */
  document.querySelectorAll('#cha-type-grp .cha-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('#cha-type-grp .cha-btn').classList.add('on');
  document.querySelectorAll('#cha-tf-grp .cha-btn').forEach(b => b.classList.toggle('on', b.textContent === '1D'));

  /* ★ Set _chartSym BEFORE building so live ticks route correctly */
  _chartSym = sym;

  /* Build the chart with real data (async) */
  await buildChart(sym, 'candlestick', '1D');
}
window.openAssetChart = openAssetChart;

function closeAssetChart() {
  document.getElementById('idx-chart-modal').classList.remove('open');
  document.body.style.overflow = '';
  _chartSym = null;
  destroyCharts();
}
window.closeAssetChart = closeAssetChart;

function handleChartBg(e) {
  if (e.target === document.getElementById('idx-chart-modal')) closeAssetChart();
}
window.handleChartBg = handleChartBg;

function setChartType(type, btn) {
  _chartType = type;
  document.querySelectorAll('#cha-type-grp .cha-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  if (_chartSym) buildChart(_chartSym, type, _chartTF);
}
window.setChartType = setChartType;

function setChartTF(tf, btn) {
  _chartTF = tf;
  document.querySelectorAll('#cha-tf-grp .cha-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  if (_chartSym) buildChart(_chartSym, _chartType, tf);
}
window.setChartTF = setChartTF;

/* ESC key */
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAssetChart(); });

/* ── Supabase / localStorage price overrides ── */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AurumPrices !== 'undefined' && AurumPrices.onUpdate) {
    AurumPrices.onUpdate(function (livePrices) {
      let overrides = {};
      try { overrides = JSON.parse(localStorage.getItem('aurum_price_overrides') || '{}'); } catch (e) {}
      Object.keys(livePrices).forEach(function (sym) {
        const d  = livePrices[sym];
        if (!d || !d.price) return;
        const fp = overrides[sym] && overrides[sym].price ? overrides[sym].price : d.price;
        const fc = overrides[sym] && overrides[sym].chg != null ? overrides[sym].chg : (d.changePct24h != null ? d.changePct24h : IDX_C[sym]);
        window.onPriceUpdate(sym, fp, fc);
      });
      buildTicker();
      buildMarketGrid(_mFilter);
    });
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== 'aurum_price_overrides' && e.key !== 'aurum_live_prices') return;
    applyLocalStorage();
  });

  setInterval(applyLocalStorage, 30000);
  applyLocalStorage();
});

function applyLocalStorage() {
  try {
    const ov     = JSON.parse(localStorage.getItem('aurum_price_overrides') || '{}');
    const lv     = JSON.parse(localStorage.getItem('aurum_live_prices')     || '{}');
    const merged = Object.assign({}, lv, ov);
    Object.keys(merged).forEach(sym => {
      const d = merged[sym];
      if (d && d.price) window.onPriceUpdate(sym, d.price, d.changePct24h != null ? d.changePct24h : (d.chg != null ? d.chg : IDX_C[sym]));
    });
  } catch (e) {}
}

/* ═══════════════════════════════════════════════════════
   PAGE INIT
═══════════════════════════════════════════════════════ */
window.addEventListener('load', function () {
  setTimeout(() => { const l = document.getElementById('loader'); if (l) l.classList.add('out'); }, 1800);
  buildTicker();
  /* buildMarketGrid / buildAssetsTable already ran at DOMContentLoaded with
     IDX_P seeds. Re-running here with those same seeds RESETS any live prices
     that coingecko-sync already wrote into the DOM — so we do NOT rebuild. */
  applyLocalStorage();
});

window.addEventListener('scroll', function () {
  document.getElementById('mainHeader').classList.toggle('compact', scrollY > 60);
}, { passive: true });

const _mobBtn   = document.getElementById('mobBtn');
const _drawer   = document.getElementById('drawer');
const _doverlay = document.getElementById('drawerOverlay');
if (_mobBtn) {
  _mobBtn.addEventListener('click', () => { _drawer.classList.toggle('on'); _doverlay.classList.toggle('on'); });
}
if (_doverlay) {
  _doverlay.addEventListener('click', () => { _drawer.classList.remove('on'); _doverlay.classList.remove('on'); });
}
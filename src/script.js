/* ================================================================
   script.js  —  Aurum Capital Landing Page
   Handles: ticker, market cards, assets table, live price sync
   Relies on price-sync.js (loaded before this file) which fires
   window.onPriceUpdate(sym, price, chg) on every DB update.
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
   MASTER ASSETS LIST  (prices updated live by onPriceUpdate)
═══════════════════════════════════════════════════════ */
const ASSETS = [
  // Crypto
  { sym:'BTC',  name:'Bitcoin',       cat:'crypto',      price:77430,  chg:2.8,   mcap:'$1.33T', icon:'fab fa-bitcoin',   color:'#f7931a', up:true  },
  { sym:'ETH',  name:'Ethereum',      cat:'crypto',      price:2280,   chg:1.4,   mcap:'$394B',  icon:'fab fa-ethereum',  color:'#627eea', up:true  },
  { sym:'BNB',  name:'BNB Chain',     cat:'crypto',      price:712,    chg:-0.9,  mcap:'$91B',   icon:'fas fa-coins',     color:'#f3ba2f', up:false },
  { sym:'SOL',  name:'Solana',        cat:'crypto',      price:88,     chg:3.1,   mcap:'$88B',   icon:'fas fa-sun',       color:'#9945ff', up:true  },
  { sym:'XRP',  name:'Ripple',        cat:'crypto',      price:1.72,   chg:-1.2,  mcap:'$40B',   icon:'fas fa-water',     color:'#00aae4', up:false },
  // Stocks
  { sym:'TSLA', name:'Tesla Inc.',    cat:'stocks',      price:248.50, chg:-0.6,  mcap:'$792B',  icon:'fas fa-car',       color:'#e31937', up:false },
  { sym:'AAPL', name:'Apple Inc.',    cat:'stocks',      price:189.30, chg:0.4,   mcap:'$2.92T', icon:'fab fa-apple',     color:'#a2aaad', up:true  },
  { sym:'NVDA', name:'NVIDIA Corp',   cat:'stocks',      price:875.20, chg:2.1,   mcap:'$2.16T', icon:'fas fa-microchip', color:'#76b900', up:true  },
  { sym:'MSFT', name:'Microsoft',     cat:'stocks',      price:412.70, chg:0.8,   mcap:'$3.07T', icon:'fab fa-windows',   color:'#00a4ef', up:true  },
  { sym:'AMZN', name:'Amazon',        cat:'stocks',      price:195.50, chg:-0.3,  mcap:'$2.03T', icon:'fab fa-amazon',    color:'#ff9900', up:false },
  // Commodities
  { sym:'GOLD', name:'Gold Spot',     cat:'commodities', price:2318.40,chg:0.3,   mcap:'$14.6T', icon:'fas fa-circle',    color:'#c9a84c', up:true  },
  { sym:'OIL',  name:'Crude Oil WTI', cat:'commodities', price:82.40,  chg:-1.1,  mcap:'N/A',    icon:'fas fa-oil-well',  color:'#6b7280', up:false },
];

/* ── Hero portfolio card demo holdings ────────────────────
   These simulate a sample portfolio whose value updates
   live whenever BTC / XRP / ETH prices change.           */
const HERO_HOLDINGS = { BTC: 0.80, ETH: 8.50, XRP: 8000 };
const HERO_CASH     = 28040;   // fixed cash slice

/* Track when price-sync last pushed a real update per sym */
const _priceFreezeUntil = {};
const FREEZE_MS = 8000;

/* ═══════════════════════════════════════════════════════
   window.onPriceUpdate
   Called by price-sync.js whenever admin saves a price.
   Updates the ASSETS array AND every DOM element that
   shows this symbol's price.
═══════════════════════════════════════════════════════ */
window.onPriceUpdate = function (sym, newPrice, newChg) {
  const asset = ASSETS.find(a => a.sym === sym);
  if (!asset) return;

  const oldPrice   = asset.price;
  asset.price      = newPrice;
  asset.chg        = newChg;
  asset.up         = newChg >= 0;
  _priceFreezeUntil[sym] = Date.now() + FREEZE_MS;

  /* 1 ── Market-cards grid */
  const mcEl = document.getElementById('mc-pr-' + sym);
  if (mcEl) {
    const wasUp = newPrice >= oldPrice;
    mcEl.textContent = '$' + fmtPrice(newPrice);
    mcEl.classList.remove('flash-up', 'flash-dn');
    void mcEl.offsetWidth;
    mcEl.classList.add(wasUp ? 'flash-up' : 'flash-dn');
    setTimeout(() => mcEl.classList.remove('flash-up', 'flash-dn'), 1400);
  }

  /* 2 ── Assets table */
  const tbEl = document.getElementById('tbl-pr-' + sym);
  if (tbEl) tbEl.textContent = '$' + fmtPrice(newPrice);

  /* 3 ── Ticker spans */
  document.querySelectorAll('.t-item').forEach(el => {
    const symEl = el.querySelector('.t-sym');
    if (symEl && symEl.textContent === sym) {
      const prEl  = el.querySelector('.t-price');
      const chgEl = el.querySelector('.t-chg');
      if (prEl)  prEl.textContent  = '$' + fmtPrice(newPrice);
      if (chgEl) {
        chgEl.textContent = (newChg >= 0 ? '+' : '') + newChg.toFixed(2) + '%';
        chgEl.className   = 't-chg ' + (newChg >= 0 ? 'up' : 'dn');
      }
    }
  });

  /* 4 ── Hero card individual asset rows */
  const hpEl = document.getElementById('pr-' + sym);
  if (hpEl) hpEl.textContent = '$' + fmtPrice(newPrice);
  const hcEl = document.getElementById('chg-' + sym);
  if (hcEl) {
    hcEl.textContent = (newChg >= 0 ? '+' : '') + newChg.toFixed(2) + '%';
    hcEl.className   = 'asset-chg ' + (newChg >= 0 ? 'up' : 'dn');
  }

  /* 5 ── Hero portfolio total */
  updateHeroPortfolio();
};

/* Recomputes the hero card portfolio value from HERO_HOLDINGS */
function updateHeroPortfolio() {
  let total = HERO_CASH;
  for (const [sym, qty] of Object.entries(HERO_HOLDINGS)) {
    const a = ASSETS.find(x => x.sym === sym);
    if (a) total += a.price * qty;
  }

  const el = document.getElementById('hero-port-val');
  if (el) el.textContent = '$' + fmtUSD(total);

  /* Overall change — weighted by BTC/ETH/XRP chg */
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
  const visible = filter === 'all' ? ASSETS : ASSETS.filter(a => a.cat === filter);
  grid.innerHTML = visible.map(a => {
    const pts      = genSparkData(a.up);
    const sp       = sparkPath(pts);
    const areaPath = sp + ` L${140},${44} L0,${44} Z`;
    const chgStr   = (a.chg > 0 ? '+' : '') + a.chg + '%';
    return `
      <div class="market-card" data-cat="${a.cat}">
        <div class="mc-top">
          <div class="mc-icon-wrap">
            <div class="mc-icon" style="background:${a.color}18;color:${a.color}"><i class="${a.icon}"></i></div>
            <div><div class="mc-sym">${a.sym}</div><div class="mc-name">${a.name}</div></div>
          </div>
          <span class="mc-badge ${a.up ? 'up' : 'dn'}">${chgStr}</span>
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
  btn.classList.add('on');
  buildMarketCards(cat);
}

/* ═══════════════════════════════════════════════════════
   BUILD ASSETS TABLE
═══════════════════════════════════════════════════════ */
function buildAssetsTable() {
  const tbody = document.getElementById('assetsTbody');
  tbody.innerHTML = ASSETS.slice(0, 10).map((a) => {
    const pts    = genSparkData(a.up, 7);
    const chgStr = (a.chg > 0 ? '+' : '') + a.chg + '%';
    const sp     = sparkPath(pts, 80, 28);
    return `
      <tr>
        <td>
          <div class="tbl-asset">
            <div class="tbl-icon" style="background:${a.color}18;color:${a.color}"><i class="${a.icon}"></i></div>
            <div><div class="tbl-sym">${a.sym}</div><div class="tbl-full">${a.name}</div></div>
          </div>
        </td>
        <td class="tbl-price" id="tbl-pr-${a.sym}">$${fmtPrice(a.price)}</td>
        <td><span class="tbl-chg ${a.up ? 'up' : 'dn'}">${chgStr}</span></td>
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
  const items = [...ASSETS, ...ASSETS].map(a => {
    const chg = (a.chg > 0 ? '+' : '') + a.chg + '%';
    return `<span class="t-item">
      <span class="t-sym">${a.sym}</span>
      <span class="t-price">$${fmtPrice(a.price)}</span>
      <span class="t-chg ${a.up ? 'up' : 'dn'}">${chg}</span>
    </span>`;
  }).join('');
  inner.innerHTML = items;
}

/* ═══════════════════════════════════════════════════════
   LOCAL JITTER  (subtle idle movement, paused after
   a real admin update for FREEZE_MS milliseconds)
═══════════════════════════════════════════════════════ */
function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(2);
  return p.toFixed(4);
}

function fmtUSD(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function jitter(p, pct = 0.0004) {
  return p * (1 + (Math.random() - .5) * 2 * pct);
}

function updatePrices() {
  const now = Date.now();
  ASSETS.forEach(a => {
    /* Skip if a real price was synced recently */
    if (_priceFreezeUntil[a.sym] && now < _priceFreezeUntil[a.sym]) return;
    a.price = jitter(a.price);
    const mc = document.getElementById('mc-pr-' + a.sym);
    const tb = document.getElementById('tbl-pr-' + a.sym);
    const hp = document.getElementById('pr-' + a.sym);
    const v  = '$' + fmtPrice(a.price);
    if (mc) mc.textContent = v;
    if (tb) tb.textContent = v;
    if (hp) hp.textContent = v;
  });
  updateHeroPortfolio();
}

/* ── Flash animation styles ─────────────────────────── */
const _fstyle = document.createElement('style');
_fstyle.textContent = `
  @keyframes flashUp { 0%{color:#22c55e;text-shadow:0 0 10px rgba(34,197,94,.7)} 100%{color:inherit;text-shadow:none} }
  @keyframes flashDn { 0%{color:#ef4444;text-shadow:0 0 10px rgba(239,68,68,.7)} 100%{color:inherit;text-shadow:none} }
  .flash-up { animation: flashUp 1.4s ease forwards !important; }
  .flash-dn  { animation: flashDn 1.4s ease forwards !important; }
  @keyframes float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px) rotate(5deg)} }
`;
document.head.appendChild(_fstyle);

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  buildTicker();
  buildMarketCards();
  buildAssetsTable();
  updateHeroPortfolio();          // set initial computed portfolio value
  setInterval(updatePrices, 1800);
});

/* Expose filter to inline onclick */
window.filterMarkets = filterMarkets;




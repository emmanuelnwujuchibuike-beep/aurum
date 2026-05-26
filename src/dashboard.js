import { supabase } from './supabaseClient.js';

/* ─────────────────────────────────────────────
   ASSET METADATA — icon / color / name per symbol
   Prices are fetched live; only visual meta lives here
───────────────────────────────────────────── */
const ASSET_META = {
  BTC:  { icon: 'fab fa-bitcoin',   color: '#f7931a', name: 'Bitcoin'   },
  ETH:  { icon: 'fab fa-ethereum',  color: '#627eea', name: 'Ethereum'  },
  SOL:  { icon: 'fas fa-sun',       color: '#9945ff', name: 'Solana'    },
  TSLA: { icon: 'fas fa-car',       color: '#e31937', name: 'Tesla'     },
  NVDA: { icon: 'fas fa-microchip', color: '#76b900', name: 'NVIDIA'    },
  AAPL: { icon: 'fab fa-apple',     color: '#a2aaad', name: 'Apple'     },
  GOLD: { icon: 'fas fa-coins',     color: '#c9a84c', name: 'Gold Spot' },
  XRP:  { icon: 'fas fa-water',     color: '#00aae4', name: 'Ripple'    },
};

/* ─────────────────────────────────────────────
   LIVE PRICE FEED
   Replace this object with a real API (CoinGecko, Alpaca, etc.)
   Keys must match the `symbol` column in your holdings table.
   You can override these prices from Supabase by storing
   current_price on the holdings row and adjusting getLivePrice().
───────────────────────────────────────────── */
const LIVE_PRICES = {
  BTC:  67430,
  ETH:  3280,
  SOL:  188,
  TSLA: 248.50,
  NVDA: 875.20,
  AAPL: 189.30,
  GOLD: 2318.40,
  XRP:  0.72,
};

function jitter(p)         { return p * (1 + (Math.random() - 0.5) * 0.0012); }
function getLivePrice(sym) { return LIVE_PRICES[sym] ?? 0; }

/* ─────────────────────────────────────────────
   FORMAT HELPERS
───────────────────────────────────────────── */
function fmtUSD(n, decimals = 2) {
  if (n === null || n === undefined) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
function fmtQty(n) {
  const num = Number(n);
  return num >= 1
    ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : num.toFixed(6);
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return m <= 1 ? 'just now' : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─────────────────────────────────────────────
   AUTH GUARD
───────────────────────────────────────────── */
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  return session.user;
}

/* ─────────────────────────────────────────────
   MAIN INIT
───────────────────────────────────────────── */
async function init() {
  const user = await requireAuth();
  if (!user) return;

  // ── Load all data in parallel ──
  const [profileRes, holdingsRes, txRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('holdings').select('*').eq('user_id', user.id),
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (profileRes.error) {
    console.error('Profile fetch error:', profileRes.error);
    return;
  }

  const profile      = profileRes.data;
  const holdings     = holdingsRes.data ?? [];
  const transactions = txRes.data ?? [];

  // ── Render everything ──
  renderProfile(profile);
  renderStats(profile, holdings);
  renderHoldings(holdings);
  renderTransactions(transactions);
  renderAllocation(holdings);
  renderMarketMovers();
  startPriceTicker(holdings);
  buildChart(CHART_PTS);
  setEl('liveDate', new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }));

  // ── Real-time listener: re-render if profile/holdings change ──
  supabase
    .channel('dashboard-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
      async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) { renderProfile(data); renderStats(data, holdings); }
      })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings', filter: `user_id=eq.${user.id}` },
      async () => {
        const { data } = await supabase.from('holdings').select('*').eq('user_id', user.id);
        const fresh = data ?? [];
        renderHoldings(fresh);
        renderAllocation(fresh);
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (p) renderStats(p, fresh);
      })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
      async () => {
        const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(8);
        renderTransactions(data ?? []);
      })
    .subscribe();

  // ── Sign-out ──
  document.querySelectorAll('[data-signout]').forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  });
}

/* ─────────────────────────────────────────────
   RENDER: Profile
   All name / avatar / cash data comes from Supabase.
   Edit any user's row in the profiles table to update instantly.
───────────────────────────────────────────── */
function renderProfile(profile) {
  // Pull names directly from what the user entered at signup
  const firstName = (profile.first_name || '').trim() || 'Investor';
  const lastName  = (profile.last_name  || '').trim();
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');

  // Initials: prefer stored avatar_initials, fall back to computed
  const initials = (profile.avatar_initials || '').trim() ||
    (firstName[0] + (lastName[0] || '')).toUpperCase();

  // Greeting section
  setEl('user-first-name', firstName);

  // Sidebar
  setEl('nav-user-fullname', fullName);
  setEl('nav-user-initials', initials);
  setEl('nav-cash-display',  fmtUSD(profile.cash) + ' available');

  // All avatar elements (topbar + sidebar)
  document.querySelectorAll('.user-avatar-initials').forEach(el => {
    el.textContent = initials;
  });

  // Topbar full name
  document.querySelectorAll('.user-display-name').forEach(el => {
    el.textContent = fullName;
  });
}

/* ─────────────────────────────────────────────
   RENDER: Stat Cards
   Total portfolio value, P&L, invested amount, and cash
   are all derived from Supabase data.
   — Adjust a user's `cash` in the profiles table
   — Add/edit holdings rows to change invested value
───────────────────────────────────────────── */
function renderStats(profile, holdings) {
  let invested = 0, portfolioValue = 0;

  holdings.forEach(h => {
    const price = getLivePrice(h.symbol);
    portfolioValue += price * Number(h.quantity);
    invested       += Number(h.avg_buy_price) * Number(h.quantity);
  });

  const cash    = Number(profile.cash ?? 0);
  const total   = portfolioValue + cash;
  const pnlAmt  = portfolioValue - invested;
  const pnlPct  = invested > 0 ? (pnlAmt / invested) * 100 : 0;
  const isGain  = pnlAmt >= 0;

  // Total portfolio card
  setEl('totalVal',    fmtUSD(total, 0));
  setEl('totalPnlAmt', (isGain ? '+' : '') + fmtUSD(pnlAmt, 0));
  setEl('totalPnlPct', (isGain ? '+' : '') + pnlPct.toFixed(1) + '%');
  setEl('totalPnlSign', isGain ? '▲' : '▼');
  colorGainLoss('totalPnlAmt',  isGain);
  colorGainLoss('totalPnlPct',  isGain);
  colorGainLoss('totalPnlSign', isGain);

  // Invested card
  setEl('investedVal', fmtUSD(portfolioValue, 0));
  setEl('assetCount',  holdings.length + ' asset' + (holdings.length !== 1 ? 's' : ''));

  // Cash card — controlled entirely from Supabase profiles.cash column
  setEl('cashVal', fmtUSD(cash));
}

/* ─────────────────────────────────────────────
   RENDER: Holdings Table
   Reads from Supabase holdings table.
   Add rows there to give a user new positions.
───────────────────────────────────────────── */
function renderHoldings(holdings) {
  const tbody = document.getElementById('holdingsTbody');
  if (!tbody) return;

  if (holdings.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="px-6 py-10 text-center text-steel font-mono text-xs">
        No holdings yet. <a href="invest.html" class="text-gold underline">Start investing →</a>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = holdings.map((h, i) => {
    // Prefer DB-stored icon/color, fall back to ASSET_META
    const meta  = ASSET_META[h.symbol] ?? {};
    const price = getLivePrice(h.symbol);
    const value = price * Number(h.quantity);
    const cost  = Number(h.avg_buy_price) * Number(h.quantity);
    const pnl   = cost > 0 ? ((value - cost) / cost) * 100 : 0;
    const up    = pnl >= 0;
    const icon  = h.icon  || meta.icon  || 'fas fa-circle-dot';
    const color = h.color || meta.color || '#5a6880';

    return `
    <tr class="border-b border-white/[.04] hover:bg-white/[.02] transition-colors"
        style="animation:fadeUp .5s ease forwards ${0.1 + i * 0.07}s;opacity:0">
      <td class="px-6 py-3.5">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
               style="background:${color}18;color:${color}">
            <i class="${icon}"></i>
          </div>
          <div>
            <p class="font-semibold text-snow text-sm">${h.symbol}</p>
            <p class="font-mono text-[10px] text-steel">${fmtQty(h.quantity)} units</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 text-right font-mono text-sm text-snow" id="hp-${h.symbol}">
        ${fmtUSD(price)}
      </td>
      <td class="px-4 py-3.5 text-right">
        <span class="font-mono text-xs px-2 py-1 rounded-lg ${up ? 'text-gain bg-gain/10' : 'text-loss bg-loss/10'}">
          ${up ? '+' : ''}${pnl.toFixed(2)}%
        </span>
      </td>
      <td class="px-6 py-3.5 text-right font-mono text-sm text-snow" id="hv-${h.symbol}">
        ${fmtUSD(value, 0)}
      </td>
    </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   RENDER: Allocation Donut
   Dynamically built from real holdings data
───────────────────────────────────────────── */
const DONUT_COLORS = ['#f7931a','#627eea','#e31937','#c9a84c','#9945ff','#76b900','#00aae4','#a2aaad'];

function renderAllocation(holdings) {
  const legendEl = document.getElementById('allocationLegend');
  const donutEl  = document.getElementById('allocationDonut');
  if (!donutEl || !legendEl) return;

  if (holdings.length === 0) {
    donutEl.innerHTML = '';
    legendEl.innerHTML = `<p class="text-steel font-mono text-xs text-center">No holdings yet</p>`;
    return;
  }

  // Compute values
  const entries = holdings.map((h, i) => {
    const meta  = ASSET_META[h.symbol] ?? {};
    const value = getLivePrice(h.symbol) * Number(h.quantity);
    const color = h.color || meta.color || DONUT_COLORS[i % DONUT_COLORS.length];
    return { symbol: h.symbol, name: h.name || meta.name || h.symbol, value, color };
  }).filter(e => e.value > 0);

  const total = entries.reduce((s, e) => s + e.value, 0) || 1;

  // Build SVG rings
  const R = 46, CIRC = 2 * Math.PI * R; // ~289
  let offset = 0;
  const rings = entries.map(e => {
    const pct  = e.value / total;
    const arc  = pct * CIRC;
    const ring = `
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="${e.color}" stroke-width="12"
        stroke-dasharray="${arc.toFixed(1)} ${CIRC.toFixed(1)}"
        stroke-dashoffset="${(-offset).toFixed(1)}"
        stroke-linecap="round" class="donut-ring"
        style="transform:rotate(-90deg);transform-origin:center"/>`;
    offset += arc;
    return ring;
  }).join('');

  donutEl.innerHTML = `
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="12"/>
    ${rings}
    <text x="60" y="57" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="14" fill="#edf2f8" font-weight="300">${holdings.length} Asset${holdings.length !== 1 ? 's' : ''}</text>
    <text x="60" y="70" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="7" fill="#5a6880">DIVERSIFIED</text>`;

  // Build legend
  legendEl.innerHTML = entries.map(e => {
    const pct = ((e.value / total) * 100).toFixed(0);
    return `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${e.color}"></span>
        <span class="text-sm text-cloud">${e.name}</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="w-20 h-1.5 bg-white/[.06] rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${pct}%;background:${e.color}"></div>
        </div>
        <span class="font-mono text-xs text-snow w-8 text-right">${pct}%</span>
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   RENDER: Recent Transactions
   Reads from Supabase transactions table.
   Insert rows there (type: buy/sell/deposit/withdraw)
   to show activity for each user.
───────────────────────────────────────────── */
function renderTransactions(txs) {
  const list = document.getElementById('txList');
  if (!list) return;

  if (txs.length === 0) {
    list.innerHTML = `<div class="px-6 py-8 text-center text-steel font-mono text-xs">No transactions yet.</div>`;
    return;
  }

  list.innerHTML = txs.map(tx => {
    const meta  = ASSET_META[tx.symbol] ?? {};
    const icon  = tx.icon  || meta.icon  || 'fas fa-circle-dot';
    const color = tx.color || meta.color || '#5a6880';
    const isCashIn = tx.type === 'sell' || tx.type === 'deposit';

    const typeLabel = { buy: 'Bought', sell: 'Sold', deposit: 'Deposited', withdraw: 'Withdrew' }[tx.type] ?? tx.type;

    const qtyStr = tx.quantity
      ? `${tx.type === 'sell' ? '-' : '+'}${fmtQty(tx.quantity)} ${tx.symbol}`
      : fmtUSD(Math.abs(tx.usd_amount ?? 0));

    const usdStr = tx.usd_amount != null
      ? (tx.usd_amount > 0 ? '+' : '') + fmtUSD(tx.usd_amount)
      : '';

    return `
    <div class="flex items-center gap-3 px-6 py-3.5 hover:bg-white/[.02] transition-colors">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs flex-shrink-0"
           style="background:${color}18;color:${color}">
        <i class="${icon}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-snow text-sm font-medium">${typeLabel} ${tx.symbol}</p>
        <p class="font-mono text-[10px] text-steel">${timeAgo(tx.created_at)}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="font-mono text-xs text-snow">${qtyStr}</p>
        <p class="font-mono text-[10px] ${isCashIn ? 'text-gain' : 'text-loss'}">${usdStr}</p>
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   RENDER: Market Movers
───────────────────────────────────────────── */
function renderMarketMovers() {
  const movers = [
    { sym: 'SOL',  chg: +3.1, up: true  },
    { sym: 'BTC',  chg: +2.8, up: true  },
    { sym: 'NVDA', chg: +2.1, up: true  },
    { sym: 'XRP',  chg: -1.2, up: false },
  ];
  const grid = document.getElementById('moversGrid');
  if (!grid) return;

  grid.innerHTML = movers.map(m => {
    const meta  = ASSET_META[m.sym] ?? {};
    const price = getLivePrice(m.sym);
    return `
    <div class="p-5 hover:bg-white/[.02] transition-colors">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
             style="background:${meta.color}18;color:${meta.color}">
          <i class="${meta.icon}"></i>
        </div>
        <div>
          <p class="font-semibold text-snow text-sm">${m.sym}</p>
          <p class="text-[10px] text-steel">${meta.name}</p>
        </div>
      </div>
      <p class="font-mono text-base text-snow" id="mv-price-${m.sym}">${fmtUSD(price)}</p>
      <span class="font-mono text-xs px-2 py-0.5 rounded-lg mt-1 inline-block ${m.up ? 'text-gain bg-gain/10' : 'text-loss bg-loss/10'}">
        ${m.up ? '+' : ''}${m.chg}%
      </span>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   LIVE PRICE TICKER (DOM update every 2s)
───────────────────────────────────────────── */
function startPriceTicker(holdings) {
  setInterval(() => {
    Object.keys(LIVE_PRICES).forEach(sym => {
      LIVE_PRICES[sym] = jitter(LIVE_PRICES[sym]);
    });
    holdings.forEach(h => {
      const price = getLivePrice(h.symbol);
      setEl('hp-' + h.symbol, fmtUSD(price));
      setEl('hv-' + h.symbol, fmtUSD(price * Number(h.quantity), 0));
    });
    ['SOL','BTC','NVDA','XRP'].forEach(sym => {
      setEl('mv-price-' + sym, fmtUSD(getLivePrice(sym)));
    });
  }, 2000);
}

/* ─────────────────────────────────────────────
   CHART
───────────────────────────────────────────── */
const CHART_PTS = [82,79,85,88,83,91,94,90,96,101,98,105,108,103,112,110,118,115,122,119,128,132,127,135,140,138,145,142,148,155];

function buildChart(pts) {
  const W=680, H=200, pad=10;
  const minV=Math.min(...pts), maxV=Math.max(...pts), range=maxV-minV||1;
  const coords = pts.map((v,i) => [
    (i/(pts.length-1))*(W-2*pad)+pad,
    H-pad-((v-minV)/range)*(H-2*pad),
  ]);
  const linePts = coords.map(([x,y],i) => (i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)).join(' ');
  const area    = linePts+` L${coords[coords.length-1][0].toFixed(1)},${H} L${pad},${H} Z`;
  setSvgAttr('chartLine', 'd',  linePts);
  setSvgAttr('chartArea', 'd',  area);
  const [lx,ly] = coords[coords.length-1];
  setSvgAttr('chartDot', 'cx', lx);
  setSvgAttr('chartDot', 'cy', ly);
}

window.setRange = function(btn, range) {
  document.querySelectorAll('[onclick^="setRange"]').forEach(b => {
    b.classList.remove('bg-lift','text-snow');
    b.classList.add('text-steel');
  });
  btn.classList.add('bg-lift','text-snow');
  btn.classList.remove('text-steel');
  const variants = {
    '1W': [120,118,124,122,128,130,134],
    '1M': CHART_PTS,
    '3M': [60,65,70,68,78,82,79,85,88,92,91,96,98,103,108,112,110,118,122,128,132,127,135,140,138,145,142,148,155,160],
    '1Y': [40,42,38,50,55,52,60,58,65,70,68,75,78,82,79,85,88,92,91,96,98,103,108,112,110,118,122,128,132,135,142,148,155,162,158,168,175,180,178,185,192,198,194,200,208,212,218,224,220,228,235,240,248,255,260,268,274,280,290,298],
  };
  buildChart(variants[range] ?? CHART_PTS);
};

/* ─────────────────────────────────────────────
   TINY HELPERS
───────────────────────────────────────────── */
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setSvgAttr(id, attr, val) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(attr, val);
}
function colorGainLoss(id, isGain) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('text-gain', isGain);
  el.classList.toggle('text-loss', !isGain);
}
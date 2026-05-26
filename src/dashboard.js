// ================================================================
//  dashboard.js — Aurum Capital
//  Fully synced with Supabase.
//  • Reads profile, holdings, transactions from DB
//  • Welcome bonus credited on signup (via DB trigger)
//  • Real-time updates via Supabase channels
//  • Balance guard: prevents trades when cash is insufficient
// ================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── !! REPLACE THESE WITH YOUR PROJECT VALUES !! ──────────────────
const SUPABASE_URL  = 'https://ttwwthfeordsojmcjwxn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
const MIN_TRADE     = 10;  // minimum USD to open any trade

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Asset metadata ────────────────────────────────────────────────
const ASSET_META = {
  BTC:  { icon: 'fab fa-bitcoin',    color: '#f7931a', name: 'Bitcoin'   },
  ETH:  { icon: 'fab fa-ethereum',   color: '#627eea', name: 'Ethereum'  },
  SOL:  { icon: 'fas fa-sun',        color: '#9945ff', name: 'Solana'    },
  TSLA: { icon: 'fas fa-car',        color: '#e31937', name: 'Tesla'     },
  NVDA: { icon: 'fas fa-microchip',  color: '#76b900', name: 'NVIDIA'    },
  AAPL: { icon: 'fab fa-apple',      color: '#a2aaad', name: 'Apple'     },
  GOLD: { icon: 'fas fa-coins',      color: '#c9a84c', name: 'Gold Spot' },
  XRP:  { icon: 'fas fa-water',      color: '#00aae4', name: 'Ripple'    },
};

// ── Live price simulation (replace with real API as needed) ───────
const LIVE_PRICES = {
  BTC:  67430, ETH:  3280,  SOL:  188,
  TSLA: 248.50, NVDA: 875.20, AAPL: 189.30,
  GOLD: 2318.40, XRP: 0.72,
};
function jitter(p)         { return p * (1 + (Math.random() - 0.5) * 0.0012); }
function getLivePrice(sym) { return LIVE_PRICES[sym] ?? 0; }

// ── Format helpers ────────────────────────────────────────────────
function fmtUSD(n, decimals = 2) {
  if (n === null || n === undefined) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
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

// ── Balance guard ────────────────────────────────────────────────
/**
 * Call this before any trade to check if the user has enough cash.
 * Returns { ok: true } or { ok: false, message: string }
 */
export function checkBalance(cashAvailable, tradeAmountUSD) {
  if (tradeAmountUSD < MIN_TRADE) {
    return { ok: false, message: `Minimum trade amount is ${fmtUSD(MIN_TRADE)}.` };
  }
  if (cashAvailable < tradeAmountUSD) {
    return {
      ok: false,
      message: `Insufficient balance. You have ${fmtUSD(cashAvailable)} available but need ${fmtUSD(tradeAmountUSD)}.`,
    };
  }
  return { ok: true };
}

// ── Show a toast / notification banner ───────────────────────────
function showBanner(message, type = 'error') {
  let banner = document.getElementById('dashBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'dashBanner';
    banner.style.cssText = `
      position:fixed;bottom:24px;right:20px;z-index:200;
      padding:13px 18px;border-radius:12px;font-size:13px;
      font-family:'DM Sans',sans-serif;max-width:calc(100vw - 40px);
      box-shadow:0 20px 60px rgba(0,0,0,.5);transition:opacity .3s;
    `;
    document.body.appendChild(banner);
  }
  const styles = {
    error:   'background:#111820;border:1px solid rgba(239,68,68,.3);color:#ef4444',
    success: 'background:#111820;border:1px solid rgba(34,197,94,.3);color:#22c55e',
    info:    'background:#111820;border:1px solid rgba(201,168,76,.22);color:#c9a84c',
  };
  banner.style.cssText += ';' + (styles[type] || styles.info);
  banner.textContent = message;
  banner.style.opacity = '1';
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => { banner.style.opacity = '0'; }, 4000);
}

// ── Auth guard ───────────────────────────────────────────────────
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  return session.user;
}

// ── MAIN INIT ────────────────────────────────────────────────────
async function init() {
  const user = await requireAuth();
  if (!user) return;

  // Load all data in parallel
  const [profileRes, holdingsRes, txRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('holdings').select('*').eq('user_id', user.id),
    supabase.from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (profileRes.error) {
    console.error('Profile fetch error:', profileRes.error);
    showBanner('Could not load your profile. Please refresh.', 'error');
    return;
  }

  const profile      = profileRes.data;
  const holdings     = holdingsRes.data ?? [];
  const transactions = txRes.data ?? [];

  // Show welcome bonus banner if first login
  if (profile.welcome_bonus_active && Number(profile.cash) > 0) {
    showBanner(`🎉 Welcome bonus of ${fmtUSD(profile.cash)} credited to your account!`, 'info');
  }

  // Render everything
  renderProfile(profile);
  renderStats(profile, holdings);
  renderHoldings(holdings);
  renderTransactions(transactions);
  renderAllocation(holdings);
  renderMarketMovers();
  startPriceTicker(holdings);
  buildChart(CHART_PTS);

  // Expose current cash globally so invest.html can call checkBalance()
  window.aurumProfile  = profile;
  window.aurumHoldings = holdings;

  setEl('liveDate', new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }));

  // ── Real-time subscriptions ───────────────────────────────────
  supabase
    .channel('dashboard-realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
      async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          window.aurumProfile = data;
          renderProfile(data);
          renderStats(data, window.aurumHoldings ?? []);
        }
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'holdings', filter: `user_id=eq.${user.id}` },
      async () => {
        const { data } = await supabase.from('holdings').select('*').eq('user_id', user.id);
        const fresh = data ?? [];
        window.aurumHoldings = fresh;
        renderHoldings(fresh);
        renderAllocation(fresh);
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (p) { window.aurumProfile = p; renderStats(p, fresh); }
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
      async () => {
        const { data } = await supabase.from('transactions')
          .select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(8);
        renderTransactions(data ?? []);
      })
    .subscribe();

  // Sign-out
  document.querySelectorAll('[data-signout]').forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  });
}

// ── RENDER: Profile ──────────────────────────────────────────────
function renderProfile(profile) {
  const firstName = (profile.first_name || '').trim() || 'Investor';
  const lastName  = (profile.last_name  || '').trim();
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');
  const initials  = (profile.avatar_initials || '').trim() ||
    (firstName[0] + (lastName[0] || '')).toUpperCase();

  setEl('user-first-name', firstName);
  setEl('nav-user-fullname', fullName);
  setEl('nav-user-initials', initials);
  setEl('nav-cash-display',  fmtUSD(profile.cash) + ' available');

  document.querySelectorAll('.user-avatar-initials').forEach(el => { el.textContent = initials; });
  document.querySelectorAll('.user-display-name').forEach(el => { el.textContent = fullName; });
}

// ── RENDER: Stats ────────────────────────────────────────────────
function renderStats(profile, holdings) {
  let invested = 0, portfolioValue = 0;

  holdings.forEach(h => {
    const price = getLivePrice(h.symbol);
    portfolioValue += price * Number(h.quantity);
    invested       += Number(h.avg_buy_price) * Number(h.quantity);
  });

  const cash   = Number(profile.cash ?? 0);
  const total  = portfolioValue + cash;
  const pnlAmt = portfolioValue - invested;
  const pnlPct = invested > 0 ? (pnlAmt / invested) * 100 : 0;
  const isGain = pnlAmt >= 0;

  setEl('totalVal',    fmtUSD(total, 0));
  setEl('totalVal2',   fmtUSD(total, 0));
  setEl('totalPnlAmt', (isGain ? '+' : '') + fmtUSD(pnlAmt, 0));
  setEl('totalPnlPct', (isGain ? '+' : '') + pnlPct.toFixed(1) + '%');
  setEl('totalPnlSign', isGain ? '▲' : '▼');
  colorGainLoss('totalPnlAmt',  isGain);
  colorGainLoss('totalPnlPct',  isGain);
  colorGainLoss('totalPnlSign', isGain);

  setEl('investedVal', fmtUSD(portfolioValue, 0));
  setEl('assetCount',  holdings.length + ' asset' + (holdings.length !== 1 ? 's' : ''));
  setEl('cashVal',     fmtUSD(cash));

  // Show low balance warning on dashboard
  if (cash < MIN_TRADE && cash >= 0) {
    const warningEl = document.getElementById('lowBalanceWarning');
    if (warningEl) {
      warningEl.style.display = 'flex';
      warningEl.querySelector('span')?.textContent.replace('{{cash}}', fmtUSD(cash));
    }
  }
}

// ── RENDER: Holdings Table ───────────────────────────────────────
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

// ── RENDER: Allocation Donut ─────────────────────────────────────
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

  const entries = holdings.map((h, i) => {
    const meta  = ASSET_META[h.symbol] ?? {};
    const value = getLivePrice(h.symbol) * Number(h.quantity);
    const color = h.color || meta.color || DONUT_COLORS[i % DONUT_COLORS.length];
    return { symbol: h.symbol, name: h.name || meta.name || h.symbol, value, color };
  }).filter(e => e.value > 0);

  const total = entries.reduce((s, e) => s + e.value, 0) || 1;

  const R = 46, CIRC = 2 * Math.PI * R;
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

// ── RENDER: Transactions ─────────────────────────────────────────
function renderTransactions(txs) {
  const list = document.getElementById('txList');
  if (!list) return;

  if (txs.length === 0) {
    list.innerHTML = `<div class="px-6 py-8 text-center text-steel font-mono text-xs">No transactions yet.</div>`;
    return;
  }

  list.innerHTML = txs.map(tx => {
    const meta      = ASSET_META[tx.symbol] ?? {};
    const icon      = tx.icon  || meta.icon  || 'fas fa-circle-dot';
    const color     = tx.color || meta.color || '#5a6880';
    const isCashIn  = tx.type === 'sell' || tx.type === 'deposit';
    const typeLabel = { buy: 'Bought', sell: 'Sold', deposit: 'Deposited', withdraw: 'Withdrew' }[tx.type] ?? tx.type;
    const qtyStr    = tx.quantity
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
        <p class="font-mono text-[10px] text-steel">${timeAgo(tx.created_at)}${tx.note ? ' · ' + tx.note : ''}</p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="font-mono text-xs text-snow">${qtyStr}</p>
        <p class="font-mono text-[10px] ${isCashIn ? 'text-gain' : 'text-loss'}">${usdStr}</p>
      </div>
    </div>`;
  }).join('');
}

// ── RENDER: Market Movers ────────────────────────────────────────
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

// ── LIVE PRICE TICKER ────────────────────────────────────────────
function startPriceTicker(holdings) {
  setInterval(() => {
    Object.keys(LIVE_PRICES).forEach(sym => { LIVE_PRICES[sym] = jitter(LIVE_PRICES[sym]); });
    holdings.forEach(h => {
      const price = getLivePrice(h.symbol);
      setEl('hp-' + h.symbol, fmtUSD(price));
      setEl('hv-' + h.symbol, fmtUSD(price * Number(h.quantity), 0));
    });
    ['SOL','BTC','NVDA','XRP'].forEach(sym => setEl('mv-price-' + sym, fmtUSD(getLivePrice(sym))));
  }, 2000);
}

// ── CHART ────────────────────────────────────────────────────────
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
  setSvgAttr('chartLine', 'd', linePts);
  setSvgAttr('chartArea', 'd', area);
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

// ── TRADE FUNCTION (used by invest.html) ─────────────────────────
/**
 * Executes a buy trade for the logged-in user.
 * Checks balance, inserts transaction (DB trigger deducts cash),
 * then upserts the holding.
 */
export async function executeBuy({ userId, symbol, quantity, priceAtTx }) {
  const usdCost = quantity * priceAtTx;
  const profile = window.aurumProfile;

  if (!profile) { return { ok: false, message: 'Profile not loaded yet.' }; }

  const guard = checkBalance(Number(profile.cash), usdCost);
  if (!guard.ok) return guard;

  const meta = ASSET_META[symbol] ?? {};

  // Insert transaction — DB trigger (apply_transaction_cash) deducts cash automatically
  const { error: txError } = await supabase.from('transactions').insert({
    user_id:     userId,
    type:        'buy',
    symbol,
    name:        meta.name || symbol,
    icon:        meta.icon || '',
    color:       meta.color || '#5a6880',
    quantity,
    price_at_tx: priceAtTx,
    usd_amount:  -usdCost,  // negative = debit
    note:        'Market buy',
  });
  if (txError) return { ok: false, message: txError.message };

  // Upsert holding with new weighted avg
  const existing = (window.aurumHoldings ?? []).find(h => h.symbol === symbol);
  let newQty = quantity, newAvg = priceAtTx;
  if (existing) {
    newQty = Number(existing.quantity) + quantity;
    newAvg = (Number(existing.avg_buy_price) * Number(existing.quantity) + priceAtTx * quantity) / newQty;
  }

  const { error: holdingError } = await supabase.from('holdings').upsert({
    user_id:       userId,
    symbol,
    name:          meta.name || symbol,
    icon:          meta.icon || '',
    color:         meta.color || '#5a6880',
    quantity:      newQty,
    avg_buy_price: newAvg,
  }, { onConflict: 'user_id,symbol' });

  if (holdingError) return { ok: false, message: holdingError.message };
  return { ok: true };
}

/**
 * Executes a sell trade.
 * Checks that user holds enough quantity,
 * inserts transaction (DB trigger credits cash), updates holding.
 */
export async function executeSell({ userId, symbol, quantity, priceAtTx }) {
  const usdProceeds = quantity * priceAtTx;
  const holding = (window.aurumHoldings ?? []).find(h => h.symbol === symbol);

  if (!holding || Number(holding.quantity) < quantity) {
    return { ok: false, message: `You only hold ${fmtQty(holding?.quantity ?? 0)} ${symbol}.` };
  }

  const meta = ASSET_META[symbol] ?? {};

  const { error: txError } = await supabase.from('transactions').insert({
    user_id:     userId,
    type:        'sell',
    symbol,
    name:        meta.name || symbol,
    icon:        meta.icon || '',
    color:       meta.color || '#5a6880',
    quantity,
    price_at_tx: priceAtTx,
    usd_amount:  usdProceeds,   // positive = credit
    note:        'Market sell',
  });
  if (txError) return { ok: false, message: txError.message };

  const newQty = Number(holding.quantity) - quantity;
  if (newQty <= 0) {
    await supabase.from('holdings').delete().eq('id', holding.id);
  } else {
    await supabase.from('holdings').update({ quantity: newQty }).eq('id', holding.id);
  }

  return { ok: true };
}

// ── BOOT ─────────────────────────────────────────────────────────
init();
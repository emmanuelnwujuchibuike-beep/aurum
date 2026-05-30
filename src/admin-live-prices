// ════════════════════════════════════════════════════════════════════════
//  ADMIN — LIVE PRICES EDITOR  (drop-in replacement for dashboard.js)
//
//  FIXES:
//  1. callAdmin now refreshes the session before every call so expired
//     tokens no longer silently cause "Not logged in" or 401 errors.
//  2. admSetSinglePrice properly reads the input value AND gives a clear
//     console + toast error when the edge function rejects the request.
//  3. admSaveAllPrices sends the batch through the edge function so RLS
//     never blocks the write.
//  4. DOM selector bug fixed: was '.grid-pr-' (class), now 'grid-pr-'
//     (ID prefix) matching what renderCryptoGrid() actually creates.
//  5. admRenderPricesPage wired to the correct IDs used by save fns.
// ════════════════════════════════════════════════════════════════════════

// ── callAdmin (place this near the top of dashboard.js, replacing the
//    existing callAdmin function) ────────────────────────────────────────
async function callAdmin(action, params = {}) {
  // Always refresh the session first — prevents stale-token 401 errors
  const { data: { session }, error: sessErr } = await sb.auth.getSession();
  if (sessErr || !session) {
    // Try a hard refresh before giving up
    const { data: refreshed } = await sb.auth.refreshSession();
    if (!refreshed?.session) throw new Error('Session expired — please sign in again.');
    // Re-read after refresh
  }

  // Re-read (may have been refreshed above)
  const { data: { session: sess } } = await sb.auth.getSession();
  if (!sess) throw new Error('Not logged in');

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sess.access_token}`
    },
    body: JSON.stringify({ action, ...params })
  });

  // Surface HTTP-level errors clearly
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const result = await res.json();
  if (!result.success) throw new Error(result.error || 'Edge function returned failure');
  return result.data;
}


// ── Asset list — every sym the price editor knows about ───────────────
const ALL_EDITABLE_ASSETS = [
  { sym:'BTC',  name:'Bitcoin',    icon:'fab fa-bitcoin',        color:'#f7931a' },
  { sym:'ETH',  name:'Ethereum',   icon:'fab fa-ethereum',       color:'#627eea' },
  { sym:'SOL',  name:'Solana',     icon:'fas fa-sun',            color:'#9945ff' },
  { sym:'BNB',  name:'BNB Chain',  icon:'fas fa-coins',          color:'#f3ba2f' },
  { sym:'XRP',  name:'Ripple',     icon:'fas fa-water',          color:'#00aae4' },
  { sym:'ADA',  name:'Cardano',    icon:'fas fa-circle-nodes',   color:'#3cc8c8' },
  { sym:'TSLA', name:'Tesla',      icon:'fas fa-car',            color:'#e31937' },
  { sym:'AAPL', name:'Apple',      icon:'fab fa-apple',          color:'#a2aaad' },
  { sym:'NVDA', name:'NVIDIA',     icon:'fas fa-microchip',      color:'#76b900' },
  { sym:'MSFT', name:'Microsoft',  icon:'fab fa-windows',        color:'#00a4ef' },
  { sym:'AMZN', name:'Amazon',     icon:'fab fa-amazon',         color:'#ff9900' },
  { sym:'GOOGL',name:'Alphabet',   icon:'fab fa-google',         color:'#4285f4' },
  { sym:'GOLD', name:'Gold Spot',  icon:'fas fa-gem',            color:'#c9a84c' },
];


// ── Render the price editor rows ──────────────────────────────────────
function admRenderPricesPage() {
  const body = document.getElementById('adm-prices-body');
  if (!body) return;

  body.innerHTML = ALL_EDITABLE_ASSETS.map(a => {
    const cur     = PRICES[a.sym]         || DEFAULT_PRICES[a.sym] || 0;
    const def     = DEFAULT_PRICES[a.sym] || 0;
    const diff    = cur - def;
    const diffPct = def > 0 ? (diff / def * 100) : 0;
    // Small coins (XRP, ADA) need more decimal places
    const decimals = (a.sym === 'XRP' || a.sym === 'ADA') ? 4 : 2;

    return `
    <div class="price-row" id="price-row-${a.sym}">

      <!-- Icon + name -->
      <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">
        <div style="width:36px;height:36px;border-radius:11px;background:${a.color}18;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="${a.icon}" style="color:${a.color};font-size:16px"></i>
        </div>
        <div style="min-width:0">
          <p style="font-size:13px;font-weight:600;color:#edf2f8">${a.sym}</p>
          <p style="font-size:11px;color:#5a6880">${a.name}</p>
        </div>
      </div>

      <!-- Default reference -->
      <div style="text-align:right;margin-right:12px;min-width:80px">
        <p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880;
                  text-transform:uppercase;margin-bottom:2px">Default</p>
        <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#5a6880">
          $${fmtPrice(def)}</p>
      </div>

      <!-- Live drift vs default -->
      <div style="text-align:right;margin-right:12px;min-width:80px">
        <p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880;
                  text-transform:uppercase;margin-bottom:2px">Live</p>
        <p style="font-family:'JetBrains Mono',monospace;font-size:10px;
                  color:${Math.abs(diffPct) > 0.1 ? (diffPct > 0 ? '#22c55e' : '#ef4444') : '#5a6880'}">
          ${Math.abs(diffPct) > 0.1 ? (diffPct > 0 ? '+' : '') + diffPct.toFixed(2) + '%' : 'Default'}
        </p>
      </div>

      <!-- Price input — id MUST match what admSetSinglePrice reads -->
      <input
        class="adm-input"
        id="price-input-${a.sym}"
        type="number"
        step="any"
        value="${cur.toFixed(decimals)}"
        style="width:130px;margin-right:8px"
        onkeydown="if(event.key==='Enter'){event.preventDefault();admSetSinglePrice('${a.sym}');}"
      >

      <!-- Apply single price -->
      <button
        id="price-save-btn-${a.sym}"
        class="adm-btn adm-btn-gain adm-btn-sm"
        onclick="admSetSinglePrice('${a.sym}')"
      >Apply</button>

      <!-- Reset to default -->
      <button
        class="adm-btn adm-btn-sm"
        style="background:rgba(255,255,255,.04);color:#5a6880;
               border:1px solid rgba(255,255,255,.07);margin-left:4px"
        onclick="admResetSinglePrice('${a.sym}')"
      >↺</button>

    </div>`;
  }).join('');
}


// ── Apply a single asset price ────────────────────────────────────────
// FIX: reads from the correct input ID, refreshes session via callAdmin,
//      and shows the real error message on failure.
async function admSetSinglePrice(sym) {
  const inp = document.getElementById('price-input-' + sym);
  const btn = document.getElementById('price-save-btn-' + sym);
  if (!inp) { showToast('UI error', 'Input not found for ' + sym, 'error'); return; }

  const n = parseFloat(inp.value);
  if (isNaN(n) || n <= 0) {
    showToast('Invalid price', 'Enter a positive number for ' + sym, 'error');
    return;
  }

  const asset = ASSETS_LIST.find(a => a.sym === sym);
  const chg   = asset ? asset.chg : 0;

  // Disable button while saving
  if (btn) { btn.textContent = '…'; btn.disabled = true; }

  try {
    // Edge function — service role on server bypasses RLS
    await callAdmin('save_price', { sym, price: n, chg });

    // ── Update local in-memory state immediately ──────────────────
    PRICES[sym] = n;
    _priceUpdatedAt[sym] = Date.now();
    if (asset) asset.price = n;

    // ── Update every matching element on THIS page ────────────────
    // crypto grid prices (id="grid-pr-BTC" etc.)
    const gridPrEl = document.getElementById('grid-pr-' + sym);
    if (gridPrEl) gridPrEl.textContent = '$' + fmtPrice(n);

    // ticker prices (class="tick-price-BTC")
    document.querySelectorAll('.tick-price-' + sym).forEach(el => {
      el.textContent = '$' + fmtPrice(n);
    });

    // chart modal header price
    if (activeChartAsset === sym) {
      const cmp = document.getElementById('chart-modal-price');
      if (cmp) cmp.textContent = '$' + fmtPrice(n);
    }

    // trade modal if open for this sym
    if (tradeModalAsset && tradeModalAsset.sym === sym) {
      const tpr = document.getElementById('trade-live-price');
      if (tpr) tpr.textContent = '$' + fmtPrice(n);
      tradeModalAsset.price = n;
      updateTradeModalCalc();
    }

    // Recalculate portfolio totals
    loadPortfolioStats();

    showToast(
      'Price Updated ✓',
      `${sym} → $${fmtPrice(n)} · Synced to all pages via realtime`,
      'success'
    );

    // Re-render the price grid so the "Live" drift column refreshes
    admRenderPricesPage();

  } catch (err) {
    // Show the REAL error — not a generic message
    console.error('[admSetSinglePrice] failed for', sym, err);
    showToast('Price update failed', err.message, 'error');

  } finally {
    // Always re-enable the button
    if (btn) { btn.textContent = 'Apply'; btn.disabled = false; }
  }
}


// ── Save ALL prices at once ───────────────────────────────────────────
async function admSaveAllPrices() {
  const rows = [];

  ALL_EDITABLE_ASSETS.forEach(a => {
    const inp = document.getElementById('price-input-' + a.sym);
    if (!inp) return;
    const n = parseFloat(inp.value);
    if (!isNaN(n) && n > 0) {
      const asset = ASSETS_LIST.find(x => x.sym === a.sym);
      rows.push({ sym: a.sym, price: n, chg: asset ? asset.chg : 0 });
    }
  });

  if (!rows.length) { showToast('Nothing to save', 'No valid prices found', 'error'); return; }

  // Disable Save All button while working
  const saveAllBtn = document.getElementById('adm-save-all-btn');
  if (saveAllBtn) { saveAllBtn.textContent = 'Saving…'; saveAllBtn.disabled = true; }

  try {
    await callAdmin('save_prices_batch', { rows });

    // Apply all locally
    const now = Date.now();
    rows.forEach(r => {
      PRICES[r.sym] = r.price;
      _priceUpdatedAt[r.sym] = now;
      const asset = ASSETS_LIST.find(x => x.sym === r.sym);
      if (asset) asset.price = r.price;

      // Update grid + ticker on this page
      const gridPrEl = document.getElementById('grid-pr-' + r.sym);
      if (gridPrEl) gridPrEl.textContent = '$' + fmtPrice(r.price);
      document.querySelectorAll('.tick-price-' + r.sym).forEach(el => {
        el.textContent = '$' + fmtPrice(r.price);
      });
    });

    loadPortfolioStats();
    showToast(
      'All Prices Saved ✓',
      `${rows.length} prices synced to all pages & devices`,
      'success'
    );
    admRenderPricesPage();

  } catch (err) {
    console.error('[admSaveAllPrices] failed', err);
    showToast('Batch save failed', err.message, 'error');

  } finally {
    if (saveAllBtn) { saveAllBtn.textContent = 'Save All'; saveAllBtn.disabled = false; }
  }
}


// ── Reset a single price to its hardcoded default ─────────────────────
async function admResetSinglePrice(sym) {
  const def = DEFAULT_PRICES[sym];
  if (!def) { showToast('No default', `No default price for ${sym}`, 'error'); return; }

  try {
    await callAdmin('save_price', { sym, price: def, chg: 0 });

    PRICES[sym] = def;
    _priceUpdatedAt[sym] = Date.now();
    const asset = ASSETS_LIST.find(a => a.sym === sym);
    if (asset) { asset.price = def; asset.chg = 0; }

    const inp = document.getElementById('price-input-' + sym);
    if (inp) {
      inp.value = def.toFixed((sym === 'XRP' || sym === 'ADA') ? 4 : 2);
    }

    showToast('Price Reset', `${sym} → $${fmtPrice(def)}`, 'info');
    admRenderPricesPage();

  } catch (err) {
    console.error('[admResetSinglePrice] failed for', sym, err);
    showToast('Reset failed', err.message, 'error');
  }
}


// ── Reset ALL prices to defaults ──────────────────────────────────────
async function admResetPrices() {
  if (!confirm('Reset ALL prices to their default values?')) return;

  const rows = Object.entries(DEFAULT_PRICES).map(([sym, price]) => ({
    sym, price, chg: 0
  }));

  try {
    await callAdmin('save_prices_batch', { rows });

    const now = Date.now();
    Object.assign(PRICES, DEFAULT_PRICES);
    ASSETS_LIST.forEach(a => {
      if (DEFAULT_PRICES[a.sym] != null) {
        a.price = DEFAULT_PRICES[a.sym];
        a.chg   = 0;
        _priceUpdatedAt[a.sym] = now;
      }
    });

    showToast('All Prices Reset', 'Default prices pushed to all pages', 'info');
    admRenderPricesPage();
    loadPortfolioStats();

  } catch (err) {
    console.error('[admResetPrices] failed', err);
    showToast('Reset failed', err.message, 'error');
  }
}


// ── Expose everything globally for inline onclick handlers ────────────
window.admRenderPricesPage    = admRenderPricesPage;
window.admSetSinglePrice      = admSetSinglePrice;
window.admSaveAllPrices       = admSaveAllPrices;
window.admResetSinglePrice    = admResetSinglePrice;
window.admResetPrices         = admResetPrices;
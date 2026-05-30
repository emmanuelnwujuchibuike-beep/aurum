// price-sync.js
// Shared real-time price synchronisation for ALL pages (index, dashboard, invest)
// Include this ONCE on every HTML page that shows live prices.
// It reads from Supabase asset_prices table and broadcasts updates
// to any window-level handler named window.onPriceUpdate(sym, price, chg)

(function () {
  'use strict';

  const SUPABASE_URL  = 'https://ttwwthfeordsojmcjwxn.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';

  // Wait for supabase SDK to be available (loaded from CDN)
  function waitForSupabase(cb, tries) {
    tries = tries || 0;
    if (typeof supabase !== 'undefined' && supabase.createClient) { cb(); return; }
    if (tries > 60) { console.warn('[price-sync] supabase SDK not found after 6s'); return; }
    setTimeout(() => waitForSupabase(cb, tries + 1), 100);
  }

  waitForSupabase(function () {
    const sbSync = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    // ── 1. Load all current prices once on boot ──────────────────────
    sbSync.from('asset_prices').select('*').then(({ data, error }) => {
      if (error) {
        console.warn('[price-sync] Failed to load initial prices:', error.message);
        return;
      }
      if (!data) return;
      data.forEach(row => {
        if (row.sym && row.price != null) {
          dispatchPriceUpdate(row.sym, Number(row.price), Number(row.chg || 0));
        }
      });
      console.log('[price-sync] Loaded', data.length, 'prices from DB');
    });

    // ── 2. Subscribe to real-time INSERT / UPDATE on asset_prices ────
    sbSync
      .channel('price-sync-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asset_prices' },
        ({ new: row, eventType }) => {
          if (!row || !row.sym) return;
          console.log('[price-sync] realtime', eventType, row.sym, row.price);
          dispatchPriceUpdate(row.sym, Number(row.price), Number(row.chg || 0));
        }
      )
      .subscribe((status) => {
        console.log('[price-sync] channel status:', status);
      });
  });

  // ── Dispatcher ────────────────────────────────────────────────────
  function dispatchPriceUpdate(sym, price, chg) {
    // 1. Call the page-level handler if it exists
    if (typeof window.onPriceUpdate === 'function') {
      try { window.onPriceUpdate(sym, price, chg); } catch (e) {
        console.warn('[price-sync] onPriceUpdate error for', sym, e);
      }
    }
    // 2. Also fire a DOM CustomEvent so any element or framework can listen
    window.dispatchEvent(new CustomEvent('aurumPriceUpdate', {
      detail: { sym, price, chg }
    }));
  }

})();
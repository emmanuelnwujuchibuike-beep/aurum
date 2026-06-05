/* ═══════════════════════════════════════════════════════════
   AURUM CAPITAL — BACKEND ENGINE  (aurum-server.js)
   LocalStorage-based auth + portfolio + transactions system
═══════════════════════════════════════════════════════════ */
const response = await fetch(
  "https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/admin-update-shipment",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}` // ✅ User JWT, not service key
    },
    body: JSON.stringify({ shipmentId: "123" })
  }
)


const AurumDB = (() => {

  const KEYS = {
    users    : 'aurum_users',
    session  : 'aurum_session',
    portfolio: uid => `aurum_portfolio_${uid}`,
    txs      : uid = `aurum_txs_${uid}`,
  };

  /* ── Helpers ──────────────────────────────────────────── */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  /* Poor-man hash (not secure — demo only) */
  function hashPw(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
    return 'h_' + Math.abs(h).toString(36) + pw.length.toString(36);
  }
  function uid() { return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function txid(){ return 'tx_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

  /* ── Auth ─────────────────────────────────────────────── */

  /* Inside the AurumDB auth object */
const aut= {
  // ... existing register code ...
  
  // ADD THIS NEW METHOD
  async syncToContentful(user) {
    // We will use a fetch call here once your middleware is ready
    // For now, we simulate the logic
    return { ok: true }; 
  },
  
  // ... existing methods ...
};




  const auth = {
    register({ firstName, lastName, email, password }) {
      const users = load(KEYS.users, []);
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
        return { ok: false, error: 'An account with that email already exists.' };
      if (password.length < 8)
        return { ok: false, error: 'Password must be at least 8 characters.' };

      const user = {
        id: uid(), firstName, lastName,
        email: email.toLowerCase(),
        passwordHash: hashPw(password),
        createdAt: Date.now(),
        plan: 'standard',
        cash: 100, // Welcome bonus
        avatarInitials: (firstName[0] + lastName[0]).toUpperCase(),
      };
      users.push(user);
      save(KEYS.users, users);

      /* Seed starting portfolio */
      portfolio.seed(user.id);

      /* Auto-login */
      this._startSession(user.id);
      return { ok: true, user };
    },

    login({ email, password }) {
      const users = load(KEYS.users, []);
      const user  = users.find(u => u.email === email.toLowerCase());
      if (!user) return { ok: false, error: 'No account found with that email.' };
      if (user.passwordHash !== hashPw(password)) return { ok: false, error: 'Incorrect password.' };
      this._startSession(user.id);
      return { ok: true, user };
    },

    logout() { localStorage.removeItem(KEYS.session); },

    _startSession(userId) {
      save(KEYS.session, { userId, token: uid(), expiresAt: Date.now() + 7 * 86400000 });
    },

    currentUser() {
      const sess = load(KEYS.session, null);
      if (!sess || sess.expiresAt < Date.now()) return null;
      const users = load(KEYS.users, []);
      return users.find(u => u.id === sess.userId) || null;
    },

    requireAuth(redirectTo = 'signup.html') {
      if (!this.currentUser()) { window.location.href = redirectTo; return false; }
      return true;
    },

    updateUser(partial) {
      const users = load(KEYS.users, []);
      const sess  = load(KEYS.session, null);
      if (!sess) return;
      const idx = users.findIndex(u => u.id === sess.userId);
      if (idx === -1) return;
      users[idx] = { ...users[idx], ...partial };
      save(KEYS.users, users);
      return users[idx];
    },
  };

  /* ── Portfolio ────────────────────────────────────────── */
  const portfolio = {
    seed(userId) {
      /* Give new user a demo starting portfolio */
      const positions = [
        { sym:'BTC', name:'Bitcoin',   qty:0.12,  avgPrice:61000, color:'#f7931a', icon:'fab fa-bitcoin'   },
        { sym:'ETH', name:'Ethereum',  qty:2.5,   avgPrice:2900,  color:'#627eea', icon:'fab fa-ethereum'  },
        { sym:'TSLA',name:'Tesla',     qty:15,    avgPrice:220,   color:'#e31937', icon:'fas fa-car'       },
      ];
      save(KEYS.portfolio(userId), positions);

      const txs = [
        { id:txid(), type:'deposit', sym:'USD',  name:'Welcome Bonus',  qty:10000, price:1,    total:10000, ts:Date.now()-86400000*3 },
        { id:txid(), type:'buy',     sym:'BTC',  name:'Bitcoin',        qty:0.12,  price:61000,total:7320,  ts:Date.now()-86400000*2 },
        { id:txid(), type:'buy',     sym:'ETH',  name:'Ethereum',       qty:2.5,   price:2900, total:7250,  ts:Date.now()-86400000*1 },
        { id:txid(), type:'buy',     sym:'TSLA', name:'Tesla',          qty:15,    price:220,  total:3300,  ts:Date.now()-86400000   },
      ];
      save(KEYS.txs(userId), txs);
    },

    get(userId) { return load(KEYS.portfolio(userId), []); },

    invest(userId, assetSym, assetName, qty, price, color, icon) {
      const positions = this.get(userId);
      const users = load(KEYS.users, []);
      const uIdx  = users.findIndex(u => u.id === userId);
      if (uIdx === -1) return { ok:false, error:'User not found' };

      const total = qty * price;
      if (users[uIdx].cash < total) return { ok:false, error:'Insufficient cash balance.' };

      /* Update position */
      const posIdx = positions.findIndex(p => p.sym === assetSym);
      if (posIdx >= 0) {
        const old = positions[posIdx];
        const newQty = old.qty + qty;
        positions[posIdx] = { ...old, qty: newQty, avgPrice: ((old.qty * old.avgPrice) + total) / newQty };
      } else {
        positions.push({ sym:assetSym, name:assetName, qty, avgPrice:price, color, icon });
      }
      save(KEYS.portfolio(userId), positions);

      /* Deduct cash */
      users[uIdx].cash = parseFloat((users[uIdx].cash - total).toFixed(2));
      save(KEYS.users, users);

      /* Log transaction */
      const txs = load(KEYS.txs(userId), []);
      txs.unshift({ id:txid(), type:'buy', sym:assetSym, name:assetName, qty, price, total, ts:Date.now() });
      save(KEYS.txs(userId), txs);

      return { ok:true, position: positions[posIdx >= 0 ? posIdx : positions.length-1] };
    },

    getTransactions(userId, limit=20) {
      return load(KEYS.txs(userId), []).slice(0, limit);
    },

    totalValue(userId, livePrices) {
      const positions = this.get(userId);
      return positions.reduce((sum, p) => {
        const livePrice = livePrices[p.sym] || p.avgPrice;
        return sum + (p.qty * livePrice);
      }, 0);
    },

    deposit(userId, amount) {
      const users = load(KEYS.users, []);
      const idx   = users.findIndex(u => u.id === userId);
      if (idx === -1) return;
      users[idx].cash = parseFloat((users[idx].cash + amount).toFixed(2));
      save(KEYS.users, users);
      const txs = load(KEYS.txs(userId), []);
      txs.unshift({ id:txid(), type:'deposit', sym:'USD', name:'Cash Deposit', qty:amount, price:1, total:amount, ts:Date.now() });
      save(KEYS.txs(userId), txs);
    },
  };

  /* ── Watchlist ────────────────────────────────────────── */
  const watchlist = {
    get(userId)       { return load(`aurum_watchlist_${userId}`, ['BTC','ETH','TSLA']); },
    toggle(userId, sym) {
      const wl = this.get(userId);
      const idx = wl.indexOf(sym);
      if (idx >= 0) wl.splice(idx, 1); else wl.push(sym);
      save(`aurum_watchlist_${userId}`, wl);
      return wl;
    },
    has(userId, sym)  { return this.get(userId).includes(sym); },
  };

  return { auth, portfolio, watchlist, load, save, KEYS };
})();

/* Make globally available */
// window.AurumDB = AurumDB;
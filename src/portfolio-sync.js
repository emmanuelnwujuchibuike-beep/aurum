
(function () {
  'use strict';

  const SUPABASE_URL  = 'https://ttwwthfeordsojmcjwxn.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';

  const GREEN = '#22c55e', RED = '#ef4444', GOLD = '#c9a84c';
  const LOT_VALUE = { crypto: 1000, stocks: 500, property: 2000 };
  const LOT_STEPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];

  const ASSET_REGISTRY = {
    BTC :{name:'Bitcoin',     icon:'fab fa-bitcoin',       color:'#f7931a',cat:'crypto'},
    ETH :{name:'Ethereum',    icon:'fab fa-ethereum',      color:'#627eea',cat:'crypto'},
    SOL :{name:'Solana',      icon:'fas fa-sun',           color:'#9945ff',cat:'crypto'},
    BNB :{name:'BNB Chain',   icon:'fas fa-coins',         color:'#f3ba2f',cat:'crypto'},
    XRP :{name:'Ripple',      icon:'fas fa-water',         color:'#00aae4',cat:'crypto'},
    ADA :{name:'Cardano',     icon:'fas fa-circle-nodes',  color:'#3cc8c8',cat:'crypto'},
    TSLA:{name:'Tesla',       icon:'fas fa-car',           color:'#e31937',cat:'stocks'},
    AAPL:{name:'Apple',       icon:'fab fa-apple',         color:'#a2aaad',cat:'stocks'},
    NVDA:{name:'NVIDIA',      icon:'fas fa-microchip',     color:'#76b900',cat:'stocks'},
    MSFT:{name:'Microsoft',   icon:'fab fa-windows',       color:'#00a4ef',cat:'stocks'},
    AMZN:{name:'Amazon',      icon:'fab fa-amazon',        color:'#ff9900',cat:'stocks'},
    GOOGL:{name:'Alphabet',   icon:'fab fa-google',        color:'#4285f4',cat:'stocks'},
    GOLD:{name:'Gold Spot',   icon:'fas fa-gem',           color:'#c9a84c',cat:'stocks'},
    LOND:{name:'The Shard Tower Suite',    icon:'fas fa-building',         color:'#c9a84c',cat:'property',yieldApy:9.2, minEntry:500},
    DXB :{name:'Burj Khalifa Residences', icon:'fas fa-city',             color:'#e8c96a',cat:'property',yieldApy:11.4,minEntry:1000},
    NYC :{name:'One Manhattan West',      icon:'fas fa-building-columns', color:'#a0c0e8',cat:'property',yieldApy:7.8, minEntry:500},
    DXB2:{name:'Palm Jumeirah Villa',     icon:'fas fa-umbrella-beach',   color:'#f3ba2f',cat:'property',yieldApy:13.5,minEntry:2000},
    SGP :{name:'Marina Bay Tower',        icon:'fas fa-water',            color:'#3cc8c8',cat:'property',yieldApy:8.9, minEntry:500},
    PAR :{name:"Champs-\u00c9lys\u00e9es Office", icon:'fas fa-tower-broadcast', color:'#627eea',cat:'property',yieldApy:10.2,minEntry:1000},
  };

  const IS_TRADE_PAGE = /trade\.html/i.test(window.location.pathname) ||
                        window.location.pathname.endsWith('/trade');

  let _sb=null,_uid=null,_profile=null,_holdings=[],_openTrades=[];
  let _panelOpen=false,_cfdOpen=false,_bsSym=null,_bsType='buy';
  let _cfdSym=null,_cfdDir='long',_cfdLots=1,_portfolioTab='holdings';
  let _pnlTimer=null,_fabOpen=false;

  const $   = id => document.getElementById(id);
  const txt = (id,v) => { const e=$(id); if(e) e.textContent=v; };
  const fmt  = n => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtP = p => {
    if(p>=1000) return p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if(p>=1)    return p.toFixed(2);
    return p.toFixed(4);
  };

  function livePrice(sym) {
    if(window.ALL_ASSETS){const a=window.ALL_ASSETS.find(x=>x.sym===sym);if(a&&+a.price>0)return+a.price;}
    if(window.PRICES&&window.PRICES[sym]!=null)return+window.PRICES[sym];
    if(window.ASSETS_LIST){const a=window.ASSETS_LIST.find(x=>x.sym===sym);if(a&&+a.price>0)return+a.price;}
    const h=_holdings.find(x=>x.symbol===sym);return h?+h.avg_buy_price:0;
  }

  function waitForSupabase(cb){
    if(window.supabase&&window.supabase.createClient)cb();
    else setTimeout(()=>waitForSupabase(cb),80);
  }

  async function boot(){
    _sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON);
    const{data:{session}}=await _sb.auth.getSession();
    if(!session){
      const nb=$('ps-topbar-btn');if(nb)nb.style.display='none';
      const w=$('ps-fab-wrapper');if(w)w.style.display='none';
      return;
    }
    _uid=session.user.id;
    await refreshAll();
    _sb.channel('ps-profile').on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:`id=eq.${_uid}`},({new:row})=>{_profile={..._profile,...row};_refreshPanelStats();}).subscribe();
    _sb.channel('ps-holdings').on('postgres_changes',{event:'*',schema:'public',table:'holdings',filter:`user_id=eq.${_uid}`},async()=>{await _loadHoldings();if(_panelOpen)renderPanel();}).subscribe();
    try{_sb.channel('ps-trades').on('postgres_changes',{event:'*',schema:'public',table:'open_trades',filter:`user_id=eq.${_uid}`},async()=>{await _loadOpenTrades();if(_panelOpen)renderPanel();}).subscribe();}catch(e){}
  }

  async function refreshAll(){await Promise.all([_loadProfile(),_loadHoldings(),_loadOpenTrades()]);_refreshPanelStats();}
  async function _loadProfile(){const{data,error}=await _sb.from('profiles').select('*').eq('id',_uid).single();if(!error&&data)_profile=data;}
  async function _loadHoldings(){const{data,error}=await _sb.from('holdings').select('*').eq('user_id',_uid);if(!error)_holdings=data||[];}
  async function _loadOpenTrades(){try{const{data,error}=await _sb.from('open_trades').select('*').eq('user_id',_uid).eq('status','open');if(!error)_openTrades=data||[];}catch(e){_openTrades=[];}}

  /* CSS */
  function injectCSS(){
    if($('ps-styles'))return;
    const s=document.createElement('style');
    s.id='ps-styles';
    s.textContent=`
#ps-backdrop{position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,.78);backdrop-filter:blur(10px);opacity:0;pointer-events:none;transition:opacity .3s}
#ps-backdrop.open{opacity:1;pointer-events:all}
#ps-panel{position:fixed;top:0;right:0;height:100%;width:min(500px,100vw);z-index:1101;background:linear-gradient(170deg,#0d1520,#080e18);border-left:1px solid rgba(255,255,255,.08);transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto;display:flex;flex-direction:column}
#ps-panel.open{transform:translateX(0)}
.ps-hdr{padding:22px 22px 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.ps-close-x{width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:#5a6880;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.ps-close-x:hover{background:rgba(255,255,255,.1);color:#edf2f8}
.ps-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px 22px 0}
.ps-stat-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;text-align:center}
.ps-stat-v{font-family:'Cormorant Garamond',serif;font-size:18px;color:#edf2f8;font-weight:300}
.ps-stat-l{font-family:'JetBrains Mono',monospace;font-size:8px;color:#5a6880;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.ps-tabs{display:flex;gap:6px;padding:14px 22px 0}
.ps-tab{flex:1;padding:9px;border-radius:11px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#5a6880;font-family:'JetBrains Mono',monospace;font-size:11px;cursor:pointer;transition:all .2s}
.ps-tab.on{background:rgba(201,168,76,.12);border-color:rgba(201,168,76,.3);color:#c9a84c}
.ps-body{flex:1;padding:14px 22px 32px;overflow-y:auto}
.ps-cat-label{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 8px;padding-left:2px}
.ps-hrow{display:flex;align-items:center;gap:11px;padding:12px 14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);border-radius:14px;margin-bottom:7px;transition:border-color .2s}
.ps-hrow:hover{border-color:rgba(201,168,76,.25)}
.ps-hrow-btns{display:flex;flex-direction:column;gap:4px;flex-shrink:0}
.ps-ab{padding:5px 10px;border-radius:8px;border:none;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.ps-ab.buy{background:rgba(34,197,94,.12);color:#22c55e}.ps-ab.buy:hover{background:rgba(34,197,94,.22)}
.ps-ab.sell{background:rgba(239,68,68,.1);color:#ef4444}.ps-ab.sell:hover{background:rgba(239,68,68,.2)}
.ps-ab.cfd{background:rgba(201,168,76,.12);color:#c9a84c}.ps-ab.cfd:hover{background:rgba(201,168,76,.22)}
.ps-trow{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);border-radius:14px;padding:14px;margin-bottom:8px}
.ps-trow.long{border-left:3px solid #22c55e}.ps-trow.short{border-left:3px solid #ef4444}
.ps-pnl{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600}
.ps-pnl.g{color:#22c55e}.ps-pnl.r{color:#ef4444}
.ps-close-trade{padding:6px 14px;border-radius:9px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#ef4444;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .2s}
.ps-close-trade:hover{background:rgba(239,68,68,.2)}
#ps-cfd{position:fixed;top:0;right:0;height:100%;width:min(460px,100vw);z-index:1102;background:linear-gradient(170deg,#0a1320,#06101a);border-left:1px solid rgba(255,255,255,.09);transform:translateX(100%);transition:transform .35s cubic-bezier(.16,1,.3,1);overflow-y:auto;display:flex;flex-direction:column}
#ps-cfd.open{transform:translateX(0)}
.cfd-sec{margin:0 20px 14px;padding:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px}
.cfd-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#5a6880;margin-bottom:8px}
.cfd-dir-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cfd-dir-btn{padding:13px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;color:#5a6880}
.cfd-dir-btn.lon{background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.4);color:#22c55e}
.cfd-dir-btn.sho{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4);color:#ef4444}
.lot-wrap{display:flex;flex-wrap:wrap;gap:6px}
.lot-chip{padding:5px 11px;border-radius:8px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);color:#8c9db5;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .2s}
.lot-chip.on{background:rgba(201,168,76,.15);border-color:rgba(201,168,76,.35);color:#c9a84c}
.cfd-inp{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;color:#edf2f8;font-family:'JetBrains Mono',monospace;font-size:13px;outline:none;transition:border-color .2s;box-sizing:border-box}
.cfd-inp:focus{border-color:rgba(201,168,76,.45)}
.cfd-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cfd-stat{background:rgba(4,6,8,.6);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;text-align:center}
.cfd-stat .v{font-family:'JetBrains Mono',monospace;font-size:13px;color:#edf2f8;font-weight:600}
.cfd-stat .l{font-family:'JetBrains Mono',monospace;font-size:8px;color:#5a6880;text-transform:uppercase;letter-spacing:.08em;margin-top:3px}
.cfd-ok-btn{width:calc(100% - 40px);margin:0 20px 20px;padding:15px;border-radius:14px;border:none;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.cfd-ok-btn.lon{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff}
.cfd-ok-btn.sho{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff}
.cfd-ok-btn:disabled{opacity:.45;cursor:not-allowed}
#ps-bs{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.9);backdrop-filter:blur(18px);display:none;align-items:center;justify-content:center;padding:16px}
#ps-bs.open{display:flex}
#ps-bs-box{background:linear-gradient(155deg,#0e1622,#0a1018);border:1px solid rgba(255,255,255,.09);border-radius:24px;width:100%;max-width:460px;max-height:94vh;overflow-y:auto}
.bs-inp-wrap{display:flex;align-items:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:13px;overflow:hidden;transition:border-color .2s}
.bs-inp-wrap:focus-within{border-color:rgba(201,168,76,.45)}
.bs-inp{flex:1;background:transparent;border:none;padding:13px;color:#edf2f8;font-family:'JetBrains Mono',monospace;font-size:18px;outline:none}
.bs-preset{flex:1;padding:7px;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:.65rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#8c9db5;cursor:pointer;transition:all .2s}
.bs-preset:hover{background:rgba(255,255,255,.09)}
.bs-ok-btn{width:100%;padding:15px;border-radius:14px;border:none;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .25s}
.bs-ok-btn:disabled{opacity:.45;cursor:not-allowed}
#ps-topbar-btn{padding:5px 14px;border-radius:9px;border:1px solid rgba(201,168,76,.3);background:rgba(201,168,76,.1);color:#c9a84c;font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;white-space:nowrap}
#ps-topbar-btn:hover{background:rgba(201,168,76,.2);border-color:rgba(201,168,76,.5)}
#ps-trades-badge{background:#ef4444;color:#fff;border-radius:20px;padding:1px 6px;font-size:9px;margin-left:4px;display:none}

/* ═══════════════════════════════════════════════
   ULTRA-PREMIUM TRADE FAB — v8 FLOATING ISLAND
═══════════════════════════════════════════════ */
#ps-fab-wrapper{
  position:fixed;bottom:34px;right:0;z-index:900;
  display:none;align-items:center;justify-content:flex-end;gap:12px;
  pointer-events:none;padding-right:20px;
}

/* ── Premium squircle trigger ── */
#ps-fab-trigger{
  pointer-events:all;position:relative;
  width:54px;height:54px;border-radius:18px;
  flex-shrink:0;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  background:linear-gradient(145deg,#18273d 0%,#0c1828 55%,#060e1a 100%);
  box-shadow:
    0 10px 36px rgba(0,0,0,.72),
    0 3px 10px rgba(0,0,0,.5),
    0 0 0 1px rgba(201,168,76,.22),
    inset 0 1px 0 rgba(255,255,255,.07),
    inset 0 -1px 0 rgba(0,0,0,.32);
  transition:box-shadow .35s cubic-bezier(.16,1,.3,1),background .35s,transform .3s cubic-bezier(.16,1,.3,1);
  z-index:2;
}
/* Animated gradient orbit ring via mask-composite — no extra JS, no clip-path */
.fab-orbit-ring{
  position:absolute;inset:-2px;border-radius:20px;
  background:conic-gradient(
    from 0deg,
    rgba(201,168,76,0) 0%,
    rgba(201,168,76,.55) 10%,
    rgba(255,240,150,.92) 20%,
    rgba(201,168,76,.5) 30%,
    rgba(201,168,76,0) 46%,
    rgba(201,168,76,0) 100%
  );
  animation:fab-orbit 3.8s linear infinite;
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  padding:1.5px;
  z-index:0;pointer-events:none;
}
@keyframes fab-orbit{to{transform:rotate(360deg);}}
.fab-bar{position:relative;z-index:2;}

#ps-fab-trigger:hover,#ps-fab-trigger.open{
  transform:scale(1.07);
  background:linear-gradient(145deg,#1e3050 0%,#101e32 55%,#08101e 100%);
  box-shadow:
    0 14px 48px rgba(0,0,0,.82),
    0 4px 14px rgba(0,0,0,.58),
    0 0 0 1px rgba(201,168,76,.46),
    0 0 40px rgba(201,168,76,.24),
    inset 0 1px 0 rgba(255,255,255,.1),
    inset 0 -1px 0 rgba(0,0,0,.32);
}
.fab-bar{
  width:15px;height:1.5px;
  background:linear-gradient(90deg,#c9a84c,#f0e4a8);
  border-radius:2px;
  transition:transform .42s cubic-bezier(.16,1,.3,1),opacity .24s,width .3s;
  transform-origin:center;
}
#ps-fab-trigger.open .fab-bar:nth-child(1){transform:translateY(6.5px) rotate(45deg);width:16px;}
#ps-fab-trigger.open .fab-bar:nth-child(2){opacity:0;transform:scaleX(0);}
#ps-fab-trigger.open .fab-bar:nth-child(3){transform:translateY(-6.5px) rotate(-45deg);width:16px;}
@keyframes fab-hb{
  0%,100%{
    box-shadow:0 10px 36px rgba(0,0,0,.72),0 3px 10px rgba(0,0,0,.5),
    0 0 0 1px rgba(201,168,76,.18),inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.32);
  }
  50%{
    box-shadow:0 10px 36px rgba(0,0,0,.72),0 3px 10px rgba(0,0,0,.5),
    0 0 0 1px rgba(201,168,76,.5),0 0 30px rgba(201,168,76,.22),
    inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.32);
  }
}
#ps-fab-trigger:not(.open):not(:hover){animation:fab-hb 3.5s ease-in-out infinite;}

/* ── Main floating pill button ── */
#ps-trade-launch-btn{
  pointer-events:none;
  display:flex;align-items:center;gap:0;
  height:72px;
  /* PILL shape — no clip-path, so real box-shadow works */
  border-radius:28px;
  border:1px solid rgba(201,168,76,.16);
  padding:0 22px 0 8px;
  background:linear-gradient(145deg,
    rgba(22,36,58,.97) 0%,
    rgba(13,22,38,.98) 35%,
    rgba(8,14,26,.99) 65%,
    rgba(4,8,18,1) 100%
  );
  cursor:pointer;text-decoration:none;
  position:relative;overflow:hidden;isolation:isolate;
  transform:translateX(115%) scale(.86);
  opacity:0;transform-origin:right center;
  transition:transform .55s cubic-bezier(.16,1,.3,1),opacity .4s cubic-bezier(.16,1,.3,1);
  /* Deep layered box-shadow — possible now that clip-path is gone */
  box-shadow:
    0 24px 60px rgba(0,0,0,.72),
    0 8px 22px rgba(0,0,0,.56),
    0 2px 7px rgba(0,0,0,.42),
    0 0 0 1px rgba(201,168,76,.1),
    inset 0 1px 0 rgba(255,255,255,.07),
    inset 0 -1px 0 rgba(0,0,0,.32);
  backdrop-filter:blur(20px) saturate(150%);
  -webkit-backdrop-filter:blur(20px) saturate(150%);
  will-change:transform,opacity;
}
/* Glass top-arc */
#ps-trade-launch-btn::before{
  content:'';position:absolute;
  top:0;left:0;right:0;height:50%;
  background:linear-gradient(180deg,rgba(255,255,255,.1) 0%,rgba(255,255,255,0) 100%);
  border-radius:28px 28px 80% 80% / 28px 28px 28px 28px;
  pointer-events:none;z-index:2;
}
/* Diagonal shimmer sweep */
#ps-trade-launch-btn::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(108deg,transparent 16%,rgba(201,168,76,.18) 42%,rgba(255,248,220,.3) 50%,rgba(201,168,76,.14) 58%,transparent 84%);
  transform:translateX(-150%);pointer-events:none;z-index:3;
}
#ps-trade-launch-btn.open::after{animation:fab-shimmer 3s ease-in-out infinite;animation-delay:.55s;}
@keyframes fab-shimmer{0%{transform:translateX(-150%);}42%,100%{transform:translateX(175%);}}

/* Left gold accent bar */
.fab-edge-bar{
  position:absolute;left:13px;top:22%;bottom:22%;width:2px;
  background:linear-gradient(180deg,transparent,rgba(201,168,76,.72) 38%,rgba(255,240,160,.96) 50%,rgba(201,168,76,.72) 62%,transparent);
  border-radius:2px;z-index:4;opacity:0;transition:opacity .38s .18s;
}
#ps-trade-launch-btn.open .fab-edge-bar{opacity:1;}

/* Open state */
#ps-trade-launch-btn.open{
  pointer-events:all;
  transform:translateX(0) scale(1);opacity:1;
  border-color:rgba(201,168,76,.22);
  box-shadow:
    0 28px 72px rgba(0,0,0,.78),
    0 10px 28px rgba(0,0,0,.62),
    0 4px 10px rgba(0,0,0,.46),
    0 0 0 1px rgba(201,168,76,.2),
    inset 0 1px 0 rgba(255,255,255,.08),
    inset 0 -1px 0 rgba(0,0,0,.35),
    0 0 56px rgba(201,168,76,.1);
}
#ps-trade-launch-btn.open:hover{
  transform:translateY(-3px);
  border-color:rgba(201,168,76,.38);
  box-shadow:
    0 38px 90px rgba(0,0,0,.85),
    0 16px 42px rgba(0,0,0,.68),
    0 5px 14px rgba(0,0,0,.52),
    0 0 0 1px rgba(201,168,76,.4),
    inset 0 1px 0 rgba(255,255,255,.1),
    inset 0 -1px 0 rgba(0,0,0,.38),
    0 0 100px rgba(201,168,76,.22);
  transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s cubic-bezier(.16,1,.3,1),border-color .3s;
}

/* Icon ring */
.fab-icon-ring{
  flex-shrink:0;width:46px;height:46px;border-radius:14px;
  background:linear-gradient(145deg,rgba(201,168,76,.22),rgba(201,168,76,.06));
  border:1px solid rgba(201,168,76,.32);
  display:flex;align-items:center;justify-content:center;
  font-size:19px;color:#c9a84c;position:relative;
  box-shadow:0 2px 14px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.1);
  transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s;
  margin-left:10px;margin-right:16px;
}
#ps-trade-launch-btn.open:hover .fab-icon-ring{
  transform:rotate(-12deg) scale(1.12);
  box-shadow:0 4px 24px rgba(201,168,76,.4),inset 0 1px 0 rgba(255,255,255,.14);
}
.fab-icon-ring::after{
  content:'';position:absolute;inset:-3px;border-radius:16px;
  border:1px solid transparent;
  border-top-color:rgba(201,168,76,.65);border-right-color:rgba(201,168,76,.28);
  animation:fab-spin 5s linear infinite;
}
@keyframes fab-spin{to{transform:rotate(360deg);}}

/* Text block */
.fab-text-block{display:flex;flex-direction:column;gap:4px;flex-shrink:0;}
.fab-label{
  font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;
  color:#ede6d4;letter-spacing:.03em;line-height:1;
  opacity:0;transform:translateY(9px);
  transition:opacity .36s .16s,transform .42s .16s cubic-bezier(.16,1,.3,1);
}
.fab-sub{
  font-family:'JetBrains Mono',monospace;font-size:8px;
  color:rgba(201,168,76,.62);text-transform:uppercase;letter-spacing:.24em;
  opacity:0;transform:translateY(6px);
  transition:opacity .32s .28s,transform .38s .28s cubic-bezier(.16,1,.3,1);
}
#ps-trade-launch-btn.open .fab-label,
#ps-trade-launch-btn.open .fab-sub{opacity:1;transform:translateY(0);}

/* Chevron */
.fab-chevron{
  font-size:11px;color:rgba(201,168,76,.42);
  opacity:0;transform:translateX(-8px);flex-shrink:0;
  transition:opacity .3s .38s,transform .4s .38s cubic-bezier(.16,1,.3,1);
}
#ps-trade-launch-btn.open .fab-chevron{opacity:1;transform:translateX(0);}
#ps-trade-launch-btn.open:hover .fab-chevron{
  transform:translateX(5px);color:rgba(201,168,76,.88);
  transition:transform .3s cubic-bezier(.16,1,.3,1),color .3s,opacity .3s;
}

/* Live pulse dot */
.fab-live-dot{
  width:7px;height:7px;border-radius:50%;flex-shrink:0;
  background:radial-gradient(circle at 35% 35%,#7cffa4,#22c55e);
  animation:fab-dot-pulse 2.2s ease-out infinite;
}
@keyframes fab-dot-pulse{
  0%{box-shadow:0 0 0 0 rgba(34,197,94,.7);}
  65%{box-shadow:0 0 0 8px rgba(34,197,94,0);}
  100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}
}

/* Spark particles */
.fab-spark{
  position:absolute;border-radius:50%;pointer-events:none;opacity:0;
  animation:fab-spark var(--dur) ease-out forwards;
}
@keyframes fab-spark{
  0%{opacity:1;transform:translate(0,0) scale(1);}
  100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0);}
}

/* ── LIGHT MODE ── */
html[data-theme="light"] #ps-fab-trigger{
  background:linear-gradient(145deg,#f0e8d4 0%,#e4d8bc 55%,#d8cab0 100%);
  box-shadow:
    0 10px 36px rgba(0,0,0,.16),
    0 3px 10px rgba(0,0,0,.12),
    0 0 0 1px rgba(159,122,30,.3),
    inset 0 1px 0 rgba(255,255,255,.72),
    inset 0 -1px 0 rgba(0,0,0,.08);
}
html[data-theme="light"] #ps-fab-trigger:hover,
html[data-theme="light"] #ps-fab-trigger.open{
  background:linear-gradient(145deg,#f5eedc 0%,#ece3c8 55%,#e2d4b0 100%);
  box-shadow:
    0 14px 48px rgba(0,0,0,.2),
    0 4px 14px rgba(0,0,0,.14),
    0 0 0 1px rgba(159,122,30,.54),
    0 0 38px rgba(159,122,30,.3),
    inset 0 1px 0 rgba(255,255,255,.82),
    inset 0 -1px 0 rgba(0,0,0,.1);
}
html[data-theme="light"] .fab-orbit-ring{
  background:conic-gradient(
    from 0deg,
    rgba(159,122,30,0) 0%,
    rgba(159,122,30,.65) 10%,
    rgba(200,158,40,.9) 20%,
    rgba(159,122,30,.58) 30%,
    rgba(159,122,30,0) 46%,
    rgba(159,122,30,0) 100%
  );
}
html[data-theme="light"] .fab-bar{background:linear-gradient(90deg,#9f7a1e,#c9a030);}
@keyframes fab-hb-light{
  0%,100%{
    box-shadow:0 10px 36px rgba(0,0,0,.16),0 3px 10px rgba(0,0,0,.12),
    0 0 0 1px rgba(159,122,30,.26),inset 0 1px 0 rgba(255,255,255,.72),inset 0 -1px 0 rgba(0,0,0,.08);
  }
  50%{
    box-shadow:0 10px 36px rgba(0,0,0,.16),0 3px 10px rgba(0,0,0,.12),
    0 0 0 1px rgba(159,122,30,.56),0 0 30px rgba(159,122,30,.28),
    inset 0 1px 0 rgba(255,255,255,.72),inset 0 -1px 0 rgba(0,0,0,.08);
  }
}
html[data-theme="light"] #ps-fab-trigger:not(.open):not(:hover){animation:fab-hb-light 3.5s ease-in-out infinite;}
html[data-theme="light"] #ps-trade-launch-btn{
  background:linear-gradient(145deg,
    rgba(252,247,238,.97) 0%,
    rgba(244,236,220,.98) 35%,
    rgba(235,224,202,.99) 65%,
    rgba(222,208,182,1) 100%
  );
  border-color:rgba(159,122,30,.2);
  box-shadow:
    0 24px 60px rgba(0,0,0,.13),
    0 8px 22px rgba(0,0,0,.1),
    0 2px 7px rgba(0,0,0,.08),
    0 0 0 1px rgba(159,122,30,.12),
    inset 0 1px 0 rgba(255,255,255,.88),
    inset 0 -1px 0 rgba(0,0,0,.07);
}
html[data-theme="light"] #ps-trade-launch-btn::before{
  background:linear-gradient(180deg,rgba(255,255,255,.62) 0%,rgba(255,255,255,0) 100%);
}
html[data-theme="light"] #ps-trade-launch-btn::after{
  background:linear-gradient(108deg,transparent 16%,rgba(159,122,30,.13) 42%,rgba(255,248,200,.36) 50%,rgba(159,122,30,.1) 58%,transparent 84%);
}
html[data-theme="light"] #ps-trade-launch-btn.open{
  border-color:rgba(159,122,30,.24);
  box-shadow:
    0 28px 72px rgba(0,0,0,.15),
    0 10px 28px rgba(0,0,0,.11),
    0 4px 10px rgba(0,0,0,.09),
    0 0 0 1px rgba(159,122,30,.2),
    inset 0 1px 0 rgba(255,255,255,.92),
    inset 0 -1px 0 rgba(0,0,0,.08),
    0 0 56px rgba(159,122,30,.1);
}
html[data-theme="light"] #ps-trade-launch-btn.open:hover{
  border-color:rgba(159,122,30,.42);
  box-shadow:
    0 38px 90px rgba(0,0,0,.18),
    0 16px 42px rgba(0,0,0,.13),
    0 5px 14px rgba(0,0,0,.1),
    0 0 0 1px rgba(159,122,30,.44),
    inset 0 1px 0 rgba(255,255,255,.94),
    inset 0 -1px 0 rgba(0,0,0,.09),
    0 0 100px rgba(159,122,30,.22);
}
html[data-theme="light"] .fab-edge-bar{
  background:linear-gradient(180deg,transparent,rgba(159,122,30,.82) 38%,rgba(200,158,40,.98) 50%,rgba(159,122,30,.82) 62%,transparent);
}
html[data-theme="light"] .fab-icon-ring{
  background:linear-gradient(145deg,rgba(159,122,30,.22),rgba(159,122,30,.07));
  border-color:rgba(159,122,30,.4);color:#9f7a1e;
  box-shadow:0 2px 12px rgba(0,0,0,.1),inset 0 1px 0 rgba(255,255,255,.72);
}
html[data-theme="light"] .fab-icon-ring::after{
  border-top-color:rgba(159,122,30,.72);border-right-color:rgba(159,122,30,.3);
}
html[data-theme="light"] .fab-label{color:#1a0e06;}
html[data-theme="light"] .fab-sub{color:rgba(100,72,20,.7);}
html[data-theme="light"] .fab-chevron{color:rgba(100,72,20,.46);}
html[data-theme="light"] #ps-trade-launch-btn.open:hover .fab-chevron{color:rgba(100,72,20,.9);}

.ps-empty{text-align:center;padding:40px 20px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#5a6880;line-height:2}
.ps-insuf{padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#ef4444;display:none}
@keyframes ps-spin{to{transform:rotate(360deg)}}
.ps-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:ps-spin .6s linear infinite;display:none}
`;
    document.head.appendChild(s);
  }

  /* HTML */
  function injectHTML(){
    if($('ps-panel'))return;
    document.body.insertAdjacentHTML('beforeend',`
<div id="ps-backdrop"></div>

<div id="ps-panel">
  <div class="ps-hdr">
    <div>
      <p style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#edf2f8;font-weight:300">My Portfolio</p>
      <p id="ps-sub" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#5a6880;margin-top:2px">\u2014</p>
    </div>
    <button class="ps-close-x" onclick="PortfolioSync.closePanel()">\u2715</button>
  </div>
  <div style="margin:14px 22px 0;padding:14px 18px;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.18);border-radius:14px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#c9a84c;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Available Cash</p>
      <p id="ps-cash-display" style="font-family:'Cormorant Garamond',serif;font-size:26px;color:#edf2f8;font-weight:300">$0.00</p>
    </div>
    <div style="text-align:right">
      <p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Net Worth</p>
      <p id="ps-networth-display" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#edf2f8">$0.00</p>
    </div>
  </div>
  <div class="ps-stats">
    <div class="ps-stat-box"><div class="ps-stat-v" id="ps-sv-port">$0</div><div class="ps-stat-l">Holdings</div></div>
    <div class="ps-stat-box"><div class="ps-stat-v" id="ps-sv-pnl" style="color:#22c55e">$0</div><div class="ps-stat-l">P&amp;L</div></div>
    <div class="ps-stat-box"><div class="ps-stat-v" id="ps-sv-open">0</div><div class="ps-stat-l">Open Trades</div></div>
  </div>
  <div class="ps-tabs">
    <button class="ps-tab on" id="ps-tab-h" onclick="PortfolioSync.switchTab('holdings')">Holdings</button>
    <button class="ps-tab" id="ps-tab-t" onclick="PortfolioSync.switchTab('trades')">Open Trades<span id="ps-trades-badge">0</span></button>
  </div>
  <div class="ps-body" id="ps-body"></div>
</div>

<div id="ps-cfd">
  <div class="ps-hdr" style="margin-bottom:0">
    <div style="display:flex;align-items:center;gap:12px">
      <div id="cfd-icon" style="width:44px;height:44px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:20px"></div>
      <div>
        <p id="cfd-sym-lbl" style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#edf2f8;font-weight:300">\u2014</p>
        <p id="cfd-price-lbl" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#5a6880">Market Price</p>
      </div>
    </div>
    <button class="ps-close-x" onclick="PortfolioSync.closeCfd()">\u2715</button>
  </div>
  <div class="cfd-sec" style="margin-top:18px">
    <div class="cfd-lbl">Direction</div>
    <div class="cfd-dir-grid">
      <button class="cfd-dir-btn lon" id="cfd-long-btn" onclick="PortfolioSync.setCfdDir('long')">\u25b2 LONG</button>
      <button class="cfd-dir-btn" id="cfd-short-btn" onclick="PortfolioSync.setCfdDir('short')">\u25bc SHORT</button>
    </div>
  </div>
  <div class="cfd-sec">
    <div class="cfd-lbl">Lot Size &nbsp;<span id="cfd-lot-note" style="color:#c9a84c"></span></div>
    <div class="lot-wrap" id="cfd-lot-grid"></div>
    <div style="margin-top:10px"><input class="cfd-inp" id="cfd-custom-lot" type="number" step="0.01" min="0.01" placeholder="Custom lots\u2026" oninput="PortfolioSync.setCfdLots(parseFloat(this.value)||0.01)"></div>
  </div>
  <div class="cfd-sec">
    <div class="cfd-lbl">Order Preview</div>
    <div class="cfd-stat-grid">
      <div class="cfd-stat"><div class="v" id="cfd-pv-price">\u2014</div><div class="l">Entry Price</div></div>
      <div class="cfd-stat"><div class="v" id="cfd-pv-notional">\u2014</div><div class="l">Notional</div></div>
      <div class="cfd-stat"><div class="v" id="cfd-pv-margin">\u2014</div><div class="l">Margin (10%)</div></div>
      <div class="cfd-stat"><div class="v" id="cfd-pv-pip">\u2014</div><div class="l">P&amp;L per 1%</div></div>
    </div>
  </div>
  <div class="cfd-sec">
    <div class="cfd-lbl">Risk Management (optional)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#22c55e;margin-bottom:5px">Take Profit $</div><input class="cfd-inp" id="cfd-tp" type="number" placeholder="e.g. 70000" oninput="PortfolioSync.updateCfdPreview()"></div>
      <div><div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#ef4444;margin-bottom:5px">Stop Loss $</div><input class="cfd-inp" id="cfd-sl" type="number" placeholder="e.g. 60000" oninput="PortfolioSync.updateCfdPreview()"></div>
    </div>
  </div>
  <div class="ps-insuf" id="cfd-insuf" style="margin:0 20px 12px"><i class="fas fa-triangle-exclamation" style="margin-right:6px"></i>Insufficient balance for margin</div>
  <button class="cfd-ok-btn lon" id="cfd-ok-btn" onclick="PortfolioSync.confirmCfd()">
    <span id="cfd-ok-lbl"><i class="fas fa-bolt" style="font-size:12px;margin-right:4px"></i>Open Long \u25b2</span>
    <div class="ps-spin" id="cfd-spin"></div>
  </button>
</div>

<div id="ps-bs">
  <div id="ps-bs-box">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 22px 14px;border-bottom:1px solid rgba(255,255,255,.07)">
      <div style="display:flex;align-items:center;gap:14px">
        <div id="bs-icon" style="width:46px;height:46px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:20px"></div>
        <div>
          <p id="bs-sym" style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#edf2f8;font-weight:300">\u2014</p>
          <p id="bs-name-sub" style="color:#5a6880;font-size:12px">\u2014</p>
        </div>
      </div>
      <button class="ps-close-x" onclick="PortfolioSync.closeBs()">\u2715</button>
    </div>
    <div style="display:flex;gap:6px;padding:14px 22px 0">
      <button id="bs-tab-buy" onclick="PortfolioSync.setBsType('buy')" style="flex:1;padding:10px;border-radius:12px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;background:rgba(34,197,94,.15);color:#22c55e;transition:all .2s">BUY</button>
      <button id="bs-tab-sell" onclick="PortfolioSync.setBsType('sell')" style="flex:1;padding:10px;border-radius:12px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;background:rgba(255,255,255,.04);color:#5a6880;transition:all .2s">SELL</button>
    </div>
    <div style="padding:16px 22px;display:flex;flex-direction:column;gap:13px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px">
        <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880;text-transform:uppercase">Live Price</span>
        <div style="text-align:right">
          <p id="bs-live-price" style="font-family:'JetBrains Mono',monospace;font-size:18px;color:#edf2f8;font-weight:600">\u2014</p>
          <p id="bs-bal-line" style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#5a6880;margin-top:2px">Balance: \u2014</p>
        </div>
      </div>
      <div id="bs-hold-info" style="display:none;padding:10px 14px;background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.18);border-radius:12px">
        <p id="bs-hold-detail" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#c9a84c">\u2014</p>
      </div>
      <div>
        <label style="font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;color:#5a6880;text-transform:uppercase;display:block;margin-bottom:7px">Amount (USD)</label>
        <div class="bs-inp-wrap">
          <span style="padding:0 14px;color:#5a6880;font-family:'JetBrains Mono',monospace;border-right:1px solid rgba(255,255,255,.06);align-self:stretch;display:flex;align-items:center">$</span>
          <input type="number" id="bs-amt" value="100" min="10" step="10" class="bs-inp" oninput="PortfolioSync.updateBsCalc()">
        </div>
        <div style="display:flex;gap:6px;margin-top:7px">
          <button class="bs-preset" onclick="PortfolioSync.setBsAmt(100)">$100</button>
          <button class="bs-preset" onclick="PortfolioSync.setBsAmt(500)">$500</button>
          <button class="bs-preset" onclick="PortfolioSync.setBsAmt(1000)">$1K</button>
          <button class="bs-preset" onclick="PortfolioSync.setBsAmt(5000)">$5K</button>
        </div>
      </div>
      <div style="background:rgba(4,6,8,.7);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px"><span style="color:#5a6880">You invest</span><span id="bs-o-invest" style="font-family:'JetBrains Mono',monospace;color:#edf2f8">\u2014</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px"><span style="color:#5a6880">You receive</span><span id="bs-o-receive" style="font-family:'JetBrains Mono',monospace;color:#c9a84c">\u2014</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px"><span style="color:#5a6880">Fee (0.1%)</span><span id="bs-o-fee" style="font-family:'JetBrains Mono',monospace;color:#5a6880">\u2014</span></div>
        <div style="height:1px;background:rgba(255,255,255,.05);margin-bottom:7px"></div>
        <div style="display:flex;justify-content:space-between"><span style="color:#5a6880;font-size:13px">Total</span><span id="bs-o-total" style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:#edf2f8">\u2014</span></div>
      </div>
      <div class="ps-insuf" id="bs-insuf"><i class="fas fa-triangle-exclamation" style="margin-right:6px"></i>Insufficient balance</div>
      <button class="bs-ok-btn" id="bs-ok-btn" onclick="PortfolioSync.confirmBs()" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff">
        <span id="bs-ok-lbl"><i class="fas fa-bolt" style="font-size:12px;margin-right:4px"></i>Confirm Buy</span>
        <div class="ps-spin" id="bs-spin"></div>
      </button>
    </div>
  </div>
</div>

<!-- ULTRA-PREMIUM TRADE FAB — v8 FLOATING ISLAND -->
<div id="ps-fab-wrapper">
  <a id="ps-trade-launch-btn" href="trade.html">
    <div class="fab-edge-bar"></div>
    <div class="fab-icon-ring"><i class="fas fa-chart-line"></i></div>
    <div class="fab-text-block">
      <span class="fab-label">Trade Now</span>
      <span class="fab-sub">Live Markets</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:14px;">
      <div class="fab-live-dot"></div>
      <i class="fas fa-chevron-right fab-chevron"></i>
    </div>
  </a>
  <div id="ps-fab-trigger" onclick="PortfolioSync.toggleFab()" title="Open trade launcher">
    <div class="fab-bar"></div>
    <div class="fab-bar"></div>
    <div class="fab-bar"></div>
    <div class="fab-orbit-ring"></div>
  </div>
</div>
`);

    $('ps-backdrop').addEventListener('click',()=>{if(_cfdOpen)closeCfd();else closePanel();});
    $('ps-bs').addEventListener('click',e=>{if(e.target===$('ps-bs'))closeBs();});
    _initFabMagnet();
  }

  function _initFabMagnet(){
    const btn=$('ps-trade-launch-btn');
    if(!btn)return;
    btn.addEventListener('mousemove',e=>{
      if(!_fabOpen)return;
      const r=btn.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-0.5;
      const y=(e.clientY-r.top)/r.height-0.5;
      btn.style.transform=`translateX(0) scale(1) perspective(700px) rotateY(${x*6}deg) rotateX(${-y*4}deg) translateY(-3px)`;
    });
    btn.addEventListener('mouseleave',()=>{btn.style.transform='';});
  }

  function _emitSparks(){
    const wrapper=$('ps-fab-wrapper');
    const trigger=$('ps-fab-trigger');
    if(!wrapper||!trigger)return;
    const wr=wrapper.getBoundingClientRect();
    const tr=trigger.getBoundingClientRect();
    const cx=tr.left+tr.width/2-wr.left;
    const cy=tr.top+tr.height/2-wr.top;
    for(let i=0;i<12;i++){
      const sp=document.createElement('div');
      sp.className='fab-spark';
      const angle=Math.random()*Math.PI*2;
      const dist=36+Math.random()*52;
      sp.style.cssText=`left:${cx}px;top:${cy}px;position:absolute;`+
        `--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;`+
        `--dur:${0.45+Math.random()*0.45}s;`+
        `background:${Math.random()>.5?'#c9a84c':'#e8dfc8'};`+
        `width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;`+
        `animation-delay:${Math.random()*0.14}s;`;
      wrapper.appendChild(sp);
      setTimeout(()=>sp.remove(),950);
    }
  }

  function injectTopbarButton(){
    if(!IS_TRADE_PAGE)return;
    const tryInject=()=>{
      const topbar=$('topbar');if(!topbar){setTimeout(tryInject,100);return;}
      if($('ps-topbar-btn'))return;
      const btn=document.createElement('button');
      btn.id='ps-topbar-btn';
      btn.innerHTML='<i class="fas fa-briefcase" style="font-size:11px"></i> Portfolio <span id="ps-trades-badge" style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 6px;font-size:9px;display:none">0</span>';
      btn.onclick=()=>openPanel();
      const spacer=topbar.querySelector('.tb-spacer');
      if(spacer)topbar.insertBefore(btn,spacer);else topbar.appendChild(btn);
    };
    tryInject();
  }

  function showFabs(){
    if(IS_TRADE_PAGE)return;
    const w=$('ps-fab-wrapper');if(w)w.style.display='flex';
  }

  function toggleFab(){
    _fabOpen=!_fabOpen;
    const btn=$('ps-trade-launch-btn'),trigger=$('ps-fab-trigger');
    if(btn)btn.classList.toggle('open',_fabOpen);
    if(trigger){trigger.classList.toggle('open',_fabOpen);trigger.title=_fabOpen?'Close':'Open trade launcher';}
    if(_fabOpen)_emitSparks();
  }

  function openPanel(){
    refreshAll().then(()=>{
      renderPanel();
      $('ps-panel').classList.add('open');
      $('ps-backdrop').classList.add('open');
      _panelOpen=true;startPnlTicker();
    });
  }
  function closePanel(){
    $('ps-panel').classList.remove('open');
    if(!_cfdOpen)$('ps-backdrop').classList.remove('open');
    _panelOpen=false;stopPnlTicker();
  }
  function switchTab(tab){
    _portfolioTab=tab;
    $('ps-tab-h').classList.toggle('on',tab==='holdings');
    $('ps-tab-t').classList.toggle('on',tab==='trades');
    renderPanel();
  }

  function _refreshPanelStats(){
    const cash=+(_profile?.cash||0);
    let portVal=0,pnl=0;
    _holdings.forEach(h=>{const cur=livePrice(h.symbol)||+h.avg_buy_price;const val=+h.quantity*cur;const cost=+h.quantity*+h.avg_buy_price;portVal+=val;pnl+=(h.pnl_override!=null)?+h.pnl_override:val-cost;});
    let tradePnl=0;_openTrades.forEach(t=>{tradePnl+=calcPnl(t);});
    const totalPnl=pnl+tradePnl,netWorth=cash+portVal;
    txt('ps-cash-display','$'+fmt(cash));txt('ps-networth-display','$'+fmt(netWorth));
    txt('ps-sv-port','$'+fmt(portVal));txt('ps-sv-open',_openTrades.length);
    txt('ps-sub',_holdings.length+' holdings \u00b7 '+_openTrades.length+' open trades');
    const pnlEl=$('ps-sv-pnl');
    if(pnlEl){pnlEl.textContent=(totalPnl>=0?'+':'')+'$'+fmt(Math.abs(totalPnl));pnlEl.style.color=totalPnl>=0?GREEN:RED;}
    const badge=$('ps-trades-badge');
    if(badge){badge.textContent=_openTrades.length;badge.style.display=_openTrades.length?'inline':'none';}
  }

  function renderPanel(){_refreshPanelStats();if(_portfolioTab==='holdings')renderHoldings();else renderTrades();}

  function renderHoldings(){
    const body=$('ps-body');if(!body)return;
    if(!_holdings.length){body.innerHTML=`<div class="ps-empty">No holdings yet.<br><a href="invest.html" style="color:#c9a84c;text-decoration:none">Browse assets \u2192</a></div>`;return;}
    const groups={crypto:[],stocks:[],property:[]};
    _holdings.forEach(h=>{const cat=(ASSET_REGISTRY[h.symbol]?.cat)||'crypto';groups[cat].push(h);});
    const catColors={crypto:'#f7931a',stocks:'#4285f4',property:'#c9a84c'};
    const catNames={crypto:'Crypto',stocks:'Stocks',property:'Real Estate'};
    let html='';
    for(const[cat,list]of Object.entries(groups)){
      if(!list.length)continue;
      html+=`<div class="ps-cat-label" style="color:${catColors[cat]}">${catNames[cat]}</div>`;
      for(const h of list){
        const meta=ASSET_REGISTRY[h.symbol]||{icon:'fas fa-circle',color:'#5a6880'};
        const cur=livePrice(h.symbol)||+h.avg_buy_price;
        const val=+h.quantity*cur,cost=+h.quantity*+h.avg_buy_price;
        const holdPnl=(h.pnl_override!=null)?+h.pnl_override:val-cost;
        const chgPct=cost>0?(holdPnl/cost*100):0,up=chgPct>=0;
        const qty=+h.quantity,qStr=qty<1?qty.toFixed(6):qty.toFixed(4);
        html+=`<div class="ps-hrow">
          <div style="width:38px;height:38px;border-radius:12px;background:${meta.color}18;color:${meta.color};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0"><i class="${meta.icon}"></i></div>
          <div style="flex:1;min-width:0"><p style="font-weight:600;color:#edf2f8;font-size:13px">${h.symbol}</p><p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880">${qStr} \u00b7 $${fmtP(cur)}</p></div>
          <div style="text-align:right;margin-right:8px"><p style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#edf2f8">$${fmt(val)}</p><p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${up?GREEN:RED}">${up?'+':''}${chgPct.toFixed(2)}%</p></div>
          <div class="ps-hrow-btns">
            <button class="ps-ab buy" onclick="PortfolioSync.openBs('${h.symbol}','buy')">+Buy</button>
            <button class="ps-ab sell" onclick="PortfolioSync.openBs('${h.symbol}','sell')">Sell</button>
            <button class="ps-ab cfd" onclick="PortfolioSync.openCfd('${h.symbol}')">CFD</button>
          </div>
        </div>`;
      }
    }
    body.innerHTML=html;
  }

  function renderTrades(){
    const body=$('ps-body');if(!body)return;
    if(!_openTrades.length){body.innerHTML=`<div class="ps-empty">No open CFD positions.<br><span style="color:#c9a84c;cursor:pointer" onclick="PortfolioSync.openCfd(null)">Open a trade \u2192</span></div>`;return;}
    body.innerHTML=_openTrades.map(t=>{
      const meta=ASSET_REGISTRY[t.sym]||{icon:'fas fa-circle',color:'#5a6880'};
      const pnl=calcPnl(t),dir=t.direction||t.dir,up=pnl>=0;
      const lots=+t.lots,entry=+(t.entry_price||t.entry),cur=livePrice(t.sym),pct=calcPnlPct(t);
      return`<div class="ps-trow ${dir}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:34px;height:34px;border-radius:11px;background:${meta.color}18;color:${meta.color};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0"><i class="${meta.icon}"></i></div>
          <div style="flex:1"><p style="font-size:13px;font-weight:600;color:#edf2f8">${t.sym}<span style="font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 8px;border-radius:6px;background:${dir==='long'?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)'};color:${dir==='long'?GREEN:RED};margin-left:4px">${dir.toUpperCase()}</span></p><p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880">${lots} lot${lots!==1?'s':''} \u00b7 Entry $${fmtP(entry)}</p></div>
          <div style="text-align:right"><p class="ps-pnl ${up?'g':'r'}" id="tpnl-${t.id}">${up?'+':''}$${fmt(Math.abs(pnl))}</p><p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:${up?GREEN:RED}">${up?'+':''}${pct.toFixed(2)}%</p></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#5a6880">Now:<span style="color:#edf2f8">$${fmtP(cur)}</span>${t.take_profit?' \u00b7 TP $<span style="color:'+GREEN+'">'+fmtP(+t.take_profit)+'</span>':''}${t.stop_loss?' \u00b7 SL $<span style="color:'+RED+'">'+fmtP(+t.stop_loss)+'</span>':''}</span>
          <button class="ps-close-trade" onclick="PortfolioSync.closeTrade('${t.id}')">Close</button>
        </div>
      </div>`;
    }).join('');
  }

  function calcPnl(trade){
    const cur=livePrice(trade.sym),entry=+(trade.entry_price||trade.entry),lots=+trade.lots;
    const cat=ASSET_REGISTRY[trade.sym]?.cat||'crypto',notional=lots*(LOT_VALUE[cat]||1000);
    const pct=entry>0?(cur-entry)/entry:0,raw=notional*pct,dir=trade.direction||trade.dir;
    return dir==='long'?raw:-raw;
  }
  function calcPnlPct(trade){
    const lots=+trade.lots,cat=ASSET_REGISTRY[trade.sym]?.cat||'crypto';
    const notional=lots*(LOT_VALUE[cat]||1000),pnl=calcPnl(trade);
    return notional>0?(pnl/notional*100):0;
  }

  function openCfd(sym){
    if(!sym)sym=_holdings.length?_holdings[0].symbol:'BTC';
    _cfdSym=sym;
    const meta=ASSET_REGISTRY[sym]||{icon:'fas fa-circle',color:'#c9a84c',cat:'crypto'};
    const iconEl=$('cfd-icon');
    iconEl.innerHTML=`<i class="${meta.icon}"></i>`;
    iconEl.style.cssText=`width:44px;height:44px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${meta.color}18;color:${meta.color}`;
    txt('cfd-sym-lbl',sym+(meta.name?' \u2014 '+meta.name:''));
    const grid=$('cfd-lot-grid');
    if(grid)grid.innerHTML=LOT_STEPS.map(v=>`<button class="lot-chip${_cfdLots===v?' on':''}" onclick="PortfolioSync.setCfdLots(${v})">${v}</button>`).join('');
    setCfdDir(_cfdDir);updateCfdPreview();
    $('ps-cfd').classList.add('open');$('ps-backdrop').classList.add('open');_cfdOpen=true;
  }
  function closeCfd(){$('ps-cfd').classList.remove('open');if(!_panelOpen)$('ps-backdrop').classList.remove('open');_cfdOpen=false;}

  function setCfdDir(dir){
    _cfdDir=dir;
    $('cfd-long-btn').className='cfd-dir-btn'+(dir==='long'?' lon':'');
    $('cfd-short-btn').className='cfd-dir-btn'+(dir==='short'?' sho':'');
    const btn=$('cfd-ok-btn'),lbl=$('cfd-ok-lbl');
    if(btn)btn.className='cfd-ok-btn '+(dir==='long'?'lon':'sho');
    if(lbl)lbl.innerHTML=`<i class="fas fa-bolt" style="font-size:12px;margin-right:4px"></i>Open ${dir==='long'?'Long \u25b2':'Short \u25bc'}`;
    updateCfdPreview();
  }
  function setCfdLots(v){
    _cfdLots=Math.max(0.01,v);
    const inp=$('cfd-custom-lot');if(inp&&+inp.value!==_cfdLots)inp.value=_cfdLots;
    document.querySelectorAll('.lot-chip').forEach(c=>c.classList.toggle('on',+c.textContent===_cfdLots));
    updateCfdPreview();
  }
  function updateCfdPreview(){
    if(!_cfdSym)return;
    const cat=ASSET_REGISTRY[_cfdSym]?.cat||'crypto',lotVal=LOT_VALUE[cat]||1000;
    const price=livePrice(_cfdSym),notional=_cfdLots*lotVal,margin=notional*0.1,pip=notional*0.01;
    const cash=+(_profile?.cash||0);
    txt('cfd-price-lbl','$'+fmtP(price));txt('cfd-pv-price','$'+fmtP(price));
    txt('cfd-pv-notional','$'+fmt(notional));txt('cfd-pv-margin','$'+fmt(margin));
    txt('cfd-pv-pip','$'+fmt(pip));txt('cfd-lot-note','\u2248 $'+fmt(notional)+' notional');
    const insuf=margin>cash,insufEl=$('cfd-insuf'),okBtn=$('cfd-ok-btn');
    if(insufEl)insufEl.style.display=insuf?'block':'none';
    if(okBtn){okBtn.disabled=insuf;okBtn.style.opacity=insuf?'.45':'1';}
  }

  async function confirmCfd(){
    if(!_cfdSym||!_uid||!_profile)return;
    const cat=ASSET_REGISTRY[_cfdSym]?.cat||'crypto',meta=ASSET_REGISTRY[_cfdSym]||{icon:'fas fa-circle',color:'#c9a84c'};
    const lotVal=LOT_VALUE[cat]||1000,price=livePrice(_cfdSym),notional=_cfdLots*lotVal,margin=notional*0.1;
    const cash=+(_profile?.cash||0);
    if(margin>cash){psToast('Insufficient margin','Need $'+fmt(margin),'error');return;}
    const tp=parseFloat($('cfd-tp')?.value)||null,sl=parseFloat($('cfd-sl')?.value)||null;
    const lbl=$('cfd-ok-lbl'),spin=$('cfd-spin'),btn=$('cfd-ok-btn');
    if(lbl)lbl.style.display='none';if(spin)spin.style.display='flex';if(btn)btn.disabled=true;
    try{
      const newCash=+(cash-margin).toFixed(2);
      await _sb.from('profiles').update({cash:newCash}).eq('id',_uid);
      await _sb.from('transactions').insert({user_id:_uid,type:'buy',symbol:_cfdSym,name:(meta.name||_cfdSym)+' CFD '+_cfdDir.toUpperCase(),icon:meta.icon,color:meta.color,quantity:_cfdLots,price_at_tx:price,usd_amount:-margin,status:'approved',note:`CFD ${_cfdDir.toUpperCase()} \u00b7 ${_cfdLots} lot${_cfdLots!==1?'s':''} \u00b7 Notional $${fmt(notional)} \u00b7 Margin $${fmt(margin)}`});
      let tradeId='local_'+Date.now();
      try{const{data}=await _sb.from('open_trades').insert({user_id:_uid,sym:_cfdSym,direction:_cfdDir,lots:_cfdLots,entry_price:price,take_profit:tp,stop_loss:sl,notional,status:'open'}).select().single();if(data)tradeId=data.id;}catch(e){}
      _openTrades.unshift({id:tradeId,sym:_cfdSym,direction:_cfdDir,dir:_cfdDir,lots:_cfdLots,entry_price:price,entry:price,take_profit:tp,stop_loss:sl,notional,margin,opened_at:new Date().toISOString()});
      _profile.cash=newCash;_refreshPanelStats();
      if(window.loadProfile)window.loadProfile();if(window.loadTransactions)window.loadTransactions();
      closeCfd();openPanel();switchTab('trades');
      psToast(`${_cfdDir==='long'?'\u25b2 Long':'\u25bc Short'} Opened`,`${_cfdLots} lot${_cfdLots!==1?'s':''} ${_cfdSym} @ $${fmtP(price)} \u00b7 Margin: $${fmt(margin)}`,'success');
    }catch(err){psToast('Trade failed',err.message,'error');}
    finally{if(lbl){lbl.style.display='flex';lbl.innerHTML=`<i class="fas fa-bolt" style="font-size:12px;margin-right:4px"></i>Open ${_cfdDir==='long'?'Long \u25b2':'Short \u25bc'}`;}if(spin)spin.style.display='none';if(btn){btn.disabled=false;updateCfdPreview();}}
  }

  async function closeTrade(id){
    const idx=_openTrades.findIndex(t=>String(t.id)===String(id));if(idx===-1)return;
    const t=_openTrades[idx],pnl=calcPnl(t),margin=+(t.margin||t.notional*0.1);
    const cur=livePrice(t.sym),meta=ASSET_REGISTRY[t.sym]||{},dir=t.direction||t.dir;
    if(!confirm(`Close ${dir.toUpperCase()} ${t.sym}?\nP&L: ${pnl>=0?'+':''}$${fmt(pnl)}`))return;
    try{
      const cash=+(_profile?.cash||0),newCash=+(cash+margin+pnl).toFixed(2);
      await _sb.from('profiles').update({cash:newCash}).eq('id',_uid);
      await _sb.from('transactions').insert({user_id:_uid,type:'sell',symbol:t.sym,name:(meta.name||t.sym)+' CFD Close',icon:meta.icon||'fas fa-circle',color:meta.color||'#c9a84c',quantity:+t.lots,price_at_tx:cur,usd_amount:+(margin+pnl).toFixed(2),status:'approved',note:`CFD CLOSE \u00b7 P&L ${pnl>=0?'+':''}$${fmt(pnl)} \u00b7 Returned $${fmt(margin+pnl)}`});
      try{await _sb.from('open_trades').update({status:'closed',close_price:cur,closed_at:new Date().toISOString()}).eq('id',t.id);}catch(e){}
      _openTrades.splice(idx,1);_profile.cash=newCash;_refreshPanelStats();
      if(window.loadProfile)window.loadProfile();if(window.loadTransactions)window.loadTransactions();
      psToast('Position Closed',`P&L: ${pnl>=0?'+':''}$${fmt(pnl)}`,pnl>=0?'success':'error');renderPanel();
    }catch(err){psToast('Close failed',err.message,'error');}
  }

  function openBs(sym,type){
    _bsSym=sym;_bsType=type||'buy';
    const meta=ASSET_REGISTRY[sym]||{icon:'fas fa-circle',color:'#c9a84c',name:sym};
    const iconEl=$('bs-icon');
    iconEl.innerHTML=`<i class="${meta.icon}"></i>`;
    iconEl.style.cssText=`width:46px;height:46px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${meta.color}18;color:${meta.color}`;
    txt('bs-sym',sym);txt('bs-name-sub',meta.name||sym);
    $('bs-amt').value=100;setBsType(_bsType);$('ps-bs').classList.add('open');
  }
  function closeBs(){$('ps-bs').classList.remove('open');}

  function setBsType(type){
    _bsType=type;
    const bt=$('bs-tab-buy'),st=$('bs-tab-sell'),btn=$('bs-ok-btn'),lbl=$('bs-ok-lbl');
    if(type==='buy'){
      bt.style.cssText="flex:1;padding:10px;border-radius:12px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;background:rgba(34,197,94,.15);color:#22c55e;transition:all .2s";
      st.style.cssText="flex:1;padding:10px;border-radius:12px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;background:rgba(255,255,255,.04);color:#5a6880;transition:all .2s";
      if(btn)btn.style.background='linear-gradient(135deg,#22c55e,#16a34a)';
      if(lbl)lbl.innerHTML='<i class="fas fa-bolt" style="font-size:12px;margin-right:4px"></i>Confirm Buy';
      $('bs-hold-info').style.display='none';
    }else{
      st.style.cssText="flex:1;padding:10px;border-radius:12px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;background:rgba(239,68,68,.15);color:#ef4444;transition:all .2s";
      bt.style.cssText="flex:1;padding:10px;border-radius:12px;border:none;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;background:rgba(255,255,255,.04);color:#5a6880;transition:all .2s";
      if(btn)btn.style.background='linear-gradient(135deg,#ef4444,#dc2626)';
      if(lbl)lbl.innerHTML='<i class="fas fa-arrow-trend-down" style="font-size:12px;margin-right:4px"></i>Confirm Sell';
      const h=_holdings.find(x=>x.symbol===_bsSym),infoEl=$('bs-hold-info');
      if(h){const cur=livePrice(_bsSym)||+h.avg_buy_price;infoEl.style.display='block';txt('bs-hold-detail',`${(+h.quantity).toFixed(6)} ${_bsSym} \u00b7 \u2248 $${fmt(+h.quantity*cur)}`);}
      else{infoEl.style.display='block';txt('bs-hold-detail',`No ${_bsSym} holdings`);}
    }
    updateBsCalc();
  }

  function setBsAmt(v){$('bs-amt').value=v;updateBsCalc();}
  function updateBsCalc(){
    if(!_bsSym)return;
    const amt=parseFloat($('bs-amt')?.value)||0,fee=+(amt*0.001).toFixed(2),total=+(amt+fee).toFixed(2);
    const price=livePrice(_bsSym)||1,qty=amt/price,cash=+(_profile?.cash||0);
    txt('bs-o-invest','$'+fmt(amt));txt('bs-o-fee','$'+fmt(fee));txt('bs-o-total','$'+fmt(total));
    txt('bs-live-price','$'+fmtP(price));txt('bs-bal-line','Balance: $'+fmt(cash));
    txt('bs-o-receive',_bsType==='buy'?(qty<1?qty.toFixed(6):qty.toFixed(4))+' '+_bsSym:'$'+fmt(amt-fee)+' USD');
    const insuf=_bsType==='buy'?(total>cash||amt<10):(()=>{const h=_holdings.find(x=>x.symbol===_bsSym);return!h||(amt/price)>+h.quantity||amt<10;})();
    const insufEl=$('bs-insuf'),okBtn=$('bs-ok-btn');
    if(insufEl)insufEl.style.display=insuf?'flex':'none';
    if(okBtn){okBtn.disabled=insuf;okBtn.style.opacity=insuf?'.45':'1';}
  }

  async function confirmBs(){
    if(!_bsSym||!_uid||!_profile)return;
    const amt=parseFloat($('bs-amt')?.value)||0,fee=+(amt*0.001).toFixed(2),total=+(amt+fee).toFixed(2);
    const price=livePrice(_bsSym)||1,qty=amt/price,cash=+(_profile?.cash||0);
    const meta=ASSET_REGISTRY[_bsSym]||{icon:'fas fa-circle',color:'#c9a84c',name:_bsSym};
    const isBuy=_bsType==='buy';
    if(isBuy&&total>cash){psToast('Insufficient balance','','error');return;}
    if(amt<10){psToast('Minimum $10','','error');return;}
    const lbl=$('bs-ok-lbl'),spin=$('bs-spin'),btn=$('bs-ok-btn');
    if(lbl)lbl.style.display='none';if(spin)spin.style.display='flex';if(btn)btn.disabled=true;
    try{
      if(isBuy){
        await _sb.from('transactions').insert({user_id:_uid,type:'buy',symbol:_bsSym,name:meta.name||_bsSym,icon:meta.icon,color:meta.color,quantity:qty,price_at_tx:price,usd_amount:-total,status:'approved',note:`Buy ${_bsSym} @ $${fmtP(price)} | Fee $${fee.toFixed(2)}`});
        const ex=_holdings.find(h=>h.symbol===_bsSym);
        if(ex){const nq=+ex.quantity+qty,na=(+ex.avg_buy_price*+ex.quantity+price*qty)/nq;await _sb.from('holdings').update({quantity:nq,avg_buy_price:+na.toFixed(6)}).eq('id',ex.id);ex.quantity=nq;ex.avg_buy_price=+na.toFixed(6);}
        else{const{data}=await _sb.from('holdings').insert({user_id:_uid,symbol:_bsSym,name:meta.name||_bsSym,icon:meta.icon,color:meta.color,quantity:qty,avg_buy_price:price}).select().single();if(data)_holdings.push(data);}
        const newCash=+(cash-total).toFixed(2);await _sb.from('profiles').update({cash:newCash}).eq('id',_uid);_profile.cash=newCash;
      }else{
        const h=_holdings.find(x=>x.symbol===_bsSym);if(!h)throw new Error('No holding found');
        const netUSD=amt-fee;
        await _sb.from('transactions').insert({user_id:_uid,type:'sell',symbol:_bsSym,name:meta.name||_bsSym,icon:meta.icon,color:meta.color,quantity:qty,price_at_tx:price,usd_amount:netUSD,status:'approved',note:`Sell ${_bsSym} @ $${fmtP(price)} | Fee $${fee.toFixed(2)}`});
        const newQty=+h.quantity-qty;
        if(newQty<=0.000001){await _sb.from('holdings').delete().eq('id',h.id);_holdings=_holdings.filter(x=>x.id!==h.id);}
        else{await _sb.from('holdings').update({quantity:newQty}).eq('id',h.id);h.quantity=newQty;}
        const newCash=+(cash+netUSD).toFixed(2);await _sb.from('profiles').update({cash:newCash}).eq('id',_uid);_profile.cash=newCash;
      }
      if(window.loadProfile)window.loadProfile();if(window.loadPortfolioStats)window.loadPortfolioStats();if(window.loadTransactions)window.loadTransactions();
      closeBs();_refreshPanelStats();if(_panelOpen)renderPanel();
      psToast(isBuy?'Buy Executed \u2713':'Sell Executed \u2713',`${isBuy?(qty.toFixed(4)+' '+_bsSym):'$'+fmt(amt-fee)+' returned'}`,'success');
    }catch(err){psToast(isBuy?'Buy failed':'Sell failed',err.message,'error');}
    finally{if(lbl)lbl.style.display='flex';if(spin)spin.style.display='none';if(btn){btn.disabled=false;updateBsCalc();}}
  }

  function startPnlTicker(){
    stopPnlTicker();
    _pnlTimer=setInterval(()=>{
      if(!_panelOpen||_portfolioTab!=='trades'||!_openTrades.length)return;
      _openTrades.forEach(t=>{
        const pnl=calcPnl(t),el=$('tpnl-'+t.id);
        if(el){const up=pnl>=0;el.textContent=(up?'+':'')+'$'+fmt(Math.abs(pnl));el.className='ps-pnl '+(up?'g':'r');}
        const cur=livePrice(t.sym),dir=t.direction||t.dir,tp=+(t.take_profit||0),sl=+(t.stop_loss||0);
        if(tp&&((dir==='long'&&cur>=tp)||(dir==='short'&&cur<=tp))){psToast('TP Hit \u2014 '+t.sym,`Triggered @ $${fmtP(cur)}`,'success');closeTrade(String(t.id));}
        else if(sl&&((dir==='long'&&cur<=sl)||(dir==='short'&&cur>=sl))){psToast('SL Hit \u2014 '+t.sym,`Triggered @ $${fmtP(cur)}`,'error');closeTrade(String(t.id));}
      });
      _refreshPanelStats();
    },1200);
  }
  function stopPnlTicker(){if(_pnlTimer){clearInterval(_pnlTimer);_pnlTimer=null;}}

  function psToast(title,sub,type){
    if(window.showToast){window.showToast(title,sub,type);return;}
    let el=$('ps-toast');
    if(!el){el=document.createElement('div');el.id='ps-toast';el.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:#111820;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 20px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#edf2f8;min-width:240px;text-align:center;transition:opacity .3s;pointer-events:none";document.body.appendChild(el);}
    const c=type==='success'?GREEN:type==='error'?RED:GOLD;
    el.style.borderColor=c+'44';
    el.innerHTML=`<strong style="color:${c}">${title}</strong>${sub?'<br><span style="color:#5a6880;font-size:10px">'+sub+'</span>':''}`;
    el.style.opacity='1';clearTimeout(el._t);
    el._t=setTimeout(()=>{el.style.opacity='0';},3800);
  }

  window.PortfolioSync={
    openPanel,closePanel,switchTab,
    openCfd,closeCfd,setCfdDir,setCfdLots,updateCfdPreview,confirmCfd,
    closeTrade,
    openBs,closeBs,setBsType,setBsAmt,updateBsCalc,confirmBs,
    toggleFab,
  };

  function init(){
    injectCSS();injectHTML();injectTopbarButton();showFabs();waitForSupabase(boot);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
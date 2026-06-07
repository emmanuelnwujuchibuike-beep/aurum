/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   AURUM LIVE SUPPORT WIDGET  ·  Ultra-Premium Edition
 *   <script src="chat-widget.js"></script>
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
const AURUM_CHAT_CONFIG = {
  supabaseUrl:    "https://ttwwthfeordsojmcjwxn.supabase.co",
  supabaseKey:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w",
  brandName:      "Aurum Capital",
  brandSubtitle:  "Private Client Services",
  accentColor:    "#C9A84C",
  agentName:      "Support Team",
  agentAvatar:    "https://api.dicebear.com/7.x/initials/svg?seed=AU&backgroundColor=c9a84c&fontColor=ffffff",
  welcomeMsg:     "Welcome to Aurum. How may we assist your investment journey today?",
  placeholder:    "Type your message…",
  adminEmail:     "aurumcapitalinvest@gmail.com",
  notifyEndpoint: null,
  storageBucket:  "chat-images",
};

(function () {
  if (document.getElementById("aurum-chat-root")) return;

  const sdkScript = document.createElement("script");
  sdkScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  sdkScript.onload = initAurumChat;
  document.head.appendChild(sdkScript);

  const fontLink = document.createElement("link");
  fontLink.rel  = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&display=swap";
  document.head.appendChild(fontLink);

  const style = document.createElement("style");
  style.textContent = `
    #aurum-chat-root *{box-sizing:border-box;margin:0;padding:0;}

    /* ═══ LIGHT MODE VARS ═══ */
    #aurum-chat-root{
      --gold:#C9A84C; --gold-hi:#E8C95A; --gold-lo:#9A7228;
      --bg:#F8F5EF; --surface:#FFFFFF; --surface2:#EFE9DC;
      --chat-bg:#EDE8DC;
      --border:rgba(160,135,75,.14); --border-md:rgba(160,135,75,.28);
      --text:#18100A; --text-2:#5A4A2E; --text-3:#9A8868; --text-4:#C0A878;
      --online:#1A9E5C;
      --user-bubble-lo:#9A7230;
      --agent-bubble:#FFFFFF;
      --win-shadow:0 0 0 1px rgba(160,135,75,.1),0 2px 6px rgba(0,0,0,.06),0 24px 72px rgba(60,40,0,.15),0 8px 22px rgba(60,40,0,.09);
      --tog-shadow:0 0 0 3px rgba(201,168,76,.22),0 14px 44px rgba(180,135,30,.55),0 4px 12px rgba(0,0,0,.3);
      font-family:'Outfit',sans-serif;
    }

    /* ═══ DARK MODE VARS ═══ */
    html[data-theme="dark"] #aurum-chat-root{
      --bg:#06101A; --surface:#0B1924; --surface2:#07111E;
      --chat-bg:#0A1520;
      --border:rgba(201,168,76,.09); --border-md:rgba(201,168,76,.2);
      --text:#E0D4B8; --text-2:#A0906A; --text-3:#64543A; --text-4:#3A2E1C;
      --user-bubble-lo:#7A5818;
      --agent-bubble:#0E2038;
      --win-shadow:0 0 0 1px rgba(201,168,76,.1),0 2px 6px rgba(0,0,0,.4),0 32px 80px rgba(0,0,0,.8),0 10px 26px rgba(0,0,0,.55);
      --tog-shadow:0 0 0 3px rgba(201,168,76,.22),0 14px 44px rgba(201,168,76,.32),0 4px 12px rgba(0,0,0,.6);
    }

    /* ═══════════════════════════════
       TOGGLE BUTTON — ULTRA PREMIUM
    ═══════════════════════════════ */
    #aurum-toggle{
      position:fixed; bottom:28px; right:28px; z-index:99998;
      width:64px; height:64px; border-radius:50%; border:none; cursor:pointer;
      background:linear-gradient(145deg,#F0D468 0%,#C9A84C 38%,#9A7230 72%,#6A4818 100%);
      box-shadow:var(--tog-shadow);
      display:flex; align-items:center; justify-content:center;
      transition:transform .4s cubic-bezier(.34,1.56,.64,1), box-shadow .3s;
      outline:none; overflow:visible;
    }
    #aurum-toggle:hover{ transform:scale(1.1) translateY(-3px); box-shadow:0 0 0 4px rgba(201,168,76,.3),0 20px 56px rgba(201,168,76,.6),0 4px 14px rgba(0,0,0,.3); }
    #aurum-toggle:active{ transform:scale(.9); }
    /* gloss */
    #aurum-toggle::before{ content:''; position:absolute; inset:0; border-radius:50%; background:linear-gradient(145deg,rgba(255,255,255,.24) 0%,transparent 55%); pointer-events:none; }

    /* ─── animated icon frame ─── */
    .aur-tog-frame{
      position:relative; width:34px; height:34px;
      display:flex; align-items:center; justify-content:center;
    }
    /* spinning arc 1 */
    .aur-arc-1{
      position:absolute; inset:-10px; border-radius:50%;
      border:1.5px solid transparent;
      border-top-color:rgba(255,240,140,.8);
      border-right-color:rgba(255,240,140,.35);
      animation:aurArcSpin 1.8s linear infinite;
      pointer-events:none;
    }
    /* spinning arc 2 — counter-rotate */
    .aur-arc-2{
      position:absolute; inset:-5px; border-radius:50%;
      border:1px solid transparent;
      border-bottom-color:rgba(255,230,100,.55);
      border-left-color:rgba(255,230,100,.22);
      animation:aurArcSpin 2.8s linear infinite reverse;
      pointer-events:none;
    }
    @keyframes aurArcSpin{ to{ transform:rotate(360deg); } }

    /* icon SVG in normal/open states */
    .aur-tog-frame{ transition:transform .3s cubic-bezier(.34,1.56,.64,1), opacity .22s; }
    #aurum-toggle.open .aur-tog-frame{ transform:scale(0) rotate(50deg); opacity:0; position:absolute; }
    #aurum-toggle:not(.open) .icon-close{ transform:scale(0) rotate(-50deg); opacity:0; position:absolute; }
    #aurum-toggle.open .icon-close{ transform:scale(1) rotate(0); opacity:1; }

    /* diamond in SVG — rotate continuously */
    .aur-d1{ transform-origin:16px 16px; animation:aurDiamRot 12s linear infinite; }
    .aur-d2{ transform-origin:16px 16px; animation:aurDiamRot 7s linear infinite reverse; }
    @keyframes aurDiamRot{ to{ transform:rotate(360deg); } }

    /* monogram "A" — draws itself, then pulses */
    .aur-letter{
      stroke-dasharray:120;
      stroke-dashoffset:120;
      animation:aurDrawLetter 2.4s cubic-bezier(.4,0,.2,1) .6s forwards, aurLetterPulse 4s ease-in-out 3s infinite;
    }
    @keyframes aurDrawLetter{ 0%{ stroke-dashoffset:120; } 100%{ stroke-dashoffset:0; } }
    @keyframes aurLetterPulse{
      0%,100%{ stroke:rgba(255,240,130,.95); filter:none; }
      50%{ stroke:#fff; filter:drop-shadow(0 0 6px rgba(255,230,100,.8)); }
    }

    /* badge */
    #aurum-badge{
      position:absolute; top:-8px; right:-8px; z-index:1;
      background:linear-gradient(135deg,#F05040,#C02820);
      color:#fff; font-size:10px; font-weight:700;
      width:22px; height:22px; border-radius:50%;
      display:none; align-items:center; justify-content:center;
      border:2.5px solid #F0D468;
      box-shadow:0 3px 10px rgba(192,40,32,.5);
      animation:aurPop .38s cubic-bezier(.34,1.56,.64,1);
      font-family:'Outfit',sans-serif;
    }
    #aurum-badge.show{ display:flex; }
    @keyframes aurPop{ from{ transform:scale(0) rotate(-20deg); } to{ transform:scale(1); } }

    /* ═══════════════════════════════
       CHAT WINDOW — NEAR FULL SCREEN
    ═══════════════════════════════ */
    #aurum-window{
      position:fixed;
      right:16px; bottom:106px;
      width:min(460px, calc(100vw - 32px));
      height:calc(100vh - 118px);
      max-height:none;
      background:var(--bg);
      border-top:2.5px solid var(--gold);
      border:1px solid var(--border);
      border-top:2.5px solid var(--gold);
      border-radius:20px 20px 20px 20px;
      box-shadow:var(--win-shadow);
      display:flex; flex-direction:column; overflow:hidden;
      opacity:0; transform:translateY(32px) scale(.92); pointer-events:none;
      transition:opacity .4s ease, transform .46s cubic-bezier(.34,1.56,.64,1);
      will-change:transform,opacity;
      z-index:99997;
    }
    #aurum-window.visible{ opacity:1; transform:translateY(0) scale(1); pointer-events:all; }

    /* ─── HEADER (always dark) ─── */
    #aurum-header{
      padding:14px 16px 12px;
      background:linear-gradient(145deg,#0C1E30 0%,#07131F 100%);
      border-bottom:1px solid rgba(201,168,76,.12);
      display:flex; align-items:center; gap:11px;
      flex-shrink:0; position:relative; overflow:hidden;
    }
    #aurum-header::before{ content:''; position:absolute; top:-40px; right:-30px; width:130px; height:130px; border-radius:50%; background:radial-gradient(circle,rgba(201,168,76,.1) 0%,transparent 70%); pointer-events:none; }
    #aurum-header::after{ content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.45),transparent); }
    #aurum-header-avatar{ width:42px; height:42px; border-radius:50%; border:1.5px solid rgba(201,168,76,.45); overflow:hidden; flex-shrink:0; background:#0A1828; box-shadow:0 0 0 3px rgba(201,168,76,.08),0 4px 14px rgba(0,0,0,.35); }
    #aurum-header-avatar img{ width:100%; height:100%; object-fit:cover; }
    #aurum-header-info{ flex:1; min-width:0; }
    #aurum-header-name{ font-family:'Cormorant Garamond',serif; font-size:17px; font-weight:500; letter-spacing:.04em; color:var(--gold); line-height:1.15; }
    #aurum-header-sub{ font-size:9px; color:rgba(180,160,120,.55); letter-spacing:.18em; text-transform:uppercase; margin-top:3px; }
    #aurum-header-right{ display:flex; align-items:center; gap:9px; }
    #aurum-status-wrap{ display:flex; align-items:center; gap:5px; }
    #aurum-status-dot{ width:7px; height:7px; border-radius:50%; background:var(--online); box-shadow:0 0 7px rgba(26,158,92,.65); animation:aurGreen 2.6s ease-in-out infinite; }
    #aurum-status-label{ font-size:11px; color:#2ECC71; font-weight:600; letter-spacing:.04em; }
    @keyframes aurGreen{ 0%,100%{ box-shadow:0 0 5px rgba(46,204,113,.5); } 50%{ box-shadow:0 0 16px rgba(46,204,113,.95),0 0 28px rgba(46,204,113,.2); } }
    #aurum-status-dot.offline{ background:#8A7A60; box-shadow:none; animation:none; }
    #aurum-status-label.offline{ color:rgba(180,160,120,.55); }
    #aurum-close-btn{ width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; outline:none; transition:background .2s,transform .2s; }
    #aurum-close-btn:hover{ background:rgba(201,168,76,.15); border-color:rgba(201,168,76,.3); transform:scale(1.1); }
    #aurum-close-btn svg{ width:11px; height:11px; color:rgba(200,185,155,.7); transition:color .2s; }
    #aurum-close-btn:hover svg{ color:var(--gold); }

    /* ═══════════════════════════════
       MESSAGES — WHATSAPP STYLE BG
    ═══════════════════════════════ */
    #aurum-messages{
      flex:1; overflow-y:auto;
      padding:14px 12px 6px;
      display:flex; flex-direction:column; gap:2px;
      scroll-behavior:smooth;
      background-color:var(--chat-bg);
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d='M40 2L78 40L40 78L2 40Z' stroke='%23C9A84C' stroke-width='.5' fill='none' opacity='.04'/%3E%3Cpath d='M40 18L62 40L40 62L18 40Z' stroke='%23C9A84C' stroke-width='.4' fill='none' opacity='.025'/%3E%3C/svg%3E");
    }
    html[data-theme="dark"] #aurum-messages{
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d='M40 2L78 40L40 78L2 40Z' stroke='%23C9A84C' stroke-width='.5' fill='none' opacity='.04'/%3E%3Cpath d='M40 18L62 40L40 62L18 40Z' stroke='%23C9A84C' stroke-width='.4' fill='none' opacity='.03'/%3E%3C/svg%3E");
    }
    #aurum-messages::-webkit-scrollbar{ width:3px; }
    #aurum-messages::-webkit-scrollbar-track{ background:transparent; }
    #aurum-messages::-webkit-scrollbar-thumb{ background:rgba(201,168,76,.15); border-radius:2px; }

    /* ─── DIVIDER ─── */
    .aurum-divider{ text-align:center; font-size:9px; color:var(--text-3); letter-spacing:.18em; text-transform:uppercase; display:flex; align-items:center; gap:10px; margin:6px 4px 10px; font-weight:500; }
    .aurum-divider::before,.aurum-divider::after{ content:''; flex:1; height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.12),transparent); }

    /* ═══════════════════════════════
       MESSAGE ROWS — WHATSAPP STYLE
    ═══════════════════════════════ */
    .aurum-msg{
      display:flex; gap:7px; align-items:flex-end;
      animation:aurMsgIn .24s cubic-bezier(.25,.46,.45,.94) both;
      padding:1px 4px;
    }
    @keyframes aurMsgIn{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
    .aurum-msg.user{ flex-direction:row-reverse; }
    .aurum-msg.grouped{ margin-top:1px; }
    .aurum-msg.grouped .aurum-msg-avatar{ visibility:hidden; }

    /* avatars */
    .aurum-msg-avatar{ width:28px; height:28px; border-radius:50%; flex-shrink:0; background:var(--surface2); border:1.5px solid var(--border-md); display:flex; align-items:center; justify-content:center; font-size:11px; color:var(--gold); font-weight:700; font-family:'Cormorant Garamond',serif; overflow:hidden; }
    .aurum-msg-avatar img{ width:100%; height:100%; object-fit:cover; }
    .aurum-msg-body{ max-width:80%; display:flex; flex-direction:column; gap:1px; }
    .aurum-msg.user .aurum-msg-body{ align-items:flex-end; }

    /* ─── BUBBLE WRAPPER (for tail positioning) ─── */
    .aurum-bubble-wrap{ position:relative; }

    /* ─── USER BUBBLE ─── */
    .aurum-msg.user .aurum-bubble{
      background:linear-gradient(145deg,#EFD060 0%,#C9A84C 45%,#9A7230 85%,#6A4818 100%);
      color:#0A0700; font-weight:500; font-size:13.5px; line-height:1.62;
      padding:9px 12px 9px 14px;
      border-radius:18px 18px 4px 18px;
      word-break:break-word;
      box-shadow:0 4px 16px rgba(201,168,76,.22),0 1px 4px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.28);
      display:flex; flex-direction:column;
    }
    /* tail — user, only on non-grouped */
    .aurum-msg.user:not(.grouped) .aurum-bubble-wrap::after{
      content:''; position:absolute;
      bottom:0; right:-6px;
      width:10px; height:14px;
      background:linear-gradient(210deg,#9A7230,#7A5218);
      clip-path:polygon(0 0,0 100%,100% 100%);
    }

    /* ─── AGENT BUBBLE (LIGHT) ─── */
    .aurum-msg.agent .aurum-bubble{
      background:#FFFFFF;
      color:#18100A;
      font-size:13.5px; line-height:1.62; font-weight:400;
      padding:9px 14px 9px 12px;
      border-radius:18px 18px 18px 4px;
      word-break:break-word;
      border:1px solid rgba(0,0,0,.07);
      box-shadow:0 2px 8px rgba(0,0,0,.07),inset 0 1px 0 rgba(255,255,255,.9);
      display:flex; flex-direction:column;
    }
    /* tail — agent, only on non-grouped */
    .aurum-msg.agent:not(.grouped) .aurum-bubble-wrap::after{
      content:''; position:absolute;
      bottom:0; left:-6px;
      width:10px; height:14px;
      background:#FFFFFF;
      clip-path:polygon(100% 0,0 100%,100% 100%);
    }
    /* dark agent bubble */
    html[data-theme="dark"] .aurum-msg.agent .aurum-bubble{ background:#0E2038; color:#DDD0B5; border-color:rgba(201,168,76,.1); box-shadow:0 2px 8px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.03); }
    html[data-theme="dark"] .aurum-msg.agent:not(.grouped) .aurum-bubble-wrap::after{ background:#0E2038; }

    /* ─── TIMESTAMP inside bubble (WhatsApp style) ─── */
    .aur-bubble-footer{
      display:flex; align-items:center; justify-content:flex-end; gap:4px;
      margin-top:3px; flex-shrink:0;
    }
    .aurum-msg.user .aur-bubble-footer .aur-time{ color:rgba(10,7,0,.5); font-size:9.5px; font-family:'JetBrains Mono',monospace; }
    .aurum-msg.agent .aur-bubble-footer .aur-time{ color:var(--text-3); font-size:9.5px; font-family:'JetBrains Mono',monospace; }
    .aur-read-tick svg{ width:14px; height:14px; color:rgba(10,7,0,.5); }

    /* ─── IMAGE BUBBLES ─── */
    .aurum-img-bubble{ border-radius:14px; overflow:hidden; max-width:220px; cursor:pointer; border:1px solid var(--border); position:relative; box-shadow:0 3px 14px rgba(0,0,0,.1); transition:transform .2s,box-shadow .2s; }
    .aurum-img-bubble:hover{ transform:scale(1.02); box-shadow:0 8px 28px rgba(0,0,0,.18); }
    .aurum-img-bubble img{ width:100%; height:auto; display:block; }
    .aurum-img-caption{ font-size:11px; color:var(--text-3); padding:5px 10px; background:var(--surface2); display:block; }
    .aurum-msg.user .aurum-img-bubble{ border-color:rgba(201,168,76,.3); box-shadow:0 4px 18px rgba(201,168,76,.2); }

    /* ─── IMAGE PREVIEW ─── */
    #aurum-img-preview{ display:none; padding:10px 14px 0; background:var(--surface2); }
    #aurum-img-preview.has-image{ display:flex; align-items:center; gap:10px; }
    #aurum-img-thumb-wrap{ position:relative; width:46px; height:46px; flex-shrink:0; }
    #aurum-img-thumb{ width:46px; height:46px; border-radius:9px; object-fit:cover; border:1.5px solid var(--border-md); display:block; }
    #aurum-img-remove{ position:absolute; top:-7px; right:-7px; width:18px; height:18px; border-radius:50%; background:#E74C3C; border:2px solid var(--bg); color:#fff; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .2s; }
    #aurum-img-remove:hover{ background:#C0392B; transform:scale(1.12); }
    #aurum-img-preview-label{ font-size:12px; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }

    /* ─── TYPING ─── */
    #aurum-typing{ display:none; padding:4px 12px 8px; }
    #aurum-typing.show{ display:flex; gap:7px; align-items:flex-end; }
    .aurum-typing-bubble{ background:var(--agent-bubble); border:1px solid rgba(0,0,0,.07); border-radius:18px 18px 18px 4px; padding:12px 16px; display:flex; align-items:center; gap:5px; box-shadow:0 2px 8px rgba(0,0,0,.07); }
    html[data-theme="dark"] .aurum-typing-bubble{ border-color:rgba(201,168,76,.1); box-shadow:0 2px 10px rgba(0,0,0,.3); }
    .aurum-typing-bubble span{ width:5px; height:5px; border-radius:50%; background:rgba(201,168,76,.55); animation:aurDot 1.55s ease-in-out infinite; display:inline-block; }
    .aurum-typing-bubble span:nth-child(2){ animation-delay:.24s; }
    .aurum-typing-bubble span:nth-child(3){ animation-delay:.48s; }
    @keyframes aurDot{ 0%,60%,100%{ transform:translateY(0); opacity:.3; } 30%{ transform:translateY(-7px); opacity:1; } }

    /* ═══════════════════════════════
       SESSION PROMPT — ATMOSPHERIC HERO
    ═══════════════════════════════ */
    #aurum-session-prompt{ flex:1; display:flex; flex-direction:column; overflow-y:auto; }
    #aurum-prompt-hero{
      padding:40px 24px 32px;
      background:linear-gradient(160deg,#0A1E32 0%,#06131E 55%,#040E18 100%);
      border-bottom:1px solid rgba(201,168,76,.12);
      position:relative; overflow:hidden; text-align:center; flex-shrink:0;
    }
    #aurum-prompt-hero::before{ content:''; position:absolute; top:-60px; right:-50px; width:220px; height:220px; border-radius:50%; background:radial-gradient(circle,rgba(201,168,76,.1) 0%,transparent 68%); pointer-events:none; }
    #aurum-prompt-hero::after{ content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.5),transparent); }
    #aurum-hero-emblem{ display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
    #aurum-hero-emblem svg{ filter:drop-shadow(0 0 8px rgba(201,168,76,.35)); }
    #aurum-hero-wordmark{ font-family:'Cormorant Garamond',serif; font-size:11px; font-weight:600; letter-spacing:.45em; text-transform:uppercase; color:rgba(201,168,76,.72); margin-bottom:14px; }
    #aurum-hero-rule{ display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:16px; }
    .aurum-rule-line{ display:block; width:44px; height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.45)); }
    .aurum-rule-line.r{ background:linear-gradient(90deg,rgba(201,168,76,.45),transparent); }
    .aurum-rule-diamond{ font-size:8px; color:rgba(201,168,76,.5); }
    #aurum-prompt-title{ font-family:'Cormorant Garamond',serif; color:#EDE0C4; font-size:26px; font-weight:400; line-height:1.2; margin-bottom:10px; letter-spacing:.01em; }
    #aurum-prompt-sub{ font-size:12.5px; color:rgba(185,165,125,.65); line-height:1.75; font-weight:300; max-width:300px; margin:0 auto; }

    /* form */
    #aurum-prompt-form{ padding:24px 22px 16px; background:var(--bg); display:flex; flex-direction:column; gap:18px; flex:1; }
    .aurum-field-group{ display:flex; flex-direction:column; gap:6px; }
    .aurum-field-label{ font-size:9.5px; color:var(--text-3); letter-spacing:.15em; text-transform:uppercase; font-weight:600; }
    .aurum-field{ background:transparent; border:none; border-bottom:1.5px solid var(--border-md); border-radius:0; color:var(--text); font-size:14px; padding:9px 2px; font-family:'Outfit',sans-serif; outline:none; transition:border-color .22s; width:100%; }
    .aurum-field:focus{ border-bottom-color:var(--gold); }
    .aurum-field::placeholder{ color:var(--text-4); }
    .aurum-field.error{ border-bottom-color:rgba(220,53,34,.7); animation:shake .35s ease; }
    @keyframes shake{ 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(-5px); } 75%{ transform:translateX(5px); } }
    #aurum-start-btn{ background:linear-gradient(145deg,#EFD060 0%,#C9A84C 40%,#9A7230 80%,#6A4818 100%); color:#0A0700; font-weight:700; font-size:13px; border:none; border-radius:10px; padding:14px; cursor:pointer; letter-spacing:.1em; text-transform:uppercase; transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .22s; box-shadow:0 6px 22px rgba(201,168,76,.35); font-family:'Outfit',sans-serif; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; gap:10px; }
    #aurum-start-btn::before{ content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent); transform:translateX(-100%); transition:transform .55s ease; }
    #aurum-start-btn:hover::before{ transform:translateX(100%); }
    #aurum-start-btn:hover{ transform:translateY(-2px); box-shadow:0 10px 30px rgba(201,168,76,.5); }
    #aurum-start-btn:active{ transform:translateY(0) scale(.98); }
    .aurum-btn-arrow{ display:flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:rgba(0,0,0,.12); flex-shrink:0; }
    #aurum-trust{ display:flex; align-items:center; justify-content:center; gap:18px; padding:0 22px 18px; background:var(--bg); }
    .aurum-trust-item{ display:flex; align-items:center; gap:5px; font-size:9.5px; color:var(--text-4); letter-spacing:.05em; }
    .aurum-trust-item svg{ width:11px; height:11px; color:rgba(201,168,76,.4); }

    /* ═══════════════════════════════
       INPUT AREA
    ═══════════════════════════════ */
    #aurum-input-area{ padding:8px 12px 14px; border-top:1px solid var(--border); background:var(--surface2); display:flex; flex-direction:column; gap:0; flex-shrink:0; position:relative; }
    html[data-theme="dark"] #aurum-input-area{ background:#060F1A; border-top-color:rgba(201,168,76,.09); }
    #aurum-input-area::before{ content:''; position:absolute; top:0; left:14px; right:14px; height:1px; background:linear-gradient(90deg,transparent,rgba(201,168,76,.22),transparent); }
    #aurum-input-row{ display:flex; align-items:flex-end; gap:8px; padding-top:10px; }
    #aurum-attach{ width:36px; height:36px; border-radius:10px; background:var(--surface); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; outline:none; transition:all .2s; }
    html[data-theme="dark"] #aurum-attach{ background:rgba(255,255,255,.04); border-color:rgba(201,168,76,.1); }
    #aurum-attach:hover{ background:rgba(201,168,76,.1); border-color:var(--border-md); transform:translateY(-1px); }
    #aurum-attach svg{ width:15px; height:15px; color:rgba(201,168,76,.6); transition:color .2s; }
    #aurum-attach:hover svg{ color:var(--gold); }
    #aurum-attach.has-image{ background:rgba(201,168,76,.12); border-color:var(--border-hi); }
    #aurum-file-input{ display:none; }
    #aurum-input-wrap{ flex:1; background:var(--surface); border:1.5px solid var(--border); border-radius:12px; display:flex; align-items:flex-end; transition:border-color .2s,box-shadow .2s; overflow:hidden; }
    html[data-theme="dark"] #aurum-input-wrap{ background:rgba(255,255,255,.04); border-color:rgba(201,168,76,.1); }
    #aurum-input-wrap:focus-within{ border-color:rgba(201,168,76,.45); box-shadow:0 0 0 3px rgba(201,168,76,.07); }
    #aurum-input{ flex:1; background:transparent; border:none; outline:none; color:var(--text); font-size:13.5px; padding:9px 11px; resize:none; min-height:38px; max-height:120px; font-family:'Outfit',sans-serif; line-height:1.55; }
    #aurum-input::placeholder{ color:var(--text-4); }
    #aurum-send{ width:38px; height:38px; border-radius:11px; border:none; cursor:pointer; background:linear-gradient(145deg,#EFD060,#C9A84C,#9A7230); display:flex; align-items:center; justify-content:center; flex-shrink:0; outline:none; position:relative; overflow:hidden; transition:transform .24s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s; box-shadow:0 4px 16px rgba(201,168,76,.4); }
    #aurum-send::before{ content:''; position:absolute; inset:0; background:linear-gradient(145deg,rgba(255,255,255,.2) 0%,transparent 60%); pointer-events:none; }
    #aurum-send:hover{ transform:scale(1.1) translateY(-1px); box-shadow:0 8px 24px rgba(201,168,76,.55); }
    #aurum-send:active{ transform:scale(.93); }
    #aurum-send:disabled{ opacity:.3; cursor:not-allowed; transform:none; box-shadow:none; }
    #aurum-send.uploading svg.send-icon{ display:none; }
    #aurum-send.uploading .send-spinner{ display:block; }
    #aurum-send .send-spinner{ display:none; }
    @keyframes spin{ to{ transform:rotate(360deg); } }
    .send-spinner{ animation:spin .7s linear infinite; }
    #aurum-upload-progress{ height:2px; border-radius:2px; margin-top:6px; background:rgba(201,168,76,.08); display:none; overflow:hidden; }
    #aurum-upload-progress.active{ display:block; }
    #aurum-upload-bar{ height:100%; border-radius:2px; background:linear-gradient(90deg,var(--gold),var(--gold-hi)); width:0%; transition:width .3s ease; }

    /* ═══════════════════════════════
       MOBILE — full screen
    ═══════════════════════════════ */
    @media(max-width:520px){
      #aurum-window{
        width:100vw; right:0; bottom:76px;
        height:calc(100dvh - 76px);
        border-radius:20px 20px 0 0;
        border-left:none; border-right:none; border-bottom:none;
        border-top:2.5px solid var(--gold);
      }
      #aurum-toggle{ bottom:14px; right:18px; }
    }
  `;
  document.head.appendChild(style);
})();

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
function initAurumChat() {
  const { createClient } = supabase;
  const sb = createClient(AURUM_CHAT_CONFIG.supabaseUrl, AURUM_CHAT_CONFIG.supabaseKey);
  const NOTIFY_URL = AURUM_CHAT_CONFIG.notifyEndpoint
    || `${AURUM_CHAT_CONFIG.supabaseUrl}/functions/v1/contact-form-handler`;

  let sessionId  = null;
  let userInfo   = {};
  let channel    = null;
  let unread     = 0;
  let isOpen     = false;
  let lastSender = null;
  let pendingFile= null;

  const root = document.createElement("div");
  root.id = "aurum-chat-root";
  root.innerHTML = `
    <button id="aurum-toggle" aria-label="Open Aurum support chat">
      <div id="aurum-badge"></div>

      <!-- ── PREMIUM ANIMATED ICON ── -->
      <div class="aur-tog-frame">
        <div class="aur-arc-1"></div>
        <div class="aur-arc-2"></div>
        <svg class="aur-tog-svg" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer diamond (rotates) -->
          <path class="aur-d1" d="M16 1L31 16L16 31L1 16Z" stroke="rgba(255,240,130,.38)" stroke-width=".8" fill="none"/>
          <!-- Inner diamond (counter-rotates) -->
          <path class="aur-d2" d="M16 7L25 16L16 25L7 16Z" stroke="rgba(255,240,130,.22)" stroke-width=".6" fill="none"/>
          <!-- Serif A monogram — draws itself -->
          <path class="aur-letter" d="M10 24L16 9L22 24M12.5 19.5H19.5" stroke="rgba(255,240,130,.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <!-- 4 corner accent dots -->
          <circle cx="16" cy="1" r="1" fill="rgba(255,240,130,.45)"/>
          <circle cx="31" cy="16" r="1" fill="rgba(255,240,130,.45)"/>
          <circle cx="16" cy="31" r="1" fill="rgba(255,240,130,.45)"/>
          <circle cx="1" cy="16" r="1" fill="rgba(255,240,130,.45)"/>
        </svg>
      </div>

      <!-- ── CLOSE ICON ── -->
      <svg class="icon-close" width="17" height="17" viewBox="0 0 24 24" fill="none" style="position:absolute;">
        <path d="M18 6L6 18M6 6l12 12" stroke="rgba(10,7,0,.85)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>

    <div id="aurum-window" role="dialog" aria-label="Aurum live chat">

      <div id="aurum-header">
        <div id="aurum-header-avatar">
          <img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt="Support"/>
        </div>
        <div id="aurum-header-info">
          <div id="aurum-header-name">${AURUM_CHAT_CONFIG.brandName}</div>
          <div id="aurum-header-sub">${AURUM_CHAT_CONFIG.brandSubtitle}</div>
        </div>
        <div id="aurum-header-right">
          <div id="aurum-status-wrap">
            <div id="aurum-status-dot"></div>
            <span id="aurum-status-label">Online</span>
          </div>
          <button id="aurum-close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- SESSION PROMPT -->
      <div id="aurum-session-prompt">
        <div id="aurum-prompt-hero">
          <div id="aurum-hero-emblem">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <path d="M19 3L35 19L19 35L3 19Z" fill="rgba(201,168,76,.08)" stroke="rgba(201,168,76,.5)" stroke-width="1"/>
              <path d="M19 9L29 19L19 29L9 19Z" fill="rgba(201,168,76,.06)" stroke="rgba(201,168,76,.32)" stroke-width=".8"/>
              <circle cx="19" cy="19" r="3" fill="rgba(201,168,76,.55)"/>
            </svg>
          </div>
          <div id="aurum-hero-wordmark">Aurum Capital</div>
          <div id="aurum-hero-rule">
            <span class="aurum-rule-line"></span>
            <span class="aurum-rule-diamond">◆</span>
            <span class="aurum-rule-line r"></span>
          </div>
          <div id="aurum-prompt-title">Private Client Support</div>
          <div id="aurum-prompt-sub">${AURUM_CHAT_CONFIG.welcomeMsg}</div>
        </div>
        <div id="aurum-prompt-form">
          <div class="aurum-field-group">
            <label class="aurum-field-label" for="aurum-user-name">Your name</label>
            <input class="aurum-field" id="aurum-user-name" type="text" placeholder="Full name" autocomplete="name"/>
          </div>
          <div class="aurum-field-group">
            <label class="aurum-field-label" for="aurum-user-email">Email <span style="opacity:.4;font-style:italic;text-transform:none;letter-spacing:0;font-weight:300">(for reply notification)</span></label>
            <input class="aurum-field" id="aurum-user-email" type="email" placeholder="you@example.com" autocomplete="email"/>
          </div>
          <button id="aurum-start-btn">
            <span>Begin Conversation</span>
            <span class="aurum-btn-arrow">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
        </div>
        <div id="aurum-trust">
          <div class="aurum-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Encrypted
          </div>
          <div class="aurum-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>24 / 7
          </div>
          <div class="aurum-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Private
          </div>
        </div>
      </div>

      <!-- MESSAGES -->
      <div id="aurum-messages" style="display:none;">
        <div class="aurum-divider">Conversation started</div>
      </div>

      <!-- TYPING -->
      <div id="aurum-typing" style="display:none;">
        <div class="aurum-msg-avatar">
          <img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>
        </div>
        <div class="aurum-typing-bubble"><span></span><span></span><span></span></div>
      </div>

      <!-- INPUT AREA -->
      <div id="aurum-input-area" style="display:none;">
        <div id="aurum-img-preview">
          <div id="aurum-img-thumb-wrap">
            <img id="aurum-img-thumb" src="" alt=""/>
            <button id="aurum-img-remove" aria-label="Remove">✕</button>
          </div>
          <span id="aurum-img-preview-label"></span>
        </div>
        <div id="aurum-upload-progress"><div id="aurum-upload-bar"></div></div>
        <div id="aurum-input-row">
          <input type="file" id="aurum-file-input" accept="image/*,.pdf,.doc,.docx"/>
          <button id="aurum-attach" aria-label="Attach file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <div id="aurum-input-wrap">
            <textarea id="aurum-input" rows="1" placeholder="${AURUM_CHAT_CONFIG.placeholder}" aria-label="Message"></textarea>
          </div>
          <button id="aurum-send" aria-label="Send">
            <svg class="send-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" fill="rgba(10,7,0,.9)"/>
            </svg>
            <svg class="send-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(10,7,0,.2)" stroke-width="3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="rgba(10,7,0,.85)" stroke-width="3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  `;
  document.body.appendChild(root);

  /* ── REFS ── */
  const toggleBtn     = document.getElementById("aurum-toggle");
  const chatWindow    = document.getElementById("aurum-window");
  const badge         = document.getElementById("aurum-badge");
  const sessionPrompt = document.getElementById("aurum-session-prompt");
  const messagesEl    = document.getElementById("aurum-messages");
  const typingEl      = document.getElementById("aurum-typing");
  const inputArea     = document.getElementById("aurum-input-area");
  const input         = document.getElementById("aurum-input");
  const sendBtn       = document.getElementById("aurum-send");
  const startBtn      = document.getElementById("aurum-start-btn");
  const nameField     = document.getElementById("aurum-user-name");
  const emailField    = document.getElementById("aurum-user-email");
  const attachBtn     = document.getElementById("aurum-attach");
  const fileInput     = document.getElementById("aurum-file-input");
  const imgPreview    = document.getElementById("aurum-img-preview");
  const imgThumb      = document.getElementById("aurum-img-thumb");
  const imgRemoveBtn  = document.getElementById("aurum-img-remove");
  const imgLabel      = document.getElementById("aurum-img-preview-label");
  const uploadProgress= document.getElementById("aurum-upload-progress");
  const uploadBar     = document.getElementById("aurum-upload-bar");
  const closeBtn      = document.getElementById("aurum-close-btn");

  /* ── TOGGLE ── */
  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    toggleBtn.classList.toggle("open", isOpen);
    chatWindow.classList.toggle("visible", isOpen);
    if (isOpen) clearUnread();
  });
  closeBtn.addEventListener("click", () => {
    isOpen = false;
    toggleBtn.classList.remove("open");
    chatWindow.classList.remove("visible");
  });

  /* ── START SESSION ── */
  startBtn.addEventListener("click", async () => {
    const name = nameField.value.trim();
    if (!name) {
      nameField.classList.add("error");
      nameField.focus();
      setTimeout(() => nameField.classList.remove("error"), 2200);
      return;
    }
    userInfo  = { name, email: emailField.value.trim() };
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionPrompt.style.display = "none";
    messagesEl.style.display    = "flex";
    inputArea.style.display     = "flex";
    lastSender = null;
    await createSession();
    subscribeRealtime();
    notifyAdmin({
      formType: "live_chat_session",
      subject: `[Aurum Chat] New session from ${name}`,
      userName: name, userEmail: userInfo.email || "Not provided",
      message: `New live chat session started.\nPage: ${window.location.href}`,
      sessionId,
    });
    appendMessage({ role: "agent", text: `Hello ${name}! ${AURUM_CHAT_CONFIG.welcomeMsg}`, time: nowTime() });
    input.focus();
  });

  nameField.addEventListener("keydown", e => { if (e.key === "Enter") startBtn.click(); });
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  sendBtn.addEventListener("click", sendMessage);
  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File too large. Max 10 MB."); fileInput.value = ""; return; }
    pendingFile = { file, name: file.name };
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => { pendingFile.dataUrl = e.target.result; imgThumb.src = e.target.result; imgThumb.style.display = "block"; };
      reader.readAsDataURL(file);
    } else { imgThumb.style.display = "none"; }
    imgLabel.textContent = file.name;
    imgPreview.classList.add("has-image");
    attachBtn.classList.add("has-image");
    fileInput.value = "";
  });
  imgRemoveBtn.addEventListener("click", clearPendingFile);

  function clearPendingFile() {
    pendingFile = null;
    imgPreview.classList.remove("has-image");
    attachBtn.classList.remove("has-image");
    imgThumb.src = ""; imgLabel.textContent = "";
  }

  async function createSession() {
    await sb.from("chat_sessions").insert({
      id: sessionId, user_name: userInfo.name,
      user_email: userInfo.email || null,
      page_url: window.location.href, status: "open",
    });
  }

  async function sendMessage() {
    const text = input.value.trim();
    if ((!text && !pendingFile) || !sessionId) return;
    input.value = ""; input.style.height = "auto"; sendBtn.disabled = true;
    let imageUrl = null;
    if (pendingFile) {
      const file = pendingFile.file;
      const isImg = file.type.startsWith("image/");
      sendBtn.classList.add("uploading"); uploadProgress.classList.add("active"); uploadBar.style.width = "20%";
      try {
        let prog = 20;
        const ticker = setInterval(() => { prog = Math.min(prog + 12, 88); uploadBar.style.width = prog + "%"; }, 200);
        const fileName = `${sessionId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await sb.storage.from(AURUM_CHAT_CONFIG.storageBucket).upload(fileName, file, { cacheControl: "3600", upsert: false });
        clearInterval(ticker);
        if (upErr) throw upErr;
        const { data: urlData } = sb.storage.from(AURUM_CHAT_CONFIG.storageBucket).getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl || null;
        uploadBar.style.width = "100%";
        if (isImg) appendImageMessage({ role: "user", src: pendingFile.dataUrl || imageUrl, fileName: file.name, time: nowTime() });
        else appendFileLinkMessage({ role: "user", url: imageUrl, fileName: file.name, time: nowTime() });
      } catch (err) {
        console.warn("[Aurum] Upload failed:", err.message);
        if (pendingFile.dataUrl) appendImageMessage({ role: "user", src: pendingFile.dataUrl, fileName: file.name, time: nowTime(), failed: true });
        else appendMessage({ role: "user", text: `📎 ${file.name} (upload failed)`, time: nowTime() });
      } finally {
        sendBtn.classList.remove("uploading");
        setTimeout(() => { uploadProgress.classList.remove("active"); uploadBar.style.width = "0%"; }, 600);
        clearPendingFile();
      }
    }
    if (text) appendMessage({ role: "user", text, time: nowTime() });
    await sb.from("chat_messages").insert({
      session_id: sessionId, sender_role: "user", sender_name: userInfo.name,
      message: text || (pendingFile?.name ? `[Attachment: ${pendingFile?.name || "file"}]` : ""),
      image_url: imageUrl || null,
    });
    notifyAdmin({
      subject: `[Aurum Chat] Message from ${userInfo.name}`,
      userName: userInfo.name, userEmail: userInfo.email || "Not provided",
      message: text || "[File attached]",
      sessionId, pageUrl: window.location.href,
    });
    sendBtn.disabled = false; input.focus();
  }

  async function notifyAdmin({ formType = "live_chat_message", subject, userName, userEmail, message, sessionId, pageUrl }) {
    try {
      await fetch(NOTIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AURUM_CHAT_CONFIG.supabaseKey}` },
        body: JSON.stringify({
          formType,
          adminEmail: AURUM_CHAT_CONFIG.adminEmail,
          subject, name: userName, email: userEmail,
          message, sessionId, pageUrl: pageUrl || window.location.href,
        }),
      });
    } catch (e) { console.warn("[Aurum] Notification failed:", e.message); }
  }

  function subscribeRealtime() {
    channel = sb.channel(`chat_${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` }, (payload) => {
        const row = payload.new;
        if (row.sender_role === "agent") {
          hideTyping();
          if (row.image_url) appendImageMessage({ role: "agent", src: row.image_url, fileName: "Attachment", time: formatTime(row.created_at) });
          else appendMessage({ role: "agent", text: row.message, time: formatTime(row.created_at) });
          if (!isOpen) showUnread();
        }
      }).subscribe();
  }

  /* ── APPEND MESSAGE — WhatsApp style ── */
  function appendMessage({ role, text, time }) {
    const isUser = role === "user";
    const grouped = (lastSender === role);
    lastSender = role;
    const div = document.createElement("div");
    div.className = `aurum-msg ${isUser ? "user" : "agent"}${grouped ? " grouped" : ""}`;
    const initials = userInfo.name ? userInfo.name[0].toUpperCase() : "U";
    const avatarHtml = isUser
      ? `<span>${initials}</span>`
      : `<img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>`;
    const tickHtml = isUser
      ? `<div class="aur-read-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/><polyline points="16 6 9 13"/></svg></div>`
      : "";
    div.innerHTML = `
      <div class="aurum-msg-avatar">${avatarHtml}</div>
      <div class="aurum-msg-body">
        <div class="aurum-bubble-wrap">
          <div class="aurum-bubble">
            <span>${escHtml(text)}</span>
            <div class="aur-bubble-footer">
              <span class="aur-time">${time}</span>
              ${tickHtml}
            </div>
          </div>
        </div>
      </div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendImageMessage({ role, src, fileName, time, failed }) {
    const isUser = role === "user";
    const grouped = (lastSender === role);
    lastSender = role;
    const div = document.createElement("div");
    div.className = `aurum-msg ${isUser ? "user" : "agent"}${grouped ? " grouped" : ""}`;
    const initials = userInfo.name ? userInfo.name[0].toUpperCase() : "U";
    const avatarHtml = isUser ? `<span>${initials}</span>` : `<img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>`;
    div.innerHTML = `
      <div class="aurum-msg-avatar">${avatarHtml}</div>
      <div class="aurum-msg-body">
        <div class="aurum-bubble-wrap">
          <div class="aurum-img-bubble" onclick="window.open('${escHtml(src)}','_blank')">
            <img src="${escHtml(src)}" alt="${escHtml(fileName)}" loading="lazy"/>
            ${failed ? `<span class="aurum-img-caption" style="color:rgba(200,50,34,.7)">Upload may have failed</span>` : ""}
          </div>
        </div>
      </div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendFileLinkMessage({ role, url, fileName, time }) {
    const isUser = role === "user";
    const grouped = (lastSender === role);
    lastSender = role;
    const div = document.createElement("div");
    div.className = `aurum-msg ${isUser ? "user" : "agent"}${grouped ? " grouped" : ""}`;
    const initials = userInfo.name ? userInfo.name[0].toUpperCase() : "U";
    const avatarHtml = isUser ? `<span>${initials}</span>` : `<img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>`;
    div.innerHTML = `
      <div class="aurum-msg-avatar">${avatarHtml}</div>
      <div class="aurum-msg-body">
        <div class="aurum-bubble-wrap">
          <div class="aurum-bubble">
            <div style="display:flex;align-items:center;gap:8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <a href="${escHtml(url)}" target="_blank" style="color:inherit;text-decoration:underline;text-underline-offset:3px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${escHtml(fileName)}</a>
            </div>
            <div class="aur-bubble-footer"><span class="aur-time">${time}</span></div>
          </div>
        </div>
      </div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() { typingEl.classList.remove("show"); typingEl.style.display = "none"; }
  function showUnread() { unread++; badge.textContent = unread > 9 ? "9+" : unread; badge.classList.add("show"); }
  function clearUnread() { unread = 0; badge.classList.remove("show"); }
  function nowTime() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function formatTime(ts) { if (!ts) return nowTime(); return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function escHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\n/g,"<br>"); }
}

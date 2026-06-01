/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   AURUM LIVE SUPPORT WIDGET  ·  Premium Edition
 *   Drop this script tag on any page:
 *   <script src="chat-widget.js"></script>
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
const AURUM_CHAT_CONFIG = {
  supabaseUrl:    "https://ttwwthfeordsojmcjwxn.supabase.co",
  supabaseKey:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w",
  brandName:      "Aurum Support",
  brandSubtitle:  "Premium Trading Assistance",
  accentColor:    "#C9A84C",
  darkBg:         "#080909",
  agentName:      "Support Team",
  agentAvatar:    "https://api.dicebear.com/7.x/initials/svg?seed=AU&backgroundColor=c9a84c&fontColor=0b0c10",
  welcomeMsg:     "Welcome to Aurum. How can we assist your trading experience today?",
  offlineMsg:     "Our team is currently offline. Leave a message and we'll respond shortly.",
  placeholder:    "Write a message…",
  adminEmail:     "aurumcapitalinvest@gmail.com",
  notifyEndpoint: null,
  /* Supabase storage bucket name for image uploads */
  storageBucket:  "chat-images",
};

/* ─── INJECT SUPABASE SDK ─── */
(function () {
  if (document.getElementById("aurum-chat-root")) return;

  const sdkScript = document.createElement("script");
  sdkScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  sdkScript.onload = initAurumChat;
  document.head.appendChild(sdkScript);

  /* Google Fonts */
  const fontLink = document.createElement("link");
  fontLink.rel  = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Outfit:wght@300;400;500;600&display=swap";
  document.head.appendChild(fontLink);

  const style = document.createElement("style");
  style.textContent = `
    /* ─── RESET ─── */
    #aurum-chat-root *{box-sizing:border-box;margin:0;padding:0;}

    /* ─── CSS VARS ─── */
    #aurum-chat-root{
      --gold:        #C9A84C;
      --gold-lt:     #E8C96A;
      --gold-dk:     #8A6820;
      --gold-glow:   rgba(201,168,76,.35);
      --gold-subtle: rgba(201,168,76,.06);
      --bg-void:     #080909;
      --bg-base:     #0D0E11;
      --bg-surface:  #13141A;
      --bg-raised:   #1A1C24;
      --bg-input:    #0F1015;
      --border:      rgba(201,168,76,.12);
      --border-md:   rgba(201,168,76,.26);
      --text-hi:     rgba(255,255,255,.92);
      --text-mid:    rgba(255,255,255,.55);
      --text-lo:     rgba(255,255,255,.28);
      --online:      #3DD68C;
      --radius-lg:   24px;
      --radius-md:   16px;
      --radius-sm:   11px;
      --shadow-glow: 0 0 0 1px rgba(201,168,76,.1), 0 40px 90px rgba(0,0,0,.8), 0 10px 30px rgba(0,0,0,.5);
      font-family: 'Outfit', sans-serif;
    }

    /* ─── TOGGLE BUTTON ─── */
    #aurum-toggle{
      position:fixed;bottom:30px;right:30px;z-index:99998;
      width:66px;height:66px;border-radius:50%;border:none;cursor:pointer;
      background:linear-gradient(145deg,#EDD068 0%,#C9A84C 45%,#8A6820 100%);
      box-shadow:0 0 0 1px rgba(201,168,76,.25), 0 14px 44px rgba(201,168,76,.45), 0 4px 14px rgba(0,0,0,.55);
      display:flex;align-items:center;justify-content:center;
      transition:transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease;
      outline:none;
    }
    #aurum-toggle:hover{
      transform:scale(1.1) translateY(-2px);
      box-shadow:0 0 0 1px rgba(201,168,76,.35), 0 20px 56px rgba(201,168,76,.6), 0 4px 18px rgba(0,0,0,.5);
    }
    #aurum-toggle:active{transform:scale(.95);}
    #aurum-toggle svg{position:absolute;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s ease;}
    #aurum-toggle.open .icon-chat{transform:scale(0) rotate(60deg);opacity:0;}
    #aurum-toggle.open .icon-close{transform:scale(1) rotate(0);opacity:1;}
    #aurum-toggle:not(.open) .icon-close{transform:scale(0) rotate(-60deg);opacity:0;}
    #aurum-toggle:not(.open) .icon-chat{transform:scale(1);opacity:1;}

    /* outer ring pulse */
    #aurum-toggle::before{
      content:'';position:absolute;inset:-7px;border-radius:50%;
      border:1.5px solid rgba(201,168,76,.2);
      animation:aurumRing 3.2s ease-in-out infinite;
    }
    /* inner shimmer ring */
    #aurum-toggle::after{
      content:'';position:absolute;inset:3px;border-radius:50%;
      border:1px solid rgba(255,255,255,.12);
      pointer-events:none;
    }
    @keyframes aurumRing{
      0%,100%{transform:scale(1);opacity:.7;}
      55%{transform:scale(1.14);opacity:0;}
    }

    /* ─── BADGE ─── */
    #aurum-badge{
      position:absolute;top:-5px;right:-5px;
      background:linear-gradient(135deg,#FF6B6B,#E74C3C);
      color:#fff;font-size:10px;font-weight:600;
      width:22px;height:22px;border-radius:50%;
      display:none;align-items:center;justify-content:center;
      border:2.5px solid var(--bg-void);
      animation:aurumPop .35s cubic-bezier(.34,1.56,.64,1);
      font-family:'Outfit',sans-serif;
    }
    #aurum-badge.show{display:flex;}
    @keyframes aurumPop{from{transform:scale(0) rotate(-15deg);}to{transform:scale(1) rotate(0);}}

    /* ─── CHAT WINDOW ─── */
    #aurum-window{
      position:fixed;bottom:116px;right:30px;z-index:99997;
      width:408px;height:620px;
      background:var(--bg-base);
      border:1px solid rgba(201,168,76,.13);
      border-radius:var(--radius-lg);
      box-shadow:var(--shadow-glow);
      display:flex;flex-direction:column;overflow:hidden;
      opacity:0;transform:translateY(28px) scale(.93);pointer-events:none;
      transition:opacity .38s ease, transform .42s cubic-bezier(.34,1.56,.64,1);
      background-image:
        radial-gradient(ellipse 90% 55% at 50% -8%, rgba(201,168,76,.06) 0%, transparent 68%),
        radial-gradient(ellipse 40% 30% at 90% 95%, rgba(201,168,76,.04) 0%, transparent 60%);
    }
    #aurum-window.visible{opacity:1;transform:translateY(0) scale(1);pointer-events:all;}

    /* ─── HEADER ─── */
    #aurum-header{
      padding:18px 22px 16px;
      background:linear-gradient(160deg,#121318 0%,#0D0E11 100%);
      border-bottom:1px solid var(--border);
      display:flex;align-items:center;gap:14px;
      flex-shrink:0;
      position:relative;
      overflow:hidden;
    }
    /* decorative arc top right */
    #aurum-header::before{
      content:'';position:absolute;top:-30px;right:-30px;
      width:120px;height:120px;border-radius:50%;
      border:1px solid rgba(201,168,76,.08);
      pointer-events:none;
    }
    /* gold shimmer line across header bottom */
    #aurum-header::after{
      content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent 0%,rgba(201,168,76,.5) 40%,rgba(201,168,76,.5) 60%,transparent 100%);
    }
    #aurum-header-avatar{
      width:48px;height:48px;border-radius:50%;
      border:1.5px solid rgba(201,168,76,.45);
      overflow:hidden;flex-shrink:0;
      background:var(--bg-raised);
      box-shadow:0 0 0 4px rgba(201,168,76,.07), 0 4px 14px rgba(0,0,0,.5);
      position:relative;
    }
    #aurum-header-avatar img{width:100%;height:100%;object-fit:cover;}
    #aurum-header-info{flex:1;min-width:0;}
    #aurum-header-name{
      font-family:'Playfair Display',serif;
      font-size:17px;font-weight:500;letter-spacing:.015em;
      color:var(--gold);line-height:1.2;
    }
    #aurum-header-sub{
      font-size:11px;color:var(--text-lo);
      letter-spacing:.1em;text-transform:uppercase;margin-top:3px;
      font-weight:400;
    }
    #aurum-header-right{display:flex;flex-direction:column;align-items:flex-end;gap:5px;}
    #aurum-status-wrap{display:flex;align-items:center;gap:6px;}
    #aurum-status-dot{
      width:8px;height:8px;border-radius:50%;
      background:var(--online);
      box-shadow:0 0 8px rgba(61,214,140,.7);
      animation:aurumPulseGreen 2.5s ease-in-out infinite;
    }
    #aurum-status-label{font-size:11px;color:var(--online);font-weight:500;letter-spacing:.04em;}
    @keyframes aurumPulseGreen{
      0%,100%{box-shadow:0 0 6px rgba(61,214,140,.6);}
      50%{box-shadow:0 0 16px rgba(61,214,140,1),0 0 28px rgba(61,214,140,.3);}
    }
    #aurum-status-dot.offline{background:#444;box-shadow:none;animation:none;}
    #aurum-status-label.offline{color:var(--text-lo);}
    #aurum-response-time{font-size:10px;color:var(--text-lo);letter-spacing:.03em;}

    /* ─── MESSAGES ─── */
    #aurum-messages{
      flex:1;overflow-y:auto;padding:20px 16px 10px;
      display:flex;flex-direction:column;gap:5px;
      scroll-behavior:smooth;
    }
    #aurum-messages::-webkit-scrollbar{width:3px;}
    #aurum-messages::-webkit-scrollbar-track{background:transparent;}
    #aurum-messages::-webkit-scrollbar-thumb{background:rgba(201,168,76,.18);border-radius:2px;}

    /* ─── BUBBLE GROUPING ─── */
    .aurum-msg+.aurum-msg.agent.grouped,
    .aurum-msg+.aurum-msg.user.grouped{margin-top:-3px;}
    .aurum-msg.grouped .aurum-msg-avatar{visibility:hidden;}
    .aurum-msg.grouped.user .aurum-bubble{border-top-right-radius:7px;border-bottom-right-radius:20px;}
    .aurum-msg.grouped.agent .aurum-bubble{border-top-left-radius:7px;border-bottom-left-radius:20px;}

    /* ─── MESSAGE ROW ─── */
    .aurum-msg{
      display:flex;gap:10px;align-items:flex-end;
      animation:aurumSlideIn .28s cubic-bezier(.25,.46,.45,.94) both;
    }
    @keyframes aurumSlideIn{
      from{opacity:0;transform:translateY(10px);}
      to{opacity:1;transform:translateY(0);}
    }
    .aurum-msg.user{flex-direction:row-reverse;}

    .aurum-msg-avatar{
      width:34px;height:34px;border-radius:50%;
      background:rgba(201,168,76,.1);
      border:1.5px solid rgba(201,168,76,.22);
      overflow:hidden;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;color:var(--gold);font-weight:600;
      font-family:'Outfit',sans-serif;
    }
    .aurum-msg-avatar img{width:100%;height:100%;object-fit:cover;}

    .aurum-msg-body{max-width:76%;display:flex;flex-direction:column;gap:4px;}
    .aurum-msg.user .aurum-msg-body{align-items:flex-end;}

    /* ─── BUBBLES — ENHANCED PADDING ─── */
    .aurum-bubble{
      padding:14px 20px;
      border-radius:22px;
      font-size:14px;line-height:1.68;
      word-break:break-word;
      position:relative;
      letter-spacing:.012em;
    }

    /* Agent bubble */
    .aurum-msg.agent .aurum-bubble{
      background:var(--bg-surface);
      color:var(--text-hi);
      border:1px solid rgba(255,255,255,.065);
      border-bottom-left-radius:5px;
      box-shadow:
        0 2px 14px rgba(0,0,0,.35),
        inset 0 1px 0 rgba(255,255,255,.045),
        inset 0 -1px 0 rgba(0,0,0,.15);
    }

    /* User bubble */
    .aurum-msg.user .aurum-bubble{
      background:linear-gradient(150deg, #E0BA5C 0%, #C9A84C 50%, #9A7832 100%);
      color:#06070A;
      font-weight:500;
      border-bottom-right-radius:5px;
      box-shadow:
        0 5px 20px rgba(201,168,76,.32),
        0 2px 8px rgba(0,0,0,.3),
        inset 0 1px 0 rgba(255,255,255,.25);
    }

    /* ─── IMAGE MESSAGE ─── */
    .aurum-img-bubble{
      border-radius:18px;overflow:hidden;
      max-width:220px;
      border:1px solid rgba(201,168,76,.2);
      cursor:pointer;
      position:relative;
    }
    .aurum-img-bubble img{
      width:100%;height:auto;display:block;
      transition:opacity .2s;
    }
    .aurum-img-bubble:hover img{opacity:.9;}
    .aurum-img-bubble .aurum-img-caption{
      font-size:11px;color:var(--text-lo);padding:6px 12px;
      background:var(--bg-surface);
      display:block;
    }
    /* user image bubble */
    .aurum-msg.user .aurum-img-bubble{
      border-bottom-right-radius:5px;
      border-color:rgba(201,168,76,.35);
      box-shadow:0 5px 20px rgba(201,168,76,.25);
    }
    .aurum-msg.agent .aurum-img-bubble{
      border-bottom-left-radius:5px;
    }

    /* ─── IMAGE PREVIEW in input ─── */
    #aurum-img-preview{
      display:none;
      padding:10px 16px 0;
      background:var(--bg-input);
    }
    #aurum-img-preview.has-image{display:flex;align-items:center;gap:10px;}
    #aurum-img-thumb-wrap{
      position:relative;width:54px;height:54px;flex-shrink:0;
    }
    #aurum-img-thumb{
      width:54px;height:54px;border-radius:10px;object-fit:cover;
      border:1.5px solid rgba(201,168,76,.3);
      display:block;
    }
    #aurum-img-remove{
      position:absolute;top:-7px;right:-7px;
      width:20px;height:20px;border-radius:50%;
      background:#E74C3C;border:2px solid var(--bg-input);
      color:#fff;font-size:10px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;line-height:1;padding:0;
      transition:transform .2s, background .2s;
    }
    #aurum-img-remove:hover{background:#C0392B;transform:scale(1.1);}
    #aurum-img-preview-label{
      font-size:12px;color:var(--text-mid);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      max-width:200px;
    }

    /* ─── META / TIMESTAMP ─── */
    .aurum-msg-meta{
      display:flex;align-items:center;gap:5px;
      padding:0 5px;
    }
    .aurum-msg-time{font-size:10.5px;color:var(--text-lo);font-weight:400;}
    .aurum-read-tick{display:flex;align-items:center;gap:1px;}
    .aurum-read-tick svg{width:14px;height:14px;color:var(--gold);}

    /* ─── TYPING INDICATOR ─── */
    #aurum-typing{display:none;}
    #aurum-typing.show{display:flex;}
    .aurum-typing-bubble{
      background:var(--bg-surface);
      border:1px solid rgba(255,255,255,.065);
      border-radius:22px;border-bottom-left-radius:5px;
      padding:14px 20px;
      display:flex;align-items:center;gap:5px;
      box-shadow:0 2px 14px rgba(0,0,0,.3);
    }
    .aurum-typing-bubble span{
      width:7px;height:7px;border-radius:50%;
      background:rgba(201,168,76,.55);
      animation:aurumDot 1.6s ease-in-out infinite;
      display:inline-block;
    }
    .aurum-typing-bubble span:nth-child(2){animation-delay:.22s;}
    .aurum-typing-bubble span:nth-child(3){animation-delay:.44s;}
    @keyframes aurumDot{
      0%,60%,100%{transform:translateY(0);opacity:.4;}
      30%{transform:translateY(-5px);opacity:1;}
    }

    /* ─── DIVIDER ─── */
    .aurum-divider{
      text-align:center;font-size:10px;color:var(--text-lo);
      letter-spacing:.12em;text-transform:uppercase;
      display:flex;align-items:center;gap:12px;
      margin:4px 0 10px;font-weight:400;
    }
    .aurum-divider::before,.aurum-divider::after{
      content:'';flex:1;height:1px;
      background:linear-gradient(90deg,transparent,rgba(201,168,76,.15),transparent);
    }

    /* ─── INPUT AREA ─── */
    #aurum-input-area{
      padding:10px 14px 18px;
      border-top:1px solid rgba(255,255,255,.045);
      background:var(--bg-input);
      display:flex;flex-direction:column;gap:0;
      flex-shrink:0;
      position:relative;
    }
    /* thin gold accent line top */
    #aurum-input-area::before{
      content:'';position:absolute;top:0;left:18px;right:18px;height:1px;
      background:linear-gradient(90deg,transparent,rgba(201,168,76,.22),transparent);
    }

    /* row: attach + textarea + send */
    #aurum-input-row{
      display:flex;align-items:flex-end;gap:8px;
      padding-top:10px;
    }

    /* ─── ATTACH BUTTON ─── */
    #aurum-attach{
      width:40px;height:40px;border-radius:12px;border:none;cursor:pointer;
      background:var(--bg-surface);
      border:1px solid rgba(201,168,76,.15);
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
      transition:background .2s, border-color .2s, transform .2s;
      outline:none;
    }
    #aurum-attach:hover{
      background:rgba(201,168,76,.1);
      border-color:rgba(201,168,76,.35);
      transform:translateY(-1px);
    }
    #aurum-attach:active{transform:scale(.94);}
    #aurum-attach svg{width:18px;height:18px;color:rgba(201,168,76,.65);transition:color .2s;}
    #aurum-attach:hover svg{color:var(--gold);}
    #aurum-attach.has-image{
      background:rgba(201,168,76,.12);
      border-color:rgba(201,168,76,.5);
    }
    #aurum-attach.has-image svg{color:var(--gold);}

    /* hidden file input */
    #aurum-file-input{display:none;}

    #aurum-input-wrap{
      flex:1;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.07);
      border-radius:14px;
      display:flex;align-items:flex-end;
      transition:border-color .2s,box-shadow .2s;
      overflow:hidden;
    }
    #aurum-input-wrap:focus-within{
      border-color:rgba(201,168,76,.4);
      box-shadow:0 0 0 3px rgba(201,168,76,.07);
    }
    #aurum-input{
      flex:1;background:transparent;
      border:none;outline:none;
      color:var(--text-hi);font-size:14px;
      padding:11px 14px;resize:none;
      min-height:44px;max-height:120px;
      font-family:'Outfit',sans-serif;line-height:1.55;
      letter-spacing:.012em;
    }
    #aurum-input::placeholder{color:var(--text-lo);}

    #aurum-send{
      width:42px;height:42px;border-radius:13px;border:none;cursor:pointer;
      background:linear-gradient(150deg,#DDB94E,#C9A84C,#9A7832);
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
      transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s;
      box-shadow:0 4px 18px rgba(201,168,76,.38);
      outline:none;
    }
    #aurum-send:hover{
      transform:scale(1.08) translateY(-1px);
      box-shadow:0 8px 26px rgba(201,168,76,.55);
    }
    #aurum-send:active{transform:scale(.95);}
    #aurum-send:disabled{opacity:.3;cursor:not-allowed;transform:none;box-shadow:none;}

    /* uploading spinner */
    #aurum-send.uploading svg.send-icon{display:none;}
    #aurum-send.uploading .send-spinner{display:block;}
    #aurum-send .send-spinner{display:none;}
    @keyframes spin{to{transform:rotate(360deg);}}
    .send-spinner{animation:spin .7s linear infinite;}

    /* ─── UPLOAD PROGRESS ─── */
    #aurum-upload-progress{
      height:2px;border-radius:2px;margin-top:8px;
      background:rgba(201,168,76,.15);
      display:none;overflow:hidden;
    }
    #aurum-upload-progress.active{display:block;}
    #aurum-upload-bar{
      height:100%;border-radius:2px;
      background:linear-gradient(90deg,var(--gold),var(--gold-lt));
      width:0%;
      transition:width .3s ease;
    }

    /* ─── SESSION PROMPT ─── */
    #aurum-session-prompt{
      flex:1;display:flex;flex-direction:column;gap:0;
      overflow-y:auto;
    }
    #aurum-prompt-hero{
      padding:30px 26px 24px;
      background:linear-gradient(160deg,#121318 0%,#0D0E11 100%);
      border-bottom:1px solid var(--border);
      position:relative;overflow:hidden;
    }
    #aurum-prompt-hero::before{
      content:'';position:absolute;top:-50px;right:-50px;
      width:180px;height:180px;border-radius:50%;
      background:radial-gradient(circle,rgba(201,168,76,.1) 0%,transparent 70%);
      pointer-events:none;
    }
    #aurum-prompt-hero::after{
      content:'';position:absolute;bottom:-1px;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent,rgba(201,168,76,.4),transparent);
    }
    #aurum-prompt-eyebrow{
      font-size:10px;letter-spacing:.16em;text-transform:uppercase;
      color:var(--gold);font-weight:500;margin-bottom:10px;
      display:flex;align-items:center;gap:7px;
    }
    #aurum-prompt-eyebrow::before{
      content:'';display:inline-block;width:20px;height:1px;
      background:var(--gold);opacity:.5;
    }
    #aurum-prompt-title{
      font-family:'Playfair Display',serif;
      color:var(--text-hi);font-size:23px;font-weight:500;
      line-height:1.3;margin-bottom:9px;
    }
    #aurum-prompt-sub{
      font-size:13px;color:var(--text-mid);line-height:1.7;font-weight:300;
    }
    #aurum-prompt-form{
      padding:22px 22px 18px;
      display:flex;flex-direction:column;gap:13px;
      flex:1;
    }
    .aurum-field-group{display:flex;flex-direction:column;gap:6px;}
    .aurum-field-label{
      font-size:11px;color:var(--text-lo);
      letter-spacing:.09em;text-transform:uppercase;font-weight:500;
    }
    .aurum-field{
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      border-radius:var(--radius-sm);
      color:var(--text-hi);font-size:14px;
      padding:12px 16px;
      font-family:'Outfit',sans-serif;outline:none;
      transition:border-color .2s,box-shadow .2s;width:100%;
      letter-spacing:.012em;
    }
    .aurum-field:focus{
      border-color:rgba(201,168,76,.42);
      box-shadow:0 0 0 3px rgba(201,168,76,.07);
    }
    .aurum-field::placeholder{color:var(--text-lo);}
    .aurum-field.error{border-color:rgba(231,76,60,.6);box-shadow:0 0 0 3px rgba(231,76,60,.07);}

    #aurum-start-btn{
      background:linear-gradient(150deg,#DDB94E 0%,#C9A84C 50%,#9A7832 100%);
      color:#06070A;font-weight:600;font-size:14px;
      border:none;border-radius:var(--radius-sm);padding:14px;
      cursor:pointer;letter-spacing:.07em;text-transform:uppercase;
      transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,opacity .2s;
      box-shadow:0 6px 24px rgba(201,168,76,.38);
      font-family:'Outfit',sans-serif;margin-top:4px;
      position:relative;overflow:hidden;
    }
    #aurum-start-btn::after{
      content:'';position:absolute;inset:0;
      background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.18) 50%,transparent 100%);
      transform:translateX(-100%);
      transition:transform .5s ease;
    }
    #aurum-start-btn:hover::after{transform:translateX(100%);}
    #aurum-start-btn:hover{transform:translateY(-2px);box-shadow:0 12px 36px rgba(201,168,76,.55);}
    #aurum-start-btn:active{transform:translateY(0) scale(.98);}

    /* trust badges row */
    #aurum-trust{
      display:flex;align-items:center;justify-content:center;gap:18px;
      padding:2px 22px 20px;
    }
    .aurum-trust-item{
      display:flex;align-items:center;gap:5px;
      font-size:10.5px;color:var(--text-lo);letter-spacing:.04em;
    }
    .aurum-trust-item svg{width:12px;height:12px;color:rgba(201,168,76,.45);}

    /* ─── RESPONSIVE ─── */
    @media(max-width:480px){
      #aurum-window{width:calc(100vw - 20px);right:10px;bottom:102px;height:80vh;max-height:620px;border-radius:20px;}
      #aurum-toggle{bottom:22px;right:14px;}
    }
  `;
  document.head.appendChild(style);
})();

/* ─── MAIN INIT ─── */
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
  let pendingFile= null; // { file, dataUrl, name }

  /* ── BUILD DOM ── */
  const root = document.createElement("div");
  root.id = "aurum-chat-root";
  root.innerHTML = `
    <button id="aurum-toggle" aria-label="Open Aurum support chat">
      <div id="aurum-badge"></div>
      <svg class="icon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#06070A"/>
        <path d="M8 10h8M8 13h5" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <svg class="icon-close" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="#06070A" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>

    <div id="aurum-window" role="dialog" aria-label="Aurum live chat">

      <!-- HEADER -->
      <div id="aurum-header">
        <div id="aurum-header-avatar">
          <img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt="Support agent"/>
        </div>
        <div id="aurum-header-info">
          <div id="aurum-header-name">${AURUM_CHAT_CONFIG.brandName}</div>
          <div id="aurum-header-sub">${AURUM_CHAT_CONFIG.brandSubtitle}</div>
        </div>
        <div id="aurum-header-right">
          <div id="aurum-status-wrap">
            <div id="aurum-status-dot" title="Online"></div>
            <span id="aurum-status-label">Online</span>
          </div>
          <div id="aurum-response-time">Replies instantly</div>
        </div>
      </div>

      <!-- SESSION PROMPT -->
      <div id="aurum-session-prompt">
        <div id="aurum-prompt-hero">
          <div id="aurum-prompt-eyebrow">Premium Support</div>
          <div id="aurum-prompt-title">How can we help you today?</div>
          <div id="aurum-prompt-sub">${AURUM_CHAT_CONFIG.welcomeMsg}</div>
        </div>
        <div id="aurum-prompt-form">
          <div class="aurum-field-group">
            <label class="aurum-field-label" for="aurum-user-name">Your name</label>
            <input class="aurum-field" id="aurum-user-name" type="text" placeholder="Full name" autocomplete="name"/>
          </div>
          <div class="aurum-field-group">
            <label class="aurum-field-label" for="aurum-user-email">Email address <span style="opacity:.4;font-style:italic;text-transform:none;letter-spacing:0">(optional)</span></label>
            <input class="aurum-field" id="aurum-user-email" type="email" placeholder="you@example.com" autocomplete="email"/>
          </div>
          <button id="aurum-start-btn">Start Conversation</button>
        </div>
        <div id="aurum-trust">
          <div class="aurum-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Encrypted
          </div>
          <div class="aurum-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            24/7 Available
          </div>
          <div class="aurum-trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Verified Team
          </div>
        </div>
      </div>

      <!-- MESSAGES -->
      <div id="aurum-messages" style="display:none;">
        <div class="aurum-divider">Conversation started</div>
      </div>

      <!-- TYPING -->
      <div id="aurum-typing" class="aurum-msg agent" style="display:none;padding:0 16px 8px;gap:10px;align-items:flex-end;">
        <div class="aurum-msg-avatar">
          <img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>
        </div>
        <div class="aurum-typing-bubble">
          <span></span><span></span><span></span>
        </div>
      </div>

      <!-- INPUT AREA -->
      <div id="aurum-input-area" style="display:none;">
        <!-- image preview strip -->
        <div id="aurum-img-preview">
          <div id="aurum-img-thumb-wrap">
            <img id="aurum-img-thumb" src="" alt=""/>
            <button id="aurum-img-remove" aria-label="Remove image">✕</button>
          </div>
          <span id="aurum-img-preview-label"></span>
        </div>
        <!-- upload progress bar -->
        <div id="aurum-upload-progress"><div id="aurum-upload-bar"></div></div>
        <!-- input row -->
        <div id="aurum-input-row">
          <!-- hidden file picker -->
          <input type="file" id="aurum-file-input" accept="image/*,.pdf,.doc,.docx"/>
          <!-- attach button -->
          <button id="aurum-attach" aria-label="Attach image or file" title="Attach file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <div id="aurum-input-wrap">
            <textarea id="aurum-input" rows="1" placeholder="${AURUM_CHAT_CONFIG.placeholder}" aria-label="Message"></textarea>
          </div>
          <button id="aurum-send" aria-label="Send message">
            <!-- send arrow -->
            <svg class="send-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" fill="#06070A"/>
            </svg>
            <!-- spinner (shown while uploading) -->
            <svg class="send-spinner" width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(6,7,10,.3)" stroke-width="3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="#06070A" stroke-width="3" stroke-linecap="round"/>
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

  /* ── TOGGLE ── */
  toggleBtn.addEventListener("click", () => {
    isOpen = !isOpen;
    toggleBtn.classList.toggle("open", isOpen);
    chatWindow.classList.toggle("visible", isOpen);
    if (isOpen) clearUnread();
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
      subject:   `[Aurum Chat] New session from ${name}`,
      userName:  name,
      userEmail: userInfo.email || "Not provided",
      message:   `New live chat session started.\nPage: ${window.location.href}`,
      sessionId,
    });

    appendMessage({ role: "agent", text: `Hello ${name}! ${AURUM_CHAT_CONFIG.welcomeMsg}`, time: nowTime() });
    input.focus();
  });

  nameField.addEventListener("keydown", e => { if (e.key === "Enter") startBtn.click(); });

  /* ── AUTO RESIZE TEXTAREA ── */
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener("click", sendMessage);

  /* ── FILE ATTACH ── */
  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    /* validate size (10 MB cap) */
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Please choose a file under 10 MB.");
      fileInput.value = "";
      return;
    }

    pendingFile = { file, name: file.name };

    /* show preview for images */
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => {
        pendingFile.dataUrl = e.target.result;
        imgThumb.src = e.target.result;
        imgThumb.style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      imgThumb.style.display = "none";
    }

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
    imgThumb.src = "";
    imgLabel.textContent = "";
  }

  /* ── CREATE SESSION ── */
  async function createSession() {
    await sb.from("chat_sessions").insert({
      id:         sessionId,
      user_name:  userInfo.name,
      user_email: userInfo.email || null,
      page_url:   window.location.href,
      status:     "open",
    });
  }

  /* ── SEND ── */
  async function sendMessage() {
    const text = input.value.trim();
    if ((!text && !pendingFile) || !sessionId) return;

    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;

    /* ─ handle file upload ─ */
    let imageUrl = null;
    if (pendingFile) {
      const file = pendingFile.file;
      const isImg = file.type.startsWith("image/");

      sendBtn.classList.add("uploading");
      uploadProgress.classList.add("active");
      uploadBar.style.width = "20%";

      try {
        /* Simulate progress while XHR runs */
        let prog = 20;
        const ticker = setInterval(() => {
          prog = Math.min(prog + 12, 88);
          uploadBar.style.width = prog + "%";
        }, 200);

        const fileName = `${sessionId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { data: upData, error: upErr } = await sb.storage
          .from(AURUM_CHAT_CONFIG.storageBucket)
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        clearInterval(ticker);

        if (upErr) throw upErr;

        /* get public URL */
        const { data: urlData } = sb.storage
          .from(AURUM_CHAT_CONFIG.storageBucket)
          .getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl || null;

        uploadBar.style.width = "100%";

        /* show optimistic image bubble */
        if (isImg) {
          appendImageMessage({ role: "user", src: pendingFile.dataUrl || imageUrl, fileName: file.name, time: nowTime() });
        } else {
          appendFileLinkMessage({ role: "user", url: imageUrl, fileName: file.name, time: nowTime() });
        }

      } catch (err) {
        console.warn("[Aurum] Upload failed:", err.message);
        /* fallback: show local preview if we have it, or note the failure */
        if (pendingFile.dataUrl) {
          appendImageMessage({ role: "user", src: pendingFile.dataUrl, fileName: file.name, time: nowTime(), failed: true });
        } else {
          appendMessage({ role: "user", text: `📎 ${file.name} (upload failed)`, time: nowTime() });
        }
      } finally {
        sendBtn.classList.remove("uploading");
        setTimeout(() => {
          uploadProgress.classList.remove("active");
          uploadBar.style.width = "0%";
        }, 600);
        clearPendingFile();
      }
    }

    /* ─ text message ─ */
    if (text) {
      appendMessage({ role: "user", text, time: nowTime() });
    }

    /* ─ persist to DB ─ */
    const msgPayload = {
      session_id:  sessionId,
      sender_role: "user",
      sender_name: userInfo.name,
      message:     text || (pendingFile?.name ? `[Attachment: ${pendingFile?.name || "file"}]` : ""),
      image_url:   imageUrl || null,
    };
    await sb.from("chat_messages").insert(msgPayload);

    /* ─ notify admin ─ */
    notifyAdmin({
      subject:   `[Aurum Chat] Message from ${userInfo.name}`,
      userName:  userInfo.name,
      userEmail: userInfo.email || "Not provided",
      message:   text || `[Image/File attached]${imageUrl ? `: ${imageUrl}` : ""}`,
      sessionId,
      pageUrl:   window.location.href,
    });

    sendBtn.disabled = false;
    input.focus();
  }

  /* ── NOTIFY ADMIN ── */
  async function notifyAdmin({ subject, userName, userEmail, message, sessionId, pageUrl }) {
    try {
      await fetch(NOTIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${AURUM_CHAT_CONFIG.supabaseKey}`,
        },
        body: JSON.stringify({
          formType:   "live_chat_message",
          adminEmail: AURUM_CHAT_CONFIG.adminEmail,
          subject, name: userName, email: userEmail,
          message, sessionId,
          pageUrl: pageUrl || window.location.href,
        }),
      });
    } catch (e) {
      console.warn("[Aurum] Notification failed:", e.message);
    }
  }

  /* ── REALTIME ── */
  function subscribeRealtime() {
    channel = sb.channel(`chat_${sessionId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "chat_messages",
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const row = payload.new;
        if (row.sender_role === "agent") {
          hideTyping();
          if (row.image_url) {
            appendImageMessage({ role: "agent", src: row.image_url, fileName: "Attachment", time: formatTime(row.created_at) });
          } else {
            appendMessage({ role: "agent", text: row.message, time: formatTime(row.created_at) });
          }
          if (!isOpen) showUnread();
        }
      })
      .subscribe();
  }

  /* ── APPEND TEXT MESSAGE ── */
  function appendMessage({ role, text, time }) {
    const isUser  = role === "user";
    const grouped = (lastSender === role);
    lastSender    = role;

    const div = document.createElement("div");
    div.className = `aurum-msg ${isUser ? "user" : "agent"}${grouped ? " grouped" : ""}`;

    const initials   = userInfo.name ? userInfo.name[0].toUpperCase() : "U";
    const avatarHtml = isUser
      ? `<span>${initials}</span>`
      : `<img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>`;

    const readTickHtml = isUser ? `
      <div class="aurum-read-tick">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
          <polyline points="16 6 9 13"/>
        </svg>
      </div>` : "";

    div.innerHTML = `
      <div class="aurum-msg-avatar">${avatarHtml}</div>
      <div class="aurum-msg-body">
        <div class="aurum-bubble">${escHtml(text)}</div>
        <div class="aurum-msg-meta">
          <span class="aurum-msg-time">${time}</span>
          ${readTickHtml}
        </div>
      </div>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ── APPEND IMAGE MESSAGE ── */
  function appendImageMessage({ role, src, fileName, time, failed }) {
    const isUser  = role === "user";
    const grouped = (lastSender === role);
    lastSender    = role;

    const div = document.createElement("div");
    div.className = `aurum-msg ${isUser ? "user" : "agent"}${grouped ? " grouped" : ""}`;

    const initials   = userInfo.name ? userInfo.name[0].toUpperCase() : "U";
    const avatarHtml = isUser
      ? `<span>${initials}</span>`
      : `<img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>`;

    const readTickHtml = isUser ? `
      <div class="aurum-read-tick">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
          <polyline points="16 6 9 13"/>
        </svg>
      </div>` : "";

    const failedNote = failed ? `<span class="aurum-img-caption" style="color:rgba(231,76,60,.7);">Upload may have failed</span>` : "";

    div.innerHTML = `
      <div class="aurum-msg-avatar">${avatarHtml}</div>
      <div class="aurum-msg-body">
        <div class="aurum-img-bubble" onclick="window.open('${escHtml(src)}','_blank')">
          <img src="${escHtml(src)}" alt="${escHtml(fileName)}" loading="lazy"/>
          ${failedNote}
        </div>
        <div class="aurum-msg-meta">
          <span class="aurum-msg-time">${time}</span>
          ${readTickHtml}
        </div>
      </div>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ── APPEND FILE LINK MESSAGE ── */
  function appendFileLinkMessage({ role, url, fileName, time }) {
    const isUser = role === "user";
    /* show as a text bubble with a link */
    const grouped = (lastSender === role);
    lastSender = role;

    const div = document.createElement("div");
    div.className = `aurum-msg ${isUser ? "user" : "agent"}${grouped ? " grouped" : ""}`;

    const initials   = userInfo.name ? userInfo.name[0].toUpperCase() : "U";
    const avatarHtml = isUser
      ? `<span>${initials}</span>`
      : `<img src="${AURUM_CHAT_CONFIG.agentAvatar}" alt=""/>`;

    div.innerHTML = `
      <div class="aurum-msg-avatar">${avatarHtml}</div>
      <div class="aurum-msg-body">
        <div class="aurum-bubble" style="display:flex;align-items:center;gap:10px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.7">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <a href="${escHtml(url)}" target="_blank" style="color:inherit;text-decoration:underline;text-underline-offset:3px;opacity:.8;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${escHtml(fileName)}</a>
        </div>
        <div class="aurum-msg-meta">
          <span class="aurum-msg-time">${time}</span>
        </div>
      </div>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /* ── HELPERS ── */
  function hideTyping() {
    typingEl.classList.remove("show");
    typingEl.style.display = "none";
  }

  function showUnread() {
    unread++;
    badge.textContent = unread > 9 ? "9+" : unread;
    badge.classList.add("show");
  }
  function clearUnread() { unread = 0; badge.classList.remove("show"); }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function formatTime(ts) {
    if (!ts) return nowTime();
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function escHtml(s) {
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/\n/g,"<br>");
  }
}
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
  notifyEndpoint: null,
  storageBucket:  "chat-images",
};

(function () {
  if (document.getElementById("aurum-chat-root")) return;

  const sdkScript = document.createElement("script");
  sdkScript.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
  sdkScript.onload = initAurumChat;
  document.head.appendChild(sdkScript);

  // Fonts come from the page (app.css); the widget no longer downloads its own.
  const style = document.createElement("style");
  style.textContent = `
    /* Support chat — app design (tokens from app.css; light fallbacks for pages without it) */
    #aurum-chat-root{--c-bg:var(--bg,#ECE8E1);--c-well:var(--well,#E7E2DA);--c-ink:var(--ink,#1E1B16);--c-muted:var(--muted,#5B5448);--c-line:var(--line,#DDD6C9);
      --c-gold:var(--gold,#C29A45);--c-on-gold:var(--on-gold,#241A05);--c-gold-ink:var(--gold-ink,#6E5314);--c-up:var(--up,#22603A);--c-down:var(--down,#A3261C);
      --c-raise:var(--raise,7px 7px 16px #CEC7B9,-7px -7px 16px #FFFFFF);--c-raise-sm:var(--raise-sm,4px 4px 10px #D0C9BC,-4px -4px 10px #FFFFFF);
      --c-press:var(--press-sm,inset 3px 3px 7px #D1CABD,inset -3px -3px 7px #FFFFFF);--c-btn:var(--shadow-btn,6px 6px 14px #CDBF9F,-6px -6px 14px #FFFFFF);
      font-family:var(--sans,"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif);color:var(--c-ink);-webkit-font-smoothing:antialiased}
    #aurum-chat-root *{box-sizing:border-box;margin:0;padding:0}
    #aurum-chat-root button{font:inherit;border:0;cursor:pointer;color:inherit;background:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}

    /* launcher: gold, above the floating bottom nav when the page has one */
    #aurum-toggle{position:fixed;right:18px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:9998;width:56px;height:56px;border-radius:18px;background:var(--c-gold)!important;color:var(--c-on-gold);box-shadow:var(--c-btn);display:flex;align-items:center;justify-content:center}
    body:has(.nav) #aurum-toggle{bottom:calc(104px + env(safe-area-inset-bottom))}
    #aurum-toggle:active{box-shadow:inset 3px 3px 8px var(--gold-lo,#9E7C33),inset -2px -2px 6px var(--gold-hi,#D9B565)}
    #aurum-toggle .aur-tog-frame{display:flex;align-items:center;justify-content:center}
    #aurum-toggle .aur-arc-1,#aurum-toggle .aur-arc-2,#aurum-toggle .aur-d1,#aurum-toggle .aur-d2,#aurum-toggle circle{display:none}
    #aurum-toggle .aur-letter{stroke:var(--c-on-gold)}
    #aurum-toggle .icon-close{display:none}
    #aurum-toggle.open .aur-tog-frame{display:none}
    #aurum-toggle.open .icon-close{display:block}
    #aurum-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--c-down);color:#fff;font:600 11px/20px var(--mono,ui-monospace,monospace);text-align:center;display:none}
    #aurum-badge.show{display:block}

    /* window */
    #aurum-window{position:fixed;right:18px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:9999;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100dvh - 180px));border-radius:26px;background:var(--c-bg);box-shadow:var(--c-raise);display:none;flex-direction:column;overflow:hidden}
    body:has(.nav) #aurum-window{bottom:calc(172px + env(safe-area-inset-bottom));height:min(560px,calc(100dvh - 250px))}
    #aurum-window.visible{display:flex}
    @media (max-width:520px){#aurum-window{right:12px;left:12px;width:auto}}

    #aurum-header{display:flex;align-items:center;gap:12px;padding:14px 14px 12px 16px;border-bottom:1px solid var(--c-line);flex:none}
    #aurum-header-avatar{width:42px;height:42px;border-radius:14px;overflow:hidden;flex:none;background:var(--c-gold);box-shadow:var(--c-raise-sm)}
    #aurum-header-avatar img{width:100%;height:100%;object-fit:cover;display:block}
    #aurum-header-info{flex:1;min-width:0}
    #aurum-header-name{font:500 18px/1.2 var(--serif,"Playfair Display",Georgia,serif)}
    #aurum-header-sub{font-size:12px;color:var(--c-muted)}
    #aurum-header-right{display:flex;align-items:center;gap:10px}
    #aurum-status-wrap{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--c-up)}
    #aurum-status-dot{width:7px;height:7px;border-radius:4px;background:var(--ok,#2F7A4B)}
    #aurum-close-btn{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--c-gold-ink);background:var(--c-bg)!important;box-shadow:var(--c-raise-sm)}
    #aurum-close-btn svg{width:16px;height:16px}

    /* start screen */
    #aurum-session-prompt{flex:1;overflow-y:auto;padding:22px 18px 18px;display:flex;flex-direction:column;gap:18px}
    #aurum-prompt-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}
    #aurum-hero-emblem{width:56px;height:56px;border-radius:18px;background:var(--c-well);box-shadow:var(--c-press);display:flex;align-items:center;justify-content:center}
    #aurum-hero-wordmark{font:500 22px/1.2 var(--serif,"Playfair Display",Georgia,serif)}
    #aurum-hero-rule{display:none}
    #aurum-prompt-title{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--c-gold-ink);font-weight:500}
    #aurum-prompt-sub{font-size:13px;line-height:1.55;color:var(--c-muted);max-width:280px}
    #aurum-prompt-form{display:flex;flex-direction:column;gap:12px}
    .aurum-field-group{display:flex;flex-direction:column;gap:6px}
    .aurum-field-label{font-size:12px;font-weight:500;color:var(--c-ink)}
    .aurum-field{min-height:50px;border:0;border-radius:14px;padding:0 14px;font-size:15px;font-family:inherit;color:var(--c-ink);background:var(--c-well);box-shadow:var(--c-press);outline:none;width:100%}
    .aurum-field:focus{box-shadow:var(--c-press),0 0 0 2px var(--c-gold)}
    .aurum-field.error{box-shadow:var(--c-press),0 0 0 2px var(--c-down)}
    #aurum-start-btn{min-height:52px;border-radius:16px;background:var(--c-gold)!important;color:var(--c-on-gold);box-shadow:var(--c-btn);font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px}
    #aurum-start-btn:disabled{opacity:.6}
    .aurum-btn-arrow{display:flex}
    #aurum-trust{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
    .aurum-trust-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--c-muted)}
    .aurum-trust-item svg{width:13px;height:13px;color:var(--c-gold-ink)}

    /* conversation */
    #aurum-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}
    .aurum-divider{align-self:center;font:500 10px/1 var(--mono,ui-monospace,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--c-muted);padding:6px 0}
    .aurum-msg{display:flex;align-items:flex-end;gap:8px;max-width:88%}
    .aurum-msg.user{align-self:flex-end;flex-direction:row-reverse}
    .aurum-msg.grouped .aurum-msg-avatar{visibility:hidden}
    .aurum-msg-avatar{width:28px;height:28px;border-radius:9px;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;background:var(--c-gold);color:var(--c-on-gold);font-size:11px;font-weight:600}
    .aurum-msg-avatar img{width:100%;height:100%;object-fit:cover;display:block}
    .aurum-msg-body{min-width:0}
    .aurum-bubble{border-radius:16px;padding:9px 12px 7px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;background:var(--c-bg);box-shadow:var(--c-raise-sm)}
    .aurum-msg.agent .aurum-bubble{border-bottom-left-radius:6px}
    .aurum-msg.user .aurum-bubble{background:var(--c-gold);color:var(--c-on-gold);box-shadow:none;border-bottom-right-radius:6px}
    .aur-bubble-footer{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:3px}
    .aur-time{font:500 10px/1 var(--mono,ui-monospace,monospace);opacity:.65}
    .aur-read-tick svg{width:13px;height:13px;opacity:.7}
    .aurum-img-bubble{border-radius:14px;overflow:hidden;cursor:pointer;max-width:220px;box-shadow:var(--c-raise-sm)}
    .aurum-img-bubble img{display:block;width:100%;height:auto}
    .aurum-img-caption{display:block;padding:6px 10px;font-size:11px}
    #aurum-typing{padding:0 14px 8px;align-items:flex-end;gap:8px}
    #aurum-typing.show{display:flex!important}
    .aurum-typing-bubble{display:flex;gap:4px;padding:12px 14px;border-radius:16px;background:var(--c-bg);box-shadow:var(--c-raise-sm)}
    .aurum-typing-bubble span{width:6px;height:6px;border-radius:3px;background:var(--c-muted);opacity:.5;animation:aurDot 1s infinite alternate}
    .aurum-typing-bubble span:nth-child(2){animation-delay:.2s}
    .aurum-typing-bubble span:nth-child(3){animation-delay:.4s}
    @keyframes aurDot{to{opacity:1}}

    /* composer */
    #aurum-input-area{flex:none;border-top:1px solid var(--c-line);padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
    #aurum-img-preview{display:none;align-items:center;gap:10px;padding:0 4px 8px}
    #aurum-img-preview.has-image{display:flex}
    #aurum-img-thumb-wrap{position:relative;width:48px;height:48px;border-radius:12px;overflow:hidden;box-shadow:var(--c-raise-sm)}
    #aurum-img-thumb{width:100%;height:100%;object-fit:cover}
    #aurum-img-remove{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:9px;background:rgba(0,0,0,.55)!important;color:#fff;font-size:10px}
    #aurum-img-preview-label{font-size:12px;color:var(--c-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #aurum-upload-progress{height:2px;border-radius:1px;background:var(--c-line);margin:0 4px 8px;display:none;overflow:hidden}
    #aurum-upload-progress.active{display:block}
    #aurum-upload-bar{height:100%;width:0;background:var(--c-gold);transition:width .3s}
    #aurum-input-row{display:flex;align-items:flex-end;gap:8px}
    #aurum-file-input{display:none}
    #aurum-attach{width:42px;height:42px;flex:none;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--c-gold-ink);background:var(--c-bg)!important;box-shadow:var(--c-raise-sm)}
    #aurum-attach.has-image{color:var(--c-up)}
    #aurum-attach svg{width:18px;height:18px}
    #aurum-input-wrap{flex:1;min-width:0;border-radius:14px;background:var(--c-well);box-shadow:var(--c-press);padding:0 12px;display:flex}
    #aurum-input{flex:1;border:0;outline:none;background:transparent;resize:none;font-size:15px;line-height:1.4;font-family:inherit;color:var(--c-ink);padding:11px 0;max-height:120px}
    #aurum-input::placeholder{color:var(--placeholder,#7A7264)}
    #aurum-send{width:42px;height:42px;flex:none;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--c-gold)!important;box-shadow:var(--c-btn)}
    #aurum-send:disabled{opacity:.55}
    #aurum-send .send-spinner{display:none;animation:aurSpin .8s linear infinite}
    #aurum-send.uploading .send-icon{display:none}
    #aurum-send.uploading .send-spinner{display:block}
    @keyframes aurSpin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){#aurum-chat-root *{animation:none!important;transition:none!important}}
    @supports (-webkit-touch-callout:none){#aurum-chat-root input,#aurum-chat-root textarea{font-size:16px!important}}

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
    // Unguessable: the session id is the visitor's only key to read replies
    sessionId = `session_${newUuid()}`;
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
          subject, name: userName, email: userEmail,
          message, sessionId, pageUrl: pageUrl || window.location.href,
        }),
      });
    } catch (e) { console.warn("[Aurum] Notification failed:", e.message); }
  }

  function newUuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  }

  // Visitors can't read chat tables (RLS). Replies arrive two ways:
  //  1. instantly, as a Realtime broadcast the admin console sends on chat_<id>
  //  2. as a catch-up via chat_agent_replies() on connect, on refocus and every 20s
  //     while the tab is visible — so nothing is missed if the socket dropped.
  const seenReplies = new Set();
  let lastReplyAt = null;
  let catchUpTimer = null;

  function showAgentReply(row) {
    if (!row || seenReplies.has(String(row.id))) return;
    seenReplies.add(String(row.id));
    if (!lastReplyAt || row.created_at > lastReplyAt) lastReplyAt = row.created_at;
    hideTyping();
    if (row.image_url) appendImageMessage({ role: "agent", src: row.image_url, fileName: "Attachment", time: formatTime(row.created_at) });
    else appendMessage({ role: "agent", text: row.message, time: formatTime(row.created_at) });
    if (!isOpen) showUnread();
  }

  async function catchUpReplies() {
    if (!sessionId || document.visibilityState === "hidden") return;
    const { data, error } = await sb.rpc("chat_agent_replies", { p_session_id: sessionId, p_after: lastReplyAt });
    if (!error && Array.isArray(data)) data.forEach(showAgentReply);
  }

  function subscribeRealtime() {
    channel = sb.channel(`chat_${sessionId}`)
      .on("broadcast", { event: "agent_msg" }, ({ payload }) => showAgentReply(payload))
      .subscribe(status => { if (status === "SUBSCRIBED") catchUpReplies(); });
    clearInterval(catchUpTimer);
    catchUpTimer = setInterval(catchUpReplies, 20000);
    document.addEventListener("visibilitychange", catchUpReplies);
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

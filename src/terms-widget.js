/**
 * terms-widget.js
 * Drop this on ANY page with:  <script src="terms-widget.js"></script>
 * It auto-injects a sticky "Terms" pill + full-screen modal.
 */
(function () {
  /* ── Styles ─────────────────────────────────────────────────── */
  const css = `
  #ac-terms-pill{
    position:fixed;bottom:22px;right:22px;z-index:8888;
    display:flex;align-items:center;gap:8px;
    padding:9px 16px;border-radius:50px;
    background:rgba(12,17,24,.88);
    border:1px solid rgba(201,168,76,.28);
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    box-shadow:0 4px 24px rgba(0,0,0,.55),0 0 0 1px rgba(201,168,76,.08);
    cursor:pointer;
    font-family:'DM Sans',system-ui,sans-serif;
    font-size:.78rem;font-weight:500;color:#c4d0e0;
    transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;
    user-select:none;
  }
  #ac-terms-pill:hover{
    transform:translateY(-2px);
    border-color:rgba(201,168,76,.55);
    box-shadow:0 8px 32px rgba(0,0,0,.6),0 0 0 1px rgba(201,168,76,.18);
    color:#edf2f8;
  }
  #ac-terms-pill svg{flex-shrink:0;opacity:.75;}

  #ac-terms-overlay{
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:flex-end;justify-content:center;
    background:rgba(4,6,8,.82);
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
    opacity:0;visibility:hidden;
    transition:opacity .3s ease,visibility .3s ease;
    padding:0;
  }
  #ac-terms-overlay.ac-open{opacity:1;visibility:visible;}
  #ac-terms-overlay.ac-open #ac-terms-sheet{transform:translateY(0);}

  #ac-terms-sheet{
    width:100%;max-width:760px;max-height:88vh;
    background:#0c1118;
    border-radius:22px 22px 0 0;
    border:1px solid rgba(255,255,255,.08);
    border-bottom:none;
    box-shadow:0 -16px 80px rgba(0,0,0,.7);
    display:flex;flex-direction:column;
    transform:translateY(100%);
    transition:transform .38s cubic-bezier(.16,1,.3,1);
    overflow:hidden;
    font-family:'DM Sans',system-ui,sans-serif;
  }

  #ac-terms-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:22px 28px 18px;
    border-bottom:1px solid rgba(255,255,255,.07);
    flex-shrink:0;
  }
  .ac-hd-left{display:flex;align-items:center;gap:12px;}
  .ac-logo-dot{
    width:36px;height:36px;border-radius:10px;
    background:linear-gradient(135deg,#c9a84c,#a87c28);
    display:flex;align-items:center;justify-content:center;
    font-weight:700;font-family:'JetBrains Mono',monospace;
    font-size:.88rem;color:#040608;flex-shrink:0;
  }
  .ac-hd-title{
    font-family:'Cormorant Garamond','Georgia',serif;
    font-size:1.35rem;font-weight:400;color:#edf2f8;line-height:1.1;
  }
  .ac-hd-sub{font-size:.72rem;color:#5a6880;margin-top:2px;letter-spacing:.04em;}
  #ac-terms-close{
    background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
    border-radius:50%;width:32px;height:32px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;color:#8c9db5;transition:all .18s;flex-shrink:0;
  }
  #ac-terms-close:hover{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#ef4444;}

  #ac-terms-tabs{
    display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.07);
    padding:0 28px;flex-shrink:0;overflow-x:auto;
  }
  .ac-tab{
    padding:12px 16px;font-size:.8rem;font-weight:500;color:#5a6880;
    cursor:pointer;border:none;background:none;
    border-bottom:2px solid transparent;margin-bottom:-1px;
    transition:color .18s;white-space:nowrap;
  }
  .ac-tab.ac-active{color:#c9a84c;border-bottom-color:#c9a84c;}
  .ac-tab:hover:not(.ac-active){color:#c4d0e0;}

  #ac-terms-body{
    overflow-y:auto;padding:28px;flex:1;
    scrollbar-width:thin;scrollbar-color:#172030 transparent;
  }
  #ac-terms-body::-webkit-scrollbar{width:5px;}
  #ac-terms-body::-webkit-scrollbar-track{background:transparent;}
  #ac-terms-body::-webkit-scrollbar-thumb{background:#172030;border-radius:3px;}

  .ac-section{display:none;}
  .ac-section.ac-visible{display:block;}

  .ac-effective{
    display:inline-flex;align-items:center;gap:6px;
    padding:5px 12px;border-radius:20px;margin-bottom:20px;
    background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);
    font-size:.72rem;font-family:'JetBrains Mono',monospace;color:#c9a84c;letter-spacing:.06em;
  }
  .ac-h2{
    font-family:'Cormorant Garamond','Georgia',serif;
    font-size:1.15rem;font-weight:500;color:#edf2f8;
    margin:24px 0 8px;padding-bottom:8px;
    border-bottom:1px solid rgba(255,255,255,.06);
  }
  .ac-h2:first-of-type{margin-top:0;}
  .ac-p{font-size:.84rem;color:#8c9db5;line-height:1.75;margin-bottom:10px;}
  .ac-ul{list-style:none;padding:0;margin:0 0 14px;}
  .ac-ul li{
    font-size:.83rem;color:#8c9db5;line-height:1.65;
    padding:4px 0 4px 18px;position:relative;
  }
  .ac-ul li::before{
    content:'';position:absolute;left:4px;top:12px;
    width:5px;height:5px;border-radius:50%;background:#c9a84c;opacity:.6;
  }
  .ac-highlight{
    display:flex;gap:12px;align-items:flex-start;
    background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.15);
    border-radius:12px;padding:14px 16px;margin:14px 0;
  }
  .ac-highlight svg{flex-shrink:0;margin-top:2px;}
  .ac-highlight p{font-size:.82rem;color:#c4d0e0;line-height:1.65;margin:0;}

  #ac-terms-footer{
    padding:16px 28px;border-top:1px solid rgba(255,255,255,.07);
    display:flex;align-items:center;justify-content:space-between;
    flex-shrink:0;gap:12px;flex-wrap:wrap;
  }
  .ac-footer-note{font-size:.75rem;color:#5a6880;}
  .ac-accept-btn{
    padding:10px 22px;border-radius:10px;border:none;cursor:pointer;
    background:linear-gradient(135deg,#c9a84c,#a87c28);
    color:#040608;font-weight:600;font-size:.84rem;
    transition:all .18s;white-space:nowrap;
  }
  .ac-accept-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(201,168,76,.3);}

  @media(max-width:480px){
    #ac-terms-header{padding:18px 20px 14px;}
    #ac-terms-tabs{padding:0 20px;}
    #ac-terms-body{padding:20px;}
    #ac-terms-footer{padding:14px 20px;}
    .ac-hd-title{font-size:1.15rem;}
  }
  `;

  /* ── HTML ───────────────────────────────────────────────────── */
  const html = `
  <button id="ac-terms-pill" aria-label="View Terms of Service">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/><line x1="9" y1="9" x2="15" y2="9"/>
      <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
    </svg>
    Terms & Privacy
  </button>

  <div id="ac-terms-overlay" role="dialog" aria-modal="true" aria-label="Terms of Service">
    <div id="ac-terms-sheet">

      <div id="ac-terms-header">
        <div class="ac-hd-left">
          <div class="ac-logo-dot">A</div>
          <div>
            <div class="ac-hd-title">Aurum Capital Legal</div>
            <div class="ac-hd-sub">Terms of Service &amp; Privacy Policy</div>
          </div>
        </div>
        <button id="ac-terms-close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div id="ac-terms-tabs">
        <button class="ac-tab ac-active" data-tab="tos">Terms of Service</button>
        <button class="ac-tab" data-tab="privacy">Privacy Policy</button>
        <button class="ac-tab" data-tab="trading">Trading Rules</button>
        <button class="ac-tab" data-tab="risk">Risk Disclosure</button>
      </div>

      <div id="ac-terms-body">

        <!-- TERMS OF SERVICE -->
        <div class="ac-section ac-visible" data-section="tos">
          <div class="ac-effective">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Effective: 1 June 2025 · Version 3.1
          </div>

          <h3 class="ac-h2">1. Acceptance of Terms</h3>
          <p class="ac-p">By accessing or using Aurum Capital's platform, website, or mobile applications (collectively, "the Platform"), you confirm that you have read, understood, and agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree, you must cease using the Platform immediately.</p>
          <p class="ac-p">These Terms constitute a legally binding agreement between you ("User") and Aurum Capital Ltd. ("Aurum", "we", "us", "our"), a company incorporated under applicable financial regulatory frameworks.</p>

          <h3 class="ac-h2">2. Eligibility</h3>
          <ul class="ac-ul">
            <li>You must be at least 18 years of age (or the age of majority in your jurisdiction)</li>
            <li>You must have full legal capacity to enter into binding agreements</li>
            <li>You must not be a resident of a jurisdiction where our services are prohibited</li>
            <li>Corporate accounts require authorized signatory confirmation</li>
          </ul>

          <div class="ac-highlight">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p>Providing false information during registration is a material breach of these Terms and may result in immediate account suspension, forfeiture of funds, and referral to relevant authorities.</p>
          </div>

          <h3 class="ac-h2">3. Account Registration & Security</h3>
          <p class="ac-p">You are solely responsible for maintaining the confidentiality of your account credentials. Aurum Capital will never request your password via email, phone, or chat. You agree to notify us immediately upon discovering any unauthorized access to your account.</p>
          <p class="ac-p">Each individual may hold only one personal account. Multi-account operation for the purpose of exploiting promotional offers constitutes fraud.</p>

          <h3 class="ac-h2">4. Welcome Balance & Promotions</h3>
          <p class="ac-p">The $20 welcome balance awarded upon account creation is subject to the following conditions:</p>
          <ul class="ac-ul">
            <li>Funds may be used for trading activities across all supported asset classes</li>
            <li>Profits derived from the welcome balance may be withdrawn subject to standard KYC verification</li>
            <li>The welcome balance itself is non-withdrawable and expires after 90 days of account inactivity</li>
            <li>Aurum reserves the right to revoke promotional balances if abuse is detected</li>
          </ul>

          <h3 class="ac-h2">5. Fees & Charges</h3>
          <p class="ac-p">Aurum Capital charges a 0.1% trading fee on all executed orders. Additional fees may apply for:</p>
          <ul class="ac-ul">
            <li>Overnight financing on leveraged positions (variable, published daily)</li>
            <li>Fiat withdrawals below the minimum threshold ($10 equivalent)</li>
            <li>Expedited processing requests</li>
            <li>Inactive account maintenance after 12 months of zero activity ($2/month)</li>
          </ul>

          <h3 class="ac-h2">6. Intellectual Property</h3>
          <p class="ac-p">All content, technology, and branding on the Platform is the exclusive property of Aurum Capital Ltd. or its licensors. You are granted a limited, non-exclusive, non-transferable licence to access the Platform for personal, non-commercial use. Reproduction, distribution, or creation of derivative works without written consent is strictly prohibited.</p>

          <h3 class="ac-h2">7. Limitation of Liability</h3>
          <p class="ac-p">To the fullest extent permitted by applicable law, Aurum Capital shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform, including but not limited to trading losses, data loss, or service interruptions.</p>

          <h3 class="ac-h2">8. Governing Law</h3>
          <p class="ac-p">These Terms shall be governed by and construed in accordance with the laws of the applicable jurisdiction as indicated in your account registration. Disputes shall be subject to binding arbitration before the relevant financial arbitration body.</p>

          <h3 class="ac-h2">9. Amendments</h3>
          <p class="ac-p">Aurum Capital reserves the right to amend these Terms at any time. Material changes will be communicated via email and platform notification with a minimum 14-day notice period. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.</p>
        </div>

        <!-- PRIVACY POLICY -->
        <div class="ac-section" data-section="privacy">
          <div class="ac-effective">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Effective: 1 June 2025 · GDPR & CCPA Compliant
          </div>

          <h3 class="ac-h2">1. Data We Collect</h3>
          <p class="ac-p">We collect information you provide directly (name, email, phone, government ID for KYC), data generated through your use of the Platform (transaction history, device fingerprints, IP addresses), and data from third-party sources (credit bureaus, sanctions screening databases).</p>

          <h3 class="ac-h2">2. How We Use Your Data</h3>
          <ul class="ac-ul">
            <li>Account creation, authentication, and security monitoring</li>
            <li>KYC/AML compliance and regulatory reporting obligations</li>
            <li>Order execution, settlement, and portfolio management</li>
            <li>Fraud detection and risk management</li>
            <li>Personalised product recommendations and marketing (opt-out available)</li>
            <li>Platform improvement and analytics</li>
          </ul>

          <h3 class="ac-h2">3. Data Sharing</h3>
          <p class="ac-p">We do not sell your personal data. We may share data with regulated financial partners, custody providers, payment processors, and government/regulatory authorities when legally required. All third-party processors are contractually bound to equivalent data protection standards.</p>

          <h3 class="ac-h2">4. Your Rights</h3>
          <ul class="ac-ul">
            <li>Right to access: request a copy of your personal data</li>
            <li>Right to rectification: correct inaccurate information</li>
            <li>Right to erasure: subject to regulatory retention requirements</li>
            <li>Right to data portability: receive your data in a machine-readable format</li>
            <li>Right to object to marketing communications at any time</li>
          </ul>

          <h3 class="ac-h2">5. Data Retention</h3>
          <p class="ac-p">We retain account data for a minimum of 7 years following account closure to satisfy anti-money laundering regulatory requirements. Trading records are kept indefinitely for compliance purposes.</p>

          <h3 class="ac-h2">6. Security</h3>
          <p class="ac-p">We employ 256-bit AES encryption at rest, TLS 1.3 in transit, multi-factor authentication, and regular third-party penetration testing. Despite these measures, no system is fully immune to breach; we commit to notifying affected users within 72 hours of discovering a material data incident.</p>
        </div>

        <!-- TRADING RULES -->
        <div class="ac-section" data-section="trading">
          <div class="ac-effective">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Effective: 1 June 2025
          </div>

          <h3 class="ac-h2">1. Order Execution</h3>
          <p class="ac-p">Aurum Capital uses best-execution practices across all supported asset classes. Market orders are executed at the best available price at time of processing. Limit orders are queued and filled when the market price reaches the specified level.</p>

          <h3 class="ac-h2">2. Prohibited Trading Conduct</h3>
          <ul class="ac-ul">
            <li>Wash trading or circular trading to create artificial volume</li>
            <li>Spoofing, layering, or placing orders with no intent to execute</li>
            <li>Trading on material non-public information (insider trading)</li>
            <li>Use of automated bots without prior written approval</li>
            <li>Cross-account manipulation involving related parties</li>
          </ul>

          <div class="ac-highlight">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p>Violation of trading rules may result in immediate position closure, account suspension, and recovery of any profits deemed to have been gained through prohibited conduct.</p>
          </div>

          <h3 class="ac-h2">3. Leverage & Margin</h3>
          <p class="ac-p">Leveraged products are available to verified accounts only. Maximum leverage varies by asset class and jurisdiction. Margin calls are issued when account equity falls below 50% of required margin. Positions may be liquidated automatically at 25% margin level without further notice.</p>

          <h3 class="ac-h2">4. Settlement</h3>
          <p class="ac-p">Crypto assets settle instantly on-chain or internally. Equity trades settle T+2 in line with standard market practice. Tokenized real estate positions settle T+5. Aurum Capital reserves the right to extend settlement periods during periods of extreme market volatility.</p>
        </div>

        <!-- RISK DISCLOSURE -->
        <div class="ac-section" data-section="risk">
          <div class="ac-effective">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Important — Please Read Carefully
          </div>

          <div class="ac-highlight" style="border-color:rgba(239,68,68,.25);background:rgba(239,68,68,.05);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p style="color:#fca5a5;">Trading financial instruments involves substantial risk of loss and is not suitable for all investors. You may lose some or all of your invested capital. Past performance is not indicative of future results.</p>
          </div>

          <h3 class="ac-h2">Market Risk</h3>
          <p class="ac-p">Asset prices can fall as well as rise. Cryptocurrency markets are particularly volatile and can move dramatically within seconds. Equity markets are subject to systemic risks including economic downturns, geopolitical events, and corporate actions.</p>

          <h3 class="ac-h2">Liquidity Risk</h3>
          <p class="ac-p">During periods of extreme market stress, it may not be possible to close or adjust positions at desired prices. Tokenized real estate assets may have longer settlement periods and limited secondary market liquidity.</p>

          <h3 class="ac-h2">Leverage Risk</h3>
          <p class="ac-p">Trading on margin amplifies both gains and losses. A small adverse price movement can result in losses significantly exceeding your initial deposit. You should never trade with leverage unless you fully understand the mechanics and risks involved.</p>

          <h3 class="ac-h2">Technology Risk</h3>
          <p class="ac-p">System outages, cyberattacks, or connectivity failures may prevent you from accessing your account or executing trades at critical moments. Aurum Capital maintains business continuity infrastructure but cannot guarantee uninterrupted service.</p>

          <h3 class="ac-h2">Regulatory Risk</h3>
          <p class="ac-p">The regulatory environment for digital assets is evolving rapidly. Changes in law or regulation could adversely affect the value, legality, or availability of certain assets or services on the Platform.</p>
        </div>

      </div><!-- /body -->

      <div id="ac-terms-footer">
        <span class="ac-footer-note">Questions? <a href="mailto:legal@aurumcapital.com" style="color:#c9a84c;text-decoration:none;">legal@aurumcapital.com</a></span>
        <button class="ac-accept-btn" id="ac-accept-btn">I Understand &amp; Accept</button>
      </div>

    </div>
  </div>
  `;

  /* ── Inject ─────────────────────────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  /* ── Logic ──────────────────────────────────────────────────── */
  const pill    = document.getElementById('ac-terms-pill');
  const overlay = document.getElementById('ac-terms-overlay');
  const closeBtn = document.getElementById('ac-terms-close');
  const acceptBtn = document.getElementById('ac-accept-btn');
  const tabs    = document.querySelectorAll('.ac-tab');
  const sections = document.querySelectorAll('.ac-section');

  function openModal(tabName) {
    if (tabName) switchTab(tabName);
    overlay.classList.add('ac-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('ac-open');
    document.body.style.overflow = '';
  }

  function switchTab(name) {
    tabs.forEach(t => t.classList.toggle('ac-active', t.dataset.tab === name));
    sections.forEach(s => s.classList.toggle('ac-visible', s.dataset.section === name));
    document.getElementById('ac-terms-body').scrollTop = 0;
  }

  pill.addEventListener('click', () => openModal('tos'));
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  acceptBtn.addEventListener('click', () => {
    closeModal();
    // Fire a custom event so signup.js (or any page) can react
    document.dispatchEvent(new CustomEvent('aurumTermsAccepted'));
  });

  /* ── Public API ─────────────────────────────────────────────── */
  window.AurumTerms = {
    open:  (tab) => openModal(tab || 'tos'),
    close: closeModal,
  };
})();
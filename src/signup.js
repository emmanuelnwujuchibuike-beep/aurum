 import { supabase } from './supabaseClient.js';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
const EDGE_FUNCTION_URL = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/new-user-handler';

/* ───────────────────────────────────────────────
   PARSE URL HASH — Supabase always redirects back
   with params in the hash, either for success or
   for errors (expired OTP, etc.).
─────────────────────────────────────────────── */
const hashParams      = new URLSearchParams(window.location.hash.slice(1));
const isConfirmOk     = hashParams.get('type') === 'signup' && !!hashParams.get('access_token');
const isConfirmError  = !!hashParams.get('error');
const isConfirmRedirect = isConfirmOk || isConfirmError;

// Clean the hash from the address bar without a page reload
if (isConfirmRedirect) history.replaceState(null, '', window.location.pathname);

// Handle on DOM ready so panel functions are available
document.addEventListener('DOMContentLoaded', () => {
  if (isConfirmError) {
    // Decode the error description (Supabase URL-encodes with + for spaces)
    const desc = (hashParams.get('error_description') || 'Email link is invalid or has expired.')
      .replace(/\+/g, ' ');
    const detail = document.getElementById('linkErrDetail');
    if (detail) detail.textContent = desc;
    showPanel('linkErrPanel');
    hideTabRow();
  } else if (isConfirmOk) {
    showPanel('verifyPanel');
    hideTabRow();
  }
});

function hideTabRow() {
  const tabRow = document.querySelector('.tab-row');
  if (tabRow) tabRow.style.display = 'none';
}

// Listen for Supabase processing the confirmation token.
// SIGNED_IN fires once the access_token in the hash is exchanged for a session.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session && isConfirmOk) {
    setTimeout(() => {
      showSuccess();
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 3200);
    }, 800);
  }
});

/* ───────────────────────────────────────────────
   REQUEST NEW CONFIRMATION LINK
   Shown on the error panel when the OTP expired.
─────────────────────────────────────────────── */
window.requestNewLink = async function() {
  const email = (document.getElementById('resendEmailInp')?.value || '').trim();
  if (!email) {
    document.getElementById('resendEmailInp')?.classList.add('err');
    return;
  }

  const btn = document.getElementById('requestLinkBtn');
  const lbl = document.getElementById('requestLinkLbl');
  const spn = document.getElementById('requestLinkSpin');
  if (btn) btn.disabled = true;
  if (lbl) lbl.classList.add('hidden');
  if (spn) spn.classList.remove('hidden');

  const { error } = await supabase.auth.resend({ type: 'signup', email });

  if (lbl) lbl.classList.remove('hidden');
  if (spn) spn.classList.add('hidden');

  if (error) {
    if (btn) btn.disabled = false;
    // Show error inline
    const detail = document.getElementById('linkErrDetail');
    if (detail) detail.textContent = error.message;
  } else {
    // Success — switch to the "check inbox" panel
    pendingEmail = email;
    showConfirmPanel(email);
    const tabRow = document.querySelector('.tab-row');
    if (tabRow) tabRow.style.display = '';
  }
};

/* ───────────────────────────────────────────────
   SIGN UP
─────────────────────────────────────────────── */
// Store email for resend functionality
let pendingEmail = '';

const signupForm = document.getElementById('signup-form');

if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const firstName = document.getElementById('first-name-input').value.trim();
    const lastName  = document.getElementById('last-name-input').value.trim();
    const email     = document.getElementById('email-input').value.trim();
    const phone     = document.getElementById('phone-input').value.trim();
    const password  = document.getElementById('password-input').value;
    const confirm   = document.getElementById('confirm-password-input').value;
    const terms     = document.getElementById('suTerms').checked;

    // ── Validation ──────────────────────────────
    if (!firstName || !lastName) {
      showErr('suErr', 'suErrMsg', 'Please enter your first and last name.');
      ['first-name-input','last-name-input'].forEach(id => {
        if (!document.getElementById(id).value.trim())
          document.getElementById(id).classList.add('err');
      });
      return;
    }
    if (!email) {
      showErr('suErr', 'suErrMsg', 'Please enter your email address.');
      document.getElementById('email-input').classList.add('err');
      return;
    }
    if (password.length < 8) {
      showErr('suErr', 'suErrMsg', 'Password must be at least 8 characters.');
      document.getElementById('password-input').classList.add('err');
      return;
    }
    if (password !== confirm) {
      showErr('suErr', 'suErrMsg', 'Passwords do not match.');
      document.getElementById('confirm-password-input').classList.add('err');
      return;
    }
    if (!terms) {
      showErr('suErr', 'suErrMsg', 'Please accept the Terms of Service to continue.');
      return;
    }

    setLoad('su', true);

    // Always redirect confirmation emails to the production domain
    const redirectTo = 'https://aurumcapitalinvest.com/signup.html';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: firstName,
          last_name:  lastName,
          phone:      phone || null,
        },
      },
    });

    setLoad('su', false);

    if (error) {
      showErr('suErr', 'suErrMsg', error.message);
      return;
    }

    // ── Notify admin/user via Edge Function ─────
    if (data.user) {
      try {
        await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            record: {
              email:      data.user.email,
              id:         data.user.id,
              created_at: data.user.created_at,
              first_name: firstName,
              last_name:  lastName,
            },
          }),
        });
      } catch (err) {
        console.error('Notification failed:', err);
      }
    }

    // ── Email confirmation required (session is null) ──────────
    // Show "check your inbox" panel and wait for the user to confirm.
    // If Supabase has email confirmation disabled, session will be set
    // and we skip straight to the success screen.
    if (!data.session) {
      pendingEmail = email;
      showConfirmPanel(email);
    } else {
      // Email confirmation is disabled — sign in immediately.
      showSuccess();
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 3200);
    }
  });
}

/* ───────────────────────────────────────────────
   RESEND CONFIRMATION EMAIL
─────────────────────────────────────────────── */
window.resendConf = async function() {
  const btn = document.getElementById('resendBtn');
  if (!pendingEmail) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner" style="font-size:11px;animation:spin .7s linear infinite;display:inline-block;"></i> Sending…';
  }

  const { error } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });

  if (btn) {
    if (error) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane" style="font-size:11px;"></i> Resend email';
    } else {
      btn.innerHTML = '<i class="fas fa-check" style="font-size:11px;"></i> Sent!';
      // Re-enable after 30 s cooldown
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane" style="font-size:11px;"></i> Resend email';
      }, 30_000);
    }
  }
};

/* ───────────────────────────────────────────────
   SIGN IN
─────────────────────────────────────────────── */
window.doLogin = async function(e) {
  e.preventDefault();
  clearErrors();

  const email    = document.getElementById('li-em').value.trim();
  const password = document.getElementById('li-pw').value;

  if (!email) {
    showErr('liErr', 'liErrMsg', 'Please enter your email address.');
    document.getElementById('li-em').classList.add('err');
    return;
  }
  if (!password) {
    showErr('liErr', 'liErrMsg', 'Please enter your password.');
    document.getElementById('li-pw').classList.add('err');
    return;
  }

  setLoad('li', true);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  setLoad('li', false);

  if (error) {
    // Surface friendly message when email not confirmed yet
    const msg = error.message.toLowerCase().includes('email not confirmed')
      ? 'Please confirm your email before signing in. Check your inbox.'
      : error.message;
    showErr('liErr', 'liErrMsg', msg);
    return;
  }

  window.location.href = 'dashboard.html';
};

/* ───────────────────────────────────────────────
   PANEL MANAGEMENT
─────────────────────────────────────────────── */
const PANELS = ['suPanel', 'liPanel', 'confirmPanel', 'verifyPanel', 'linkErrPanel'];

function showPanel(id) {
  PANELS.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== id);
  });
}

function showConfirmPanel(email) {
  const addr = document.getElementById('confirmEmailAddr');
  if (addr) addr.textContent = email;
  pendingEmail = email;
  showPanel('confirmPanel');
}

/* ───────────────────────────────────────────────
   SUCCESS OVERLAY
─────────────────────────────────────────────── */
function showSuccess() {
  const overlay = document.getElementById('successOverlay');
  if (overlay) overlay.classList.add('show');
}

/* ───────────────────────────────────────────────
   TAB SWITCH
─────────────────────────────────────────────── */
window.showTab = function(t) {
  const su = t === 'su';
  showPanel(su ? 'suPanel' : 'liPanel');
  document.getElementById('tabSu').classList.toggle('on', su);
  document.getElementById('tabLi').classList.toggle('on', !su);
  // Restore tab row visibility if it was hidden for the verify state
  const tabRow = document.querySelector('.tab-row');
  if (tabRow) tabRow.style.display = '';
  clearErrors();
};

/* ───────────────────────────────────────────────
   PASSWORD VISIBILITY
─────────────────────────────────────────────── */
window.togPw = function(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = `<i class="fas fa-eye${show ? '-slash' : ''}"></i>`;
};

/* ───────────────────────────────────────────────
   CHECKBOX
─────────────────────────────────────────────── */
let termsChecked = false;
window.togChk = function() {
  termsChecked = !termsChecked;
  document.getElementById('chkBox').classList.toggle('on', termsChecked);
  document.getElementById('suTerms').checked = termsChecked;
  const wrap = document.getElementById('chkWrap');
  if (wrap) wrap.setAttribute('aria-checked', String(termsChecked));
};

document.addEventListener('aurumTermsAccepted', () => {
  if (!termsChecked) window.togChk();
});

/* ───────────────────────────────────────────────
   PASSWORD STRENGTH
─────────────────────────────────────────────── */
window.chkStr = function(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const cols = ['#ef4444','#f59e0b','#3b82f6','#22c55e'];
  const lbls = ['Weak','Fair','Good','Strong'];
  for (let i = 1; i <= 4; i++) {
    const b = document.getElementById('sb' + i);
    if (b) {
      b.style.width = i <= s ? '100%' : '0%';
      b.style.background = i <= s ? cols[s - 1] : 'transparent';
    }
  }
  const l = document.getElementById('strLbl');
  if (l) {
    l.textContent = pw ? (lbls[s - 1] || 'Very Weak') : '';
    l.style.color  = pw && cols[s - 1] ? cols[s - 1] : '#5a6880';
  }
};

/* ───────────────────────────────────────────────
   HELPERS
─────────────────────────────────────────────── */
function clearErrors() {
  ['suErr', 'liErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.querySelectorAll('.inp').forEach(i => i.classList.remove('err'));
}

function showErr(wrapperId, msgId, msg) {
  const w = document.getElementById(wrapperId);
  const m = document.getElementById(msgId);
  if (w && m) { m.textContent = msg; w.classList.remove('hidden'); }
}

function setLoad(prefix, on) {
  const btn = document.getElementById(prefix + 'Btn');
  const lbl = document.getElementById(prefix + 'BtnLbl');
  const spn = document.getElementById(prefix + 'Spin');
  if (btn) btn.disabled = on;
  if (lbl) lbl.classList.toggle('hidden', on);
  if (spn) spn.classList.toggle('hidden', !on);
}

window.clearErrors = clearErrors;
window.showErr     = showErr;
window.setLoad     = setLoad;

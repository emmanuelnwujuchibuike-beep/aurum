 import { supabase } from './supabaseClient.js';

console.log('signup.js loaded');

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';
const EDGE_FUNCTION_URL = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/new-user-handler';

/* ───────────────────────────────────────────────
   SIGN UP
─────────────────────────────────────────────── */
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

    // ── Client-side validation ──────────────────
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

    // ── Call Supabase ───────────────────────────
    setLoad('su', true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
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

    // ── Notify on new signup ────────────────────
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
            }
          }),
        });
      } catch (err) {
        // Notification failure should not block signup success
        console.error('Notification failed:', err);
      }
    }

    // ── Success ─────────────────────────────────
    showSuccess();
  });
} else {
  console.error('Could not find #signup-form');
}

/* ───────────────────────────────────────────────
   SIGN IN
─────────────────────────────────────────────── */
window.doLogin = async function (e) {
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
    showErr('liErr', 'liErrMsg', error.message);
    return;
  }

  window.location.href = 'dashboard.html';
};

/* ───────────────────────────────────────────────
   SUCCESS OVERLAY
─────────────────────────────────────────────── */
function showSuccess() {
  const overlay = document.getElementById('successOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

/* ───────────────────────────────────────────────
   TAB SWITCH
─────────────────────────────────────────────── */
window.showTab = function(t) {
  const su = t === 'su';
  document.getElementById('suPanel').classList.toggle('hidden', !su);
  document.getElementById('liPanel').classList.toggle('hidden', su);
  document.getElementById('tabSu').classList.toggle('on', su);
  document.getElementById('tabLi').classList.toggle('on', !su);
  clearErrors();
};

/* ───────────────────────────────────────────────
   PASSWORD VISIBILITY
─────────────────────────────────────────────── */
window.togPw = function(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = `<i class="fas fa-eye${show ? '-slash' : ''} text-xs"></i>`;
};

/* ───────────────────────────────────────────────
   CHECKBOX
─────────────────────────────────────────────── */
let termsChecked = false;
window.togChk = function() {
  termsChecked = !termsChecked;
  document.getElementById('chkBox').classList.toggle('on', termsChecked);
  document.getElementById('suTerms').checked = termsChecked;
};

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
    b.style.width = i <= s ? '100%' : '0%';
    b.style.background = i <= s ? cols[s-1] : 'transparent';
  }
  const l = document.getElementById('strLbl');
  l.textContent = pw ? (lbls[s-1] || 'Very Weak') : '';
  l.style.color = pw && cols[s-1] ? cols[s-1] : '#5a6880';
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

// Expose helpers to inline HTML onclick handlers
window.clearErrors = clearErrors;
window.showErr     = showErr;
window.setLoad     = setLoad;
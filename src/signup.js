import { supabase } from './supabaseClient.js';

console.log('signup.js loaded');

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

    // ── Success ─────────────────────────────────
    // data.user is populated on immediate sign-up
    // (email confirmation disabled) or data.session
    // is null when confirmation is required.
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

  // Redirect after successful login
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
   HELPERS  (also used inline by the HTML)
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
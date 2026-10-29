/* Aurum Capital — client for the server-side `money` function.
   Every buy, sell, swap, property withdrawal and CFD open/close goes through
   aurumMoney(); the server sets the price, checks the balance and updates the
   account atomically. Pages never write cash, holdings or trades directly.

   aurumMoney(action, params, accessToken) → Promise<result>
     - throws Error(message) on refusal (insufficient balance, locked, …)
     - params.key: optional idempotency key; one is generated per call, so a
       retried request with the same key is never charged twice */
(function () {
  'use strict';
  var URL_ = 'https://ttwwthfeordsojmcjwxn.supabase.co/functions/v1/money';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0d3d0aGZlb3Jkc29qbWNqd3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDE0OTIsImV4cCI6MjA5NTM3NzQ5Mn0.pMaGWupL4qEJKbQuYPJN2p4Z_reh2IvKgqR8sDie37w';

  function newKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  window.aurumMoney = async function (action, params, accessToken) {
    if (!accessToken) throw new Error('Please sign in again');
    var body = Object.assign({ action: action, key: (params && params.key) || newKey() }, params || {});
    var r = await fetch(URL_, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var j = await r.json().catch(function () { return { error: 'Unexpected response from server' }; });
    if (!r.ok || j.error) throw new Error(j.error || ('Request failed (' + r.status + ')'));
    return j;
  };
})();

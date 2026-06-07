/* Aurum Capital — Shared Currency Utility
   Reads the user's saved currency pref from localStorage,
   seeds fallback FX rates, fetches live rates from open.er-api.com,
   and exposes window.AurumCurrency for all pages.
*/
(function () {
  var FALLBACK = {
    USD:1, EUR:0.92, GBP:0.79, JPY:149.5,
    NGN:1620, CAD:1.36, AUD:1.53, CHF:0.88,
    INR:83.5, BRL:4.97
  };
  var SYMS = {
    USD:'$', EUR:'€', GBP:'£', JPY:'¥',
    NGN:'₦', CAD:'C$', AUD:'A$', CHF:'Fr',
    INR:'₹', BRL:'R$'
  };
  var NO_DEC = { JPY:1, KRW:1 };

  var _rates = Object.assign({}, FALLBACK);
  var _cur   = 'USD';

  // Read saved preference
  try {
    var s = JSON.parse(localStorage.getItem('aurum_pref_settings') || '{}');
    _cur = s.currency || localStorage.getItem('aurum_pref_currency') || 'USD';
  } catch (e) {
    _cur = localStorage.getItem('aurum_pref_currency') || 'USD';
  }

  window.AurumCurrency = {
    convert: function (usd) {
      return Number(usd) * (_rates[_cur] || 1);
    },
    sym: function () {
      return SYMS[_cur] || '$';
    },
    cur: function () { return _cur; },
    fmt: function (usd) {
      var v = this.convert(usd);
      var d = NO_DEC[_cur] ? 0 : 2;
      return this.sym() + Math.abs(v).toLocaleString('en-US', {
        minimumFractionDigits: d, maximumFractionDigits: d
      });
    },
    fmtCompact: function (usd) {
      var v = this.convert(usd), s = this.sym();
      var d = NO_DEC[_cur] ? 0 : 2;
      if (v >= 1e9) return s + (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return s + (v / 1e6).toFixed(2) + 'M';
      if (v >= 1e4) return s + (v / 1e3).toFixed(1) + 'K';
      return s + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
  };

  // Fetch live rates and dispatch event when ready
  function fetchRates() {
    fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(6000) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.rates) _rates = Object.assign({}, d.rates, { USD: 1 });
      })
      .catch(function () {})
      .finally(function () {
        document.dispatchEvent(new CustomEvent('aurumRatesReady'));
      });
  }

  fetchRates();

  // Re-read currency when another tab (e.g. profile page) changes it
  window.addEventListener('storage', function (e) {
    if (e.key !== 'aurum_pref_currency' && e.key !== 'aurum_pref_settings') return;
    try {
      var s = JSON.parse(localStorage.getItem('aurum_pref_settings') || '{}');
      _cur = s.currency || localStorage.getItem('aurum_pref_currency') || 'USD';
    } catch (err) {
      _cur = localStorage.getItem('aurum_pref_currency') || 'USD';
    }
    document.dispatchEvent(new CustomEvent('aurumRatesReady'));
  });
})();

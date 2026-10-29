/* Aurum Capital — tiny canvas price chart for markets.html.
   Loaded by app.js (data-lazy-script) after the page is interactive.
   Draws candles / line / area / OHLC bars from the get-ohlcv function. */
(function () {
  'use strict';
  var box = document.getElementById('chart');
  if (!box || !window.Aurum) return;

  // Price-feed symbols → get-ohlcv symbols
  var OHLC_SYM = { XAUUSD: 'GOLD', XAGUSD: 'SILVER', USOIL: 'OIL' };
  var RANGE_TF = { '3M': 1, '1Y': 1 }; // whole range, aggregated
  var MAX_BARS = 90;

  var state = { sym: box.getAttribute('data-sym') || 'BTC', tf: '1D', type: 'candles' };
  var cache = {}, bars = null, req = 0;
  var note = box.querySelector('[data-chart-note]');
  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none';
  box.appendChild(cv);
  var ctx = cv.getContext('2d');

  function setNote(text) {
    if (note) { note.textContent = text; note.parentNode.hidden = !text; }
    cv.style.display = text ? 'none' : 'block';
  }

  function aggregate(list, max) {
    if (list.length <= max) return list;
    var size = Math.ceil(list.length / max), out = [];
    for (var i = 0; i < list.length; i += size) {
      var g = list.slice(i, i + size), b = { o: g[0].o, c: g[g.length - 1].c, h: -Infinity, l: Infinity };
      g.forEach(function (x) { b.h = Math.max(b.h, x.h); b.l = Math.min(b.l, x.l); });
      out.push(b);
    }
    return out;
  }

  function fmt(v) {
    var d = v >= 1000 ? 0 : v >= 1 ? 2 : 4;
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function draw() {
    if (!bars || !bars.length) return;
    var w = box.clientWidth, h = box.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var padL = 10, padR = 58, padT = 14, padB = 14;
    var closeOnly = state.type === 'line' || state.type === 'area';
    var hi = -Infinity, lo = Infinity;
    bars.forEach(function (b) {
      hi = Math.max(hi, closeOnly ? b.c : b.h);
      lo = Math.min(lo, closeOnly ? b.c : b.l);
    });
    if (hi === lo) { hi += 1; lo -= 1; }
    var span = h - padT - padB, step = (w - padL - padR) / bars.length;
    var y = function (v) { return padT + (hi - v) / (hi - lo) * span; };
    var x = function (i) { return padL + step * (i + 0.5); };

    // grid + right-hand price labels
    ctx.font = '10px Outfit, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 3; g++) {
      var v = hi - (hi - lo) * g / 3, gy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = 'rgba(122,92,23,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR + 4, gy); ctx.stroke();
      ctx.fillStyle = '#5B5448'; ctx.fillText(fmt(v), w - padR + 8, gy);
    }

    if (closeOnly) {
      ctx.beginPath();
      bars.forEach(function (b, i) { i ? ctx.lineTo(x(i), y(b.c)) : ctx.moveTo(x(i), y(b.c)); });
      if (state.type === 'area') {
        ctx.save();
        ctx.lineTo(x(bars.length - 1), h - padB); ctx.lineTo(x(0), h - padB); ctx.closePath();
        var grad = ctx.createLinearGradient(0, padT, 0, h - padB);
        grad.addColorStop(0, 'rgba(194,154,69,.35)'); grad.addColorStop(1, 'rgba(194,154,69,0)');
        ctx.fillStyle = grad; ctx.fill(); ctx.restore();
        ctx.beginPath();
        bars.forEach(function (b, i) { i ? ctx.lineTo(x(i), y(b.c)) : ctx.moveTo(x(i), y(b.c)); });
      }
      ctx.strokeStyle = '#8A6820'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
      return;
    }

    var bw = Math.max(1, Math.min(9, step * 0.62));
    bars.forEach(function (b, i) {
      var up = b.c >= b.o, cx = Math.round(x(i)) + 0.5;
      ctx.strokeStyle = ctx.fillStyle = up ? '#22603A' : '#A3261C';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, y(b.h)); ctx.lineTo(cx, y(b.l)); ctx.stroke();
      if (state.type === 'bars') {
        ctx.beginPath();
        ctx.moveTo(cx - bw / 2, y(b.o)); ctx.lineTo(cx, y(b.o));
        ctx.moveTo(cx, y(b.c)); ctx.lineTo(cx + bw / 2, y(b.c));
        ctx.stroke();
      } else {
        var top = y(Math.max(b.o, b.c)), bh = Math.max(1, Math.abs(y(b.o) - y(b.c)));
        ctx.fillRect(cx - bw / 2, top, bw, bh);
      }
    });
  }

  var tries = 0;
  function load(retry) {
    if (!retry) tries = 0;
    var key = state.sym + '|' + state.tf, mine = ++req;
    if (cache[key]) { bars = cache[key]; setNote(''); draw(); return; }
    setNote('Loading chart…');
    fetch(Aurum.api + 'get-ohlcv?symbol=' + (OHLC_SYM[state.sym] || state.sym) + '&tf=' + state.tf
      + (RANGE_TF[state.tf] ? '' : '&limit=' + MAX_BARS), { headers: Aurum.headers })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (mine !== req) return;
        if (!j || !j.success || !j.values || !j.values.length) throw 0;
        var list = j.values.slice().reverse().map(function (v) {
          return { o: +v.open, h: +v.high, l: +v.low, c: +v.close };
        }).filter(function (b) { return b.c > 0; });
        list = RANGE_TF[state.tf] ? aggregate(list, MAX_BARS) : list.slice(-MAX_BARS);
        cache[key] = bars = list;
        setNote(''); draw();
      })
      .catch(function () {
        if (mine !== req) return;
        if ((tries = tries + 1) <= 4) { setNote('Chart data is busy — retrying…'); setTimeout(function () { if (mine === req) load(true); }, 12000); return; }
        setNote('Chart data is unavailable right now. Please try again shortly.');
      });
  }

  // Chip groups and asset rows (app.js dispatches aurum:toggle for data-group buttons)
  document.addEventListener('aurum:toggle', function (e) {
    var b = e.detail.button;
    if (b.hasAttribute('data-type')) { state.type = b.getAttribute('data-type'); draw(); }
    if (b.hasAttribute('data-tf')) { state.tf = b.getAttribute('data-tf'); load(); }
  });
  document.addEventListener('click', function (e) {
    var row = e.target.closest('[data-chart-sym]');
    if (!row) return;
    var sym = row.getAttribute('data-chart-sym');
    if (sym === state.sym) { box.scrollIntoView({ block: 'center' }); return; }
    state.sym = sym;
    // Re-point the chart card at the new asset; app.js keeps filling it by attribute
    var card = document.getElementById('chart-card');
    card.querySelector('[data-chart-name]').textContent = row.getAttribute('data-name');
    card.querySelector('[data-chart-meta]').textContent = sym.replace('USD', '') + ' · ' + row.getAttribute('data-k').toUpperCase();
    var cb = card.querySelector('[data-chart-badge]'), rb = row.querySelector('.badge');
    cb.innerHTML = rb.innerHTML; if (rb.hasAttribute('data-a')) cb.setAttribute('data-a', rb.getAttribute('data-a'));
    card.querySelectorAll('[data-bind]').forEach(function (el) {
      var attr = el.getAttribute('data-bind'), src = row.querySelector('[' + attr + ']');
      el.setAttribute(attr, sym);
      el.textContent = src ? src.textContent : '—';
      if (src && attr === 'data-chg') el.className = src.className;
    });
    card.querySelectorAll('[data-trade]').forEach(function (a) {
      a.href = 'trade.html?sym=' + encodeURIComponent(sym) + '&side=' + a.getAttribute('data-trade');
    });
    document.querySelectorAll('[data-chart-sym]').forEach(function (r) {
      r.setAttribute('aria-current', r === row ? 'true' : 'false');
    });
    if (Aurum.repaint) Aurum.repaint();
    card.scrollIntoView({ block: 'start' });
    load();
  });

  if (window.ResizeObserver) new ResizeObserver(draw).observe(box);
  load();
})();

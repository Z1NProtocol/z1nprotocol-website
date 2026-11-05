/**
 * POL amounts with a dollar figure: "12.5 POL ($2.3)".
 * One fetch per page load. A fresh localStorage price (10 minutes) skips the network.
 * CoinGecko first, then Coinbase, then Coinpaprika. No API key.
 * If every source fails and nothing is cached, amounts stay POL-only.
 */
(function () {
  'use strict';

  var CACHE_KEY = 'z1n-pol-usd';
  var MAX_AGE = 10 * 60 * 1000;
  var price = null;

  function usdSuffix(amount) {
    if (price == null) return '';
    var n = Number(amount);
    if (!isFinite(n)) return '';
    var usd = n * price;
    if (usd < 0.1) return ' (<$0.1)';
    return ' ($' + usd.toFixed(1) + ')';
  }

  function amountLabel(amount, amountText) {
    if (amountText != null && String(amountText) !== '') {
      var t = String(amountText).trim();
      if (/\bPOL\b/.test(t)) return t;
      return t + ' POL';
    }
    var n = Number(amount);
    if (!isFinite(n)) return '';
    return String(n) + ' POL';
  }

  function format(amount, amountText) {
    var label = amountLabel(amount, amountText);
    if (!label) return '';
    return label + usdSuffix(amount);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mark(amount, amountText) {
    var n = Number(amount);
    var base = amountLabel(amount, amountText);
    var attr = isFinite(n) ? String(n) : '';
    return '<span data-pol="' + esc(attr) + '" data-pol-base="' + esc(base) + '">' + esc(base + usdSuffix(amount)) + '</span>';
  }

  function html(prefix, amount, amountText) {
    return String(prefix == null ? '' : prefix) + mark(amount, amountText);
  }

  function paint(el) {
    if (!el || !el.getAttribute) return;
    var raw = el.getAttribute('data-pol');
    var n = Number(raw);
    var base = el.getAttribute('data-pol-base');
    if (base == null) {
      base = (el.textContent || '').replace(/\s+/g, ' ').trim();
      el.setAttribute('data-pol-base', base);
    }
    var next = base + (isFinite(n) ? usdSuffix(n) : '');
    if (el.textContent !== next) el.textContent = next;
  }

  function paintAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll('[data-pol]') : [];
    for (var i = 0; i < nodes.length; i++) paint(nodes[i]);
    if (scope.nodeType === 1 && scope.hasAttribute && scope.hasAttribute('data-pol')) paint(scope);
  }

  function fill(el, amount, amountText) {
    if (!el) return;
    var n = Number(amount);
    var base = amountLabel(amount, amountText);
    if (isFinite(n)) el.setAttribute('data-pol', String(n));
    else el.removeAttribute('data-pol');
    el.setAttribute('data-pol-base', base);
    el.textContent = base + (isFinite(n) ? usdSuffix(n) : '');
  }

  function clear(el, text) {
    if (!el) return;
    el.removeAttribute('data-pol');
    el.removeAttribute('data-pol-base');
    el.textContent = text;
  }

  function notify() {
    paintAll(document);
    try {
      document.dispatchEvent(new CustomEvent('z1n-pol-usd', { detail: { usd: price } }));
    } catch (e) {}
  }

  function setPrice(usd) {
    if (typeof usd !== 'number' || !isFinite(usd) || usd <= 0) return false;
    price = usd;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ usd: usd, t: Date.now() })); } catch (e) {}
    notify();
    return true;
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.usd !== 'number' || !isFinite(o.usd) || o.usd <= 0 || typeof o.t !== 'number') return null;
      return o;
    } catch (e) { return null; }
  }

  function fetchJson(url) {
    var opts = { headers: { 'Accept': 'application/json' } };
    if (window.AbortSignal && typeof AbortSignal.timeout === 'function') opts.signal = AbortSignal.timeout(8000);
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function fromCoinGecko(d) {
    var row = d && d['polygon-ecosystem-token'];
    var usd = row && row.usd;
    if (typeof usd !== 'number' || !isFinite(usd) || usd <= 0) throw new Error('coingecko');
    return usd;
  }

  function fromCoinbase(d) {
    var usd = Number(d && d.data && d.data.amount);
    if (!isFinite(usd) || usd <= 0) throw new Error('coinbase');
    return usd;
  }

  function fromCoinpaprika(d) {
    var usd = Number(d && d.quotes && d.quotes.USD && d.quotes.USD.price);
    if (!isFinite(usd) || usd <= 0) throw new Error('coinpaprika');
    return usd;
  }

  function fetchPrice() {
    return fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd')
      .then(fromCoinGecko)
      .catch(function () {
        return fetchJson('https://api.coinbase.com/v2/prices/POL-USD/spot').then(fromCoinbase);
      })
      .catch(function () {
        return fetchJson('https://api.coinpaprika.com/v1/tickers/pol-polygon-ecosystem-token').then(fromCoinpaprika);
      });
  }

  var cached = loadCache();
  if (cached && (Date.now() - cached.t) < MAX_AGE) {
    price = cached.usd;
  } else {
    if (cached) price = cached.usd;
    fetchPrice().then(setPrice).catch(function () {});
  }

  window.Z1NPol = {
    format: format,
    mark: mark,
    html: html,
    fill: fill,
    clear: clear,
    paint: paintAll,
    getPrice: function () { return price; }
  };

  function boot() { paintAll(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

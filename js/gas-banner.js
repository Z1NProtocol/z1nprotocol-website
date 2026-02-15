/**
 * Z1N Protocol — Gas Price Banner
 * v1.0.0
 *
 * Self-injecting gas monitor. Add to any page:
 *   <script src="gas-banner.js"></script>
 *
 * Shows a warning banner below the header when Polygon gas > threshold.
 * Auto-hides when gas normalises. Checks every 60s.
 */
(function () {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────────
  var GAS_WARN_GWEI   = 100;   // orange warning threshold
  var GAS_DANGER_GWEI = 500;   // red danger threshold
  var POLL_INTERVAL    = 60000; // check every 60 seconds
  var RPC_URL          = 'https://polygon-mainnet.g.alchemy.com/v2/P7YcT2oy0Mfad2Pedbe3y';
  var FALLBACK_RPC     = 'https://polygon-rpc.com';

  // ── STATE ──────────────────────────────────────────────────
  var banner      = null;
  var lastGwei    = 0;
  var dismissed   = false;
  var pollTimer   = null;

  // ── STYLES (injected once) ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById('z1n-gas-banner-styles')) return;
    var style = document.createElement('style');
    style.id = 'z1n-gas-banner-styles';
    style.textContent =
      '.z1n-gas-banner {' +
        'display: none;' +
        'align-items: center;' +
        'justify-content: center;' +
        'gap: 10px;' +
        'padding: 8px 16px;' +
        'font-size: 12px;' +
        'font-family: system-ui, -apple-system, "Segoe UI", sans-serif;' +
        'color: #fff;' +
        'text-align: center;' +
        'line-height: 1.4;' +
        'transition: opacity 0.3s, max-height 0.3s;' +
        'max-height: 0;' +
        'opacity: 0;' +
        'overflow: hidden;' +
      '}' +
      '.z1n-gas-banner.visible {' +
        'display: flex;' +
        'max-height: 60px;' +
        'opacity: 1;' +
      '}' +
      '.z1n-gas-banner.warn {' +
        'background: rgba(250, 204, 21, 0.15);' +
        'border-bottom: 1px solid rgba(250, 204, 21, 0.3);' +
        'color: #facc15;' +
      '}' +
      '.z1n-gas-banner.danger {' +
        'background: rgba(249, 115, 115, 0.15);' +
        'border-bottom: 1px solid rgba(249, 115, 115, 0.3);' +
        'color: #f97373;' +
      '}' +
      '.z1n-gas-banner .gas-icon { font-size: 14px; }' +
      '.z1n-gas-banner .gas-value { font-weight: 700; }' +
      '.z1n-gas-banner .gas-msg { opacity: 0.9; }' +
      '.z1n-gas-banner .gas-dismiss {' +
        'background: none;' +
        'border: 1px solid currentColor;' +
        'color: inherit;' +
        'border-radius: 4px;' +
        'padding: 2px 8px;' +
        'font-size: 11px;' +
        'cursor: pointer;' +
        'opacity: 0.7;' +
        'margin-left: 6px;' +
        'transition: opacity 0.2s;' +
      '}' +
      '.z1n-gas-banner .gas-dismiss:hover { opacity: 1; }';
    document.head.appendChild(style);
  }

  // ── CREATE BANNER ELEMENT ──────────────────────────────────
  function createBanner() {
    if (banner) return banner;
    var el = document.createElement('div');
    el.className = 'z1n-gas-banner';
    el.id = 'z1nGasBanner';
    el.innerHTML =
      '<span class="gas-icon">⛽</span>' +
      '<span class="gas-value" id="z1nGasValue">—</span>' +
      '<span class="gas-msg" id="z1nGasMsg">gwei</span>' +
      '<button class="gas-dismiss" id="z1nGasDismiss" title="Dismiss until next check">✕</button>';

    // Insert right after <header>
    var header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(el, header.nextSibling);
    } else if (header) {
      header.parentNode.appendChild(el);
    } else {
      // No header found — prepend to body
      document.body.insertBefore(el, document.body.firstChild);
    }

    // Dismiss handler
    document.getElementById('z1nGasDismiss').onclick = function () {
      dismissed = true;
      el.classList.remove('visible');
    };

    banner = el;
    return el;
  }

  // ── FETCH GAS PRICE ────────────────────────────────────────
  function fetchGasPrice(rpcUrl) {
    return fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] })
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) throw new Error(d.error.message);
      return Number(BigInt(d.result)) / 1e9; // convert wei → gwei
    });
  }

  // ── UPDATE BANNER ──────────────────────────────────────────
  function updateBanner(gwei) {
    lastGwei = gwei;

    var el = createBanner();
    var valueEl = document.getElementById('z1nGasValue');
    var msgEl   = document.getElementById('z1nGasMsg');

    if (gwei < GAS_WARN_GWEI) {
      // Gas normal — hide banner
      el.classList.remove('visible', 'warn', 'danger');
      dismissed = false; // reset dismiss so it shows again if gas spikes
      return;
    }

    if (dismissed) return; // user dismissed, wait for next cycle

    var gweiDisplay = gwei >= 1000
      ? (gwei / 1000).toFixed(1) + 'k'
      : Math.round(gwei);

    valueEl.textContent = gweiDisplay + ' gwei';

    if (gwei >= GAS_DANGER_GWEI) {
      el.className = 'z1n-gas-banner danger visible';
      msgEl.textContent = '— Network severely congested · Transactions will be very expensive · Wait for lower gas';
    } else {
      el.className = 'z1n-gas-banner warn visible';
      msgEl.textContent = '— Network busy · Transaction costs higher than normal';
    }
  }

  // ── POLL LOOP ──────────────────────────────────────────────
  function checkGas() {
    fetchGasPrice(RPC_URL)
      .catch(function () {
        // Fallback RPC
        return fetchGasPrice(FALLBACK_RPC);
      })
      .then(function (gwei) {
        console.log('⛽ Gas check:', Math.round(gwei), 'gwei');
        updateBanner(gwei);
      })
      .catch(function (err) {
        console.warn('Gas check failed:', err.message);
      });
  }

  // ── INIT ───────────────────────────────────────────────────
  function init() {
    injectStyles();
    // First check after short delay (let page render)
    setTimeout(checkGas, 1500);
    // Then poll
    pollTimer = setInterval(checkGas, POLL_INTERVAL);
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── PUBLIC API (optional) ──────────────────────────────────
  window.Z1NGas = {
    check: checkGas,
    getLastGwei: function () { return lastGwei; },
    setThresholds: function (warn, danger) {
      GAS_WARN_GWEI = warn;
      GAS_DANGER_GWEI = danger;
    }
  };

})();
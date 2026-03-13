/**
 * Z1N Protocol - Direct Channel (Key-to-Key Messaging)
 * Version: 2.3.1-Ω
 *
 * Standalone module — loaded after key-dashboard.js
 * Requires: window.Z1N (set by dashboard after connect)
 *
 * Two message modes:
 *   ENCRYPTED — ECDH via tweetnacl. Only recipient can read.
 *               Sender derives keypair from wallet signature (deterministic).
 *               Recipient must have registered public key in KeyRegistry.
 *
 *   PLAINTEXT — UTF-8 bytes on-chain. Readable by anyone, human or NBI.
 *               No encryption library needed. No KeyRegistry required.
 *               Suitable for open field expressions directed at a specific Key.
 *
 * Payload format (bytes prefix convention):
 *   Plaintext:  0x00 + UTF-8 bytes
 *   Encrypted:  0x01 + nonce(24) + ciphertext
 *
 * NBI compatibility:
 *   Same contract calls, same payload format.
 *   NBIs skip this frontend — they call contracts directly.
 *   NBIs use their own X25519 keypair registered in KeyRegistry.
 */
(function () {
  'use strict';

  // ─── Constants ───
  var SIGN_PREFIX = 'Z1N-DirectChannel-v1-';
  var NONCE_LENGTH = 24;
  var MAX_MESSAGE_LENGTH = 1400; // safe margin below 2048 byte contract limit
  var PAYLOAD_TYPE_PLAIN = 0x00;
  var PAYLOAD_TYPE_ENCRYPTED = 0x01;

  // ─── State ───
  var secretKey = null;       // Uint8Array(32) — in-memory only, never stored
  var publicKey = null;       // Uint8Array(32)
  var isUnlocked = false;
  var isRegistered = false;
  var isEncryptedMode = true; // Default: encrypted
  var publicKeyCache = {};    // keyId → hex string
  var allDirectSent = [];
  var allDirectReceived = [];

  // ─── Helpers from parent scope ───
  function getZ1N() { return window.Z1N || {}; }
  function getAPI() { return getZ1N().API_BASE || ''; }
  function getKeyId() { return getZ1N().keyId; }
  function getWallet() { return getZ1N().wallet; }
  function getProvider() { return getZ1N().provider; }
  function toast(msg, dur, err) {
    if (window.Z1N && window.Z1N.showToast) window.Z1N.showToast(msg, dur || 3000, err);
  }
  function escapeHtml(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  // ─── NaCl lazy loader ───
  var naclLib = null;
  var naclUtil = null;

  function loadNaCl() {
    return new Promise(function (resolve, reject) {
      if (naclLib && naclUtil) return resolve();
      var s1 = document.createElement('script');
      s1.src = '/js/nacl-fast.min.js';
      s1.onload = function () {
        naclLib = window.nacl;
        var s2 = document.createElement('script');
        s2.src = '/js/nacl-util.min.js';
        s2.onload = function () {
          naclUtil = window.nacl.util || window.naclUtil;
          if (!naclUtil) {
            naclUtil = {
              decodeUTF8: function (s) { return new TextEncoder().encode(s); },
              encodeUTF8: function (a) { return new TextDecoder().decode(a); },
              encodeBase64: function (a) { return btoa(String.fromCharCode.apply(null, a)); },
              decodeBase64: function (s) { var b = atob(s); var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
            };
          }
          resolve();
        };
        s2.onerror = function () { reject(new Error('Failed to load nacl-util')); };
        document.head.appendChild(s2);
      };
      s1.onerror = function () { reject(new Error('Failed to load tweetnacl')); };
      document.head.appendChild(s1);
    });
  }

  // ─── Crypto: Derive keypair from wallet signature ───
  async function deriveKeypair() {
    var prov = getProvider();
    var wallet = getWallet();
    var keyId = getKeyId();
    if (!prov || !wallet || keyId === null) throw new Error('Wallet not connected');
    var message = SIGN_PREFIX + keyId;
    var signature = await prov.request({ method: 'personal_sign', params: [message, wallet] });
    var sigBytes = hexToBytes(signature);
    var hashBuffer = await crypto.subtle.digest('SHA-256', sigBytes);
    var seed = new Uint8Array(hashBuffer);
    return naclLib.box.keyPair.fromSecretKey(seed);
  }

  // ─── Crypto: Encrypt ───
  function encryptMessage(plaintext, recipientPublicKeyBytes) {
    if (!secretKey || !naclLib) throw new Error('Not unlocked');
    var messageBytes = new TextEncoder().encode(plaintext);
    var nonce = naclLib.randomBytes(NONCE_LENGTH);
    var encrypted = naclLib.box(messageBytes, nonce, recipientPublicKeyBytes, secretKey);
    if (!encrypted) throw new Error('Encryption failed');
    // Final payload: [0x01, nonce(24), ciphertext]
    var payload = new Uint8Array(1 + nonce.length + encrypted.length);
    payload[0] = PAYLOAD_TYPE_ENCRYPTED;
    payload.set(nonce, 1);
    payload.set(encrypted, 1 + nonce.length);
    return payload;
  }

  // ─── Crypto: Decrypt ───
  function decryptMessage(payloadHex, senderPublicKeyBytes) {
    if (!secretKey || !naclLib) return null;
    try {
      var payload = hexToBytes(payloadHex);
      if (payload.length < 2) return null;
      var typeFlag = payload[0];
      if (typeFlag === PAYLOAD_TYPE_PLAIN) {
        // Plaintext — readable directly
        return new TextDecoder().decode(payload.slice(1));
      }
      if (typeFlag !== PAYLOAD_TYPE_ENCRYPTED) return null;
      if (payload.length <= 1 + NONCE_LENGTH) return null;
      var nonce = payload.slice(1, 1 + NONCE_LENGTH);
      var ciphertext = payload.slice(1 + NONCE_LENGTH);
      var decrypted = naclLib.box.open(ciphertext, nonce, senderPublicKeyBytes, secretKey);
      if (!decrypted) return null;
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      return null;
    }
  }

  // ─── Build plaintext payload: [0x00, UTF-8 bytes] ───
  function buildPlaintextPayload(text) {
    var textBytes = new TextEncoder().encode(text);
    var payload = new Uint8Array(1 + textBytes.length);
    payload[0] = PAYLOAD_TYPE_PLAIN;
    payload.set(textBytes, 1);
    return payload;
  }

  // ─── Detect payload type from hex ───
  function detectPayloadType(payloadHex) {
    if (!payloadHex || payloadHex.length < 4) return 'unknown';
    var h = payloadHex.startsWith('0x') ? payloadHex.slice(2) : payloadHex;
    var firstByte = parseInt(h.slice(0, 2), 16);
    if (firstByte === PAYLOAD_TYPE_PLAIN) return 'plain';
    if (firstByte === PAYLOAD_TYPE_ENCRYPTED) return 'encrypted';
    return 'unknown';
  }

  // ─── Read plaintext payload directly ───
  function readPlaintextPayload(payloadHex) {
    try {
      var bytes = hexToBytes(payloadHex);
      if (bytes[0] !== PAYLOAD_TYPE_PLAIN) return null;
      return new TextDecoder().decode(bytes.slice(1));
    } catch (e) {
      return null;
    }
  }

  // ─── Hex utilities ───
  function hexToBytes(hex) {
    var h = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (h.length % 2 !== 0) h = '0' + h;
    var bytes = new Uint8Array(h.length / 2);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(h.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  function bytesToHex(bytes) {
    return '0x' + Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ─── API: Check registration ───
  async function checkRegistration(keyId) {
    try {
      var r = await fetch(getAPI() + '/key-registry/' + keyId, { cache: 'no-store' });
      var d = await r.json();
      return d.hasKey === true ? d.publicKey : null;
    } catch (e) { return null; }
  }

  // ─── API: Get recipient public key ───
  async function getRecipientPublicKey(keyId) {
    if (publicKeyCache[keyId]) return publicKeyCache[keyId];
    var pk = await checkRegistration(keyId);
    if (pk) publicKeyCache[keyId] = pk;
    return pk;
  }

  // ─── API: Batch fetch public keys ───
  async function batchFetchPublicKeys(keyIds) {
    var missing = keyIds.filter(function (id) { return !publicKeyCache[id]; });
    if (missing.length === 0) return;
    try {
      var r = await fetch(getAPI() + '/key-registry/batch?keyIds=' + missing.join(','), { cache: 'no-store' });
      var d = await r.json();
      if (d.keys) {
        for (var id in d.keys) {
          if (d.keys[id].hasKey) publicKeyCache[id] = d.keys[id].publicKey;
        }
      }
    } catch (e) {}
  }

  // ─── API: Fetch messages ───
  async function fetchMessages(keyId) {
    try {
      var r = await fetch(getAPI() + '/direct-channel/key/' + keyId + '?limit=100', { cache: 'no-store' });
      var d = await r.json();
      return d.messages || [];
    } catch (e) { return []; }
  }

  // ─── Wait for tx ───
  async function waitForTx(txHash, maxSeconds) {
    var rpcFn = window.Z1N && window.Z1N.rpc;
    if (!rpcFn) return false;
    var start = Date.now();
    while (Date.now() - start < maxSeconds * 1000) {
      try {
        var receipt = await rpcFn('eth_getTransactionReceipt', [txHash]);
        if (receipt) return receipt.status === '0x1';
      } catch (e) {}
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════════════

  var directPollInterval = null;

  function startDirectPolling() {
    if (directPollInterval) return; // already running
    directPollInterval = setInterval(async function() {
      // Only poll if Direct tab is active OR to keep badge updated
      var prevReceivedCount = allDirectReceived.length;
      var messages = await fetchMessages(getKeyId());
      if (!messages || messages.length === 0) return;

      var received = messages.filter(function(m) { return m.direction === 'received'; });

      // Check if there are new messages
      if (received.length > prevReceivedCount) {
        var allKeyIds = messages.map(function(m) {
          return m.direction === 'sent' ? m.recipientKeyId : m.senderKeyId;
        }).filter(function(id, i, arr) { return arr.indexOf(id) === i; });
        await batchFetchPublicKeys(allKeyIds);

        var sent = messages.filter(function(m) { return m.direction === 'sent'; });
        received.forEach(function(m) {
          var decoded = (function() {
            if (!m.encryptedPayload) return { text: '[No payload]', type: 'unknown' };
            var payloadType = detectPayloadType(m.encryptedPayload);
            if (payloadType === 'plain') return { text: readPlaintextPayload(m.encryptedPayload) || '[Read error]', type: 'plain' };
            if (payloadType === 'encrypted') {
              if (!isUnlocked || !secretKey) return { text: '[Locked — unlock encryption to read]', type: 'locked' };
              var otherPkHex = publicKeyCache[m.senderKeyId];
              if (!otherPkHex) return { text: '[Cannot decrypt — missing public key]', type: 'error' };
              var decrypted = decryptMessage(m.encryptedPayload, hexToBytes(otherPkHex));
              if (!decrypted) return { text: '[Decryption failed]', type: 'error' };
              return { text: decrypted, type: 'encrypted' };
            }
            return { text: '[Unknown payload format]', type: 'unknown' };
          })();
          m.decodedContent = decoded.text;
          m.messageType = decoded.type;
        });

        // Update badge regardless of which tab is active
        allDirectReceived = received;
        var directTabActive = document.getElementById('tab-direct') &&
          document.getElementById('tab-direct').style.display !== 'none';
        if (directTabActive) {
          // Also merge sent: keep optimistic entries not yet in indexer
          var indexedTxHashes = sent.map(function(m) { return m.txHash; });
          var stillOptimistic = allDirectSent.filter(function(m) {
            return m._optimistic && !indexedTxHashes.includes(m.txHash);
          });
          allDirectSent = stillOptimistic.concat(sent);
          sent.forEach(function(m) {
            var decoded = (function() {
              if (!m.encryptedPayload) return { text: '[No payload]', type: 'unknown' };
              var payloadType = detectPayloadType(m.encryptedPayload);
              if (payloadType === 'plain') return { text: readPlaintextPayload(m.encryptedPayload) || '[Read error]', type: 'plain' };
              return { text: '[Encrypted]', type: 'encrypted' };
            })();
            m.decodedContent = decoded.text;
            m.messageType = decoded.type;
          });
          renderDirectSent(allDirectSent);
          renderDirectReceived(allDirectReceived);
        } else {
          // Tab not active — just update badge via ActivityFeed
          if (typeof ActivityFeed !== 'undefined' && typeof updateTabBadges === 'function') {
            ActivityFeed.activities = ActivityFeed.activities.filter(function(a) {
              return a.type !== 'direct_received';
            });
            var seenIds = JSON.parse(localStorage.getItem('z1n_direct_seen_' + getKeyId()) || '[]');
            var seenSet = new Set(seenIds);
            received.forEach(function(m) {
              var msgId = 'direct_recv_' + (m.txHash || m.blockNumber || m.senderKeyId + '_' + m.timestamp);
              ActivityFeed.activities.push({
                id: msgId,
                type: 'direct_received',
                direction: 'received',
                timestamp: m.blockNumber || m.timestamp || 0,
                fromKeyId: m.senderKeyId,
                unseen: !seenSet.has(msgId),
                content: m.messageType === 'encrypted' ? '[Encrypted]' : (m.decodedContent || '')
              });
            });
            try {
              var _ri = localStorage.getItem('z1n_direct_seen_' + getKeyId());
              if (_ri) ActivityFeed.readItems = new Set(JSON.parse(_ri));
            } catch(e) {}
            updateTabBadges();
          }
        }
      }
    }, 30000); // poll every 30s
  }

  function stopDirectPolling() {
    if (directPollInterval) {
      clearInterval(directPollInterval);
      directPollInterval = null;
    }
  }

  window.loadDirectChannel = async function () {
    var container = document.getElementById('tab-direct');
    if (!container || getKeyId() === null) return;

    // Always try to load NaCl (needed for decrypt even in plaintext mode)
    try {
      await loadNaCl();
    } catch (e) {
      // NaCl failed — plaintext-only mode still works
      console.warn('NaCl load failed, encrypted mode unavailable');
    }

    var existingPk = await checkRegistration(getKeyId());
    isRegistered = !!existingPk;

    // If no encryption key registered: show main tab but with setup prompt
    // User can still send/receive plaintext without setup
    if (!isRegistered) {
      if (!isUnlocked) {
        renderDirectTab(container, 'setup');
      } else {
        renderDirectTab(container, 'plaintext-only');
      }
    } else if (!isUnlocked) {
      renderDirectTab(container, 'locked');
    } else {
      renderDirectTab(container, 'unlocked');
    }

    await loadDirectMessages();
    startDirectPolling();
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER MAIN TAB
  // ═══════════════════════════════════════════════════════════════

  function renderDirectTab(container, encryptionState) {
    // encryptionState: 'setup' | 'locked' | 'unlocked' | 'plaintext-only'

    var encryptionBanner = '';

    if (encryptionState === 'setup') {
      encryptionBanner =
        '<div style="background:rgba(94,232,160,0.08);border:1px solid rgba(94,232,160,0.25);border-radius:10px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-size:12px;font-weight:600;color:#5ee8a0;margin-bottom:3px;">🔐 Enable encryption</div>' +
            '<div style="font-size:11px;color:var(--text-soft);">Encrypt your messages so only the recipient can read them. One wallet signature registers your key — no gas after setup. Without encryption, message content is visible on-chain.</div>' +
          '</div>' +
          '<button class="btn btn-green" onclick="registerEncryptionKey()" style="white-space:nowrap;padding:8px 16px;font-size:12px;">Enable encryption</button>' +
        '</div>' +
        '<div id="directSetupStatus"></div>';
    } else if (encryptionState === 'locked') {
      encryptionBanner =
        '<div style="background:rgba(94,232,160,0.08);border:1px solid rgba(94,232,160,0.25);border-radius:10px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-size:12px;font-weight:600;color:#5ee8a0;margin-bottom:3px;">🔒 Enable encryption</div>' +
            '<div style="font-size:11px;color:var(--text-soft);line-height:1.6;">By enabling encryption, your messages are end-to-end encrypted on-chain. One free wallet signature per session — no gas, nothing stored. Without encryption, message content is readable by anyone on-chain.</div>' +          '</div>' +
          '<button class="btn btn-green" onclick="unlockDirectChannel()" style="white-space:nowrap;padding:8px 16px;font-size:12px;">Enable encryption</button>' +
        '</div>' +
        '<div id="directUnlockStatus"></div>';
    }

    container.innerHTML =
      encryptionBanner +
      '<div class="two-col">' +

        // LEFT: Compose
        '<div class="section-card">' +
          '<div class="section-header" style="margin-bottom:16px;">' +
            '<span class="section-title" style="color:#ffd556;">SEND DIRECT MESSAGE</span>' +
            renderModeToggle(encryptionState) +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">Recipient Key ID</div>' +
            '<input type="text" id="directRecipient" placeholder="e.g. 42" autocomplete="off" oninput="validateDirectRecipient()">' +
            '<div id="directRecipientValidation" class="validation-msg"></div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label"><span>Message</span><span class="char-count" id="directCharCount">0 / ' + MAX_MESSAGE_LENGTH + '</span></div>' +
            '<textarea id="directContent" placeholder="Your message..." maxlength="' + MAX_MESSAGE_LENGTH + '" oninput="updateDirectCharCount()"></textarea>' +
          '</div>' +

          '<div style="margin-top:14px;">' +
            '<button class="btn-submit" id="btnSendDirect" onclick="sendDirectMessage()">Send Message</button>' +
          '</div>' +
          '<div id="directSendStatus"></div>' +
        '</div>' +

        // RIGHT: Sent
        '<div class="section-card">' +
          '<div class="section-header" style="margin-bottom:16px;">' +
            '<span class="section-title" style="color:#ffd556;">SENT <span id="directSentCount" style="font-weight:400;opacity:0.8;">(0)</span></span>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
              '<input type="text" id="directSentSearchKey" placeholder="To Key..." style="width:70px;padding:6px 8px;border-radius:6px;border:1px solid var(--card-border);background:rgba(15,23,42,0.6);color:var(--text-main);font-size:11px;" oninput="filterDirectSent()">' +
              '<button class="filter-select" style="cursor:pointer;" onclick="downloadDirectSentCSV()">↓ CSV</button>' +
            '</div>' +
          '</div>' +
          '<div class="signal-list" id="directSentList" style="max-height:320px;">' +
            '<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:12px;">Loading...</div>' +
          '</div>' +
        '</div>' +

      '</div>' +

      // RECEIVED — full width
      '<div class="section-card" style="margin-top:20px;">' +
        '<div class="section-header" style="margin-bottom:12px;">' +
          '<span class="section-title" style="color:#ffd556;">RECEIVED <span id="directReceivedCount" style="font-weight:400;opacity:0.8;">(0)</span></span>' +
          '<div style="display:flex;gap:6px;align-items:center;">' +
            '<input type="text" id="directReceivedSearchKey" placeholder="From Key..." style="width:80px;padding:6px 8px;border-radius:6px;border:1px solid var(--card-border);background:rgba(15,23,42,0.6);color:var(--text-main);font-size:11px;" oninput="filterDirectReceived()">' +
            '<button class="filter-select" style="cursor:pointer;" onclick="downloadDirectReceivedCSV()">↓ CSV</button>' +
          '</div>' +
        '</div>' +
        '<div class="signal-list" id="directReceivedList" style="max-height:300px;">' +
          '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">' +
            '<div style="font-size:24px;opacity:0.3;margin-bottom:8px;">💬</div>No messages yet' +
          '</div>' +
        '</div>' +
      '</div>';

    // Update send button label to match current mode
    updateSendButton();
  }

  function renderModeToggle(encryptionState) {
    var canEncrypt = encryptionState === 'unlocked';
    if (!canEncrypt) {
      // Plaintext only — show static badge, no toggle
      return '<span style="font-size:10px;padding:3px 8px;background:rgba(148,163,184,0.15);color:var(--text-soft);border-radius:4px;">Open field</span>';
    }

    // Toggle between encrypted and plaintext
    var encActive = isEncryptedMode ? 'style="background:rgba(94,232,160,0.2);border-color:#5ee8a0;color:#5ee8a0;"' : 'style="background:transparent;border-color:rgba(148,163,184,0.3);color:var(--text-soft);"';
    var plainActive = !isEncryptedMode ? 'style="background:rgba(255,213,86,0.15);border-color:rgba(255,213,86,0.4);color:var(--keys-accent);"' : 'style="background:transparent;border-color:rgba(148,163,184,0.3);color:var(--text-soft);"';

    return '<div style="display:flex;gap:4px;">' +
      '<div title="Content is encrypted on-chain. Key IDs sending and receiving are recorded, but message content is private.">' +
      '<button onclick="setDirectMode(true)" ' + encActive + ' style="padding:4px 10px;font-size:10px;font-weight:600;border-radius:5px;border:1px solid;cursor:pointer;transition:all 0.2s;">🔐 Encrypted</button>' +
      '</div>' +
      '<div title="Both Key IDs and message content are visible on-chain — like a normal signal directed at a specific Key.">' +
      '<button onclick="setDirectMode(false)" ' + plainActive + ' style="padding:4px 10px;font-size:10px;font-weight:600;border-radius:5px;border:1px solid;cursor:pointer;transition:all 0.2s;">📡 Open field</button>' +
      '</div>' +
    '</div>';
  }

  // ─── Mode toggle ───
  window.setDirectMode = function (encrypted) {
    isEncryptedMode = encrypted;
    // Re-render just the header toggle area
    var container = document.getElementById('tab-direct');
    if (container) {
      window.loadDirectChannel();
    }
  };

  function updateSendButton() {
    var btn = document.getElementById('btnSendDirect');
    if (!btn) return;
    if (isEncryptedMode && isUnlocked) {
      btn.textContent = '🔐 Send Encrypted';
    } else {
      btn.textContent = '📡 Send Open Field';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // REGISTER ENCRYPTION KEY
  // ═══════════════════════════════════════════════════════════════

  window.registerEncryptionKey = async function () {
    var status = document.getElementById('directSetupStatus');
    var btn = document.querySelector('[onclick="registerEncryptionKey()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing...'; }
    if (status) status.innerHTML = '<div class="status-msg pending">Sign the message in your wallet...</div>';

    try {
      await loadNaCl();
      var keypair = await deriveKeypair();
      secretKey = keypair.secretKey;
      publicKey = keypair.publicKey;

      if (btn) btn.textContent = 'Registering...';
      if (status) status.innerHTML = '<div class="status-msg pending">Confirm transaction in wallet...</div>';

      var ethersLib = window.ethers;
      if (!ethersLib) throw new Error('Ethers not loaded');

      var pkHex = bytesToHex(publicKey);
      var pkBytes32 = pkHex.length === 66 ? pkHex : (pkHex + '0'.repeat(66 - pkHex.length));

      var iface = new ethersLib.Interface(['function registerPublicKey(uint256 keyId, bytes32 publicKey)']);
      var data = iface.encodeFunctionData('registerPublicKey', [getKeyId(), pkBytes32]);

      var keyRegistryAddr = window.Z1N_KEY_REGISTRY;
      if (!keyRegistryAddr) throw new Error('KeyRegistry address not configured');

      var txHash = await getProvider().request({
        method: 'eth_sendTransaction',
        params: [{ from: getWallet(), to: keyRegistryAddr, data: data }]
      });

      if (btn) btn.textContent = 'Confirming...';
      var confirmed = await waitForTx(txHash, 60);
      if (!confirmed) throw new Error('Transaction not confirmed');

      isRegistered = true;
      isUnlocked = true;
      toast('🔐 Encryption key registered!', 4000);
      setTimeout(function () { window.loadDirectChannel(); }, 1000);

    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Rejected';
      if (btn) { btn.disabled = false; btn.textContent = 'Set up encryption'; }
      if (status) status.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // UNLOCK SESSION
  // ═══════════════════════════════════════════════════════════════

  window.unlockDirectChannel = async function () {
    var status = document.getElementById('directUnlockStatus');
    var btn = document.querySelector('[onclick="unlockDirectChannel()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing...'; }
    if (status) status.innerHTML = '<div class="status-msg pending">Sign the message in your wallet...</div>';

    try {
      await loadNaCl();
      var keypair = await deriveKeypair();
      secretKey = keypair.secretKey;
      publicKey = keypair.publicKey;
      isUnlocked = true;
      toast('🔓 Encrypted messaging unlocked', 2000);
      window.loadDirectChannel();
    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Rejected';
      if (btn) { btn.disabled = false; btn.textContent = 'Unlock encryption'; }
      if (status) status.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════

  window.sendDirectMessage = async function () {
    var status = document.getElementById('directSendStatus');
    var content = (document.getElementById('directContent') || {}).value;
    if (content) content = content.trim();
    var toInput = document.getElementById('directRecipient');
    var toKeyId = parseInt(toInput ? toInput.value : '') || 0;

    if (!content) {
      if (status) status.innerHTML = '<div class="status-msg error">Enter a message.</div>';
      return;
    }
    if (toKeyId <= 0) {
      if (status) status.innerHTML = '<div class="status-msg error">Enter a valid recipient Key ID.</div>';
      return;
    }
    if (toKeyId === getKeyId()) {
      if (status) status.innerHTML = '<div class="status-msg error">Cannot message yourself.</div>';
      return;
    }

    if (isEncryptedMode && !isUnlocked) {
      if (status) status.innerHTML = '<div class="status-msg error">🔒 Unlock encryption first — click "Unlock encryption" above before sending.</div>';
      return;
    }
    var useEncryption = isEncryptedMode;

    var payload;

    if (useEncryption) {
      // ── ENCRYPTED FLOW ──
      if (status) status.innerHTML = '<div class="status-msg pending">Fetching recipient key...</div>';
      var recipientPkHex = await getRecipientPublicKey(toKeyId);
      if (!recipientPkHex) {
        if (status) status.innerHTML = '<div class="status-msg error">K#' + toKeyId + ' has no encryption key registered. They must set up Direct messaging first, or switch to Open field mode.</div>';
        return;
      }
      var recipientPkBytes = hexToBytes(recipientPkHex);
      if (status) status.innerHTML = '<div class="status-msg pending">Encrypting...</div>';
      payload = encryptMessage(content, recipientPkBytes);
    } else {
      // ── PLAINTEXT FLOW ──
      payload = buildPlaintextPayload(content);
    }

    var payloadHex = bytesToHex(payload);

    if (status) status.innerHTML = '<div class="status-msg pending">Confirm in wallet...</div>';

    try {
      var ethersLib = window.ethers;
      if (!ethersLib) throw new Error('Ethers not loaded');

      var iface = new ethersLib.Interface([
        'function sendMessage(uint256 tokenId, uint256 recipientKeyId, bytes encryptedPayload)'
      ]);
      var data = iface.encodeFunctionData('sendMessage', [getKeyId(), toKeyId, ethersLib.getBytes(payloadHex)]);

      var directChannelAddr = window.Z1N_DIRECT_CHANNEL;
      if (!directChannelAddr) throw new Error('DirectChannel address not configured');

      var txHash = await getProvider().request({
        method: 'eth_sendTransaction',
        params: [{ from: getWallet(), to: directChannelAddr, data: data }]
      });

      if (status) status.innerHTML = '<div class="status-msg pending">Confirming...</div>';
      var confirmed = await waitForTx(txHash, 60);
      if (!confirmed) throw new Error('Transaction not confirmed');

      document.getElementById('directContent').value = '';
      window.updateDirectCharCount();

      var modeLabel = useEncryption ? '🔐 Encrypted message' : '📡 Open field message';
      if (status) status.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);border:1px solid #5ee8a0;color:#5ee8a0;">✅ ' + modeLabel + ' sent to K#' + toKeyId + '!</div>';
      toast(modeLabel + ' sent!', 4000);

      // Optimistic UI: add sent message immediately before indexer catches up
      var optimisticMsg = {
        direction: 'sent',
        recipientKeyId: toKeyId,
        senderKeyId: getKeyId(),
        encryptedPayload: bytesToHex(payload),
        timestamp: Math.floor(Date.now() / 1000),
        blockNumber: 0,
        txHash: txHash,
        decodedContent: content,
        messageType: useEncryption ? 'encrypted' : 'plain',
        _optimistic: true
      };
      allDirectSent = [optimisticMsg].concat(allDirectSent);
      renderDirectSent(allDirectSent);

      // Background refresh after indexer delay
      setTimeout(function() { loadDirectMessages(); }, 8000);
    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (status) status.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // LOAD & DECODE MESSAGES
  // ═══════════════════════════════════════════════════════════════

  async function loadDirectMessages() {
    var messages = await fetchMessages(getKeyId());

    var sent = messages.filter(function (m) { return m.direction === 'sent'; });
    var received = messages.filter(function (m) { return m.direction === 'received'; });

    // Batch-fetch public keys needed for decryption
    var allKeyIds = messages.map(function (m) {
      return m.direction === 'sent' ? m.recipientKeyId : m.senderKeyId;
    }).filter(function (id, i, arr) { return arr.indexOf(id) === i; });

    await batchFetchPublicKeys(allKeyIds);

    // Decode each message
    function decodeMessage(m, otherKeyId) {
      if (!m.encryptedPayload) return { text: '[No payload]', type: 'unknown' };
      var payloadType = detectPayloadType(m.encryptedPayload);

      if (payloadType === 'plain') {
        return { text: readPlaintextPayload(m.encryptedPayload) || '[Read error]', type: 'plain' };
      }

      if (payloadType === 'encrypted') {
        if (!isUnlocked || !secretKey) {
          return { text: '[Locked — unlock encryption to read]', type: 'locked' };
        }
        var otherPkHex = publicKeyCache[otherKeyId];
        if (!otherPkHex) return { text: '[Cannot decrypt — missing public key]', type: 'error' };
        var decrypted = decryptMessage(m.encryptedPayload, hexToBytes(otherPkHex));
        if (!decrypted) return { text: '[Decryption failed]', type: 'error' };
        return { text: decrypted, type: 'encrypted' };
      }

      return { text: '[Unknown payload format]', type: 'unknown' };
    }

    sent.forEach(function (m) {
      var decoded = decodeMessage(m, m.recipientKeyId);
      m.decodedContent = decoded.text;
      m.messageType = decoded.type;
    });

    received.forEach(function (m) {
      var decoded = decodeMessage(m, m.senderKeyId);
      m.decodedContent = decoded.text;
      m.messageType = decoded.type;
    });

    allDirectSent = sent;
    allDirectReceived = received;

    renderDirectSent(sent);
    renderDirectReceived(received);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER SENT
  // ═══════════════════════════════════════════════════════════════

  function renderDirectSent(messages) {
    var list = document.getElementById('directSentList');
    var countEl = document.getElementById('directSentCount');
    if (!list) return;
    if (countEl) countEl.textContent = '(' + messages.length + ')';

    if (messages.length === 0) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;"><div style="font-size:24px;opacity:0.3;margin-bottom:8px;">📤</div>No messages sent yet</div>';
      return;
    }

    list.innerHTML = '';
    messages.forEach(function (m) {
      var it = document.createElement('div');
      it.className = 'signal-item';

      var typeBadge = m.messageType === 'encrypted'
        ? '<span style="font-size:10px;padding:2px 6px;background:rgba(94,232,160,0.15);color:#5ee8a0;border-radius:3px;margin-left:6px;">🔐</span>'
        : '<span style="font-size:10px;padding:2px 6px;background:rgba(255,213,86,0.15);color:#ffd556;border-radius:3px;margin-left:6px;">📡</span>';

      var content = m.decodedContent || '';
      var displayContent = content.length > 100 ? content.slice(0, 100) + '...' : content;

      it.innerHTML =
        '<div style="flex:1;">' +
          '<div class="signal-item-header">' +
            '<span style="color:#ffd556;font-size:11px;font-weight:600;">→ K#' + m.recipientKeyId + '</span>' +
            typeBadge +
          '</div>' +
          '<div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:0.8;">' + escapeHtml(displayContent) + '</div>' +
        '</div>' +
        '<span class="signal-time">' + formatTimeAgo(m.timestamp) + '</span>';

      list.appendChild(it);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER RECEIVED
  // ═══════════════════════════════════════════════════════════════

  function renderDirectReceived(messages) {
    var list = document.getElementById('directReceivedList');
    var countEl = document.getElementById('directReceivedCount');
    if (!list) return;
    if (countEl) countEl.textContent = '(' + messages.length + ')';

    if (messages.length === 0) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;"><div style="font-size:24px;opacity:0.3;margin-bottom:8px;">💬</div>No messages received yet</div>';
      return;
    }

    list.innerHTML = '';
    messages.forEach(function (m) {
      var it = document.createElement('div');
      it.className = 'signal-item';

      var dmActivityId = 'direct_recv_' + (m.txHash || m.blockNumber || m.senderKeyId + '_' + m.timestamp);
      var isDmUnread = typeof ActivityFeed !== 'undefined' && ActivityFeed.readItems && !ActivityFeed.readItems.has(dmActivityId);
      if (isDmUnread) it.classList.add('unread-glow');
      it.dataset.activityId = dmActivityId;

      var typeBadge = m.messageType === 'encrypted'
        ? '<span style="font-size:10px;padding:2px 6px;background:rgba(94,232,160,0.15);color:#5ee8a0;border-radius:3px;margin-left:6px;">🔐</span>'
        : '<span style="font-size:10px;padding:2px 6px;background:rgba(255,213,86,0.15);color:#ffd556;border-radius:3px;margin-left:6px;">📡</span>';

      var isLocked = m.messageType === 'locked';
      var isError = m.messageType === 'error';

      var content = m.decodedContent || '';
      var displayContent = content.length > 150 ? content.slice(0, 150) + '...' : content;
      var contentStyle = isLocked
        ? 'font-size:11px;opacity:0.5;font-style:italic;'
        : isError
          ? 'font-size:11px;color:#f87171;'
          : 'font-size:11px;opacity:0.8;white-space:pre-wrap;word-break:break-word;';

      it.innerHTML =
        '<div style="flex:1;">' +
          '<div class="signal-item-header">' +
            '<span style="color:#ffd556;font-weight:600;">K#' + m.senderKeyId + '</span>' +
            typeBadge +
          '</div>' +
          '<div class="signal-content-preview" style="margin-top:4px;padding:6px 8px;background:rgba(148,163,184,0.08);border-radius:4px;border-left:2px solid rgba(94,232,160,0.3);' + contentStyle + '">' +
            escapeHtml(displayContent) +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">' +
          '<span class="signal-time">' + formatTimeAgo(m.timestamp) + '</span>' +
          '<button onclick="event.stopPropagation();replyDirect(' + m.senderKeyId + ')" style="font-size:10px;padding:3px 8px;background:rgba(94,232,160,0.2);color:#5ee8a0;border:none;border-radius:4px;cursor:pointer;">↩ Reply</button>' +
        '</div>';

      it.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON') return;
        if (typeof markTabItemRead === 'function') markTabItemRead(dmActivityId, it);
        var seenIds = JSON.parse(localStorage.getItem('z1n_direct_seen_' + getKeyId()) || '[]');
        if (!seenIds.includes(dmActivityId)) {
          seenIds.push(dmActivityId);
          localStorage.setItem('z1n_direct_seen_' + getKeyId(), JSON.stringify(seenIds));
        }
        it.classList.remove('unread-glow');
        if (typeof updateTabBadges === 'function') updateTabBadges();
      });

      list.appendChild(it);
    });

    // Push to ActivityFeed for tab badge + Unseen Presence
    if (typeof ActivityFeed !== 'undefined' && typeof updateTabBadges === 'function') {
      ActivityFeed.activities = ActivityFeed.activities.filter(function(a) {
        return a.type !== 'direct_received';
      });
      var seenIds = JSON.parse(localStorage.getItem('z1n_direct_seen_' + getKeyId()) || '[]');
      var seenSet = new Set(seenIds);
      messages.forEach(function(m) {
        var msgId = 'direct_recv_' + (m.txHash || m.blockNumber || m.senderKeyId + '_' + m.timestamp);
        var isUnseen = !seenSet.has(msgId);
        ActivityFeed.activities.push({
          id: msgId,
          type: 'direct_received',
          direction: 'received',
          timestamp: m.blockNumber || m.timestamp || 0,
          fromKeyId: m.senderKeyId,
          unseen: isUnseen,
          content: m.messageType === 'encrypted' ? '[Encrypted]' : (m.decodedContent || '')
        });
      });
      try {
        var _ri = localStorage.getItem('z1n_direct_seen_' + getKeyId());
        if (_ri) ActivityFeed.readItems = new Set(JSON.parse(_ri));
      } catch(e) {}
      updateTabBadges();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════

  window.updateDirectCharCount = function () {
    var el = document.getElementById('directCharCount');
    var ta = document.getElementById('directContent');
    if (el && ta) el.textContent = ta.value.length + ' / ' + MAX_MESSAGE_LENGTH;
  };

  window.replyDirect = function (fromKeyId) {
    var input = document.getElementById('directRecipient');
    if (input) { input.value = fromKeyId; window.validateDirectRecipient(); }
    var ta = document.getElementById('directContent');
    if (ta) ta.focus();
    toast('Reply to K#' + fromKeyId, 2000);
  };

  var directValidationTimer = null;
  window.validateDirectRecipient = function () {
    var input = document.getElementById('directRecipient');
    var msg = document.getElementById('directRecipientValidation');
    var btn = document.getElementById('btnSendDirect');
    if (!input || !msg) return;

    var val = input.value.trim();
    if (!val) {
      input.classList.remove('valid', 'invalid');
      msg.textContent = '';
      msg.className = 'validation-msg';
      if (btn) btn.disabled = false;
      return;
    }

    var keyId = parseInt(val);
    if (isNaN(keyId) || keyId <= 0) {
      input.classList.add('invalid'); input.classList.remove('valid');
      msg.textContent = '✗ Enter a valid Key ID'; msg.className = 'validation-msg error';
      if (btn) btn.disabled = true;
      return;
    }
    if (keyId === getKeyId()) {
      input.classList.add('invalid'); input.classList.remove('valid');
      msg.textContent = '✗ Cannot message yourself'; msg.className = 'validation-msg error';
      if (btn) btn.disabled = true;
      return;
    }

    msg.textContent = 'Checking...';
    input.classList.remove('valid', 'invalid');
    clearTimeout(directValidationTimer);

    directValidationTimer = setTimeout(async function () {
      try {
        // For encrypted mode: check if recipient has encryption key
        if (isEncryptedMode && isUnlocked) {
          var pk = await getRecipientPublicKey(keyId);
          if (pk) {
            input.classList.add('valid'); input.classList.remove('invalid');
            msg.innerHTML = '✓ K#' + keyId + ' <span style="color:#5ee8a0;">🔐 can receive encrypted</span>';
            msg.className = 'validation-msg success';
          } else {
            input.classList.remove('valid'); input.classList.add('invalid');
            msg.innerHTML = '⚠ K#' + keyId + ' has no encryption key — <span style="color:#ffd556;">switch to Open field or ask them to set up encryption</span>';
            msg.className = 'validation-msg error';
          }
        } else {
          // Plaintext — just confirm key exists (basic check via API)
          var r = await fetch(getAPI() + '/key-registry/' + keyId, { cache: 'no-store' });
          if (r.ok) {
            input.classList.add('valid'); input.classList.remove('invalid');
            msg.innerHTML = '✓ K#' + keyId + ' <span style="color:#ffd556;">📡 open field message</span>';
            msg.className = 'validation-msg success';
          } else {
            input.classList.add('invalid'); input.classList.remove('valid');
            msg.textContent = '✗ K#' + keyId + ' not found';
            msg.className = 'validation-msg error';
          }
          if (btn) btn.disabled = false;
        }
      } catch (e) {
        input.classList.add('invalid'); input.classList.remove('valid');
        msg.textContent = '✗ Could not verify';
        msg.className = 'validation-msg error';
      }
    }, 500);
  };

  // ─── Filters ───
  window.filterDirectSent = function () {
    var search = ((document.getElementById('directSentSearchKey') || {}).value || '').trim();
    if (!search) { renderDirectSent(allDirectSent); return; }
    renderDirectSent(allDirectSent.filter(function (m) { return String(m.recipientKeyId) === search; }));
  };

  window.filterDirectReceived = function () {
    var search = ((document.getElementById('directReceivedSearchKey') || {}).value || '').trim();
    if (!search) { renderDirectReceived(allDirectReceived); return; }
    renderDirectReceived(allDirectReceived.filter(function (m) { return String(m.senderKeyId) === search; }));
  };

  // ─── CSV exports ───
  window.downloadDirectSentCSV = function () {
    if (allDirectSent.length === 0) { toast('No messages to export', 2000); return; }
    var rows = [['To Key ID', 'Type', 'Content', 'Timestamp', 'Tx Hash']];
    allDirectSent.forEach(function (m) {
      rows.push([m.recipientKeyId, m.messageType || '', m.decodedContent || '[encrypted]', m.timestamp || '', m.txHash || '']);
    });
    downloadCSV(rows, 'z1n_direct_sent_' + new Date().toISOString().slice(0, 10) + '.csv');
    toast('CSV downloaded', 2000);
  };

  window.downloadDirectReceivedCSV = function () {
    if (allDirectReceived.length === 0) { toast('No messages to export', 2000); return; }
    var rows = [['From Key ID', 'Type', 'Content', 'Timestamp', 'Tx Hash']];
    allDirectReceived.forEach(function (m) {
      rows.push([m.senderKeyId, m.messageType || '', m.decodedContent || '[encrypted]', m.timestamp || '', m.txHash || '']);
    });
    downloadCSV(rows, 'z1n_direct_received_' + new Date().toISOString().slice(0, 10) + '.csv');
    toast('CSV downloaded', 2000);
  };

  // ─── Shared helpers ───
  function downloadCSV(rows, filename) {
    var csv = rows.map(function (row) {
      return row.map(function (val) {
        var s = String(val == null ? '' : val).replace(/"/g, '""');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s + '"' : s;
      }).join(',');
    }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatTimeAgo(ts) {
    if (!ts) return '';
    var now = Math.floor(Date.now() / 1000);
    var t = typeof ts === 'number' ? (ts > 1e12 ? Math.floor(ts / 1000) : ts) : Math.floor(new Date(ts).getTime() / 1000);
    var d = now - t;
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

})();
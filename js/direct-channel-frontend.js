/**
 * Z1N Protocol - Direct Channel (Encrypted Key-to-Key Messaging)
 * Version: 2.3.2-Ω
 * 
 * Standalone module — loaded after key-dashboard.js
 * Requires: window.Z1N (set by dashboard after connect)
 * 
 * Dependencies (CDN):
 *   - tweetnacl.js (nacl.box, nacl.box.open, nacl.box.keyPair.fromSecretKey)
 *   - tweetnacl-util.js (nacl.util.encodeBase64, decodeBase64, encodeUTF8, decodeUTF8)
 * 
 * Flow:
 *   1. User opens Direct tab → check if encryption key registered
 *   2. If not → show setup screen, user signs message → keypair derived → registerPublicKey on-chain
 *   3. If yes → derive keypair from signature (once per page load) → unlock tab
 *   4. Send: encrypt with recipient public key → DirectChannel.sendMessage()
 *   5. Receive: fetch encrypted payloads from API → decrypt with own secret key
 * 
 * NBI compatibility:
 *   Same contract calls, same payload format (nonce 24 bytes + ciphertext).
 *   NBIs skip the frontend entirely — they call contracts directly.
 */
(function() {
  'use strict';

  // ─── Constants ───
  var SIGN_PREFIX = 'Z1N-DirectChannel-v1-';
  var NONCE_LENGTH = 24;
  var MAX_MESSAGE_LENGTH = 1500; // leaves room for nonce + nacl overhead within 2048 byte contract limit

  // ─── State ───
  var secretKey = null;       // Uint8Array(32) — in-memory only, never stored
  var publicKey = null;       // Uint8Array(32)
  var isUnlocked = false;
  var isRegistered = false;
  var publicKeyCache = {};    // keyId → bytes32 hex string
  var allDirectSent = [];
  var allDirectReceived = [];

  // ─── Helpers from parent scope ───
  function getZ1N() { return window.Z1N || {}; }
  function getAPI() { return getZ1N().API_BASE || ''; }
  function getKeyId() { return getZ1N().keyId; }
  function getWallet() { return getZ1N().wallet; }
  function getProvider() { return getZ1N().provider; }
  function toast(msg, dur, err) { if (window.Z1N && window.Z1N.showToast) window.Z1N.showToast(msg, dur || 3000, err); }
  function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  function shortAddr(a) { return a ? a.slice(0,6) + '...' + a.slice(-4) : '—'; }

  // ─── Crypto: Load tweetnacl ───
  var naclLib = null;
  var naclUtil = null;

  function loadNaCl() {
    return new Promise(function(resolve, reject) {
      if (naclLib && naclUtil) return resolve();
      
      var s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/tweetnacl/1.0.3/nacl-fast.min.js';
      s1.onload = function() {
        naclLib = window.nacl;
        var s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/tweetnacl-util/0.15.1/nacl-util.min.js';
        s2.onload = function() {
          naclUtil = window.nacl.util || window.naclUtil;
          // Fallback: build util manually if not attached
          if (!naclUtil) {
            naclUtil = {
              decodeUTF8: function(s) { var d = new TextEncoder(); return d.encode(s); },
              encodeUTF8: function(a) { var d = new TextDecoder(); return d.decode(a); },
              encodeBase64: function(a) { return btoa(String.fromCharCode.apply(null, a)); },
              decodeBase64: function(s) { var b = atob(s); var a = new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return a; }
            };
          }
          resolve();
        };
        s2.onerror = function() { reject(new Error('Failed to load nacl-util')); };
        document.head.appendChild(s2);
      };
      s1.onerror = function() { reject(new Error('Failed to load tweetnacl')); };
      document.head.appendChild(s1);
    });
  }

  // ─── Crypto: Derive keypair from wallet signature ───
  async function deriveKeypair() {
    var provider = getProvider();
    var wallet = getWallet();
    var keyId = getKeyId();
    if (!provider || !wallet || keyId === null) throw new Error('Wallet not connected');

    var message = SIGN_PREFIX + keyId;
    
    // Request personal_sign from wallet
    var signature = await provider.request({
      method: 'personal_sign',
      params: [message, wallet]
    });

    // Hash signature to get 32-byte seed
    var sigBytes = hexToBytes(signature);
    var hashBuffer = await crypto.subtle.digest('SHA-256', sigBytes);
    var seed = new Uint8Array(hashBuffer);

    // Derive X25519 keypair
    var keypair = naclLib.box.keyPair.fromSecretKey(seed);
    return keypair;
  }

  // ─── Crypto: Encrypt message ───
  function encryptMessage(plaintext, recipientPublicKeyBytes) {
    if (!secretKey || !naclLib) throw new Error('Not unlocked');

    var messageBytes = new TextEncoder().encode(plaintext);
    var nonce = naclLib.randomBytes(NONCE_LENGTH);
    var encrypted = naclLib.box(messageBytes, nonce, recipientPublicKeyBytes, secretKey);

    if (!encrypted) throw new Error('Encryption failed');

    // Combine: nonce (24) + ciphertext
    var payload = new Uint8Array(nonce.length + encrypted.length);
    payload.set(nonce, 0);
    payload.set(encrypted, nonce.length);

    return payload;
  }

  // ─── Crypto: Decrypt message ───
  function decryptMessage(payloadHex, senderPublicKeyBytes) {
    if (!secretKey || !naclLib) return null;

    try {
      var payload = hexToBytes(payloadHex);
      if (payload.length <= NONCE_LENGTH) return null;

      var nonce = payload.slice(0, NONCE_LENGTH);
      var ciphertext = payload.slice(NONCE_LENGTH);

      var decrypted = naclLib.box.open(ciphertext, nonce, senderPublicKeyBytes, secretKey);
      if (!decrypted) return null;

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('Decrypt failed:', e);
      return null;
    }
  }

  // ─── Hex utilities ───
  function hexToBytes(hex) {
    var h = hex.startsWith('0x') ? hex.slice(2) : hex;
    var bytes = new Uint8Array(h.length / 2);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(h.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  function bytesToHex(bytes) {
    return '0x' + Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ─── API: Check if key has registered public key ───
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
    var missing = keyIds.filter(function(id) { return !publicKeyCache[id]; });
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

  // ═══════════════════════════════════════════════════════════════
  // UI: Main entry point — called from switchTab('direct')
  // ═══════════════════════════════════════════════════════════════

  window.loadDirectChannel = async function() {
    var container = document.getElementById('tab-direct');
    if (!container || getKeyId() === null) return;

    // Load NaCl if not loaded yet
    try {
      await loadNaCl();
    } catch (e) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;">Failed to load encryption library.</div>';
      return;
    }

    // Check registration
    var existingPk = await checkRegistration(getKeyId());
    isRegistered = !!existingPk;

    if (!isRegistered) {
      renderSetupScreen(container);
      return;
    }

    if (!isUnlocked) {
      renderUnlockScreen(container);
      return;
    }

    renderDirectTab(container);
    await loadDirectMessages();
  };

  // ═══════════════════════════════════════════════════════════════
  // UI: Setup screen (no public key registered)
  // ═══════════════════════════════════════════════════════════════

  function renderSetupScreen(container) {
    container.innerHTML = 
      '<div style="max-width:480px;margin:40px auto;text-align:center;">' +
        '<div style="font-size:48px;opacity:0.3;margin-bottom:16px;">🔐</div>' +
        '<h3 style="color:var(--text);margin-bottom:8px;">Set Up Encrypted Messaging</h3>' +
        '<p style="color:var(--text-soft);font-size:13px;line-height:1.6;margin-bottom:24px;">' +
          'Register an encryption key to send and receive direct messages. ' +
          'Your messages are encrypted end-to-end — only the recipient can read them.' +
        '</p>' +
        '<p style="color:var(--text-soft);font-size:11px;margin-bottom:24px;opacity:0.7;">' +
          'This requires one wallet signature (free) to derive your key, then one transaction to register it on-chain.' +
        '</p>' +
        '<button class="btn-submit" id="btnRegisterEncKey" onclick="registerEncryptionKey()" style="padding:12px 32px;">' +
          '🔑 Register Encryption Key' +
        '</button>' +
        '<div id="directSetupStatus" style="margin-top:16px;"></div>' +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // UI: Unlock screen (registered but not unlocked this session)
  // ═══════════════════════════════════════════════════════════════

  function renderUnlockScreen(container) {
    container.innerHTML = 
      '<div style="max-width:480px;margin:40px auto;text-align:center;">' +
        '<div style="font-size:48px;opacity:0.3;margin-bottom:16px;">🔓</div>' +
        '<h3 style="color:var(--text);margin-bottom:8px;">Unlock Direct Messages</h3>' +
        '<p style="color:var(--text-soft);font-size:13px;line-height:1.6;margin-bottom:24px;">' +
          'Sign a message with your wallet to unlock encrypted messaging for this session.' +
        '</p>' +
        '<button class="btn-submit" id="btnUnlockDirect" onclick="unlockDirectChannel()" style="padding:12px 32px;">' +
          '🔓 Unlock' +
        '</button>' +
        '<div id="directUnlockStatus" style="margin-top:16px;"></div>' +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // UI: Full Direct tab (unlocked)
  // ═══════════════════════════════════════════════════════════════

  function renderDirectTab(container) {
    container.innerHTML = 
      '<div class="two-col">' +

        // LEFT: Send message
        '<div class="section-card">' +
          '<div class="section-header" style="margin-bottom:16px;">' +
            '<span class="section-title">Send Direct Message</span>' +
            '<span style="font-size:10px;padding:3px 8px;background:rgba(94,232,160,0.15);color:#5ee8a0;border-radius:4px;">🔐 Encrypted</span>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label">Recipient Key ID</div>' +
            '<input type="text" id="directRecipient" placeholder="e.g. 42" autocomplete="off" oninput="validateDirectRecipient()">' +
            '<div id="directRecipientValidation" class="validation-msg"></div>' +
          '</div>' +

          '<div class="input-group">' +
            '<div class="input-label"><span>Message</span><span class="char-count" id="directCharCount">0 / ' + MAX_MESSAGE_LENGTH + '</span></div>' +
            '<textarea id="directContent" placeholder="Your encrypted message..." maxlength="' + MAX_MESSAGE_LENGTH + '" oninput="updateDirectCharCount()"></textarea>' +
          '</div>' +

          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;">' +
            '<button class="btn-submit" id="btnSendDirect" onclick="sendDirectMessage()">Send Encrypted</button>' +
          '</div>' +
          '<div id="directSendStatus"></div>' +
        '</div>' +

        // RIGHT: Sent messages
        '<div class="section-card">' +
          '<div class="section-header" style="margin-bottom:16px;">' +
            '<span class="section-title">Sent <span id="directSentCount" style="font-weight:400;opacity:0.8;">(0)</span></span>' +
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

      // RECEIVED
      '<div class="section-card" style="margin-top:20px;">' +
        '<div class="section-header" style="margin-bottom:12px;">' +
          '<span class="section-title">Received <span id="directReceivedCount" style="font-weight:400;opacity:0.8;">(0)</span></span>' +
          '<div style="display:flex;gap:6px;align-items:center;">' +
            '<input type="text" id="directReceivedSearchKey" placeholder="From Key..." style="width:80px;padding:6px 8px;border-radius:6px;border:1px solid var(--card-border);background:rgba(15,23,42,0.6);color:var(--text-main);font-size:11px;" oninput="filterDirectReceived()">' +
            '<button class="filter-select" style="cursor:pointer;" onclick="downloadDirectReceivedCSV()">↓ CSV</button>' +
          '</div>' +
        '</div>' +
        '<div class="signal-list" id="directReceivedList" style="max-height:300px;">' +
          '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">' +
            '<div style="font-size:24px;opacity:0.3;margin-bottom:8px;">🔐</div>' +
            'No messages yet' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ═══════════════════════════════════════════════════════════════
  // Action: Register encryption key
  // ═══════════════════════════════════════════════════════════════

  window.registerEncryptionKey = async function() {
    var btn = document.getElementById('btnRegisterEncKey');
    var status = document.getElementById('directSetupStatus');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Signing...';
    if (status) status.innerHTML = '<div class="status-msg pending">Sign the message in your wallet...</div>';

    try {
      // Step 1: Derive keypair
      var keypair = await deriveKeypair();
      secretKey = keypair.secretKey;
      publicKey = keypair.publicKey;

      // Step 2: Register on-chain
      btn.textContent = 'Registering...';
      if (status) status.innerHTML = '<div class="status-msg pending">Confirm transaction in wallet...</div>';

      var ethersLib = window.ethers || await window.Z1N_loadEthers?.();
      if (!ethersLib) throw new Error('Ethers not loaded');

      var pkHex = bytesToHex(publicKey); // 0x + 32 bytes = 66 chars
      // Pad to bytes32 if needed
      var pkBytes32 = pkHex.length === 66 ? pkHex : pkHex + '0'.repeat(66 - pkHex.length);

      var iface = new ethersLib.Interface([
        'function registerPublicKey(uint256 keyId, bytes32 publicKey)'
      ]);
      var data = iface.encodeFunctionData('registerPublicKey', [getKeyId(), pkBytes32]);

      var keyRegistryAddr = window.Z1N_KEY_REGISTRY;
      if (!keyRegistryAddr) throw new Error('KeyRegistry address not configured');

      var txHash = await getProvider().request({
        method: 'eth_sendTransaction',
        params: [{ from: getWallet(), to: keyRegistryAddr, data: data }]
      });

      btn.textContent = 'Confirming...';
      if (status) status.innerHTML = '<div class="status-msg pending">Waiting for confirmation...</div>';

      // Wait for receipt
      var confirmed = await waitForTx(txHash, 60);
      if (!confirmed) throw new Error('Transaction not confirmed');

      isRegistered = true;
      isUnlocked = true;
      if (status) status.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);border:1px solid #5ee8a0;color:#5ee8a0;">✅ Encryption key registered!</div>';
      toast('🔐 Encryption key registered!', 4000);

      // Reload tab
      setTimeout(function() { window.loadDirectChannel(); }, 1500);

    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Signature rejected';
      btn.disabled = false;
      btn.textContent = '🔑 Register Encryption Key';
      if (status) status.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Action: Unlock (derive keypair from signature)
  // ═══════════════════════════════════════════════════════════════

  window.unlockDirectChannel = async function() {
    var btn = document.getElementById('btnUnlockDirect');
    var status = document.getElementById('directUnlockStatus');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Signing...';
    if (status) status.innerHTML = '<div class="status-msg pending">Sign the message in your wallet...</div>';

    try {
      var keypair = await deriveKeypair();
      secretKey = keypair.secretKey;
      publicKey = keypair.publicKey;
      isUnlocked = true;

      toast('🔓 Direct messages unlocked', 2000);
      window.loadDirectChannel();

    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Signature rejected';
      btn.disabled = false;
      btn.textContent = '🔓 Unlock';
      if (status) status.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Action: Send encrypted message
  // ═══════════════════════════════════════════════════════════════

  window.sendDirectMessage = async function() {
    var status = document.getElementById('directSendStatus');
    var content = document.getElementById('directContent').value.trim();
    var toInput = document.getElementById('directRecipient');
    var toKeyId = parseInt(toInput?.value) || 0;

    if (!isUnlocked || !secretKey) { toast('Unlock first', 3000, true); return; }
    if (!content) { if (status) status.innerHTML = '<div class="status-msg error">Enter a message.</div>'; return; }
    if (toKeyId <= 0) { if (status) status.innerHTML = '<div class="status-msg error">Enter a valid recipient Key ID.</div>'; return; }
    if (toKeyId === getKeyId()) { if (status) status.innerHTML = '<div class="status-msg error">Cannot message yourself.</div>'; return; }

    if (status) status.innerHTML = '<div class="status-msg pending">Fetching recipient key...</div>';

    try {
      // Get recipient public key
      var recipientPkHex = await getRecipientPublicKey(toKeyId);
      if (!recipientPkHex) {
        if (status) status.innerHTML = '<div class="status-msg error">K#' + toKeyId + ' has no encryption key registered. They must set up Direct messaging first.</div>';
        return;
      }

      var recipientPkBytes = hexToBytes(recipientPkHex);

      // Encrypt
      if (status) status.innerHTML = '<div class="status-msg pending">Encrypting...</div>';
      var payload = encryptMessage(content, recipientPkBytes);
      var payloadHex = bytesToHex(payload);

      // Send transaction
      if (status) status.innerHTML = '<div class="status-msg pending">Confirm in wallet...</div>';

      var ethersLib = window.ethers;
      if (!ethersLib) throw new Error('Ethers not loaded');

      var iface = new ethersLib.Interface([
        'function sendMessage(uint256 tokenId, uint256 recipientKeyId, bytes encryptedPayload)'
      ]);
      var data = iface.encodeFunctionData('sendMessage', [getKeyId(), toKeyId, payloadHex]);

      var directChannelAddr = window.Z1N_DIRECT_CHANNEL;
      if (!directChannelAddr) throw new Error('DirectChannel address not configured');

      var txHash = await getProvider().request({
        method: 'eth_sendTransaction',
        params: [{ from: getWallet(), to: directChannelAddr, data: data }]
      });

      if (status) status.innerHTML = '<div class="status-msg pending">Confirming...</div>';

      var confirmed = await waitForTx(txHash, 60);
      if (!confirmed) throw new Error('Transaction not confirmed');

      // Clear form
      document.getElementById('directContent').value = '';
      window.updateDirectCharCount();

      if (status) status.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);border:1px solid #5ee8a0;color:#5ee8a0;">✅ Encrypted message sent to K#' + toKeyId + '!</div>';
      toast('🔐 Message sent!', 4000);

      // Reload messages
      await loadDirectMessages();

    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (status) status.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Load & decrypt messages
  // ═══════════════════════════════════════════════════════════════

  async function loadDirectMessages() {
    var messages = await fetchMessages(getKeyId());
    
    // Separate sent/received
    var sent = messages.filter(function(m) { return m.direction === 'sent'; });
    var received = messages.filter(function(m) { return m.direction === 'received'; });

    // Batch fetch public keys for decryption
    var allKeyIds = messages.map(function(m) { 
      return m.direction === 'sent' ? m.recipientKeyId : m.senderKeyId; 
    }).filter(function(id, i, arr) { return arr.indexOf(id) === i; });
    await batchFetchPublicKeys(allKeyIds);

    // Decrypt all messages
    sent.forEach(function(m) {
      if (m.encryptedPayload) {
        var recipientPk = publicKeyCache[m.recipientKeyId];
        if (recipientPk) {
          m.decryptedContent = decryptMessage(m.encryptedPayload, hexToBytes(recipientPk));
        }
      }
    });

    received.forEach(function(m) {
      if (m.encryptedPayload) {
        var senderPk = publicKeyCache[m.senderKeyId];
        if (senderPk) {
          m.decryptedContent = decryptMessage(m.encryptedPayload, hexToBytes(senderPk));
        }
      }
    });

    allDirectSent = sent;
    allDirectReceived = received;

    renderDirectSent(sent);
    renderDirectReceived(received);
  }

  // ═══════════════════════════════════════════════════════════════
  // Render sent messages
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
    messages.forEach(function(m) {
      var it = document.createElement('div');
      it.className = 'signal-item';
      var content = m.decryptedContent || '[Cannot decrypt]';
      var displayContent = content.length > 100 ? content.slice(0, 100) + '...' : content;
      var timeAgo = formatTimeAgo(m.timestamp);

      it.innerHTML = '<div style="flex:1;">' +
        '<div class="signal-item-header">' +
          '<span style="color:var(--keys-accent);font-size:11px;">→ To:</span>' +
          '<span style="color:var(--keys-accent);font-weight:600;margin-left:4px;">K#' + m.recipientKeyId + '</span>' +
          '<span style="font-size:10px;padding:2px 6px;background:rgba(94,232,160,0.15);color:#5ee8a0;border-radius:3px;margin-left:6px;">🔐</span>' +
        '</div>' +
        '<div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:0.8;">' + escapeHtml(displayContent) + '</div>' +
      '</div>' +
      '<span class="signal-time">' + timeAgo + '</span>';
      list.appendChild(it);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Render received messages
  // ═══════════════════════════════════════════════════════════════

  function renderDirectReceived(messages) {
    var list = document.getElementById('directReceivedList');
    var countEl = document.getElementById('directReceivedCount');
    if (!list) return;
    if (countEl) countEl.textContent = '(' + messages.length + ')';

    if (messages.length === 0) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;"><div style="font-size:24px;opacity:0.3;margin-bottom:8px;">🔐</div>No messages received yet</div>';
      return;
    }

    list.innerHTML = '';
    messages.forEach(function(m) {
      var it = document.createElement('div');
      it.className = 'signal-item';
      var content = m.decryptedContent || '[Cannot decrypt]';
      var displayContent = content.length > 150 ? content.slice(0, 150) + '...' : content;
      var timeAgo = formatTimeAgo(m.timestamp);
      var canDecrypt = !!m.decryptedContent;

      it.innerHTML = '<div style="flex:1;">' +
        '<div class="signal-item-header">' +
          '<span style="color:var(--keys-accent);font-weight:600;">K#' + m.senderKeyId + '</span>' +
          '<span style="font-size:10px;padding:2px 6px;background:rgba(94,232,160,0.15);color:#5ee8a0;border-radius:3px;margin-left:6px;">🔐</span>' +
          (!canDecrypt ? '<span style="font-size:10px;color:#f87171;margin-left:6px;">⚠ decrypt failed</span>' : '') +
        '</div>' +
        '<div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;margin-top:4px;padding:6px 8px;background:rgba(148,163,184,0.08);border-radius:4px;border-left:2px solid rgba(94,232,160,0.3);font-size:11px;opacity:0.8;">' + escapeHtml(displayContent) + '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">' +
        '<span class="signal-time">' + timeAgo + '</span>' +
        '<button class="reply-btn" onclick="event.stopPropagation();replyDirect(' + m.senderKeyId + ')" style="font-size:10px;padding:3px 8px;background:rgba(94,232,160,0.2);color:#5ee8a0;border:none;border-radius:4px;cursor:pointer;">↩ Reply</button>' +
      '</div>';
      list.appendChild(it);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // UI helpers
  // ═══════════════════════════════════════════════════════════════

  window.updateDirectCharCount = function() {
    var el = document.getElementById('directCharCount');
    var ta = document.getElementById('directContent');
    if (el && ta) el.textContent = ta.value.length + ' / ' + MAX_MESSAGE_LENGTH;
  };

  window.replyDirect = function(fromKeyId) {
    var input = document.getElementById('directRecipient');
    if (input) { input.value = fromKeyId; window.validateDirectRecipient(); }
    var content = document.getElementById('directContent');
    if (content) content.focus();
    toast('Reply to K#' + fromKeyId, 2000);
  };

  var directValidationTimer = null;
  window.validateDirectRecipient = function() {
    var input = document.getElementById('directRecipient');
    var msg = document.getElementById('directRecipientValidation');
    var btn = document.getElementById('btnSendDirect');
    if (!input || !msg) return;
    var val = input.value.trim();

    if (!val) { input.classList.remove('valid', 'invalid'); msg.textContent = ''; msg.className = 'validation-msg'; if (btn) btn.disabled = false; return; }
    var keyId = parseInt(val);
    if (isNaN(keyId) || keyId <= 0) { input.classList.remove('valid'); input.classList.add('invalid'); msg.textContent = '✗ Enter a valid Key ID'; msg.className = 'validation-msg error'; if (btn) btn.disabled = true; return; }
    if (keyId === getKeyId()) { input.classList.remove('valid'); input.classList.add('invalid'); msg.textContent = '✗ Cannot message yourself'; msg.className = 'validation-msg error'; if (btn) btn.disabled = true; return; }

    msg.textContent = 'Checking...'; input.classList.remove('valid', 'invalid');
    clearTimeout(directValidationTimer);
    directValidationTimer = setTimeout(async function() {
      try {
        // Check key exists + has encryption key
        var pk = await getRecipientPublicKey(keyId);
        if (pk) {
          input.classList.remove('invalid'); input.classList.add('valid');
          msg.innerHTML = '✓ K#' + keyId + ' <span style="color:#5ee8a0;">🔐 encrypted</span>';
          msg.className = 'validation-msg success';
          if (btn) btn.disabled = false;
        } else {
          // Key might exist but no encryption key
          input.classList.remove('valid'); input.classList.add('invalid');
          msg.textContent = '✗ K#' + keyId + ' has no encryption key';
          msg.className = 'validation-msg error';
          if (btn) btn.disabled = true;
        }
      } catch (e) {
        input.classList.remove('valid'); input.classList.add('invalid');
        msg.textContent = '✗ Could not verify';
        msg.className = 'validation-msg error';
        if (btn) btn.disabled = true;
      }
    }, 500);
  };

  // ─── Filters ───

  window.filterDirectSent = function() {
    var search = (document.getElementById('directSentSearchKey')?.value || '').trim();
    if (!search) { renderDirectSent(allDirectSent); return; }
    var filtered = allDirectSent.filter(function(m) { return String(m.recipientKeyId) === search; });
    renderDirectSent(filtered);
  };

  window.filterDirectReceived = function() {
    var search = (document.getElementById('directReceivedSearchKey')?.value || '').trim();
    if (!search) { renderDirectReceived(allDirectReceived); return; }
    var filtered = allDirectReceived.filter(function(m) { return String(m.senderKeyId) === search; });
    renderDirectReceived(filtered);
  };

  // ─── CSV exports ───

  window.downloadDirectSentCSV = function() {
    if (allDirectSent.length === 0) { toast('No messages to export', 2000); return; }
    var rows = [['To Key ID', 'Content', 'Timestamp', 'Tx Hash']];
    allDirectSent.forEach(function(m) {
      rows.push([m.recipientKeyId, m.decryptedContent || '[encrypted]', m.timestamp || '', m.txHash || '']);
    });
    downloadCSV(rows, 'z1n_direct_sent_' + new Date().toISOString().slice(0,10) + '.csv');
    toast('CSV downloaded', 2000);
  };

  window.downloadDirectReceivedCSV = function() {
    if (allDirectReceived.length === 0) { toast('No messages to export', 2000); return; }
    var rows = [['From Key ID', 'Content', 'Timestamp', 'Tx Hash']];
    allDirectReceived.forEach(function(m) {
      rows.push([m.senderKeyId, m.decryptedContent || '[encrypted]', m.timestamp || '', m.txHash || '']);
    });
    downloadCSV(rows, 'z1n_direct_received_' + new Date().toISOString().slice(0,10) + '.csv');
    toast('CSV downloaded', 2000);
  };

  // ─── Shared helpers ───

  function downloadCSV(rows, filename) {
    var csv = rows.map(function(row) {
      return row.map(function(val) {
        var s = String(val == null ? '' : val).replace(/"/g, '""');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s + '"' : s;
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
    var t = typeof ts === 'number' ? (ts > 1e12 ? Math.floor(ts/1000) : ts) : Math.floor(new Date(ts).getTime()/1000);
    var d = now - t;
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d/60) + 'm ago';
    if (d < 86400) return Math.floor(d/3600) + 'h ago';
    return Math.floor(d/86400) + 'd ago';
  }

  async function waitForTx(txHash, maxSeconds) {
    var rpc = window.Z1N?.rpc;
    if (!rpc) return false;
    var start = Date.now();
    while (Date.now() - start < maxSeconds * 1000) {
      try {
        var receipt = await rpc('eth_getTransactionReceipt', [txHash]);
        if (receipt) return receipt.status === '0x1';
      } catch (e) {}
      await new Promise(function(r) { setTimeout(r, 2000); });
    }
    return false;
  }

})();
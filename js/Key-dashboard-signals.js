// ═══════════════════════════════════════════════════════════════════════════
// Z1N Key Dashboard - Signals Tab Functions
// Version: 2.3.0-Ω (Free Signals)
// File: js/key-dashboard-signals.js
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // State
  var signalSelectedIntent = 0;
  var signalStealthEnabled = false;
  var allSentSignals = [];
  var allReceivedReplies = [];

  // ─────────────────────────────────────────────────────────────────────────
  // INTENT SELECTION
  // ─────────────────────────────────────────────────────────────────────────
  window.selectSignalIntent = function(intent) {
    signalSelectedIntent = intent;
    
    document.querySelectorAll('.signal-intent-btn').forEach(function(btn) {
      btn.classList.toggle('selected', parseInt(btn.dataset.intent) === intent);
    });
    
    var contentGroup = document.getElementById('signalContentGroup');
    if (contentGroup) {
      contentGroup.style.display = intent === 3 ? 'none' : 'block';
    }
    
    updateSignalFee();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CHARACTER COUNT
  // ─────────────────────────────────────────────────────────────────────────
  window.updateSignalCharCount = function() {
    var input = document.getElementById('signalContentInput');
    var counter = document.getElementById('signalCharCount');
    if (input && counter) {
      counter.textContent = input.value.length + ' / 280';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // REPLY TOGGLE
  // ─────────────────────────────────────────────────────────────────────────
  window.toggleSignalReply = function() {
    var checkbox = document.getElementById('signalReplyCheckbox');
    var toggle = document.getElementById('signalReplyToggle');
    var replyInput = document.getElementById('signalReplyInput');
    
    var isChecked = checkbox && checkbox.checked;
    
    if (toggle) toggle.classList.toggle('active', isChecked);
    if (replyInput) replyInput.classList.toggle('visible', isChecked);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEALTH TOGGLE
  // ─────────────────────────────────────────────────────────────────────────
  window.toggleSignalStealth = function() {
    if (typeof stealthRelayerAvailable !== 'undefined' && !stealthRelayerAvailable) {
      if (typeof showToast === 'function') showToast('Stealth relayer not available', 3000);
      return;
    }
    
    signalStealthEnabled = !signalStealthEnabled;
    
    var toggle = document.getElementById('signalStealthToggle');
    var icon = document.getElementById('signalStealthIcon');
    var label = document.getElementById('signalStealthLabel');
    var submitBtn = document.getElementById('signalSubmitBtn');
    
    if (toggle) toggle.classList.toggle('active', signalStealthEnabled);
    
    if (signalStealthEnabled) {
      if (icon) { icon.textContent = '👁‍🗨'; icon.style.opacity = '0.5'; }
      if (label) { label.textContent = 'Hidden'; }
      if (submitBtn) submitBtn.textContent = '👁‍🗨 Submit Hidden';
    } else {
      if (icon) { icon.textContent = '👁'; icon.style.opacity = '1'; }
      if (label) { label.textContent = 'Visible'; }
      if (submitBtn) submitBtn.textContent = 'Submit Signal';
    }
    
    updateSignalFee();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FEE UPDATE - v2.3.0-Ω: All signals are FREE
  // ─────────────────────────────────────────────────────────────────────────
  function updateSignalFee() {
    var feeDisplay = document.getElementById('signalFeeDisplay');
    if (!feeDisplay) return;
    
    if (signalStealthEnabled) {
      feeDisplay.innerHTML = '<span style="color:var(--stealth-color);">FREE (Hidden)</span>';
    } else {
      feeDisplay.innerHTML = '<span style="color:#4ade80;">FREE</span>';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT SIGNAL - v2.3.0-Ω: No fee required
  // ─────────────────────────────────────────────────────────────────────────
  window.submitNewSignal = async function() {
    var status = document.getElementById('signalStatus');
    var content = document.getElementById('signalContentInput').value.trim();
    
    if (signalSelectedIntent !== 3 && !content) {
      status.innerHTML = '<div class="status-msg error">Enter signal content.</div>';
      return;
    }
    
    if (typeof signalsUsed !== 'undefined' && signalsUsed >= 2) {
      status.innerHTML = '<div class="status-msg error">Max 2 signals per epoch.</div>';
      return;
    }
    
    status.innerHTML = '<div class="status-msg pending">Preparing signal...</div>';
    
    try {
      if (typeof loadEthers === 'function') await loadEthers();
      
      var hash = '0x' + (Date.now().toString(16) + Math.random().toString(16).slice(2)).padEnd(64, '0').slice(0, 64);
      var cid = signalSelectedIntent === 3 ? '' : content.slice(0, 250);
      var sym = 0;
      var intent = signalSelectedIntent;
      var stype = signalSelectedIntent === 3 ? 3 : 2;
      var eref = 0;
      var reply = '0x' + '0'.repeat(64);
      
      var replyCheckbox = document.getElementById('signalReplyCheckbox');
      if (replyCheckbox && replyCheckbox.checked) {
        var replyHash = document.getElementById('signalReplyHash').value.trim();
        if (replyHash && replyHash.startsWith('0x') && replyHash.length >= 66) {
          reply = replyHash.slice(0, 66);
          stype = 1;
          eref = (typeof currentEpoch !== 'undefined' && currentEpoch > 0) ? currentEpoch - 1 : 0;
        }
      }
      
      // Stealth mode
      if (signalStealthEnabled && typeof stealthRelayerAvailable !== 'undefined' && stealthRelayerAvailable) {
        status.innerHTML = '<div class="status-msg pending">🔒 Stealth mode: Sign message...</div>';
        
        try {
          var result = await submitStealthSignal(currentKeyId, hash, intent, sym, eref, reply);
          if (typeof signalsUsed !== 'undefined') signalsUsed++;
          if (typeof updateDots === 'function') updateDots();
          document.getElementById('signalContentInput').value = '';
          updateSignalCharCount();
          status.innerHTML = '<div class="status-msg success">🔒 Stealth signal submitted! <a href="' + EXPLORER + '/tx/' + result.txHash + '" target="_blank">View tx</a></div>';
          if (typeof showToast === 'function') showToast('🔒 Stealth signal submitted!', 4000);
          await loadSentSignals();
          return;
        } catch (e) {
          status.innerHTML = '<div class="status-msg error">Stealth failed: ' + (e.message || 'Unknown error').slice(0, 150) + '</div>';
          return;
        }
      }
      
      // Normal mode - v2.3.0-Ω: No fee required
      var iface = new ethersLib.Interface(['function submitSignal(uint256 tokenId, bytes32 signalHash, string cid, uint8 symbolIndex, uint8 intent, uint8 signalType, uint16 epochRef, bytes32 replyTo)']);
      var data = iface.encodeFunctionData('submitSignal', [currentKeyId, hash, cid, sym, intent, stype, eref, reply]);
      
      status.innerHTML = '<div class="status-msg pending">Confirm in wallet...</div>';
      
      // v2.3.0-Ω: value is 0 (no fee)
      var txParams = { from: currentAccount, to: Z1N_SIGNAL, data: data };
      var tx = await provider.request({ method: 'eth_sendTransaction', params: [txParams] });
      
      status.innerHTML = '<div class="status-msg pending">Transaction sent...</div>';
      
      for (var i = 0; i < 60; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        var rc = await rpc('eth_getTransactionReceipt', [tx]);
        if (rc && rc.status === '0x1') {
          if (typeof signalsUsed !== 'undefined') signalsUsed++;
          if (typeof updateDots === 'function') updateDots();
          document.getElementById('signalContentInput').value = '';
          updateSignalCharCount();
          status.innerHTML = '<div class="status-msg success">✅ Signal submitted! <a href="' + EXPLORER + '/tx/' + tx + '" target="_blank">View tx</a></div>';
          if (typeof showToast === 'function') showToast('✅ Signal submitted!', 4000);
          await loadSentSignals();
          return;
        }
        if (rc && rc.status === '0x0') {
          status.innerHTML = '<div class="status-msg error">Transaction reverted.</div>';
          return;
        }
      }
      status.innerHTML = '<div class="status-msg error">Timeout waiting for confirmation.</div>';
    } catch (e) {
      status.innerHTML = '<div class="status-msg error">' + (e.message || 'Failed').slice(0, 200) + '</div>';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD SENT SIGNALS
  // ─────────────────────────────────────────────────────────────────────────
  window.loadSentSignals = async function() {
    var list = document.getElementById('sentSignalsList');
    var countBadge = document.getElementById('sentSignalsCount');
    if (!list || typeof currentKeyId === 'undefined' || currentKeyId === null) return;
    
    list.innerHTML = '<div class="signal-loading">Loading signals...</div>';
    
    try {
      var params = new URLSearchParams();
      params.set('keyId', String(currentKeyId));
      params.set('limit', '50');
      params.set('sort', 'recent');
      
      var filter = document.getElementById('sentSignalsFilter');
      if (filter && filter.value) {
        params.set('intents', filter.value);
      }
      
      var r = await fetch(API_BASE + '/signals?' + params.toString(), { cache: 'no-store' });
      var d = await r.json();
      var sigs = d.signals || [];
      allSentSignals = sigs;
      
      if (countBadge) countBadge.textContent = sigs.length;
      
      if (sigs.length === 0) {
        list.innerHTML = '<div class="replies-empty"><div class="replies-empty-icon">📡</div><div class="replies-empty-text">No signals sent yet</div><div class="replies-empty-hint">Submit your first signal above</div></div>';
        return;
      }
      
      list.innerHTML = '';
      var intentSymbols = ['ΩC', 'ΩI', 'ΩK', 'ΩS'];
      var intentClasses = ['oc', 'oi', 'ok', 'os'];
      
      sigs.forEach(function(sig) {
        var div = document.createElement('div');
        div.className = 'sent-signal-item';
        
        var content = sig.cid || '[Silence]';
        if (content.length > 60) content = content.slice(0, 60) + '...';
        
        var replyBadge = '';
        if (sig.isReply && sig.replyTo) {
          replyBadge = '<div class="sent-signal-reply-badge"><span class="reply-icon">↩</span> Reply to ' + sig.replyTo.slice(0, 10) + '...</div>';
        }
        
        div.innerHTML = 
          '<div class="sent-signal-main">' +
            '<div class="sent-signal-top">' +
              '<span class="signal-intent-tag ' + intentClasses[sig.intent] + '">' + intentSymbols[sig.intent] + '</span>' +
              '<span class="signal-epoch-tag">E' + sig.epoch + '</span>' +
            '</div>' +
            '<div class="sent-signal-content">' + (typeof escapeHtml === 'function' ? escapeHtml(content) : content) + '</div>' +
            replyBadge +
          '</div>' +
          '<div class="sent-signal-meta">' +
            '<span class="sent-signal-attests">✓' + (sig.attestCount || 0) + '</span>' +
            '<span class="sent-signal-time">' + (sig.timeAgo || '') + '</span>' +
          '</div>';
        
        list.appendChild(div);
      });
    } catch (e) {
      list.innerHTML = '<div class="signal-loading" style="color:#f87171;">Error loading signals</div>';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD REPLIES TO YOUR SIGNALS
  // ─────────────────────────────────────────────────────────────────────────
  window.loadReceivedReplies = async function() {
    var list = document.getElementById('repliesList');
    var countBadge = document.getElementById('repliesCount');
    var csvBtn = document.getElementById('repliesCsvBtn');
    if (!list || typeof currentKeyId === 'undefined' || currentKeyId === null) return;
    
    list.innerHTML = '<div class="signal-loading">Loading replies...</div>';
    
    try {
      var r = await fetch(API_BASE + '/keys/' + currentKeyId + '/replies', { cache: 'no-store' });
      
      if (!r.ok) {
        if (countBadge) countBadge.textContent = '0';
        list.innerHTML = '<div class="replies-empty"><div class="replies-empty-icon">💬</div><div class="replies-empty-text">No replies to your signals yet</div><div class="replies-empty-hint">When others reply to your signals, they\'ll appear here</div></div>';
        return;
      }
      
      var d = await r.json();
      var replies = d.replies || [];
      allReceivedReplies = replies;
      
      if (countBadge) countBadge.textContent = replies.length;
      if (csvBtn) csvBtn.style.display = replies.length > 0 ? 'block' : 'none';
      
      if (replies.length === 0) {
        list.innerHTML = '<div class="replies-empty"><div class="replies-empty-icon">💬</div><div class="replies-empty-text">No replies to your signals yet</div><div class="replies-empty-hint">When others reply to your signals, they\'ll appear here</div></div>';
        return;
      }
      
      list.innerHTML = '';
      var intentSymbols = ['ΩC', 'ΩI', 'ΩK', 'ΩS'];
      var intentClasses = ['oc', 'oi', 'ok', 'os'];
      
      replies.forEach(function(reply) {
        var div = document.createElement('div');
        div.className = 'reply-item';
        
        var content = reply.cid || '[Silence]';
        if (content.length > 150) content = content.slice(0, 150) + '...';
        
        div.innerHTML = 
          '<div class="reply-item-top">' +
            '<div class="reply-item-meta">' +
              '<span class="reply-item-key">K#' + reply.keyId + '</span>' +
              '<span class="signal-intent-tag ' + intentClasses[reply.intent] + '">' + intentSymbols[reply.intent] + '</span>' +
              '<span class="signal-epoch-tag">E' + reply.epoch + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
              '<span class="reply-item-attests">✓' + (reply.attestCount || 0) + '</span>' +
              '<span class="reply-item-time">' + (reply.timeAgo || '') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="reply-item-content">' + (typeof escapeHtml === 'function' ? escapeHtml(content) : content) + '</div>' +
          '<div class="reply-item-context">' +
            '<div class="reply-item-parent">' +
              '<span class="reply-icon">↩</span>' +
              '<span>Replied to your E' + (reply.parentEpoch || '?') + ' signal</span>' +
            '</div>' +
            '<button class="reply-item-action" onclick="replyToSignal(\'' + reply.signalHash + '\')">Reply Back</button>' +
          '</div>';
        
        list.appendChild(div);
      });
    } catch (e) {
      console.error('loadReceivedReplies error:', e);
      if (countBadge) countBadge.textContent = '0';
      list.innerHTML = '<div class="replies-empty"><div class="replies-empty-icon">💬</div><div class="replies-empty-text">No replies to your signals yet</div><div class="replies-empty-hint">When others reply to your signals, they\'ll appear here</div></div>';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // REPLY TO SIGNAL
  // ─────────────────────────────────────────────────────────────────────────
  window.replyToSignal = function(signalHash) {
    var checkbox = document.getElementById('signalReplyCheckbox');
    if (checkbox) {
      checkbox.checked = true;
      toggleSignalReply();
    }
    
    var hashInput = document.getElementById('signalReplyHash');
    if (hashInput) {
      hashInput.value = signalHash;
    }
    
    var signalCard = document.querySelector('.new-signal-card');
    if (signalCard) {
      signalCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    if (typeof showToast === 'function') showToast('Signal selected for reply', 2000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE SIGNALS TAB
  // ─────────────────────────────────────────────────────────────────────────
  window.initSignalsTab = function() {
    loadSentSignals();
    loadReceivedReplies();
    
    // Update epoch display
    if (typeof currentEpoch !== 'undefined') {
      var epochDisplay = document.getElementById('signalEpochDisplay');
      if (epochDisplay) epochDisplay.textContent = 'Epoch ' + currentEpoch;
    }
  };

  // Epoch timer
  setInterval(function() {
    var now = Math.floor(Date.now() / 1000);
    var rem = 1800 - (now % 1800);
    var m = Math.floor(rem / 60);
    var s = rem % 60;
    var display = '⏱ ' + m + ':' + String(s).padStart(2, '0');
    
    var timer = document.getElementById('signalEpochTimer');
    if (timer) timer.textContent = display;
  }, 1000);

})();
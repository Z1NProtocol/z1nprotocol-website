/**
 * Z1N Protocol - Key Dashboard JavaScript
 * Version: 2.3.1-Ω
 * FIXES: Tab parameter, key ID preservation, original canon design
 */
(function(){
  'use strict';

  var CHAIN_ID = '0x89';
  var Z1N_KEY = '0x51A708cC79591cdE831B64773150cFaA41be3059';
  var Z1N_CORE = '0x42a08ccEA283127CaB427A880C8141eB14DC22d2';
  var Z1N_SIGNAL = '0xaB9D716c2799A95aE2A3640faAcc0148FC37F52D';
  var Z1N_ARTEFACT = '0x8f9C9760D530aA58A9cf13406888958c6856f326';
  var RPC_URLS = ['https://polygon-mainnet.g.alchemy.com/v2/P7YcT2oy0Mfad2Pedbe3y'];
  var currentRpcIndex = 0;
  var EXPLORER = 'https://polygonscan.com';
  var API_BASE = 'https://z1n-backend-production.up.railway.app/api';
  var SUBMISSION_FEE = '0';
  var SILENCE_FEE = '0';
  var ATTEST_FEE = '0';
  var MINT_PRICE = '0x1236efcbcbb340000';
  var SEL = { balanceOf: '0x70a08231', tokenOfOwnerByIndex: '0x2f745c59', ownerOf: '0x6352211e', glyphs: '0x887296c3', activeEpoch: '0x76671808', signalCount: '0xfd68f0e5', attestCount: '0xfe6569d7' };
  var GLYPHS = ['∞','π','⋮','⊕','⊗','∴','∵','↔','↻','△','◇','○','●','□','☰','☷','⚑','✱','⊥','≡','◊'];
  
  var canonSortMode = 'latest';
  var canonAnchors = [];
  var keyMintEpoch = 0;

  var provider = null, currentAccount = null, currentKeyId = null, walletKeyIds = [], activeEpoch = 0, selectedIntent = 0, signalType = 'new', signalsUsed = 0, attestsUsed = 0, ethersLib = null, selectedAttestSignal = null, allAttestableSignals = [], allSentSignals = [], keyGlyphsCache = {};
  var pogStealthEnabled = false, attestStealthEnabled = false, stealthRelayerAvailable = false;
  var replyModalOffset = 0, replyModalLimit = 20, replySelectedSignal = null, replyFilterTimer = null, allReplySignals = [];
  var hasFirstArtefact = false, allLiveArtefacts = [], allSentAttests = [];
  var presenceFilter = 'all';


  // URL PARAMETERS
  var urlParams = new URLSearchParams(window.location.search);
  var urlKeyId = urlParams.get('key') ? parseInt(urlParams.get('key'), 10) : null;
  var urlWallet = urlParams.get('wallet') ? urlParams.get('wallet').toLowerCase().trim() : null;
  var urlTab = urlParams.get('tab') ? urlParams.get('tab').toLowerCase().trim() : null;

  // Safety warning - check localStorage
var safetyWarningDismissed = localStorage.getItem('z1n_safety_warning_dismissed') === 'true';

function showSafetyWarning(callback) {
  if (safetyWarningDismissed) {
    if (callback) callback();
    return;
  }
  
  var modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'safetyWarningModal';
  modal.innerHTML = '<div class="modal" style="max-width:420px;">' +
    '<div class="modal-header" style="border-bottom:1px solid var(--card-border);padding-bottom:12px;margin-bottom:16px;">' +
      '<span style="font-size:24px;margin-right:8px;">⚠️</span>' +
      '<h3 style="margin:0;color:#f87171;">Safety Notice</h3>' +
    '</div>' +
    '<div class="modal-body" style="font-size:13px;line-height:1.6;color:var(--text-soft);">' +
      '<p style="margin:0 0 12px 0;">Signals and whispers are <strong style="color:var(--text);">user-generated content</strong>. Be cautious of:</p>' +
      '<ul style="margin:0 0 16px 0;padding-left:20px;">' +
        '<li style="margin-bottom:6px;"><span style="color:#f87171;">🔗 External links</span> — may lead to phishing sites</li>' +
        '<li style="margin-bottom:6px;"><span style="color:#f87171;">💰 Financial offers</span> — "free tokens", "airdrops", etc.</li>' +
        '<li style="margin-bottom:6px;"><span style="color:#f87171;">🔑 Requests for keys/seeds</span> — never share these</li>' +
      '</ul>' +
      '<p style="margin:0;font-size:12px;opacity:0.8;">Z1N Protocol cannot verify or moderate on-chain content.</p>' +
    '</div>' +
    '<div style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">' +
      '<button id="safetyWarningContinue" style="width:100%;padding:10px 16px;background:var(--accent);border:none;border-radius:6px;color:#000;font-weight:600;cursor:pointer;">I understand, continue</button>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-soft);cursor:pointer;">' +
        '<input type="checkbox" id="safetyWarningDontShow" style="cursor:pointer;">' +
        '<span>Don\'t show this again</span>' +
      '</label>' +
    '</div>' +
  '</div>';
  
  document.body.appendChild(modal);
  
  document.getElementById('safetyWarningContinue').onclick = function() {
    var dontShow = document.getElementById('safetyWarningDontShow').checked;
    if (dontShow) {
      localStorage.setItem('z1n_safety_warning_dismissed', 'true');
      safetyWarningDismissed = true;
    }
    modal.remove();
    if (callback) callback();
  };
  
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  };
}


  function enc256(v) { return BigInt(v).toString(16).padStart(64, '0'); }
  function encAddr(a) { return a.slice(2).toLowerCase().padStart(64, '0'); }
 function escapeHtml(t) { 
  var d = document.createElement('div'); 
  d.textContent = t; 
  var escaped = d.innerHTML;
  var urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]*\.(com|org|net|io|xyz|co|app|link|click|finance|claim|money|free|win|gift|promo)[^\s]*)/gi;
  if (urlPattern.test(t)) {
    escaped = escaped.replace(urlPattern, '<span style="color:#f87171;background:rgba(248,113,113,0.15);padding:0 3px;border-radius:2px;text-decoration:line-through;">$&</span>');
    escaped = '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(248,113,113,0.2);border:1px solid rgba(248,113,113,0.4);border-radius:4px;padding:2px 6px;margin-right:6px;font-size:10px;color:#f87171;vertical-align:middle;">⚠️ Contains link - verify before visiting</span>' + escaped;
  }
  return escaped; 
}

  function buildSignalContentHtml(content) {
    if (!content || content === '[Silence]') return escapeHtml(content || '[Silence]');
    var len = content.length;
    if (len <= 256) return escapeHtml(content);
    var white = content.slice(0, 256);
    var orange = content.slice(256, Math.min(len, 304));
    var red = content.slice(304, 320);
    var html = escapeHtml(white);
    if (orange) html += '<span style="color:#ffd556;">' + escapeHtml(orange) + '</span>';
    if (red) html += '<span style="color:#f87171;font-weight:600;">' + escapeHtml(red) + '</span>';
    return html;
  }
  function showToast(message, duration, isError, isInfo) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('error', 'info');
    if (isError) toast.classList.add('error');
    if (isInfo) toast.classList.add('info');
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show', 'error', 'info'); }, duration || 3000);
  }
  function shortAddr(a) { return a ? a.slice(0,6) + '...' + a.slice(-4) : '—'; }

  function getProvider() {
    if (window.ethereum && window.ethereum.providers && window.ethereum.providers.length) { var mm = window.ethereum.providers.find(function(p){ return p.isMetaMask && !p.isBraveWallet; }); if (mm) return mm; return window.ethereum.providers[0]; }
    if (window.ethereum) return window.ethereum;
    if (window.phantom && window.phantom.ethereum) return window.phantom.ethereum;
    return null;
  }

  async function rpc(method, params) {
    var lastError = null;
    for (var i = 0; i < RPC_URLS.length; i++) {
      var rpcUrl = RPC_URLS[(currentRpcIndex + i) % RPC_URLS.length];
      try {
        var response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) });
        var data = await response.json();
        if (data.error) { if (data.error.message && (data.error.message.includes('rate') || data.error.message.includes('Too Many'))) { currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length; continue; } throw new Error(data.error.message); }
        return data.result;
      } catch (err) { lastError = err; currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length; }
    }
    throw lastError || new Error('All RPCs failed');
  }

  function decGlyphs(len, pack) { if (len === 0 || pack === BigInt(0)) return null; var s = []; for (var i = 0; i < len; i++) { var idx = Number((pack >> BigInt(5 * (7 - 1 - i))) & BigInt(0x1F)); if (idx < GLYPHS.length) s.push(GLYPHS[idx]); } return s.join(' · '); }

  async function loadEthers() { if (ethersLib) return ethersLib; return new Promise(function(res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js'; s.onload = function() { ethersLib = window.ethers; res(ethersLib); }; s.onerror = rej; document.head.appendChild(s); }); }
  loadEthers().catch(function(){});

// ═══════════════════════════════════════════════════════════════
  // TAB SWITCHING - With URL parameter support
  // ═══════════════════════════════════════════════════════════════
  
  window.switchTab = function(tabId) {
  var tabs = ['overview', 'signals', 'attests', 'direct', 'canon', 'artefacts', 'treasury'];
  document.querySelectorAll('.tab-btn').forEach(function(btn, i) { btn.classList.toggle('active', tabs[i] === tabId); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  var el = document.getElementById('tab-' + tabId); if (el) el.classList.add('active');
  
  var eye = document.getElementById('globalStealthToggle');
  var tooltip = document.getElementById('stealthTooltip');
  
  if (tabId === 'direct') {
    if (eye) { eye.style.display = 'none'; }
    if (typeof loadDirectChannel === 'function') loadDirectChannel();
  } else if (tabId === 'signals' || tabId === 'attests') {
    if (eye) {
      eye.style.display = 'flex';
      eye.classList.remove('whisper-disabled');
      eye.style.cursor = 'pointer';
      eye.onclick = toggleGlobalStealth;
      eye.classList.toggle('active', globalStealthEnabled);
    }
    if (tooltip) {
      tooltip.innerHTML = '<div class="tt-title">Stealth Mode</div><div class="tt-body">When active (red), your signals and attestations are submitted through a relayer. Your wallet address stays hidden on-chain.</div>';
    }
  } else {
    // Overview, Artefacts, Canon, Treasury - hide eye
    if (eye) {
      eye.style.display = 'none';
    }
  }
  
  // Load tab-specific data only if key is loaded
  if (currentKeyId !== null) {
    if (tabId === 'overview') {
      if (ActivityFeed.loaded) {
        renderActivityFeed();
      } else {
        loadActivityFeed();
      }
    }
    if (tabId === 'canon') {
      var canonReturn = sessionStorage.getItem('canonReturnUrl');
      if (canonReturn) { sessionStorage.removeItem('canonReturnUrl'); }
      loadCanonData();
    }
    if (tabId === 'artefacts') {
  if (window.Z1NArtefacts && window.Z1NArtefacts.refresh) {
    window.Z1NArtefacts.refresh();
  }
}
    if (tabId === 'treasury') loadTreasuryData();
  }

  // Call onTabSwitch with safety - skip if ActivityFeed not ready
  if (typeof ActivityFeed !== 'undefined' && ActivityFeed.loaded) {
    updateTabBadges();
  }
};

  function switchToUrlTab() {
    if (urlTab) {
      var validTabs = ['overview', 'signals', 'attests', 'direct', 'artefacts', 'canon', 'treasury'];
      if (validTabs.includes(urlTab)) {
        console.log('Switching to URL tab:', urlTab);
        switchTab(urlTab);
      }
    }
  }

  async function checkStealthAvailability() {
    try { var r = await fetch(API_BASE + '/relay/health', { cache: 'no-store' }); var d = await r.json(); stealthRelayerAvailable = d.status === 'ready'; if (!stealthRelayerAvailable) { var pt = document.getElementById('pogStealthToggle'); var at = document.getElementById('attestStealthToggle'); if (pt) { pt.classList.add('disabled'); pt.onclick = null; } if (at) { at.classList.add('disabled'); at.onclick = null; } } } catch (e) { stealthRelayerAvailable = false; }
  }

  window.togglePogStealth = function() {
    if (!stealthRelayerAvailable) { showToast('Stealth relayer not available', 3000); return; }
    pogStealthEnabled = !pogStealthEnabled;
    var toggle = document.getElementById('pogStealthToggle'), icon = document.getElementById('pogStealthIcon'), label = document.getElementById('pogStealthLabel'), feeDisplay = document.getElementById('pogFee'), submitBtn = document.getElementById('btnSubmitPog');
    toggle.classList.toggle('active', pogStealthEnabled);
    if (pogStealthEnabled) { icon.textContent = '👁‍🗨'; icon.style.opacity = '0.5'; label.textContent = 'Hidden'; label.style.color = 'var(--stealth-color)'; submitBtn.textContent = '👁‍🗨 Submit Hidden'; }
    else { icon.textContent = '👁'; icon.style.opacity = '1'; label.textContent = 'Visible'; label.style.color = 'var(--accent)'; submitBtn.textContent = 'Submit Signal'; }
  };

  window.toggleAttestStealth = function() {
    if (!stealthRelayerAvailable) { showToast('Stealth relayer not available', 3000); return; }
    attestStealthEnabled = !attestStealthEnabled;
    var toggle = document.getElementById('attestStealthToggle'), icon = document.getElementById('attestStealthIcon'), label = document.getElementById('attestStealthLabel');
    toggle.classList.toggle('active', attestStealthEnabled);
    if (attestStealthEnabled) { icon.textContent = '👁‍🗨'; icon.style.opacity = '0.5'; label.textContent = 'Hidden'; label.style.color = 'var(--stealth-color)'; }
    else { icon.textContent = '👁'; icon.style.opacity = '1'; label.textContent = 'Visible'; label.style.color = 'var(--accent)'; }
    updateAttestBtn();
  };

  async function signTypedData(domain, types, primaryType, message) {
    var typedData = { types: { EIP712Domain: [{ name: 'name', type: 'string' },{ name: 'version', type: 'string' },{ name: 'chainId', type: 'uint256' },{ name: 'verifyingContract', type: 'address' }] }, primaryType: primaryType, domain: domain, message: message };
    for (var k in types) { typedData.types[k] = types[k]; }
    return await provider.request({ method: 'eth_signTypedData_v4', params: [currentAccount, JSON.stringify(typedData)] });
  }

  async function submitStealthSignal(keyId, signalHash, intent, symbolIndex, epochRef, replyTo) {
    var prepareUrl = API_BASE + '/relay/signal/prepare/' + keyId + '?' + new URLSearchParams({ signalHash: signalHash, intent: String(intent), symbolIndex: String(symbolIndex || 0), epochRef: String(epochRef || 0), replyTo: replyTo || '0x0000000000000000000000000000000000000000000000000000000000000000' });
    var prepareRes = await fetch(prepareUrl); if (!prepareRes.ok) { var err = await prepareRes.json(); throw new Error(err.error || 'Failed to prepare'); }
    var prepareData = await prepareRes.json();
    var signature = await signTypedData(prepareData.domain, prepareData.types, prepareData.primaryType, prepareData.message);
    var submitRes = await fetch(API_BASE + '/relay/signal/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature: signature, keyId: keyId, signalHash: prepareData.message.signalHash, intent: prepareData.message.intent, symbolIndex: prepareData.message.symbolIndex, epochRef: prepareData.message.epochRef, replyTo: prepareData.message.replyTo, deadline: prepareData.message.deadline }) });
    var result = await submitRes.json(); if (!result.success) throw new Error(result.error || 'Relay failed'); return result;
  }

  async function submitStealthAttestation(keyId, signalHash) {
    var prepareUrl = API_BASE + '/relay/attest/prepare/' + keyId + '?signalHash=' + encodeURIComponent(signalHash);
    var prepareRes = await fetch(prepareUrl); if (!prepareRes.ok) { var err = await prepareRes.json(); throw new Error(err.error || 'Failed to prepare'); }
    var prepareData = await prepareRes.json();
    var signature = await signTypedData(prepareData.domain, prepareData.types, prepareData.primaryType, prepareData.message);
    var submitRes = await fetch(API_BASE + '/relay/attest/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature: signature, keyId: keyId, signalHash: prepareData.message.signalHash, deadline: prepareData.message.deadline }) });
    var result = await submitRes.json(); if (!result.success) throw new Error(result.error || 'Relay failed'); return result;
  }

  window.selectIntent = function(i) { selectedIntent = i; document.querySelectorAll('.intent-btn').forEach(function(b) { b.classList.toggle('selected', parseInt(b.dataset.intent) === i); }); var cc = document.getElementById('signalContentCard'); if (cc) cc.style.display = i === 3 ? 'none' : 'block'; };
  window.setSignalType = function(t) { signalType = t; document.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.type === t); }); var rs = document.getElementById('replySection'); if (rs) rs.classList.toggle('active', t === 'reply'); };

var globalStealthEnabled = false;

window.toggleGlobalStealth = function() {
  if (!stealthRelayerAvailable) { showToast('Stealth relayer not available', 3000); return; }
  globalStealthEnabled = !globalStealthEnabled;
  pogStealthEnabled = globalStealthEnabled;
  attestStealthEnabled = globalStealthEnabled;
  var toggle = document.getElementById('globalStealthToggle');
  var tooltip = document.getElementById('stealthTooltip');
  var feeDisplay = document.getElementById('pogFee');
  var submitBtn = document.getElementById('btnSubmitPog');
  if (toggle) toggle.classList.toggle('active', globalStealthEnabled);
  if (tooltip) tooltip.classList.toggle('active-stealth', globalStealthEnabled);
  if (globalStealthEnabled) {
    if (submitBtn) submitBtn.textContent = '👁‍🗨 Submit Hidden';
    showToast('🔴 Stealth ON', 2000);
  } else {
    if (submitBtn) submitBtn.textContent = 'Submit Signal';
    showToast('🟢 Stealth OFF', 2000);
  }
};

  window.toggleReplySection = function() {
  var checkbox = document.getElementById('replyCheckbox');
  var section = document.getElementById('replySection');
  if (checkbox && section) {
    section.style.display = checkbox.checked ? 'block' : 'none';
    signalType = checkbox.checked ? 'reply' : 'new';
  }
};

  window.updateCharCount = function() {
    var el = document.getElementById('charCount');
    var ta = document.getElementById('signalContent');
    var indicator = document.getElementById('signalZoneIndicator');
    if (!el || !ta) return;
    var len = ta.value.length;
    el.textContent = len + ' / 320';
    el.classList.remove('zone-normal', 'zone-orange', 'zone-red');
    ta.classList.remove('zone-orange', 'zone-red');
    if (len > 304) {
      el.classList.add('zone-red');
      ta.classList.add('zone-red');
      if (indicator) { indicator.style.display = 'block'; indicator.innerHTML = '<span style="color:#f87171;">⚠ Last ' + (320 - len) + ' chars — inscription zone (on-chain permanent)</span>'; }
    } else if (len > 256) {
      el.classList.add('zone-orange');
      ta.classList.add('zone-orange');
      if (indicator) { indicator.style.display = 'block'; indicator.innerHTML = '<span style="color:#ffd556;">◈ Extended field — ' + (304 - len) + ' chars until inscription zone</span>'; }
    } else {
      el.classList.add('zone-normal');
      if (indicator) indicator.style.display = 'none';
    }
  };
  window.updateWhisperCharCount = function() { var el = document.getElementById('whisperCharCount'), ta = document.getElementById('whisperContent'); if (el && ta) el.textContent = ta.value.length + ' / 500'; };

  function updateDots() { var tsd = document.getElementById('tabSignalDots'), tad = document.getElementById('tabAttestDots'); var f = '<span class="tab-dot filled"></span>', o = '<span class="tab-dot open"></span>'; if (tsd) tsd.innerHTML = (signalsUsed >= 1 ? f : o) + (signalsUsed >= 2 ? f : o); if (tad) tad.innerHTML = (attestsUsed >= 1 ? f : o) + (attestsUsed >= 2 ? f : o); }

   setInterval(function() { 
  var EPOCH_DURATION = 75600; // 21 hours mainnet
  var EPOCH_GENESIS = 1772917310; // Mainnet genesis — contract verified
  var now = Math.floor(Date.now() / 1000);
  var timeSinceGenesis = now - EPOCH_GENESIS;
  var rem = EPOCH_DURATION - (timeSinceGenesis % EPOCH_DURATION);
  
  var h = Math.floor(rem / 3600);
  var m = Math.floor((rem % 3600) / 60);
  var s = rem % 60;
  
  var d;
  if (h > 0) {
    // Meer dan 1 uur: uren + minuten
    d = '⏱ ' + h + 'h ' + String(m).padStart(2, '0') + 'm';
  } else {
    // Laatste uur: minuten + seconden
    d = '⏱ ' + m + 'm ' + String(s).padStart(2, '0') + 's';
  }
  
  ['pogEpochTimer', 'attestEpochTimer'].forEach(function(id) { 
    var el = document.getElementById(id); 
    if (el) el.textContent = d; 
  }); 
}, 1000);

  async function fetchKeyGlyphs(keyIds) { var missing = keyIds.filter(function(id) { return !keyGlyphsCache[id]; }); if (missing.length === 0) return; try { var r = await fetch(API_BASE + '/keys', {cache: 'no-store'}); var d = await r.json(); if (d.keys) d.keys.forEach(function(k) { keyGlyphsCache[k.tokenId] = k.glyphLine || ''; }); } catch (e) {} }
  function getShortGlyphs(keyId) { var full = keyGlyphsCache[keyId] || ''; if (!full) return ''; return full; }

  // ═══════════════════════════════════════════════════════════════
  // REPLY MODAL
  // ═══════════════════════════════════════════════════════════════
  window.openReplyModal = function() { var m = document.getElementById('replyModal'); if (m) { m.classList.add('active'); loadReplyModalSignals(); } };
  window.closeReplyModal = function() { var m = document.getElementById('replyModal'); if (m) m.classList.remove('active'); };
  window.resetReplyFilters = function() { ['replyFilterKeyId','replyFilterEpochFrom','replyFilterEpochTo'].forEach(function(id){ var el = document.getElementById(id); if(el) el.value=''; }); var s = document.getElementById('replyFilterSort'); if(s) s.value='recent'; ['replyFilterIntentC','replyFilterIntentI','replyFilterIntentK','replyFilterIntentS'].forEach(function(id){ var el = document.getElementById(id); if(el) el.checked=true; }); replyModalOffset=0; replySelectedSignal=null; loadReplyModalSignals(); };
  window.debouncedReplyFilter = function() { clearTimeout(replyFilterTimer); replyFilterTimer = setTimeout(function(){ replyModalOffset=0; replySelectedSignal=null; loadReplyModalSignals(); }, 300); };
  window.immediateReplyFilter = function() { clearTimeout(replyFilterTimer); replyModalOffset=0; replySelectedSignal=null; loadReplyModalSignals(); };

  async function loadReplyModalSignals(append) {
    var list = document.getElementById('replySignalsList'), loading = document.getElementById('replySignalsLoading'), noSig = document.getElementById('replyNoSignals'), loadBtn = document.getElementById('replyLoadMoreBtn'), countInfo = document.getElementById('replySignalCountInfo'), selectBtn = document.getElementById('btnConfirmReplySelect');
    if (!list) return;
    if (!append) { list.innerHTML = ''; if (loading) loading.style.display = 'block'; if (noSig) noSig.style.display = 'none'; if (loadBtn) loadBtn.style.display = 'none'; if (selectBtn) selectBtn.disabled = true; }
    try {
      var p = new URLSearchParams(); p.set('limit', String(replyModalLimit)); p.set('offset', String(replyModalOffset));
      var kf = document.getElementById('replyFilterKeyId'); if (kf && kf.value.trim()) p.set('keyId', kf.value.trim());
      var ef = document.getElementById('replyFilterEpochFrom'); if (ef && ef.value.trim()) p.set('minEpoch', ef.value.trim());
      var et = document.getElementById('replyFilterEpochTo'); if (et && et.value.trim()) p.set('maxEpoch', et.value.trim());
      var so = document.getElementById('replyFilterSort'); if (so) p.set('sort', so.value);
      var ints = []; if (document.getElementById('replyFilterIntentC')?.checked) ints.push('0'); if (document.getElementById('replyFilterIntentI')?.checked) ints.push('1'); if (document.getElementById('replyFilterIntentK')?.checked) ints.push('2'); if (document.getElementById('replyFilterIntentS')?.checked) ints.push('3');
      if (ints.length === 0) { if (loading) loading.style.display = 'none'; if (noSig) { noSig.textContent = 'No intents selected.'; noSig.style.display = 'block'; } return; }
      if (ints.length < 4) p.set('intents', ints.join(','));
    var r = await fetch(API_BASE + '/signals?' + p.toString(), {cache:'no-store'}), d = await r.json(), sigs = d.signals || []; allSentSignals = sigs;
      if (loading) loading.style.display = 'none';
      var eb = document.getElementById('replyCurrentEpochBadge'); if (eb && d.activeEpoch !== undefined) eb.textContent = '(Epoch ' + d.activeEpoch + ')';
      if (countInfo) countInfo.textContent = (d.total || 0) + ' signals';
      var sigs = d.signals || [];
      if (sigs.length === 0 && !append) { if (noSig) { noSig.textContent = 'No signals found.'; noSig.style.display = 'block'; } return; }
      await fetchKeyGlyphs(sigs.map(function(s){ return s.keyId; }).concat(sigs.map(function(s){ return s.replyToKeyId; }).filter(Boolean)));
      if (!append) allReplySignals = sigs; else allReplySignals = allReplySignals.concat(sigs);
      sigs.forEach(function(sig) {
        var card = document.createElement('div'); card.className = 'signal-card'; card.dataset.hash = sig.hash;
        var ic = (sig.intentSymbol || '').toLowerCase().replace('Ω','O'), sg = getShortGlyphs(sig.keyId), gs = sg ? '<span style="font-size:11px;color:var(--text-soft);margin-left:4px;">' + sg + '</span>' : '';
        card.innerHTML = '<div class="signal-header"><div class="signal-meta"><span class="signal-key">K#'+sig.keyId+'</span>'+gs+'<span class="intent-tag '+ic+'">'+(sig.intentSymbol||'')+'</span><span class="signal-epoch">E'+sig.epoch+'</span><span style="color:#fbbf24;">✓'+(sig.attestCount||0)+'</span></div><span class="signal-time">'+(sig.timeAgo||'')+'</span></div><div class="signal-content">'+escapeHtml(sig.cid||sig.contentRef||'[Silence]')+'</div><div class="signal-hash">'+sig.hash.slice(0,18)+'...</div>';
        card.onclick = function() { document.querySelectorAll('#replySignalsList .signal-card.selected').forEach(function(el){ el.classList.remove('selected'); }); card.classList.add('selected'); replySelectedSignal = sig; if (selectBtn) selectBtn.disabled = false; };
        list.appendChild(card);
      });
      if (loadBtn) loadBtn.style.display = d.hasMore ? 'block' : 'none';
    } catch (e) { if (loading) loading.style.display = 'none'; if (noSig) { noSig.textContent = 'Error: ' + e.message; noSig.style.display = 'block'; } }
  }
  window.loadMoreReplySignals = function() { replyModalOffset += replyModalLimit; loadReplyModalSignals(true); };
  window.confirmReplySignalSelection = function() { if (!replySelectedSignal) return; var el = document.getElementById('replyToHash'); if (el) el.value = replySelectedSignal.hash; closeReplyModal(); showToast('Signal selected for reply', 2000); };
  window.downloadReplySignalsCSV = async function(evt) {
  if (evt) evt.preventDefault();
  showToast('Preparing CSV...', 2000);
  try {
    var p = new URLSearchParams();
    p.set('limit', '1000');
    var kf = document.getElementById('replyFilterKeyId');
    if (kf && kf.value.trim()) p.set('keyId', kf.value.trim());
    var ef = document.getElementById('replyFilterEpochFrom');
    if (ef && ef.value.trim()) p.set('minEpoch', ef.value.trim());
    var et = document.getElementById('replyFilterEpochTo');
    if (et && et.value.trim()) p.set('maxEpoch', et.value.trim());
    var so = document.getElementById('replyFilterSort');
    if (so) p.set('sort', so.value);
    var ints = [];
    var icEl = document.getElementById('replyFilterIntentC'); if (icEl && icEl.checked) ints.push('0');
    var iiEl = document.getElementById('replyFilterIntentI'); if (iiEl && iiEl.checked) ints.push('1');
    var ikEl = document.getElementById('replyFilterIntentK'); if (ikEl && ikEl.checked) ints.push('2');
    var isEl = document.getElementById('replyFilterIntentS'); if (isEl && isEl.checked) ints.push('3');
    if (ints.length > 0 && ints.length < 4) p.set('intents', ints.join(','));
    var r = await fetch(API_BASE + '/signals?' + p.toString(), {cache:'no-store'});
    var d = await r.json();
    var sigs = d.signals || [];
    if (sigs.length === 0) { showToast('No signals to export', 2000); return; }
    var in_ = ['ΩC (Collective)', 'ΩI (Individual)', 'ΩK (Co-Create)', 'ΩS (Silence)'];
    var rows = [['Hash','Key ID','Key Glyphs','Intent','Type','Reply To Hash','Reply To Key ID','Reply To Key Glyphs','Signal Content','Epoch','Attestations','Timestamp']];
    sigs.forEach(function(sig) {
      var isReply = sig.replyTo && sig.replyTo !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      rows.push([
        sig.hash, sig.keyId, keyGlyphsCache[sig.keyId] || '',
        in_[sig.intent] || sig.intentSymbol || '',
        isReply ? 'Reply' : 'New',
        isReply ? sig.replyTo : '',
        isReply && sig.replyToKeyId ? 'K#' + sig.replyToKeyId : '',
        isReply && sig.replyToKeyId ? (keyGlyphsCache[sig.replyToKeyId] || '') : '',
        sig.cid || '[Silence]', sig.epoch, sig.attestCount || 0, sig.timeAgo || ''
      ]);
    });
    downloadCSV(rows, 'z1n_signals_' + new Date().toISOString().slice(0,10) + '.csv');
    showToast('CSV downloaded (' + sigs.length + ' signals)', 2000);
  } catch (e) { showToast('CSV failed: ' + e.message, 3000, true); }
};
  document.addEventListener('click', function(e) { if (e.target.classList.contains('modal-overlay')) { closeReplyModal(); closeArtefactModal(); } });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeReplyModal(); closeArtefactModal(); } });

  // ═══════════════════════════════════════════════════════════════
  // ARTEFACT MODAL
  // ═══════════════════════════════════════════════════════════════
  window.openArtefactModal = function(artefact) {
    var modal = document.getElementById('artefactModal');
    if (!modal) return;
    var title = document.getElementById('artefactModalTitle');
    var body = document.getElementById('artefactModalBody');
    if (title) title.textContent = 'Live Artefact #' + artefact.tokenId;
    var statusText = artefact.isRevoked ? 'Revoked' : 'Active';
    var statusClass = artefact.isRevoked ? 'revoked' : 'active';
    var ownerText = artefact.isSent ? 'Sent to ' + shortAddr(artefact.owner) : 'You own this';
    body.innerHTML = '<div class="artefact-modal-preview"><img src="' + API_BASE + '/artefact/' + currentKeyId + '/static-preview?epoch=' + activeEpoch + '&t=' + Date.now() + '" alt="Artefact Preview" onerror="this.style.display=\'none\'"></div><div class="artefact-modal-info"><div class="artefact-info-row"><span class="label">Token ID</span><span class="value">#' + artefact.tokenId + '</span></div><div class="artefact-info-row"><span class="label">Status</span><span class="value status-' + statusClass + '">' + statusText + '</span></div><div class="artefact-info-row"><span class="label">Owner</span><span class="value">' + ownerText + '</span></div></div><div class="artefact-modal-actions">' + (artefact.state === 'ACTIVE' ? '<button class="btn btn-danger" onclick="releaseArtefact(' + artefact.tokenId + ')">Release</button>' : '') + (!artefact.isSent ? '<button class="btn btn-primary" onclick="openSendArtefactModal(' + artefact.tokenId + ')">Send to Key</button>' : '') + '<a href="' + EXPLORER + '/token/' + Z1N_ARTEFACT + '?a=' + artefact.tokenId + '" target="_blank" class="btn btn-secondary">View on Chain ↗</a></div>';
    modal.classList.add('active');
  };
  window.closeArtefactModal = function() { var modal = document.getElementById('artefactModal'); if (modal) modal.classList.remove('active'); };

  // ═══════════════════════════════════════════════════════════════
  // MINT LIVE ARTEFACT
  // ═══════════════════════════════════════════════════════════════
  async function checkHasFirstArtefact() {
    if (currentKeyId === null) return;
    try {
      // primaryArtefactOf(keyId) — selector: keccak256("primaryArtefactOf(uint256)") = 0x8e2f2e4d
      var data = '0x8e2f2e4d' + enc256(currentKeyId);
      var result = await rpc('eth_call', [{ to: Z1N_ARTEFACT, data: data }, 'latest']);
      hasFirstArtefact = BigInt(result) > BigInt(0);
    } catch (e) { hasFirstArtefact = false; }
  }

  window.mintLiveArtefactFromOverview = function() {
if (window.Z1NArtefacts && window.Z1NArtefacts.mint) { window.Z1NArtefacts.mint(); }
else { window.mintLiveArtefact(); }
};
window.mintLiveArtefact = async function() {
    if (!currentAccount || !provider || currentKeyId === null) { showToast('Connect wallet first', 3000); return; }
    var btn = document.getElementById('btnMintLiveArtefact');
    var statusEl = document.getElementById('mintArtefactStatus');
    if (!btn) return;
    var origText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing...';
    if (statusEl) statusEl.innerHTML = '<div class="status-msg pending">Preparing transaction...</div>';
    try {
      await loadEthers();
      await checkHasFirstArtefact();
      var functionName = hasFirstArtefact ? 'mintExtra' : 'mint';
      var iface = new ethersLib.Interface(['function mint(uint256 keyId, string inscription)','function mintExtra(uint256 keyId, string inscription) payable']);
var encodedData = iface.encodeFunctionData(functionName, [BigInt(currentKeyId), '']);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg pending">Confirm in wallet...</div>';
      btn.textContent = 'Confirm in wallet...';
      var txParams = { from: currentAccount, to: Z1N_ARTEFACT, data: encodedData };
      if (hasFirstArtefact) txParams.value = MINT_PRICE;
      var txHash = await provider.request({ method: 'eth_sendTransaction', params: [txParams] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg pending">Transaction sent... waiting</div>';
      btn.textContent = 'Confirming...';
      for (var i = 0; i < 60; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        try {
          var rc = await rpc('eth_getTransactionReceipt', [txHash]);
          if (rc && rc.status === '0x1') { if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(255,213,86,0.15);border:1px solid #ffd556;color:#ffd556;">✅ Live Artefact minted! <a href="' + EXPLORER + '/tx/' + txHash + '" target="_blank">View tx</a></div>'; btn.textContent = '✅ Minted!'; showToast('✅ Live Artefact minted!', 4000, false, false); await loadArtefactData(); return; }
          if (rc && rc.status === '0x0') throw new Error('Transaction reverted');
        } catch (e) {}
      }
      throw new Error('Timeout waiting for confirmation');
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
      btn.textContent = origText; btn.disabled = false;
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RELEASE ARTEFACT - v2.3.1-Ω: release(artefactId, message)
  // ═══════════════════════════════════════════════════════════════════
  window.releaseArtefact = async function(artefactId) {
    if (!currentAccount || !provider || currentKeyId === null) { showToast('Connect wallet first', 3000); return; }
    
    var message = prompt('Release message (optional, max 64 bytes):', '') || '';
    if (message.length > 64) { showToast('Message too long (max 64 bytes)', 3000, true); return; }
    
    var confirmed = confirm('Release Artefact #' + artefactId + '? This is permanent and cannot be undone.');
    if (!confirmed) return;
    
    showToast('Preparing release...', 2000);
    try {
      await loadEthers();
      var iface = new ethersLib.Interface(['function release(uint256 artefactId, string message)']);
      var data = iface.encodeFunctionData('release', [BigInt(artefactId), message]);
      var txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: currentAccount, to: Z1N_ARTEFACT, data: data }] });
      showToast('Confirming...', 2000);
      for (var i = 0; i < 60; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        try {
          var rc = await rpc('eth_getTransactionReceipt', [txHash]);
          if (rc && rc.status === '0x1') {
            showToast('✅ Artefact #' + artefactId + ' released!', 4000);
            closeArtefactModal();
            if (window.Z1NArtefacts && window.Z1NArtefacts.refresh) await window.Z1NArtefacts.refresh();
            return;
          }
          if (rc && rc.status === '0x0') { showToast('Transaction reverted', 3000, true); return; }
        } catch (e) {}
      }
      showToast('Timeout — check Polygonscan', 4000, true);
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      showToast('Failed: ' + msg.slice(0, 80), 4000, true);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // CANON TAB - Original design with green clickable tx links
  // ═══════════════════════════════════════════════════════════════
  async function loadCanonData() {
    var list = document.getElementById('canonList');
    var badge = document.getElementById('canonBadge');
    var filterBar = document.getElementById('canonFilterBar');
    var totalEl = document.getElementById('canonTotalAnchored');
    var percentEl = document.getElementById('canonPercentAnchored');
    var latestEl = document.getElementById('canonLatestEpoch');
    
    if (!list || currentKeyId === null) return;
    
    list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:12px;">Loading...</div>';
    
    try {
      var keyResp = await fetch(API_BASE + '/keys/' + currentKeyId, {cache:'no-store'});
      if (keyResp.ok) {
        var keyData = await keyResp.json();
        keyMintEpoch = keyData.epochMinted || 0;
      }
      
      var r = await fetch(API_BASE + '/canon/key/' + currentKeyId, {cache:'no-store'});
      if (!r.ok) {
        canonAnchors = [];
        if (totalEl) totalEl.textContent = '0';
        if (percentEl) percentEl.textContent = '—';
        if (latestEl) latestEl.textContent = '—';
        if (badge) badge.textContent = '0';
        renderCanonList();
        return;
      }
      
      var d = await r.json();
      canonAnchors = d.markers || d.anchors || [];

      // Inject optimistic entries not yet in indexer
      try {
        var pending = JSON.parse(localStorage.getItem('z1n_canon_pending') || '[]');
        var filtered = pending.filter(function(p) {
          return p.keyId == currentKeyId && !canonAnchors.some(function(a) {
            return (a.epochId || a.epoch) === p.epochId;
          });
        });
        if (filtered.length > 0) {
          canonAnchors = canonAnchors.concat(filtered);
        }
        // Clean up entries that made it into indexer
        var stillPending = pending.filter(function(p) {
          return !canonAnchors.some(function(a) {
            return (a.epochId || a.epoch) === p.epochId && !a._optimistic;
          });
        });
        localStorage.setItem('z1n_canon_pending', JSON.stringify(stillPending));
      } catch (e) {}
      
      var total = canonAnchors.length;
      var latestMintedEpoch = 0;
      
      if (total > 0) {
        // FIXED: Latest anchored = most recently MINTED (by timestamp), not highest epoch
        var sortedByTime = canonAnchors.slice().sort(function(a,b){ 
          return (b.timestamp || 0) - (a.timestamp || 0); 
        });
        latestMintedEpoch = sortedByTime[0].epochId || sortedByTime[0].epoch;
      }
      
      var possibleEpochs = activeEpoch - keyMintEpoch;
      var percentAnchored = possibleEpochs > 0 ? Math.round((total / possibleEpochs) * 100) : 0;
      
      if (totalEl) totalEl.textContent = total;
      if (percentEl) percentEl.textContent = percentAnchored + '%';
      if (latestEl) latestEl.textContent = latestMintedEpoch > 0 ? 'E' + latestMintedEpoch : '—';
      var canonCountEl = document.getElementById('canonCount');
if (canonCountEl) canonCountEl.textContent = '(' + total + ')';
      
      renderCanonList();
      
    } catch (e) { 
      console.error('loadCanonData error:', e); 
      canonAnchors = [];
      if (totalEl) totalEl.textContent = '0';
      if (percentEl) percentEl.textContent = '—';
      if (latestEl) latestEl.textContent = '—';
      if (badge) badge.textContent = '0';
      list.innerHTML = '<div class="canon-empty"><p>Canon data unavailable.</p></div>'; 
    }
  }

  function renderCanonList() {
    var list = document.getElementById('canonList');
    var filterBar = document.getElementById('canonFilterBar');
    if (!list) return;
    
    if (filterBar) filterBar.style.display = canonAnchors.length > 5 ? 'flex' : 'none';
    
    if (canonAnchors.length === 0) {
      list.innerHTML = '<div class="canon-empty"><div style="font-size:40px;color:var(--keys-accent);opacity:0.3;margin-bottom:12px;">Ω</div><p>No epochs anchored yet.</p><p style="font-size:11px;opacity:0.7;">When you anchor an epoch, it becomes a permanent marker in your Key\'s history.</p></div>';
      return;
    }
    
    // Sort based on current mode
    var sorted = canonAnchors.slice();
    switch (canonSortMode) {
      case 'oldest': sorted.sort(function(a,b){ return (a.timestamp || 0) - (b.timestamp || 0); }); break;
      case 'epoch-desc': sorted.sort(function(a,b){ return (b.epochId || b.epoch) - (a.epochId || a.epoch); }); break;
      case 'epoch-asc': sorted.sort(function(a,b){ return (a.epochId || a.epoch) - (b.epochId || b.epoch); }); break;
      case 'latest': default: sorted.sort(function(a,b){ return (b.timestamp || 0) - (a.timestamp || 0); }); break;
    }
    
    // ORIGINAL DESIGN: Grid with green clickable tx hash links, NO "Linked" badge
    var html = '<div class="canon-grid">';
    
    sorted.forEach(function(anc) {
      var epochId = anc.epochId || anc.epoch;
      var timeAgo = anc.timeAgo || formatTimeAgo(anc.timestamp || anc.blockTimestamp);
      var txHash = anc.txHash || '';
      var shortHash = txHash ? txHash.slice(0, 10) + '...' + txHash.slice(-4) : '';
      var txLink = txHash ? EXPLORER + '/tx/' + txHash : '#';
      
      var inscription = anc.commitment || anc.inscription || '';
      html += '<div class="canon-card">' +
        '<div class="canon-card-epoch">E' + epochId + '</div>' +
        (inscription ? '<div class="canon-card-inscription">' + escapeHtml(inscription) + '</div>' : '') +
        '<div class="canon-card-time">Minted in Epoch ' + epochId + '</div>' +
        (txHash ? '<a href="' + txLink + '" target="_blank" class="canon-card-tx">' + shortHash + '</a>' : '') +
      '</div>';
    });
    
    html += '</div>';
    list.innerHTML = html;
  }

  window.setCanonSort = function(mode) {
    canonSortMode = mode;
    var pills = document.querySelectorAll('.canon-filter-pill');
    pills.forEach(function(pill) {
      pill.classList.remove('active');
      if (pill.dataset.sort === mode) pill.classList.add('active');
    });
    renderCanonList();
  };

  function formatTimeAgo(ts) { if (!ts) return ''; var now = Date.now(), t = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : new Date(ts).getTime(), d = Math.floor((now - t) / 1000); if (d < 60) return d + 's ago'; if (d < 3600) return Math.floor(d/60) + 'm ago'; if (d < 86400) return Math.floor(d/3600) + 'h ago'; return Math.floor(d/86400) + 'd ago'; }

  // ═══════════════════════════════════════════════════════════════
  // KEY DATA LOADING - v2.3.1: Uses cached glyphs + indexed epoch
  // ═══════════════════════════════════════════════════════════════
  async function loadKeyData(keyId) {
    currentKeyId = keyId;

    // CACHE: Toon vorige data direct bij key switch / refresh
    var cacheKey = 'z1n_keydata_' + keyId;
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        var c = JSON.parse(cached);
        if (c.glyphLine) {
          document.getElementById('keyIdDisplay').textContent = 'Key #' + keyId;
          document.getElementById('keyGlyphs').textContent = c.glyphLine;
        }
        if (c.signalsUsed !== undefined) { signalsUsed = c.signalsUsed; updateDots(); }
        if (c.attestsUsed !== undefined) { attestsUsed = c.attestsUsed; updateDots(); }
        if (c.activeEpoch) { activeEpoch = c.activeEpoch; }
        if (c.allSentSignals) { allSentSignals = c.allSentSignals; }
        if (c.allSentAttests) { allSentAttests = c.allSentAttests; }
        if (c.allReceivedReplies) { allReceivedReplies = c.allReceivedReplies; }
      } catch (e) {}
    }

    // Pre-load readItems so unread checks work during initial data loading
    try { var _stored = localStorage.getItem('z1n_activity_read_' + keyId); if (_stored) { ActivityFeed.readItems = new Set(JSON.parse(_stored)); } else { ActivityFeed.readItems = new Set(); } } catch(e) { ActivityFeed.readItems = new Set(); }
    // Pre-load readItems so unread checks work during initial data loading
    try { var _stored = localStorage.getItem('z1n_activity_read_' + keyId); if (_stored) { ActivityFeed.readItems = new Set(JSON.parse(_stored)); } else { ActivityFeed.readItems = new Set(); } } catch(e) { ActivityFeed.readItems = new Set(); }
    try {
      // ── ROUND 1: owner check (must stay RPC for security) + epoch from API ──
      var ownerCall = rpc('eth_call', [{ to: Z1N_KEY, data: SEL.ownerOf + enc256(keyId) }, 'latest']);
      var epochCall = fetch(API_BASE + '/live', { cache: 'no-store' }).then(function(r) { return r.json(); });
      
      var round1 = await Promise.all([ownerCall, epochCall]);
      
      // Owner check (must stay live for security)
      var or = round1[0], ko = '0x' + or.slice(26).toLowerCase();
      var isOwner = ko === currentAccount.toLowerCase();
      if (!isOwner) { 
        document.getElementById('keyIdDisplay').textContent = 'Key #' + keyId; 
        document.getElementById('keyGlyphs').innerHTML = '<span style="color:#f87171;">⚠️ Key owned by different wallet</span><br><span style="font-size:11px;color:var(--text-soft);">Switch to ' + ko.slice(0,6) + '...' + ko.slice(-4) + ' in MetaMask to interact</span>'; 
        showToast('⚠️ Wrong address - switch in Wallet', 5000);
      }
      var submitBtn2 = document.getElementById('btnSubmitPog') || document.getElementById('signalSubmitBtn');
      if (submitBtn2) submitBtn2.disabled = !isOwner;
      var attestBtn = document.getElementById('btnAttestNormalInline');
      if (attestBtn) attestBtn.disabled = !isOwner;
      
      // Glyphs from cache (filled by connect()), fallback to API if missing
      var gs = keyGlyphsCache[keyId];
      if (!gs && gs !== '') {
        try {
          var keyResponse = await fetch(API_BASE + '/keys/' + keyId, { cache: 'no-store' });
          if (keyResponse.ok) {
            var keyData = await keyResponse.json();
            gs = keyData.glyphLine || '';
            keyGlyphsCache[keyId] = gs;
          }
        } catch (e) {
          // Final fallback to RPC
          var gr = await rpc('eth_call', [{ to: Z1N_KEY, data: SEL.glyphs + enc256(keyId) }, 'latest']);
          var len = parseInt(gr.slice(2, 66), 16), pack = BigInt('0x' + gr.slice(66, 130));
          gs = decGlyphs(len, pack);
          keyGlyphsCache[keyId] = gs || '';
        }
      }
      
      document.getElementById('keyIdDisplay').textContent = 'Key #' + keyId;
      document.getElementById('keyGlyphs').textContent = gs || '—';
      var genesisBadge = document.getElementById('genesisBadge'); if (genesisBadge && keyId <= 100) genesisBadge.style.display = 'inline-block';
      
      // Epoch from API
      activeEpoch = round1[1].currentEpoch || round1[1].epoch || 0;
      if (window.Z1N) window.Z1N.epoch = activeEpoch;
      var pogEpochDisplay = document.getElementById('pogEpochDisplay'); if (pogEpochDisplay) pogEpochDisplay.textContent = 'Epoch ' + activeEpoch;
      var overviewEpoch = document.getElementById('overviewEpoch'); if (overviewEpoch) overviewEpoch.textContent = activeEpoch;
      var attestableEpoch = activeEpoch > 0 ? activeEpoch - 1 : 0; var attestEpochBadge = document.getElementById('attestEpochBadge'); if (attestEpochBadge) attestEpochBadge.textContent = 'Epoch ' + attestableEpoch;
      
      // ── ROUND 2: signalCount + attestCount (must stay RPC - current epoch usage) ──
      var scCall = rpc('eth_call', [{ to: Z1N_SIGNAL, data: SEL.signalCount + enc256(keyId) + enc256(activeEpoch) }, 'latest']);
      var acCall = rpc('eth_call', [{ to: Z1N_SIGNAL, data: SEL.attestCount + enc256(keyId) + enc256(activeEpoch) }, 'latest']);
      var round2 = await Promise.all([scCall, acCall]);
      signalsUsed = parseInt(round2[0], 16);
      attestsUsed = parseInt(round2[1], 16);
      updateDots();
      
      var viewLink = document.getElementById('viewOnChainLink'); if (viewLink) viewLink.href = EXPLORER + '/token/' + Z1N_KEY + '?a=' + keyId;
      updateOverviewArtefactPreview();
      await Promise.all([loadAttestableSignals(), loadSentSignals(), loadReceivedReplies(), loadSentAttests(), loadReceivedAttests(), loadCanonData(), loadTreasuryData()]);
if (window.Z1NArtefacts && window.Z1NArtefacts.refresh) await window.Z1NArtefacts.refresh();
      updateAttestBtn();
      initActivityFeed();
      initUnreadState();
      
      // Switch to URL tab AFTER data loads
      switchToUrlTab();

      // CACHE: Sla geladen data op voor volgende keer
      try {
        sessionStorage.setItem('z1n_keydata_' + keyId, JSON.stringify({
          glyphLine: keyGlyphsCache[keyId] || '',
          signalsUsed: signalsUsed,
          attestsUsed: attestsUsed,
          activeEpoch: activeEpoch,
          allSentSignals: allSentSignals.slice(0, 20),
          allSentAttests: allSentAttests.slice(0, 20),
          allReceivedReplies: allReceivedReplies.slice(0, 20)
        }));
      } catch (e) {}

    } catch (e) { console.error('loadKeyData error:', e); }
  }

  // ═══════════════════════════════════════════════════════════════
  // ARTEFACT DATA
  // ═══════════════════════════════════════════════════════════════
  function updateOverviewArtefactPreview() {
    if (window.Z1NArtefacts && window.Z1NArtefacts.updateOverviewPreview) { window.Z1NArtefacts.updateOverviewPreview(); return; }
    var previewImg = document.getElementById('overviewArtefactPreview');
    if (previewImg && currentKeyId !== null) {
      previewImg.src = API_BASE + '/artefact/' + currentKeyId + '/static-preview?epoch=' + activeEpoch + '&t=' + Date.now();
      previewImg.onerror = function() { this.style.display = 'none'; var placeholder = this.parentElement.querySelector('.artefact-placeholder'); if (placeholder) placeholder.style.display = 'flex'; };
      previewImg.onload = function() { this.style.display = 'block'; var placeholder = this.parentElement.querySelector('.artefact-placeholder'); if (placeholder) placeholder.style.display = 'none'; };
      // Make artefact preview clickable — open enlarged popup
      previewImg.style.cursor = 'pointer';
      previewImg.onclick = function() { openOverviewArtefactPopup(); };
    }
    // Update minted/received counts
    updateOverviewArtefactCounts();
  }

  function updateOverviewArtefactCounts() {
    var countEl = document.getElementById('overviewArtefactCounts');
    if (!countEl) return;
    var total = allLiveArtefacts ? allLiveArtefacts.length : 0;
    var received = allLiveArtefacts ? allLiveArtefacts.filter(function(a) { return a.isReceived || a.receivedFromKeyId || a.fromKeyId || a.senderKeyId; }).length : 0;
    var minted = total - received;
    if (total === 0) {
      countEl.textContent = '';
    } else if (received > 0) {
      countEl.textContent = 'Minted: ' + minted + ' · Received: ' + received;
    } else {
      countEl.textContent = 'Current # of artefacts minted: ' + minted;
    }
    var overviewMintBtn = document.getElementById('btnMintLiveArtefactOverview');
    if (overviewMintBtn && !overviewMintBtn.disabled) {
      overviewMintBtn.textContent = hasFirstArtefact ? '+ Mint Artefact — 7 POL' : '+ Mint First Artefact — FREE';
    }
  }

  window.openOverviewArtefactPopup = function() {
    var modal = document.getElementById('artefactModal');
    var title = document.getElementById('artefactModalTitle');
    var body = document.getElementById('artefactModalBody');
    if (!modal || !title || !body) return;
    
    title.textContent = 'Artefact Preview — K#' + currentKeyId;
    
    var imgSrc = API_BASE + '/artefact/' + currentKeyId + '/static-preview?epoch=' + activeEpoch + '&t=' + Date.now();
    var minted = allLiveArtefacts ? allLiveArtefacts.filter(function(a) { return !a.isReceived && !a.receivedFromKeyId && !a.fromKeyId; }).length : 0;
    var received = allLiveArtefacts ? allLiveArtefacts.filter(function(a) { return a.isReceived || a.receivedFromKeyId || a.fromKeyId || a.senderKeyId; }).length : 0;
    var total = allLiveArtefacts ? allLiveArtefacts.length : 0;
    
    body.innerHTML = '<div style="text-align:center;padding:12px;">' +
      '<img src="' + imgSrc + '" alt="Artefact" style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid var(--card-border);" onerror="this.outerHTML=\'<div style=\\\'padding:60px;text-align:center;color:var(--text-soft);font-size:48px;opacity:0.3;\\\'>◈</div>\'">' +
      '<div style="margin-top:16px;display:flex;justify-content:center;gap:20px;font-size:12px;color:var(--text-soft);">' +
        '<span>' + total + ' total</span>' +
        '<span>' + minted + ' minted</span>' +
        '<span>' + received + ' received</span>' +
      '</div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">' +
        '<button onclick="switchTab(\'artefacts\');closeArtefactModal();" class="btn btn-primary" style="font-size:12px;padding:8px 16px;">View All Artefacts</button>' +
        '<button onclick="mintLiveArtefact();closeArtefactModal();" class="btn btn-secondary" style="font-size:12px;padding:8px 16px;">' + (hasFirstArtefact ? '+ Mint Extra — 7 POL' : '+ Mint First — FREE') + '</button>' +
      '</div>' +
    '</div>';
    
    modal.classList.add('active');
  };

  async function loadArtefactData() {
    var grid = document.getElementById('liveArtefactGrid');
    var badge = document.getElementById('artefactBadge');
    var status = document.getElementById('artefactStatus');
    var mintBtn = document.getElementById('btnMintLiveArtefact');
    if (!grid || currentKeyId === null) return;
    grid.innerHTML = '<div style="grid-column:span 4;padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">Loading artefacts...</div>';
    try {
      await checkHasFirstArtefact();
      if (mintBtn) mintBtn.textContent = hasFirstArtefact ? '+ Mint Extra (mintExtra) — 7 POL' : '+ Mint First (mint) — FREE';
      var r = await fetch(API_BASE + '/key/' + currentKeyId + '/artefacts', {cache:'no-store'});
      if (!r.ok) { grid.innerHTML = '<div style="grid-column:span 4;padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No artefacts found</div>'; if (badge) badge.textContent = '0'; if (status) status.textContent = 'No live artefact'; allLiveArtefacts = []; allStaticArtefacts = []; return; }
      var d = await r.json();
      allLiveArtefacts = d.liveArtefacts || [];
      
      var totalLive = allLiveArtefacts.length;
      var activeLive = allLiveArtefacts.filter(function(a) { return a.status !== 'revoked'; }).length;
      if (badge) badge.textContent = totalLive;
      if (status) status.textContent = '';
      if (totalLive === 0) { grid.innerHTML = '<div style="grid-column:span 4;padding:40px 20px;text-align:center;"><div style="font-size:48px;opacity:0.3;margin-bottom:16px;">◈</div><p style="color:var(--text-soft);font-size:13px;margin-bottom:16px;">No live artefacts yet</p><p style="color:var(--text-soft);font-size:11px;opacity:0.7;">Mint your first live artefact to create a dynamic mirror of your Key.</p></div>'; return; }
      grid.innerHTML = '';
      allLiveArtefacts.forEach(function(art) {
        var card = document.createElement('div');
        card.className = 'artefact-mini-card' + (art.status === 'revoked' ? ' revoked' : ' live');
        card.innerHTML = '<div class="artefact-mini-img"><img src="' + API_BASE + '/artefact/' + currentKeyId + '/static-preview?epoch=' + activeEpoch + '&wallet=' + (art.owner || '') + '&t=' + Date.now() + '" alt="Artefact #' + art.tokenId + '" onerror="this.parentElement.innerHTML=\'<div style=\\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;color:rgba(255,255,255,0.2);\\\'>◈</div>\'"></div><div class="artefact-mini-overlay"><span class="artefact-type-badge ' + (art.status === 'revoked' ? 'revoked' : 'live') + '">' + (art.status === 'revoked' ? 'Revoked' : 'Live') + '</span> #' + art.tokenId + (art.isSent ? ' <span style="opacity:0.7;">→ ' + shortAddr(art.owner) + '</span>' : '') + '</div>';
        card.onclick = function() { openArtefactModal(art); };
        grid.appendChild(card);
      });
       updateTabBadges();
    } catch (e) { console.error('loadArtefactData error:', e); grid.innerHTML = '<div style="grid-column:span 4;padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">Error loading artefacts</div>'; }
  }

 async function loadAttestableSignals() {
  console.log('DEBUG activeEpoch:', activeEpoch, 'attestable epoch:', activeEpoch > 0 ? activeEpoch - 1 : 0);
    var list = document.getElementById('attestSignalsListInline'), load = document.getElementById('attestLoadingInline'), info = document.getElementById('attestSelectedInfoInline');
    if (!list) return; selectedAttestSignal = null; list.innerHTML = ''; if (load) load.style.display = 'block';
    try {
      var ae = activeEpoch > 0 ? activeEpoch - 1 : 0; var p = new URLSearchParams(); p.set('limit', '100'); p.set('minEpoch', String(ae)); p.set('maxEpoch', String(ae));
      var sort = document.getElementById('attestSortSelect'); if (sort) p.set('sort', sort.value);
      var attestIntentFilter = document.getElementById('attestIntentFilter'); var ints = []; if (attestIntentFilter && attestIntentFilter.value) { ints.push(attestIntentFilter.value); } else { ints = ['0','1','2','3']; }
      if (ints.length === 0) { if (load) load.style.display = 'none'; list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No intents selected.</div>'; return; }
      if (ints.length < 4) p.set('intents', ints.join(','));
      var r = await fetch(API_BASE + '/signals?' + p.toString(), {cache:'no-store'}), d = await r.json();
      if (load) load.style.display = 'none';
      var sigs = d.signals || [];
// Filter signals van dezelfde wallet - je kunt niet attesten op je eigen signals
if (currentAccount) {
  sigs = sigs.filter(function(s) { 
    // Filter by wallet address
    if (s.ownerWallet && s.ownerWallet.toLowerCase() === currentAccount.toLowerCase()) return false;
    // Also filter by keyId if it's one of the wallet's keys
    if (walletKeyIds && walletKeyIds.length > 0 && walletKeyIds.includes(s.keyId)) return false;
    return true;
  });
}
      allAttestableSignals = sigs; await fetchKeyGlyphs(sigs.map(function(s){ return s.keyId; }).concat(sigs.map(function(s){ return s.replyToKeyId; }).filter(Boolean))); renderAttestSignals(sigs, list, info, ae); updateAttestBtn();
    } catch (e) { if (load) load.style.display = 'none'; list.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:11px;">Error loading signals.</div>'; }
  }
  window.loadAttestableSignals = loadAttestableSignals;

window.filterAttestSignals = function() {
  var search = (document.getElementById('attestSearchHash')?.value || '').trim().toLowerCase();
  var list = document.getElementById('attestSignalsListInline');
  var info = document.getElementById('attestSelectedInfoInline');
  var ae = activeEpoch > 0 ? activeEpoch - 1 : 0;
  
  if (!search) {
    renderAttestSignals(allAttestableSignals, list, info, ae);
    return;
  }
  
  var filtered = allAttestableSignals.filter(function(s) {
    return (s.hash || '').toLowerCase().includes(search) || String(s.keyId) === search;
  });
  
  renderAttestSignals(filtered, list, info, ae);
};

  function renderAttestSignals(sigs, list, info, ae) {
    list.innerHTML = '';
    if (sigs.length === 0) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No signals for Epoch ' + ae + '</div>'; if (info) info.textContent = 'No signals to attest (Epoch ' + ae + ')'; return; }
    if (info) info.textContent = sigs.length + ' signals to attest (Epoch ' + ae + ')';
    sigs.forEach(function(sig) {
      var it = document.createElement('div'); it.className = 'attest-signal-item';
      it.onclick = function() { document.querySelectorAll('#attestSignalsListInline .attest-signal-item.selected').forEach(function(el){ el.classList.remove('selected'); }); it.classList.add('selected'); selectedAttestSignal = sig; if (info) info.innerHTML = 'Selected: <strong style="color:var(--keys-accent);">K#' + sig.keyId + '</strong>'; updateAttestBtn(); };
      var ic = ['oc','oi','ok','os'][sig.intent] || 'oc', isym = sig.intentSymbol || ['ΩC','ΩI','ΩK','ΩS'][sig.intent] || '?', sg = getShortGlyphs(sig.keyId), gs = sg ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">'+sg+'</span>' : '';
      it.innerHTML = '<div class="signal-top"><span style="color:var(--keys-accent);font-weight:600;font-size:11px;">K#'+sig.keyId+'</span>'+gs+'<span class="intent-tag '+ic+'" style="font-size:9px;">'+isym+'</span><span style="color:#fbbf24;font-size:10px;">✓'+(sig.attestCount||0)+'</span><span style="font-size:9px;color:var(--text-soft);">'+(sig.timeAgo||'')+'</span></div><div class="signal-content" style="color:#fff;">'+escapeHtml(sig.cid||sig.contentRef||'[Silence]')+'</div>';
      list.appendChild(it);
    });
  }

 function updateAttestBtn() {
    var btn = document.getElementById('btnAttestNormalInline'); if (!btn) return;
    var can = !!selectedAttestSignal && attestsUsed < 2; btn.disabled = !can;
    var prefix = attestStealthEnabled ? '👁‍🗨 ' : '✓ ';
    if (attestsUsed >= 2) { btn.textContent = prefix + 'Max Attests (2/2)'; return; }
    if (!selectedAttestSignal) { btn.textContent = prefix + 'Attest Signal'; return; }
    btn.textContent = prefix + 'Attest K#' + selectedAttestSignal.keyId;
  }

async function loadSentSignals() {
  var list = document.getElementById('sentSignalsList'); if (!list || currentKeyId === null) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:12px;">Loading...</div>';
  try {
    var p = new URLSearchParams(); p.set('keyId', String(currentKeyId)); p.set('limit', '50');
    var sortSelect = document.getElementById('sentSortSelect'); if (sortSelect) p.set('sort', sortSelect.value);
    var intentFilter = document.getElementById('sentIntentFilter'); if (intentFilter && intentFilter.value) p.set('intents', intentFilter.value);
    var r = await fetch(API_BASE + '/signals?' + p.toString(), {cache:'no-store'}), d = await r.json(), sigs = d.signals || [];
    
    // Filter by type (New/Reply)
    var typeFilter = document.getElementById('sentTypeFilter');
    if (typeFilter && typeFilter.value) {
      sigs = sigs.filter(function(sig) {
        var isReply = sig.replyTo && sig.replyTo !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        return typeFilter.value === 'reply' ? isReply : !isReply;
      });
    }
    
    // Behoud pending items die de API nog niet heeft geïndexeerd
    var pendingItems = allSentSignals.filter(function(s) { return s._pending && !sigs.find(function(x) { return x.hash === s.hash; }); });
    allSentSignals = pendingItems.concat(sigs);
    var sentSignalsCountEl = document.getElementById('sentSignalsCount');
    if (sentSignalsCountEl) sentSignalsCountEl.textContent = '(' + sigs.length + ')';
    if (sigs.length === 0) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No signals sent yet</div>'; return; }
    
    await fetchKeyGlyphs(sigs.map(function(s){ return s.keyId; }).concat(sigs.map(function(s){ return s.replyToKeyId; }).filter(Boolean)));
    
    list.innerHTML = '';
    sigs.forEach(function(sig) {
      var it = document.createElement('div'); it.className = 'signal-item';
      var ic = ['oc','oi','ok','os'][sig.intent] || 'oc', isym = sig.intentSymbol || ['ΩC','ΩI','ΩK','ΩS'][sig.intent] || '?';
      var sg = getShortGlyphs(sig.keyId);
      var gs = sg ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">' + sg + '</span>' : '';
      var content = sig.cid || sig.contentRef || sig.content || '[Silence]';
      var contentHtml = buildSignalContentHtml(content);
      var displayEpoch = sig.epoch || activeEpoch;
      var isReply = sig.replyTo && sig.replyTo !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      // v5: Clean card layout — no typeBadge, no replyBadge, no Reply button
      if (isReply) {
        var parentKeyId = sig.replyToKeyId;
        var hasParentKey = parentKeyId !== undefined && parentKeyId !== null;
        var parentGlyphs = hasParentKey ? getShortGlyphs(parentKeyId) : '';
        var pgs = parentGlyphs ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">' + parentGlyphs + '</span>' : '';
        var keyLine = hasParentKey ? '<span style="color:var(--keys-accent);font-weight:600;">↩ K#' + parentKeyId + '</span>' + pgs : '<span style="color:var(--text-soft);font-size:10px;">↩ Reply</span>';
        var whisperKeyId = hasParentKey ? parentKeyId : 0;
        it.innerHTML = '<div style="flex:1;"><div class="signal-item-header">' + keyLine + '<span class="intent-tag ' + ic + '" style="margin-left:6px;">' + isym + '</span><span class="signal-attests" style="margin-left:6px;">✓' + (sig.attestCount||0) + '</span><span style="color:var(--text-soft);margin-left:6px;">Epoch ' + displayEpoch + '</span></div><div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:0.8;">' + contentHtml + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="signal-time">' + (sig.timeAgo || '') + '</span>'  + '</div>';
      } else {
        it.innerHTML = '<div style="flex:1;"><div class="signal-item-header"><span class="intent-tag ' + ic + '">' + isym + '</span><span class="signal-attests" style="margin-left:6px;">✓' + (sig.attestCount||0) + '</span><span style="color:var(--text-soft);margin-left:6px;">Epoch ' + displayEpoch + '</span></div><div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:0.8;">' + contentHtml + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="signal-time">' + (sig.timeAgo || '') + '</span></div>';
      }
      
      list.appendChild(it);
    });
  } catch (e) { list.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:11px;">Error loading signals</div>'; }
}
window.loadSentSignals = loadSentSignals;

var allReceivedReplies = [];

async function loadReceivedReplies() {
  var list = document.getElementById('receivedRepliesList');
  var badge = document.getElementById('repliesCount');
  if (!list || currentKeyId === null) return;
  
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:12px;">Loading...</div>';
  
  try {
    var params = new URLSearchParams();
    params.set('replyToKeyId', String(currentKeyId));
    params.set('limit', '100');
    var sortSelect = document.getElementById('repliesSortSelect');
    params.set('sort', sortSelect ? sortSelect.value : 'recent');
    var intentFilter = document.getElementById('repliesIntentFilter');
    if (intentFilter && intentFilter.value) params.set('intents', intentFilter.value);
    var repliesRes = await fetch(API_BASE + '/signals?' + params.toString(), {cache:'no-store'});
    var repliesData = await repliesRes.json();
    var replies = repliesData.signals || [];
    
    allReceivedReplies = replies;
    var receivedRepliesCountEl = document.getElementById('receivedRepliesCount');
if (receivedRepliesCountEl) receivedRepliesCountEl.textContent = '(' + replies.length + ')';
    if (badge) badge.textContent = replies.length;
    
    if (replies.length === 0) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;"><div style="font-size:24px;opacity:0.3;margin-bottom:8px;">💬</div>No replies yet</div>';
      return;
    }
    
    await fetchKeyGlyphs(replies.map(function(s) { return s.keyId; }));
    
    list.innerHTML = '';
    replies.forEach(function(sig) {
      var it = document.createElement('div');
      it.className = 'signal-item';
      var ic = ['oc','oi','ok','os'][sig.intent] || 'oc';
      var isym = sig.intentSymbol || ['ΩC','ΩI','ΩK','ΩS'][sig.intent] || '?';
      var sg = getShortGlyphs(sig.keyId);
      var gs = sg ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">' + sg + '</span>' : '';
      var content = sig.cid || sig.contentRef || sig.content || '[Silence]';
      var contentHtml = buildSignalContentHtml(content);
      
     // Check unread state
      var activityId = 'reply_recv_' + sig.hash;
      var isUnread = typeof ActivityFeed !== 'undefined' && ActivityFeed.readItems && !ActivityFeed.readItems.has(activityId);
      if (isUnread) it.classList.add('unread-glow');
      it.dataset.activityId = activityId;
      
      var displayEpoch = sig.epoch || '—';
      var parentHash = sig.replyTo || '';
      var replyBadge = '';
      if (parentHash && parentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        replyBadge = '<span style="font-size:9px;padding:2px 6px;background:rgba(255,213,86,0.2);color:#ffd556;border-radius:4px;margin-left:4px;cursor:pointer;" onclick="showParentSignal(\'' + parentHash + '\')">\u21a9 ' + parentHash.slice(0,10) + '...</span>';
      }
      it.innerHTML = '<div style="flex:1;"><div class="signal-item-header"><span style="color:var(--keys-accent);font-weight:600;">K#' + sig.keyId + '</span>' + gs + '<span class="intent-tag ' + ic + '" style="margin-left:6px;">' + isym + '</span><span class="signal-attests" style="margin-left:6px;">✓' + (sig.attestCount||0) + '</span><span style="color:var(--text-soft);margin-left:6px;">Epoch ' + displayEpoch + '</span></div><div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:0.8;">' + contentHtml + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="signal-time">' + (sig.timeAgo || '') + '</span><button class="reply-btn" onclick="event.stopPropagation();replyToSignal(\'' + sig.hash + '\', ' + sig.keyId + ')" style="font-size:10px;padding:3px 8px;background:rgba(255,213,86,0.2);color:#ffd556;border:none;border-radius:4px;cursor:pointer;">↩ Reply</button></div>';// Click to mark as read
      it.addEventListener('click', function(e) {
        if (e.target.classList.contains('reply-btn')) return;
        markTabItemRead(activityId, it);
      });
      
      list.appendChild(it);
    });
    
  } catch (e) {
    console.error('loadReceivedReplies error:', e);
    if (badge) badge.textContent = '0';
    list.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:11px;">Error loading replies</div>';
  }
}

window.downloadReceivedRepliesCSV = function() {
  if (allReceivedReplies.length === 0) { showToast('No replies to export', 2000); return; }
  var intents = ['ΩC (Collective)','ΩI (Individual)','ΩK (Co-Create)','ΩS (Silence)'];
  var rows = [['Hash','From Key ID','From Glyphs','Intent','Reply To Hash','Reply To Key ID','Reply To Key Glyphs','Content','Epoch','Attestations','Time']];
  allReceivedReplies.forEach(function(sig) {
    rows.push([sig.hash, sig.keyId, keyGlyphsCache[sig.keyId]||'', intents[sig.intent]||'', sig.replyTo||'', sig.replyToKeyId ? 'K#'+sig.replyToKeyId : '', sig.replyToKeyId ? (keyGlyphsCache[sig.replyToKeyId]||'') : '', sig.cid||'[Silence]', sig.epoch, sig.attestCount||0, sig.timeAgo||'']);
  });
  downloadCSV(rows, 'z1n_received_replies_' + new Date().toISOString().slice(0,10) + '.csv');
  showToast('CSV downloaded', 2000);
};



window.loadReceivedReplies = loadReceivedReplies;

window.showParentSignal = async function(parentHash) {
  showSafetyWarning(async function() {
    try {
      var r = await fetch(API_BASE + '/signal/' + parentHash, {cache:'no-store'});
      if (!r.ok) { showToast('Parent signal not found', 3000, true); return; }
      var sig = await r.json();
      
      var ic = ['oc','oi','ok','os'][sig.intent] || 'oc';
      var isym = sig.intentSymbol || ['ΩC','ΩI','ΩK','ΩS'][sig.intent] || '?';
      var content = sig.cid || '[Silence]';
      
      var msg = 'Parent Signal from K#' + sig.keyId + '\n\nIntent: ' + isym + '\nEpoch: ' + sig.epoch + '\nAttestations: ' + (sig.attestCount || 0) + '\n\nContent:\n' + content;
      alert(msg);
      
    } catch (e) {
      showToast('Could not load parent signal', 3000, true);
    }
  });
};

window.replyToSignal = function(signalHash, fromKeyId) {
  // Switch to signals tab
  switchTab('signals');
  
  // Enable reply mode
  var checkbox = document.getElementById('replyCheckbox');
  var section = document.getElementById('replySection');
  if (checkbox) checkbox.checked = true;
  if (section) section.style.display = 'block';
  signalType = 'reply';
  
  // Set the replyTo hash
  var replyHashEl = document.getElementById('replyToHash');
  if (replyHashEl) replyHashEl.value = signalHash;
  
  showToast('Replying to K#' + fromKeyId, 2000);
};

async function loadSentAttests() {
  var list = document.getElementById('sentAttestsList'); if (!list || currentKeyId === null) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:12px;">Loading...</div>';
  try {
    // Use all wallet Key IDs for multi-key support
var keyIdsParam = currentKeyId;
var r = await fetch(API_BASE + '/attestations?fromKeyIds=' + keyIdsParam + '&limit=1000', {cache:'no-store'});
    if (!r.ok) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No attestations sent yet</div>'; return; }
    var d = await r.json(); var attests = d.attestations || [];
    
    // Apply intent filter
    var intentFilter = document.getElementById('sentAttestsIntentFilter');
    if (intentFilter && intentFilter.value) {
      attests = attests.filter(function(a) { return String(a.signalIntent) === intentFilter.value; });
    }
    
    // Apply sort
    var sortSelect = document.getElementById('sentAttestsSortSelect');
    if (sortSelect && sortSelect.value === 'epoch') {
      attests.sort(function(a, b) { return (b.epoch || 0) - (a.epoch || 0); });
    }
    
    var pendingAttests = allSentAttests.filter(function(a) { return a._pending && !attests.find(function(x) { return x.signalHash === a.signalHash; }); });
    allSentAttests = pendingAttests.concat(attests);
    var sentAttestsCountEl = document.getElementById('sentAttestsCount');
if (sentAttestsCountEl) sentAttestsCountEl.textContent = '(' + attests.length + ')';
    if (attests.length === 0) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No attestations sent yet</div>'; return; }
    
    await fetchKeyGlyphs(attests.map(function(a) { return a.signalKeyId; }));
    // Full content shown
    list.innerHTML = '';
    attests.forEach(function(att) {
      var it = document.createElement('div'); it.className = 'signal-item';
      var ic = ['oc','oi','ok','os'][att.signalIntent] || 'oc';
      var isym = att.signalIntentSymbol || ['ΩC','ΩI','ΩK','ΩS'][att.signalIntent] || '?';
      var sg = getShortGlyphs(att.signalKeyId);
      var gs = sg ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">' + sg + '</span>' : '';
      var content = att.signalContent || att.signalCid || att.signalContentRef || '[Signal]';
      
      it.innerHTML = '<div style="flex:1;"><div class="signal-item-header"><span style="color:var(--keys-accent);font-weight:600;">K#'+(att.signalKeyId||'?')+'</span>'+gs+'<span class="intent-tag '+ic+'" style="margin-left:6px;">'+isym+'</span><span style="margin-left:6px;font-size:10px;color:#fbbf24;">Attested</span><span style="color:var(--text-soft);margin-left:6px;">Epoch '+att.epoch+'</span></div><div class="signal-content-preview" style="font-size:11px;opacity:0.8;white-space:pre-wrap;word-break:break-word;">'+escapeHtml(content)+'</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="signal-time">'+(att.timeAgo||'')+'</span><button onclick="event.stopPropagation();switchTab(\'direct\');setTimeout(function(){replyWhisper('+(att.signalKeyId||0)+')},100);" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(255,213,86,0.3);background:transparent;color:var(--keys-accent);font-size:9px;cursor:pointer;">💬 Whisper</button></div>';
      list.appendChild(it);
    });
  } catch (e) { list.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:11px;">Error loading attestations</div>'; }
}
  window.loadSentAttests = loadSentAttests;

  var allReceivedAttests = [];

async function loadReceivedAttests() {
  var list = document.getElementById('receivedAttestsList');
  var badge = document.getElementById('receivedAttestsCount');
  if (!list || currentKeyId === null) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:12px;">Loading...</div>';
  try {
    // Use all wallet Key IDs for multi-key support
var keyIdsParam = currentKeyId;
var r = await fetch(API_BASE + '/attestations?toKeyIds=' + keyIdsParam + '&limit=1000', {cache:'no-store'});
    if (!r.ok) { if (badge) badge.textContent = '0'; list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;"><div style="font-size:24px;opacity:0.3;margin-bottom:8px;">✓</div>No attestations received yet</div>'; return; }
    var d = await r.json(); var attests = d.attestations || [];
    
    // Apply intent filter
    var intentFilter = document.getElementById('receivedAttestsIntentFilter');
    if (intentFilter && intentFilter.value) {
      attests = attests.filter(function(a) { return String(a.signalIntent) === intentFilter.value; });
    }
    
    // Apply sort
    var sortSelect = document.getElementById('receivedAttestsSortSelect');
    if (sortSelect && sortSelect.value === 'epoch') {
      attests.sort(function(a, b) { return (b.epoch || 0) - (a.epoch || 0); });
    }
    
    allReceivedAttests = attests;
    var receivedAttestsCountTitleEl = document.getElementById('receivedAttestsCountTitle');
if (receivedAttestsCountTitleEl) receivedAttestsCountTitleEl.textContent = '(' + attests.length + ')';
    if (badge) badge.textContent = attests.length;
    
    if (attests.length === 0) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;"><div style="font-size:24px;opacity:0.3;margin-bottom:8px;">✓</div>No attestations received yet</div>'; return; }
    
    await fetchKeyGlyphs(attests.map(function(a) { return a.fromKeyId; }));
    
    list.innerHTML = '';
    attests.forEach(function(att) {
      var it = document.createElement('div'); it.className = 'signal-item';
      var ic = ['oc','oi','ok','os'][att.signalIntent] || 'oc';
      var isym = att.signalIntentSymbol || ['ΩC','ΩI','ΩK','ΩS'][att.signalIntent] || '?';
      var sg = getShortGlyphs(att.fromKeyId);
      var gs = sg ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">' + sg + '</span>' : '';
      var content = att.signalContent || att.signalCid || att.signalContentRef || '[Your signal]';
      // Check unread state
      var activityId = 'attest_recv_' + (att.signalHash || '') + '_' + (att.fromKeyId || '') + '_' + (att.blockNumber || '');
      var isUnread = typeof ActivityFeed !== 'undefined' && ActivityFeed.readItems && !ActivityFeed.readItems.has(activityId);
      if (isUnread) it.classList.add('unread-glow');
      it.dataset.activityId = activityId;
      
      var fromKeyDisplay = att.fromKeyId !== null ? 'K#' + att.fromKeyId : (att.fromWallet ? att.fromWallet.slice(0,6) + '...' : '?');
      it.innerHTML = '<div style="flex:1;"><div class="signal-item-header"><span style="color:var(--keys-accent);font-weight:600;">' + fromKeyDisplay + '</span>'+gs+'<span class="intent-tag '+ic+'" style="margin-left:6px;">'+isym+'</span><span style="margin-left:6px;font-size:10px;color:#fbbf24;">Attested</span><span style="color:var(--text-soft);margin-left:6px;">Epoch '+att.epoch+'</span></div><div class="signal-content-preview" style="font-size:11px;opacity:0.8;white-space:pre-wrap;word-break:break-word;">'+escapeHtml(content)+'</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="signal-time">'+(att.timeAgo||'')+'</span><button onclick="event.stopPropagation();switchTab(\'direct\');setTimeout(function(){replyWhisper('+(att.fromKeyId||0)+')},100);" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(255,213,86,0.3);background:transparent;color:var(--keys-accent);font-size:9px;cursor:pointer;">💬 Whisper</button></div>';
      
      // Click to mark as read
      it.addEventListener('click', function() {
        markTabItemRead(activityId, it);
      });
      
      list.appendChild(it);
    });
  } catch (e) { if (badge) badge.textContent = '0'; list.innerHTML = '<div style="padding:20px;text-align:center;color:#f87171;font-size:11px;">Error loading attestations</div>'; }
}

window.filterReceivedAttests = function() {
  var search = (document.getElementById('receivedAttestsSearchKey')?.value || '').trim();
  if (!search) { loadReceivedAttests(); return; }
  var list = document.getElementById('receivedAttestsList');
  var filtered = allReceivedAttests.filter(function(a) { return String(a.fromKeyId) === search; });
  if (filtered.length === 0) { list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-soft);font-size:11px;">No attests from K#' + search + '</div>'; return; }
  // Re-render with filtered
  list.innerHTML = '';
  filtered.forEach(function(att) {
    var it = document.createElement('div'); it.className = 'signal-item';
    var ic = ['oc','oi','ok','os'][att.signalIntent] || 'oc';
    var isym = att.signalIntentSymbol || ['ΩC','ΩI','ΩK','ΩS'][att.signalIntent] || '?';
    var sg = getShortGlyphs(att.fromKeyId);
    var gs = sg ? '<span style="font-size:10px;color:var(--text-soft);margin-left:4px;">' + sg + '</span>' : '';
    var content = att.signalContent || att.signalCid || att.signalContentRef || '[Your signal]';
    var fromKeyDisplay = att.fromKeyId !== null ? 'K#' + att.fromKeyId : (att.fromWallet ? att.fromWallet.slice(0,6) + '...' : '?');
      it.innerHTML = '<div style="flex:1;"><div class="signal-item-header"><span style="color:var(--keys-accent);font-weight:600;">' + fromKeyDisplay + '</span>'+gs+'<span class="intent-tag '+ic+'" style="margin-left:6px;">'+isym+'</span><span style="margin-left:6px;font-size:10px;color:#fbbf24;">Attested</span><span style="color:var(--text-soft);margin-left:6px;">Epoch '+att.epoch+'</span></div><div class="signal-content-preview" style="font-size:11px;opacity:0.8;">'+escapeHtml(content)+'</div></div><span class="signal-time">'+(att.timeAgo||'')+'</span>';
    list.appendChild(it);
  });
};
window.loadReceivedAttests = loadReceivedAttests;


window.showSignalPopup = function(hash) {
  var sig = null;
  if (allAttestableSignals) sig = allAttestableSignals.find(function(s) { return s.hash === hash; });
  if (!sig && allReceivedReplies) sig = allReceivedReplies.find(function(s) { return s.hash === hash; });
  if (!sig) return;
  var content = sig.cid || '[Silence]';
  var isym = sig.intentSymbol || ['ΩC','ΩI','ΩK','ΩS'][sig.intent] || '?';
  var msg = 'Signal from K#' + sig.keyId + '\n\nIntent: ' + isym + '\nEpoch: ' + (sig.epoch || '?') + '\nAttestations: ' + (sig.attestCount || 0) + '\n\nContent:\n' + content;
  alert(msg);
};

window.downloadAttestableCSV = function() {
  if (!allAttestableSignals || allAttestableSignals.length === 0) { showToast('No attestable signals to export', 2000); return; }
  var intents = ['ΩC (Collective)','ΩI (Individual)','ΩK (Co-Create)','ΩS (Silence)'];
  var rows = [['Hash','Key ID','Key Glyphs','Intent','Signal Content','Epoch','Attestations','Time']];
  allAttestableSignals.forEach(function(sig) {
    rows.push([sig.hash, sig.keyId, keyGlyphsCache[sig.keyId]||'', intents[sig.intent]||'', sig.cid||'[Silence]', sig.epoch||'', sig.attestCount||0, sig.timeAgo||'']);
  });
  downloadCSV(rows, 'z1n_attestable_signals_' + new Date().toISOString().slice(0,10) + '.csv');
  showToast('CSV downloaded (' + allAttestableSignals.length + ' signals)', 2000);
};

window.downloadSentAttestsCSV = function() { 
  if (allSentAttests.length === 0) { showToast('No attestations to export', 2000); return; } 
  var intents = ['ΩC (Collective)','ΩI (Individual)','ΩK (Co-Create)','ΩS (Silence)']; 
  var rows = [['Signal Hash','Signal Key ID','Signal Glyphs','Intent','Signal Content','Epoch','Time']]; 
  allSentAttests.forEach(function(att) { 
    rows.push([att.signalHash||'', att.signalKeyId||'', keyGlyphsCache[att.signalKeyId]||'', intents[att.signalIntent]||'', att.signalContent||att.signalCid||'', att.epoch||'', att.timeAgo||'']); 
  }); 
  downloadCSV(rows, 'z1n_sent_attests_' + new Date().toISOString().slice(0,10) + '.csv'); 
  showToast('CSV downloaded', 2000); 
};

window.downloadReceivedAttestsCSV = function() {
  if (allReceivedAttests.length === 0) { showToast('No attestations to export', 2000); return; }
  var intents = ['ΩC (Collective)','ΩI (Individual)','ΩK (Co-Create)','ΩS (Silence)'];
  var rows = [['From Key ID','From Glyphs','Your Signal Content','Intent','Epoch','Time']];
  allReceivedAttests.forEach(function(att) {
    rows.push([att.fromKeyId||'', keyGlyphsCache[att.fromKeyId]||'', att.signalContent||att.signalCid||'', intents[att.signalIntent]||'', att.epoch||'', att.timeAgo||'']);
  });
  downloadCSV(rows, 'z1n_received_attests_' + new Date().toISOString().slice(0,10) + '.csv');
  showToast('CSV downloaded', 2000);
};

  var whisperValidationTimer = null;
  window.validateWhisperRecipient = function() {
    var input = document.getElementById('whisperRecipient');
    var msg = document.getElementById('whisperRecipientValidation');
    var btn = document.getElementById('btnSubmitWhisper');
    if (!input || !msg) return;
    var val = input.value.trim();
    if (!val) { input.classList.remove('valid', 'invalid'); msg.textContent = ''; msg.className = 'validation-msg'; if (btn) btn.disabled = false; return; }
    var keyId = parseInt(val);
    if (isNaN(keyId) || keyId <= 0) { input.classList.remove('valid'); input.classList.add('invalid'); msg.textContent = '✗ Enter a valid Key ID'; msg.className = 'validation-msg error'; if (btn) btn.disabled = true; return; }
    if (keyId === currentKeyId) { input.classList.remove('valid'); input.classList.add('invalid'); msg.textContent = '✗ Cannot whisper to yourself'; msg.className = 'validation-msg error'; if (btn) btn.disabled = true; return; }
    msg.textContent = 'Checking...'; msg.className = 'validation-msg'; input.classList.remove('valid', 'invalid');
    clearTimeout(whisperValidationTimer);
    whisperValidationTimer = setTimeout(async function() {
      try {
        var ownerData = SEL.ownerOf + enc256(keyId);
        var result = await rpc('eth_call', [{ to: Z1N_KEY, data: ownerData }, 'latest']);
        if (result && result !== '0x' && result !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          input.classList.remove('invalid'); input.classList.add('valid');
          msg.textContent = '✓ K#' + keyId + ' exists'; msg.className = 'validation-msg success';
          if (btn) btn.disabled = false;
        } else {
          input.classList.remove('valid'); input.classList.add('invalid');
          msg.textContent = '✗ K#' + keyId + ' does not exist'; msg.className = 'validation-msg error';
          if (btn) btn.disabled = true;
        }
      } catch (e) {
        input.classList.remove('valid'); input.classList.add('invalid');
        msg.textContent = '✗ Could not verify key'; msg.className = 'validation-msg error';
        if (btn) btn.disabled = true;
      }
    }, 500);
  };

window.submitWhisper = async function() {
    var st = document.getElementById('whisperStatus');
    var ct = document.getElementById('whisperContent').value.trim();
    var toInput = document.getElementById('whisperRecipient');
    var to = parseInt(toInput?.value) || 0;
    
    if (!currentAccount || currentKeyId === null) { 
      st.innerHTML = '<div class="status-msg error">Connect wallet first.</div>'; 
      return; 
    }
    if (!ct) { 
      st.innerHTML = '<div class="status-msg error">Enter a message.</div>'; 
      return; 
    }
    if (to <= 0) {
      st.innerHTML = '<div class="status-msg error">Enter a valid recipient Key ID.</div>';
      return;
    }
    if (to === currentKeyId) {
      st.innerHTML = '<div class="status-msg error">Cannot whisper to yourself.</div>';
      return;
    }
    
    st.innerHTML = '<div class="status-msg pending">Sending whisper...</div>';
    try {
      await loadEthers(); 
      var iface = new ethersLib.Interface(['function sendPure(uint256 fromKeyId, uint256 toKeyId, string cid)']); 
      var data = iface.encodeFunctionData('sendPure', [currentKeyId, to, ct]);
      var tx = await provider.request({method:'eth_sendTransaction', params:[{from:currentAccount, to:Z1N_SIGNAL, data:data}]});
      st.innerHTML = '<div class="status-msg pending">Confirming...</div>';
      
      for (var i = 0; i < 30; i++) { 
        await new Promise(function(r){ setTimeout(r, 2000); }); 
        var rc = await rpc('eth_getTransactionReceipt', [tx]); 
        if (rc && rc.status === '0x1') { 
          document.getElementById('whisperContent').value = ''; 
          document.getElementById('whisperCharCount').textContent = '0 / 500'; 
          st.innerHTML = '<div class="status-msg" style="background:rgba(255,213,86,0.15);border:1px solid #ffd556;color:#ffd556;">✓ Whisper sent to K#' + to + '!</div>'; 
          showToast('✅ Whisper sent!', 4000); 
          // v2.3.1: Add pending whisper to UI immediately
          /* allWhispers removed - Direct Channel handles this */ var _w = ({
            fromKeyId: currentKeyId,
            toKeyId: to,
            cid: ct,
            content: ct,
            epoch: activeEpoch,
            blockNumber: 999999999,
            txHash: tx,
            timeAgo: 'just now',
            _pending: true
          });
          // loadSentWhispers/loadReceivedWhispers removed
          updateTabBadges();
          return;
        } 
        if (rc && rc.status === '0x0') { 
          st.innerHTML = '<div class="status-msg error">Transaction failed.</div>'; 
          return; 
        } 
      }
      st.innerHTML = '<div class="status-msg error">Timeout waiting for confirmation.</div>';
    } catch (e) { 
      st.innerHTML = '<div class="status-msg error">' + (e.message || 'Failed').slice(0, 150) + '</div>'; 
    }
  };
  

  async function loadActivityFeed() {
    var feed = document.getElementById('activityFeed'); if (!feed || currentKeyId === null) return;
    try {
      var activities = [];
      var sigRes = await fetch(API_BASE + '/signals?keyId=' + currentKeyId + '&limit=5', {cache:'no-store'}), sigData = await sigRes.json();
      (sigData.signals || []).forEach(function(s) { activities.push({ type: 'signal', text: 'You sent <strong>' + (s.intentSymbol || 'Ω') + '</strong> signal', meta: (s.timeAgo || '') + ' · Epoch ' + s.epoch + ' · ' + (s.attestCount || 0) + ' attestations', time: s.blockNumber || 0 }); });
      activities.sort(function(a, b) { return b.time - a.time; });
      if (activities.length === 0) { feed.innerHTML = '<div class="activity-item"><span style="color: var(--text-soft);">No recent activity</span></div>'; return; }
      feed.innerHTML = '';
      activities.slice(0, 6).forEach(function(a) { var div = document.createElement('div'); div.className = 'activity-item'; div.innerHTML = '<span>' + a.text + '</span><div class="activity-meta">' + a.meta + '</div>'; feed.appendChild(div); });
    } catch (e) { feed.innerHTML = '<div class="activity-item"><span style="color: var(--text-soft);">Could not load activity</span></div>'; }
  }

  window.submitPoGSignal = async function() {
    var st = document.getElementById('pogStatus'), ct = document.getElementById('signalContent').value.trim();
    if (selectedIntent !== 3 && !ct) { st.innerHTML = '<div class="status-msg error">Enter signal content.</div>'; return; }
    if (signalsUsed >= 2) { st.innerHTML = '<div class="status-msg error">Max 2 signals this epoch.</div>'; return; }
    st.innerHTML = '<div class="status-msg pending">Preparing...</div>';
    try {
      await loadEthers();
      var clientTimestamp = Math.floor(Date.now() / 1000);
      var contentRef = selectedIntent === 3 ? '' : ct.slice(0, 320);
      var sym = 0;
      var glyphEl = document.getElementById('selectedGlyphIndex');
      if (glyphEl && glyphEl.value !== '') sym = parseInt(glyphEl.value) || 0;
      var intent = selectedIntent;
      var reply = '0x' + '0'.repeat(64);
      var replyHashEl = document.getElementById('replyToHash');
      if (signalType === 'reply' && replyHashEl) { var ri = replyHashEl.value.trim(); if (ri && ri.startsWith('0x') && ri.length >= 66) { reply = ri.slice(0, 66); } }
      var abiCoder = ethersLib.AbiCoder.defaultAbiCoder();
      var hash = ethersLib.keccak256(abiCoder.encode(
          ['uint256', 'string', 'uint8', 'uint8', 'bytes32', 'uint64'],
          [BigInt(currentKeyId), contentRef, sym, intent, reply, BigInt(clientTimestamp)]
      ));
      if (pogStealthEnabled && stealthRelayerAvailable) {
        st.innerHTML = '<div class="status-msg pending">🔒 Stealth mode: Sign message...</div>';
        try { var result = await submitStealthSignal(currentKeyId, hash, intent, sym, 0, reply); signalsUsed++; updateDots(); document.getElementById('signalContent').value = ''; window.updateCharCount(); st.innerHTML = '<div class="status-msg" style="background:rgba(255,213,86,0.15);border:1px solid #ffd556;color:#ffd556;">🔒 Stealth signal submitted! <a href="' + EXPLORER + '/tx/' + result.txHash + '" target="_blank">View tx</a></div>'; showToast('🔒 Stealth signal submitted!', 4000); allSentSignals.unshift({ hash: result.txHash || hash, keyId: currentKeyId, intent: selectedIntent, intentSymbol: ['ΩC','ΩI','ΩK','ΩS'][selectedIntent], cid: contentRef || '[Silence]', epoch: activeEpoch, attestCount: 0, timeAgo: 'just now', replyTo: signalType === 'reply' ? reply : null, _pending: true }); await loadSentSignals(); return; } catch (e) { st.innerHTML = '<div class="status-msg error">Stealth failed: ' + (e.message || 'Unknown error').slice(0, 150) + '</div>'; return; }
      }
      var iface = new ethersLib.Interface(['function submitSignal(uint256 tokenId, bytes32 signalHash, string contentRef, uint8 symbolIndex, uint8 intent, bytes32 replyTo, uint64 clientTimestamp)']);
      var data = iface.encodeFunctionData('submitSignal', [BigInt(currentKeyId), hash, contentRef, sym, intent, reply, BigInt(clientTimestamp)]);
      st.innerHTML = '<div class="status-msg pending">Confirm in wallet...</div>';
      var txParams = { from: currentAccount, to: Z1N_SIGNAL, data: data };
      var tx = await provider.request({method:'eth_sendTransaction', params:[txParams]}); st.innerHTML = '<div class="status-msg pending">Transaction sent...</div>';
      for (var i = 0; i < 60; i++) { await new Promise(function(r){ setTimeout(r, 2000); }); var rc = await rpc('eth_getTransactionReceipt', [tx]); if (rc && rc.status === '0x1') { signalsUsed++; updateDots(); document.getElementById('signalContent').value = ''; window.updateCharCount(); st.innerHTML = '<div class="status-msg" style="background:rgba(255,213,86,0.15);border:1px solid #ffd556;color:#ffd556;">✅ Signal submitted! <a href="' + EXPLORER + '/tx/' + tx + '" target="_blank">View tx</a></div>'; showToast('✅ Signal submitted!', 4000); var pendingSignal = { hash: tx, keyId: currentKeyId, intent: selectedIntent, intentSymbol: ['ΩC','ΩI','ΩK','ΩS'][selectedIntent], cid: contentRef || '[Silence]', epoch: activeEpoch, attestCount: 0, timeAgo: 'just now', replyTo: signalType === 'reply' ? reply : null, _pending: true };
allSentSignals.unshift(pendingSignal);
await loadSentSignals();
var sentSignalsCountEl = document.getElementById('sentSignalsCount'); if (sentSignalsCountEl) sentSignalsCountEl.textContent = '(' + allSentSignals.length + ')';
var list = document.getElementById('sentSignalsList');
if (list && !list.querySelector('[data-hash="' + tx + '"]')) { var it = document.createElement('div'); it.className = 'signal-item'; it.dataset.hash = tx; it.style.borderLeft = '2px solid var(--keys-accent)'; it.innerHTML = '<div style="flex:1;"><div class="signal-item-header"><span class="intent-tag ' + ['oc','oi','ok','os'][selectedIntent] + '">' + pendingSignal.intentSymbol + '</span><span class="signal-attests" style="margin-left:6px;">✓0</span><span style="color:var(--text-soft);margin-left:6px;">Epoch ' + activeEpoch + '</span><span style="margin-left:6px;font-size:9px;color:var(--keys-accent);">⏳ pending</span></div><div class="signal-content-preview" style="white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:0.8;">' + escapeHtml(pendingSignal.cid) + '</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;"><span class="signal-time">just now</span></div>'; list.insertBefore(it, list.firstChild); } return; } if (rc && rc.status === '0x0') { st.innerHTML = '<div class="status-msg error">Transaction reverted.</div>'; return; } }
      st.innerHTML = '<div class="status-msg error">Timeout waiting for receipt.</div>';
    } catch (e) { st.innerHTML = '<div class="status-msg error">' + (e.message || 'Failed').slice(0, 200) + '</div>'; }
  };

 window.submitAttestInline = async function() {
    if (!selectedAttestSignal || currentKeyId === null) { showToast('Select a signal first', 3000, true); return; }
    if (attestsUsed >= 2) { showToast('Max 2 attestations per epoch', 3000, true); return; }
    var btn = document.getElementById('btnAttestNormalInline'), orig = btn.textContent; btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      var hash = selectedAttestSignal.hash;
      if (attestStealthEnabled && stealthRelayerAvailable) { 
        btn.textContent = 'Signing...'; 
        try { 
          var result = await submitStealthAttestation(currentKeyId, hash);
          attestsUsed++;
          updateDots();
          var pendingAttest = { signalHash: hash, signalKeyId: selectedAttestSignal.keyId, signalIntent: selectedAttestSignal.intent, signalIntentSymbol: selectedAttestSignal.intentSymbol, signalContent: selectedAttestSignal.cid || '[Silence]', signalCid: selectedAttestSignal.cid || '[Silence]', epoch: activeEpoch, timeAgo: 'just now', _pending: true };
          allSentAttests.unshift(pendingAttest);
          await loadAttestableSignals();
          updateAttestBtn();
          showToast('Stealth attestation submitted!', 4000);
          await loadSentAttests();
          return;
        } catch (e) { 
          var errMsg = e.message || 'Unknown error';
          if (errMsg.includes('already attested') || errMsg.includes('Already attested') || errMsg.includes('CALL_EXCEPTION')) {
            showToast('Your wallet already attested this signal', 4000, true);
          } else if (errMsg.includes('revert')) {
            showToast('Transaction failed - you may have already attested this signal', 4000, true);
          } else {
            showToast('Stealth failed: ' + errMsg.slice(0, 80), 4000, true);
          }
          btn.textContent = orig; btn.disabled = false; 
          return; 
        } 
      }
      await loadEthers(); 
      var iface = new ethersLib.Interface(['function attestSignal(bytes32 signalHash, uint256 tokenId)']); 
      var data = iface.encodeFunctionData('attestSignal', [hash, BigInt(currentKeyId)]);
      var txParams = { from: currentAccount, to: Z1N_SIGNAL, data: data };
      var tx = await provider.request({method:'eth_sendTransaction',params:[txParams]}); 
      btn.textContent = 'Confirming...';
      for (var i = 0; i < 30; i++) { 
        await new Promise(function(r){ setTimeout(r, 2000); }); 
        var rc = await rpc('eth_getTransactionReceipt', [tx]); 
        if (rc && rc.status === '0x1') { 
          attestsUsed++;
          updateDots();
          var pendingAttest = { signalHash: hash, signalKeyId: selectedAttestSignal.keyId, signalIntent: selectedAttestSignal.intent, signalIntentSymbol: selectedAttestSignal.intentSymbol, signalContent: selectedAttestSignal.cid || '[Silence]', signalCid: selectedAttestSignal.cid || '[Silence]', epoch: activeEpoch, timeAgo: 'just now', _pending: true };
          allSentAttests.unshift(pendingAttest);
          await loadAttestableSignals();
          updateAttestBtn();
          showToast('Attestation submitted!', 4000);
          await loadSentAttests();
          btn.textContent = orig;
          btn.disabled = false;
          return; 
        } 
        if (rc && rc.status === '0x0') {
          showToast('Transaction failed - you may have already attested this signal', 4000, true);
          btn.textContent = orig; 
          btn.disabled = false;
          return;
        }
      }
      throw new Error('Timeout');
    } catch (e) { 
      var errMsg = e.message || 'Unknown error';
      if (errMsg.includes('reject') || errMsg.includes('denied') || e.code === 4001) {
        showToast('Transaction rejected', 3000, true);
      } else if (errMsg.includes('already attested') || errMsg.includes('revert') || errMsg.includes('CALL_EXCEPTION')) {
        showToast('Your wallet already attested this signal', 4000, true);
      } else {
        showToast('Failed: ' + errMsg.slice(0, 80), 4000, true);
      }
      btn.textContent = orig; 
      btn.disabled = false; 
    }
  };

  // CSV
  function escapeCSV(val) { if (val === null || val === undefined) return ''; var s = String(val).replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' '); if (s.includes(',') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"'; return s; }
  function downloadCSV(rows, filename) { var csv = rows.map(function(row){ return row.map(escapeCSV).join(','); }).join('\n'); var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
  window.downloadSentSignalsCSV = async function() {
  showToast('Preparing CSV...', 2000);
  try {
    var p = new URLSearchParams();
    p.set('keyId', String(currentKeyId));
    p.set('limit', '1000');
    var sortSelect = document.getElementById('sentSortSelect');
    if (sortSelect) p.set('sort', sortSelect.value);
    var intentFilter = document.getElementById('sentIntentFilter');
    if (intentFilter && intentFilter.value) p.set('intents', intentFilter.value);
    var r = await fetch(API_BASE + '/signals?' + p.toString(), {cache:'no-store'});
    var d = await r.json();
    var sigs = d.signals || [];
    var typeFilter = document.getElementById('sentTypeFilter');
    if (typeFilter && typeFilter.value) {
      sigs = sigs.filter(function(sig) {
        var isReply = sig.replyTo && sig.replyTo !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        return typeFilter.value === 'reply' ? isReply : !isReply;
      });
    }
    if (sigs.length === 0) { showToast('No signals to export', 2000); return; }
    var in_ = ['ΩC (Collective)', 'ΩI (Individual)', 'ΩK (Co-Create)', 'ΩS (Silence)'];
    var rows = [['Hash', 'Key ID', 'Key Glyphs', 'Intent', 'Type', 'Reply To Hash', 'Reply To Key ID', 'Reply To Key Glyphs', 'Signal Content', 'Epoch', 'Attestations', 'Timestamp']];
    sigs.forEach(function(sig) {
      var isReply = sig.replyTo && sig.replyTo !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      rows.push([
        sig.hash, sig.keyId, keyGlyphsCache[sig.keyId] || '',
        in_[sig.intent] || sig.intentSymbol || '',
        isReply ? 'Reply' : 'New',
        isReply ? sig.replyTo : '',
        isReply && sig.replyToKeyId ? 'K#' + sig.replyToKeyId : '',
        isReply && sig.replyToKeyId ? (keyGlyphsCache[sig.replyToKeyId] || '') : '',
        sig.cid || '[Silence]', sig.epoch, sig.attestCount || 0, sig.timeAgo || ''
      ]);
    });
    downloadCSV(rows, 'z1n_sent_signals_' + new Date().toISOString().slice(0,10) + '.csv');
    showToast('CSV downloaded (' + sigs.length + ' signals)', 2000);
  } catch (e) { showToast('CSV failed: ' + e.message, 3000, true); }
};

  // ═══════════════════════════════════════════════════════════════
  // WALLET CONNECTION - v2.3.1: Uses indexed API instead of RPC
  // ═══════════════════════════════════════════════════════════════
  async function connect() {
    var eth = getProvider(); if (!eth) { alert('Install a Web3 wallet (MetaMask/Coinbase/Phantom).'); return; }
    provider = eth;
    try {
      var accs = await provider.request({ method: 'eth_accounts' }); if (!accs || accs.length === 0) accs = await provider.request({ method: 'eth_requestAccounts' });
      currentAccount = accs[0]; // Altijd de actieve MM wallet gebruiken

      // Waarschuwing als URL wallet niet matcht met actieve MM wallet
      if (urlWallet && currentAccount.toLowerCase() !== urlWallet.toLowerCase()) {
        console.warn('MM wallet mismatch: active=' + currentAccount + ', URL=' + urlWallet);
      }
      
      var cid = await provider.request({ method: 'eth_chainId' });
      if (cid !== CHAIN_ID) { try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] }); } catch (se) { if (se.code === 4902) { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_ID, chainName: 'Polygon', nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, rpcUrls: ['https://polygon-rpc.com'], blockExplorerUrls: ['https://polygonscan.com'] }] }); } } }
      
      currentKeyId = null;
      console.log('URL params - key:', urlKeyId, 'wallet:', urlWallet, 'tab:', urlTab);

      // ═══════════════════════════════════════════════════════════════
      // INDEXED API: Fetch all wallet keys in 1 call (was N+1 RPC calls)
      // ═══════════════════════════════════════════════════════════════
      walletKeyIds = [];
      try {
        var keysResponse = await fetch(API_BASE + '/wallet/' + currentAccount + '/keys', { cache: 'no-store' });
        if (keysResponse.ok) {
          var keysData = await keysResponse.json();
          walletKeyIds = keysData.keys.map(function(k) { return k.tokenId; });
          // Bonus: pre-cache glyphs for all wallet keys
          keysData.keys.forEach(function(k) { 
            keyGlyphsCache[k.tokenId] = k.glyphLine || ''; 
          });
          console.log('Wallet keys from API:', walletKeyIds.length, 'keys');
        } else {
          throw new Error('API returned ' + keysResponse.status);
        }
      } catch (apiError) {
        // Fallback to RPC if API fails
        console.warn('API fallback to RPC:', apiError.message);
        var bd = SEL.balanceOf + encAddr(currentAccount);
        var br = await rpc('eth_call', [{ to: Z1N_KEY, data: bd }, 'latest']);
        var bal = parseInt(br, 16);
        for (var i = 0; i < bal; i++) {
          var td = SEL.tokenOfOwnerByIndex + encAddr(currentAccount) + enc256(i);
          var tr = await rpc('eth_call', [{ to: Z1N_KEY, data: td }, 'latest']);
          walletKeyIds.push(parseInt(tr, 16));
        }
      }

      if (walletKeyIds.length === 0) { 
        alert('No Z1N Keys on this wallet'); 
        location.href = '/mint-key.html'; 
        return; 
      }
      console.log('Wallet owns keys:', walletKeyIds);

      // Use URL key ID if provided and wallet owns it
      if (urlKeyId !== null && !isNaN(urlKeyId) && urlKeyId >= 0) {
        if (walletKeyIds.includes(urlKeyId)) {
          currentKeyId = urlKeyId;
          console.log('URL key verified, owned by active wallet:', currentKeyId);
        } else {
          // Check if key exists but owned by different wallet
          try {
            var ownerData = SEL.ownerOf + enc256(urlKeyId);
            var ownerResult = await rpc('eth_call', [{ to: Z1N_KEY, data: ownerData }, 'latest']);
            if (ownerResult && ownerResult !== '0x' && ownerResult !== '0x' + '0'.repeat(64)) {
              var keyOwner = '0x' + ownerResult.slice(26).toLowerCase();
              console.warn('URL key #' + urlKeyId + ' owned by ' + keyOwner + ', not ' + currentAccount);
              currentKeyId = urlKeyId; // Still load it but show warning
            }
          } catch (e) {
            console.log('URL key verification failed');
          }
        }
      }

      // Fall back to wallet's first key if no valid URL key
      if (currentKeyId === null) {
        currentKeyId = walletKeyIds[0];
        console.log('Using first wallet key:', currentKeyId);
        
        // Update URL to reflect actual key (without reload)
        var newUrl = new URL(window.location.href);
        newUrl.searchParams.set('key', currentKeyId);
        window.history.replaceState({}, '', newUrl.toString());
      }

      document.getElementById('connectState').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      document.getElementById('walletDisplay').textContent = currentAccount.slice(0, 6) + '...' + currentAccount.slice(-4);

      // Toon waarschuwing als verkeerde wallet actief is
      if (urlWallet && currentAccount.toLowerCase() !== urlWallet.toLowerCase()) {
        var walletBadge = document.querySelector('.wallet-badge');
        if (walletBadge) {
          walletBadge.style.borderColor = '#f87171';
          walletBadge.style.background = 'rgba(248,113,113,0.15)';
          walletBadge.innerHTML = '<span class="dot" style="background:#f87171;"></span><span>' + currentAccount.slice(0,6) + '...' + currentAccount.slice(-4) + '</span><span style="margin-left:8px;font-size:10px;color:#f87171;">⚠️ Wrong wallet</span>';
        }
        showToast('⚠️ Switch MM to ' + urlWallet.slice(0,6) + '...' + urlWallet.slice(-4), 5000);
      }

      var walletUrl = './your-keys.html?wallet=' + encodeURIComponent(currentAccount);
      document.getElementById('backLink').href = walletUrl;
      document.getElementById('navYourKeys').href = walletUrl;
      window.Z1N = {
  keyId: currentKeyId,
  wallet: currentAccount,
  provider: provider,
  epoch: activeEpoch,
  API_BASE: API_BASE,
  rpc: rpc,
  showToast: showToast,
  walletKeyIds: walletKeyIds
};

await loadKeyData(currentKeyId);

      await checkStealthAvailability();
      
      if (!provider.__z1nBound) {
        provider.__z1nBound = true;
        if (provider.on) {
          provider.on('accountsChanged', function(){ location.reload(); });
          provider.on('chainChanged', function(){ location.reload(); });
        }
      }
    } catch (e) { alert('Failed: ' + e.message); }
  }

// ─────────────────────────────────────────────────────────────────
// ACTIVITY FEED STATE
// ─────────────────────────────────────────────────────────────────

window.ActivityFeed = {
  currentTab: 'all',
  activities: [],
  readItems: new Set(),
  loaded: false, // Track of activity al geladen is
icons: {
    signal: '📡',
    attest_sent: '✓',
    attest_received: '✓',
    direct_sent: '💬',
    direct_received: '💬',
    canon_mint: 'Ω',
    reply_sent: '↩',
    reply_received: '↩',
    artefact_received: '◈',
    treasury_claimable: '⬡'
  }
};

// ─────────────────────────────────────────────────────────────────
// INIT - Call this from loadKeyData()
// ─────────────────────────────────────────────────────────────────

function initActivityFeed() {
  if (currentKeyId === null) return;

  // Reset readItems for this key
  ActivityFeed.readItems = new Set();
  
  // Load read items from localStorage
  var storedRead = localStorage.getItem('z1n_activity_read_' + currentKeyId);
  if (storedRead) {
    try { 
      ActivityFeed.readItems = new Set(JSON.parse(storedRead)); 
    } catch (e) { 
      ActivityFeed.readItems = new Set(); 
    }
  }
  
  // Reset loaded flag for new key
  ActivityFeed.loaded = false;
  
  // Load activity feed (eerste keer)
  loadActivityFeed();
}

// ─────────────────────────────────────────────────────────────────
// LOAD ALL ACTIVITIES
// ─────────────────────────────────────────────────────────────────

async function loadActivityFeed() {
  var feed = document.getElementById('activityFeed');
  if (!feed || currentKeyId === null) return;
  
  if (!ActivityFeed.loaded) {
    feed.innerHTML = '<div class="activity-loading">Loading...</div>';
  }
  
  try {
    var activities = [];

    // ─── SIGNALS SENT (from allSentSignals) ───
    (allSentSignals || []).forEach(function(s) {
      var isReply = s.replyTo && s.replyTo !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      activities.push({
        id: 'signal_' + s.hash,
        type: isReply ? 'reply_sent' : 'signal',
        direction: 'initiated',
        timestamp: s.blockNumber || 0,
        epoch: s.epoch,
        intent: s.intent,
        content: s.cid,
        attestCount: s.attestCount || 0
      });
    });

    // ─── ATTESTS SENT (from allSentAttests) ───
    (allSentAttests || []).forEach(function(a) {
      activities.push({
        id: 'attest_sent_' + (a.signalHash || '') + '_' + (a.blockNumber || Math.random()),
        type: 'attest_sent',
        direction: 'initiated',
        timestamp: a.blockNumber || 0,
        epoch: a.epoch,
        intent: a.signalIntent,
        content: a.signalContent || a.signalCid,
        targetKeyId: a.signalKeyId
      });
    });

    // ─── ATTESTS RECEIVED (from allReceivedAttests) ───
    (allReceivedAttests || []).forEach(function(a) {
      activities.push({
        id: 'attest_recv_' + (a.signalHash || '') + '_' + (a.fromKeyId || '') + '_' + (a.blockNumber || Math.random()),
        type: 'attest_received',
        direction: 'received',
        timestamp: a.blockNumber || 0,
        epoch: a.epoch,
        intent: a.signalIntent,
        content: a.signalContent || a.signalCid,
        fromKeyId: a.fromKeyId
      });
    });

    // ─── DIRECT CHANNEL: laad badge-data zonder full tab render ───
    try {
      var dmResp = await fetch(getAPI ? getAPI() : (window.Z1N ? window.Z1N.API_BASE : API_BASE) + '/direct-channel/key/' + currentKeyId + '?limit=100', {cache:'no-store'});
      if (dmResp.ok) {
        var dmData = await dmResp.json();
        var dmReceived = (dmData.messages || []).filter(function(m) { return m.direction === 'received'; });
        var seenIds = JSON.parse(localStorage.getItem('z1n_direct_seen_' + currentKeyId) || '[]');
        var seenSet = new Set(seenIds);
        dmReceived.forEach(function(m) {
          var msgId = 'direct_recv_' + (m.txHash || m.blockNumber || m.senderKeyId + '_' + m.timestamp);
          activities.push({
            id: msgId,
            type: 'direct_received',
            direction: 'received',
            timestamp: m.blockNumber || m.timestamp || 0,
            fromKeyId: m.senderKeyId,
            content: m.messageType === 'encrypted' ? '[Encrypted]' : ''
          });
        });
      }
    } catch(e) {}

    // (allWhispers removed)
    ([]).forEach(function(w) {
      var isSent = w.fromKeyId === currentKeyId;
      var isReceived = w.toKeyId === currentKeyId;
      
      if (isSent && w.toKeyId > 0) {
        activities.push({
          id: 'whisper_sent_' + (w.txHash || w.blockNumber || Math.random()),
          type: 'whisper_sent',
          direction: 'initiated',
          timestamp: w.blockNumber || 0,
          content: w.cid || w.content,
          targetKeyId: w.toKeyId
        });
      }
      if (isReceived && !isSent) {
        activities.push({
          id: 'whisper_recv_' + (w.txHash || w.blockNumber || Math.random()),
          type: 'whisper_received',
          direction: 'received',
          timestamp: w.blockNumber || 0,
          content: w.cid || w.content,
          fromKeyId: w.fromKeyId
        });
      }
    });

    // ─── ARTEFACTS IN MY VIEW (badge only) ───
    try {
      var arR = await fetch(API_BASE + '/key/' + currentKeyId + '/artefacts', {cache:'no-store'});
      if (arR.ok) {
        var arD = await arR.json();
        (arD.liveArtefacts || []).filter(function(a){ return a.status === 'in_my_view'; }).forEach(function(a) {
          var msgId = 'artefact_recv_' + a.tokenId;
          // Badge only — geen feed item zonder sender info
          activities.push({ id: msgId, type: 'artefact_received', direction: 'received', timestamp: a.blockNumber || a.tokenId, fromKeyId: null, tokenId: a.tokenId, content: '', badgeOnly: true });
        });
      }
    } catch(e) {}

    // ─── DIRECT RECEIVED (badge only) ───
    try {
      var dmR = await fetch(API_BASE + '/direct-channel/key/' + currentKeyId + '?limit=100', {cache:'no-store'});
      if (dmR.ok) {
        var dmD = await dmR.json();
        var dmSeenIds = JSON.parse(localStorage.getItem('z1n_direct_seen_' + currentKeyId) || '[]');
        var dmSeenSet = new Set(dmSeenIds);
        (dmD.messages || []).filter(function(m){ return m.direction === 'received'; }).forEach(function(m) {
          var msgId = 'direct_recv_' + (m.txHash || m.blockNumber || m.senderKeyId + '_' + m.timestamp);
          activities.push({
            id: msgId,
            type: 'direct_received',
            direction: 'received',
            timestamp: m.blockNumber || m.timestamp || 0,
            fromKeyId: m.senderKeyId,
            content: ''
          });
        });
      }
    } catch(e) {}

    // ─── ARTEFACTS RECEIVED (from allLiveArtefacts) ───
    (allLiveArtefacts || []).forEach(function(art) {
      var isReceived = (art.isSent === false) && (art.receivedFromKeyId || art.fromKeyId || art.senderKeyId);
      if (isReceived) {
        var fromKey = art.receivedFromKeyId || art.fromKeyId || art.senderKeyId || '?';
        activities.push({
          id: 'artefact_recv_' + art.tokenId,
          type: 'artefact_received',
          direction: 'received',
          timestamp: art.blockNumber || art.timestamp || 0,
          epoch: art.epoch || art.receivedEpoch || art.mintEpoch || undefined,
          fromKeyId: fromKey,
          tokenId: art.tokenId
        });
      }
    });

    // ─── REPLIES RECEIVED (from allReceivedReplies) ───
    (allReceivedReplies || []).forEach(function(s) {
      activities.push({
        id: 'reply_recv_' + s.hash,
        type: 'reply_received',
        direction: 'received',
        timestamp: s.blockNumber || 0,
        epoch: s.epoch,
        intent: s.intent,
        content: s.cid,
        fromKeyId: s.keyId,
        attestCount: s.attestCount || 0
      });
    });

    // ─── TREASURY CLAIMABLE (from claimableEpochsData) ───
    (claimableEpochsData || []).forEach(function(ep) {
      activities.push({
        id: 'treasury_claim_' + ep.epochId,
        type: 'treasury_claimable',
        direction: 'received',
        timestamp: ep.blockNumber || ep.epochId || 0,
        epoch: ep.epochId,
        amount: ep.amountFormatted
      });
    });

    // Sort by timestamp (newest first)
    activities.sort(function(a, b) { return b.timestamp - a.timestamp; });
    
    // Keep max 50 items
    ActivityFeed.activities = activities.slice(0, 50);
    ActivityFeed.loaded = true;
    
    renderActivityFeed();
    updateTabBadges();
    
  } catch (e) {
    console.error('loadActivityFeed error:', e);
    feed.innerHTML = '<div class="activity-empty"><div class="activity-empty-icon">⚠️</div><div class="activity-empty-text">Failed to load activity</div></div>';
  }
}

// ─────────────────────────────────────────────────────────────────
// RENDER ACTIVITY FEED
// ─────────────────────────────────────────────────────────────────

function renderActivityFeed() {
  var container = document.getElementById('activityFeed');
  if (!container) return;
  
  // Tel unseen per categorie
  var countSignals = 0, countArtefacts = 0, countTreasury = 0;
  
ActivityFeed.activities.forEach(function(a) {
    if (ActivityFeed.readItems.has(a.id)) return;
    
    if (a.type === 'reply_received' || a.type === 'attest_received' || a.type === 'direct_received') {
      countSignals++;
    } else if (a.type.includes('artefact')) {
      countArtefacts++;
    } else if (a.type.includes('treasury')) {
      countTreasury++;
    }
  });
  
  // Update badges
  var badgeSignals = document.getElementById('badgeSignals');
  var badgeArtefacts = document.getElementById('badgeArtefacts');
  var badgeCanon = document.getElementById('badgeCanon');
  var badgeTreasury = document.getElementById('badgeTreasury');
  
  if (badgeSignals) {
    badgeSignals.textContent = countSignals;
    badgeSignals.classList.toggle('has-items', countSignals > 0);
    badgeSignals.classList.toggle('active', presenceFilter === 'signals');
  }
  if (badgeArtefacts) {
    badgeArtefacts.textContent = countArtefacts;
    badgeArtefacts.classList.toggle('has-items', countArtefacts > 0);
    badgeArtefacts.classList.toggle('active', presenceFilter === 'artefacts');
  }
  if (badgeCanon) {
    badgeCanon.textContent = '0';
    badgeCanon.classList.remove('has-items');
    badgeCanon.classList.remove('active');
    badgeCanon.style.display = 'none';
  }
  if (badgeTreasury) {
    // Treasury badge toont claimable count, niet activity count
    var claimableCount = claimableEpochsData ? claimableEpochsData.length : 0;
    badgeTreasury.textContent = claimableCount;
    badgeTreasury.classList.toggle('has-items', claimableCount > 0);
    badgeTreasury.classList.toggle('active', presenceFilter === 'treasury');
  }
  
 // Filter unseen items — only RECEIVED unread
  var filtered = ActivityFeed.activities.filter(function(a) {
    if (a.badgeOnly) return false;
    if (a.direction !== 'received') return false;
    var isTreasury = a.type === 'treasury_claimable';
    if (!isTreasury && ActivityFeed.readItems.has(a.id)) return false;
    
    if (presenceFilter === 'all') return true;
    
   if (presenceFilter === 'signals') {
      return a.type === 'reply_received' || a.type === 'attest_received';
    }
    if (presenceFilter === 'artefacts') return a.type.includes('artefact');
    if (presenceFilter === 'canon') return false;
    if (presenceFilter === 'treasury') return a.type.includes('treasury');
    
    return true;
  });
  
  // Empty state
  if (filtered.length === 0) {
    container.innerHTML = '<div class="activity-empty"><div class="activity-empty-icon">✓</div><div class="activity-empty-text">All caught up</div></div>';
    return;
  }
  
  // Render items
  container.innerHTML = filtered.map(function(a) { 
    return renderActivityItem(a); 
  }).join('');
}

window.filterPresence = function(category) {
  if (presenceFilter === category) {
    presenceFilter = 'all';
  } else {
    presenceFilter = category;
  }
  renderActivityFeed();
};

// ─────────────────────────────────────────────────────────────────
// CSV DOWNLOAD ACTIVITY
// ─────────────────────────────────────────────────────────────────

window.downloadActivityCSV = function() {
  var activities = ActivityFeed.activities;
  
  if (activities.length === 0) {
    showToast('No activity to export', 2000);
    return;
  }
  
  var rows = [['Type', 'Direction', 'From/To Key', 'Content', 'Epoch', 'Timestamp', 'Read']];
  
  activities.forEach(function(a) {
    var keyId = a.fromKeyId || a.targetKeyId || '';
    var content = a.content || '';
    if (content.length > 100) content = content.slice(0, 100) + '...';
    var isRead = ActivityFeed.readItems.has(a.id) ? 'Yes' : 'No';
    
    rows.push([
      a.type || '',
      a.direction || '',
      keyId ? 'K#' + keyId : '',
      content,
      a.epoch || '',
      a.timestamp || '',
      isRead
    ]);
  });
  
  downloadCSV(rows, 'z1n_activity_' + currentKeyId + '_' + new Date().toISOString().slice(0,10) + '.csv');
  showToast('Activity CSV downloaded', 2000);
};

// ─────────────────────────────────────────────────────────────────
// RENDER SINGLE ACTIVITY ITEM
// ─────────────────────────────────────────────────────────────────

function renderActivityItem(activity) {
  var isUnread = activity.direction === 'received' && !ActivityFeed.readItems.has(activity.id);
  var icon = ActivityFeed.icons[activity.type] || '•';
  
  // Determine icon class - allemaal geel voor signals/attests/whispers
  var iconClass = 'signal'; // default geel
  if (activity.type === 'canon_mint') {
    iconClass = 'canon';
  } else if (activity.type === 'treasury_claimable') {
    iconClass = 'treasury';
  } else if (activity.type && activity.type.includes('artefact')) {
    iconClass = 'artefact';
  }
  // Signals, attests, whispers blijven allemaal 'signal' class (geel)
  
  // Build title and preview based on activity type
  var title = '';
  var preview = '';
  var intentSymbols = ['ΩC', 'ΩI', 'ΩK', 'ΩS'];
  var intentClasses = ['oc', 'oi', 'ok', 'os'];
  
  switch (activity.type) {
    case 'signal':
      var intentTag = '<span class="intent-tag ' + (intentClasses[activity.intent] || 'oc') + '">' + (intentSymbols[activity.intent] || 'Ω') + '</span>';
      title = intentTag + ' Sent Signal';
      preview = truncateActivityContent(activity.content);
      break;
      
    case 'reply_sent':
      var intentTag = '<span class="intent-tag ' + (intentClasses[activity.intent] || 'oc') + '">' + (intentSymbols[activity.intent] || 'Ω') + '</span>';
      title = intentTag + ' Sent Reply';
      preview = truncateActivityContent(activity.content);
      break;
      
    case 'attest_sent':
      title = 'Attested <span class="key-link">K#' + (activity.targetKeyId || '?') + '</span>';
      preview = truncateActivityContent(activity.content);
      break;
      
    case 'attest_received':
      title = '<span class="key-link">K#' + (activity.fromKeyId || '?') + '</span> attested your signal';
      preview = truncateActivityContent(activity.content);
      break;
      
    case 'whisper_sent':
      title = 'Whispered to <span class="key-link">K#' + (activity.targetKeyId || '?') + '</span>';
      preview = truncateActivityContent(activity.content);
      break;
      
    case 'whisper_received':
      title = 'Whisper from <span class="key-link">K#' + (activity.fromKeyId || '?') + '</span>';
      preview = truncateActivityContent(activity.content);
      break;

    case 'direct_received':
      var isEncryptedDm = activity.content === '[Encrypted]';
      title = '<span class="key-link">K#' + (activity.fromKeyId || '?') + '</span> sent you ' + (isEncryptedDm ? 'an encrypted message' : 'an on-chain message');
      preview = isEncryptedDm ? '' : truncateActivityContent(activity.content);
      break;
      
   case 'canon_mint':
      title = 'Anchored <strong>E' + (activity.epoch || '?') + '</strong>';
      preview = activity.canonId ? 'Canon #' + activity.canonId : '';
      break;

   case 'artefact_received':
      iconClass = 'artefact';
      icon = '◈';
      var fromKeyLabel = activity.fromKeyId ? '<span class="key-link">K#' + activity.fromKeyId + '</span> ' : '';
      title = fromKeyLabel + (activity.content ? 'offered artefact <em style="color:var(--accent);">"' + activity.content + '"</em>' : 'shared an artefact with you');
      preview = activity.tokenId ? 'Artefact #' + activity.tokenId : '';
      activity.epoch = undefined;
      break;

    case 'reply_received':
      icon = '↩';
      var intentTag = '<span class="intent-tag ' + (intentClasses[activity.intent] || 'oc') + '">' + (intentSymbols[activity.intent] || 'Ω') + '</span>';
      title = '<span class="key-link">K#' + (activity.fromKeyId || '?') + '</span> replied ' + intentTag;
      preview = truncateActivityContent(activity.content);
      break;

    case 'treasury_claimable':
      iconClass = 'treasury';
      icon = '⬡';
      title = 'Claimable event · <strong>Epoch ' + (activity.epoch || '?') + '</strong>';
      preview = activity.amount ? activity.amount + ' POL' : '';
      break;
      
    default:
      title = activity.type;
      preview = truncateActivityContent(activity.content);
  }
  
  // Build epoch badge voor title
  var epochBadge = '';
  if (activity.epoch !== undefined) {
    epochBadge = ' <span style="font-size:10px;color:var(--text-soft);font-weight:400;">· E' + activity.epoch + '</span>';
  }
  if (activity.attestCount > 0) {
    epochBadge += ' <span style="font-size:10px;color:#fbbf24;">✓' + activity.attestCount + '</span>';
  }
  
  // Build HTML
  var unreadClass = isUnread ? ' unread' : '';
  var html = '<div class="activity-item' + unreadClass + '" data-id="' + activity.id + '" onclick="handleActivityClick(\'' + activity.id + '\', \'' + activity.type + '\')">' +
    '<div class="activity-icon ' + iconClass + '">' + icon + '</div>' +
    '<div class="activity-content">' +
      '<div class="activity-title">' + title + epochBadge + '</div>' +
      (preview ? '<div class="activity-preview">' + preview + '</div>' : '') +
    '</div>' +
  '</div>';
  
  return html;
}

// ─────────────────────────────────────────────────────────────────
// FILTER & SORT ACTIVITY FEED
// ─────────────────────────────────────────────────────────────────

window.filterActivityFeed = function() {
  renderActivityFeed();
};

// ─────────────────────────────────────────────────────────────────
// CLICK HANDLER - Mark as read & navigate
// ─────────────────────────────────────────────────────────────────

window.handleActivityClick = function(id, type) {
  // Treasury items should NOT be marked as read or removed — they stay until claimed
  var isTreasury = type === 'treasury_claimable';
  
  if (!isTreasury) {
    ActivityFeed.readItems.add(id);
    saveActivityReadItems();
  }
  
  var item = document.querySelector('.activity-item[data-id="' + id + '"]');
  if (item && !isTreasury) {
    item.classList.remove('unread');
    item.style.transition = 'opacity 0.3s, max-height 0.3s';
    item.style.opacity = '0';
    item.style.maxHeight = '0';
    item.style.overflow = 'hidden';
    item.style.padding = '0 12px';
    item.style.margin = '0';
    setTimeout(function() {
      item.remove();
      var feed = document.getElementById('activityFeed');
      if (feed && feed.querySelectorAll('.activity-item').length === 0) {
        feed.innerHTML = '<div class="activity-empty"><div class="activity-empty-icon">✓</div><div class="activity-empty-text">All caught up</div></div>';
      }
    }, 300);
  }
  
  updateTabBadges();
  
  // Inline badge update zonder full re-render
  var countSignals = 0, countArtefacts = 0, countTreasury = 0;
  ActivityFeed.activities.forEach(function(a) {
    if (a.direction !== 'received' || ActivityFeed.readItems.has(a.id)) return;
    if (ActivityFeed.readItems.has(a.id)) return;
    if (a.type.includes('signal') || a.type.includes('attest') || a.type.includes('whisper') || a.type.includes('reply')) countSignals++;
    else if (a.type.includes('artefact')) countArtefacts++;
    else if (a.type.includes('treasury')) countTreasury++;
  });
  var bs = document.getElementById('badgeSignals');
  var ba = document.getElementById('badgeArtefacts');
  var bt = document.getElementById('badgeTreasury');
  if (bs) { bs.textContent = countSignals; bs.classList.toggle('has-items', countSignals > 0); }
  if (ba) { ba.textContent = countArtefacts; ba.classList.toggle('has-items', countArtefacts > 0); }
  if (bt) { var cc = claimableEpochsData ? claimableEpochsData.length : 0; bt.textContent = cc; bt.classList.toggle('has-items', cc > 0); }
  
  switch (type) {
    case 'signal':
    case 'reply_sent':
      switchTab('signals');
      break;
    case 'attest_sent':
    case 'attest_received':
      switchTab('attests');
      break;
    case 'direct_sent':
    case 'direct_received':
      switchTab('direct');
      break;
    case 'canon_mint':
      switchTab('canon');
      break;
   case 'artefact_received':
      switchTab('artefacts');
      break;
    case 'reply_received':
      switchTab('signals');
      break;
    case 'treasury_claimable':
      switchTab('treasury');
      break;
  }
};

// ─────────────────────────────────────────────────────────────────
// MARK SINGLE TAB ITEM AS READ (from Signals/Attests/Whispers tabs)
// ─────────────────────────────────────────────────────────────────

window.markTabItemRead = function(activityId, element) {
  console.log('markTabItemRead called:', activityId);
  if (!activityId || ActivityFeed.readItems.has(activityId)) return;
  
  ActivityFeed.readItems.add(activityId);
  
  saveActivityReadItems();
  
  // Remove glow from this element
  if (element) {
    element.classList.remove('unread-glow');
  }
  
  // Update tab-nav badges
  updateTabBadges();
  
  // Update overview badges if visible
  var countSignals = 0, countArtefacts = 0, countTreasury = 0;
  ActivityFeed.activities.forEach(function(a) {
    if (a.direction !== 'received' || ActivityFeed.readItems.has(a.id)) return;
    if (a.type === 'reply_received' || a.type === 'attest_received') countSignals++;
    else if (a.type.includes('artefact')) countArtefacts++;
    else if (a.type.includes('treasury')) countTreasury++;
  });
  var bs = document.getElementById('badgeSignals');
  var ba = document.getElementById('badgeArtefacts');
  if (bs) { bs.textContent = countSignals; bs.classList.toggle('has-items', countSignals > 0); }
  if (ba) { ba.textContent = countArtefacts; ba.classList.toggle('has-items', countArtefacts > 0); }
};


// ─────────────────────────────────────────────────────────────────
// SAVE READ ITEMS TO LOCALSTORAGE
// ─────────────────────────────────────────────────────────────────

function saveActivityReadItems() {
  if (currentKeyId === null) return;
  try {
    localStorage.setItem('z1n_activity_read_' + currentKeyId, JSON.stringify([...ActivityFeed.readItems]));
  } catch (e) {}
}

// ─────────────────────────────────────────────────────────────────
// MARK ALL AS READ
// ─────────────────────────────────────────────────────────────────

window.markAllActivitiesRead = function() {
  ActivityFeed.activities.forEach(function(a) { 
    ActivityFeed.readItems.add(a.id); 
  });
  saveActivityReadItems();
  renderActivityFeed();
  updateTabBadges();
  showToast('All marked as read', 2000);
};

// ─────────────────────────────────────────────────────────────────
// REFRESH BUTTON (handmatig)
// ─────────────────────────────────────────────────────────────────

window.refreshActivityFeed = function() {
  ActivityFeed.loaded = false; // Force reload
  loadActivityFeed();
  showToast('Refreshing...', 1500);
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function truncateActivityContent(content) {
  if (!content) return '';
  var display = content.replace(/^ipfs:\/\//, '');
  return display.length > 45 ? display.substring(0, 42) + '...' : display;
}

function getActivityTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  // If it's a block number, estimate time (2 sec per block on Polygon)
  var currentBlock = 33050000; // Approximate current block
  var blocksAgo = currentBlock - timestamp;
  var secondsAgo = Math.max(0, blocksAgo * 2);
  
  if (secondsAgo < 60) return 'now';
  if (secondsAgo < 3600) return Math.floor(secondsAgo / 60) + 'm';
  if (secondsAgo < 86400) return Math.floor(secondsAgo / 3600) + 'h';
  if (secondsAgo < 604800) return Math.floor(secondsAgo / 86400) + 'd';
  return Math.floor(secondsAgo / 604800) + 'w';
}

// ─────────────────────────────────────────────────────────────────
// BADGE LOGIC - Unread state
// ─────────────────────────────────────────────────────────────────

var UnreadState = {
  
  lastSeenAttests: 0,
  lastSeenReplies: 0,
  lastSeenArtefacts: 0
};

function loadUnreadState() {
  if (currentKeyId === null) return;
  try {
    var stored = localStorage.getItem('z1n_unread_state_' + currentKeyId);
    if (stored) {
      var parsed = JSON.parse(stored);
      UnreadState = Object.assign(UnreadState, parsed);
    }
  } catch (e) {}
}

function saveUnreadState() {
  if (currentKeyId === null) return;
  try {
    localStorage.setItem('z1n_unread_state_' + currentKeyId, JSON.stringify(UnreadState));
  } catch (e) {}
}

function updateTabBadges() {
  var unreadWhispers = ActivityFeed.activities.filter(function(a) {
    return (a.type === 'whisper_received' || a.type === 'direct_received') && !ActivityFeed.readItems.has(a.id);
  }).length;
  var overviewDmEl = document.getElementById('overview-unseen-dm');
  if (overviewDmEl) overviewDmEl.textContent = unreadWhispers > 0 ? unreadWhispers : '';
  
  var unreadAttests = ActivityFeed.activities.filter(function(a) {
    return a.type === 'attest_received' && !ActivityFeed.readItems.has(a.id);
  }).length;
  
  var unreadReplies = ActivityFeed.activities.filter(function(a) {
    return a.type === 'reply_received' && !ActivityFeed.readItems.has(a.id);
  }).length;
  
   var unreadArtefacts = ActivityFeed.activities.filter(function(a) {
    return a.type.indexOf('artefact') !== -1 && a.direction === 'received' && !ActivityFeed.readItems.has(a.id);
  }).length;

  // Whispers badge (inside tab content)
  var directBadge = document.getElementById('directBadge');
  if (directBadge) {
    directBadge.textContent = unreadWhispers;
    directBadge.classList.toggle('hidden', unreadWhispers === 0);
  }

  var artefactBadgeCount = unreadArtefacts;
  if (window.Z1NArtefacts && window.Z1NArtefacts.getUnseenCount) {
    artefactBadgeCount += window.Z1NArtefacts.getUnseenCount();
  }
  var artefactBadge = document.getElementById('artefactBadge');
  if (artefactBadge) {
    if (artefactBadgeCount > 0) {
      artefactBadge.textContent = artefactBadgeCount;
      artefactBadge.className = 'tab-badge badge-artefacts';
      artefactBadge.style.cssText = 'background:rgba(94,232,160,0.4);color:#5ee8a0;font-weight:700;display:inline-flex;';
    } else {
      artefactBadge.textContent = '';
      artefactBadge.style.cssText = 'display:none;';
    }
  }
  // Also update tab-nav button badge
  var artefactsTab = document.querySelector('.tab-btn[onclick*="artefacts"]');
  if (artefactsTab) {
    var existingBadge = artefactsTab.querySelector('.tab-badge');
    if (artefactBadgeCount > 0) {
      if (!existingBadge) {
        var newBadge = document.createElement('span');
        newBadge.className = 'tab-badge';
        newBadge.style.cssText = 'background:rgba(94,232,160,0.4);color:#5ee8a0;font-weight:700;';
        newBadge.textContent = artefactBadgeCount;
        artefactsTab.appendChild(newBadge);
      } else {
        existingBadge.textContent = artefactBadgeCount;
        existingBadge.style.cssText = 'background:rgba(94,232,160,0.4);color:#5ee8a0;font-weight:700;';
        existingBadge.classList.remove('hidden');
      }
    } else if (existingBadge) {
      existingBadge.classList.add('hidden');
    }
  }
  // #artefactBadge IS the tab-nav button badge (already in HTML) — no duplicate needed

  // Canon badge — always hidden
  var canonBadge = document.getElementById('canonBadge');
  if (canonBadge) canonBadge.classList.add('hidden');

  // Treasury — use claimableEpochsData directly, NOT activity read state
  var claimableCount = claimableEpochsData ? claimableEpochsData.length : 0;

  // Treasury badge (inside tab content)
  var treasuryBadge = document.getElementById('treasuryBadge');
  if (treasuryBadge) {
    treasuryBadge.textContent = claimableCount;
    treasuryBadge.classList.toggle('hidden', claimableCount === 0);
    treasuryBadge.classList.toggle('has-claimable', claimableCount > 0);
  }

  // Treasury tab-nav badge — always show when claimable rewards exist
  var treasuryTab = document.querySelector('.tab-btn[onclick*="treasury"]');
  if (treasuryTab) {
    var existingBadge = treasuryTab.querySelector('.tab-badge');
    if (claimableCount > 0) {
      if (!existingBadge) {
        var badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = claimableCount;
        treasuryTab.appendChild(badge);
      } else {
        existingBadge.textContent = claimableCount;
        existingBadge.classList.remove('hidden');
      }
    } else if (existingBadge) {
      existingBadge.classList.add('hidden');
    }
  }

  // Signals tab-nav badge (unread replies)
  var signalsTab = document.querySelector('.tab-btn[onclick*="signals"]');
  if (signalsTab) {
    var existingBadge = signalsTab.querySelector('.tab-badge');
    if (unreadReplies > 0) {
      if (!existingBadge) {
        var badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = unreadReplies;
        signalsTab.appendChild(badge);
      } else {
        existingBadge.textContent = unreadReplies;
        existingBadge.classList.remove('hidden');
      }
    } else if (existingBadge) {
      existingBadge.classList.add('hidden');
    }
  }

  // Attests tab-nav badge
  var attestsTab = document.querySelector('.tab-btn[onclick*="attests"]');
  if (attestsTab) {
    var existingBadge = attestsTab.querySelector('.tab-badge');
    if (unreadAttests > 0) {
      if (!existingBadge) {
        var badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = unreadAttests;
        attestsTab.appendChild(badge);
      } else {
        existingBadge.textContent = unreadAttests;
        existingBadge.classList.remove('hidden');
      }
    } else if (existingBadge) {
      existingBadge.classList.add('hidden');
    }
  }

  // Whispers tab-nav badge
  var whispersTab = document.querySelector('.tab-btn[onclick*="direct"]');
  if (whispersTab) {
    var existingBadge = whispersTab.querySelector('.tab-badge');
    if (unreadWhispers > 0) {
      if (!existingBadge) {
        var badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = unreadWhispers;
        whispersTab.appendChild(badge);
      } else {
        existingBadge.textContent = unreadWhispers;
        existingBadge.classList.remove('hidden');
      }
    } else if (existingBadge) {
      existingBadge.classList.add('hidden');
    }
  }
}

function initUnreadState() {
  loadUnreadState();
  updateTabBadges();
}

// ═══════════════════════════════════════════════════════════════
// TREASURY DATA & CLAIMS
// ═══════════════════════════════════════════════════════════════

// Contract: Parameters.CLAIM_WINDOW_EPOCHS = 21
// Check in Z1NTreasury.sol: if (epochId + CLAIM_WINDOW_EPOCHS < activeEpoch) → ClaimExpired
var CLAIM_WINDOW_EPOCHS = 21;

var claimableEpochsData = [];
var claimedEpochsData = [];
var isClaimingAll = false;
var claimableSortAsc = false;
var claimedSortAsc = false;
var totalClaimable = 0; // ← module-level zodat loadClaimedEpochs er bij kan

async function loadTreasuryData() {
  var claimableEl = document.getElementById('treasuryClaimable');
  var claimableCountEl = document.getElementById('treasuryClaimableCount');
  var claimedCountEl = document.getElementById('treasuryClaimedCount');
  var claimableList = document.getElementById('claimableEpochsList');
  var claimedList = document.getElementById('claimedEpochsList');
  var claimAllSection = document.getElementById('claimAllSection');
  var claimableBox = document.getElementById('treasuryClaimableBox');

  if (!claimableList || currentKeyId === null) return;

  claimableList.innerHTML = '<div class="treasury-loading">Loading claimable rewards...</div>';

  try {
    var response = await fetch(API_BASE + '/key/' + currentKeyId + '/claimable', {cache: 'no-store'});

    if (!response.ok) {
      var errorText = await response.text();
      console.error('Treasury API error:', response.status, errorText);
      throw new Error('API returned ' + response.status);
    }

    var data = await response.json();
    claimableEpochsData = data.epochs || [];

    // Calculate deadline: claimable while activeEpoch <= epochId + 21
    claimableEpochsData.forEach(function(epoch) {
      epoch.deadlineEpoch = epoch.epochId + CLAIM_WINDOW_EPOCHS;
      epoch.epochsRemaining = epoch.deadlineEpoch - activeEpoch + 1;
      if (epoch.epochsRemaining < 0) epoch.epochsRemaining = 0;
    });

    totalClaimable = parseFloat(data.totalClaimableFormatted || '0');
    if (claimableEl) claimableEl.textContent = totalClaimable > 0 ? totalClaimable.toFixed(2) : '—';
    if (claimableCountEl) claimableCountEl.textContent = '(' + claimableEpochsData.length + ')';

    if (claimableBox) claimableBox.classList.toggle('has-claimable', totalClaimable > 0);
    if (claimAllSection) claimAllSection.style.display = claimableEpochsData.length > 1 ? 'block' : 'none';

    var badge = document.getElementById('treasuryBadge');
    if (badge) {
      badge.textContent = claimableEpochsData.length;
      badge.style.display = claimableEpochsData.length > 0 ? 'inline-flex' : 'none';
      badge.classList.toggle('has-claimable', claimableEpochsData.length > 0);
    }

    renderClaimableEpochs();
    await loadClaimedEpochs();
    updateTabBadges();
    if (ActivityFeed.loaded) { loadActivityFeed(); }

  } catch (e) {
    console.error('Treasury load error:', e);
    claimableList.innerHTML = '<div class="treasury-empty-small" style="color:#f87171;">Error: ' + e.message + '</div>';
  }
}

async function loadClaimedEpochs() {
  var stored = localStorage.getItem('z1n_claimed_epochs_' + currentKeyId);
  if (stored) {
    try { claimedEpochsData = JSON.parse(stored); } catch (e) { claimedEpochsData = []; }
  } else {
    claimedEpochsData = [];
  }

  // Cross-check: if an epoch appears in claimable, remove it from claimed (wasn't actually claimed)
  var claimableIds = claimableEpochsData.map(function(e) { return e.epochId; });
  var beforeCount = claimedEpochsData.length;
  claimedEpochsData = claimedEpochsData.filter(function(e) { return !claimableIds.includes(e.epochId); });
  if (claimedEpochsData.length !== beforeCount) {
    try { localStorage.setItem('z1n_claimed_epochs_' + currentKeyId, JSON.stringify(claimedEpochsData)); } catch (e) {}
    console.log('Treasury: removed ' + (beforeCount - claimedEpochsData.length) + ' false claims from history');
  }

  var claimedCountEl = document.getElementById('treasuryClaimedCount');
  if (claimedCountEl) claimedCountEl.textContent = '(' + claimedEpochsData.length + ')';

  var totalEl = document.getElementById('treasuryTotal');
  if (totalEl) {
    var totalEarned = claimedEpochsData.reduce(function(sum, e) { return sum + parseFloat(e.amount || '0'); }, 0);
    totalEl.textContent = totalEarned > 0 ? totalEarned.toFixed(2) : '—';
  }

  renderClaimedEpochs();
}

function renderClaimableEpochs() {
  var listEl = document.getElementById('claimableEpochsList');
  if (!listEl) return;

  if (claimableEpochsData.length === 0) {
    listEl.innerHTML = '<div class="treasury-empty"><div class="treasury-empty-icon">⬡</div><div class="treasury-empty-text">No claimable rewards</div><div class="treasury-empty-sub">Participate in epochs to earn rewards</div></div>';
    return;
  }

  var sorted = claimableEpochsData.slice().sort(function(a, b) {
    return claimableSortAsc ? a.epochId - b.epochId : b.epochId - a.epochId;
  });

  var html = '';
  sorted.forEach(function(epoch) {
    var amount = parseFloat(epoch.amountFormatted || '0').toFixed(2);
    var presence = epoch.presenceReward ? (parseFloat(epoch.presenceReward) / 1e18).toFixed(4) : '—';
    var attention = epoch.attentionReward ? (parseFloat(epoch.attentionReward) / 1e18).toFixed(4) : '—';
    var status = epoch._status || '';
    var statusClass = epoch._statusClass || '';
    var epochsRemaining = epoch.epochsRemaining;

    var deadlineClass = '';
    var deadlineText = '';
    if (epochsRemaining <= 0) { deadlineClass = 'danger'; deadlineText = '⚠️ Expires soon!'; }
    else if (epochsRemaining <= 3) { deadlineClass = 'danger'; deadlineText = epochsRemaining + ' Epoch' + (epochsRemaining === 1 ? '' : 's') + ' left to claim!'; }
    else if (epochsRemaining <= 7) { deadlineClass = 'warning'; deadlineText = epochsRemaining + ' Epochs left to claim'; }
    else { deadlineText = epochsRemaining + ' Epochs left to claim'; }

    var itemClass = 'treasury-epoch-item';
    if (epochsRemaining <= 3 && epochsRemaining > 0) itemClass += ' urgent';
    if (status) itemClass += ' claiming';

    html += '<div class="' + itemClass + '" id="epoch-item-' + epoch.epochId + '">';
    html += '<div class="epoch-item-header"><span class="epoch-item-id">Epoch ' + epoch.epochId + (status ? ' <span class="epoch-status ' + statusClass + '">' + status + '</span>' : '') + '</span><span class="epoch-item-amount">' + amount + ' POL</span></div>';
    html += '<div class="epoch-item-breakdown"><span class="breakdown-item">Presence: ' + presence + '<span class="info-icon" style="position:relative;">ⓘ<span class="breakdown-tooltip" style="left:0;right:auto;transform:none;">Base share: Equal for all 21 winners</span></span></span><span class="breakdown-item">Attention: ' + attention + '<span class="info-icon">ⓘ</span><span class="breakdown-tooltip">Weighted: attestations × layer multiplier</span></span><span class="epoch-deadline ' + deadlineClass + '">⏱ ' + deadlineText + '</span></div>';
    html += '<div class="epoch-item-actions"><button class="btn-epoch claim" onclick="claimSingleReward(' + epoch.epochId + ',\'self\')" ' + (status ? 'disabled' : '') + '>Claim Self</button><button class="btn-epoch recycle" onclick="claimSingleReward(' + epoch.epochId + ',\'recycle\')" ' + (status ? 'disabled' : '') + ' title="Recycle to next epoch">Field</button><button class="btn-epoch nexus" onclick="claimSingleReward(' + epoch.epochId + ',\'nexus\')" ' + (status ? 'disabled' : '') + ' title="Donate to Nexus">Nexus</button></div>';
    html += '</div>';
  });

  listEl.innerHTML = html;
}

function renderClaimedEpochs() {
  var listEl = document.getElementById('claimedEpochsList');
  if (!listEl) return;

  var dataToRender = claimedEpochsData;
  if (claimedFilterType) {
    dataToRender = claimedEpochsData.filter(function(e) { return e.claimType === claimedFilterType; });
  }

  if (dataToRender.length === 0) {
    listEl.innerHTML = '<div class="treasury-empty-small">No claimed rewards yet</div>';
    return;
  }

  var sorted = dataToRender.slice().sort(function(a, b) {
    return claimedSortAsc ? a.epochId - b.epochId : b.epochId - a.epochId;
  });

  var html = '';
  sorted.forEach(function(epoch) {
    var amount = parseFloat(epoch.amount || '0').toFixed(2);
    var date = epoch.claimedAt ? new Date(epoch.claimedAt).toLocaleDateString() : '—';
    var claimType = epoch.claimType || 'self';
    var typeLabel = 'Self';
    if (claimType === 'recycle') { typeLabel = 'Field'; }
    else if (claimType === 'nexus') { typeLabel = 'Nexus'; }

    html += '<div class="treasury-epoch-item claimed"><div class="epoch-item-header"><span class="epoch-item-id">E' + epoch.epochId + '</span><span class="epoch-item-amount">' + amount + ' POL</span></div><div class="claimed-info"><span class="claimed-date">Won: E' + epoch.epochId + ' · Claimed: E' + (epoch.claimedEpoch || '—') + '</span><span class="claimed-type">' + typeLabel + '</span></div></div>';
  });

  listEl.innerHTML = html;
}

function sortClaimableEpochs() {
  claimableSortAsc = !claimableSortAsc;
  var icon = document.getElementById('claimableSortIcon');
  if (icon) icon.textContent = claimableSortAsc ? '↑' : '↓';
  renderClaimableEpochs();
}

function sortClaimedEpochs() {
  claimedSortAsc = !claimedSortAsc;
  var icon = document.getElementById('claimedSortIcon');
  if (icon) icon.textContent = claimedSortAsc ? '↑' : '↓';
  renderClaimedEpochs();
}

function saveClaimedEpoch(epochId, amount, claimType) {
  claimedEpochsData.push({ epochId: epochId, amount: amount, claimType: claimType || 'self', claimedAt: new Date().toISOString(), claimedEpoch: activeEpoch });
  try { localStorage.setItem('z1n_claimed_epochs_' + currentKeyId, JSON.stringify(claimedEpochsData)); } catch (e) {}
  var claimedCountEl = document.getElementById('treasuryClaimedCount');
  if (claimedCountEl) claimedCountEl.textContent = '(' + claimedEpochsData.length + ')';
  var totalEl = document.getElementById('treasuryTotal');
  if (totalEl) {
    var totalEarned = claimedEpochsData.reduce(function(sum, e) { return sum + parseFloat(e.amount || '0'); }, 0);
    totalEl.textContent = totalEarned > 0 ? totalEarned.toFixed(2) : '—';
  }
  renderClaimedEpochs();
}

async function claimSingleReward(epochId, claimType) {
  if (!window.ethereum || !currentAccount) { showToast('Connect wallet first', 3000); return; }
  var epochData = claimableEpochsData.find(function(e) { return e.epochId === epochId; });
  if (!epochData) { showToast('Epoch not found', 3000); return; }
  var itemEl = document.getElementById('epoch-item-' + epochId);
  if (itemEl) itemEl.classList.add('claiming');
  try {
    var actionText = claimType === 'recycle' ? 'Recycling' : claimType === 'nexus' ? 'Donating' : 'Claiming';
    showToast(actionText + ' E' + epochId + '...', 2000);
    var response = await fetch(API_BASE + '/treasury/claim-data?epochId=' + epochId + '&wallet=' + currentAccount + '&claimType=' + claimType);
    var claimData = await response.json();
    if (claimData.error) throw new Error(claimData.error);
    updateEpochStatus(epochId, 'Confirm...', 'pending');
    var estimatedGas;
    try { estimatedGas = await provider.request({ method: 'eth_estimateGas', params: [{ from: currentAccount, to: claimData.to, data: claimData.data }] }); estimatedGas = '0x' + (Math.floor(parseInt(estimatedGas, 16) * 1.3)).toString(16); } catch (eg) { estimatedGas = '0x7A120'; }
    var txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: currentAccount, to: claimData.to, data: claimData.data}] });
    updateEpochStatus(epochId, 'Confirming...', 'pending');
    var confirmed = await waitForTransaction(txHash, 60);
    if (confirmed) {
      updateEpochStatus(epochId, '<a href="' + EXPLORER + '/tx/' + txHash + '" target="_blank" style="color:#93c5fd">✓ tx</a>', 'success');
      saveClaimedEpoch(epochId, epochData.amountFormatted, claimType);
      claimableEpochsData = claimableEpochsData.filter(function(e) { return e.epochId !== epochId; });
      var claimableCountEl = document.getElementById('treasuryClaimableCount');
      if (claimableCountEl) claimableCountEl.textContent = '(' + claimableEpochsData.length + ')';
      var claimableEl = document.getElementById('treasuryClaimable');
      if (claimableEl) { var total = claimableEpochsData.reduce(function(sum, e) { return sum + parseFloat(e.amountFormatted || '0'); }, 0); claimableEl.textContent = total > 0 ? total.toFixed(2) : '0'; }
      var claimableBox = document.getElementById('treasuryClaimableBox');
      if (claimableBox) claimableBox.classList.toggle('has-claimable', claimableEpochsData.length > 0);
      var actionDone = claimType === 'recycle' ? 'Recycled' : claimType === 'nexus' ? 'Donated' : 'Claimed';
      showToast('✅ ' + actionDone + ' E' + epochId + '!', 4000);
      setTimeout(renderClaimableEpochs, 500);
    } else { throw new Error('Transaction not confirmed'); }
  } catch (e) {
    console.error('Claim error:', e);
    var msg = e.message || 'Unknown error';
    if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Rejected';
    else if (msg.includes('Already claimed')) msg = 'Already claimed';
    else if (msg.includes('Expired')) msg = 'Expired';
    else if (msg.includes('insufficient')) msg = 'Insufficient funds';
    updateEpochStatus(epochId, '✗ ' + msg, 'error');
    if (itemEl) itemEl.classList.remove('claiming');
    showToast('Failed: ' + msg.slice(0, 50), 4000, true);
  }
}

async function claimAllRewards() {
  if (!window.ethereum || !currentAccount) { showToast('Connect wallet first', 3000); return; }
  if (claimableEpochsData.length === 0) { showToast('Nothing to claim', 2000); return; }
  if (isClaimingAll) { showToast('Already claiming...', 2000); return; }
  // Open modal to choose claim type
  document.getElementById('claimAllModal').classList.add('active');
}

function closeClaimAllModal() {
  document.getElementById('claimAllModal').classList.remove('active');
}

async function executeClaimAll(claimType) {
  closeClaimAllModal();
  isClaimingAll = true;
  var btn = document.getElementById('btnClaimAll');
  var progressSection = document.getElementById('claimAllProgress');
  var progressBar = document.getElementById('claimProgressBar');
  var progressText = document.getElementById('claimProgressText');
  if (btn) { btn.disabled = true; btn.classList.add('claiming'); btn.innerHTML = '<span class="btn-icon">⏳</span><span>Claiming...</span>'; }
  if (progressSection) progressSection.style.display = 'block';
  var total = claimableEpochsData.length, completed = 0, failed = 0;
  var epochsToProcess = claimableEpochsData.slice();
  for (var i = 0; i < epochsToProcess.length; i++) {
    var epoch = epochsToProcess[i];
    if (progressText) progressText.textContent = 'Claiming E' + epoch.epochId + ' (' + (i + 1) + '/' + total + ')...';
    if (progressBar) progressBar.style.width = ((i / total) * 100) + '%';
    try {
      var response = await fetch(API_BASE + '/treasury/claim-data?epochId=' + epoch.epochId + '&wallet=' + currentAccount + '&claimType=' + claimType);
      var claimData = await response.json();
      if (claimData.error) throw new Error(claimData.error);
      updateEpochStatus(epoch.epochId, 'Confirm...', 'pending');
      var estimatedGas;
    try { estimatedGas = await provider.request({ method: 'eth_estimateGas', params: [{ from: currentAccount, to: claimData.to, data: claimData.data }] }); estimatedGas = '0x' + (Math.floor(parseInt(estimatedGas, 16) * 1.1)).toString(16); } catch (eg) { estimatedGas = '0x30D40'; }
    var txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: currentAccount, to: claimData.to, data: claimData.data}] });
      updateEpochStatus(epoch.epochId, 'Confirming...', 'pending');
      var confirmed = await waitForTransaction(txHash, 60);
    if (confirmed) { updateEpochStatus(epoch.epochId, '<a href="' + EXPLORER + '/tx/' + txHash + '" target="_blank" style="color:#93c5fd">✓ tx</a>', 'success'); saveClaimedEpoch(epoch.epochId, epoch.amountFormatted, claimType); completed++; }
      else { throw new Error('Not confirmed'); }
    } catch (e) {
      var msg = e.message || 'Failed';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) { updateEpochStatus(epoch.epochId, '✗', 'error'); showToast('Claim cancelled', 3000); break; }
      updateEpochStatus(epoch.epochId, '✗', 'error'); failed++;
    }
  }
  if (progressBar) progressBar.style.width = '100%';
  if (progressText) progressText.textContent = 'Done! ' + completed + ' claimed' + (failed > 0 ? ', ' + failed + ' failed' : '');
  if (btn) { btn.disabled = false; btn.classList.remove('claiming'); btn.innerHTML = '<span class="btn-icon">⬡</span><span>Claim All Rewards</span>'; }
  isClaimingAll = false;
  setTimeout(loadTreasuryData, 2000);
  if (completed > 0) showToast('✅ Claimed ' + completed + ' epoch(s)!', 4000);
}

function updateEpochStatus(epochId, status, statusClass) {
  for (var i = 0; i < claimableEpochsData.length; i++) {
    if (claimableEpochsData[i].epochId === epochId) { claimableEpochsData[i]._status = status; claimableEpochsData[i]._statusClass = statusClass; break; }
  }
  renderClaimableEpochs();
}

async function waitForTransaction(txHash, maxSeconds) {
  var startTime = Date.now(), maxTime = maxSeconds * 1000;
  while (Date.now() - startTime < maxTime) {
    try { var receipt = await rpc('eth_getTransactionReceipt', [txHash]); if (receipt) return receipt.status === '0x1'; } catch (e) {}
    await new Promise(function(r) { setTimeout(r, 2000); });
  }
  return false;
}

function downloadClaimedCSV() {
  if (claimedEpochsData.length === 0) { showToast('No claimed rewards to export', 2000); return; }
  var rows = [['Epoch ID', 'Amount (POL)', 'Type', 'Date']];
  claimedEpochsData.forEach(function(epoch) {
    var typeLabel = epoch.claimType === 'recycle' ? 'Recycled' : epoch.claimType === 'nexus' ? 'Donated' : 'Claimed';
    rows.push([epoch.epochId, epoch.amount || '0', typeLabel, epoch.claimedAt || '']);
  });
  downloadCSV(rows, 'z1n_treasury_key' + currentKeyId + '_' + new Date().toISOString().slice(0, 10) + '.csv');
  showToast('CSV downloaded', 2000);
}

window.closeClaimAllModal = closeClaimAllModal;
window.executeClaimAll = executeClaimAll;
window.loadTreasuryData = loadTreasuryData;
window.claimSingleReward = claimSingleReward;
window.claimAllRewards = claimAllRewards;
window.sortClaimableEpochs = sortClaimableEpochs;
window.sortClaimedEpochs = sortClaimedEpochs;

var claimedFilterType = null;

function filterClaimedByType(type) {
  if (claimedFilterType === type) {
    claimedFilterType = null; // Toggle off
  } else {
    claimedFilterType = type;
  }
  
  // Update button states
  document.getElementById('filterSelf').classList.toggle('active', claimedFilterType === 'self');
  document.getElementById('filterField').classList.toggle('active', claimedFilterType === 'recycle');
  document.getElementById('filterNexus').classList.toggle('active', claimedFilterType === 'nexus');
  
  renderClaimedEpochs();
}

window.filterClaimedByType = filterClaimedByType;



window.downloadClaimedCSV = downloadClaimedCSV;

// Debug - expose to window
window.Z1N_DEBUG = {
  getActiveEpoch: function() { return activeEpoch; },
  getCurrentKeyId: function() { return currentKeyId; }
};

// Auto-connect on page load
document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('btnConnect');
  if (btn) btn.addEventListener('click', connect);
  if (getProvider()) {
    connect();
  }
});


})();
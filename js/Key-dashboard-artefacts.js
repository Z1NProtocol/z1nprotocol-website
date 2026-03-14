/**
 * Z1N Protocol - Key Dashboard Artefacts Module
 * Version: 2.3.1-Ω (UX patch)
 *
 * UX PATCH CHANGES:
 * - Badge fix: unseen count shows in Artefacts tab nav
 * - Offer modal: single preview (removed two-column layout)
 * - Offer modal: message field added
 * - Offer feed: shows offer message instead of epoch
 * - Receiver modal: shows inscription from artefact
 * - Accept → status "Bounded" (not "Received")
 * - Reject: no message (contract has none) — rejected status visible with red triangle
 * - Rejected status card persists in receiver section
 * - Release: message text input added (on-chain, max 64 chars)
 * - Release notification in UNSEEN feed
 * - State change notifications for all transitions
 * - Layout: bounded artefacts show artefact preview (not triangle)
 */
(function() {
  'use strict';

  // Inject spinner + skeleton CSS
  if (!document.getElementById('z1n-artefact-pending-css')) {
    var styleEl = document.createElement('style');
    styleEl.id = 'z1n-artefact-pending-css';
    styleEl.textContent = [
      '@keyframes spin { to { transform: rotate(360deg); } }',
      '@keyframes skeleton-pulse { 0%,100% { opacity:0.3; } 50% { opacity:0.6; } }',
      '',
      '.artefact-loading-skeleton {',
      '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
      '  padding: 40px 20px; min-height: 200px;',
      '}',
      '.artefact-loading-skeleton .skeleton-spinner {',
      '  width: 40px; height: 40px;',
      '  border: 3px solid rgba(94,232,160,0.15);',
      '  border-top-color: var(--accent, #5ee8a0);',
      '  border-radius: 50%;',
      '  animation: spin 1s linear infinite;',
      '  margin-bottom: 14px;',
      '}',
      '.artefact-loading-skeleton .skeleton-text {',
      '  color: var(--accent, #5ee8a0); font-size: 12px; opacity: 0.8;',
      '}',
      '.artefact-skeleton-grid {',
      '  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px;',
      '}',
      '.artefact-skeleton-card {',
      '  background: rgba(94,232,160,0.05);',
      '  border: 1px solid rgba(94,232,160,0.15);',
      '  border-radius: 10px; padding: 12px;',
      '  animation: skeleton-pulse 1.5s ease-in-out infinite;',
      '}',
      '.artefact-skeleton-card .skel-img {',
      '  width: 100%; aspect-ratio: 500/760; border-radius: 8px;',
      '  background: rgba(94,232,160,0.08); margin-bottom: 8px;',
      '}',
      '.artefact-skeleton-card .skel-line {',
      '  height: 10px; border-radius: 4px; background: rgba(94,232,160,0.1);',
      '  margin-bottom: 4px;',
      '}',
      '.artefact-skeleton-card .skel-line.short { width: 60%; }',
      '.artefact-card.pending-mint {',
      '  opacity: 0.7; pointer-events: none; position: relative;',
      '  border: 1px dashed rgba(94,232,160,0.4) !important;',
      '  background: rgba(94,232,160,0.04) !important;',
      '}',
      '.pending-mint-overlay {',
      '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
      '  gap: 10px; height: 100%; min-height: 160px;',
      '}',
      '.pending-mint-spinner {',
      '  width: 32px; height: 32px;',
      '  border: 3px solid rgba(94,232,160,0.2);',
      '  border-top-color: var(--accent, #5ee8a0);',
      '  border-radius: 50%;',
      '  animation: spin 1s linear infinite;',
      '}',
      '.pending-mint-label {',
      '  color: var(--accent, #5ee8a0); font-size: 11px; font-weight: 600;',
      '  text-transform: uppercase; letter-spacing: 0.05em;',
      '}',
      '.pending-mint-sub {',
      '  color: var(--text-soft, #9aa3bb); font-size: 10px;',
      '}',
      '.pending-change-overlay {',
      '  position: absolute; inset: 0; display: flex; flex-direction: column;',
      '  align-items: center; justify-content: center;',
      '  background: rgba(10,12,16,0.75); z-index: 2;',
      '  border-radius: 8px; gap: 8px;',
      '}',
      '.pending-change-spinner {',
      '  width: 28px; height: 28px;',
      '  border: 3px solid rgba(94,232,160,0.2);',
      '  border-top-color: var(--accent, #5ee8a0);',
      '  border-radius: 50%;',
      '  animation: spin 1s linear infinite;',
      '}',
      '.artefact-preview-loading {',
      '  display: flex; flex-direction: column; align-items: center;',
      '  justify-content: center; width: 100%; height: 100%; gap: 10px;',
      '}',
      '.artefact-preview-loading .preview-spinner {',
      '  width: 28px; height: 28px;',
      '  border: 2px solid rgba(94,232,160,0.15);',
      '  border-top-color: var(--accent, #5ee8a0);',
      '  border-radius: 50%;',
      '  animation: spin 1s linear infinite;',
      '}',
      '.artefact-preview-loading .preview-text {',
      '  color: var(--accent, #5ee8a0); font-size: 10px;',
      '}',
      '.artefact-card.status-viewedby,',
      '.artefact-card.status-viewedby:hover,',
      '.artefact-list-card.status-viewedby {',
      '  border-color: var(--card-border, rgba(148,163,184,0.25)) !important;',
      '}',
      '.artefact-card.status-received,',
      '.artefact-card.status-received:hover {',
      '  border-color: var(--card-border, rgba(148,163,184,0.25)) !important;',
      '}',
      '.artefact-card.status-bounded,',
      '.artefact-card.status-bounded:hover {',
      '  border-color: rgba(94,232,160,0.35) !important;',
      '}',
      '.artefact-card.unseen-artefact {',
      '  border-color: rgba(94,232,160,0.7) !important;',
      '  box-shadow: 0 0 8px rgba(94,232,160,0.3);',
      '}',
      '.artefact-card.unseen-artefact::after {',
      '  content: "NEW"; position: absolute; top: 6px; right: 6px;',
      '  font-size: 8px; font-weight: 700; letter-spacing: 0.05em;',
      '  color: #000; background: var(--keys-accent, #ffd556);',
      '  padding: 2px 6px; border-radius: 4px;',
      '}',
      '.artefact-card.status-released.unseen-artefact::after {',
      '  background: #f87171; color: #fff;',
      '}',
      '.artefact-card.status-pending,',
      '.artefact-card.status-pending:hover {',
      '  border-color: rgba(255,213,86,0.4) !important;',
      '}',
      '.info-status.status-pending { color: #ffd556; }',
      '.artefact-card.status-rejected,',
      '.artefact-card.status-rejected:hover {',
      '  border-color: rgba(248,113,113,0.6) !important;',
      '  opacity: 0.8;',
      '}',
      '.info-status.status-rejected { color: #f87171; }',
      '.artefact-card.status-released {',
      '  opacity: 0.55; border-color: rgba(248,113,113,0.3) !important;',
      '}',
      '.info-status.status-released { color: #f87171; }',
      '.info-status.status-bounded { color: var(--accent, #5ee8a0); }'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  // =====================================================================
  // CONSTANTS
  // =====================================================================
  
  var Z1N_ARTEFACT = '0x8f9C9760D530aA58A9cf13406888958c6856f326';
  var Z1N_KEY = '0x51A708cC79591cdE831B64773150cFaA41be3059';
  
  var RPC_URLS = ['https://polygon-mainnet.g.alchemy.com/v2/P7YcT2oy0Mfad2Pedbe3y'];
  var currentRpcIndex = 0;
  
  var SELECTORS = {
    sourceKeyOf: '0x4e3ee7a9',
    boundToKeyId: '0x8e7c8e36',
    stateOf: '0xfc4e86b7',
    canView: '0x79d62d11',
    getLibrary: '0x9f8a13d7',
    ownerOf: '0x6352211e',
    exists: '0x4f558e79',
    glyphs: '0x887296c3',
    inscriptionOf: '0x5a8b1a9f'
  };
  
  var GLYPHS = ['∞','π','⋮','⊕','⊗','∴','∵','↔','↻','△','◇','○','●','□','☰','☷','⚑','✱','⊥','≡','◊'];

  // =====================================================================
  // STATE
  // =====================================================================
  
  var ownedArtefacts = [];
  var sharedWithMe = [];
  var ownedFilter = { status: 'all', search: '' };
  var libraryFilter = { status: 'all', search: '' };
  var keyGlyphsCache = {};
  var inscriptionCache = {};
  var ownedViewMode = 'card';
  var libraryViewMode = 'card';
  var pendingArtefacts = [];
  var initiatorNotifications = {};
  var pendingViewChanges = {};
  var lastOwnedSig = '';
  var lastSharedSig = '';
  var isLoadingOwned = true;
  var isLoadingShared = true;
  var isMinting = false;

  // =====================================================================
  // IMAGE LOADER
  // =====================================================================
  
  function artImg(url, alt) {
    var id = 'aimg_' + Math.random().toString(36).slice(2,8);
    setTimeout(function() {
      var img = document.getElementById(id);
      if (!img) return;
      var real = new Image();
      real.onload = function() {
        img.style.backgroundImage = 'url(' + url + ')';
        img.style.backgroundSize = 'contain';
        img.style.backgroundPosition = 'center';
        img.style.backgroundRepeat = 'no-repeat';
        img.classList.add('loaded');
      };
      real.onerror = function() {
        img.classList.add('load-failed');
      };
      real.src = url;
    }, 50);
    return '<div class="art-img-loader" id="' + id + '" title="' + alt + '"><div class="art-img-spinner"></div></div>';
  }

  // =====================================================================
  // HELPERS
  // =====================================================================
  
  function getZ1N() {
    return window.Z1N || {};
  }
  
  function enc256(v) {
    return BigInt(v).toString(16).padStart(64, '0');
  }
  
  function shortAddr(a) {
    return a ? a.slice(0, 6) + '...' + a.slice(-4) : '—';
  }
  
  function showToast(msg, dur, isError) {
    var z = getZ1N();
    if (z.showToast) {
      z.showToast(msg, dur, isError);
    } else {
      var t = document.getElementById('toast');
      if (t) {
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(function() { t.classList.remove('show'); }, dur || 3000);
      }
    }
  }

  async function rpc(method, params) {
    var z = getZ1N();
    if (z.rpc) return z.rpc(method, params);
    
    var lastError = null;
    for (var i = 0; i < RPC_URLS.length; i++) {
      var rpcUrl = RPC_URLS[(currentRpcIndex + i) % RPC_URLS.length];
      try {
        var response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params })
        });
        var data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.result;
      } catch (err) {
        lastError = err;
        currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
      }
    }
    throw lastError || new Error('All RPCs failed');
  }

  function decodeGlyphs(len, pack) {
    if (len === 0 || pack === BigInt(0)) return null;
    var s = [];
    for (var i = 0; i < len; i++) {
      var idx = Number((pack >> BigInt(5 * (7 - 1 - i))) & BigInt(0x1F));
      if (idx < GLYPHS.length) s.push(GLYPHS[idx]);
    }
    return s.join(' · ');
  }

  async function getKeyGlyphs(keyId) {
    if (keyGlyphsCache[keyId]) return keyGlyphsCache[keyId];
    try {
      var data = SELECTORS.glyphs + enc256(keyId);
      var result = await rpc('eth_call', [{ to: Z1N_KEY, data: data }, 'latest']);
      var len = parseInt(result.slice(2, 66), 16);
      var pack = BigInt('0x' + result.slice(66, 130));
      var glyphs = decodeGlyphs(len, pack) || '';
      keyGlyphsCache[keyId] = glyphs;
      return glyphs;
    } catch (e) {
      return '';
    }
  }

  function getShortGlyphs(keyId) {
    var full = keyGlyphsCache[keyId] || '';
    if (!full) return '';
    return full.split(' · ').slice(0, 3).join('·');
  }

  async function keyExists(keyId) {
    try {
      var data = SELECTORS.ownerOf + enc256(keyId);
      var result = await rpc('eth_call', [{ to: Z1N_KEY, data: data }, 'latest']);
      return result && result !== '0x' && result !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    } catch (e) {
      return false;
    }
  }

  // Fetch inscription from contract (Layer 1 — immutable)
  async function getInscription(artefactId) {
    if (inscriptionCache[artefactId] !== undefined) return inscriptionCache[artefactId];
    try {
      // inscriptionOf(uint256) selector
      var sel = '0x' + keccak256Selector('inscriptionOf(uint256)');
      var data = sel + enc256(artefactId);
      var result = await rpc('eth_call', [{ to: Z1N_ARTEFACT, data: data }, 'latest']);
      if (!result || result === '0x') { inscriptionCache[artefactId] = ''; return ''; }
      // Decode ABI-encoded string: offset at 0x00, length at 0x40, data at 0x60
      var offset = parseInt(result.slice(2, 66), 16);
      var lenHex = result.slice(2 + offset * 2, 2 + offset * 2 + 64);
      var len = parseInt(lenHex, 16);
      if (len === 0) { inscriptionCache[artefactId] = ''; return ''; }
      var strHex = result.slice(2 + offset * 2 + 64, 2 + offset * 2 + 64 + len * 2);
      var str = decodeURIComponent(strHex.replace(/../g, '%$&'));
      inscriptionCache[artefactId] = str;
      return str;
    } catch (e) {
      inscriptionCache[artefactId] = '';
      return '';
    }
  }

  // Simple keccak selector — use pre-computed values to avoid dependency
  var KNOWN_SELECTORS = {
    'inscriptionOf(uint256)': '5a8b1a9f'
  };
  function keccak256Selector(sig) {
    return KNOWN_SELECTORS[sig] || '00000000';
  }

  // =====================================================================
  // DATA LOADING
  // =====================================================================
  
  async function loadOwnedArtefacts() {
    var z = getZ1N();
    var keyId = z.keyId;
    if (keyId === null || keyId === undefined) return;
    
    ownedArtefacts = [];
    
    var data = null;
    try {
      var apiBase = z.API_BASE || 'https://z1n-backend-production.up.railway.app/api';
      var response = await fetch(apiBase + '/key/' + keyId + '/artefacts', { cache: 'no-store' });
      
      if (!response.ok) return;
      
      data = await response.json();
      var liveArtefacts = data.liveArtefacts || [];
      
      for (var i = 0; i < liveArtefacts.length; i++) {
        var art = liveArtefacts[i];
        art.sourceKeyId = (art.sourceKeyId !== undefined && art.sourceKeyId !== null) ? art.sourceKeyId : keyId;
        art.boundToKeyId = art.boundToKeyId || 0;
        art.viewingActive = art.viewingActive || false;
        art.status = art.status || 'in_my_view';
        
        if (art.boundToKeyId > 0) {
          await getKeyGlyphs(art.boundToKeyId);
        }
        
        // Mark who released
        if (art.status === 'released' && art.releasedBy) {
          var z2 = getZ1N();
          art.releasedByRecipient = art.releasedBy !== (z2.wallet || '').toLowerCase();
        }
        ownedArtefacts.push(art);
      }
    } catch (e) {
      console.error('loadOwnedArtefacts error:', e);
      data = null;
    }
    
    if (data && data.notifications) {
      ingestNotifications(data.notifications);
      setTimeout(updateBadgesAndFeed, 100);
    }
  }

  async function loadSharedWithMe() {
    var z = getZ1N();
    var keyId = z.keyId;
    if (keyId === null || keyId === undefined) return;
    
    sharedWithMe = [];
    
    try {
      var apiBase = z.API_BASE || 'https://z1n-backend-production.up.railway.app/api';
      var response = await fetch(apiBase + '/key/' + keyId + '/library', { cache: 'no-store' });
      var data;
      
      if (response.ok) {
        data = await response.json();
        sharedWithMe = data.library || [];
      } else {
        response = await fetch(apiBase + '/key/' + keyId + '/artefacts', { cache: 'no-store' });
        if (response.ok) {
          data = await response.json();
          sharedWithMe = data.library || [];
        }
      }
      
      for (var i = 0; i < sharedWithMe.length; i++) {
        var art = sharedWithMe[i];
        if (art.sourceKeyId !== undefined && art.sourceKeyId !== null) {
          await getKeyGlyphs(art.sourceKeyId);
          art.sourceGlyphs = art.sourceGlyphs || getShortGlyphs(art.sourceKeyId);
        }
        if (art.status === 'released') {
          var z3 = getZ1N();
          // Compare on keyId — wallet comparison fails when same wallet owns multiple keys
          art.releasedByInitiator = art.sourceKeyId !== z3.keyId;
        }
      }
      
      // Generate offering_received notifications for pending items not yet seen
      var z2 = getZ1N();
      var seenKey = 'z1n_notif_seen_' + z2.keyId;
      var seenIds = [];
      try { seenIds = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch(e) {}
      var seenSet = new Set(seenIds);
      var syntheticNotifs = [];
      sharedWithMe.forEach(function(art) {
        if (art.status === 'pending') {
          var pid = art.tokenId + ':offering_received:' + art.tokenId;
          syntheticNotifs.push({
            type: 'offering_received',
            artefactId: art.tokenId,
            byKeyId: art.sourceKeyId,
            blockNumber: art.tokenId,
            message: art.offerMessage || '',
            seen: seenSet.has(pid)
          });
        }
      });
      if (data && data.notifications) {
        ingestNotifications(data.notifications.concat(syntheticNotifs));
      } else {
        ingestNotifications(syntheticNotifs);
      }
      setTimeout(updateBadgesAndFeed, 100);
    } catch (e) {
      console.error('loadSharedWithMe error:', e);
    }
    
    isLoadingShared = false;
    lastSharedSig = '';
    renderSharedSection();
  }

  // =====================================================================
  // UNIFIED NOTIFICATION SYSTEM
  // =====================================================================

  // Single source of truth — keyed by artefactId:type
  // Populated from backend notifications array (both /artefacts and /library)
  var notifications = {};

  // Store offer messages locally for feed display
  var offerMessages = {};

  function ingestNotifications(arr) {
    if (!arr) return;
    var z = getZ1N();
    var seenKey = 'z1n_notif_seen_' + z.keyId;
    var seenIds = [];
    try { seenIds = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch(e) {}
    var seenSet = new Set(seenIds);
    arr.forEach(function(n) {
      var key = n.artefactId + ':' + n.type;
      var persistentId = n.artefactId + ':' + n.type + ':' + n.blockNumber;
      var wasSeen = seenSet.has(persistentId) || (notifications[key] ? notifications[key].seen : false);
      notifications[key] = Object.assign({}, n, { seen: wasSeen });
    });
  }

  function markRead(artefactId) {
    var z = getZ1N();
    var seenKey = 'z1n_notif_seen_' + z.keyId;
    var seenIds = [];
    try { seenIds = JSON.parse(localStorage.getItem(seenKey) || '[]'); } catch(e) {}
    var seenSet = new Set(seenIds);
    Object.keys(notifications).forEach(function(key) {
      if (notifications[key].artefactId === artefactId) {
        notifications[key].seen = true;
        var persistentId = artefactId + ':' + notifications[key].type + ':' + notifications[key].blockNumber;
        seenSet.add(persistentId);
      }
    });
    try { localStorage.setItem(seenKey, JSON.stringify([...seenSet])); } catch(e) {}
    updateBadgesAndFeed();
  }

  function getUnreadCount() {
    return Object.values(notifications).filter(function(n) { return !n.seen; }).length;
  }

  function getUnreadForArtefact(artefactId) {
    return Object.values(notifications).filter(function(n) {
      return n.artefactId === artefactId && !n.seen;
    });
  }

  function hasUnread(artefactId) {
    return getUnreadForArtefact(artefactId).length > 0;
  }

  // Legacy aliases — keep these so existing render calls still work
  function hasUnreadNotification(artefactId) { return hasUnread(artefactId); }
  function markNotificationRead(artefactId) { markRead(artefactId); }
  function markInitiatorNotificationsReadForArtefact(artefactId) { markRead(artefactId); }
  function getUnreadNotificationCount() { return getUnreadCount(); }
  function getInitiatorUnreadCount() { return 0; } // merged into getUnreadCount
  function getInitiatorNotificationsForArtefact(artefactId) { return getUnreadForArtefact(artefactId); }

  // =====================================================================
  // LOADING SKELETON
  // =====================================================================

  function renderLoadingSkeleton(container, title) {
    if (!container) return;
    container.innerHTML = '<div class="artefact-section-header">' +
      '<h3 class="section-title title-green">' + title + '</h3>' +
    '</div>' +
    '<div class="artefact-loading-skeleton">' +
      '<div class="skeleton-spinner"></div>' +
      '<div class="skeleton-text">Loading artefacts...</div>' +
    '</div>';
  }

  // =====================================================================
  // OVERVIEW ARTEFACT PREVIEW
  // =====================================================================

  function updateOverviewPreview() {
    var z = getZ1N();
    if (!z.keyId && z.keyId !== 0) return;
    
    var container = document.getElementById('overviewArtefactContainer');
    var previewImg = document.getElementById('overviewArtefactPreview');
    var placeholder = document.getElementById('overviewArtefactPlaceholder');
    var statusEl = document.getElementById('artefactStatus');
    var mintBtn = document.getElementById('btnMintLiveArtefactOverview');
    
    if (!container) return;
    
    if (placeholder) placeholder.innerHTML = '<div class="artefact-preview-loading"><div class="preview-spinner"></div><div class="preview-text">Loading...</div></div>';
    if (previewImg) previewImg.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Loading artefact...';
    if (statusEl) statusEl.className = 'artefact-preview-status';
    
    if (pendingArtefacts.length > 0) {
      if (placeholder) placeholder.innerHTML = '<div class="artefact-preview-loading"><div class="preview-spinner"></div><div class="preview-text">Minting...</div></div>';
      if (statusEl) statusEl.textContent = 'Artefact minting — waiting for confirmation...';
      if (statusEl) statusEl.style.color = 'var(--accent)';
      if (mintBtn) { mintBtn.disabled = true; mintBtn.textContent = 'Minting...'; }
      return;
    }
    
    var apiBase = z.API_BASE || 'https://z1n-backend-production.up.railway.app/api';
    var firstArtefact = ownedArtefacts.find(function(a) { return a.status === 'in_my_view'; }) || ownedArtefacts[0];
var artefactParam = firstArtefact ? '&artefactTokenId=' + firstArtefact.tokenId : '';
var previewUrl = apiBase + '/artefact/' + z.keyId + '/static-preview?epoch=' + (z.epoch || 0) + artefactParam + '&t=' + Date.now();
    
    if (previewImg) {
      previewImg.onerror = function() {
        this.style.display = 'none';
        if (placeholder) {
          if (ownedArtefacts.length === 0) {
            placeholder.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;"><span style="font-size:48px;color:rgba(94,232,160,0.2);">◈</span><span style="font-size:10px;color:var(--text-soft);">No artefact yet</span></div>';
          } else {
            placeholder.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;"><span style="font-size:48px;color:rgba(94,232,160,0.2);">◈</span><span style="font-size:10px;color:var(--text-soft);">Preview unavailable</span></div>';
          }
          placeholder.style.display = 'flex';
        }
        if (statusEl) {
          statusEl.textContent = ownedArtefacts.length > 0 ? ownedArtefacts.length + ' artefact(s)' : 'No live artefact';
          statusEl.className = 'artefact-preview-status' + (ownedArtefacts.length === 0 ? ' no-artefact' : '');
        }
        if (mintBtn) {
          mintBtn.disabled = false;
          mintBtn.textContent = ownedArtefacts.length > 0 ? '+ Mint Artefact — 7 POL' : '+ Mint Free Artefact';
        }
      };
      
      previewImg.onload = function() {
        this.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (statusEl) {
          var activeCount = ownedArtefacts.filter(function(a) { return a.status !== 'released'; }).length;
          statusEl.textContent = activeCount > 0 ? activeCount + ' active artefact(s)' : 'No active artefacts';
          statusEl.className = 'artefact-preview-status';
        }
        if (mintBtn) {
          mintBtn.disabled = false;
          mintBtn.textContent = '+ Mint Artefact — 7 POL';
        }
      };
      
      previewImg.src = previewUrl;
    }
  }

  // =====================================================================
  // RENDERING - OWNED SECTION
  // =====================================================================
  
  function renderOwnedSection() {
    var container = document.getElementById('ownedArtefactsSection');
    if (!container) return;
    
    if (isLoadingOwned) {
      renderLoadingSkeleton(container, 'Your Artefacts');
      return;
    }
    
    var unreadKeysOwned = Object.keys(notifications).filter(function(k) { return !notifications[k].seen; }).join(',');
var sig = ownedArtefacts.map(function(a) { return a.tokenId + ':' + a.status; }).join(',') + '|' + pendingArtefacts.length + '|' + JSON.stringify(pendingViewChanges) + '|' + unreadKeysOwned;
    if (sig === lastOwnedSig && container.innerHTML !== '') { return; }
    lastOwnedSig = sig;
    
    var z = getZ1N();
    var filtered = ownedArtefacts.filter(function(art) {
      if (ownedFilter.status !== 'all' && art.status !== ownedFilter.status) return false;
      if (ownedFilter.hideReleased && art.status === 'released') return false;
      if (ownedFilter.search && !String(art.tokenId).includes(ownedFilter.search)) return false;
      return true;
    });
    
    var showFilters = ownedArtefacts.length > 5;
    var hasFreeArtefact = ownedArtefacts.length > 0;
    var mintText = isMinting ? 'Minting...' : (hasFreeArtefact ? '+ Mint Artefact — 7 POL' : '+ Mint Free Artefact');
    
    var countInView = ownedArtefacts.filter(function(a) { return a.status === 'in_my_view'; }).length;
    var countPending = ownedArtefacts.filter(function(a) { return a.status === 'pending'; }).length;
    var countShared = ownedArtefacts.filter(function(a) { return a.status === 'shared'; }).length;
    var countReleased = ownedArtefacts.filter(function(a) { return a.status === 'released'; }).length;
    
    var html = '<div class="artefact-section-header">' +
      '<h3 class="section-title title-green">Your Artefacts <span class="count" style="color:var(--accent);">(' + ownedArtefacts.length + ')</span></h3>' +
      '<div class="header-actions" style="display:flex;align-items:center;gap:8px;">' +
        '<button class="view-toggle' + (ownedViewMode === 'card' ? ' active' : '') + '" onclick="Z1NArtefacts.setViewMode(\'card\')" title="Card view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">▦</button>' +
        '<button class="view-toggle' + (ownedViewMode === 'list' ? ' active' : '') + '" onclick="Z1NArtefacts.setViewMode(\'list\')" title="List view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">☰</button>' +
        '<button class="btn btn-green" id="btnMintInSection" onclick="Z1NArtefacts.mint()"' + (isMinting ? ' disabled' : '') + ' style="height:32px;display:flex;align-items:center;">' + mintText + '</button>' +
      '</div>' +
    '</div>';
    
    html += '<div id="mintArtefactStatus" style="margin-bottom: 12px;"></div>';
    
    html += '<div id="mintInscriptionRow" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
      '<label style="font-size:12px;color:var(--text-soft);white-space:nowrap;">Inscription</label>' +
      '<input type="text" id="mintInscriptionInput" maxlength="64" placeholder="Optional — max 64 characters" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text-main);font-family:inherit;">' +
      '<span id="mintInscriptionCount" style="font-size:10px;color:var(--text-soft);min-width:32px;text-align:right;">0/64</span>' +
    '</div>';
    
    if (showFilters) {
      html += '<div class="artefact-filter-bar">' +
        '<div class="filter-pills">' +
          '<button class="filter-pill' + (ownedFilter.status === 'all' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'all\')">All <span class="pill-count">' + ownedArtefacts.length + '</span></button>' +
          '<button class="filter-pill' + (ownedFilter.status === 'in_my_view' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'in_my_view\')">Personal <span class="pill-count">' + countInView + '</span></button>' +
          (countPending > 0 ? '<button class="filter-pill' + (ownedFilter.status === 'pending' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'pending\')">Offered <span class="pill-count">' + countPending + '</span></button>' : '') +
          '<button class="filter-pill' + (ownedFilter.status === 'shared' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'shared\')">Bounded <span class="pill-count">' + countShared + '</span></button>' +
          (countReleased > 0 ? '<button class="filter-pill' + (ownedFilter.status === 'released' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'released\')">Released <span class="pill-count">' + countReleased + '</span></button>' : '') +
          (countReleased > 0 ? '<button class="filter-pill' + (ownedFilter.hideReleased ? ' active' : '') + '" onclick="Z1NArtefacts.toggleHideReleased()" style="opacity:0.7;">Hide Released</button>' : '') +
        '</div>' +
        '<input type="text" class="filter-search" id="ownedSearchInput" placeholder="Search ID..." value="' + (ownedFilter.search || '') + '" onkeyup="Z1NArtefacts.filterOwned()">' +
      '</div>';
    }
    
    if (ownedArtefacts.length === 0 && pendingArtefacts.length === 0) {
      html += '<div class="artefact-empty">' +
        '<div class="empty-icon">◈</div>' +
        '<p>No live artefacts yet</p>' +
        '<p class="empty-hint">Mint your first artefact — it\'s free!</p>' +
      '</div>';
    } else if (filtered.length === 0 && pendingArtefacts.length === 0) {
      html += '<div class="artefact-empty">No artefacts match your filters</div>';
    } else if (ownedViewMode === 'list') {
      html += renderListView(filtered, z);
    } else {
      html += renderCardView(filtered, z);
    }
    
    container.innerHTML = html;
    
    var inscInput = document.getElementById('mintInscriptionInput');
    var inscCount = document.getElementById('mintInscriptionCount');
    if (inscInput && inscCount) {
      inscInput.addEventListener('input', function() {
        var len = this.value.length;
        inscCount.textContent = len + '/64';
        inscCount.style.color = len > 56 ? 'var(--danger, #f87171)' : 'var(--text-soft)';
      });
    }
  }

  function renderCardView(filtered, z) {
    var html = '<div class="artefact-grid" id="ownedArtefactGrid">';
    
    pendingArtefacts.forEach(function(p) {
      html += '<div class="artefact-card pending-mint">' +
        '<div class="artefact-preview">' +
          '<div class="pending-mint-overlay">' +
            '<div class="pending-mint-spinner"></div>' +
            '<div class="pending-mint-label">Minting</div>' +
            '<div class="pending-mint-sub">Waiting for indexer...</div>' +
          '</div>' +
        '</div>' +
        '<div class="artefact-info-row">' +
          '<span class="info-id" style="color:var(--accent);">New</span>' +
          '<span class="info-status" style="color:var(--accent);">Pending</span>' +
        '</div>' +
      '</div>';
    });
    
    filtered.forEach(function(art) {
      var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === art.tokenId; }) + 1;
      var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                        art.status === 'pending' ? 'status-pending' :
                        art.status === 'shared' ? 'status-bounded' :
                        art.status === 'released' ? 'status-released' : '';
      var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                        art.status === 'pending' ? 'Offered' :
                        art.status === 'shared' ? 'Bounded' :
                        art.status === 'released' ? (art.releasedByRecipient ? 'Released by K#' + art.releasedFromKeyId : 'Released by you') + (art.releasedFromKeyId > 0 ? ' · was K#' + art.releasedFromKeyId : '') :
                        art.status === 'rejected' ? 'Rejected' : art.status;
      var releasedByRecipientBg = art.releasedByRecipient ? 'rgba(248,113,113,0.85)' : 'rgba(94,232,160,0.85)';
      var releasedByRecipientColor = art.releasedByRecipient ? '#fff' : '#000';
      
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
        '/static-preview?epoch=' + (z.epoch || 0) + '&artefactTokenId=' + art.tokenId;
      if (art.status !== 'in_my_view') {
        previewUrl += '&viewerKeyId=' + z.keyId;
      }
      
      var hasPending = pendingViewChanges[art.tokenId];
      var pendingLabel = hasPending === 'offering' ? 'Offering...' : hasPending === 'cancelling' ? 'Cancelling...' : hasPending === 'accepting' ? 'Accepting...' : hasPending === 'rejecting' ? 'Rejecting...' : hasPending === 'releasing' ? 'Releasing...' : '';
      var initiatorNotifs = getInitiatorNotificationsForArtefact(art.tokenId);
      var hasInitiatorNotif = initiatorNotifs.length > 0;
      var initiatorNotifLabel = '';
      if (hasInitiatorNotif) {
        var n = initiatorNotifs[initiatorNotifs.length - 1];
        if (n.type === 'offering_accepted') initiatorNotifLabel = 'K#' + n.byKeyId + ' accepted';
        else if (n.type === 'offering_rejected') initiatorNotifLabel = 'K#' + n.byKeyId + ' rejected';
        else if (n.type === 'artefact_released') initiatorNotifLabel = n.releasedBy === 'self' ? 'Released by you' : 'K#' + n.byKeyId + ' released';
      }

      html += '<div class="artefact-card ' + statusClass + (hasInitiatorNotif ? ' unseen-artefact' : '') + '"' +
        (hasPending ? ' style="position:relative;pointer-events:none;opacity:0.6;"' : ' style="position:relative;"') +
        ' onclick="Z1NArtefacts.openOwnedModal(' + art.tokenId + ')">';

      if (hasInitiatorNotif && !hasPending) {
        var notifBg = (initiatorNotifLabel.includes('released') || initiatorNotifLabel.includes('rejected')) ? 'rgba(248,113,113,0.85)' : 'rgba(94,232,160,0.85)';
        var notifColor = (initiatorNotifLabel.includes('released') || initiatorNotifLabel.includes('rejected')) ? '#fff' : '#000';
        var leftBg = (initiatorNotifLabel.includes('released') && art.releasedByRecipient) ? 'rgba(248,113,113,0.85)' : (initiatorNotifLabel.includes('rejected')) ? 'rgba(248,113,113,0.85)' : 'rgba(94,232,160,0.85)';
        var leftColor = (leftBg === 'rgba(248,113,113,0.85)') ? '#fff' : '#000';
        html += '<div style="position:absolute;top:6px;left:6px;z-index:3;background:' + leftBg + ';color:' + leftColor + ';font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:0.04em;">' + initiatorNotifLabel + '</div>';
        html += '<div style="position:absolute;top:6px;right:6px;z-index:3;background:' + leftBg + ';color:' + leftColor + ';font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:0.04em;">NEW</div>';
      }
      
      if (hasPending) {
        html += '<div class="pending-change-overlay"><div class="pending-change-spinner"></div><span style="color:var(--accent);font-size:11px;">' + pendingLabel + '</span></div>';
      }
      
      html += '<div class="artefact-preview">';
      // Show preview for personal and bounded artefacts
      if (art.status === 'in_my_view' || art.status === 'shared') {
        html += artImg(previewUrl, 'Artefact #' + artefactIndex);
      } else if (art.status === 'released') {
        html += '<div class="artefact-placeholder shared" style="color:#f87171;opacity:0.5;">◈</div>';
      } else {
        // pending/offered — yellow triangle
        html += '<div class="artefact-placeholder shared" style="color:#ffd556;">◈</div>';
      }
      html += '</div>';
      
      html += '<div class="artefact-info-row">' +
        '<span class="info-id">#' + artefactIndex + '</span>' +
        '<span class="info-status ' + statusClass + '">' + statusLabel + '</span>' +
        (art.boundToKeyId > 0 ? '<span class="info-bound">→ #' + art.boundToKeyId + '</span>' : '') +
      '</div>';
      var cardSubText = (art.status === 'released' && art.releaseMessage) ? art.releaseMessage : (art.inscription || '');
      html += (cardSubText ? '<div style="font-size:8px;color:var(--text-soft);font-style:italic;padding:2px 6px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(cardSubText) + '">' + escapeHtml(cardSubText) + '</div>' : '');
      html += '</div>';
    });
    
    html += '</div>';
    return html;
  }

  function renderListView(filtered, z) {
    var html = '<div class="artefact-list-grid">';
    filtered.forEach(function(art) {
      var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === art.tokenId; }) + 1;
      var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                        art.status === 'pending' ? 'status-pending' :
                        art.status === 'shared' ? 'status-bounded' :
                        art.status === 'released' ? 'status-released' : '';
      var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                        art.status === 'pending' ? 'Offered' :
                        art.status === 'shared' ? 'Bounded' :
                        art.status === 'released' ? 'Released' : art.status;
      
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
        '/static-preview?epoch=' + (z.epoch || 0) + '&artefactTokenId=' + art.tokenId;
      if (art.status !== 'in_my_view') {
        previewUrl += '&viewerKeyId=' + z.keyId;
      }
      
      html += '<div class="artefact-list-card ' + statusClass + '" onclick="Z1NArtefacts.openOwnedModal(' + art.tokenId + ')">' +
        '<div class="list-card-preview">' +
          (art.status === 'in_my_view' || art.status === 'shared' ? artImg(previewUrl, 'Artefact #' + artefactIndex) : '<div class="list-placeholder shared" style="color:' + (art.status === 'released' ? 'var(--text-soft)' : '#ffd556') + ';opacity:' + (art.status === 'released' ? '0.4' : '1') + ';">◈</div>') +
        '</div>' +
        '<div class="list-card-meta">' +
          '<div class="list-card-id">#' + artefactIndex + '</div>' +
          '<div class="artefact-status ' + statusClass + '">' + statusLabel + '</div>' +
          (art.boundToKeyId > 0 ? '<div class="list-card-bound">→ Key #' + art.boundToKeyId + '</div>' : '') +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  // =====================================================================
  // RENDERING - SHARED SECTION
  // =====================================================================

  function renderSharedSection() {
    var container = document.getElementById('sharedWithMeSection');
    if (!container) return;
    
    var unreadKeysShared = Object.keys(notifications).filter(function(k) { return !notifications[k].seen; }).join(',');
var sig = sharedWithMe.map(function(a) { return a.tokenId + ':' + a.status + ':' + (a.stateNum || 0); }).join(',') + '|' + unreadKeysShared;
    if (sig === lastSharedSig && container.innerHTML !== '') { return; }
    lastSharedSig = sig;
    
    var z = getZ1N();
    var filtered = sharedWithMe.filter(function(art) {
      if (libraryFilter.status !== 'all' && art.status !== libraryFilter.status) return false;
      if (libraryFilter.hideReleased && (art.status === 'released' || art.stateNum === 3)) return false;
      if (libraryFilter.hideRejected && art.status === 'rejected') return false;
      if (libraryFilter.search && !String(art.sourceKeyId).includes(libraryFilter.search)) return false;
      return true;
    });
    
    var showFilters = sharedWithMe.length > 5;
    var parentCard = container.closest('.section-card');
    if (parentCard) parentCard.style.display = 'block';
    
    var countBounded = sharedWithMe.filter(function(a) { return a.status === 'active' || a.stateNum === 2; }).length;
    var countPending = sharedWithMe.filter(function(a) { return a.status === 'pending' || a.stateNum === 1; }).length;
    var countReleased = sharedWithMe.filter(function(a) { return a.status === 'released' || a.stateNum === 3; }).length;
    var countRejected = sharedWithMe.filter(function(a) { return a.status === 'rejected'; }).length;
    
    var html = '<div class="artefact-section-header">' +
      '<h3 class="section-title title-green">Received Artefacts <span class="count" style="color:var(--accent);">(' + sharedWithMe.length + ')</span></h3>' +
      '<div class="header-actions">' +
        '<button class="view-toggle' + (libraryViewMode === 'card' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryViewMode(\'card\')" title="Card view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">◦</button>' +
        '<button class="view-toggle' + (libraryViewMode === 'list' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryViewMode(\'list\')" title="List view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">☰</button>' +
      '</div>' +
    '</div>';
    
    if (showFilters) {
      html += '<div class="artefact-filter-bar">' +
        '<div class="filter-pills">' +
          '<button class="filter-pill' + (libraryFilter.status === 'all' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'all\')">All <span class="pill-count">' + sharedWithMe.length + '</span></button>' +
          (countPending > 0 ? '<button class="filter-pill' + (libraryFilter.status === 'pending' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'pending\')">Pending <span class="pill-count">' + countPending + '</span></button>' : '') +
          '<button class="filter-pill' + (libraryFilter.status === 'active' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'active\')">Bounded <span class="pill-count">' + countBounded + '</span></button>' +
          (countRejected > 0 ? '<button class="filter-pill' + (libraryFilter.status === 'rejected' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'rejected\')">Rejected <span class="pill-count">' + countRejected + '</span></button>' : '') +
          (countReleased > 0 ? '<button class="filter-pill' + (libraryFilter.status === 'released' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'released\')">Released <span class="pill-count">' + countReleased + '</span></button>' : '') +
          (countReleased > 0 ? '<button class="filter-pill' + (libraryFilter.hideReleased ? ' active' : '') + '" onclick="Z1NArtefacts.toggleHideReleased(\'library\')" style="opacity:0.7;">Hide Released</button>' : '') +
          (countRejected > 0 ? '<button class="filter-pill' + (libraryFilter.hideRejected ? ' active' : '') + '" onclick="Z1NArtefacts.toggleHideRejected()" style="opacity:0.7;">Hide Rejected</button>' : '') +
        '</div>' +
        '<input type="text" class="filter-search" id="librarySearchInput" placeholder="Search Key ID..." value="' + (libraryFilter.search || '') + '" onkeyup="Z1NArtefacts.filterLibrary()">' +
      '</div>';
    }
    
    if (sharedWithMe.length === 0) {
      html += '<div class="artefact-empty">' +
        '<div class="empty-icon">◈←</div>' +
        '<p>No artefacts received yet</p>' +
        '<p class="empty-hint">When another Key offers an artefact to you, it appears here.</p>' +
      '</div>';
    } else if (filtered.length === 0) {
      html += '<div class="artefact-empty">No artefacts match your filters</div>';
    } else if (libraryViewMode === 'list') {
      html += renderSharedListView(filtered, z);
    } else {
      html += renderSharedCardView(filtered, z);
    }
    
    container.innerHTML = html;
  }

  function renderSharedCardView(filtered, z) {
    var html = '<div class="artefact-grid" id="sharedArtefactGrid">';
    filtered.forEach(function(art) {
      var isPending = art.status === 'pending' || art.stateNum === 1;
      var isReleased = art.status === 'released' || art.stateNum === 3;
      var isRejected = art.status === 'rejected';
      var isBounded = !isPending && !isReleased && !isRejected;
      
      var hasBeenSeen = !hasUnreadNotification(art.tokenId);
      var statusClass = isPending ? 'status-pending' : (isRejected && hasBeenSeen) ? 'status-personal' : isRejected ? 'status-rejected' : isReleased ? 'status-released' : 'status-bounded';
      var statusLabel = isPending ? 'Pending' : isRejected ? 'Rejected' : 
                        isReleased ? (art.releasedByInitiator ? 'Released by sender' : 'Released by you') : 'Bounded';
      
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
        '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
        '&artefactTokenId=' + art.tokenId;
      
      var hasNotif = hasUnreadNotification(art.tokenId) && !art._releaseSeen;
      
      // Icon for non-preview states
      var previewContent;
      if (isBounded) {
        previewContent = artImg(previewUrl, 'From Key #' + art.sourceKeyId);
      } else if (isPending) {
        previewContent = '<div class="artefact-placeholder shared" style="color:#ffd556;font-size:48px;">◈</div>';
      } else if (isRejected) {
        previewContent = '<div class="artefact-placeholder shared" style="color:#f87171;font-size:48px;">◈</div>';
      } else {
        previewContent = '<div class="artefact-placeholder shared" style="color:#f87171;opacity:0.5;font-size:48px;">◈</div>';
      }
      
      var subText = isReleased && art.releaseMessage ? art.releaseMessage :
                    isPending && art.offerMessage ? art.offerMessage :
                    art.inscription || '';
      var releasedLabel = isReleased ? (art.releasedByInitiator ? 'K#' + art.sourceKeyId + ' released' : 'You released') : '';
      var releasedBadgeBg = isReleased && art.releasedByInitiator ? 'rgba(248,113,113,0.85)' : 'rgba(94,232,160,0.85)';
      var releasedBadgeColor = isReleased && art.releasedByInitiator ? '#fff' : '#000';
      html += '<div class="artefact-card library-card ' + statusClass + (hasNotif ? ' unseen-artefact' : '') + '" style="position:relative;" onclick="Z1NArtefacts.openLibraryModal(' + art.tokenId + ', ' + art.sourceKeyId + ')">' +
        (isReleased ? '<div style="position:absolute;top:6px;left:6px;z-index:3;background:' + releasedBadgeBg + ';color:' + releasedBadgeColor + ';font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:0.04em;">' + releasedLabel + '</div>' : '') +
        '<div class="artefact-preview">' +
          previewContent +
          '<div class="library-badge">← #' + art.sourceKeyId + '</div>' +
        '</div>' +
        '<div class="artefact-info-row">' +
          '<span class="info-id">From #' + art.sourceKeyId + '</span>' +
          '<span class="info-status ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        (subText ? '<div style="font-size:8px;color:var(--text-soft);font-style:italic;padding:2px 6px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(subText) + '">' + escapeHtml(subText) + '</div>' : '') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderSharedListView(filtered, z) {
    var html = '<div class="artefact-list-grid">';
    filtered.forEach(function(art) {
      var isPending = art.status === 'pending' || art.stateNum === 1;
      var isReleased = art.status === 'released' || art.stateNum === 3;
      var isRejected = art.status === 'rejected';
      var isBounded = !isPending && !isReleased && !isRejected;
      var hasBeenSeen = !hasUnreadNotification(art.tokenId);
      var statusClass = isPending ? 'status-pending' : (isRejected && hasBeenSeen) ? 'status-personal' : isRejected ? 'status-rejected' : isReleased ? 'status-released' : 'status-bounded';
      var statusLabel = isPending ? 'Pending' : isRejected ? 'Rejected' : isReleased ? 'Released' : 'Bounded';
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId +
        '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId +
        '&artefactTokenId=' + art.tokenId;
      var hasNotif = hasUnreadNotification(art.tokenId) && !art._releaseSeen;
      html += '<div class="artefact-list-card ' + statusClass + (hasNotif ? ' unseen-artefact' : '') + '" onclick="Z1NArtefacts.openLibraryModal(' + art.tokenId + ', ' + art.sourceKeyId + ')">' +
        '<div class="list-card-preview">' +
          (isBounded ? artImg(previewUrl, 'From Key #' + art.sourceKeyId) : '<div class="list-placeholder shared" style="color:' + (isRejected ? '#f87171' : isReleased ? 'var(--text-soft)' : '#ffd556') + ';opacity:' + (isReleased ? '0.4' : '1') + ';">◈</div>') +
        '</div>' +
        '<div class="list-card-meta">' +
          '<div class="list-card-id">From #' + art.sourceKeyId + '</div>' +
          '<div class="artefact-status ' + statusClass + '">' + statusLabel + '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  // =====================================================================
  // MODALS
  // =====================================================================
  
  function openOwnedModal(artefactId) {
    markInitiatorNotificationsReadForArtefact(artefactId);
    lastOwnedSig = '';
    lastSharedSig = '';
    renderOwnedSection();
    updateBadgesAndFeed();

    var art = ownedArtefacts.find(function(a) { return a.tokenId === artefactId; });
    if (!art) return;
    
    var z = getZ1N();
    var modal = document.getElementById('artefactSharingModal');
    if (!modal) return;
    
    var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === artefactId; }) + 1;
    var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                      art.status === 'pending' ? 'Offered' :
                      art.status === 'shared' ? 'Bounded' :
                      art.status === 'released' ? 'Released' : art.status;
    var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                      art.status === 'pending' ? 'status-pending' :
                      art.status === 'shared' ? 'status-bounded' :
                      art.status === 'released' ? 'status-released' : '';
    
    var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
      '/static-preview?epoch=' + (z.epoch || 0) + '&artefactTokenId=' + art.tokenId + '&t=' + Date.now();
    if (art.status !== 'in_my_view') {
      previewUrl += '&viewerKeyId=' + z.keyId;
    }

    // Load inscription
    var inscriptionHtml = '';
    getInscription(artefactId).then(function(insc) {
      var el = document.getElementById('modalInscription_' + artefactId);
      if (el && insc) el.innerHTML = '<div class="info-row"><span class="label">Inscription</span><span class="value" style="font-style:italic;color:var(--text-soft);">' + escapeHtml(insc) + '</span></div>';
    });
    
    var contentHtml = '';
    
    if (art.status === 'in_my_view') {
      // Single preview — no two-column layout
      contentHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div id="modalInscription_' + artefactId + '"></div>' +
          (art.rejectCount > 0 ? '<div class="info-row" style="margin-bottom:8px;"><span class="label" style="font-size:11px;color:var(--text-soft);">Rejected</span><span class="value" style="font-size:11px;color:#f87171;">' + art.rejectCount + 'x previously rejected</span></div>' : '') +
          '<div class="share-form">' +
          '<label>Offer to Key ID:</label>' +
          '<input type="number" id="shareTargetKeyId" placeholder="Enter Key ID" min="0">' +
          '<div id="shareKeyValidation" class="validation-msg"></div>' +
          '<label style="margin-top:10px;display:block;font-size:12px;color:var(--text-soft);">Message <span style="font-size:11px;">(optional — max 64 chars)</span></label>' +
          '<input type="text" id="shareOfferMessage" maxlength="64" placeholder="Optional message..." style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text-main);font-family:inherit;margin-bottom:8px;">' +
          '<div class="warning-box" style="border-color:rgba(94,232,160,0.4);background:rgba(94,232,160,0.08);">' +
            '<span class="warning-icon" style="filter:hue-rotate(90deg);">⚠️</span><div><strong>Offering</strong><p>The recipient must accept this offering before the artefact becomes bounded. You cannot offer it to a different Key while pending.</p></div>' +
          '</div>' +
          '<button class="btn btn-green" onclick="Z1NArtefacts.offerArtefact(' + artefactId + ')">Offer to Key</button>' +
        '</div>';
    } else if (art.status === 'pending') {
      var pendingKeyId = art.pendingForKeyId || art.boundToKeyId || 0;
      contentHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div id="modalInscription_' + artefactId + '"></div>' +
        '<div class="modal-info">' +
          '<div class="info-row"><span class="label">Status</span><span class="value" style="color:#ffd556;">Offered — awaiting response</span></div>' +
          '<div class="info-row"><span class="label">Offered to</span><span class="value">Key #' + pendingKeyId + '</span></div>' +
        '</div>' +
        '<div class="action-buttons">' +
          '<p style="color:var(--text-soft);font-size:12px;">Cancel this offering to make the artefact available again.</p>' +
          '<button class="btn btn-danger" style="background:rgba(248,113,113,0.2);border-color:rgba(248,113,113,0.4);color:#f87171;" onclick="Z1NArtefacts.cancelOffering(' + artefactId + ')">Cancel Offering</button>' +
        '</div>';
    } else if (art.status === 'shared') {
      // Bounded — show release with message field
      contentHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div id="modalInscription_' + artefactId + '"></div>' +
        '<div class="modal-info">' +
          '<div class="info-row"><span class="label">Status</span><span class="value status-bounded">Bounded</span></div>' +
          '<div class="info-row"><span class="label">Bound to</span><span class="value">Key #' + art.boundToKeyId + '</span></div>' +
        '</div>' +
        '<div class="action-buttons">' +
          '<p style="color:var(--text-soft);font-size:12px;">Permanently end this artefact relationship. This cannot be undone.</p>' +
          '<label style="display:block;font-size:12px;color:var(--text-soft);margin-bottom:4px;">Release message <span style="font-size:11px;">(optional — max 64 chars, stored on-chain)</span></label>' +
          '<input type="text" id="releaseMessageInput" maxlength="64" placeholder="Optional release message..." style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text-main);font-family:inherit;margin-bottom:10px;">' +
          '<button class="btn" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);color:#f87171;font-size:12px;" onclick="Z1NArtefacts.ownerRelease(' + artefactId + ')">Release Permanently</button>' +
        '</div>';
    } else if (art.status === 'released') {
      var relNotifs = Object.values(initiatorNotifications).filter(function(n) { return n.artefactId === artefactId; });
      var relNotifHtml = '';
      relNotifs.forEach(function(n) {
        var label = n.type === 'offering_accepted' ? 'K#' + n.byKeyId + ' accepted this artefact' :
                    n.type === 'offering_rejected' ? 'K#' + n.byKeyId + ' rejected this artefact' :
                    n.type === 'artefact_released' ? 'K#' + n.byKeyId + ' released — "' + escapeHtml(n.message || '') + '"' : '';
        if (!label) return;
        var color = n.type === 'offering_accepted' ? 'var(--accent)' : '#f87171';
        relNotifHtml += '<div class="info-row"><span class="label" style="color:' + color + ';">◈</span><span class="value" style="color:' + color + ';">' + label + '</span></div>';
      });
      contentHtml = '<div class="modal-preview large" style="opacity:0.4;">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div id="modalInscription_' + artefactId + '"></div>' +
        '<div class="modal-info">' +
          '<div class="info-row"><span class="label">Status</span><span class="value" style="color:var(--text-soft);">Released — retired</span></div>' +
          (art.boundToKeyId > 0 ? '<div class="info-row"><span class="label">Was bound to</span><span class="value">Key #' + art.boundToKeyId + '</span></div>' : (art.releasedFromKeyId > 0 ? '<div class="info-row"><span class="label">Was bound to</span><span class="value">Key #' + art.releasedFromKeyId + '</span></div>' : '')) +
          (art.releaseMessage ? '<div class="info-row"><span class="label">Release msg</span><span class="value" style="color:#f87171;font-style:italic;">' + escapeHtml(art.releaseMessage) + '</span></div>' : '') +
          relNotifHtml +
        '</div>' +
        '<div style="padding:12px 0;color:var(--text-soft);font-size:13px;">This artefact has been permanently released and cannot be used again.</div>';
    }
    
    modal.innerHTML = '<div class="modal-overlay" onclick="Z1NArtefacts.closeModal()"></div>' +
      '<div class="modal-content wide"><button class="modal-close" onclick="Z1NArtefacts.closeModal()">×</button>' +
        '<h2>Artefact #' + artefactIndex + ' <span class="modal-subtitle">(Token ID: ' + artefactId + ')</span></h2>' +
        '<div class="modal-body">' + contentHtml + '<div id="sharingStatus" class="status-area"></div></div>' +
      '</div>';
    
    modal.classList.add('active');
    var input = document.getElementById('shareTargetKeyId');
    if (input) input.addEventListener('input', validateShareTarget);
  }

  function openLibraryModal(artefactId, sourceKeyId) {
    markNotificationRead(artefactId);
    markInitiatorNotificationsReadForArtefact(artefactId);
    // Also clear any released state from library display
    var artToMark = sharedWithMe.find(function(a) { return a.tokenId === artefactId; });
    if (artToMark && artToMark.status === 'released') {
      artToMark._releaseSeen = true;
    }
    lastSharedSig = '';
    lastOwnedSig = '';
    renderSharedSection();
    updateBadgesAndFeed();
    
    var z = getZ1N();
    var modal = document.getElementById('artefactSharingModal');
    if (!modal) return;
    
    var artData = sharedWithMe.find(function(a) { return a.tokenId === artefactId; });
    var status = artData ? artData.status : 'active';
    var isPending = status === 'pending' || (artData && artData.stateNum === 1);
    var isReleased = status === 'released' || (artData && artData.stateNum === 3);
    var isRejected = status === 'rejected';
    var isBounded = !isPending && !isReleased && !isRejected;
    
    var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + sourceKeyId + 
      '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
      '&artefactTokenId=' + artefactId + '&t=' + Date.now();
    
    var glyphs = keyGlyphsCache[sourceKeyId] || '';
    var actionsHtml = '';
    
    if (isPending) {
      actionsHtml = '<div class="action-buttons" style="display:flex;gap:10px;margin-top:16px;">' +
        '<button class="btn btn-green" style="flex:1;" onclick="Z1NArtefacts.acceptOffering(' + artefactId + ')">Accept</button>' +
        '<button class="btn btn-danger" style="flex:1;background:rgba(248,113,113,0.2);border-color:rgba(248,113,113,0.4);color:#f87171;" onclick="Z1NArtefacts.rejectOffering(' + artefactId + ')">Reject</button>' +
      '</div>';
    } else if (isBounded) {
      actionsHtml = '<div class="action-buttons" style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">' +
        '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">' +
          '<p style="color:var(--text-soft);font-size:12px;">Permanently end this artefact relationship.</p>' +
          '<label style="display:block;font-size:12px;color:var(--text-soft);margin-bottom:4px;">Release message <span style="font-size:11px;">(optional — max 64 chars, stored on-chain)</span></label>' +
          '<input type="text" id="releaseMessageInput" maxlength="64" placeholder="Optional release message..." style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text-main);font-family:inherit;margin-bottom:8px;">' +
          '<button class="btn" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);color:#f87171;font-size:12px;" onclick="Z1NArtefacts.recipientRelease(' + artefactId + ')">Release Permanently</button>' +
        '</div>' +
      '</div>';
    }
    
    var previewHtml = '';
    if (isPending) {
      previewHtml = '<div class="modal-preview large" style="opacity:0.6;">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div style="text-align:center;color:#ffd556;font-size:13px;margin-top:4px;">Pending — accept to view</div>';
    } else if (isRejected) {
      previewHtml = '<div style="display:flex;align-items:center;justify-content:center;height:200px;"><div style="font-size:80px;color:#f87171;opacity:0.5;">◈</div></div>' +
        '<div style="text-align:center;color:#f87171;font-size:13px;margin-top:4px;">You rejected this offering</div>';
    } else if (isReleased) {
      previewHtml = '<div style="display:flex;align-items:center;justify-content:center;height:200px;"><div style="font-size:80px;color:var(--text-soft);opacity:0.3;">◈</div></div>' +
        '<div style="text-align:center;color:var(--text-soft);font-size:13px;margin-top:4px;">Released — retired</div>';
    } else {
      previewHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>';
    }
    
    var statusLabelLib = isPending ? 'Pending' : isBounded ? 'Bounded' : isRejected ? 'Rejected' : 'Released';

    // Inscription row — load async
    var inscHtml = '<div id="libModalInscription_' + artefactId + '"></div>';
    getInscription(artefactId).then(function(insc) {
      var el = document.getElementById('libModalInscription_' + artefactId);
      if (el && insc) el.innerHTML = '<div class="info-row"><span class="label">Inscription</span><span class="value" style="font-style:italic;color:var(--text-soft);">' + escapeHtml(insc) + '</span></div>';
    });

    // Offer message from local store (saved when offer was processed)
    var offerMsg = artData && artData.offerMessage ? artData.offerMessage : '';
    var offerMsgHtml = offerMsg ? '<div class="info-row"><span class="label">Message</span><span class="value" style="color:var(--accent);">' + escapeHtml(offerMsg) + '</span></div>' : '';
    var releaseMsg = artData && artData.releaseMessage ? artData.releaseMessage : '';
    var releaseMsgHtml = (isReleased && releaseMsg) ? '<div class="info-row"><span class="label">Release msg</span><span class="value" style="color:#f87171;font-style:italic;">' + escapeHtml(releaseMsg) + '</span></div>' : '';
    
    modal.innerHTML = '<div class="modal-overlay" onclick="Z1NArtefacts.closeModal()"></div>' +
      '<div class="modal-content"><button class="modal-close" onclick="Z1NArtefacts.closeModal()">×</button>' +
        '<h2>' + (isPending ? 'Incoming Offering' : isRejected ? 'Rejected Artefact' : 'Received Artefact') + '</h2><div class="modal-body">' +
          previewHtml +
          '<div class="modal-info">' +
            '<div class="info-row"><span class="label">From</span><span class="value">Key #' + sourceKeyId + '</span></div>' +
            '<div class="info-row"><span class="label">Status</span><span class="value">' + statusLabelLib + '</span></div>' +
            (glyphs ? '<div class="info-row"><span class="label">Glyphs</span><span class="value">' + glyphs + '</span></div>' : '') +
            offerMsgHtml +
            releaseMsgHtml +
            inscHtml +
          '</div>' +
          actionsHtml +
          '<div id="sharingStatus" class="status-area"></div>' +
        '</div></div>';
    
    modal.classList.add('active');
    updateBadge();
  }

  function closeModal() {
    var modal = document.getElementById('artefactSharingModal');
    if (modal) modal.classList.remove('active');
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  async function validateShareTarget() {
    var input = document.getElementById('shareTargetKeyId');
    var msg = document.getElementById('shareKeyValidation');
    if (!input || !msg) return;
    var targetKeyId = parseInt(input.value);
    var z = getZ1N();
    if (isNaN(targetKeyId) || targetKeyId < 0) { msg.textContent = ''; msg.className = 'validation-msg'; return; }
    if (targetKeyId === z.keyId) { msg.textContent = '✗ Cannot offer to yourself'; msg.className = 'validation-msg error'; return; }
    msg.textContent = 'Checking...'; msg.className = 'validation-msg pending';
    var exists = await keyExists(targetKeyId);
    if (exists) {
      var glyphs = await getKeyGlyphs(targetKeyId);
      msg.textContent = '✓ Key #' + targetKeyId + ' exists' + (glyphs ? ' (' + getShortGlyphs(targetKeyId) + ')' : '');
      msg.className = 'validation-msg success';
    } else {
      msg.textContent = '✗ Key #' + targetKeyId + ' does not exist'; msg.className = 'validation-msg error';
    }
  }

  // =====================================================================
  // CONTRACT WRITES
  // =====================================================================
  
  async function loadEthersLib() {
    if (typeof ethers !== 'undefined') return;
    await new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function offerArtefact(artefactId) {
    var input = document.getElementById('shareTargetKeyId');
    var statusEl = document.getElementById('sharingStatus');
    if (!input) return;
    var targetKeyId = parseInt(input.value);
    var z = getZ1N();
    if (isNaN(targetKeyId) || targetKeyId < 0) { if (statusEl) statusEl.innerHTML = '<div class="status-msg error">Enter a valid Key ID</div>'; return; }
    if (targetKeyId === z.keyId) { if (statusEl) statusEl.innerHTML = '<div class="status-msg error">Cannot offer to yourself</div>'; return; }
    var exists = await keyExists(targetKeyId);
    if (!exists) { if (statusEl) statusEl.innerHTML = '<div class="status-msg error">Key #' + targetKeyId + ' does not exist</div>'; return; }
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Preparing transaction...</div>';
    try {
      await loadEthersLib();
      var iface = new ethers.Interface(['function offer(uint256 artefactId, uint256 recipientKeyId, string message)']);
      var msgInput = document.getElementById('shareOfferMessage');
      var offerMsg = msgInput ? msgInput.value.trim().slice(0, 64) : '';
      var data = iface.encodeFunctionData('offer', [BigInt(artefactId), BigInt(targetKeyId), offerMsg]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✓ Artefact offered to Key #' + targetKeyId + '</div>';
        showToast('✅ Artefact offered!', 3000);
        // Store offer message locally for feed display
        if (offerMsg) offerMessages[artefactId] = offerMsg;
        addStateChangeNotification('offered', artefactId, z.keyId, targetKeyId, offerMsg);
        pendingViewChanges[artefactId] = 'offering'; closeModal(); lastOwnedSig = ''; renderOwnedSection();
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefact-viewing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
          delete pendingViewChanges[artefactId];
          lastOwnedSig = ''; renderOwnedSection();
        } catch (e) { console.error('Reindex failed:', e); }
      } else { throw new Error('Transaction failed'); }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function cancelOffering(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Preparing transaction...</div>';
    try {
      await loadEthersLib();
      var iface = new ethers.Interface(['function cancel(uint256 artefactId)']);
      var data = iface.encodeFunctionData('cancel', [BigInt(artefactId)]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('Offering cancelled', 3000);
        addStateChangeNotification('cancelled', artefactId, z.keyId, null, '');
        pendingViewChanges[artefactId] = 'cancelling'; closeModal(); lastOwnedSig = ''; renderOwnedSection();
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefact-viewing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
          delete pendingViewChanges[artefactId];
          lastOwnedSig = ''; renderOwnedSection();
        } catch (e) { console.error('Reindex failed:', e); }
      } else { throw new Error('Transaction failed'); }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function acceptOffering(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Preparing transaction...</div>';
    try {
      await loadEthersLib();
      var iface = new ethers.Interface(['function accept(uint256 artefactId)']);
      var data = iface.encodeFunctionData('accept', [BigInt(artefactId)]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('✅ Artefact accepted — now bounded', 3000);
        // Auto-mark the incoming offer as read — it's been handled
        markNotificationRead(artefactId);
        addStateChangeNotification('accepted', artefactId, z.keyId, null, '');
        pendingViewChanges[artefactId] = 'accepting'; closeModal(); lastSharedSig = ''; renderSharedSection();
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefact-viewing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
          delete pendingViewChanges[artefactId];
          lastSharedSig = ''; renderSharedSection();
        } catch (e) { console.error('Reindex failed:', e); }
      } else { throw new Error('Transaction failed'); }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function rejectOffering(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Preparing transaction...</div>';
    try {
      await loadEthersLib();
      // Contract: reject(uint256 artefactId) — no message parameter
      var iface = new ethers.Interface(['function reject(uint256 artefactId)']);
      var data = iface.encodeFunctionData('reject', [BigInt(artefactId)]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('Offering rejected', 3000);
        // Mark as rejected in local state for display
        var artData = sharedWithMe.find(function(a) { return a.tokenId === artefactId; });
        if (artData) artData.status = 'rejected';
        addStateChangeNotification('rejected', artefactId, z.keyId, null, '');
        pendingViewChanges[artefactId] = 'rejecting'; closeModal(); lastSharedSig = ''; renderSharedSection();
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefact-viewing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
          delete pendingViewChanges[artefactId];
          lastSharedSig = ''; renderSharedSection();
        } catch (e) { console.error('Reindex failed:', e); }
      } else { throw new Error('Transaction failed'); }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function ownerRelease(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    var releaseMsgInput = document.getElementById('releaseMessageInput');
    var releaseMsg = releaseMsgInput ? releaseMsgInput.value.trim().slice(0, 64) : '';
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Preparing release...</div>';
    try {
      await loadEthersLib();
      var iface = new ethers.Interface(['function release(uint256 artefactId, string message)']);
      var data = iface.encodeFunctionData('release', [BigInt(artefactId), releaseMsg]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('✅ Artefact released', 3000);
        addStateChangeNotification('released', artefactId, z.keyId, null, releaseMsg);
        pendingViewChanges[artefactId] = 'releasing'; closeModal(); lastOwnedSig = ''; renderOwnedSection();
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefact-viewing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
          delete pendingViewChanges[artefactId];
          lastOwnedSig = ''; renderOwnedSection();
        } catch (e) { console.error('Reindex failed:', e); }
      } else { throw new Error('Transaction failed'); }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function recipientRelease(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    var releaseMsgInput = document.getElementById('releaseMessageInput');
    var releaseMsg = releaseMsgInput ? releaseMsgInput.value.trim().slice(0, 64) : '';
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Preparing release...</div>';
    try {
      await loadEthersLib();
      var iface = new ethers.Interface(['function release(uint256 artefactId, string message)']);
      var data = iface.encodeFunctionData('release', [BigInt(artefactId), releaseMsg]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('✅ Artefact released', 3000);
        addStateChangeNotification('released', artefactId, z.keyId, null, releaseMsg);
        pendingViewChanges[artefactId] = 'releasing'; closeModal(); lastSharedSig = ''; renderSharedSection();
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefact-viewing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
          delete pendingViewChanges[artefactId];
          lastSharedSig = ''; renderSharedSection();
        } catch (e) { console.error('Reindex failed:', e); }
      } else { throw new Error('Transaction failed'); }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  // Stubs for removed functions
  async function revokeViewing(artefactId) {
    console.warn('revokeViewing() removed in v2.3.1-Ω');
    showToast('Revoke not available — use Release', 3000);
  }
  async function restoreViewing(artefactId) {
    console.warn('restoreViewing() removed in v2.3.1-Ω');
    showToast('Restore not available in v2.3.1-Ω', 3000);
  }
  async function hideArtefact(artefactId) { console.warn('hideArtefact() removed in v2.3.1-Ω'); }
  async function unhideArtefact(artefactId) { console.warn('unhideArtefact() removed in v2.3.1-Ω'); }

  async function waitForReceipt(txHash) {
    for (var i = 0; i < 60; i++) {
      await new Promise(function(r) { setTimeout(r, 2000); });
      try {
        var rc = await rpc('eth_getTransactionReceipt', [txHash]);
        if (rc && rc.status === '0x1') return true;
        if (rc && rc.status === '0x0') return false;
      } catch (e) {}
    }
    return false;
  }

  // =====================================================================
  // STATE CHANGE NOTIFICATIONS
  // =====================================================================

  // Log state changes for UNSEEN feed
  var stateChangeLog = [];

  function addStateChangeNotification(type, artefactId, keyId, targetKeyId, message) {
    stateChangeLog.push({ type: type, artefactId: artefactId, keyId: keyId, targetKeyId: targetKeyId, message: message, ts: Date.now() });
    // Trigger feed update
    setTimeout(updateBadgesAndFeed, 100);
  }

  // =====================================================================
  // MINT
  // =====================================================================
  
  var MINT_PRICE = '0x6124FEE993BC0000'; // 7 POL
  
  async function mint() {
    var z = getZ1N();
    if (!z.wallet || !z.provider || z.keyId === null) { showToast('Connect wallet first', 3000); return; }
    
    if (isMinting) { showToast('Already minting — please wait', 3000); return; }
    isMinting = true;

    var btn = document.getElementById('btnMintInSection');
    var statusEl = document.getElementById('mintArtefactStatus');
    var overviewBtn = document.getElementById('btnMintLiveArtefactOverview');
    
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing...'; }
    if (overviewBtn) { overviewBtn.disabled = true; overviewBtn.textContent = 'Minting...'; }
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Preparing transaction...</div>';

    try {
      await loadEthersLib();
      
      var hasFirstArtefact = ownedArtefacts.length > 0;
      var functionName = hasFirstArtefact ? 'mintExtra' : 'mint';
      var iface = new ethers.Interface([
        'function mint(uint256 keyId, string inscription)',
        'function mintExtra(uint256 keyId, string inscription) payable'
      ]);
      var inscInput = document.getElementById('mintInscriptionInput');
      var inscription = inscInput ? inscInput.value.trim().slice(0, 64) : '';
      var encodedData = iface.encodeFunctionData(functionName, [BigInt(z.keyId), inscription]);

      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      if (btn) btn.textContent = 'Confirm in wallet...';

      var txParams = { from: z.wallet, to: Z1N_ARTEFACT, data: encodedData };
      if (hasFirstArtefact) txParams.value = MINT_PRICE;

      var txHash = await z.provider.request({ method: 'eth_sendTransaction', params: [txParams] });

      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Transaction sent... waiting for confirmation</div>';
      if (btn) btn.textContent = 'Confirming...';

      var success = await waitForReceipt(txHash);

      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✅ Artefact minted! Waiting for indexer...</div>';
        showToast('✅ Artefact minted!', 4000);
        var inscClear = document.getElementById('mintInscriptionInput');
        if (inscClear) { inscClear.value = ''; }
        var inscCountClear = document.getElementById('mintInscriptionCount');
        if (inscCountClear) { inscCountClear.textContent = '0/64'; }
        
        pendingArtefacts.push({ id: Date.now(), type: 'mint', addedAt: Date.now() });
        lastOwnedSig = '';
        renderOwnedSection();
        updateOverviewPreview();
        
        if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
        
        var prevCount = ownedArtefacts.length;
        try {
          await fetch((getZ1N().API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/reindex/artefacts', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
          await refresh();
        } catch (e) { console.error('Reindex failed:', e); }
        
        if (ownedArtefacts.length > prevCount) {
          pendingArtefacts = pendingArtefacts.filter(function(p) { return p.type !== 'mint'; });
          isMinting = false;
          lastOwnedSig = '';
          renderOwnedSection();
          updateOverviewPreview();
          if (statusEl) statusEl.innerHTML = '';
          if (btn) { btn.disabled = false; btn.textContent = '+ Mint Artefact — 7 POL'; }
          if (overviewBtn) { overviewBtn.disabled = false; overviewBtn.textContent = '+ Mint Artefact — 7 POL'; }
        } else {
          var refreshAttempts = 0;
          var refreshTimer = setInterval(async function() {
            refreshAttempts++;
            await refresh();
            if (ownedArtefacts.length > prevCount || refreshAttempts >= 8) {
              clearInterval(refreshTimer);
              pendingArtefacts = pendingArtefacts.filter(function(p) { return p.type !== 'mint'; });
              isMinting = false;
              lastOwnedSig = '';
              renderOwnedSection();
              updateOverviewPreview();
              if (statusEl) statusEl.innerHTML = '';
              if (btn) { btn.disabled = false; btn.textContent = '+ Mint Artefact — 7 POL'; }
              if (overviewBtn) { overviewBtn.disabled = false; overviewBtn.textContent = '+ Mint Artefact — 7 POL'; }
            }
          }, 10000);
        }
      } else {
        throw new Error('Transaction failed on-chain');
      }

    } catch (e) {
      isMinting = false;
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || msg.includes('User denied') || e.code === 4001) {
        msg = 'Transaction rejected';
      } else if (msg.includes('Internal JSON-RPC') || e.code === -32603 || msg.includes('execution reverted')) {
        msg = 'Transaction failed - check wallet ownership';
      } else if (msg.includes('insufficient')) {
        msg = 'Insufficient funds for gas';
      } else {
        msg = msg.slice(0, 150);
      }
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg + '</div>';
      if (btn) { btn.textContent = ownedArtefacts.length > 0 ? '+ Mint Artefact — 7 POL' : '+ Mint Free Artefact'; btn.disabled = false; }
      if (overviewBtn) { overviewBtn.disabled = false; overviewBtn.textContent = ownedArtefacts.length > 0 ? '+ Mint Artefact — 7 POL' : '+ Mint Free Artefact'; }
    }
  }

  // =====================================================================
  // FILTERS
  // =====================================================================
  
  function filterOwned() {
    var searchInput = document.getElementById('ownedSearchInput');
    ownedFilter.search = searchInput ? searchInput.value.trim() : '';
    lastOwnedSig = '';
    renderOwnedSection();
  }
  
  function setOwnedFilter(status) {
    ownedFilter.status = status;
    lastOwnedSig = '';
    renderOwnedSection();
  }
  
  function setViewMode(mode) {
    ownedViewMode = mode;
    lastOwnedSig = '';
    renderOwnedSection();
  }

  function setLibraryViewMode(mode) {
    libraryViewMode = mode;
    lastSharedSig = '';
    renderSharedSection();
  }

  function filterLibrary() {
    var searchInput = document.getElementById('librarySearchInput');
    libraryFilter.search = searchInput ? searchInput.value.trim() : '';
    lastSharedSig = '';
    renderSharedSection();
  }
  
  function setLibraryFilter(status) {
    libraryFilter.status = status;
    lastSharedSig = '';
    renderSharedSection();
  }

  function toggleHideReleased(scope) {
    if (scope === 'library') {
      libraryFilter.hideReleased = !libraryFilter.hideReleased;
      lastSharedSig = '';
      renderSharedSection();
    } else {
      ownedFilter.hideReleased = !ownedFilter.hideReleased;
      lastOwnedSig = '';
      renderOwnedSection();
    }
  }

  function toggleHideRejected() {
    libraryFilter.hideRejected = !libraryFilter.hideRejected;
    lastSharedSig = '';
    renderSharedSection();
  }

  // =====================================================================
  // INIT & REFRESH
  // =====================================================================
  
  async function init() {
    var z = getZ1N();
    
    if (!z.keyId && z.keyId !== 0) {
      setTimeout(init, 1000);
      return;
    }
    
    console.log('Z1NArtefacts v2.3.1-Ω UX patch: Initializing for Key #' + z.keyId);
    
    isLoadingOwned = true;
    isLoadingShared = true;
    renderOwnedSection();
    renderSharedSection();
    updateOverviewPreview();
    
    await refresh();
  }

  async function refresh() {
    var ownedPromise = loadOwnedArtefacts().then(function() {
      isLoadingOwned = false;
      lastOwnedSig = '';
      renderOwnedSection();
      updateOverviewPreview();
    }).catch(function(e) {
      console.error('loadOwnedArtefacts failed:', e);
      isLoadingOwned = false;
      renderOwnedSection();
    });
    
    var sharedPromise = loadSharedWithMe().then(function() {
      isLoadingShared = false;
      lastSharedSig = '';
      renderSharedSection();
    }).catch(function(e) {
      console.error('loadSharedWithMe failed:', e);
      isLoadingShared = false;
      renderSharedSection();
    });
    
    await Promise.all([ownedPromise, sharedPromise]);
    
    if (isLoadingOwned) { isLoadingOwned = false; lastOwnedSig = ''; renderOwnedSection(); }
    if (isLoadingShared) { isLoadingShared = false; lastSharedSig = ''; renderSharedSection(); }
    
    updateBadgesAndFeed();
  }

  // =====================================================================
  // BADGE
  // =====================================================================

  var _lastBadgeUnread = 0;

  function updateBadge() {
    var unreadCount = getUnreadNotificationCount();
    applyBadge(unreadCount);
  }
  
  function applyBadge(unreadCount) {
    _lastBadgeUnread = unreadCount;

    // Tab nav badge — the Artefacts tab
    var tabBadge = document.getElementById('artefactTabBadge');
    // Also try the nav badge pattern used in key-dashboard
    var navBadges = document.querySelectorAll('[data-tab="artefacts"] .tab-badge, [data-tab="artefacts"] .badge, #tabArtefacts .badge, #tabArtefacts .tab-badge');

    var badgeText = unreadCount > 0 ? String(unreadCount) : (ownedArtefacts.length > 0 ? String(ownedArtefacts.length) : '');
    var badgeStyle = unreadCount > 0 ? 'background:rgba(94,232,160,0.5);color:#fff;' : '';

    // artefactBadge — overview panel badge
    var badge = document.getElementById('artefactBadge');
    if (badge) {
      badge.textContent = badgeText;
      badge.style.cssText = badgeStyle;
    }

    // Tab nav badge — zoek de tab-btn voor artefacts en update/create .tab-badge
    var artefactsTabBtn = document.querySelector('.tab-btn[onclick*="artefacts"]');
    if (artefactsTabBtn) {
      var existingTabNavBadge = artefactsTabBtn.querySelector('.tab-badge');
      if (unreadCount > 0) {
        if (!existingTabNavBadge) {
          var newNavBadge = document.createElement('span');
          newNavBadge.className = 'tab-badge';
          newNavBadge.textContent = String(unreadCount);
          artefactsTabBtn.appendChild(newNavBadge);
        } else {
          existingTabNavBadge.textContent = String(unreadCount);
          existingTabNavBadge.classList.remove('hidden');
        }
      } else if (existingTabNavBadge) {
        existingTabNavBadge.style.display = 'none';
        existingTabNavBadge.classList.add('hidden');
      }
    }
    if (tabBadge) {
      tabBadge.textContent = unreadCount > 0 ? String(unreadCount) : '';
      tabBadge.style.cssText = unreadCount > 0 ? 'background:rgba(94,232,160,0.5);color:#fff;display:inline-block;' : 'display:none;';
    }

    navBadges.forEach(function(b) {
      b.textContent = unreadCount > 0 ? String(unreadCount) : (ownedArtefacts.length > 0 ? String(ownedArtefacts.length) : '');
      b.style.cssText = unreadCount > 0 ? 'background:rgba(94,232,160,0.5);color:#fff;' : '';
    });
  }
  
  function watchBadge() {
    var badge = document.getElementById('artefactBadge');
    if (!badge) {
      setTimeout(watchBadge, 1000);
      return;
    }
    var observer = new MutationObserver(function() {
      if (_lastBadgeUnread > 0 && badge.textContent !== String(_lastBadgeUnread)) {
        badge.textContent = String(_lastBadgeUnread);
        badge.style.cssText = 'background:rgba(94,232,160,0.5); color:#fff;';
      }
    });
    observer.observe(badge, { childList: true, characterData: true, subtree: true });
  }
  watchBadge();

  function updateBadgesAndFeed() {
    var unreadCount = getUnreadCount();
    applyBadge(unreadCount);
    
    var feed = document.getElementById('activityFeed');
    if (feed) {
      feed.querySelectorAll('.activity-item.artefact-notif').forEach(function(el) { el.remove(); });
      
      if (unreadCount > 0) {
        var z = getZ1N();

        // Unified notifications feed — one loop, one system
        Object.values(notifications).forEach(function(n) {
          if (n.seen) return;
          var msg = '';
          var color = 'var(--accent)';

          if (n.type === 'offering_accepted') {
            msg = '<strong style="color:var(--accent);">K#' + n.byKeyId + '</strong> accepted your artefact offer';
            color = 'var(--accent)';
          } else if (n.type === 'offering_rejected') {
            msg = '<strong style="color:#f87171;">K#' + n.byKeyId + '</strong> rejected your artefact offer';
            color = '#f87171';
          } else if (n.type === 'artefact_released') {
            var z2 = getZ1N();
            var releasedByMe = n.byKeyId === z2.keyId;
            var who = releasedByMe ? 'You released' : 'K#' + n.byKeyId + ' released';
            msg = '<strong style="color:#f87171;">' + who + '</strong> artefact #' + n.artefactId +
              (n.message ? ' <span style="font-style:italic;color:rgba(248,113,113,0.7);">"' + escapeHtml(n.message.slice(0,40)) + '"</span>' : '');
            color = '#f87171';
          } else if (n.type === 'offering_received') {
            var offerMsg = n.message || '';
            msg = '<strong style="color:var(--accent);">K#' + n.byKeyId + '</strong> offered an artefact to you' +
              (offerMsg ? ' <span style="font-style:italic;color:rgba(94,232,160,0.8);">"' + escapeHtml(offerMsg.slice(0,40)) + '"</span>' : '');
            color = 'var(--accent)';
          }

          if (!msg) return;
          var item = document.createElement('div');
          item.className = 'activity-item unread artefact-notif';
          item.style.cursor = 'pointer';
          item.style.borderLeft = '3px solid ' + color;
          item.onclick = function() { if (typeof switchTab === 'function') switchTab('artefacts'); };
          item.innerHTML = '<div class="activity-icon artefact">◈</div>' +
            '<div class="activity-content">' +
              '<div class="activity-title" style="color:' + color + ';">' + msg + '</div>' +
            '</div>';
          if (feed.firstChild) feed.insertBefore(item, feed.firstChild);
          else feed.appendChild(item);
        });

        // Local state changes (own actions this session — offered/accepted/cancelled only)
        stateChangeLog.forEach(function(entry) {
          if (entry.type === 'released') return;
          var color = (entry.type === 'cancelled' || entry.type === 'rejected') ? '#f87171' : 'var(--accent)';
          var actionText = entry.type === 'offered' ? 'You offered artefact #' + entry.artefactId + ' to K#' + entry.targetKeyId :
                           entry.type === 'cancelled' ? 'You cancelled offering of artefact #' + entry.artefactId :
                           entry.type === 'accepted' ? 'You accepted artefact #' + entry.artefactId :
                           entry.type === 'rejected' ? 'You rejected artefact #' + entry.artefactId : '';
          if (!actionText) return;
          var item = document.createElement('div');
          item.className = 'activity-item artefact-notif';
          item.style.borderLeft = '3px solid ' + color;
          item.innerHTML = '<div class="activity-icon artefact">◈</div>' +
            '<div class="activity-content"><div class="activity-title" style="color:' + color + ';">' + actionText + '</div></div>';
          if (feed.firstChild) feed.insertBefore(item, feed.firstChild);
          else feed.appendChild(item);
        });
      }
      
      var badgeArtefacts = document.getElementById('badgeArtefacts');
      if (badgeArtefacts) {
        badgeArtefacts.textContent = unreadCount;
        if (unreadCount > 0) {
          badgeArtefacts.classList.add('has-items');
        } else {
          badgeArtefacts.classList.remove('has-items');
        }
      }
    }
  }

  // =====================================================================
  // EXPORT
  // =====================================================================
  
  window.Z1NArtefacts = {
    init: init,
    refresh: refresh,
    getUnseenCount: function() { return getUnreadNotificationCount() + getInitiatorUnreadCount(); },
    mint: mint,
    filterOwned: filterOwned,
    setOwnedFilter: setOwnedFilter,
    setLibraryViewMode: setLibraryViewMode,
    setViewMode: setViewMode,
    filterLibrary: filterLibrary,
    setLibraryFilter: setLibraryFilter,
    openOwnedModal: openOwnedModal,
    openLibraryModal: openLibraryModal,
    closeModal: closeModal,
    offerArtefact: offerArtefact,
    cancelOffering: cancelOffering,
    acceptOffering: acceptOffering,
    rejectOffering: rejectOffering,
    revokeViewing: revokeViewing,
    restoreViewing: restoreViewing,
    ownerRelease: ownerRelease,
    recipientRelease: recipientRelease,
    updateOverviewPreview: updateOverviewPreview,
    updateBadgesAndFeed: updateBadgesAndFeed,
    toggleHideReleased: toggleHideReleased,
    toggleHideRejected: toggleHideRejected
  };

  // Re-inject feed items on overview tab switch
  var _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === 'function') {
    window.switchTab = function(tab) {
      _origSwitchTab(tab);
      if (tab === 'overview') setTimeout(updateBadgesAndFeed, 300);
    };
  } else {
    var _patchInterval = setInterval(function() {
      if (typeof window.switchTab === 'function' && !window._z1nArtefactPatched) {
        window._z1nArtefactPatched = true;
        var orig = window.switchTab;
        window.switchTab = function(tab) {
          orig(tab);
          if (tab === 'overview') setTimeout(updateBadgesAndFeed, 300);
        };
        clearInterval(_patchInterval);
      }
    }, 500);
    setTimeout(function() { clearInterval(_patchInterval); }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
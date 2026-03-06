/**
 * Z1N Protocol - Key Dashboard Artefacts Module
 * Version: 2.3.1-Ω
 *
 * CHANGES v2.3.1-Ω:
 * - Contract function names updated (offer/cancel/accept/reject/release)
 * - revokeViewing/restoreViewing removed — no REVOKED state
 * - ownerRelease/recipientRelease → both call release(artefactId, message)
 * - mintFirstArtefact/mintExtraArtefact → mint()/mintExtra() — no contentHash/schema
 * - Status: 'revoked' state removed, 'released' is terminal (stateNum 3)
 * - offer() requires message param; release() requires message param
 *
 * Handles:
 * - Your Artefacts (owned) with offer/cancel/release
 * - Received Artefacts (library) with accept/reject/release
 * - Share Modal with permanent binding warning
 * - Search/filter when >5 items
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
      '/* Loading skeleton for artefact sections */',
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
      '',
      '/* Skeleton cards that pulse while loading */',
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
      '',
      '/* Pending mint card */',
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
      '',
      '/* Pending view change overlay */',
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
      '',
      '/* Overview artefact loading */',
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
      '',
      '/* Shared/Viewed-by artefact cards: no special border */',
      '.artefact-card.status-viewedby,',
      '.artefact-card.status-viewedby:hover,',
      '.artefact-list-card.status-viewedby {',
      '  border-color: var(--card-border, rgba(148,163,184,0.25)) !important;',
      '}',
      '',
      '/* Received artefact cards: no special border */',
      '.artefact-card.status-received,',
      '.artefact-card.status-received:hover {',
      '  border-color: var(--card-border, rgba(148,163,184,0.25)) !important;',
      '}',
      '',
      '/* v2.3.1: Unseen notification: green glow border */',
      '.artefact-card.unseen-artefact {',
      '  border-color: rgba(94,232,160,0.7) !important;',
      '  box-shadow: 0 0 8px rgba(94,232,160,0.3);',
      '}',
      '.artefact-card.unseen-artefact::after {',
      '  content: "NEW"; position: absolute; top: 6px; right: 6px;',
      '  font-size: 8px; font-weight: 700; letter-spacing: 0.05em;',
      '  color: #000; background: var(--accent, #5ee8a0);',
      '  padding: 2px 6px; border-radius: 4px;',
      '}',
      '',
      '/* Pending/Offered status */',
      '.artefact-card.status-pending,',
      '.artefact-card.status-pending:hover {',
      '  border-color: rgba(255,213,86,0.4) !important;',
      '}',
      '.info-status.status-pending { color: #ffd556; }',
      '',
      '/* Released/Retired status */',
      '.artefact-card.status-released {',
      '  opacity: 0.45; border-color: rgba(143,154,181,0.15) !important;',
      '}',
      '.info-status.status-released { color: var(--text-soft, #9aa3bb); }'
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  // =====================================================================
  // CONSTANTS
  // =====================================================================
  
  var Z1N_ARTEFACT = '0x405344149f95c1264AC6BA1d646D95e17957EB45';
  var Z1N_KEY = '0x31C5e078ad2CdB0FEAB703ED416DC9e90997b26C';
  
  var RPC_URLS = ['https://polygon-mainnet.g.alchemy.com/v2/P7YcT2oy0Mfad2Pedbe3y'];
  var currentRpcIndex = 0;
  
  var SELECTORS = {
    sourceKeyOf: '0x4e3ee7a9',
    boundToKeyId: '0x8e7c8e36',
    stateOf: '0xfc4e86b7',   // v2.3.1-Ω: replaces viewingActive — keccak256("stateOf(uint256)")
    canView: '0x79d62d11',
    getLibrary: '0x9f8a13d7',
    ownerOf: '0x6352211e',
    exists: '0x4f558e79',
    glyphs: '0x887296c3'
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
  var ownedViewMode = 'card';
  var libraryViewMode = 'card';
  var pendingArtefacts = [];
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
  
  function showToast(msg, dur) {
    var z = getZ1N();
    if (z.showToast) {
      z.showToast(msg, dur);
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
    return s.join(' \u00b7 ');
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
    return full.split(' \u00b7 ').slice(0, 3).join('\u00b7');
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

  // =====================================================================
  // DATA LOADING
  // =====================================================================
  
  async function loadOwnedArtefacts() {
    var z = getZ1N();
    var keyId = z.keyId;
    if (keyId === null || keyId === undefined) return;
    
    ownedArtefacts = [];
    
    try {
      var apiBase = z.API_BASE || 'https://z1n-backend-production.up.railway.app/api';
      var response = await fetch(apiBase + '/key/' + keyId + '/artefacts', { cache: 'no-store' });
      
      if (!response.ok) return;
      
      var data = await response.json();
      var liveArtefacts = data.liveArtefacts || [];
      
      for (var i = 0; i < liveArtefacts.length; i++) {
        var art = liveArtefacts[i];
        art.sourceKeyId = art.sourceKeyId || keyId;
        art.boundToKeyId = art.boundToKeyId || 0;
        art.viewingActive = art.viewingActive || false;
        art.status = art.status || 'in_my_view';
        
        if (art.boundToKeyId > 0) {
          await getKeyGlyphs(art.boundToKeyId);
        }
        
        ownedArtefacts.push(art);
      }
    } catch (e) {
      console.error('loadOwnedArtefacts error:', e);
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
      console.log('loadSharedWithMe: /library response status:', response.status);
      var data;
      
      if (response.ok) {
        data = await response.json();
        sharedWithMe = data.library || [];
        console.log('loadSharedWithMe: got ' + sharedWithMe.length + ' items from /library');
      } else {
        console.log('loadSharedWithMe: /library failed, trying /artefacts fallback');
        response = await fetch(apiBase + '/key/' + keyId + '/artefacts', { cache: 'no-store' });
        if (response.ok) {
          data = await response.json();
          sharedWithMe = data.library || [];
          console.log('loadSharedWithMe: got ' + sharedWithMe.length + ' items from /artefacts fallback');
        }
      }
      
      for (var i = 0; i < sharedWithMe.length; i++) {
        var art = sharedWithMe[i];
        if (art.sourceKeyId) {
          await getKeyGlyphs(art.sourceKeyId);
          art.sourceGlyphs = art.sourceGlyphs || getShortGlyphs(art.sourceKeyId);
        }
      }
      
      // v2.3.1: Detect unseen artefacts by comparing with localStorage
      detectUnseenArtefacts(sharedWithMe);
    } catch (e) {
      console.error('loadSharedWithMe error:', e);
    }
    
    isLoadingShared = false;
    lastSharedSig = '';
    renderSharedSection();
  }

  // =====================================================================
  // v2.3.1: UNSEEN TRACKING — localStorage-based
  // =====================================================================

  var unseenArtefactIds = {};

  function getSeenKey() {
    var z = getZ1N();
    return 'z1n_seen_library_' + (z.keyId || 0);
  }

  function loadSeenState() {
    try {
      var raw = localStorage.getItem(getSeenKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveSeenState(state) {
    try { localStorage.setItem(getSeenKey(), JSON.stringify(state)); } catch (e) {}
  }

  function detectUnseenArtefacts(libraryItems) {
    var seen = loadSeenState();
    unseenArtefactIds = {};
    libraryItems.forEach(function(art) {
      var id = art.tokenId;
      // v2.3.1-Ω: stateNum 2=ACTIVE 3=RELEASED
      var currentSig = art.sourceKeyId + ':' + (art.stateNum === 2 ? 'active' : 'other');
      if (!seen[id]) {
        unseenArtefactIds[id] = 'new';
      } else if (seen[id] !== currentSig) {
        unseenArtefactIds[id] = 'changed';
      }
    });
    return Object.keys(unseenArtefactIds).length;
  }

  function hasUnreadNotification(artefactId) {
    return !!unseenArtefactIds[artefactId];
  }

  function markNotificationRead(artefactId) {
    var art = sharedWithMe.find(function(a) { return a.tokenId === artefactId; });
    if (!art) return;
    delete unseenArtefactIds[artefactId];
    var seen = loadSeenState();
    seen[artefactId] = art.sourceKeyId + ':' + (art.viewingActive ? 'active' : 'revoked');
    saveSeenState(seen);
  }

  function getUnreadNotificationCount() {
    return Object.keys(unseenArtefactIds).length;
  }

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
    var previewUrl = apiBase + '/artefact/' + z.keyId + '/static-preview?epoch=' + (z.epoch || 0) + '&t=' + Date.now();
    
    if (previewImg) {
      previewImg.onerror = function() {
        this.style.display = 'none';
        if (placeholder) {
          if (ownedArtefacts.length === 0) {
            placeholder.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;"><span style="font-size:48px;color:rgba(94,232,160,0.2);">\u25C8</span><span style="font-size:10px;color:var(--text-soft);">No artefact yet</span></div>';
          } else {
            placeholder.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;"><span style="font-size:48px;color:rgba(94,232,160,0.2);">\u25C8</span><span style="font-size:10px;color:var(--text-soft);">Preview unavailable</span></div>';
          }
          placeholder.style.display = 'flex';
        }
        if (statusEl) {
          statusEl.textContent = ownedArtefacts.length > 0 ? ownedArtefacts.length + ' artefact(s)' : 'No live artefact';
          statusEl.className = 'artefact-preview-status' + (ownedArtefacts.length === 0 ? ' no-artefact' : '');
        }
        if (mintBtn) {
          mintBtn.disabled = false;
          mintBtn.textContent = ownedArtefacts.length > 0 ? '+ Mint Artefact \u2014 7 POL' : '+ Mint Free Artefact';
        }
      };
      
      previewImg.onload = function() {
        this.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (statusEl) {
          var activeCount = ownedArtefacts.filter(function(a) { return a.status !== 'revoked'; }).length;
          statusEl.textContent = activeCount > 0 ? activeCount + ' active artefact(s)' : 'No active artefacts';
          statusEl.className = 'artefact-preview-status';
        }
        if (mintBtn) {
          mintBtn.disabled = false;
          mintBtn.textContent = '+ Mint Artefact \u2014 7 POL';
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
    
    var sig = ownedArtefacts.map(function(a) { return a.tokenId + ':' + a.status; }).join(',') + '|' + pendingArtefacts.length + '|' + JSON.stringify(pendingViewChanges);
    if (sig === lastOwnedSig && container.innerHTML !== '') { return; }
    lastOwnedSig = sig;
    
    var z = getZ1N();
    var filtered = ownedArtefacts.filter(function(art) {
      if (ownedFilter.status !== 'all' && art.status !== ownedFilter.status) return false;
      if (ownedFilter.search && !String(art.tokenId).includes(ownedFilter.search)) return false;
      return true;
    });
    
    var showFilters = ownedArtefacts.length > 5;
    var hasFreeArtefact = ownedArtefacts.length > 0;
    var mintText = isMinting ? 'Minting...' : (hasFreeArtefact ? '+ Mint Artefact \u2014 7 POL' : '+ Mint Free Artefact');
    
    var countInView = ownedArtefacts.filter(function(a) { return a.status === 'in_my_view'; }).length;
    var countPending = ownedArtefacts.filter(function(a) { return a.status === 'pending'; }).length;
    var countShared = ownedArtefacts.filter(function(a) { return a.status === 'shared'; }).length;
    // v2.3.1-Ω: no REVOKED state
    var countReleased = ownedArtefacts.filter(function(a) { return a.status === 'released'; }).length;
    
    var html = '<div class="artefact-section-header">' +
      '<h3 class="section-title title-green">Your Artefacts <span class="count" style="color:var(--accent);">(' + ownedArtefacts.length + ')</span></h3>' +
      '<div class="header-actions" style="display:flex;align-items:center;gap:8px;">' +
        '<button class="view-toggle' + (ownedViewMode === 'card' ? ' active' : '') + '" onclick="Z1NArtefacts.setViewMode(\'card\')" title="Card view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">\u25A6</button>' +
        '<button class="view-toggle' + (ownedViewMode === 'list' ? ' active' : '') + '" onclick="Z1NArtefacts.setViewMode(\'list\')" title="List view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">\u2630</button>' +
        '<button class="btn btn-green" id="btnMintInSection" onclick="Z1NArtefacts.mint()"' + (isMinting ? ' disabled' : '') + ' style="height:32px;display:flex;align-items:center;">' + mintText + '</button>' +
      '</div>' +
    '</div>';
    
    html += '<div id="mintArtefactStatus" style="margin-bottom: 12px;"></div>';
    
    html += '<div id="mintInscriptionRow" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
      '<label style="font-size:12px;color:var(--text-soft);white-space:nowrap;">Inscription</label>' +
      '<input type="text" id="mintInscriptionInput" maxlength="64" placeholder="Optional \u2014 max 64 characters" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text-main);font-family:inherit;">' +
      '<span id="mintInscriptionCount" style="font-size:10px;color:var(--text-soft);min-width:32px;text-align:right;">0/64</span>' +
    '</div>';
    
    if (showFilters) {
      html += '<div class="artefact-filter-bar">' +
        '<div class="filter-pills">' +
          '<button class="filter-pill' + (ownedFilter.status === 'all' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'all\')">All <span class="pill-count">' + ownedArtefacts.length + '</span></button>' +
          '<button class="filter-pill' + (ownedFilter.status === 'in_my_view' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'in_my_view\')">Personal <span class="pill-count">' + countInView + '</span></button>' +
          (countPending > 0 ? '<button class="filter-pill' + (ownedFilter.status === 'pending' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'pending\')">Offered <span class="pill-count">' + countPending + '</span></button>' : '') +
          '<button class="filter-pill' + (ownedFilter.status === 'shared' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'shared\')">Active <span class="pill-count">' + countShared + '</span></button>' +
          // v2.3.1-Ω: no Revoked filter pill
          (countReleased > 0 ? '<button class="filter-pill' + (ownedFilter.status === 'released' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'released\')">Released <span class="pill-count">' + countReleased + '</span></button>' : '') +
        '</div>' +
        '<input type="text" class="filter-search" id="ownedSearchInput" placeholder="Search ID..." value="' + (ownedFilter.search || '') + '" onkeyup="Z1NArtefacts.filterOwned()">' +
      '</div>';
    }
    
    if (ownedArtefacts.length === 0 && pendingArtefacts.length === 0) {
      html += '<div class="artefact-empty">' +
        '<div class="empty-icon">\u25C8</div>' +
        '<p>No live artefacts yet</p>' +
        '<p class="empty-hint">Mint your first artefact \u2014 it\'s free!</p>' +
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
      // v2.3.1-Ω: no REVOKED state
      var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                        art.status === 'pending' ? 'status-pending' :
                        art.status === 'shared' ? 'status-viewedby' :
                        art.status === 'released' ? 'status-released' : '';
      var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                        art.status === 'pending' ? 'Offered' :
                        art.status === 'shared' ? 'Active' :
                        art.status === 'released' ? 'Released' : art.status;
      
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
        '/static-preview?epoch=' + (z.epoch || 0);
      if (art.status !== 'in_my_view') {
        previewUrl += '&viewerKeyId=' + z.keyId + '&artefactTokenId=' + art.tokenId;
      }
      
      var hasPending = pendingViewChanges[art.tokenId];
      var pendingLabel = hasPending === 'offering' ? 'Offering...' : hasPending === 'cancelling' ? 'Cancelling...' : hasPending === 'accepting' ? 'Accepting...' : hasPending === 'rejecting' ? 'Rejecting...' : hasPending === 'releasing' ? 'Releasing...' : '';
      
      html += '<div class="artefact-card ' + statusClass + '"' + (hasPending ? ' style="position:relative;pointer-events:none;opacity:0.6;"' : '') + ' onclick="Z1NArtefacts.openOwnedModal(' + art.tokenId + ')">';
      
      if (hasPending) {
        html += '<div class="pending-change-overlay"><div class="pending-change-spinner"></div><span style="color:var(--accent);font-size:11px;">' + pendingLabel + '</span></div>';
      }
      
      html += '<div class="artefact-preview">';
      if (art.status === 'in_my_view') {
        html += artImg(previewUrl, 'Artefact #' + artefactIndex);
      } else if (art.status === 'released') {
        html += '<div class="artefact-placeholder shared" style="color:var(--text-soft);opacity:0.4;">\u25C8</div>';
      } else {
        html += '<div class="artefact-placeholder shared" style="color:var(--accent);">\u25C8</div>';
      }
      html += '</div>';
      
      html += '<div class="artefact-info-row">' +
        '<span class="info-id">#' + artefactIndex + '</span>' +
        '<span class="info-status ' + statusClass + '">' + statusLabel + '</span>' +
        (art.boundToKeyId > 0 ? '<span class="info-bound">\u2192 #' + art.boundToKeyId + '</span>' : '') +
      '</div>';
      html += '</div>';
    });
    
    html += '</div>';
    return html;
  }

  function renderListView(filtered, z) {
    var html = '<div class="artefact-list-grid">';
    filtered.forEach(function(art) {
      var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === art.tokenId; }) + 1;
      // v2.3.1-Ω: no REVOKED state
      var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                        art.status === 'pending' ? 'status-pending' :
                        art.status === 'shared' ? 'status-viewedby' :
                        art.status === 'released' ? 'status-released' : '';
      var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                        art.status === 'pending' ? 'Offered' :
                        art.status === 'shared' ? 'Active' :
                        art.status === 'released' ? 'Released' : art.status;
      
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
        '/static-preview?epoch=' + (z.epoch || 0);
      if (art.status !== 'in_my_view') {
        previewUrl += '&viewerKeyId=' + z.keyId + '&artefactTokenId=' + art.tokenId;
      }
      
      html += '<div class="artefact-list-card ' + statusClass + '" onclick="Z1NArtefacts.openOwnedModal(' + art.tokenId + ')">' +
        '<div class="list-card-preview">' +
          (art.status === 'in_my_view' ? artImg(previewUrl, 'Artefact #' + artefactIndex) : '<div class="list-placeholder shared" style="color:' + (art.status === 'released' ? 'var(--text-soft)' : 'var(--accent)') + ';opacity:' + (art.status === 'released' ? '0.4' : '1') + ';">\u25C8</div>') +
        '</div>' +
        '<div class="list-card-meta">' +
          '<div class="list-card-id">#' + artefactIndex + '</div>' +
          '<div class="artefact-status ' + statusClass + '">' + statusLabel + '</div>' +
          (art.boundToKeyId > 0 ? '<div class="list-card-bound">\u2192 Key #' + art.boundToKeyId + '</div>' : '') +
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
    
    var sig = sharedWithMe.map(function(a) { return a.tokenId + ':' + a.status + ':' + a.viewingActive; }).join(',');
    if (sig === lastSharedSig && container.innerHTML !== '') { return; }
    lastSharedSig = sig;
    
    var z = getZ1N();
    var filtered = sharedWithMe.filter(function(art) {
      if (libraryFilter.status !== 'all' && art.status !== libraryFilter.status) return false;
      if (libraryFilter.search && !String(art.sourceKeyId).includes(libraryFilter.search)) return false;
      return true;
    });
    
    var showFilters = sharedWithMe.length > 5;
    var parentCard = container.closest('.section-card');
    if (parentCard) parentCard.style.display = 'block';
    
    // v2.3.1-Ω: no REVOKED state; released is terminal
    var countActive = sharedWithMe.filter(function(a) { return a.status === 'active' || a.stateNum === 2; }).length;
    var countReleased = sharedWithMe.filter(function(a) { return a.status === 'released' || a.stateNum === 3; }).length;
    
    var html = '<div class="artefact-section-header">' +
  '<h3 class="section-title title-green">Received Artefacts <span class="count" style="color:var(--accent);">(' + sharedWithMe.length + ')</span></h3>' +
  '<div class="header-actions">' +
    '<button class="view-toggle' + (libraryViewMode === 'card' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryViewMode(\'card\')" title="Card view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">\u25E6</button>' +
    '<button class="view-toggle' + (libraryViewMode === 'list' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryViewMode(\'list\')" title="List view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">\u2630</button>' +
  '</div>' +
'</div>';
    
    if (showFilters) {
      html += '<div class="artefact-filter-bar">' +
        '<div class="filter-pills">' +
          '<button class="filter-pill' + (libraryFilter.status === 'all' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'all\')">All <span class="pill-count">' + sharedWithMe.length + '</span></button>' +
          '<button class="filter-pill' + (libraryFilter.status === 'active' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'active\')">Received <span class="pill-count">' + countActive + '</span></button>' +
          (countReleased > 0 ? '<button class="filter-pill' + (libraryFilter.status === 'released' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'released\')">Released <span class="pill-count">' + countReleased + '</span></button>' : '') +
        '</div>' +
        '<input type="text" class="filter-search" id="librarySearchInput" placeholder="Search Key ID..." value="' + (libraryFilter.search || '') + '" onkeyup="Z1NArtefacts.filterLibrary()">' +
      '</div>';
    }
    
    if (sharedWithMe.length === 0) {
      html += '<div class="artefact-empty">' +
        '<div class="empty-icon">\u25C8\u2190</div>' +
        '<p>No artefacts received yet</p>' +
        '<p class="empty-hint">When another Key offers an artefact to you, it appears here.</p>' +
      '</div>';
    } else if (filtered.length === 0) {
      html += '<div class="artefact-empty">No artefacts match your filters</div>';
    } else if (libraryViewMode === 'list') {
    html += '<div class="artefact-list-grid">';
    filtered.forEach(function(art) {
      var isPending = art.status === 'pending';
      var isRevoked = !isPending && (art.status === 'revoked' || !art.viewingActive);
      var statusClass = isPending ? 'status-pending' : isRevoked ? 'status-revoked' : 'status-received';
      var statusLabel = isPending ? 'Pending' : isRevoked ? 'Revoked' : 'Received';
      var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId +
        '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId +
        '&artefactTokenId=' + art.tokenId;
      var hasNotif = hasUnreadNotification(art.tokenId);
      html += '<div class="artefact-list-card ' + statusClass + (hasNotif ? ' unseen-artefact' : '') + '" onclick="Z1NArtefacts.openLibraryModal(' + art.tokenId + ', ' + art.sourceKeyId + ')">' +
        '<div class="list-card-preview">' +
          (isPending ? '<div class="list-placeholder shared" style="color:#ffd556;">\u25C8</div>' : isRevoked ? '<div class="list-placeholder shared" style="color:#f87171;">\u25C8</div>' : artImg(previewUrl, 'From Key #' + art.sourceKeyId)) +
        '</div>' +
        '<div class="list-card-meta">' +
          '<div class="list-card-id">From #' + art.sourceKeyId + '</div>' +
          '<div class="artefact-status ' + statusClass + '">' + statusLabel + '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  } else {
      html += '<div class="artefact-grid" id="sharedArtefactGrid">';
      filtered.forEach(function(art) {
        // v2.3.1-Ω: PENDING=1 ACTIVE=2 RELEASED=3
        var isPending = art.status === 'pending' || art.stateNum === 1;
        var isReleased = art.status === 'released' || art.stateNum === 3;
        var statusClass = isPending ? 'status-pending' : isReleased ? 'status-released' : 'status-received';
        var statusLabel = isPending ? 'Pending' : isReleased ? 'Released' : 'Received';
        
        var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
          '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
          '&artefactTokenId=' + art.tokenId;
        
        var hasNotif = hasUnreadNotification(art.tokenId);
        html += '<div class="artefact-card library-card ' + statusClass + (hasNotif ? ' unseen-artefact' : '') + '" style="position:relative;" onclick="Z1NArtefacts.openLibraryModal(' + art.tokenId + ', ' + art.sourceKeyId + ')">' +
          '<div class="artefact-preview">' +
            (isPending ? '<div class="artefact-placeholder shared" style="color:#ffd556;">\u25C8</div>' : isReleased ? '<div class="artefact-placeholder shared" style="color:var(--text-soft);opacity:0.4;">\u25C8</div>' : artImg(previewUrl, 'From Key #' + art.sourceKeyId)) +
            '<div class="library-badge">\u2190 #' + art.sourceKeyId + '</div>' +
          '</div>' +
          '<div class="artefact-info-row">' +
            '<span class="info-id">From #' + art.sourceKeyId + '</span>' +
            '<span class="info-status ' + statusClass + '">' + statusLabel + '</span>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    
    container.innerHTML = html;
  }

  // =====================================================================
  // MODALS
  // =====================================================================
  
  function openOwnedModal(artefactId) {
    var art = ownedArtefacts.find(function(a) { return a.tokenId === artefactId; });
    if (!art) return;
    
    var z = getZ1N();
    var modal = document.getElementById('artefactSharingModal');
    if (!modal) return;
    
    var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === artefactId; }) + 1;
    // v2.3.1-Ω: no REVOKED state
    var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                      art.status === 'pending' ? 'Offered' :
                      art.status === 'shared' ? 'Active' :
                      art.status === 'released' ? 'Released' : art.status;
    var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                      art.status === 'pending' ? 'status-pending' :
                      art.status === 'shared' ? 'status-viewedby' :
                      art.status === 'released' ? 'status-released' : '';
    
    var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
      '/static-preview?epoch=' + (z.epoch || 0) + '&t=' + Date.now();
    if (art.status !== 'in_my_view') {
      previewUrl += '&viewerKeyId=' + z.keyId + '&artefactTokenId=' + art.tokenId;
    }
    
    var contentHtml = '';
    
    if (art.status === 'in_my_view') {
      contentHtml = '<div class="share-layout">' +
        '<div class="share-column"><div class="share-column-title">Recipient View After Accepting</div><div class="share-preview">' + artImg(previewUrl, 'Artefact Preview') + '</div></div>' +
        '<div class="share-column"><div class="share-column-title">Your View After Accepting</div><div class="share-preview grayed"><div class="share-preview-placeholder" style="color:var(--accent);font-size:64px;">\u25C8</div></div></div>' +
      '</div>' +
      '<div class="share-form">' +
        '<label>Offer to Key ID:</label>' +
        '<input type="number" id="shareTargetKeyId" placeholder="Enter Key ID" min="0">' +
        '<div id="shareKeyValidation" class="validation-msg"></div>' +
        '<div class="warning-box" style="border-color:rgba(94,232,160,0.4);background:rgba(94,232,160,0.08);">' +
          '<span class="warning-icon" style="filter:hue-rotate(90deg);">\u26A0\uFE0F</span><div><strong>Offering</strong><p>The recipient must accept this offering before the artefact becomes bound. Once accepted, you can revoke and restore viewing, but you can never offer it to a different Key.</p></div>' +
        '</div>' +
        '<button class="btn btn-green" onclick="Z1NArtefacts.offerArtefact(' + artefactId + ')">Offer to Key</button>' +
      '</div>';
    } else if (art.status === 'pending') {
      var pendingKeyId = art.pendingForKeyId || art.boundToKeyId || 0;
      contentHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div class="modal-info">' +
          '<div class="info-row"><span class="label">Status</span><span class="value" style="color:var(--keys-accent);">Offered \u2014 awaiting response</span></div>' +
          '<div class="info-row"><span class="label">Offered to</span><span class="value">Key #' + pendingKeyId + '</span></div>' +
        '</div>' +
        '<div class="action-buttons">' +
          '<p>Cancel this offering to make the artefact available again.</p>' +
          '<button class="btn btn-danger" style="background:rgba(248,113,113,0.2);border-color:rgba(248,113,113,0.4);color:#f87171;" onclick="Z1NArtefacts.cancelOffering(' + artefactId + ')">Cancel Offering</button>' +
        '</div>';
    } else if (art.status === 'shared') {
      // v2.3.1-Ω: no revoke/restore — only release (terminal)
      contentHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
      '<div class="modal-info"><div class="info-row"><span class="label">Status</span><span class="value ' + statusClass + '">' + statusLabel + '</span></div><div class="info-row"><span class="label">Bound to</span><span class="value">Key #' + art.boundToKeyId + '</span></div></div>' +
      '<div class="action-buttons">' +
        '<p style="color:var(--text-soft);font-size:12px;">Permanently end this artefact relationship. Both parties can release. This cannot be undone.</p>' +
        '<button class="btn" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);color:#f87171;font-size:12px;" onclick="Z1NArtefacts.ownerRelease(' + artefactId + ')">Release Permanently</button>' +
      '</div>';
    } else if (art.status === 'released') {
      contentHtml = '<div class="modal-preview large" style="opacity:0.4;">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div class="modal-info">' +
          '<div class="info-row"><span class="label">Status</span><span class="value" style="color:var(--text-soft);">Released \u2014 retired</span></div>' +
          (art.boundToKeyId > 0 ? '<div class="info-row"><span class="label">Was bound to</span><span class="value">Key #' + art.boundToKeyId + '</span></div>' : '') +
        '</div>' +
        '<div style="padding:12px 0;color:var(--text-soft);font-size:13px;">This artefact has been permanently released and cannot be used again.</div>';
    }
    
    modal.innerHTML = '<div class="modal-overlay" onclick="Z1NArtefacts.closeModal()"></div>' +
      '<div class="modal-content wide"><button class="modal-close" onclick="Z1NArtefacts.closeModal()">\u00D7</button>' +
        '<h2>Artefact #' + artefactIndex + ' <span class="modal-subtitle">(Token ID: ' + artefactId + ')</span></h2>' +
        '<div class="modal-body">' + contentHtml + '<div id="sharingStatus" class="status-area"></div></div>' +
      '</div>';
    
    modal.classList.add('active');
    var input = document.getElementById('shareTargetKeyId');
    if (input) input.addEventListener('input', validateShareTarget);
  }

  function openLibraryModal(artefactId, sourceKeyId) {
    markNotificationRead(artefactId);
    lastSharedSig = '';
    renderSharedSection();
    
    var z = getZ1N();
    var modal = document.getElementById('artefactSharingModal');
    if (!modal) return;
    
    var artData = sharedWithMe.find(function(a) { return a.tokenId === artefactId; });
    var status = artData ? artData.status : 'active';
    // v2.3.1-Ω: no REVOKED state
    var isPending = status === 'pending' || (artData && artData.stateNum === 1);
    var isReleased = status === 'released' || (artData && artData.stateNum === 3);
    var isActive = !isPending && !isReleased;
    var isRevoked = false; // removed in v2.3.1-Ω
    
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
    } else if (isActive) {
      actionsHtml = '<div class="action-buttons" style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">' +
        '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">' +
          '<p style="color:var(--text-soft);font-size:12px;">Permanently end this artefact relationship.</p>' +
          '<button class="btn" style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);color:#f87171;font-size:12px;" onclick="Z1NArtefacts.recipientRelease(' + artefactId + ')">Release Permanently</button>' +
        '</div>' +
      '</div>';
    }
    // v2.3.1-Ω: no REVOKED state — isRevoked is always false
    
    var previewHtml = '';
    
    var previewHtml = '';
    if (isPending) {
      previewHtml = '<div class="modal-preview large" style="opacity:0.6;">' + artImg(previewUrl, 'Artefact Preview') + '</div>' +
        '<div style="text-align:center;color:var(--keys-accent);font-size:13px;margin-top:4px;">Pending \u2014 accept to view</div>';
    } else if (isRevoked) {
      previewHtml = '<div style="display:flex;align-items:center;justify-content:center;height:300px;"><div style="font-size:80px;color:#f87171;opacity:0.5;">\u25C8</div></div>' +
        '<div style="text-align:center;color:#f87171;font-size:13px;margin-top:4px;">Viewing revoked by owner</div>';
    } else if (isReleased) {
      previewHtml = '<div style="display:flex;align-items:center;justify-content:center;height:300px;"><div style="font-size:80px;color:var(--text-soft);opacity:0.3;">\u25C8</div></div>' +
        '<div style="text-align:center;color:var(--text-soft);font-size:13px;margin-top:4px;">Released \u2014 retired</div>';
    } else {
      previewHtml = '<div class="modal-preview large">' + artImg(previewUrl, 'Artefact Preview') + '</div>';
    }
    
    var statusLabelLib = isPending ? 'Pending' : isActive ? 'Active' : isReleased ? 'Released' : status;
    
    modal.innerHTML = '<div class="modal-overlay" onclick="Z1NArtefacts.closeModal()"></div>' +
      '<div class="modal-content"><button class="modal-close" onclick="Z1NArtefacts.closeModal()">\u00D7</button>' +
        '<h2>' + (isPending ? 'Incoming Offering' : 'Received Artefact') + '</h2><div class="modal-body">' +
          previewHtml +
          '<div class="modal-info">' +
            '<div class="info-row"><span class="label">From</span><span class="value">Key #' + sourceKeyId + '</span></div>' +
            '<div class="info-row"><span class="label">Status</span><span class="value">' + statusLabelLib + '</span></div>' +
            (glyphs ? '<div class="info-row"><span class="label">Glyphs</span><span class="value">' + glyphs + '</span></div>' : '') +
          '</div>' +
          actionsHtml +
          '<div id="sharingStatus" class="status-area"></div>' +
        '</div></div>';
    
    modal.classList.add('active');
    
    var badge = document.getElementById('artefactBadge');
    if (badge) {
      var unreadCount = getUnreadNotificationCount();
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.background = 'var(--accent, #5ee8a0)';
        badge.style.color = '#000';
      } else {
        badge.textContent = ownedArtefacts.length;
        badge.style.background = '';
        badge.style.color = '';
      }
    }
  }

  function closeModal() {
    var modal = document.getElementById('artefactSharingModal');
    if (modal) modal.classList.remove('active');
  }

  async function validateShareTarget() {
    var input = document.getElementById('shareTargetKeyId');
    var msg = document.getElementById('shareKeyValidation');
    if (!input || !msg) return;
    var targetKeyId = parseInt(input.value);
    var z = getZ1N();
    if (isNaN(targetKeyId) || targetKeyId < 0) { msg.textContent = ''; msg.className = 'validation-msg'; return; }
    if (targetKeyId === z.keyId) { msg.textContent = '\u2717 Cannot offer to yourself'; msg.className = 'validation-msg error'; return; }
    msg.textContent = 'Checking...'; msg.className = 'validation-msg pending';
    var exists = await keyExists(targetKeyId);
    if (exists) {
      var glyphs = await getKeyGlyphs(targetKeyId);
      msg.textContent = '\u2713 Key #' + targetKeyId + ' exists' + (glyphs ? ' (' + getShortGlyphs(targetKeyId) + ')' : '');
      msg.className = 'validation-msg success';
    } else {
      msg.textContent = '\u2717 Key #' + targetKeyId + ' does not exist'; msg.className = 'validation-msg error';
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
      // v2.3.1-Ω: offer(artefactId, recipientKeyId, message)
      var iface = new ethers.Interface(['function offer(uint256 artefactId, uint256 recipientKeyId, string message)']);
      var data = iface.encodeFunctionData('offer', [BigInt(artefactId), BigInt(targetKeyId), '']);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">\u2713 Artefact offered to Key #' + targetKeyId + '</div>';
        showToast('\u2705 Artefact offered!', 3000);
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

  // v2.3.1-Ω: revokeViewing/restoreViewing REMOVED — no REVOKED state in contract
  // These stubs prevent old cached calls from breaking silently
  async function revokeViewing(artefactId) {
    console.warn('revokeViewing() called — removed in v2.3.1-Ω. Use ownerRelease().');
    showToast('Revoke not available — use Release', 3000);
  }

  async function restoreViewing(artefactId) {
    console.warn('restoreViewing() called — removed in v2.3.1-Ω.');
    showToast('Restore not available in v2.3.1-Ω', 3000);
  }

  async function cancelOffering(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Preparing transaction...</div>';
    try {
      await loadEthersLib();
      // v2.3.1-Ω: cancel(artefactId)
      var iface = new ethers.Interface(['function cancel(uint256 artefactId)']);
      var data = iface.encodeFunctionData('cancel', [BigInt(artefactId)]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('Offering cancelled', 3000);
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
      // v2.3.1-Ω: accept(artefactId)
      var iface = new ethers.Interface(['function accept(uint256 artefactId)']);
      var data = iface.encodeFunctionData('accept', [BigInt(artefactId)]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('\u2705 Artefact accepted!', 3000);
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
      // v2.3.1-Ω: reject(artefactId)
      var iface = new ethers.Interface(['function reject(uint256 artefactId)']);
      var data = iface.encodeFunctionData('reject', [BigInt(artefactId)]);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(94,232,160,0.15);color:#5ee8a0;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('Offering rejected', 3000);
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
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Preparing release...</div>';
    try {
      await loadEthersLib();
      // v2.3.1-Ω: release(artefactId, message)
      var iface = new ethers.Interface(['function release(uint256 artefactId, string message)']);
      var data = iface.encodeFunctionData('release', [BigInt(artefactId), '']);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('Artefact released', 3000);
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
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Preparing release...</div>';
    try {
      await loadEthersLib();
      // v2.3.1-Ω: release(artefactId, message) — symmetric, same function for both parties
      var iface = new ethers.Interface(['function release(uint256 artefactId, string message)']);
      var data = iface.encodeFunctionData('release', [BigInt(artefactId), '']);
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Confirm in wallet...</div>';
      var tx = await z.provider.request({ method: 'eth_sendTransaction', params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }] });
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(248,113,113,0.15);color:#f87171;">Waiting for confirmation...</div>';
      var success = await waitForReceipt(tx);
      if (success) {
        showToast('Artefact released', 3000);
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

  // v2.3.1-Ω: hideArtefact/unhideArtefact REMOVED — not in contract
  async function hideArtefact(artefactId) {
    console.warn('hideArtefact() removed in v2.3.1-Ω');
  }
  async function unhideArtefact(artefactId) {
    console.warn('unhideArtefact() removed in v2.3.1-Ω');
  }

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
  // MINT
  // =====================================================================
  
  var MINT_PRICE = '0x6124FEE993BC0000'; // 7 POL
  
  async function mint() {
    var z = getZ1N();
    if (!z.wallet || !z.provider || z.keyId === null) { showToast('Connect wallet first', 3000); return; }
    
    if (isMinting) { showToast('Already minting \u2014 please wait', 3000); return; }
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
      // v2.3.1-Ω: mint(keyId, inscription) / mintExtra(keyId, inscription) payable
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
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">\u2705 Artefact minted! Waiting for indexer...</div>';
        showToast('\u2705 Artefact minted!', 4000);
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
          if (btn) { btn.disabled = false; btn.textContent = '+ Mint Artefact \u2014 7 POL'; }
          if (overviewBtn) { overviewBtn.disabled = false; overviewBtn.textContent = '+ Mint Artefact \u2014 7 POL'; }
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
              if (btn) { btn.disabled = false; btn.textContent = '+ Mint Artefact \u2014 7 POL'; }
              if (overviewBtn) { overviewBtn.disabled = false; overviewBtn.textContent = '+ Mint Artefact \u2014 7 POL'; }
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
      if (btn) { btn.textContent = ownedArtefacts.length > 0 ? '+ Mint Artefact \u2014 7 POL' : '+ Mint Free Artefact'; btn.disabled = false; }
      if (overviewBtn) { overviewBtn.disabled = false; overviewBtn.textContent = ownedArtefacts.length > 0 ? '+ Mint Artefact \u2014 7 POL' : '+ Mint Free Artefact'; }
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

  // =====================================================================
  // INIT & REFRESH
  // =====================================================================
  
  async function init() {
    var z = getZ1N();
    
    if (!z.keyId && z.keyId !== 0) {
      setTimeout(init, 1000);
      return;
    }
    
    console.log('Z1NArtefacts v2.3.1-Ω: Initializing for Key #' + z.keyId);
    
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

  // v2.3.1: Badge helper — applies and protects badge from main JS overwriting
  var _lastBadgeUnread = 0;
  
  function applyBadge(unreadCount) {
    _lastBadgeUnread = unreadCount;
    var badge = document.getElementById('artefactBadge');
    if (!badge) return;
    
    if (unreadCount > 0) {
      badge.textContent = String(unreadCount);
      badge.style.cssText = 'background:rgba(94,232,160,0.5); color:#fff;';
    } else if (ownedArtefacts.length > 0) {
      badge.textContent = String(ownedArtefacts.length);
      badge.style.cssText = '';
    } else {
      badge.textContent = '';
      badge.style.cssText = '';
    }
  }
  
  // Watch for external overwrites of badge (e.g. main Key-dashboard.js)
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

  // v2.3.1: Standalone function to update badges + overview feed
  // Can be called from refresh() AND from tab switches
  function updateBadgesAndFeed() {
    var unreadCount = getUnreadNotificationCount();
    console.log('Z1NArtefacts: updateBadgesAndFeed — unreadCount=' + unreadCount + ', unseenIds=' + JSON.stringify(unseenArtefactIds));

    // Update tab-nav badge
    applyBadge(unreadCount);
    
    // Inject unseen artefact items into overview activity feed
    var feed = document.getElementById('activityFeed');
    if (feed) {
      // Remove old artefact notifications first
      feed.querySelectorAll('.activity-item.artefact-notif').forEach(function(el) { el.remove(); });
      
      if (unreadCount > 0) {
        var z = getZ1N();
        var currentEpoch = z.epoch || '\u2014';
        sharedWithMe.forEach(function(art) {
          if (!unseenArtefactIds[art.tokenId]) return;
          var type = unseenArtefactIds[art.tokenId];
          var msg = type === 'new' 
            ? 'offered an artefact to you'
            : 'changed viewing access';
          
          var item = document.createElement('div');
          item.className = 'activity-item unread artefact-notif';
          item.style.cursor = 'pointer';
          item.style.borderLeft = '3px solid var(--accent)';
          item.onclick = function() { if (typeof switchTab === 'function') switchTab('artefacts'); };
          item.innerHTML = '<div class="activity-icon artefact">\u25C8</div>' +
            '<div class="activity-content">' +
              '<div class="activity-title" style="color:var(--accent);"><strong style="color:var(--accent);">K#' + art.sourceKeyId + '</strong> ' + msg + ' <span style="color:var(--text-soft);font-size:11px;">\u00b7 Epoch ' + currentEpoch + '</span></div>' +
            '</div>';
          
          if (feed.firstChild) {
            feed.insertBefore(item, feed.firstChild);
          } else {
            feed.appendChild(item);
          }
        });
      }
      
      // Update overview artefacts presence badge
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
    updateBadgesAndFeed: updateBadgesAndFeed
  };

  // v2.3.1: Re-inject feed items whenever overview tab becomes visible
  // The main JS may rebuild the activity feed on tab switch, wiping our items
  var _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === 'function') {
    window.switchTab = function(tab) {
      _origSwitchTab(tab);
      if (tab === 'overview') {
        setTimeout(updateBadgesAndFeed, 300);
      }
    };
  } else {
    // switchTab not yet defined — wait and patch
    var _patchInterval = setInterval(function() {
      if (typeof window.switchTab === 'function' && !window._z1nArtefactPatched) {
        window._z1nArtefactPatched = true;
        var orig = window.switchTab;
        window.switchTab = function(tab) {
          orig(tab);
          if (tab === 'overview') {
            setTimeout(updateBadgesAndFeed, 300);
          }
        };
        clearInterval(_patchInterval);
      }
    }, 500);
    // Stop trying after 30s
    setTimeout(function() { clearInterval(_patchInterval); }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
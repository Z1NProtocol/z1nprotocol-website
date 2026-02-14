/**
 * Z1N Protocol - Key Dashboard Artefacts Module
 * Version: 2.3.0-Ω
 * 
 * Handles:
 * - Your Artefacts (owned) with share/revoke/restore
 * - Shared With Me (library) 
 * - Share Modal with permanent binding warning
 * - Search/filter when >5 items
 */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  var Z1N_ARTEFACT = '0xf1887e8D53bbb61F64bfD16Ec41598618053bd2c';
  var Z1N_KEY = '0xe27C2De6e8F1090EEAe18E1Ce3f51F1D2FeAf469';
  
  var RPC_URLS = ['https://polygon-mainnet.g.alchemy.com/v2/P7YcT2oy0Mfad2Pedbe3y'];
  var currentRpcIndex = 0;
  
  var SELECTORS = {
    sourceKeyOf: '0x4e3ee7a9',      // sourceKeyOf(uint256)
    boundToKeyId: '0x8e7c8e36',     // boundToKeyId(uint256)
    viewingActive: '0x7e1c0c09',    // viewingActive(uint256)
    canView: '0x79d62d11',          // canView(uint256,uint256)
    getLibrary: '0x9f8a13d7',       // getLibrary(uint256)
    ownerOf: '0x6352211e',          // ownerOf(uint256)
    exists: '0x4f558e79',           // exists(uint256)
    glyphs: '0x887296c3'            // glyphs(uint256)
  };
  
  var GLYPHS = ['∞','π','⋮','⊕','⊗','∴','∵','↔','↻','△','◇','○','●','□','☰','☷','⚑','✱','⊥','≡','◊'];

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  
  var ownedArtefacts = [];      // Artefacts I minted for my Key
  var sharedWithMe = [];        // Artefacts others shared with me
  var ownedFilter = { status: 'all', search: '' };
  var libraryFilter = { status: 'all', search: '' };
  var keyGlyphsCache = {};
  var ownedViewMode = 'card';   // 'card' or 'list'

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTRACT READS
  // ═══════════════════════════════════════════════════════════════════════════
  
  async function getArtefactState(artefactId) {
    try {
      // First check if artefact exists on this contract
      var sourceResult = await rpc('eth_call', [{ to: Z1N_ARTEFACT, data: SELECTORS.sourceKeyOf + enc256(artefactId) }, 'latest']);
      
      // If we get here, artefact exists - get remaining state
      var [boundResult, activeResult] = await Promise.all([
        rpc('eth_call', [{ to: Z1N_ARTEFACT, data: SELECTORS.boundToKeyId + enc256(artefactId) }, 'latest']),
        rpc('eth_call', [{ to: Z1N_ARTEFACT, data: SELECTORS.viewingActive + enc256(artefactId) }, 'latest'])
      ]);
      
      return {
        sourceKeyId: parseInt(sourceResult, 16),
        boundToKeyId: parseInt(boundResult, 16),
        viewingActive: parseInt(activeResult, 16) === 1
      };
    } catch (e) {
      // Artefact doesn't exist on this contract (probably from old contract)
      console.warn('getArtefactState: Artefact #' + artefactId + ' not found on current contract');
      return null;
    }
  }

  async function getLibrary(keyId) {
    try {
      var data = SELECTORS.getLibrary + enc256(keyId);
      var result = await rpc('eth_call', [{ to: Z1N_ARTEFACT, data: data }, 'latest']);
      
      if (!result || result === '0x' || result.length < 130) return [];
      
      // Decode dynamic array
      var offset = parseInt(result.slice(2, 66), 16) * 2;
      var length = parseInt(result.slice(2 + offset, 2 + offset + 64), 16);
      var ids = [];
      
      for (var i = 0; i < length; i++) {
        var start = 2 + offset + 64 + (i * 64);
        var id = parseInt(result.slice(start, start + 64), 16);
        ids.push(id);
      }
      
      return ids;
    } catch (e) {
      console.error('getLibrary error:', e);
      return [];
    }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════════
  
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
      
      // API now returns status directly (v2.3.0-Ω)
      for (var i = 0; i < liveArtefacts.length; i++) {
        var art = liveArtefacts[i];
        
        // Use API data directly - no additional on-chain calls needed
        art.sourceKeyId = art.sourceKeyId || keyId;
        art.boundToKeyId = art.boundToKeyId || 0;
        art.viewingActive = art.viewingActive || false;
        art.status = art.status || 'in_my_view';
        
        // Get bound key glyphs if shared
        if (art.boundToKeyId > 0) {
          await getKeyGlyphs(art.boundToKeyId);
        }
        
        ownedArtefacts.push(art);
      }
      
      console.log('Loaded ' + ownedArtefacts.length + ' owned artefacts');
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
      
      // Try dedicated library endpoint first, fall back to main artefacts endpoint
      var response = await fetch(apiBase + '/key/' + keyId + '/library', { cache: 'no-store' });
      
      if (response.ok) {
        var data = await response.json();
        sharedWithMe = data.library || [];
      } else {
        // Fall back to main endpoint
        response = await fetch(apiBase + '/key/' + keyId + '/artefacts', { cache: 'no-store' });
        if (response.ok) {
          var data = await response.json();
          sharedWithMe = data.library || [];
        }
      }
      
      // Cache glyphs for source keys
      for (var i = 0; i < sharedWithMe.length; i++) {
        var art = sharedWithMe[i];
        if (art.sourceKeyId) {
          await getKeyGlyphs(art.sourceKeyId);
          art.sourceGlyphs = art.sourceGlyphs || getShortGlyphs(art.sourceKeyId);
        }
      }
      
      console.log('Loaded ' + sharedWithMe.length + ' shared artefacts');
    } catch (e) {
      console.error('loadSharedWithMe error:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════════════
  
  function renderOwnedSection() {
    var container = document.getElementById('ownedArtefactsSection');
    if (!container) return;
    
    var z = getZ1N();
    var filtered = ownedArtefacts.filter(function(art) {
      if (ownedFilter.status !== 'all' && art.status !== ownedFilter.status) return false;
      if (ownedFilter.search && !String(art.tokenId).includes(ownedFilter.search)) return false;
      return true;
    });
    
    var showFilters = ownedArtefacts.length > 5;
    var hasFreeArtefact = ownedArtefacts.length > 0;
    var mintText = hasFreeArtefact ? '+ Mint Artefact — 21 POL' : '+ Mint Free Artefact';
    
    // Count by status
    var countInView = ownedArtefacts.filter(function(a) { return a.status === 'in_my_view'; }).length;
    var countShared = ownedArtefacts.filter(function(a) { return a.status === 'shared'; }).length;
    var countRevoked = ownedArtefacts.filter(function(a) { return a.status === 'revoked'; }).length;
    
    // Header with integrated mint button
    var html = '<div class="artefact-section-header">' +
      '<h3 class="section-title title-green">Your Artefacts <span class="count" style="color:var(--accent);">(' + ownedArtefacts.length + ')</span></h3>' +
      '<div class="header-actions" style="display:flex;align-items:center;gap:8px;">' +
        '<button class="view-toggle' + (ownedViewMode === 'card' ? ' active' : '') + '" onclick="Z1NArtefacts.setViewMode(\'card\')" title="Card view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">▦</button>' +
        '<button class="view-toggle' + (ownedViewMode === 'list' ? ' active' : '') + '" onclick="Z1NArtefacts.setViewMode(\'list\')" title="List view" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;">☰</button>' +
        '<button class="btn btn-green" id="btnMintInSection" onclick="Z1NArtefacts.mint()" style="height:32px;display:flex;align-items:center;">' + mintText + '</button>' +
      '</div>' +
    '</div>';
    
    // Mint status area
    html += '<div id="mintArtefactStatus" style="margin-bottom: 12px;"></div>';
    
    // Filter bar (pill buttons + search)
    if (showFilters) {
      html += '<div class="artefact-filter-bar">' +
        '<div class="filter-pills">' +
          '<button class="filter-pill' + (ownedFilter.status === 'all' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'all\')">All <span class="pill-count">' + ownedArtefacts.length + '</span></button>' +
          '<button class="filter-pill' + (ownedFilter.status === 'in_my_view' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'in_my_view\')">Personal <span class="pill-count">' + countInView + '</span></button>' +
          '<button class="filter-pill' + (ownedFilter.status === 'shared' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'shared\')">Shared <span class="pill-count">' + countShared + '</span></button>' +
          '<button class="filter-pill' + (ownedFilter.status === 'revoked' ? ' active' : '') + '" onclick="Z1NArtefacts.setOwnedFilter(\'revoked\')">Revoked <span class="pill-count">' + countRevoked + '</span></button>' +
        '</div>' +
        '<input type="text" class="filter-search" id="ownedSearchInput" placeholder="Search ID..." value="' + (ownedFilter.search || '') + '" onkeyup="Z1NArtefacts.filterOwned()">' +
      '</div>';
    }
    
    // Content area
    if (ownedArtefacts.length === 0) {
      html += '<div class="artefact-empty">' +
        '<div class="empty-icon">◈</div>' +
        '<p>No live artefacts yet</p>' +
        '<p class="empty-hint">Mint your first artefact — it\'s free!</p>' +
      '</div>';
    } else if (filtered.length === 0) {
      html += '<div class="artefact-empty">No artefacts match your filters</div>';
    } else if (ownedViewMode === 'list') {
      // LIST VIEW - Horizontal grid with metadata
      html += '<div class="artefact-list-grid">';
      filtered.forEach(function(art, idx) {
        var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === art.tokenId; }) + 1;
        var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                          art.status === 'shared' ? 'status-shared' : 'status-revoked';
        var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                          art.status === 'shared' ? 'Shared' : 'Revoked';
        
        var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
          '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
          '&artefactTokenId=' + art.tokenId + '&t=' + Date.now();
        
        html += '<div class="artefact-list-card ' + statusClass + '" onclick="Z1NArtefacts.openOwnedModal(' + art.tokenId + ')">' +
          '<div class="list-card-preview">' +
            (art.status === 'in_my_view' || art.status === 'revoked' ? 
              '<img src="' + previewUrl + '" alt="Artefact #' + artefactIndex + '" onerror="this.parentElement.innerHTML=\'<div class=list-placeholder>◈</div>\'">' :
              '<div class="list-placeholder shared">◈</div>') +
          '</div>' +
          '<div class="list-card-meta">' +
            '<div class="list-card-id">#' + artefactIndex + '</div>' +
            '<div class="artefact-status ' + statusClass + '">' + statusLabel + '</div>' +
            (art.boundToKeyId > 0 ? '<div class="list-card-bound">→ Key #' + art.boundToKeyId + '</div>' : '') +
            '<div class="list-card-stats">↔ ' + (art.shareCount || 0) + '/' + (art.revokeCount || 0) + '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    } else {
      // CARD VIEW (default) - Compact like list view
      html += '<div class="artefact-grid" id="ownedArtefactGrid">';
      filtered.forEach(function(art, displayIndex) {
        var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === art.tokenId; }) + 1;
        
        var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                          art.status === 'shared' ? 'status-shared' : 'status-revoked';
        var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                          art.status === 'shared' ? 'Shared' : 'Revoked';
        
        var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
          '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
          '&artefactTokenId=' + art.tokenId + '&t=' + Date.now();
        
        html += '<div class="artefact-card ' + statusClass + '" onclick="Z1NArtefacts.openOwnedModal(' + art.tokenId + ')">' +
          '<div class="artefact-preview">' +
            (art.status === 'in_my_view' || art.status === 'revoked' ? 
              '<img src="' + previewUrl + '" alt="Artefact #' + artefactIndex + '" onerror="this.parentElement.innerHTML=\'<div class=artefact-placeholder>◈</div>\'">' :
              '<div class="artefact-placeholder shared">◈</div>') +
          '</div>' +
          '<div class="artefact-info-row">' +
            '<span class="info-id">#' + artefactIndex + '</span>' +
            '<span class="info-status ' + statusClass + '">' + statusLabel + '</span>' +
            (art.boundToKeyId > 0 ? '<span class="info-bound">→ #' + art.boundToKeyId + '</span>' : '') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    
    container.innerHTML = html;
  }

  function renderSharedSection() {
    var container = document.getElementById('sharedWithMeSection');
    if (!container) return;
    
    var z = getZ1N();
    var filtered = sharedWithMe.filter(function(art) {
      if (libraryFilter.status !== 'all' && art.status !== libraryFilter.status) return false;
      if (libraryFilter.search && !String(art.sourceKeyId).includes(libraryFilter.search)) return false;
      return true;
    });
    
    var showFilters = sharedWithMe.length > 5;
    var parentCard = container.closest('.section-card');
    
    // Always show the section, even if empty
    if (parentCard) parentCard.style.display = 'block';
    
    // Count by status
    var countActive = sharedWithMe.filter(function(a) { return a.status === 'active' || a.viewingActive; }).length;
    var countRevoked = sharedWithMe.filter(function(a) { return a.status === 'revoked' || !a.viewingActive; }).length;
    
    var html = '<div class="artefact-section-header">' +
      '<h3 class="section-title title-green">Received Artefacts <span class="count" style="color:var(--accent);">(' + sharedWithMe.length + ')</span></h3>' +
    '</div>';
    
    // Filter bar (if >5 items)
    if (showFilters) {
      html += '<div class="artefact-filter-bar">' +
        '<div class="filter-pills">' +
          '<button class="filter-pill' + (libraryFilter.status === 'all' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'all\')">All <span class="pill-count">' + sharedWithMe.length + '</span></button>' +
          '<button class="filter-pill' + (libraryFilter.status === 'active' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'active\')">Active <span class="pill-count">' + countActive + '</span></button>' +
          '<button class="filter-pill' + (libraryFilter.status === 'revoked' ? ' active' : '') + '" onclick="Z1NArtefacts.setLibraryFilter(\'revoked\')">Revoked <span class="pill-count">' + countRevoked + '</span></button>' +
        '</div>' +
        '<input type="text" class="filter-search" id="librarySearchInput" placeholder="Search Key ID..." value="' + (libraryFilter.search || '') + '" onkeyup="Z1NArtefacts.filterLibrary()">' +
      '</div>';
    }
    
    // Content
    if (sharedWithMe.length === 0) {
      html += '<div class="artefact-empty">' +
        '<div class="empty-icon">◈←</div>' +
        '<p>No artefacts received yet</p>' +
        '<p class="empty-hint">When another Key shares an artefact with you, it appears here.</p>' +
      '</div>';
    } else if (filtered.length === 0) {
      html += '<div class="artefact-empty">No artefacts match your filters</div>';
    } else {
      html += '<div class="artefact-grid" id="sharedArtefactGrid">';
      filtered.forEach(function(art) {
        var isRevoked = art.status === 'revoked' || !art.viewingActive;
        var statusClass = isRevoked ? 'status-revoked' : 'status-shared';
        var statusLabel = isRevoked ? 'Revoked' : 'Active';
        
        var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
          '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
          '&artefactTokenId=' + art.tokenId + '&t=' + Date.now();
        
        html += '<div class="artefact-card library-card ' + statusClass + '" onclick="Z1NArtefacts.openLibraryModal(' + art.tokenId + ', ' + art.sourceKeyId + ')">' +
          '<div class="artefact-preview">' +
            (isRevoked ? 
              '<div class="artefact-placeholder revoked">◈</div>' :
              '<img src="' + previewUrl + '" alt="From Key #' + art.sourceKeyId + '" onerror="this.parentElement.innerHTML=\'<div class=artefact-placeholder>◈</div>\'">') +
            '<div class="library-badge">← #' + art.sourceKeyId + '</div>' +
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════
  
  function openOwnedModal(artefactId) {
    var art = ownedArtefacts.find(function(a) { return a.tokenId === artefactId; });
    if (!art) return;
    
    var z = getZ1N();
    var modal = document.getElementById('artefactSharingModal');
    if (!modal) return;
    
    // Find artefact index for this key (1-based)
    var artefactIndex = ownedArtefacts.findIndex(function(a) { return a.tokenId === artefactId; }) + 1;
    
    var statusLabel = art.status === 'in_my_view' ? 'Personal' :
                      art.status === 'shared' ? 'Shared' : 'Revoked';
    var statusClass = art.status === 'in_my_view' ? 'status-personal' : 
                      art.status === 'shared' ? 'status-shared' : 'status-revoked';
    
    var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + art.sourceKeyId + 
      '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
      '&artefactTokenId=' + art.tokenId + '&t=' + Date.now();
    
    var contentHtml = '';
    
    if (art.status === 'in_my_view') {
      // SHARE MODAL - Two column layout
      contentHtml = '<div class="share-layout">' +
        '<div class="share-column">' +
          '<div class="share-column-title">Your View (after sharing)</div>' +
          '<div class="share-preview grayed">' +
            '<div class="share-preview-placeholder">◈<div class="preview-label">Hidden from you</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="share-column">' +
          '<div class="share-column-title">Recipient View</div>' +
          '<div class="share-preview">' +
            '<img src="' + previewUrl + '" alt="Artefact Preview" onerror="this.style.display=\'none\'">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="share-form">' +
        '<label>Share with Key ID:</label>' +
        '<input type="number" id="shareTargetKeyId" placeholder="Enter Key ID" min="0">' +
        '<div id="shareKeyValidation" class="validation-msg"></div>' +
        '<div class="warning-box">' +
          '<span class="warning-icon">⚠️</span>' +
          '<div>' +
            '<strong>Permanent Binding</strong>' +
            '<p>This artefact will be permanently bound to the recipient Key. You can revoke and restore viewing, but you can never share it with a different Key.</p>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-primary" onclick="Z1NArtefacts.grantViewing(' + artefactId + ')">Bind & Share</button>' +
      '</div>';
      
    } else if (art.status === 'shared') {
      // SHARED - Show revoke option with two columns
      contentHtml = '<div class="share-layout">' +
        '<div class="share-column">' +
          '<div class="share-column-title">Your View (currently)</div>' +
          '<div class="share-preview grayed">' +
            '<div class="share-preview-placeholder">◈<div class="preview-label">Hidden from you</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="share-column">' +
          '<div class="share-column-title">Key #' + art.boundToKeyId + ' View</div>' +
          '<div class="share-preview">' +
            '<img src="' + previewUrl + '" alt="Artefact Preview" onerror="this.style.display=\'none\'">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-info">' +
        '<div class="info-row"><span class="label">Status</span><span class="value ' + statusClass + '">' + statusLabel + '</span></div>' +
        '<div class="info-row"><span class="label">Bound to</span><span class="value">Key #' + art.boundToKeyId + '</span></div>' +
      '</div>' +
      '<div class="action-buttons">' +
        '<p>Revoke viewing to hide the artefact from Key #' + art.boundToKeyId + ' and return it to your view.</p>' +
        '<button class="btn btn-warning" onclick="Z1NArtefacts.revokeViewing(' + artefactId + ')">Revoke Viewing</button>' +
      '</div>';
      
    } else if (art.status === 'revoked') {
      // REVOKED - Show restore option with two columns (swapped)
      contentHtml = '<div class="share-layout">' +
        '<div class="share-column">' +
          '<div class="share-column-title">Your View (currently)</div>' +
          '<div class="share-preview">' +
            '<img src="' + previewUrl + '" alt="Artefact Preview" onerror="this.style.display=\'none\'">' +
          '</div>' +
        '</div>' +
        '<div class="share-column">' +
          '<div class="share-column-title">Key #' + art.boundToKeyId + ' View</div>' +
          '<div class="share-preview grayed">' +
            '<div class="share-preview-placeholder">◈<div class="preview-label">Hidden from them</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-info">' +
        '<div class="info-row"><span class="label">Status</span><span class="value ' + statusClass + '">' + statusLabel + '</span></div>' +
        '<div class="info-row"><span class="label">Bound to</span><span class="value">Key #' + art.boundToKeyId + '</span></div>' +
      '</div>' +
      '<div class="action-buttons">' +
        '<p>Restore viewing to share the artefact with Key #' + art.boundToKeyId + ' again.</p>' +
        '<button class="btn btn-primary" onclick="Z1NArtefacts.restoreViewing(' + artefactId + ')">Restore Viewing</button>' +
      '</div>';
    }
    
    modal.innerHTML = '<div class="modal-overlay" onclick="Z1NArtefacts.closeModal()"></div>' +
      '<div class="modal-content wide">' +
        '<button class="modal-close" onclick="Z1NArtefacts.closeModal()">×</button>' +
        '<h2>Artefact #' + artefactIndex + ' <span class="modal-subtitle">(Token ID: ' + artefactId + ')</span></h2>' +
        '<div class="modal-body">' +
          contentHtml +
          '<div id="sharingStatus" class="status-area"></div>' +
        '</div>' +
      '</div>';
    
    modal.classList.add('active');
    
    // Add validation listener for share form
    var input = document.getElementById('shareTargetKeyId');
    if (input) {
      input.addEventListener('input', validateShareTarget);
    }
  }

  function openLibraryModal(artefactId, sourceKeyId) {
    var z = getZ1N();
    var modal = document.getElementById('artefactSharingModal');
    if (!modal) return;
    
    var previewUrl = (z.API_BASE || 'https://z1n-backend-production.up.railway.app/api') + '/artefact/' + sourceKeyId + 
      '/static-preview?epoch=' + (z.epoch || 0) + '&viewerKeyId=' + z.keyId + 
      '&artefactTokenId=' + artefactId + '&t=' + Date.now();
    
    var glyphs = keyGlyphsCache[sourceKeyId] || '';
    
    modal.innerHTML = '<div class="modal-overlay" onclick="Z1NArtefacts.closeModal()"></div>' +
      '<div class="modal-content">' +
        '<button class="modal-close" onclick="Z1NArtefacts.closeModal()">×</button>' +
        '<h2>Shared Artefact</h2>' +
        '<div class="modal-body">' +
          '<div class="modal-preview large">' +
            '<img src="' + previewUrl + '" alt="Artefact Preview" onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div class="modal-info">' +
            '<div class="info-row"><span class="label">From</span><span class="value">Key #' + sourceKeyId + '</span></div>' +
            (glyphs ? '<div class="info-row"><span class="label">Glyphs</span><span class="value">' + glyphs + '</span></div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    
    modal.classList.add('active');
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
    
    if (isNaN(targetKeyId) || targetKeyId < 0) {
      msg.textContent = '';
      msg.className = 'validation-msg';
      return;
    }
    
    if (targetKeyId === z.keyId) {
      msg.textContent = '✗ Cannot share with yourself';
      msg.className = 'validation-msg error';
      return;
    }
    
    msg.textContent = 'Checking...';
    msg.className = 'validation-msg pending';
    
    var exists = await keyExists(targetKeyId);
    
    if (exists) {
      var glyphs = await getKeyGlyphs(targetKeyId);
      msg.textContent = '✓ Key #' + targetKeyId + ' exists' + (glyphs ? ' (' + getShortGlyphs(targetKeyId) + ')' : '');
      msg.className = 'validation-msg success';
    } else {
      msg.textContent = '✗ Key #' + targetKeyId + ' does not exist';
      msg.className = 'validation-msg error';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTRACT WRITES
  // ═══════════════════════════════════════════════════════════════════════════
  
  async function grantViewing(artefactId) {
    var input = document.getElementById('shareTargetKeyId');
    var statusEl = document.getElementById('sharingStatus');
    if (!input) return;
    
    var targetKeyId = parseInt(input.value);
    var z = getZ1N();
    
    if (isNaN(targetKeyId) || targetKeyId < 0) {
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">Enter a valid Key ID</div>';
      return;
    }
    
    if (targetKeyId === z.keyId) {
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">Cannot share with yourself</div>';
      return;
    }
    
    var exists = await keyExists(targetKeyId);
    if (!exists) {
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">Key #' + targetKeyId + ' does not exist</div>';
      return;
    }
    
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Preparing transaction...</div>';
    
    try {
      // Load ethers if not loaded
      if (typeof ethers === 'undefined') {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      
      var iface = new ethers.Interface(['function grantViewing(uint256 artefactId, uint256 viewerKeyId)']);
      var data = iface.encodeFunctionData('grantViewing', [BigInt(artefactId), BigInt(targetKeyId)]);
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Confirm in wallet...</div>';
      
      var tx = await z.provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }]
      });
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Waiting for confirmation...</div>';
      
      var success = await waitForReceipt(tx);
      
      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✓ Artefact shared with Key #' + targetKeyId + '</div>';
        showToast('✅ Artefact shared!', 3000);
        setTimeout(function() {
          closeModal();
          refresh();
        }, 1500);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) {
        msg = 'Transaction rejected';
      }
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function revokeViewing(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Preparing transaction...</div>';
    
    try {
      // Load ethers if not loaded
      if (typeof ethers === 'undefined') {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      
      var iface = new ethers.Interface(['function revokeViewing(uint256 artefactId)']);
      var data = iface.encodeFunctionData('revokeViewing', [BigInt(artefactId)]);
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Confirm in wallet...</div>';
      
      var tx = await z.provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }]
      });
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Waiting for confirmation...</div>';
      
      var success = await waitForReceipt(tx);
      
      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✓ Viewing revoked</div>';
        showToast('Viewing revoked', 3000);
        setTimeout(function() {
          closeModal();
          refresh();
        }, 1500);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) {
        msg = 'Transaction rejected';
      }
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
  }

  async function restoreViewing(artefactId) {
    var statusEl = document.getElementById('sharingStatus');
    var z = getZ1N();
    
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Preparing transaction...</div>';
    
    try {
      // Load ethers if not loaded
      if (typeof ethers === 'undefined') {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      
      var iface = new ethers.Interface(['function restoreViewing(uint256 artefactId)']);
      var data = iface.encodeFunctionData('restoreViewing', [BigInt(artefactId)]);
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Confirm in wallet...</div>';
      
      var tx = await z.provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: z.wallet, to: Z1N_ARTEFACT, data: data, gas: '0x30D40' }]
      });
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Waiting for confirmation...</div>';
      
      var success = await waitForReceipt(tx);
      
      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✓ Viewing restored</div>';
        showToast('Viewing restored', 3000);
        setTimeout(function() {
          closeModal();
          refresh();
        }, 1500);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) {
        msg = 'Transaction rejected';
      }
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg.slice(0, 150) + '</div>';
    }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MINT FUNCTION - Based on proven mint-live-artefact.html logic
  // ═══════════════════════════════════════════════════════════════════════════
  
  var MINT_RPC_URLS = ['https://polygon-mainnet.g.alchemy.com/v2/P7YcT2oy0Mfad2Pedbe3y'];
  var mintRpcIndex = 0;
  var MINT_PRICE = '0x1236efcbcbb340000'; // 21 POL
  
  function mintEnc256(v) { return BigInt(v).toString(16).padStart(64, '0'); }
  
  async function mintRpc(method, params, retryCount) {
    retryCount = retryCount || 0;
    var maxRetries = MINT_RPC_URLS.length * 2;
    
    try {
      var rpcUrl = MINT_RPC_URLS[mintRpcIndex];
      var response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: method, params: params })
      });
      var data = await response.json();
      
      if (data.error) {
        if (data.error.message && (data.error.message.includes('rate') || data.error.message.includes('Too Many'))) {
          mintRpcIndex = (mintRpcIndex + 1) % MINT_RPC_URLS.length;
          if (retryCount < maxRetries) {
            await new Promise(function(r) { setTimeout(r, 300); });
            return mintRpc(method, params, retryCount + 1);
          }
        }
        throw new Error(data.error.message);
      }
      return data.result;
    } catch (err) {
      mintRpcIndex = (mintRpcIndex + 1) % MINT_RPC_URLS.length;
      if (retryCount < maxRetries) {
        await new Promise(function(r) { setTimeout(r, 300); });
        return mintRpc(method, params, retryCount + 1);
      }
      throw err;
    }
  }
  
  async function checkHasFirstArtefactRpc(keyId) {
  try {
    var data = '0xff84f877' + mintEnc256(keyId); // primaryArtefactOfKey(uint256)
    var result = await mintRpc('eth_call', [{ to: Z1N_ARTEFACT, data: data }, 'latest']);
    return parseInt(result, 16) > 0; // > 0 betekent: heeft al primary artefact
  } catch (e) {
    console.warn('Could not check artefact status:', e);
    return false;
  }
}
  
  async function mint() {
    var z = getZ1N();
    if (!z.wallet || !z.provider || z.keyId === null) {
      showToast('Connect wallet first', 3000);
      return;
    }

    var btn = document.getElementById('btnMintInSection');
    var statusEl = document.getElementById('mintArtefactStatus');
    if (!btn) return;

    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing...';
    if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Preparing transaction...</div>';

    try {
      // Load ethers if not loaded
      if (typeof ethers === 'undefined') {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      
      // Check if user has first artefact using RPC (like mint-live-artefact.html does)
      var hasFirstArtefact = ownedArtefacts.length > 0;
      
      var functionName = hasFirstArtefact ? 'mintExtraArtefact' : 'mintFirstArtefact';
      var iface = new ethers.Interface([
        'function mintFirstArtefact(uint256 keyId)',
        'function mintExtraArtefact(uint256 keyId) payable'
      ]);
      
      var encodedData = iface.encodeFunctionData(functionName, [BigInt(z.keyId)]);

      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Confirm in wallet...</div>';
      btn.textContent = 'Confirm in wallet...';

      var txParams = { from: z.wallet, to: Z1N_ARTEFACT, data: encodedData };
      if (hasFirstArtefact) txParams.value = MINT_PRICE;

      var txHash = await z.provider.request({ method: 'eth_sendTransaction', params: [txParams] });

      if (statusEl) statusEl.innerHTML = '<div class="status-msg" style="background:rgba(102,214,154,0.15);color:#66d69a;">Transaction sent... waiting</div>';
      btn.textContent = 'Confirming...';

      // Wait for receipt using RPC (like mint-live-artefact.html does)
      var success = false;
      for (var i = 0; i < 60; i++) {
        await new Promise(function(r) { setTimeout(r, 2000); });
        try {
          var rc = await mintRpc('eth_getTransactionReceipt', [txHash]);
          if (rc && rc.status === '0x1') { success = true; break; }
          if (rc && rc.status === '0x0') { break; }
        } catch (e) { console.warn('Receipt check failed:', e); }
      }

      if (success) {
        if (statusEl) statusEl.innerHTML = '<div class="status-msg success">✅ Artefact minted!</div>';
        btn.textContent = '✅ Minted!';
        showToast('✅ Artefact minted!', 4000);
        
        // Refresh after short delay
        setTimeout(function() {
          btn.disabled = false;
          btn.textContent = '+ Mint Artefact — 21 POL';
          refresh();
        }, 2500);
      } else {
        throw new Error('Transaction failed on-chain');
      }

    } catch (e) {
      console.error('Mint error:', e);
      var msg = e.message || 'Unknown error';
      var code = e.code || 0;
      
      if (msg.includes('reject') || msg.includes('denied') || msg.includes('User denied') || code === 4001) {
        msg = 'Transaction rejected';
      } else if (msg.includes('Internal JSON-RPC') || code === -32603 || msg.includes('execution reverted')) {
        msg = 'Transaction failed - check wallet ownership';
      } else if (msg.includes('insufficient')) {
        msg = 'Insufficient funds for gas';
      } else {
        msg = msg.slice(0, 150);
      }
      
      if (statusEl) statusEl.innerHTML = '<div class="status-msg error">' + msg + '</div>';
      btn.textContent = origText;
      btn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  function filterOwned() {
    var searchInput = document.getElementById('ownedSearchInput');
    ownedFilter.search = searchInput ? searchInput.value.trim() : '';
    renderOwnedSection();
  }
  
  function setOwnedFilter(status) {
    ownedFilter.status = status;
    renderOwnedSection();
  }
  
  function setViewMode(mode) {
    ownedViewMode = mode;
    renderOwnedSection();
  }

  function filterLibrary() {
    var searchInput = document.getElementById('librarySearchInput');
    libraryFilter.search = searchInput ? searchInput.value.trim() : '';
    renderSharedSection();
  }
  
  function setLibraryFilter(status) {
    libraryFilter.status = status;
    renderSharedSection();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT & REFRESH
  // ═══════════════════════════════════════════════════════════════════════════
  
  async function init() {
    var z = getZ1N();
    console.log('Z1NArtefacts init - Z1N object:', z);
    console.log('Z1NArtefacts init - keyId:', z.keyId);
    
    if (!z.keyId && z.keyId !== 0) {
      console.log('Z1NArtefacts: Waiting for key... retrying in 1s');
      setTimeout(init, 1000);
      return;
    }
    
    console.log('Z1NArtefacts: Initializing for Key #' + z.keyId);
    await refresh();
  }

  async function refresh() {
    console.log('Z1NArtefacts refresh starting...');
    
    await Promise.all([
      loadOwnedArtefacts(),
      loadSharedWithMe()
    ]);
    
    console.log('Z1NArtefacts refresh - ownedArtefacts:', ownedArtefacts.length);
    console.log('Z1NArtefacts refresh - sharedWithMe:', sharedWithMe.length);
    
    // Update tab badge
    var badge = document.getElementById('artefactBadge');
    if (badge) badge.textContent = ownedArtefacts.length;
    
    renderOwnedSection();
    renderSharedSection();
    
    console.log('Z1NArtefacts refresh complete');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════════════
  
  window.Z1NArtefacts = {
    init: init,
    refresh: refresh,
    mint: mint,
    filterOwned: filterOwned,
    setOwnedFilter: setOwnedFilter,
    setViewMode: setViewMode,
    filterLibrary: filterLibrary,
    setLibraryFilter: setLibraryFilter,
    openOwnedModal: openOwnedModal,
    openLibraryModal: openLibraryModal,
    closeModal: closeModal,
    grantViewing: grantViewing,
    revokeViewing: revokeViewing,
    restoreViewing: restoreViewing
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }

})();
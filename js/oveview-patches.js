/**
 * Z1N Protocol — Overview Tab Patches
 * Version: 2.3.1-Ω
 *
 * Patches:
 *   1. mintLiveArtefactFromOverview — fixed ABI voor v2.3.1-Ω contract
 *      (mintFirstArtefact / mintExtraArtefact met contentHash, schema, inscription)
 *   2. downloadKeyPresenceCSV — Key ID Presence export
 *   3. downloadFieldSignalsCSV — Field Signals export met epoch-filter UI
 *
 * Plak dit script NA Key-dashboard.js en Key-dashboard-artefacts.js in key-dashboard.html
 * Vervang de bestaande <script src="js/Key-dashboard.js"></script> block NIET —
 * dit overschrijft alleen de functies die hieronder gedefinieerd zijn.
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // 1. MINT KNOP FIX — v2.3.1-Ω ABI
  //
  // Oud: mintFirstArtefact(uint256 keyId)
  //      mintExtraArtefact(uint256 keyId) payable
  //
  // Nieuw: mintFirstArtefact(uint256 keyId, bytes32 contentHash, uint8 schema, string inscription)
  //        mintExtraArtefact(uint256 keyId, bytes32 contentHash, uint8 schema, string inscription) payable
  //
  // contentHash: bytes32(0) — geen off-chain document, plain mint
  // schema: 0 — default schema
  // inscription: leeg of wat de user invult (max 64 bytes)
  // ─────────────────────────────────────────────────────────────────

  window.mintLiveArtefactFromOverview = function () {
    // Delegate naar Z1NArtefacts module als die geladen is (Key-dashboard-artefacts.js)
    if (window.Z1NArtefacts && typeof window.Z1NArtefacts.mint === 'function') {
      window.Z1NArtefacts.mint();
      return;
    }
    // Fallback: inline mint met v2.3.1-Ω ABI
    mintLiveArtefactV2();
  };

  async function mintLiveArtefactV2() {
    var currentAccount = window.Z1N && window.Z1N.wallet;
    var currentKeyId   = window.Z1N && window.Z1N.keyId;
    var provider       = window.Z1N && window.Z1N.provider;
    var API_BASE       = window.Z1N && window.Z1N.API_BASE;
    var ethersLib      = window.ethers;

    if (!currentAccount || !provider || currentKeyId === null || currentKeyId === undefined) {
      showToast('Connect wallet first', 3000);
      return;
    }

    // Laad ethers als nog niet beschikbaar
    if (!ethersLib) {
      try {
        await new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.9.0/ethers.umd.min.js';
          s.onload = function () { ethersLib = window.ethers; res(); };
          s.onerror = rej;
          document.head.appendChild(s);
        });
      } catch (e) {
        showToast('Failed to load ethers', 3000, true);
        return;
      }
    }

    var btn       = document.getElementById('btnMintLiveArtefactOverview');
    var statusEl  = document.getElementById('mintArtefactStatusOverview');
    if (!btn) return;

    var origText  = btn.textContent;
    btn.disabled  = true;
    btn.textContent = 'Preparing...';
    if (statusEl) statusEl.innerHTML = '<div class="status-msg pending" style="font-size:11px;margin-top:8px;">Checking artefact status...</div>';

    try {
      // Check of eerste artefact al gemint is (on-chain)
      var Z1N_ARTEFACT = '0x405344149f95c1264AC6BA1d646D95e17957EB45'; // mainnet adres uit Key-dashboard.js
      var hasFirst = false;
      try {
        var SEL_hasFirst = '0xff84f877';
        var enc256 = function (v) { return BigInt(v).toString(16).padStart(64, '0'); };
        var rpcResult = await window.Z1N.rpc('eth_call', [
          { to: Z1N_ARTEFACT, data: SEL_hasFirst + enc256(currentKeyId) },
          'latest'
        ]);
        hasFirst = parseInt(rpcResult, 16) > 0;
      } catch (e) {
        console.warn('hasFirstArtefact check failed, assuming false:', e.message);
      }

      var functionName = hasFirst ? 'mintExtraArtefact' : 'mintFirstArtefact';

      // v2.3.1-Ω ABI — met contentHash, schema, inscription
      var iface = new ethersLib.Interface([
        'function mintFirstArtefact(uint256 keyId, bytes32 contentHash, uint8 schema, string inscription)',
        'function mintExtraArtefact(uint256 keyId, bytes32 contentHash, uint8 schema, string inscription) payable'
      ]);

      // Defaults: geen off-chain doc, schema 0, lege inscriptie
      var contentHash  = '0x' + '00'.repeat(32); // bytes32(0)
      var schema       = 0;
      var inscription  = '';

      var encodedData = iface.encodeFunctionData(functionName, [
        BigInt(currentKeyId),
        contentHash,
        schema,
        inscription
      ]);

      if (statusEl) statusEl.innerHTML = '<div class="status-msg pending" style="font-size:11px;margin-top:8px;">Confirm in wallet...</div>';
      btn.textContent = 'Confirm in wallet...';

      var txParams = { from: currentAccount, to: Z1N_ARTEFACT, data: encodedData };

      // Prijs voor extra artefact: 7 POL = 7e18 wei
      var ARTEFACT_PRICE = '0x' + (BigInt('7000000000000000000')).toString(16);
      if (hasFirst) txParams.value = ARTEFACT_PRICE;

      var txHash = await provider.request({ method: 'eth_sendTransaction', params: [txParams] });

      if (statusEl) statusEl.innerHTML = '<div class="status-msg pending" style="font-size:11px;margin-top:8px;">Transaction sent... waiting</div>';
      btn.textContent = 'Confirming...';

      // Poll voor receipt
      for (var i = 0; i < 60; i++) {
        await new Promise(function (r) { setTimeout(r, 2000); });
        try {
          var rc = await window.Z1N.rpc('eth_getTransactionReceipt', [txHash]);
          if (rc && rc.status === '0x1') {
            var EXPLORER = 'https://polygonscan.com';
            if (statusEl) statusEl.innerHTML =
              '<div class="status-msg" style="background:rgba(255,213,86,0.15);border:1px solid #ffd556;color:#ffd556;font-size:11px;margin-top:8px;">' +
              '✅ Artefact minted! <a href="' + EXPLORER + '/tx/' + txHash + '" target="_blank">View tx</a></div>';
            btn.textContent = '✅ Minted!';
            window.Z1N.showToast('✅ Artefact minted!', 4000);
            // Refresh artefacts module als beschikbaar
            if (window.Z1NArtefacts && window.Z1NArtefacts.refresh) {
              await window.Z1NArtefacts.refresh();
            }
            setTimeout(function () {
              btn.textContent = hasFirst ? '+ Mint Artefact — 7 POL' : '+ Mint First Artefact — FREE';
              btn.disabled = false;
            }, 5000);
            return;
          }
          if (rc && rc.status === '0x0') throw new Error('Transaction reverted');
        } catch (e) {
          if (e.message && e.message.includes('reverted')) throw e;
        }
      }
      throw new Error('Timeout waiting for confirmation');

    } catch (e) {
      var msg = e.message || 'Unknown error';
      if (msg.includes('reject') || msg.includes('denied') || e.code === 4001) msg = 'Transaction rejected';
      if (msg.includes('FirstArtefactAlreadyMinted')) msg = 'First artefact already minted — use Mint Extra';
      if (statusEl) statusEl.innerHTML =
        '<div class="status-msg error" style="font-size:11px;margin-top:8px;">' + msg.slice(0, 150) + '</div>';
      btn.textContent = origText;
      btn.disabled = false;
    }
  }


  // ─────────────────────────────────────────────────────────────────
  // 2. KEY PRESENCE CSV
  //
  // Kolommen (één row per event, chronologisch):
  //   type | epoch | direction | key_id | counterpart_key_id |
  //   intent | intent_symbol | signal_hash | reply_to_hash |
  //   content | attest_count | artefact_id | artefact_status |
  //   inscription | canon_tx | notes
  //
  // Types: signal_sent · signal_reply_received · attest_sent ·
  //        attest_received · artefact_minted · artefact_received ·
  //        canon_minted · direct_sent · direct_received
  //
  // notes: auto-gegenereerde leesbare samenvatting per row
  // ─────────────────────────────────────────────────────────────────

  window.downloadKeyPresenceCSV = async function () {
    var currentKeyId = window.Z1N && window.Z1N.keyId;
    var API_BASE     = window.Z1N && window.Z1N.API_BASE;
    if (!currentKeyId || !API_BASE) { window.Z1N.showToast('No key loaded', 2000); return; }

    // Vraag of direct channel meegenomen moet worden
    var includeDirectChannel = false;
    if (document.getElementById('presenceIncludeDirect')) {
      includeDirectChannel = document.getElementById('presenceIncludeDirect').checked;
    }

    window.Z1N.showToast('Building Key Presence CSV...', 2000);

    var rows = [[
      'type', 'epoch', 'direction', 'key_id', 'counterpart_key_id',
      'intent', 'intent_symbol', 'signal_hash', 'reply_to_hash',
      'content', 'attest_count', 'artefact_id', 'artefact_status',
      'inscription', 'canon_tx', 'notes'
    ]];

    var intentSymbols = ['ΩC', 'ΩI', 'ΩK', 'ΩS'];
    var intentNames   = ['ΩC (Collective)', 'ΩI (Individual)', 'ΩK (Co-Create)', 'ΩS (Silence)'];

    try {
      // ── SIGNALS SENT ──
      var sigRes  = await fetch(API_BASE + '/signals?keyId=' + currentKeyId + '&limit=1000', { cache: 'no-store' });
      var sigData = await sigRes.json();
      (sigData.signals || []).forEach(function (s) {
        var isReply  = s.replyTo && s.replyTo !== '0x' + '0'.repeat(64);
        var noteBase = isReply
          ? 'Reply to ' + (s.replyToKeyId ? 'K#' + s.replyToKeyId : s.replyTo.slice(0, 10) + '...')
          : 'New signal';
        rows.push([
          isReply ? 'signal_reply_sent' : 'signal_sent',
          s.epoch || '',
          'out',
          currentKeyId,
          s.replyToKeyId || '',
          intentNames[s.intent] || '',
          intentSymbols[s.intent] || '',
          s.hash || '',
          isReply ? s.replyTo : '',
          s.cid || '[Silence]',
          s.attestCount || 0,
          '', '', '', '',
          noteBase + ' · ' + (s.attestCount || 0) + ' attests'
        ]);
      });

      // ── REPLIES RECEIVED ──
      var repRes  = await fetch(API_BASE + '/signals?replyToKeyId=' + currentKeyId + '&limit=1000', { cache: 'no-store' });
      var repData = await repRes.json();
      (repData.signals || []).forEach(function (s) {
        rows.push([
          'signal_reply_received',
          s.epoch || '',
          'in',
          currentKeyId,
          s.keyId || '',
          intentNames[s.intent] || '',
          intentSymbols[s.intent] || '',
          s.hash || '',
          s.replyTo || '',
          s.cid || '[Silence]',
          s.attestCount || 0,
          '', '', '', '',
          'Reply from K#' + s.keyId + ' · ' + (s.attestCount || 0) + ' attests'
        ]);
      });

      // ── ATTESTS SENT ──
      var attSentRes  = await fetch(API_BASE + '/attestations?fromKeyIds=' + currentKeyId + '&limit=1000', { cache: 'no-store' });
      if (attSentRes.ok) {
        var attSentData = await attSentRes.json();
        (attSentData.attestations || []).forEach(function (a) {
          rows.push([
            'attest_sent',
            a.epoch || '',
            'out',
            currentKeyId,
            a.signalKeyId || '',
            intentNames[a.signalIntent] || '',
            intentSymbols[a.signalIntent] || '',
            a.signalHash || '',
            '', // geen replyTo
            a.signalContent || a.signalCid || '',
            '',
            '', '', '', '',
            'Attested signal from K#' + (a.signalKeyId || '?') + ' · Epoch ' + (a.epoch || '?')
          ]);
        });
      }

      // ── ATTESTS RECEIVED ──
      var attRecRes  = await fetch(API_BASE + '/attestations?toKeyIds=' + currentKeyId + '&limit=1000', { cache: 'no-store' });
      if (attRecRes.ok) {
        var attRecData = await attRecRes.json();
        (attRecData.attestations || []).forEach(function (a) {
          rows.push([
            'attest_received',
            a.epoch || '',
            'in',
            currentKeyId,
            a.fromKeyId || '',
            intentNames[a.signalIntent] || '',
            intentSymbols[a.signalIntent] || '',
            a.signalHash || '',
            '',
            a.signalContent || a.signalCid || '',
            '',
            '', '', '', '',
            'K#' + (a.fromKeyId || '?') + ' attested your signal · Epoch ' + (a.epoch || '?')
          ]);
        });
      }

      // ── ARTEFACTS ──
      var artRes = await fetch(API_BASE + '/key/' + currentKeyId + '/artefacts', { cache: 'no-store' });
      if (artRes.ok) {
        var artData = await artRes.json();
        (artData.liveArtefacts || []).forEach(function (a) {
          var isReceived = a.isReceived || a.receivedFromKeyId || a.fromKeyId || a.senderKeyId;
          var fromKey    = a.receivedFromKeyId || a.fromKeyId || a.senderKeyId || '';
          rows.push([
            isReceived ? 'artefact_received' : 'artefact_minted',
            a.epoch || a.mintEpoch || '',
            isReceived ? 'in' : 'self',
            currentKeyId,
            isReceived ? fromKey : '',
            '', '', '', '', '',
            '',
            a.tokenId || '',
            a.status || 'active',
            a.inscription || '',
            '',
            isReceived
              ? 'Received artefact #' + a.tokenId + ' from K#' + fromKey
              : 'Minted artefact #' + a.tokenId + (a.inscription ? ' · "' + a.inscription.slice(0, 30) + '"' : '')
          ]);
        });
      }

      // ── CANON ANCHORS ──
      var canRes = await fetch(API_BASE + '/canon/key/' + currentKeyId, { cache: 'no-store' });
      if (canRes.ok) {
        var canData = await canRes.json();
        (canData.markers || canData.anchors || []).forEach(function (c) {
          var epochId = c.epochId || c.epoch;
          rows.push([
            'canon_minted',
            epochId || '',
            'self',
            currentKeyId,
            '',
            '', '', '', '', '',
            '',
            '', '',
            c.inscription || '',
            c.txHash || '',
            'Canon anchor · Epoch ' + epochId
          ]);
        });
      }

      // ── DIRECT CHANNEL (optioneel) ──
      if (includeDirectChannel) {
        try {
          var dcRes = await fetch(API_BASE + '/direct/key/' + currentKeyId + '?limit=1000', { cache: 'no-store' });
          if (dcRes.ok) {
            var dcData = await dcRes.json();
            (dcData.messages || []).forEach(function (m) {
              var isSent = Number(m.fromKeyId) === Number(currentKeyId);
              rows.push([
                isSent ? 'direct_sent' : 'direct_received',
                m.epoch || '',
                isSent ? 'out' : 'in',
                currentKeyId,
                isSent ? m.toKeyId : m.fromKeyId,
                '', '', '', '',
                m.content || m.cid || '',
                '',
                '', '', '', '',
                (isSent ? 'Direct to K#' + m.toKeyId : 'Direct from K#' + m.fromKeyId) + ' · Epoch ' + (m.epoch || '?')
              ]);
            });
          }
        } catch (e) {
          console.warn('Direct channel not available for CSV:', e.message);
        }
      }

      // Sorteer chronologisch op epoch (numeriek), daarna op type
      rows.slice(1).sort(function (a, b) {
        return (parseInt(a[1]) || 0) - (parseInt(b[1]) || 0);
      });

      if (rows.length <= 1) {
        window.Z1N.showToast('No presence data to export', 2000);
        return;
      }

      downloadCSVLocal(rows, 'z1n_presence_key' + currentKeyId + '_' + new Date().toISOString().slice(0, 10) + '.csv');
      window.Z1N.showToast('Key Presence CSV downloaded (' + (rows.length - 1) + ' events)', 3000);

    } catch (e) {
      console.error('downloadKeyPresenceCSV error:', e);
      window.Z1N.showToast('Export failed: ' + e.message.slice(0, 60), 4000, true);
    }
  };


  // ─────────────────────────────────────────────────────────────────
  // 3. FIELD SIGNALS CSV
  //
  // Kolommen:
  //   signal_hash | epoch | key_id | key_glyphs |
  //   intent | intent_symbol | type | reply_to_hash | reply_to_key_id |
  //   content | attest_count |
  //   your_key_attested | your_key_replied | timestamp_ago
  //
  // your_key_attested / your_key_replied: boolean (YES/NO)
  // — zodat NBI of human direct ziet waar nog geen respons op is
  // ─────────────────────────────────────────────────────────────────

  window.downloadFieldSignalsCSV = async function (epochFrom, epochTo) {
    var currentKeyId = window.Z1N && window.Z1N.keyId;
    var API_BASE     = window.Z1N && window.Z1N.API_BASE;
    if (!currentKeyId || !API_BASE) { window.Z1N.showToast('No key loaded', 2000); return; }

    window.Z1N.showToast('Building Field Signals CSV...', 2000);

    try {
      // Haal alle signals op (gefilterd op epoch als meegegeven)
      var params = new URLSearchParams();
      params.set('limit', '2000');
      if (epochFrom) params.set('minEpoch', String(epochFrom));
      if (epochTo)   params.set('maxEpoch', String(epochTo));

      var sigRes  = await fetch(API_BASE + '/signals?' + params.toString(), { cache: 'no-store' });
      var sigData = await sigRes.json();
      var signals = sigData.signals || [];

      if (signals.length === 0) {
        window.Z1N.showToast('No signals found for selected range', 2000);
        return;
      }

      // Haal sent attests op voor this key — om your_key_attested te kunnen vullen
      var myAttestHashes = new Set();
      try {
        var attRes  = await fetch(API_BASE + '/attestations?fromKeyIds=' + currentKeyId + '&limit=1000', { cache: 'no-store' });
        if (attRes.ok) {
          var attData = await attRes.json();
          (attData.attestations || []).forEach(function (a) {
            if (a.signalHash) myAttestHashes.add(a.signalHash.toLowerCase());
          });
        }
      } catch (e) { console.warn('Could not load own attests for field CSV'); }

      // Haal sent signals op — voor your_key_replied
      var myReplyToHashes = new Set();
      try {
        var myRes  = await fetch(API_BASE + '/signals?keyId=' + currentKeyId + '&limit=1000', { cache: 'no-store' });
        if (myRes.ok) {
          var myData = await myRes.json();
          (myData.signals || []).forEach(function (s) {
            var isReply = s.replyTo && s.replyTo !== '0x' + '0'.repeat(64);
            if (isReply) myReplyToHashes.add(s.replyTo.toLowerCase());
          });
        }
      } catch (e) { console.warn('Could not load own replies for field CSV'); }

      var intentNames   = ['ΩC (Collective)', 'ΩI (Individual)', 'ΩK (Co-Create)', 'ΩS (Silence)'];
      var intentSymbols = ['ΩC', 'ΩI', 'ΩK', 'ΩS'];

      var rows = [[
        'signal_hash', 'epoch', 'key_id', 'key_glyphs',
        'intent', 'intent_symbol', 'type',
        'reply_to_hash', 'reply_to_key_id',
        'content', 'attest_count',
        'your_key_attested', 'your_key_replied', 'timestamp_ago'
      ]];

      // Cache voor glyphs (al gevuld door loadKeyData → keyGlyphsCache)
      var keyGlyphsCache = window.keyGlyphsCache || {};

      signals.forEach(function (s) {
        var isReply       = s.replyTo && s.replyTo !== '0x' + '0'.repeat(64);
        var myAttested    = myAttestHashes.has((s.hash || '').toLowerCase()) ? 'YES' : 'NO';
        var myReplied     = myReplyToHashes.has((s.hash || '').toLowerCase()) ? 'YES' : 'NO';
        rows.push([
          s.hash || '',
          s.epoch || '',
          s.keyId || '',
          keyGlyphsCache[s.keyId] || '',
          intentNames[s.intent] || '',
          intentSymbols[s.intent] || '',
          isReply ? 'reply' : 'new',
          isReply ? s.replyTo : '',
          isReply ? (s.replyToKeyId || '') : '',
          s.cid || '[Silence]',
          s.attestCount || 0,
          myAttested,
          myReplied,
          s.timeAgo || ''
        ]);
      });

      var epochLabel = (epochFrom || epochTo)
        ? '_e' + (epochFrom || '0') + '-' + (epochTo || 'now')
        : '_all';

      downloadCSVLocal(rows, 'z1n_field_signals' + epochLabel + '_' + new Date().toISOString().slice(0, 10) + '.csv');
      window.Z1N.showToast('Field Signals CSV downloaded (' + signals.length + ' signals)', 3000);

    } catch (e) {
      console.error('downloadFieldSignalsCSV error:', e);
      window.Z1N.showToast('Export failed: ' + e.message.slice(0, 60), 4000, true);
    }
  };


  // ─────────────────────────────────────────────────────────────────
  // 4. EPOCH FILTER MODAL voor Field Signals
  // ─────────────────────────────────────────────────────────────────

  window.openFieldSignalsExportModal = function () {
    var existing = document.getElementById('fieldSignalsExportModal');
    if (existing) { existing.style.display = 'flex'; return; }

    var modal = document.createElement('div');
    modal.id = 'fieldSignalsExportModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML =
      '<div class="modal" style="max-width:380px;">' +
        '<div class="modal-header">' +
          '<span class="modal-title" style="color:var(--keys-accent);">↓ Field Signals CSV</span>' +
          '<button class="modal-close" onclick="document.getElementById(\'fieldSignalsExportModal\').style.display=\'none\'">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding:20px;">' +
          '<p style="font-size:12px;color:var(--text-soft);margin-bottom:16px;line-height:1.6;">' +
            'Alle PoG signals in het veld. Kolommen: signal hash, epoch, key, glyphs, intent, type (new/reply), content, attests, ' +
            '<strong style="color:var(--keys-accent);">your_key_attested</strong> en ' +
            '<strong style="color:var(--keys-accent);">your_key_replied</strong>.' +
          '</p>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
            '<div>' +
              '<div style="font-size:11px;color:var(--text-soft);margin-bottom:4px;">Epoch from (leeg = alle)</div>' +
              '<input type="number" id="fieldEpochFrom" placeholder="1" min="0" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--card-border);background:rgba(15,23,42,0.6);color:var(--text-main);font-size:13px;">' +
            '</div>' +
            '<div>' +
              '<div style="font-size:11px;color:var(--text-soft);margin-bottom:4px;">Epoch to (leeg = huidig)</div>' +
              '<input type="number" id="fieldEpochTo" placeholder="nu" min="0" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--card-border);background:rgba(15,23,42,0.6);color:var(--text-main);font-size:13px;">' +
            '</div>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--text-soft);margin-bottom:20px;padding:8px 10px;background:rgba(255,213,86,0.08);border-radius:6px;line-height:1.5;">' +
            '⚡ Max 2000 signals per export. Gebruik epoch-filters voor grote datasets.' +
          '</div>' +
          '<button onclick="' +
            'var ef=document.getElementById(\'fieldEpochFrom\').value;' +
            'var et=document.getElementById(\'fieldEpochTo\').value;' +
            'document.getElementById(\'fieldSignalsExportModal\').style.display=\'none\';' +
            'downloadFieldSignalsCSV(ef||null,et||null);" ' +
            'class="btn-submit" style="width:100%;">↓ Download CSV</button>' +
        '</div>' +
      '</div>';

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
  };


  // ─────────────────────────────────────────────────────────────────
  // 5. OVERVIEW TAB HTML PATCH
  //
  // Injecteert de twee download-knoppen en de Direct Channel checkbox
  // naast de bestaande Mint Artefact / Mint Canon knoppen in de
  // artefact-preview-card.
  //
  // Wacht tot DOM gereed is.
  // ─────────────────────────────────────────────────────────────────

  function patchOverviewTab () {
    var mintBtn = document.getElementById('btnMintLiveArtefactOverview');
    if (!mintBtn) return; // DOM nog niet klaar

    // Voorkom dubbele injectie
    if (document.getElementById('overviewActionRow')) return;

    // Voeg action row toe NA de huidige mint-knop
    var actionRow = document.createElement('div');
    actionRow.id = 'overviewActionRow';
    actionRow.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:6px;';

    actionRow.innerHTML =
      // Mint Canon knop (zelfde stijl als Canon tab button)
      '<button class="btn btn-canon" id="btnMintCanonOverview" style="width:100%;" ' +
        'onclick="sessionStorage.setItem(\'canonReturnUrl\', window.location.href);' +
        'window.location.href=\'mint-canon.html?key=\'+(window.Z1N&&window.Z1N.keyId||0);">' +
        'Ω Mint Canon' +
      '</button>' +

      // Divider
      '<div style="height:1px;background:rgba(148,163,184,0.15);margin:4px 0;"></div>' +

      // Direct Channel checkbox
      '<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-soft);cursor:pointer;padding:0 2px;">' +
        '<input type="checkbox" id="presenceIncludeDirect" style="accent-color:var(--keys-accent);width:14px;height:14px;">' +
        '<span>Include Direct Channel in Presence CSV</span>' +
      '</label>' +

      // CSV download knoppen
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:2px;">' +
        '<button class="btn btn-secondary" style="font-size:11px;padding:8px 6px;width:100%;" ' +
          'onclick="downloadKeyPresenceCSV()">' +
          '↓ Key Presence' +
        '</button>' +
        '<button class="btn btn-secondary" style="font-size:11px;padding:8px 6px;width:100%;" ' +
          'onclick="openFieldSignalsExportModal()">' +
          '↓ Field Signals' +
        '</button>' +
      '</div>';

    // Plak na de mint-knop
    mintBtn.parentNode.insertBefore(actionRow, mintBtn.nextSibling);
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. CSV HELPER (lokale kopie, werkt ook als global nog niet loaded is)
  // ─────────────────────────────────────────────────────────────────

  function downloadCSVLocal (rows, filename) {
    var csv  = rows.map(function (row) {
      return row.map(function (val) {
        if (val === null || val === undefined) return '';
        var s = String(val).replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ');
        if (s.includes(',') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────────
  // INIT — patch zodra DOM gereed is
  // ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchOverviewTab);
  } else {
    // DOM al klaar, maar wallet/key nog niet — wacht op mainContent
    var observer = new MutationObserver(function (mutations, obs) {
      var mc = document.getElementById('mainContent');
      if (mc && mc.style.display !== 'none') {
        patchOverviewTab();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    // Fallback na 3 seconden
    setTimeout(patchOverviewTab, 3000);
  }

})();
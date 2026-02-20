/**
 * Z1N Protocol - Wallet Color System
 * 
 * Assigns consistent colors to wallets across pages.
 * Wallets are stored in localStorage to maintain color consistency.
 * Maximum 10 wallets supported.
 */

(function(global) {
  'use strict';

  var STORAGE_KEY = 'z1n_wallet_registry';
  var MAX_WALLETS = 10;

  // Color palette for wallets 1-10
  var WALLET_COLORS = [
    { name: 'gold',   hex: '#ffd556', bg: 'rgba(255, 213, 86, 0.15)',  border: 'rgba(255, 213, 86, 0.4)' },
    { name: 'green',  hex: '#5ee8a0', bg: 'rgba(94, 232, 160, 0.15)', border: 'rgba(94, 232, 160, 0.4)' },
    { name: 'blue',   hex: '#7bb8fc', bg: 'rgba(123, 184, 252, 0.15)',  border: 'rgba(123, 184, 252, 0.4)' },
    { name: 'purple', hex: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.4)' },
    { name: 'pink',   hex: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)', border: 'rgba(244, 114, 182, 0.4)' },
    { name: 'orange', hex: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)',  border: 'rgba(251, 146, 60, 0.4)' },
    { name: 'cyan',   hex: '#22d3ee', bg: 'rgba(34, 211, 238, 0.15)',  border: 'rgba(34, 211, 238, 0.4)' },
    { name: 'lime',   hex: '#a3e635', bg: 'rgba(163, 230, 53, 0.15)',  border: 'rgba(163, 230, 53, 0.4)' },
    { name: 'indigo', hex: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', border: 'rgba(129, 140, 248, 0.4)' },
    { name: 'teal',   hex: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.15)',  border: 'rgba(45, 212, 191, 0.4)' }
  ];

  // Color for disconnected/unknown wallets
  var DISCONNECTED_COLOR = { 
    name: 'red', 
    hex: '#f87171', 
    bg: 'rgba(248, 113, 113, 0.15)', 
    border: 'rgba(248, 113, 113, 0.4)' 
  };

  /**
   * Load wallet registry from localStorage
   */
  function loadRegistry() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        var parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, MAX_WALLETS);
        }
      }
    } catch (e) {
      console.warn('Could not load wallet registry:', e);
    }
    return [];
  }

  /**
   * Save wallet registry to localStorage
   */
  function saveRegistry(wallets) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets.slice(0, MAX_WALLETS)));
    } catch (e) {
      console.warn('Could not save wallet registry:', e);
    }
  }

  /**
   * Register a wallet (adds if new, returns index)
   * @param {string} address - Wallet address
   * @returns {number} - Index (0-9) or -1 if full
   */
  function registerWallet(address) {
    if (!address) return -1;
    var lower = address.toLowerCase();
    var registry = loadRegistry();
    
    // Check if already registered
    var existingIndex = registry.findIndex(function(w) { 
      return w.toLowerCase() === lower; 
    });
    if (existingIndex !== -1) {
      return existingIndex;
    }
    
    // Check if we have room
    if (registry.length >= MAX_WALLETS) {
      console.warn('Maximum wallets (' + MAX_WALLETS + ') reached');
      return -1;
    }
    
    // Add new wallet
    registry.push(address);
    saveRegistry(registry);
    return registry.length - 1;
  }

  /**
   * Register multiple wallets at once
   * @param {string[]} addresses - Array of wallet addresses
   * @returns {number[]} - Array of indices
   */
  function registerWallets(addresses) {
    if (!addresses || !addresses.length) return [];
    return addresses.map(function(addr) {
      return registerWallet(addr);
    });
  }

  /**
   * Get the index of a wallet (without registering)
   * @param {string} address - Wallet address
   * @returns {number} - Index (0-9) or -1 if not found
   */
  function getWalletIndex(address) {
    if (!address) return -1;
    var lower = address.toLowerCase();
    var registry = loadRegistry();
    return registry.findIndex(function(w) { 
      return w.toLowerCase() === lower; 
    });
  }

  /**
   * Get color for a wallet by address
   * @param {string} address - Wallet address
   * @param {boolean} autoRegister - If true, register wallet if not found
   * @returns {object} - Color object with hex, bg, border properties
   */
  function getWalletColor(address, autoRegister) {
    if (!address) return DISCONNECTED_COLOR;
    
    var index = getWalletIndex(address);
    
    if (index === -1 && autoRegister) {
      index = registerWallet(address);
    }
    
    if (index === -1 || index >= WALLET_COLORS.length) {
      return DISCONNECTED_COLOR;
    }
    
    return WALLET_COLORS[index];
  }

  /**
   * Get color by index directly
   * @param {number} index - Wallet index (0-9)
   * @returns {object} - Color object
   */
  function getColorByIndex(index) {
    if (index < 0 || index >= WALLET_COLORS.length) {
      return DISCONNECTED_COLOR;
    }
    return WALLET_COLORS[index];
  }

  /**
   * Get all registered wallets with their colors
   * @returns {Array} - Array of {address, index, color} objects
   */
  function getAllWallets() {
    var registry = loadRegistry();
    return registry.map(function(addr, i) {
      return {
        address: addr,
        index: i,
        color: WALLET_COLORS[i] || DISCONNECTED_COLOR
      };
    });
  }

  /**
   * Remove a wallet from registry
   * Note: This will shift colors for wallets after this one!
   * @param {string} address - Wallet address to remove
   */
  function removeWallet(address) {
    if (!address) return;
    var lower = address.toLowerCase();
    var registry = loadRegistry();
    var filtered = registry.filter(function(w) { 
      return w.toLowerCase() !== lower; 
    });
    saveRegistry(filtered);
  }

  /**
   * Clear all registered wallets
   */
  function clearRegistry() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /**
   * Get the disconnected color
   * @returns {object} - Color object for disconnected state
   */
  function getDisconnectedColor() {
    return DISCONNECTED_COLOR;
  }

  /**
   * Shorten an address for display
   * @param {string} address - Full address
   * @returns {string} - Shortened address (0x1234...5678)
   */
  function shortAddr(address) {
    if (!address) return '—';
    return address.slice(0, 6) + '...' + address.slice(-4);
  }

  /**
   * Create a colored wallet badge HTML
   * @param {string} address - Wallet address
   * @param {boolean} autoRegister - Register if not found
   * @returns {string} - HTML string for the badge
   */
  function createWalletBadge(address, autoRegister) {
    var color = getWalletColor(address, autoRegister);
    var index = getWalletIndex(address);
    var label = index >= 0 ? 'W' + (index + 1) : '?';
    
    return '<span class="wallet-badge" style="' +
      'background:' + color.bg + ';' +
      'border:1px solid ' + color.border + ';' +
      'color:' + color.hex + ';">' +
      '<span class="wallet-dot" style="background:' + color.hex + ';"></span>' +
      '<span class="wallet-label">' + label + '</span>' +
      '<span class="wallet-addr">' + shortAddr(address) + '</span>' +
      '</span>';
  }

  // Export to global
  global.Z1NWallets = {
    MAX_WALLETS: MAX_WALLETS,
    COLORS: WALLET_COLORS,
    DISCONNECTED: DISCONNECTED_COLOR,
    register: registerWallet,
    registerAll: registerWallets,
    getIndex: getWalletIndex,
    getColor: getWalletColor,
    getColorByIndex: getColorByIndex,
    getAll: getAllWallets,
    remove: removeWallet,
    clear: clearRegistry,
    shortAddr: shortAddr,
    createBadge: createWalletBadge
  };

})(typeof window !== 'undefined' ? window : this);


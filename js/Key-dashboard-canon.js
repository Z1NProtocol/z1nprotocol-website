// ═══════════════════════════════════════════════════════════════════════════
// Z1N CANON MODULE - Minimal wrapper
// Version: 2.3.0-Ω
// NOTE: All canon logic is now in key-dashboard.js
// This file just ensures setCanonSort calls the right function
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';
  
  // The setCanonSort function is already defined in key-dashboard.js
  // This file exists for backwards compatibility only
  
  // If for some reason setCanonSort doesn't exist, create a stub
  if (typeof window.setCanonSort !== 'function') {
    console.warn('Z1NCanon: setCanonSort not found in key-dashboard.js');
  }
  
  // Export empty Z1NCanon object for compatibility
  window.Z1NCanon = {
    init: function() { console.log('Z1NCanon: Using key-dashboard.js canon logic'); },
    refresh: function() { console.log('Z1NCanon: refresh delegated to key-dashboard.js'); },
    setSort: function(sortType) { 
      if (typeof window.setCanonSort === 'function') {
        window.setCanonSort(sortType);
      }
    }
  };

})();


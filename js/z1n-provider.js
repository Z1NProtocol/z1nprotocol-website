// Z1N Protocol — Shared wallet provider
// Leest z1n_preferred_wallet uit localStorage en geeft juiste provider terug
window.Z1NGetProvider = function() {
  // Eerst: check URL wallet parameter — meest betrouwbare signal
  var urlParams = new URLSearchParams(window.location.search);
  var urlWallet = urlParams.get('wallet') ? urlParams.get('wallet').toLowerCase() : null;

  if (urlWallet) {
    // Bouw lijst van alle providers
    var allProviders = [];
    if (window.ethereum && window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      allProviders = allProviders.concat(window.ethereum.providers);
    } else if (window.ethereum) {
      allProviders.push(window.ethereum);
    }
    if (window.phantom && window.phantom.ethereum && allProviders.indexOf(window.phantom.ethereum) === -1) {
      allProviders.push(window.phantom.ethereum);
    }
    // Zoek provider met matching account
    for (var i = 0; i < allProviders.length; i++) {
      try {
        var accs = allProviders[i]._state && allProviders[i]._state.accounts;
        if (accs && accs.some(function(a) { return a.toLowerCase() === urlWallet; })) {
          return allProviders[i];
        }
      } catch(e) {}
    }
    // Phantom via selectedAddress
    if (window.phantom && window.phantom.ethereum) {
      var sel = window.phantom.ethereum.selectedAddress;
      if (sel && sel.toLowerCase() === urlWallet) return window.phantom.ethereum;
    }
  }

  // Fallback: localStorage voorkeur
  var preferred = localStorage.getItem('z1n_preferred_wallet') || 'metamask';
  if (preferred === 'phantom' && window.phantom && window.phantom.ethereum) {
    return window.phantom.ethereum;
  }
  if (preferred === 'coinbase' && window.ethereum) {
    var cb = window.ethereum.providers && window.ethereum.providers.find(function(p) { return p.isCoinbaseWallet; });
    if (cb) return cb;
  }
  if (preferred === 'brave' && window.ethereum) {
    var br = window.ethereum.providers && window.ethereum.providers.find(function(p) { return p.isBraveWallet; });
    if (br) return br;
  }
  if (window.ethereum && window.ethereum.providers && window.ethereum.providers.length) {
    var mm = window.ethereum.providers.find(function(p) { return p.isMetaMask && !p.isBraveWallet; });
    if (mm) return mm;
    return window.ethereum.providers[0];
  }
  if (window.ethereum) return window.ethereum;
  if (window.phantom && window.phantom.ethereum) return window.phantom.ethereum;
  return null;
};
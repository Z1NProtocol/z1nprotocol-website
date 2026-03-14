// Z1N Protocol — Shared wallet provider
// Leest z1n_preferred_wallet uit localStorage en geeft juiste provider terug
window.Z1NGetProvider = function() {
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
  // Default: MetaMask
  if (window.ethereum && window.ethereum.providers && window.ethereum.providers.length) {
    var mm = window.ethereum.providers.find(function(p) { return p.isMetaMask && !p.isBraveWallet; });
    if (mm) return mm;
    return window.ethereum.providers[0];
  }
  if (window.ethereum) return window.ethereum;
  if (window.phantom && window.phantom.ethereum) return window.phantom.ethereum;
  return null;
};
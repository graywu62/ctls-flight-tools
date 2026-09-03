(function() {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  var inTool = /\/CTLSi-(?:WB|FUEL|TOL|CHECK)\//.test(location.pathname);
  var workerUrl = inTool ? '../sw.js' : './sw.js';
  navigator.serviceWorker.register(workerUrl, { scope: inTool ? '../' : './' }).catch(function(error) {
    console.warn('Offline service unavailable:', error.message);
  });
})();

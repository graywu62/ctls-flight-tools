(function() {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function(error) {
      console.warn('Offline service unavailable:', error.message);
    });
  });

/** Enregistre l’enveloppe webapp BOO-P sur les origines HTTP et HTTPS. */
(() => {
  'use strict';

  if (!('serviceWorker' in navigator) || !['http:', 'https:'].includes(location.protocol)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(registration => {
        window.dispatchEvent(new CustomEvent('boop:pwa-ready', { detail: { registration } }));
      })
      .catch(error => {
        console.warn('BOO-P : le mode webapp hors connexion n’a pas pu être activé.', error);
      });
  });
})();

/** État local partagé avec le service worker, hors du cache des pages. */
(function (root) {
  'use strict';
  root.BoopPushState = {
    async access(value, key = 'device', claim = false) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('boop-push-state', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onerror = () => reject(new Error('Le stockage des notifications est indisponible.'));
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('state', value === undefined ? 'readonly' : 'readwrite');
          const store = tx.objectStore('state');
          const op = value === undefined || claim ? store.get(key) : store.put(value, key);
          let claimed = false;
          if (claim) op.onsuccess = () => { if (!op.result) { store.put(value, key); claimed = true; } };
          tx.oncomplete = () => { db.close(); resolve(claim ? claimed : value === undefined ? op.result || {} : value); };
          tx.onerror = () => { db.close(); reject(new Error('Les réglages de notifications ne peuvent pas être enregistrés.')); };
        };
      });
    }
  };
})(typeof window === 'undefined' ? self : window);

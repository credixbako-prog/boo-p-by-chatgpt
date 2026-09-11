/** FCM livre les alertes ; Supabase conserve l'identité du lecteur. */
window.BT = window.BT || {};
BT.push = (() => {
  'use strict';
  const config = {apiKey:'AIzaSyDmv9D8jE1E_jszD2SqmAfW046PDYuCk1M',projectId:'boo-p-a4461',messagingSenderId:'954193229244',appId:'1:954193229244:web:4a657fe9a66dd79fa9a7b9'};
  const vapidKey = 'BPCqo0FJfM9gO08jXADyty8qWMKNisrSZYIaj3zl63NvIAcO01s1kUZCv-MlkyViO1BFjrQuaqvcNuWH1mXHcpk';
  let sdkPromise, busy = false;
  const state = value => window.BoopPushState.access(value);
  const userId = () => BT.auth?.getCurrentUser?.()?.id;
  function support() {
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'Sur iPhone ou iPad, ajoutez BOO-P à l’écran d’accueil puis ouvrez cette application. Sinon, utilisez un navigateur compatible en HTTPS.';
    if (Notification.permission === 'denied') return 'Notifications bloquées : autorisez-les dans les réglages de ce site sur votre navigateur.';
    return '';
  }
  async function api(action, data = {}) {
    const client = BT.auth.getClient();
    const {data:sessionData,error} = await client.auth.getSession();
    if (error || !sessionData.session) throw new Error('Connectez-vous pour activer les notifications.');
    const response = await fetch(`${window.BOOP_SUPABASE_CONFIG.url}/functions/v1/push-notifications`, {
      method:'POST',headers:{'Content-Type':'application/json',apikey:window.BOOP_SUPABASE_CONFIG.publishableKey,Authorization:`Bearer ${sessionData.session.access_token}`},
      body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(25000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Le service de notifications est indisponible.');
    return result;
  }
  async function sdk() {
    if (!sdkPromise) sdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging.js')
    ]).then(async ([app,messaging]) => {
      if (!await messaging.isSupported()) throw new Error('Ce navigateur ne prend pas en charge les notifications.');
      return {...messaging,instance:messaging.getMessaging(app.initializeApp(config,'boop-push'))};
    }).catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }
  async function registration() {
    return Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Rechargez BOO-P pour terminer sa mise à jour.')),12000))]);
  }
  async function enable(preferences) {
    if (busy) return;
    if (!userId()) throw new Error('Connectez-vous pour activer les notifications.');
    const reason = support(); if (reason) throw new Error(reason);
    busy = true;
    const owner = userId();
    try {
      // Appel immédiat dans le geste utilisateur, avant tout accès réseau.
      if (await Notification.requestPermission() !== 'granted') throw new Error('Les notifications restent désactivées.');
      const status = await api('status');
      if (!status.ready) throw new Error('La clé serveur Firebase reste à configurer dans Supabase.');
      const previous = await state();
      const lib = await sdk();
      if (previous.owner && previous.owner !== owner) await lib.deleteToken(lib.instance);
      const token = await lib.getToken(lib.instance,{vapidKey,serviceWorkerRegistration:await registration()});
      if (!token || owner !== userId()) throw new Error('La session a changé. Réessayez.');
      const deviceId = previous.owner === owner && previous.deviceId ? previous.deviceId : crypto.randomUUID();
      await api('register',{deviceId,token,preferences});
      if (owner !== userId()) { await state({enabled:false}); throw new Error('La session a changé. Réessayez.'); }
      await state({enabled:true,owner,deviceId});
    } finally { busy = false; }
  }
  async function disable() {
    const previous = await state();
    await state({...previous,enabled:false});
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      (await reg?.getNotifications() || []).forEach(item=>item.close());
      const subscription = await reg?.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
    if (previous.deviceId && previous.owner === userId()) await api('disable',{deviceId:previous.deviceId});
  }
  async function test() {
    const current = await state();
    if (!current.enabled || current.owner !== userId()) throw new Error('Activez d’abord les notifications sur cet appareil.');
    return api('test',{deviceId:current.deviceId});
  }
  async function preferences(value) { if (userId()) await api('preferences',{preferences:value}); }
  async function describe() {
    const current = await state();
    return {enabled:current.enabled && current.owner === userId() && window.Notification?.permission === 'granted',reason:support()};
  }
  async function reconcile() {
    const current = await state();
    if (current.owner && current.owner !== userId()) { await disable(); return; }
    if (!current.enabled) return;
    if (support()) { await disable(); return; }
    const lib = await sdk();
    const token = await lib.getToken(lib.instance,{vapidKey,serviceWorkerRegistration:await registration()});
    if (userId() !== current.owner) { await state({...current,enabled:false}); return; }
    await api('register',{deviceId:current.deviceId,token,preferences:BT.store?.getSettings?.().notifications});
  }
  async function renderControls() {
    const panel = document.querySelector('[data-push-controls]'); if (!panel) return;
    try {
      const info = await describe(); if (!panel.isConnected) return;
      panel.querySelector('[data-push-status]').textContent = !userId() ? 'Connectez-vous pour recevoir des alertes sur cet appareil.' : info.reason || (info.enabled ? 'Notifications activées sur cet appareil.' : 'Recevez vos alertes même lorsque BOO-P est fermé.');
      panel.querySelector('[data-push-action="enable"]').hidden = Boolean(info.enabled);
      panel.querySelector('[data-push-action="enable"]').disabled = busy || !userId() || Boolean(info.reason);
      for (const action of ['disable','test']) { const button=panel.querySelector(`[data-push-action="${action}"]`); button.hidden = !info.enabled; button.disabled=busy; }
    } catch { panel.querySelector('[data-push-status]').textContent = 'Le stockage des notifications est indisponible dans ce navigateur.'; }
  }
  document.addEventListener('click', async event => {
    const button=event.target.closest('[data-push-action]'); if (!button || busy) return;
    const panel=button.closest('[data-push-controls]');
    panel.querySelectorAll('button').forEach(item=>item.disabled=true);
    try {
      const action=button.dataset.pushAction;
      if(action==='enable')await enable(BT.store.getSettings().notifications);
      if(action==='disable')await disable();
      if(action==='test')await test();
      await renderControls();
      if(action==='test')panel.querySelector('[data-push-status]').textContent='Test envoyé à Firebase. La notification doit apparaître sur cet appareil.';
    } catch(error) { await renderControls(); panel.querySelector('[data-push-status]').textContent=error.message || 'Action indisponible. Réessayez.'; }
  });
  window.addEventListener('load',()=>BT.auth.ready().then(()=>reconcile()).catch(()=>{}).finally(renderControls),{once:true});
  return {enable,disable,test,preferences,describe,reconcile,renderControls};
})();

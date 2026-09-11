/* Loaded by the existing BOO-P worker. FCM messages are data-only to avoid duplicate alerts. */
importScripts('./js/push-state.js');
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload; try { payload = event.data?.json()?.data; } catch { return; }
    if (payload?.boop !== '1') return;
    const state = await self.BoopPushState.access();
    if (!state.enabled || state.owner !== payload.owner) return;
    await self.registration.showNotification('BOO-P', {
      body:payload.test === '1' ? 'Les notifications sont prêtes. Bonne lecture !' : 'Une nouvelle activité vous attend dans BOO-P.',
      icon:new URL('assets/icons/boo-p-icon-192.png',self.registration.scope).href,
      tag:'boop-'+String(payload.id || 'activity'),
      data:{route:payload.route,owner:payload.owner},
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const current = await self.BoopPushState.access();
    if (!current.enabled || current.owner !== event.notification.data?.owner) return;
    const route = String(event.notification.data?.route || '#home');
    const safeRoute = /^#[a-z][a-z0-9-]*(?:\?[^\r\n]*)?$/i.test(route) ? route : '#home';
    const target = new URL('app.html'+safeRoute,self.registration.scope);
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing = windows.find(client => { const url = new URL(client.url); return url.origin === target.origin && url.pathname === target.pathname; });
    if (existing) { await existing.navigate(target.href); await existing.focus(); }
    else await self.clients.openWindow(target.href);
  })());
});

/** Invitation facultative, mémorisée par compte ; aucune autorisation implicite. */
window.BT = window.BT || {};
BT.pushInvitation = (() => {
  'use strict';
  const flag = 'boop_push_invitation_seen_v1';
  let checking = false, finished = false, timer;
  const owner = () => BT.auth?.getCurrentUser?.()?.id;
  const remember = async id => {
    if (owner() !== id) return;
    // Préférence d'interface uniquement : jamais utilisée pour autoriser un accès.
    const {error} = await BT.auth.getClient().auth.updateUser({data:{[flag]:true}});
    if (error) throw error;
  };
  function open(id, reason) {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'app-dialog push-invitation';
    dialog.setAttribute('aria-labelledby','push-invitation-title');
    dialog.setAttribute('aria-describedby','push-invitation-description');
    dialog.innerHTML = `<div class="push-invitation__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg></div><p class="push-invitation__eyebrow">Votre cercle de lecture</p><h2 id="push-invitation-title">Gardons le lien</h2><p id="push-invitation-description">Un encouragement, une réponse à votre Trace… Recevez une alerte pour retrouver ces échanges, même quand BOO-P est fermé.</p><p class="push-invitation__privacy">Avec votre accord, Google Firebase utilise un identifiant technique de cet appareil pour livrer les alertes. Vos carnets restent privés.</p><p data-invitation-status role="status" aria-live="polite"></p><div class="push-invitation__actions"><button class="button button--primary" type="button" data-invitation-enable>Activer les notifications</button><button class="button button--ghost" type="button" data-invitation-dismiss autofocus>Pas maintenant</button></div><p class="push-invitation__hint">Vous pourrez changer d’avis dans Profil → Préférences de notifications.</p>`;
    const primary = dialog.querySelector('[data-invitation-enable]');
    const status = dialog.querySelector('[data-invitation-status]');
    if (reason) { primary.textContent = 'Voir les réglages'; status.textContent = reason; }
    dialog.querySelector('[data-invitation-dismiss]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{ dialog.remove(); if (previousFocus?.isConnected) previousFocus.focus(); },{once:true});
    primary.addEventListener('click',async()=>{
      if (owner() !== id) { dialog.close(); return; }
      if (reason) { dialog.close(); location.hash = '#profile?section=settings'; return; }
      primary.disabled = true;
      dialog.querySelector('[data-invitation-dismiss]').disabled = true;
      status.textContent = 'Activation en cours…';
      try {
        // Ne pas insérer d'attente avant enable : la permission exige ce geste utilisateur.
        await BT.push.enable(BT.store.getSettings().notifications);
        if (!dialog.isConnected) return;
        status.textContent = 'Les notifications sont activées sur cet appareil.';
        primary.hidden = true;
        dialog.querySelector('[data-invitation-dismiss]').textContent = 'Continuer ma lecture';
        BT.push.renderControls();
      } catch (error) {
        status.textContent = error.message || 'Activation impossible pour le moment. Vous pourrez réessayer depuis votre profil.';
        primary.disabled = false;
      } finally { dialog.querySelector('[data-invitation-dismiss]').disabled = false; }
    });
    document.body.append(dialog);
    dialog.showModal();
  }
  async function check() {
    if (checking || finished || document.body.dataset.authMode !== 'account' || !owner()) return;
    if (document.visibilityState === 'hidden' || document.querySelector('dialog[open]') || location.hash.startsWith('#session')) return;
    checking = true;
    const id = owner(), key = 'invitation:'+id;
    try {
      const local = await window.BoopPushState.access(undefined,key);
      const {data,error} = await BT.auth.getClient().auth.getUser();
      // Une erreur réseau reporte l'invitation : ne pas répéter un choix déjà fait ailleurs.
      if (error || data?.user?.id !== id || owner() !== id) return;
      if (data.user.user_metadata?.[flag]) { finished = true; return; }
      if (local.seen) { finished = true; void remember(id).catch(()=>{}); return; }
      const info = await BT.push.describe();
      if (owner() !== id) return;
      if (info.enabled || window.Notification?.permission === 'denied') { finished = true; void remember(id).catch(()=>{}); return; }
      if (document.visibilityState === 'hidden' || document.querySelector('dialog[open]') || location.hash.startsWith('#session')) return;
      const claimed = await window.BoopPushState.access({seen:true},key,true);
      if (!claimed) { finished = true; return; }
      if (owner() !== id) return;
      open(id,info.reason);
      finished = true;
      void remember(id).catch(()=>{});
    } catch { /* L'invitation ne doit jamais bloquer l'accès à la lecture. */ }
    finally { checking = false; }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(check,1200); }
  document.addEventListener('visibilitychange',schedule);
  document.addEventListener('close',schedule,true);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('online',schedule);
  return {schedule,check};
})();

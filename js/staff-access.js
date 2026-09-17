/** Staff tools. The server checks every permission; no sensitive data is persisted. */
window.BT = window.BT || {};
BT.staffAccess = (() => {
  'use strict';
  const PAGE_SIZE = 30;
  const statuses = { pending:'À examiner', reviewed:'Traités', dismissed:'Classés sans suite' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const who = () => BT.auth?.isAuthenticated?.() && !BT.auth?.isGuest?.() ? BT.auth.getCurrentUser()?.id : null;
  let owner = null, epoch = 0, accessRequest = 0, openRequest = 0, subscribedClient = null;
  let access = { isAdmin:false, isModerator:false }, panel = null;

  function close() {
    openRequest++;
    const previous = panel;
    panel = null;
    if (!previous) return;
    previous.request++;
    previous.items = [];
    previous.confirmation = null;
    previous.dialog.replaceChildren();
    if (previous.dialog.open) previous.dialog.close();
    previous.dialog.remove();
    document.querySelector(`[data-staff-open="${previous.mode}"]`)?.focus();
  }
  function clear() {
    epoch++;
    accessRequest++;
    owner = null;
    access = { isAdmin:false, isModerator:false };
    close();
    mount();
    window.dispatchEvent(new Event('boop:staff-access-changed'));
  }
  function context() {
    const user = who();
    if (owner !== user) clear();
    owner = user;
    return { user, epoch };
  }
  function unchanged(expected) {
    if (!expected.user || who() !== expected.user || epoch !== expected.epoch) {
      if (who() !== owner) clear();
      throw new Error('Votre compte a changé. Rouvrez cet espace.');
    }
  }
  function denied(error, response) {
    return error?.code === '42501' || error?.status === 403 || response?.status === 403;
  }
  function friendly(error) {
    const message = String(error?.message || '');
    if (/last.?admin|dernier.*admin/i.test(message)) return new Error('Conservez au moins un administrateur. Attribuez ce rôle à un autre compte avant de le retirer.');
    if (/not.?found|introuvable|does not exist/i.test(message)) return new Error('Cet élément n’est plus disponible. Actualisez la liste.');
    return new Error('La demande n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.');
  }
  function revoke(reload = true) {
    clear();
    if (reload) window.setTimeout(() => refresh().catch(() => {}), 0);
  }
  async function rpc(name, args, expected = context()) {
    if (!expected.user) throw new Error('Connectez-vous pour accéder à cet espace.');
    await BT.auth.ready();
    unchanged(expected);
    const client = BT.auth.getClient();
    if (!client) throw new Error('La connexion à BOO-P n’est pas prête.');
    const response = await client.rpc(name, args);
    unchanged(expected);
    if (response.error || response.status === 403) {
      if (denied(response.error, response)) {
        revoke(name !== 'get_boop_staff_access');
        throw new Error('Vos droits ont changé. Cet espace a été fermé.');
      }
      throw friendly(response.error);
    }
    return response.data;
  }
  async function refresh() {
    if (BT.auth?.isGuest?.()) { clear(); return { ...access }; }
    await BT.auth?.ready?.();
    const expected = context(), request = ++accessRequest;
    if (!expected.user) { mount(); return { ...access }; }
    try {
      const data = await rpc('get_boop_staff_access', {}, expected);
      unchanged(expected);
      if (request !== accessRequest) return { ...access };
      const next = { isAdmin:data?.isAdmin === true, isModerator:data?.isModerator === true };
      const changed = next.isAdmin !== access.isAdmin || next.isModerator !== access.isModerator;
      if (panel && (next.isAdmin !== access.isAdmin || next.isModerator !== access.isModerator)) close();
      access = next;
      mount();
      if (changed) window.dispatchEvent(new Event('boop:staff-access-changed'));
      return { ...access };
    } catch (error) {
      if (request === accessRequest) clear();
      throw error;
    }
  }
  function isAdmin() { return !!who() && owner === who() && access.isAdmin; }
  function isModerator() { return !!who() && owner === who() && access.isModerator; }
  function mount() {
    document.querySelectorAll('[data-staff-entry]').forEach(host => {
      const admin = isAdmin(), moderator = isModerator();
      host.hidden = !admin && !moderator;
      host.innerHTML = host.hidden ? '' : `<div class="staff-entry"><div><p class="eyebrow">Équipe BOO-P</p><h3>Prendre soin de la communauté</h3><p class="small muted">${admin && moderator ? 'Gérez les rôles et examinez les signalements des lecteurs.' : admin ? 'Retrouvez les comptes et gérez les rôles de l’équipe.' : 'Examinez les signalements pour préserver un espace accueillant.'}</p></div><div class="button-row">${admin ? '<button type="button" class="button button--secondary" data-staff-open="users">Administration</button>' : ''}${moderator ? '<button type="button" class="button button--sage" data-staff-open="reports">Modération</button>' : ''}</div></div>`;
    });
  }
  function current(view) { return panel === view && view.dialog.isConnected && who() === view.user && epoch === view.epoch; }
  function date(value) {
    if (!value) return 'Non renseigné';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Non renseigné' : parsed.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
  }
  function badges(user) {
    return `${user.isAdmin ? '<span class="staff-badge">Administrateur</span>' : ''}${user.isModerator ? '<span class="staff-badge staff-badge--sage">Modérateur</span>' : ''}${!user.isAdmin && !user.isModerator ? '<span class="staff-badge staff-badge--plain">Lecteur</span>' : ''}`;
  }
  function userHTML(user, index) {
    return `<article class="staff-card"><div class="staff-card__heading"><div><h3>${escape(user.displayName || 'Lecteur BOO-P')}</h3><p class="staff-email">${escape(user.email || 'Adresse indisponible')}</p></div><div class="staff-badges">${badges(user)}</div></div><dl class="staff-facts"><div><dt>Inscription</dt><dd>${escape(date(user.createdAt))}</dd></div><div><dt>Dernière connexion</dt><dd>${escape(date(user.lastSignInAt))}</dd></div><div><dt>Adresse e-mail</dt><dd>${user.emailConfirmed ? 'Confirmée' : 'À confirmer'}</dd></div></dl><form data-staff-roles="${index}" class="staff-role-form"><fieldset><legend>Rôles dans BOO-P</legend><label class="checkbox-row"><input type="checkbox" name="admin" ${user.isAdmin ? 'checked' : ''}> Administrateur</label><label class="checkbox-row"><input type="checkbox" name="moderator" ${user.isModerator ? 'checked' : ''}> Modérateur</label></fieldset><p class="small muted">Le rôle administrateur inclut la modération.</p><button class="button button--secondary button--small" type="submit">Modifier les rôles</button><div data-staff-confirmation></div></form></article>`;
  }
  function reportHTML(item, index) {
    const actions = item.status === 'pending' ? [['reviewed','Marquer traité'],['dismissed','Classer sans suite']] : [['pending','Rouvrir']];
    return `<article class="staff-card"><div class="staff-card__heading"><div><p class="eyebrow">${item.kind === 'user' ? 'Signalement de lecteur' : 'Signalement de publication'}</p><h3>${escape(item.reason || 'Signalement')}</h3></div><span class="staff-badge staff-badge--plain">${escape(statuses[item.status] || item.status)}</span></div><dl class="staff-facts"><div><dt>Signalé par</dt><dd>${escape(item.reporterName || 'Compte supprimé')}</dd></div><div><dt>${item.kind === 'user' ? 'Lecteur concerné' : 'Auteur concerné'}</dt><dd>${escape(item.targetName || 'Contenu ou compte supprimé')}</dd></div><div><dt>Date</dt><dd>${escape(date(item.createdAt))}</dd></div></dl>${item.details ? `<div class="staff-report-text"><strong>Précisions du signalement</strong><p>${escape(item.details)}</p></div>` : ''}${item.excerpt ? `<details class="staff-excerpt"><summary>Lire l’extrait signalé</summary><p>${escape(item.excerpt)}</p></details>` : ''}<div class="button-row">${actions.map(([value,label]) => `<button type="button" class="button button--secondary button--small" data-staff-review="${index}" data-status="${value}">${label}</button>`).join('')}</div></article>`;
  }
  function render(view) {
    if (!current(view)) return;
    const users = view.mode === 'users';
    view.dialog.innerHTML = `<div class="dialog-head"><div><p class="eyebrow">Équipe BOO-P</p><h2 id="staff-dialog-title">${users ? 'Administration' : 'Modération'}</h2></div><button class="icon-button" type="button" data-staff-close aria-label="Fermer l’espace équipe">×</button></div><div class="dialog-body"><p class="staff-intro">${users ? 'Les lecteurs font vivre BOO-P. Confiez les rôles de l’équipe aux personnes qui en prennent soin.' : 'Chaque signalement mérite un regard attentif. Retrouvez ici les demandes des lecteurs et suivez leur traitement.'}</p>${isAdmin() && isModerator() ? `<div class="staff-tabs" role="group" aria-label="Espace équipe"><button type="button" data-staff-mode="users" aria-pressed="${users}">Comptes et rôles</button><button type="button" data-staff-mode="reports" aria-pressed="${!users}">Signalements</button></div>` : ''}<form class="staff-toolbar" data-staff-filter>${users ? `<label class="field">Rechercher un compte<input type="search" name="search" maxlength="120" value="${escape(view.search)}" placeholder="Nom ou adresse e-mail" autocomplete="off"></label><button type="submit" class="button button--secondary">Rechercher</button>` : `<label class="field">Statut des signalements<select name="status">${Object.entries(statuses).map(([value,label]) => `<option value="${value}" ${value === view.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button type="submit" class="button button--secondary">Afficher</button>`}<button type="button" class="button button--ghost" data-staff-refresh>Actualiser</button></form><p class="staff-status" role="status" aria-live="polite" tabindex="-1">${escape(view.message || '')}</p><div class="staff-list" aria-busy="${view.busy}">${view.busy ? '<p class="staff-empty">Chargement…</p>' : view.items.length ? view.items.map(users ? userHTML : reportHTML).join('') : `<div class="staff-empty"><h3>${view.error ? 'Chargement interrompu' : users ? 'Aucun compte trouvé' : 'Aucun signalement dans cette liste'}</h3><p>${view.error ? 'Utilisez Actualiser pour réessayer.' : users ? 'Essayez un autre nom ou une autre adresse.' : 'Les prochaines demandes apparaîtront ici.'}</p></div>`}</div><nav class="staff-pagination" aria-label="Pages de ${users ? 'comptes' : 'signalements'}"><button type="button" class="button button--secondary button--small" data-staff-page="previous" ${view.busy || view.offset === 0 ? 'disabled' : ''}>Précédent</button><span>Page ${Math.floor(view.offset / PAGE_SIZE) + 1}</span><button type="button" class="button button--secondary button--small" data-staff-page="next" ${view.busy || !view.hasMore ? 'disabled' : ''}>Suivant</button></nav></div>`;
  }
  async function load(view, message = '') {
    if (!current(view)) return;
    const request = ++view.request;
    view.busy = true;
    view.items = [];
    view.confirmation = null;
    view.message = message;
    view.error = false;
    render(view);
    try {
      const users = view.mode === 'users';
      const data = await rpc(users ? 'list_boop_staff_users' : 'list_boop_staff_reports', {
        ...(users ? { p_search:view.search } : { p_status:view.status }), p_limit:PAGE_SIZE, p_offset:view.offset
      }, { user:view.user, epoch:view.epoch });
      if (!current(view) || view.request !== request) return;
      view.items = Array.isArray(data?.items) ? data.items : [];
      view.hasMore = data?.hasMore === true;
    } catch (error) {
      if (!current(view) || view.request !== request) return;
      view.message = error.message;
      view.error = true;
      view.hasMore = false;
    } finally {
      if (current(view) && view.request === request) {
        view.busy = false;
        if (!view.message) view.message = `${view.items.length} ${view.mode === 'users' ? 'compte(s)' : 'signalement(s)'} sur cette page.`;
        render(view);
        view.dialog.querySelector('.staff-status')?.focus();
      }
    }
  }
  function status(view, message) {
    if (!current(view)) return;
    const node = view.dialog.querySelector('.staff-status');
    if (node) { node.textContent = message; node.focus(); }
  }
  async function changeRoles(view) {
    const change = view.confirmation;
    if (!change || view.busy || !current(view)) return;
    view.busy = true;
    view.dialog.querySelectorAll('button:not([data-staff-close]), input, select').forEach(node => { node.disabled = true; });
    try {
      await rpc('set_boop_staff_roles', { p_user_id:change.id, p_is_admin:change.isAdmin, p_is_moderator:change.isModerator }, { user:view.user, epoch:view.epoch });
      if (!current(view)) return;
      await refresh();
      if (current(view)) await load(view, 'Les rôles ont été enregistrés.');
    } catch (error) {
      if (current(view)) { view.busy = false; view.confirmation = null; render(view); status(view, error.message); }
    }
  }
  async function review(view, index, nextStatus) {
    const item = view.items[index];
    if (!item || view.busy || !Object.hasOwn(statuses, nextStatus)) return;
    view.busy = true;
    view.dialog.querySelectorAll('button:not([data-staff-close]), input, select').forEach(node => { node.disabled = true; });
    try {
      await rpc('review_boop_staff_report', { p_kind:item.kind, p_report_id:item.id, p_status:nextStatus }, { user:view.user, epoch:view.epoch });
      if (current(view)) await load(view, nextStatus === 'pending' ? 'Le signalement est de nouveau à examiner.' : 'Le traitement du signalement a été enregistré.');
    } catch (error) {
      if (current(view)) { view.busy = false; render(view); status(view, error.message); }
    }
  }
  function bind(view) {
    view.dialog.addEventListener('close', () => { if (panel === view) close(); });
    view.dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    view.dialog.addEventListener('submit', event => {
      event.preventDefault();
      if (!current(view) || view.busy) return;
      const form = event.target;
      if (form.matches('[data-staff-filter]')) {
        view.search = String(form.elements.search?.value || '').trim();
        view.status = form.elements.status?.value || view.status;
        view.offset = 0;
        void load(view);
      } else if (form.matches('[data-staff-roles]')) {
        const item = view.items[Number(form.dataset.staffRoles)];
        if (!item) return;
        const next = { id:item.id, isAdmin:form.elements.admin.checked, isModerator:form.elements.moderator.checked };
        if (next.isAdmin === item.isAdmin && next.isModerator === item.isModerator) { status(view, 'Les rôles sont déjà à jour.'); return; }
        view.dialog.querySelectorAll('[data-staff-confirmation]').forEach(node => { node.replaceChildren(); });
        view.confirmation = next;
        const box = form.querySelector('[data-staff-confirmation]');
        box.innerHTML = `<div class="staff-confirm"><p>Confirmer les rôles de <strong>${escape(item.displayName || item.email)}</strong> ?</p><p>Administrateur : <strong>${next.isAdmin ? 'oui' : 'non'}</strong> · Modérateur : <strong>${next.isModerator ? 'oui' : 'non'}</strong></p>${item.id === view.user ? '<p>Vous modifiez vos propres droits. Votre accès sera actualisé immédiatement.</p>' : ''}<div class="button-row"><button type="button" class="button button--primary button--small" data-staff-confirm>Confirmer les rôles</button><button type="button" class="button button--ghost button--small" data-staff-cancel>Annuler</button></div></div>`;
        box.querySelector('[data-staff-confirm]').focus();
      }
    });
    view.dialog.addEventListener('change', event => {
      if (event.target.closest('[data-staff-roles]')) {
        view.confirmation = null;
        view.dialog.querySelectorAll('[data-staff-confirmation]').forEach(node => { node.replaceChildren(); });
      }
    });
    view.dialog.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !current(view)) return;
      if (button.hasAttribute('data-staff-close')) { close(); return; }
      if (view.busy) return;
      if (button.hasAttribute('data-staff-confirm')) { void changeRoles(view); return; }
      if (button.hasAttribute('data-staff-cancel')) { view.confirmation = null; button.closest('[data-staff-confirmation]').replaceChildren(); return; }
      if (button.hasAttribute('data-staff-review')) { void review(view, Number(button.dataset.staffReview), button.dataset.status); return; }
      if (button.hasAttribute('data-staff-mode')) {
        view.mode = button.dataset.staffMode;
        view.offset = 0;
        void load(view);
      } else if (button.hasAttribute('data-staff-page')) {
        view.offset = Math.max(0, view.offset + (button.dataset.staffPage === 'next' ? PAGE_SIZE : -PAGE_SIZE));
        void load(view);
      } else if (button.hasAttribute('data-staff-refresh')) {
        void refresh().then(() => { if (current(view)) return load(view); }).catch(() => {});
      }
    });
  }
  async function open(mode = 'reports') {
    close();
    const request = ++openRequest;
    try {
      await refresh();
      if (request !== openRequest || !(mode === 'users' ? isAdmin() : isModerator())) return;
      const expected = context(), dialog = document.createElement('dialog');
      dialog.className = 'app-dialog staff-dialog';
      dialog.setAttribute('aria-labelledby', 'staff-dialog-title');
      const view = { dialog, user:expected.user, epoch:expected.epoch, mode, search:'', status:'pending', offset:0, items:[], hasMore:false, busy:false, request:0, message:'', error:false, confirmation:null };
      panel = view;
      document.body.append(dialog);
      bind(view);
      render(view);
      dialog.showModal();
      await load(view);
    } catch (error) {
      if (request === openRequest) {
        const host = document.querySelector('[data-staff-entry]');
        if (host) { const notice = document.createElement('p'); notice.setAttribute('role','status'); notice.textContent = error.message; host.hidden = false; host.append(notice); }
      }
    }
  }
  async function start() {
    if (BT.auth?.isGuest?.()) { clear(); return; }
    try {
      await BT.auth?.ready?.();
      const client = BT.auth?.getClient?.();
      if (client && subscribedClient !== client) {
        subscribedClient = client;
        client.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || session?.user?.id !== owner) clear();
          // Leave Supabase's synchronous auth callback before using its client.
          window.setTimeout(() => refresh().catch(() => {}), 0);
        });
      }
      await refresh();
    } catch { clear(); }
  }
  document.addEventListener('DOMContentLoaded', () => { void start(); });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-staff-open]');
    if (button) void open(button.dataset.staffOpen);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const view = panel;
    void refresh().then(() => { if (view && current(view)) return load(view); }).catch(() => {});
  });
  window.addEventListener('pagehide', clear);
  return { isAdmin, isModerator, refresh, mount, open, close, clear };
})();

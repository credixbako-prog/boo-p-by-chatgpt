/** Server-backed reports and blocks. Local UI state is updated only after success. */
window.BT = window.BT || {};
BT.communitySafety = (() => {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const reasons = ['Harcèlement ou propos haineux','Contenu inapproprié','Spam ou publicité','Atteinte à la vie privée','Autre motif'];
  const who = () => BT.auth?.isAuthenticated?.() && !BT.auth?.isGuest?.() ? BT.auth.getCurrentUser()?.id : null;
  function unchanged(expected) {
    if (!expected || who() !== expected) throw new Error('Votre compte a changé. Reconnectez-vous et rouvrez ce profil.');
  }
  async function ready(expected) {
    await BT.auth?.ready?.();
    unchanged(expected);
    const client = BT.auth.getClient();
    if (!client) throw new Error('La connexion à BOO-P n’est pas prête.');
    return client;
  }
  function target(id, expected) {
    if (!UUID.test(String(id || '')) || id === expected) throw new Error('Choisissez le profil d’un autre lecteur connecté.');
  }
  function result(response, fallback) {
    if (response.error) {
      const code = response.error.code;
      if (code === '23505') throw new Error('Un signalement de ce lecteur est déjà en attente de traitement.');
      if (code === '42501' || code === '23503') throw new Error('Ce profil n’est plus accessible. Actualisez la page.');
      if (/failed to fetch|network/i.test(response.error.message || '')) throw new Error('Connexion à BOO-P impossible. Vérifiez votre accès à Internet.');
      throw new Error(fallback);
    }
    return response.data;
  }
  async function reportUser(userId, {reason, details = ''} = {}) {
    const expected = who();
    target(userId, expected);
    if (!reasons.includes(reason)) throw new Error('Choisissez un motif de signalement.');
    const text = String(details).trim();
    if (text.length > 2000) throw new Error('Les précisions sont limitées à 2 000 caractères.');
    const client = await ready(expected);
    result(await client.from('user_reports').insert({reporter_id:expected, reported_user_id:userId, reason, details:text}), 'Le signalement n’a pas pu être enregistré. Réessayez.');
    unchanged(expected);
  }
  async function blockUser(userId) {
    const expected = who();
    target(userId, expected);
    const client = await ready(expected);
    const response = await client.from('user_blocks').insert({blocker_id:expected, blocked_id:userId});
    // A duplicate block is already the requested server state.
    if (response.error?.code !== '23505') result(response, 'Le blocage n’a pas pu être enregistré. Réessayez.');
    unchanged(expected);
  }
  async function unblockUser(userId) {
    const expected = who();
    target(userId, expected);
    const client = await ready(expected);
    result(await client.from('user_blocks').delete().eq('blocker_id', expected).eq('blocked_id', userId), 'Le déblocage n’a pas pu être enregistré. Réessayez.');
    unchanged(expected);
  }
  async function loadBlockedUsers() {
    const expected = who();
    const client = await ready(expected);
    const rows = [];
    // PostgREST caps responses: paginate so no block is silently lost on hydration.
    for (let offset = 0; ; offset += 500) {
      unchanged(expected);
      const page = result(await client.from('user_blocks').select('blocked_id').eq('blocker_id', expected).order('blocked_id').range(offset, offset + 499), 'La liste des lecteurs bloqués ne peut pas être chargée.') || [];
      unchanged(expected);
      rows.push(...page.map(row => row.blocked_id));
      if (page.length < 500) return rows;
    }
  }
  return {reportUser, blockUser, unblockUser, loadBlockedUsers};
})();

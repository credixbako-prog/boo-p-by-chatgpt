/** BOO-P — notifications sociales privées et temps réel via Supabase. */
window.BT = window.BT || {};

BT.notifications = (() => {
  'use strict';

  let realtimeChannel = null;

  function client() {
    const value = window.BT.auth?.getClient?.();
    if (!value) throw new Error('La connexion aux notifications BOO-P n’est pas prête.');
    return value;
  }

  function currentUser() {
    const value = window.BT.auth?.getCurrentUser?.();
    if (!value) throw new Error('Votre session a expiré. Reconnectez-vous.');
    return value;
  }

  function friendly(error, fallback) {
    console.error('BOO-P Supabase notifications', error);
    const message = String(error?.message || '');
    if (/row-level security|permission denied/i.test(message)) return new Error('Ces notifications ne sont pas accessibles avec ce compte.');
    if (/failed to fetch|network/i.test(message)) return new Error('Connexion aux notifications impossible. Vérifiez votre accès à Internet.');
    return new Error(message || fallback);
  }

  function mapRow(row) {
    return {
      id:String(row.id),
      type:row.type || 'info',
      title:row.title || 'Information',
      text:row.body || '',
      date:row.created_at,
      read:Boolean(row.read_at),
      route:row.route || '#home',
      actorName:row.actor_name || 'Un lecteur',
      remote:true
    };
  }

  async function list() {
    await window.BT.auth.ready();
    currentUser();
    const { data, error } = await client()
      .from('notifications')
      .select('id, actor_name, type, title, body, route, created_at, read_at')
      .order('created_at', { ascending:false })
      .limit(100);
    if (error) throw friendly(error, 'Les notifications ne peuvent pas être chargées.');
    return (data || []).map(mapRow);
  }

  async function markRead(id) {
    await window.BT.auth.ready();
    currentUser();
    const { error } = await client().from('notifications')
      .update({ read_at:new Date().toISOString() })
      .eq('id', String(id));
    if (error) throw friendly(error, 'La notification ne peut pas être marquée comme lue.');
  }

  async function markAllRead() {
    await window.BT.auth.ready();
    const user = currentUser();
    const { error } = await client().from('notifications')
      .update({ read_at:new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (error) throw friendly(error, 'Les notifications ne peuvent pas être marquées comme lues.');
  }

  function subscribe(onChange, onStatus = null) {
    const user = currentUser();
    unsubscribe();
    realtimeChannel = client()
      .channel(`boop-notifications-${user.id}`)
      .on('postgres_changes', {
        event:'*', schema:'public', table:'notifications', filter:`recipient_id=eq.${user.id}`
      }, payload => onChange?.(payload))
      .subscribe(status => onStatus?.(status));
    return unsubscribe;
  }

  function unsubscribe() {
    if (!realtimeChannel) return;
    try { client().removeChannel(realtimeChannel); }
    catch { /* la session peut déjà être fermée */ }
    realtimeChannel = null;
  }

  return { list, markRead, markAllRead, subscribe, unsubscribe };
})();

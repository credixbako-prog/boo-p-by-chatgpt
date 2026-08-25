/**
 * BOO-P — synchronisation privée des données de lecture via Supabase.
 *
 * Ce module ne remplace pas le store local : il fournit une couche de pull,
 * push, upsert et suppression que le store peut appeler. Une session Supabase
 * réelle est exigée pour chaque écriture. Le mode invité reste donc toujours
 * local, même si l'interface lui fournit un profil utilisateur simulé.
 */
window.BT = window.BT || {};

BT.userDataSync = (() => {
  'use strict';

  const BATCH_SIZE = 100;
  const GUEST_STORAGE_KEY = 'boop_guest_mode_v1';
  const UNKNOWN_BULK_TIMESTAMP = '1970-01-01T00:00:00.000Z';
  const GOAL_PERIODS = new Set(['week', 'month', 'year', 'celebrated']);
  const COLLECTIONS = Object.freeze({
    books: Object.freeze({ table:'user_books', key:'local_id', snapshotKey:'books' }),
    sessions: Object.freeze({ table:'user_reading_sessions', key:'local_id', snapshotKey:'sessions' }),
    traces: Object.freeze({ table:'user_traces', key:'local_id', snapshotKey:'traces' }),
    lexicon: Object.freeze({ table:'user_lexicon_entries', key:'local_id', snapshotKey:'lexicon' }),
    goals: Object.freeze({ table:'user_reading_goals', key:'period', snapshotKey:'goals', goals:true })
  });
  const ALIASES = Object.freeze({
    book:'books', session:'sessions', trace:'traces', lexiconEntries:'lexicon', lexiconEntry:'lexicon', goal:'goals'
  });

  let guestResolver = null;

  function configure(options = {}) {
    if (options.isGuest !== undefined && typeof options.isGuest !== 'function') {
      throw new TypeError('isGuest doit être une fonction.');
    }
    guestResolver = options.isGuest || null;
  }

  function storedGuestMode() {
    try {
      return localStorage.getItem(GUEST_STORAGE_KEY) === '1'
        || sessionStorage.getItem(GUEST_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  function isGuestMode() {
    try {
      if (guestResolver?.()) return true;
    } catch {
      return true;
    }
    const auth = window.BT.auth;
    const appUser = auth?.getCurrentUser?.();
    return Boolean(
      auth?.isGuest?.()
      || appUser?.isGuest
      || appUser?.guest
      || storedGuestMode()
      || document.documentElement?.dataset?.authMode === 'guest'
    );
  }

  function friendly(error, fallback) {
    console.error('BOO-P Supabase user data sync', error);
    const message = String(error?.message || '');
    if (/row-level security|permission denied|42501/i.test(message)) {
      return new Error('Vos données de lecture ne sont pas accessibles avec cette session.');
    }
    if (/relation .* does not exist|schema cache/i.test(message)) {
      return new Error('La synchronisation BOO-P n’est pas encore installée sur le serveur.');
    }
    if (/failed to fetch|network|load failed/i.test(message)) {
      return new Error('Synchronisation impossible. Vérifiez votre connexion Internet.');
    }
    return new Error(message || fallback);
  }

  function skippedContext(reason) {
    return { skipped:true, reason, api:null, userId:null };
  }

  async function resolveContext() {
    if (isGuestMode()) return skippedContext('guest');
    const auth = window.BT.auth;
    if (!auth?.ready || !auth?.getClient || !auth?.getSession) {
      return skippedContext('authentication-unavailable');
    }
    try {
      await auth.ready();
    } catch (error) {
      if (isGuestMode()) return skippedContext('guest');
      throw friendly(error, 'La session BOO-P ne peut pas être vérifiée.');
    }
    const sessionUser = auth.getSession()?.user;
    const api = auth.getClient();
    if (!sessionUser?.id || !api) return skippedContext('unauthenticated');
    return { skipped:false, reason:null, api, userId:sessionUser.id };
  }

  function configFor(kind) {
    const normalized = ALIASES[kind] || kind;
    const config = COLLECTIONS[normalized];
    if (!config) throw new TypeError(`Collection de synchronisation inconnue : ${kind}`);
    return { name:normalized, ...config };
  }

  function chunks(items, size = BATCH_SIZE) {
    const result = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result;
  }

  function cleanId(value, label = 'identifiant') {
    const id = String(value ?? '').trim();
    if (!id || id.length > 160) throw new TypeError(`${label} BOO-P invalide.`);
    return id;
  }

  function cleanPayload(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('La donnée à synchroniser doit être un objet.');
    }
    const payload = JSON.parse(JSON.stringify(value));
    delete payload._sync;
    delete payload._syncUpdatedAt;
    return payload;
  }

  function validTimestamp(value) {
    if (!value) return null;
    const timestamp = new Date(value);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
  }

  function logicalTimestamp(record, options = {}) {
    if (options.touch !== false) return new Date().toISOString();
    const explicit = validTimestamp(options.clientUpdatedAt);
    if (explicit) return explicit;
    const candidates = [
      record.updatedAt, record.updated_at, record.lastUsedAt, record.endedAt,
      record.completedAt, record.startedAt, record.addedAt, record.createdAt,
      record.created_at
    ];
    // A bulk snapshot with no logical date must never look newer merely because
    // it was opened on another device. Per-item upserts still use "now".
    return candidates.map(validTimestamp).find(Boolean) || UNKNOWN_BULK_TIMESTAMP;
  }

  function normalRecords(records) {
    const values = Array.isArray(records) ? records : [records];
    return values.filter(value => value != null).map(record => ({
      id:cleanId(record.id ?? record.localId, 'identifiant'),
      payload:cleanPayload(record),
      source:record
    }));
  }

  function goalRecords(goals) {
    const entries = Array.isArray(goals)
      ? goals.map(item => [item?.period, item?.payload ?? item?.value ?? item])
      : Object.entries(goals || {});
    return entries.filter(([period, payload]) => GOAL_PERIODS.has(period) && payload != null).map(([period, payload]) => ({
      id:period,
      payload:cleanPayload(payload),
      source:payload
    }));
  }

  function recordsFor(config, records) {
    return config.goals ? goalRecords(records) : normalRecords(records);
  }

  function writeSkipped(context) {
    return { skipped:true, reason:context.reason, count:0, records:[] };
  }

  async function upsertWithContext(context, kind, records, options = {}) {
    if (context.skipped) return writeSkipped(context);
    const config = configFor(kind);
    const normalized = recordsFor(config, records);
    if (!normalized.length) return { skipped:false, reason:null, count:0, records:[] };

    const saved = [];
    for (const batch of chunks(normalized)) {
      const rows = batch.map(item => ({
        user_id:context.userId,
        [config.key]:item.id,
        payload:item.payload,
        client_updated_at:logicalTimestamp(item.source, options)
      }));
      const { data, error } = await context.api
        .from(config.table)
        .upsert(rows, { onConflict:`user_id,${config.key}`, ignoreDuplicates:false })
        .select(`${config.key}, payload, client_updated_at, updated_at`);
      if (error) throw friendly(error, `La collection ${config.name} ne peut pas être synchronisée.`);
      saved.push(...(data || []));
    }
    return {
      skipped:false,
      reason:null,
      count:saved.length,
      records:saved.map(row => ({
        id:row[config.key],
        payload:row.payload,
        clientUpdatedAt:row.client_updated_at,
        serverUpdatedAt:row.updated_at
      }))
    };
  }

  async function upsert(kind, records, options = {}) {
    return upsertWithContext(await resolveContext(), kind, records, options);
  }

  function normalizedIds(config, ids) {
    const values = Array.isArray(ids) ? ids : [ids];
    return [...new Set(values.filter(value => value != null).map(value => {
      if (config.goals && !GOAL_PERIODS.has(String(value))) throw new TypeError('Période d’objectif BOO-P invalide.');
      return cleanId(value);
    }))];
  }

  async function deleteWithContext(context, kind, ids) {
    if (context.skipped) return { skipped:true, reason:context.reason, count:0, ids:[] };
    const config = configFor(kind);
    const normalized = normalizedIds(config, ids);
    const deleted = [];
    for (const batch of chunks(normalized)) {
      const { data, error } = await context.api
        .from(config.table)
        .delete()
        .eq('user_id', context.userId)
        .in(config.key, batch)
        .select(config.key);
      if (error) throw friendly(error, `La suppression dans ${config.name} ne peut pas être synchronisée.`);
      deleted.push(...(data || []).map(row => row[config.key]));
    }
    return { skipped:false, reason:null, count:deleted.length, ids:deleted };
  }

  async function remove(kind, ids) {
    return deleteWithContext(await resolveContext(), kind, ids);
  }

  async function queryWithContext(context, kind, options = {}) {
    if (context.skipped) return [];
    const config = configFor(kind);
    let query = context.api
      .from(config.table)
      .select(`${config.key}, payload, client_updated_at, created_at, updated_at`)
      .eq('user_id', context.userId)
      .order('updated_at', { ascending:true });
    const since = validTimestamp(options.since);
    if (since) query = query.gt('updated_at', since);
    const { data, error } = await query;
    if (error) throw friendly(error, `La collection ${config.name} ne peut pas être chargée.`);
    return (data || []).map(row => ({
      id:row[config.key],
      payload:row.payload,
      clientUpdatedAt:row.client_updated_at,
      createdAt:row.created_at,
      serverUpdatedAt:row.updated_at
    }));
  }

  async function pull(kind, options = {}) {
    const context = await resolveContext();
    const config = configFor(kind);
    const rows = await queryWithContext(context, config.name, options);
    if (config.goals) return Object.fromEntries(rows.map(row => [row.id, row.payload]));
    return rows.map(row => row.payload);
  }

  function emptySnapshot(reason, options = {}) {
    return {
      books:[], sessions:[], traces:[], lexicon:[], goals:{},
      _sync:{ skipped:true, reason, incremental:Boolean(validTimestamp(options.since)), pulledAt:new Date().toISOString(), versions:{} }
    };
  }

  function versionsFor(rows) {
    return Object.fromEntries(rows.map(row => [row.id, {
      clientUpdatedAt:row.clientUpdatedAt,
      serverUpdatedAt:row.serverUpdatedAt
    }]));
  }

  async function pullAll(options = {}) {
    const context = await resolveContext();
    if (context.skipped) return emptySnapshot(context.reason, options);
    const [books, sessions, traces, lexicon, goals] = await Promise.all([
      queryWithContext(context, 'books', options),
      queryWithContext(context, 'sessions', options),
      queryWithContext(context, 'traces', options),
      queryWithContext(context, 'lexicon', options),
      queryWithContext(context, 'goals', options)
    ]);
    return {
      books:books.map(row => row.payload),
      sessions:sessions.map(row => row.payload),
      traces:traces.map(row => row.payload),
      lexicon:lexicon.map(row => row.payload),
      goals:Object.fromEntries(goals.map(row => [row.id, row.payload])),
      _sync:{
        skipped:false,
        reason:null,
        incremental:Boolean(validTimestamp(options.since)),
        pulledAt:new Date().toISOString(),
        versions:{
          books:versionsFor(books), sessions:versionsFor(sessions),
          traces:versionsFor(traces), lexicon:versionsFor(lexicon), goals:versionsFor(goals)
        }
      }
    };
  }

  async function deleteMissingWithContext(context, kind, keepIds) {
    const config = configFor(kind);
    const { data, error } = await context.api
      .from(config.table)
      .select(config.key)
      .eq('user_id', context.userId);
    if (error) throw friendly(error, `La collection ${config.name} ne peut pas être réconciliée.`);
    const keep = new Set(keepIds);
    const missing = (data || []).map(row => row[config.key]).filter(id => !keep.has(id));
    return deleteWithContext(context, config.name, missing);
  }

  async function pushAll(snapshot = {}, options = {}) {
    const context = await resolveContext();
    if (context.skipped) return {
      skipped:true, reason:context.reason, count:0, collections:{}
    };

    const provided = [];
    if (Array.isArray(snapshot.books)) provided.push(['books', snapshot.books]);
    if (Array.isArray(snapshot.sessions)) provided.push(['sessions', snapshot.sessions]);
    if (Array.isArray(snapshot.traces)) provided.push(['traces', snapshot.traces]);
    if (Array.isArray(snapshot.lexicon)) provided.push(['lexicon', snapshot.lexicon]);
    if (snapshot.goals && typeof snapshot.goals === 'object') provided.push(['goals', snapshot.goals]);

    const collections = {};
    for (const [kind, records] of provided) {
      collections[kind] = await upsertWithContext(context, kind, records, { touch:options.touch === true });
    }

    if (options.replaceRemote === true) {
      for (const [kind, records] of provided) {
        const config = configFor(kind);
        const keepIds = recordsFor(config, records).map(item => item.id);
        collections[kind].deleted = await deleteMissingWithContext(context, kind, keepIds);
      }
    }

    return {
      skipped:false,
      reason:null,
      count:Object.values(collections).reduce((sum, result) => sum + result.count, 0),
      collections
    };
  }

  return Object.freeze({
    configure,
    isGuestMode,
    pull,
    pullAll,
    pullBooks:options => pull('books', options),
    pullSessions:options => pull('sessions', options),
    pullTraces:options => pull('traces', options),
    pullLexicon:options => pull('lexicon', options),
    pullGoals:options => pull('goals', options),
    pushAll,
    upsert,
    upsertBooks:(records, options) => upsert('books', records, options),
    upsertSessions:(records, options) => upsert('sessions', records, options),
    upsertTraces:(records, options) => upsert('traces', records, options),
    upsertLexicon:(records, options) => upsert('lexicon', records, options),
    upsertGoals:(records, options) => upsert('goals', records, options),
    remove,
    deleteBooks:ids => remove('books', ids),
    deleteSessions:ids => remove('sessions', ids),
    deleteTraces:ids => remove('traces', ids),
    deleteLexicon:ids => remove('lexicon', ids),
    deleteGoals:periods => remove('goals', periods),
    collections:COLLECTIONS
  });
})();

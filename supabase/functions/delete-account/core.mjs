const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 500;

// Passwords, sessions and service credentials are never persisted or logged.
// The two RPCs are service-only. Storage files must be removed through its API,
// before Auth deletion; deleting storage.objects rows would orphan the files.
export function createHandler({ env, fetchImpl = fetch, now = Date.now }) {
  return async request => {
    const origin = request.headers.get('origin') || '';
    const allowed = origin === 'https://credixbako-prog.github.io'
      || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(allowed ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      } : {})
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed) return reply({ error: 'Origine non autorisée.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405);
    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer \S+$/.test(authorization)) return reply({ error: 'Connectez-vous à votre compte.' }, 401);

    const base = env('SUPABASE_URL'), service = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!base || !service) return reply({ error: 'La suppression du compte est momentanément indisponible.' }, 503);
    const deadline = now() + 45000;
    const http = (path, options = {}) => {
      const remaining = deadline - now();
      if (remaining <= 0) throw new Error('deadline');
      return fetchImpl(base + path, {
        ...options, signal: AbortSignal.timeout(Math.min(12000, remaining)),
        headers: {
          apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json',
          ...options.headers
        }
      });
    };
    const rpc = async (name, body) => {
      const response = await http('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) });
      if (!response.ok) {
        const issue = await response.json().catch(() => ({}));
        const code = issue.message === 'BOOP_VOICE_START_PENDING' ? 'voice_start_pending'
          : name === 'prepare_boop_account_deletion' && issue.message === 'staff_last_admin' ? 'staff_last_admin' : 'database';
        throw Object.assign(new Error(code), { rpcRejected: true });
      }
      return response.status === 204 ? null : response.json();
    };
    let deletionStarted = false, deletionConfirmed = false, temporaryToken = '', deleted = false;
    try {
      // Read a bounded stream: do not allocate an arbitrarily large password body.
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'Demande invalide.' }, 400);
      const chunks = []; let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 4096) { await reader.cancel(); return reply({ error: 'Demande trop volumineuse.' }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return reply({ error: 'Demande invalide.' }, 400); }
      if (!body || body.confirmation !== 'SUPPRIMER' || typeof body.password !== 'string'
        || !body.password.length || body.password.length > 1024
        || Object.keys(body).some(key => !['confirmation', 'password'].includes(key))) {
        return reply({ error: 'Saisissez votre mot de passe actuel et SUPPRIMER pour confirmer.' }, 400);
      }

      const auth = await http('/auth/v1/user', { headers: { Authorization: authorization } });
      if (!auth.ok) return reply({ error: 'Votre session a expiré. Reconnectez-vous avant de supprimer votre compte.' }, 401);
      const user = await auth.json();
      if (!UUID.test(user.id) || user.is_anonymous || !user.email) {
        return reply({ error: 'Un compte BOO-P avec une adresse e-mail est nécessaire.' }, 403);
      }
      // Both account id and email come exclusively from verified Auth, never the body.
      const verified = await http('/auth/v1/token?grant_type=password', {
        method: 'POST', body: JSON.stringify({ email: user.email, password: body.password })
      });
      body.password = '';
      if (!verified.ok) {
        if (verified.status >= 500) return reply({ error: 'La vérification du mot de passe est momentanément indisponible.' }, 503);
        return reply({ error: verified.status === 429
          ? 'Trop de tentatives. Patientez avant de réessayer.'
          : 'Le mot de passe actuel est incorrect. Aucune suppression n’a été lancée.' }, verified.status === 429 ? 429 : 403);
      }
      const fresh = await verified.json();
      if (fresh.user?.id !== user.id || typeof fresh.access_token !== 'string' || !fresh.access_token) {
        return reply({ error: 'La vérification de votre compte a échoué.' }, 403);
      }
      temporaryToken = fresh.access_token;

      // Idempotent marker stops uploads and concurrent data sync. Leave it in place
      // on errors, so the user can safely resume a partly completed deletion.
      // The reply can be lost after commit: until a rejection is received, treat
      // this as potentially started and keep the client from resuming sync.
      deletionStarted = true;
      try { await rpc('prepare_boop_account_deletion', { p_user_id: user.id }); }
      catch (error) { if (error.rpcRejected) deletionStarted = false; throw error; }
      deletionConfirmed = true;
      // End existing live audio before removing its ledger. In-flight starts are
      // rejected by the account write guard and hang up when saving their call fails.
      const callsResponse = await http('/rest/v1/boop_voice_calls?user_id=eq.' + user.id + '&status=eq.active&select=id,call_id&limit=100');
      if (!callsResponse.ok) throw new Error('voice_inventory');
      const calls = await callsResponse.json();
      if (!Array.isArray(calls) || calls.length >= 100) throw new Error('voice_inventory');
      for (const call of calls) {
        if (!/^rtc_[a-zA-Z0-9_-]+$/.test(call.call_id || '') || !env('OPENAI_API_KEY')) throw new Error('voice_config');
        const ended = await fetchImpl('https://api.openai.com/v1/realtime/calls/' + encodeURIComponent(call.call_id) + '/hangup', {
          method: 'POST', headers: { Authorization: `Bearer ${env('OPENAI_API_KEY')}` },
          signal: AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - now())))
        });
        if (!ended.ok && ended.status !== 404) throw new Error('voice_hangup');
      }
      let empty = false;
      for (let batch = 0; batch < 100; batch++) {
        const objects = await rpc('list_boop_account_deletion_objects', { p_user_id: user.id, p_limit: BATCH_SIZE });
        if (!Array.isArray(objects) || objects.length > BATCH_SIZE) throw new Error('invalid_inventory');
        if (!objects.length) { empty = true; break; }
        const buckets = new Map();
        for (const object of objects) {
          if (typeof object.bucket_id !== 'string' || !/^[a-z0-9_-]+$/i.test(object.bucket_id)
            || typeof object.name !== 'string' || !object.name.length) throw new Error('invalid_inventory');
          if (!buckets.has(object.bucket_id)) buckets.set(object.bucket_id, []);
          buckets.get(object.bucket_id).push(object.name);
        }
        for (const [bucket, prefixes] of buckets) {
          const removed = await http('/storage/v1/object/' + encodeURIComponent(bucket), {
            method: 'DELETE', body: JSON.stringify({ prefixes })
          });
          if (!removed.ok) throw new Error('storage');
        }
      }
      if (!empty) throw new Error('more_files');
      const signedOut = await http('/auth/v1/logout?scope=global', {
        method: 'POST', headers: { Authorization: `Bearer ${temporaryToken}` }
      });
      if (!signedOut.ok) throw new Error('revoke_sessions');
      temporaryToken = '';
      const removed = await http('/auth/v1/admin/users/' + user.id, {
        method: 'DELETE', body: JSON.stringify({ should_soft_delete: false })
      });
      if (!removed.ok && removed.status !== 404) throw new Error('delete_user');
      deleted = true;
      return reply({ deleted: true });
    } catch (error) {
      if (error.message === 'staff_last_admin') {
        return reply({ error: 'Désignez un autre administrateur BOO-P avant de supprimer votre compte. Aucune suppression n’a été lancée.', deletionStarted: false }, 409);
      }
      if (error.message === 'voice_start_pending') {
        return reply({ error: 'Une conversation vocale est en cours de démarrage. Fermez-la puis réessayez dans un instant.', deletionStarted: false }, 409);
      }
      return reply({ error: deletionStarted
        ? 'La suppression n’a pas pu être confirmée. Certains éléments peuvent déjà être effacés. Réessayez avec votre mot de passe pour terminer.' + (deletionConfirmed ? ' Les nouvelles écritures de ce compte sont suspendues.' : '')
        : 'La vérification est momentanément indisponible. Réessayez dans un instant.', deletionStarted }, 503);
    } finally {
      // A failed attempt must not leave the server-created password session alive.
      if (temporaryToken && !deleted) {
        try {
          await fetchImpl(base + '/auth/v1/logout?scope=local', {
            method: 'POST', headers: { apikey: service, Authorization: `Bearer ${temporaryToken}` }, signal: AbortSignal.timeout(5000)
          });
        } catch { /* Preserve the original failure, including a request deadline. */ }
      }
    }
  };
}

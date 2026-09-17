import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/delete-account/core.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const stranger = '22222222-2222-4222-8222-222222222222';
const body = { confirmation: 'SUPPRIMER', password: 'mot-de-passe-test' };
const json = (data, status = 200) => Response.json(data, { status });

function setup({ user = { id: owner, email: 'owner@example.invalid' }, authStatus = 200,
  passwordStatus = 200, passwordUser = owner, route, clock } = {}) {
  const calls = [];
  const handler = createHandler({
    env: name => ({ SUPABASE_URL: 'https://project.test', SUPABASE_SERVICE_ROLE_KEY: 'server-only', OPENAI_API_KEY: 'voice-server-key' })[name],
    ...(clock ? { now: clock } : {}),
    fetchImpl: async (url, options) => {
      const payload = options.body ? JSON.parse(options.body) : null;
      calls.push({ url, options, body: payload });
      if (url.endsWith('/auth/v1/user')) return json(user, authStatus);
      if (url.includes('/token?')) return json({ user: { id: passwordUser }, access_token: 'fresh-session-secret' }, passwordStatus);
      const override = route?.(url, options, payload);
      if (override) return override;
      if (url.includes('list_boop_account_deletion_objects')) return json([]);
      if (url.includes('prepare_boop_account_deletion')) return json(null);
      if (url.includes('/boop_voice_calls?')) return json([]);
      return json({});
    }
  });
  const send = (data = body, { origin = 'https://credixbako-prog.github.io', token = 'original-session', method = 'POST', raw } = {}) => handler(new Request('https://edge.test/delete-account', {
    method, headers: { origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(['GET', 'OPTIONS'].includes(method) ? {} : { body: raw ?? JSON.stringify(data) })
  }));
  return { send, calls };
}

test('account deletion: origin, method, token and confirmation rejected before any side effect', async () => {
  const h = setup();
  assert.equal((await h.send(body, { origin: 'https://third-party.test' })).status, 403);
  assert.equal((await h.send(body, { method: 'GET' })).status, 405);
  assert.equal((await h.send(body, { token: '' })).status, 401);
  for (const data of [{}, { ...body, confirmation: 'oui' }, { ...body, userId: stranger }, { ...body, password: '' }, null]) {
    assert.equal((await h.send(data)).status, 400);
  }
  assert.equal((await h.send(body, { raw: '{' })).status, 400);
  assert.equal((await h.send(body, { raw: 'x'.repeat(4097) })).status, 413);
  assert.equal(h.calls.length, 0);
  const preflight = await h.send(body, { method: 'OPTIONS', token: '' });
  assert.equal(preflight.status, 204);
  assert.ok(preflight.headers.get('Access-Control-Allow-Headers').includes('x-client-info'));
});

test('account deletion: invalid session, guests, wrong password and identity mismatch never reach deletion', async () => {
  for (const options of [{ authStatus: 401 }, { user: { id: owner, is_anonymous: true } },
    { passwordStatus: 400 }, { passwordUser: stranger }]) {
    const h = setup(options);
    assert.ok([401, 403].includes((await h.send()).status));
    assert.equal(h.calls.some(c => c.url.includes('/rpc/') || c.options.method === 'DELETE'), false);
  }
  assert.equal((await setup({ passwordStatus: 429 }).send()).status, 429);
  assert.equal((await setup({ passwordStatus: 500 }).send()).status, 503);
});

test('account deletion: verified owner, storage inventory then session revocation then hard deletion', async () => {
  let inventory = 0;
  const h = setup({ route: url => url.includes('list_boop_account_deletion_objects') ? json(inventory++ ? [] : [
    { bucket_id: 'profile-avatars', name: owner + '/portrait.png' },
    { bucket_id: 'reading-cards', name: owner + '/report.png' }
  ]) : null });
  const response = await h.send();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const verify = h.calls.find(c => c.url.includes('/token?'));
  assert.deepEqual(verify.body, { email: 'owner@example.invalid', password: body.password });
  for (const call of h.calls.filter(c => c.url.includes('/rpc/'))) assert.equal(call.body.p_user_id, owner);
  const removals = h.calls.filter(c => c.url.includes('/storage/'));
  assert.equal(removals.length, 2);
  assert.deepEqual(removals[0].body, { prefixes: [owner + '/portrait.png'] });
  assert.ok(removals.every(c => c.options.method === 'DELETE'));
  assert.ok(h.calls.at(-2).url.endsWith('/logout?scope=global'));
  assert.equal(h.calls.at(-2).options.headers.Authorization, 'Bearer fresh-session-secret');
  assert.ok(h.calls.at(-1).url.endsWith('/admin/users/' + owner));
  assert.deepEqual(h.calls.at(-1).body, { should_soft_delete: false });
  assert.ok(h.calls.at(-1).options.headers.Authorization.endsWith('server-only'));
});

test('account deletion: processes all file pages without offset skips', async () => {
  let page = 0;
  const h = setup({ route: url => url.includes('list_boop_account_deletion_objects') ? json(page++ < 3 ? [
    { bucket_id: 'community-media', name: owner + '/page-' + page + '.jpg' }
  ] : []) : null });
  assert.equal((await h.send()).status, 200);
  assert.equal(h.calls.filter(c => c.url.includes('/storage/')).length, 3);
  assert.ok(h.calls.filter(c => c.url.includes('list_boop')).every(c => c.body.p_limit === 500));
});

test('account deletion: last administrator must transfer access before any cleanup', async () => {
  const h = setup({ route: url => url.includes('prepare_boop_account_deletion')
    ? json({ code: 'P0001', message: 'staff_last_admin' }, 400) : null });
  const response = await h.send();
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.deletionStarted, false);
  assert.match(result.error, /autre administrateur/);
  assert.equal(h.calls.some(call => call.url.includes('/storage/') || call.url.includes('/admin/users/') || call.url.includes('/boop_voice_calls?')), false);
  assert.equal(h.calls.at(-1).url.endsWith('/logout?scope=local'), true);
});

test('account deletion: storage error preserves account and signals partial deletion without leaking secrets', async () => {
  const h = setup({ route: url => url.includes('list_boop') ? json([{ bucket_id: 'reading-cards', name: owner + '/a.png' }])
    : url.includes('/storage/') ? json({ error: 'server-only fresh-session-secret' }, 500) : null });
  const result = await h.send();
  assert.equal(result.status, 503);
  const error = await result.json();
  assert.equal(error.deletionStarted, true);
  assert.ok(!JSON.stringify(error).includes('server-only'));
  assert.ok(!JSON.stringify(error).includes(body.password));
  assert.equal(h.calls.some(c => c.url.includes('/admin/users/')), false);
  assert.ok(h.calls.at(-1).url.endsWith('/logout?scope=local'));
});

test('account deletion: database preparation failure does not remove files and temporary session is revoked', async () => {
  const h = setup({ route: url => url.includes('prepare_boop') ? json({ error: 'not deployed' }, 404) : null });
  const error = await (await h.send()).json();
  assert.equal(error.deletionStarted, false);
  assert.equal(h.calls.some(c => c.options.method === 'DELETE'), false);
  assert.ok(h.calls.at(-1).url.endsWith('/logout?scope=local'));
});

test('account deletion: lost preparation response is potentially committed, pending voice is a clean rejection', async () => {
  const h = setup({ route: url => { if (url.includes('prepare_boop')) throw new Error('response lost'); } });
  const error = await (await h.send()).json();
  assert.equal(error.deletionStarted, true);
  assert.equal(h.calls.some(c => c.options.method === 'DELETE'), false);
  const pending = setup({ route: url => url.includes('prepare_boop') ? json({ message: 'BOOP_VOICE_START_PENDING' }, 400) : null });
  const response = await pending.send();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).deletionStarted, false);
});

test('account deletion: active voice calls close before deleting their ledger, never accept arbitrary URLs', async () => {
  const h = setup({ route: url => url.includes('/boop_voice_calls?') ? json([{ call_id: 'rtc_live_test' }]) : null });
  assert.equal((await h.send()).status, 200);
  const hangup = h.calls.find(c => c.url.includes('api.openai.com'));
  assert.ok(hangup.url.endsWith('/rtc_live_test/hangup'));
  assert.equal(hangup.options.headers.Authorization, 'Bearer voice-server-key');
  assert.equal(hangup.options.headers.apikey, undefined);
  assert.ok(h.calls.indexOf(hangup) < h.calls.findIndex(c => c.url.includes('/admin/users/')));
  const failed = setup({ route: url => url.includes('/boop_voice_calls?') ? json([{ call_id: 'https://evil.test' }]) : null });
  assert.equal((await failed.send()).status, 503);
  assert.equal(failed.calls.some(c => c.url.includes('/admin/users/')), false);
});

test('account deletion: session revocation and Auth deletion failures never report success', async () => {
  for (const failed of ['/logout?scope=global', '/admin/users/']) {
    const h = setup({ route: url => url.includes(failed) ? json({}, 500) : null });
    const response = await h.send();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).deletionStarted, true);
    if (failed.includes('logout')) assert.equal(h.calls.some(c => c.url.includes('/admin/users/')), false);
  }
});

test('account deletion: timeout in cleanup preserves the failure response', async () => {
  let clock = 100;
  const h = setup({ clock: () => clock, route: url => {
    if (url.includes('prepare_boop')) { clock = 50000; return json(null); }
  } });
  const response = await h.send();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).deletionStarted, true);
  assert.ok(h.calls.at(-1).url.endsWith('/logout?scope=local'));
});

test('account deletion: invalid file inventory and unbounded repeated pages stop before Auth deletion', async () => {
  for (const list of [{ malformed: true }, [{ bucket_id: '../other', name: 'file' }], [{ bucket_id: 'reading-cards', name: '' }],
    [{ bucket_id: 'reading-cards', name: owner + '/unchanged.png' }]]) {
    const h = setup({ route: url => url.includes('list_boop') ? json(list) : null });
    assert.equal((await h.send()).status, 503);
    assert.equal(h.calls.some(c => c.url.includes('/admin/users/')), false);
  }
});

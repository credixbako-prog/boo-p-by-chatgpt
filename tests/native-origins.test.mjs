import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { createHandler as chat } from '../supabase/functions/reading-chat/core.mjs';
import { createHandler as voice } from '../supabase/functions/reading-voice/core.mjs';
import { createHandler as deletion } from '../supabase/functions/delete-account/core.mjs';
import { createHandler as push } from '../supabase/functions/push-notifications/core.mjs';

const nativeOrigins = ['https://localhost', 'capacitor://localhost'];
const allowedOrigins = [...nativeOrigins, 'https://credixbako-prog.github.io', 'http://localhost:5173', 'http://127.0.0.1:8000'];
const deniedOrigins = [
  'null', 'https://untrusted.example', 'https://localhost.evil.example',
  'https://localhost@evil.example', 'http://localhost.evil.example',
  'capacitor://localhost.evil.example', 'capacitor://127.0.0.1', 'capacitor://localhost:1234',
  'https://credixbako-prog.github.io.evil.example', 'https://boo-p.fr'
];
const factories = { 'reading-chat': chat, 'reading-voice': voice, 'delete-account': deletion, 'push-notifications': push };
const publicFunctions = new Set(['isbn-fallback', 'cover-image-proxy']);
const functions = [...Object.keys(factories), ...publicFunctions];
const fakeUser = { id: '11111111-1111-4111-8111-111111111111', email: 'reader@example.invalid', app_metadata: { boop_ai_test: true } };

function setup(name, { user = fakeUser, authStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/auth/v1/user')) return Response.json(user, { status: authStatus });
    throw new Error('Unexpected network request in the origin/authentication test');
  };
  const env = key => ({ SUPABASE_URL: 'https://project.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-server-key' })[key];
  let handler;
  if (factories[name]) handler = factories[name]({ env, fetchImpl });
  else {
    // Exercise the actual Deno entry point without starting a server or fetching
    // runtime type declarations. Node 24 also runs the release CI tests.
    const filename = new URL(`../supabase/functions/${name}/index.ts`, import.meta.url);
    const source = readFileSync(filename, 'utf8').replace(/^import "jsr:@supabase\/functions-js\/edge-runtime\.d\.ts";\r?\n/, '');
    vm.runInNewContext(stripTypeScriptTypes(source), {
      Deno: { serve: fn => { handler = fn; } }, fetch: fetchImpl,
      Request, Response, URL, AbortSignal, console, setTimeout, clearTimeout
    }, { filename: filename.pathname });
    assert.equal(typeof handler, 'function');
  }
  const request = ({ origin, method = name === 'cover-image-proxy' ? 'GET' : 'POST', token, body } = {}) => handler(new Request(`https://edge.example.invalid/${name}`, {
    method,
    headers: {
      ...(origin === undefined ? {} : { Origin: origin }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json'
    },
    ...(['OPTIONS', 'GET'].includes(method) ? {} : {
      body: JSON.stringify(body ?? (name === 'delete-account'
        ? { confirmation: 'SUPPRIMER', password: 'fake-password' } : { action: 'status' }))
    })
  }));
  return { request, calls };
}

for (const name of functions) {
  test(`${name}: native and existing browser preflights keep exact origins`, async () => {
    const h = setup(name);
    for (const origin of allowedOrigins) {
      const response = await h.request({ origin, method: 'OPTIONS' });
      assert.ok(response.ok, `${origin}: ${response.status}`);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(response.headers.get('Vary'), 'Origin');
      assert.ok(response.headers.get('Access-Control-Allow-Methods').includes(name === 'cover-image-proxy' ? 'GET' : 'POST'));
      assert.ok(response.headers.get('Access-Control-Allow-Headers').includes('authorization'));
      assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
    }
    assert.equal(h.calls.length, 0);
  });

  test(`${name}: unknown and opaque origins are rejected before any upstream work`, async () => {
    const h = setup(name);
    for (const origin of deniedOrigins) {
      for (const method of ['OPTIONS', name === 'cover-image-proxy' ? 'GET' : 'POST']) {
        const response = await h.request({ origin, method, token: 'fake-session' });
        assert.equal(response.status, 403, `${method} ${origin}`);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
      }
    }
    assert.equal(h.calls.length, 0);
  });
}

for (const name of Object.keys(factories)) {
  test(`${name}: native origin does not authorize missing, invalid or anonymous sessions`, async () => {
    for (const origin of nativeOrigins) {
      const unauthenticated = setup(name);
      const response = await unauthenticated.request({ origin });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(unauthenticated.calls.length, 0);

      for (const options of [{ authStatus: 401 }, { user: { ...fakeUser, is_anonymous: true } }]) {
        const h = setup(name, options);
        const response = await h.request({ origin, token: 'fake-session' });
        assert.equal(response.status, options.authStatus === 401 ? 401 : 403);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
        assert.equal(h.calls.length, 1);
        assert.ok(h.calls[0].url.endsWith('/auth/v1/user'));
      }
    }
  });

  test(`${name}: requests without Origin still require a session`, async () => {
    const h = setup(name);
    const response = await h.request();
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(h.calls.length, 0);
  });

  test(`${name}: Android support does not expand to other HTTPS loopback origins`, async () => {
    const h = setup(name);
    for (const origin of ['https://localhost:5173', 'https://127.0.0.1', 'https://localhost/']) {
      const response = await h.request({ origin, method: 'OPTIONS' });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
    assert.equal(h.calls.length, 0);
  });
}

for (const name of ['reading-chat', 'reading-voice', 'push-notifications']) {
  test(`${name}: verified native session reaches the existing status action`, async () => {
    for (const origin of nativeOrigins) {
      const h = setup(name);
      const response = await h.request({ origin, token: 'fake-session' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal((await response.json()).ready, false);
      assert.equal(h.calls.length, 1);
    }
  });
}

for (const name of publicFunctions) {
  test(`${name}: native response validation and existing HTTPS development origins stay usable`, async () => {
    const h = setup(name);
    for (const origin of [...nativeOrigins, 'https://localhost:5173', 'https://127.0.0.1:8000', undefined]) {
      const response = await h.request({ origin, body: { isbn: 'invalid-isbn' } });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin ?? null);
    }
    assert.equal(h.calls.length, 0);
  });
}

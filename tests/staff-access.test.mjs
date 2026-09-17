import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/staff-access.js', import.meta.url), 'utf8');
const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
const turn = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

class Surface {
  constructor() { this.handlers = {}; this.innerHTML = ''; this.isConnected = false; this.open = false; this.nodes = {}; this.dataset = {}; }
  addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
  emit(name, target = this) { for (const callback of this.handlers[name] || []) callback({ target, preventDefault() {} }); }
  dispatchEvent(event) { this.emit(event.type); }
  replaceChildren() { this.innerHTML = ''; }
  setAttribute() {}
  focus() { this.focused = true; }
  append(node) { node.isConnected = true; }
  querySelector(selector) { return this.nodes[selector] ||= new Surface(); }
  querySelectorAll() { return []; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  remove() { this.isConnected = false; }
}
function setup({ guest = false, user = first } = {}) {
  const document = new Surface(), window = new Surface(), entry = new Surface(), dialogs = [], calls = [], timers = [];
  let authHandler, readyCalls = 0, responder = name => ({ data:name === 'get_boop_staff_access' ? { isAdmin:true, isModerator:true } : { items:[], hasMore:false } });
  document.body = { append(node) { node.isConnected = true; dialogs.push(node); } };
  document.visibilityState = 'visible';
  document.createElement = () => new Surface();
  document.querySelectorAll = selector => selector === '[data-staff-entry]' ? [entry] : [];
  document.querySelector = selector => selector === '[data-staff-entry]' ? entry : null;
  window.setTimeout = callback => { timers.push(callback); };
  const client = { auth:{ onAuthStateChange(callback) { authHandler = callback; } }, async rpc(name,args) { calls.push([name, JSON.parse(JSON.stringify(args))]); return responder(name, args); } };
  const BT = { auth:{ isGuest:() => guest, isAuthenticated:() => !!user, getCurrentUser:() => user ? { id:user, app_metadata:{ boop_moderator:true } } : null, ready:async () => { readyCalls++; }, getClient:() => client } };
  window.BT = BT;
  vm.runInNewContext(source, { window, document, BT, Event });
  return {
    api:BT.staffAccess, document, window, entry, calls, dialogs, timers,
    get readyCalls() { return readyCalls; }, get dialog() { return dialogs.at(-1); },
    setUser(value) { user = value; }, respond(callback) { responder = callback; },
    async start() { document.emit('DOMContentLoaded'); await turn(); },
    auth(event, value) { user = value; authHandler(event, value ? { user:{ id:value } } : null); },
    async tick() { const pending = timers.splice(0); pending.forEach(callback => callback()); await turn(); },
    click(attribute, value = '', extra = {}) {
      const button = { dataset:{ [attribute.replace(/^data-/, '').replace(/-([a-z])/g, (_,x) => x.toUpperCase())]:value, ...extra }, hasAttribute:key => key === attribute, closest:() => button };
      this.dialog.emit('click', button);
    },
    async open(mode = 'users') { await this.api.refresh(); await this.api.open(mode); }
  };
}

test('guest and signed-out sessions request no staff data', async () => {
  for (const settings of [{ guest:true }, { user:null }]) {
    const s = setup(settings); await s.api.refresh(); await s.api.open('users');
    assert.equal(s.calls.length, 0); assert.equal(s.dialogs.length, 0); assert.equal(s.entry.hidden, true);
    if (settings.guest) assert.equal(s.readyCalls, 0);
  }
});

test('only live server capabilities reveal staff entries; metadata cannot grant access', async () => {
  const s = setup();
  s.respond(() => ({ data:{ isAdmin:false, isModerator:false } }));
  await s.api.refresh(); assert.equal(s.entry.hidden, true); assert.equal(s.api.isModerator(), false);
  s.respond(() => ({ data:{ isAdmin:false, isModerator:true } }));
  await s.api.refresh(); assert.match(s.entry.innerHTML, /Modération/); assert.doesNotMatch(s.entry.innerHTML, />Administration</);
  assert.equal(s.api.isAdmin(), false); assert.equal(s.api.isModerator(), true);
});

test('a delayed rights response cannot restore another account or override a newer check', async () => {
  const s = setup(), pending = deferred();
  s.respond(() => pending.promise);
  const old = s.api.refresh(); await turn(); s.setUser(second);
  pending.resolve({ data:{ isAdmin:true, isModerator:true } });
  await assert.rejects(old, /compte a changé/); assert.equal(s.api.isAdmin(), false); assert.equal(s.entry.hidden, true);
  const delayed = deferred(); s.respond(() => delayed.promise);
  const earlier = s.api.refresh(); await turn();
  s.respond(() => ({ data:{ isAdmin:false, isModerator:false } })); await s.api.refresh();
  delayed.resolve({ data:{ isAdmin:true, isModerator:true } }); await earlier;
  assert.equal(s.api.isAdmin(), false);
});

test('admin search and pagination use bounded server pages and escape account data', async () => {
  const s = setup();
  s.respond(name => ({ data:name === 'get_boop_staff_access' ? { isAdmin:true, isModerator:true } : { items:[{ id:second, displayName:'<img onerror="bad()">', email:'a&b@example.test', isAdmin:false, isModerator:false }], hasMore:true } }));
  await s.open();
  assert.match(s.dialog.innerHTML, /&lt;img onerror=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(s.dialog.innerHTML, /<img/);
  s.click('data-staff-page', 'next'); await turn();
  assert.equal(s.calls.at(-1)[1].p_offset, 30); assert.equal(s.calls.at(-1)[1].p_limit, 30);
  s.dialog.emit('submit', { matches:selector => selector === '[data-staff-filter]', elements:{ search:{ value:'  camille  ' } } }); await turn();
  assert.deepEqual(s.calls.at(-1), ['list_boop_staff_users', { p_search:'camille', p_limit:30, p_offset:0 }]);
});

test('report details are plain text and review sends only the selected report and status', async () => {
  const s = setup();
  s.respond(name => ({ data:name === 'get_boop_staff_access' ? { isAdmin:false, isModerator:true } : name === 'review_boop_staff_report' ? { id:'report-1', kind:'publication', status:'reviewed' } : { items:[{ id:'report-1', kind:'publication', reason:'Spam', details:'<script>bad()</script>', excerpt:'<b>texte</b>', status:'pending', reporterName:'A & B' }], hasMore:false } }));
  await s.open('reports');
  assert.match(s.dialog.innerHTML, /&lt;script&gt;bad\(\)&lt;\/script&gt;/); assert.match(s.dialog.innerHTML, /&lt;b&gt;texte&lt;\/b&gt;/);
  s.click('data-staff-review', '0', { status:'reviewed' }); await turn();
  assert.deepEqual(s.calls.find(([name]) => name === 'review_boop_staff_report'), ['review_boop_staff_report', { p_kind:'publication', p_report_id:'report-1', p_status:'reviewed' }]);
  assert.match(s.dialog.innerHTML, /traitement du signalement a été enregistré/);
});

test('roles require an explicit confirmation and last-admin errors preserve server state', async () => {
  const s = setup();
  s.respond(name => name === 'set_boop_staff_roles' ? { error:{ code:'55000', message:'staff_last_admin' } } : { data:name === 'get_boop_staff_access' ? { isAdmin:true, isModerator:true } : { items:[{ id:first, displayName:'Alex', email:'alex@example.test', isAdmin:true, isModerator:true }], hasMore:false } });
  await s.open();
  const box = new Surface(), form = { dataset:{ staffRoles:'0' }, matches:selector => selector === '[data-staff-roles]', elements:{ admin:{ checked:false }, moderator:{ checked:true } }, querySelector:() => box };
  s.dialog.emit('submit', form);
  assert.equal(s.calls.some(([name]) => name === 'set_boop_staff_roles'), false); assert.match(box.innerHTML, /Confirmer les rôles/);
  s.click('data-staff-confirm'); await turn();
  assert.deepEqual(s.calls.find(([name]) => name === 'set_boop_staff_roles'), ['set_boop_staff_roles', { p_user_id:first, p_is_admin:false, p_is_moderator:true }]);
  assert.match(s.dialog.querySelector('.staff-status').textContent, /Conservez au moins un administrateur/);
  assert.equal(s.dialog.isConnected, true); assert.equal(s.api.isAdmin(), true);
});

test('auth logout wipes the dialog immediately and ignores late directory responses', async () => {
  const s = setup(); await s.start();
  const list = deferred();
  s.respond(name => name === 'get_boop_staff_access' ? { data:{ isAdmin:true, isModerator:true } } : list.promise);
  const opening = s.api.open('users'); await turn();
  const dialog = s.dialog; assert.equal(dialog.open, true);
  s.auth('SIGNED_OUT', null);
  assert.equal(dialog.isConnected, false); assert.equal(dialog.innerHTML, ''); assert.equal(s.entry.hidden, true);
  list.resolve({ data:{ items:[{ email:'private@example.test' }], hasMore:false } }); await opening;
  assert.equal(dialog.innerHTML, ''); assert.equal(s.api.isAdmin(), false);
});

test('403 clears staff data and refreshes rights; access-endpoint denial never loops', async () => {
  const s = setup(); await s.api.refresh();
  s.respond(name => name === 'get_boop_staff_access' ? { data:{ isAdmin:true, isModerator:true } } : { error:{ code:'42501' }, status:403 });
  await s.api.open('users');
  assert.equal(s.dialog.isConnected, false); assert.equal(s.dialog.innerHTML, ''); assert.equal(s.entry.hidden, true);
  s.respond(() => ({ error:{ code:'42501' }, status:403 })); await s.tick();
  assert.equal(s.timers.length, 0); assert.equal(s.api.isModerator(), false);
});

test('role revocation closes existing data and list failures provide a retry state', async () => {
  const s = setup(); await s.open(); const dialog = s.dialog;
  s.respond(() => ({ data:{ isAdmin:false, isModerator:false } })); await s.api.refresh();
  assert.equal(dialog.innerHTML, ''); assert.equal(dialog.isConnected, false);
  s.respond(name => name === 'get_boop_staff_access' ? { data:{ isAdmin:true, isModerator:true } } : { error:{ message:'Failed to fetch' } });
  await s.open(); assert.match(s.dialog.innerHTML, /Chargement interrompu/); assert.match(s.dialog.innerHTML, /Actualiser pour réessayer/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../js/mvp-app.js', import.meta.url), 'utf8');
const authCode = readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const deletionCode = between('  async function submitDeleteAccount(', '  function openPostDialog(');
const reportCode = between('  function safetyFormStatus(', '  function submitHelp(');
const blockingCode = between('  async function confirmBlock(', '  async function openUserDialog(');
const loadingCode = between('  async function refreshBlockedUsers(', '  let communityRequest=0;');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function authSetup({ result = { data:{ deleted:true } }, guest = false, signOutFailure = false, resumed = false, statusResult = { data:true } } = {}) {
  const values = new Map([['boop_supabase_auth_v1', 'cached-session']]);
  const storage = { getItem:k => values.get(k) || null, setItem:(k,v) => values.set(k,v), removeItem:k => values.delete(k) };
  if (guest) values.set('boop_guest_mode_v1', 'true');
  const calls = [], BT = {};
  let handler;
  const client = {
    rpc:async name => { calls.push(['status', name]); return statusResult; },
    from:() => { throw Error('Profile unavailable'); },
    auth:{ onAuthStateChange:fn => { handler = fn; }, getSession:async () => ({ data:{ session:{ user:{ id:'owner' } } } }),
      signOut:async options => { calls.push(['logout', options]); if (signOutFailure) throw Error('offline'); handler('SIGNED_OUT', null); return {}; } },
    functions:{ invoke:async (name, options) => { calls.push(['invoke', name, options]); return result; } }
  };
  const window = { BT, location:new URL('https://example.com/app.html' + (resumed ? '' : '?auth=recovery')),
    BOOP_SUPABASE_CONFIG:{ url:'https://example.supabase.co', publishableKey:'test' },
    supabase:{ createClient:() => client }, setTimeout(){}, dispatchEvent(){} };
  vm.runInNewContext(authCode, { BT, window, localStorage:storage, sessionStorage:storage, URL, URLSearchParams, Event, Date, console });
  return { auth:BT.auth, calls, values };
}

test('suppression distante: transmet le mot de passe et exige la confirmation serveur avant de purger la session', async () => {
  const h = authSetup({ signOutFailure:true });
  await h.auth.ready();
  const result = await h.auth.deleteAccount({ confirmation:'SUPPRIMER', password:'secret-current-password' });
  assert.equal(result.deleted, true);
  assert.equal(result.userId, 'owner');
  assert.equal(h.calls[0][1], 'delete-account');
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][2])), { body:{ confirmation:'SUPPRIMER', password:'secret-current-password' } });
  assert.equal(h.calls[1][1].scope, 'local');
  assert.equal(h.auth.getCurrentUser(), null);
  assert.equal(h.values.has('boop_supabase_auth_v1'), false);
});

test('suppression distante: une erreur ou une réponse ambiguë conserve session et données', async () => {
  for (const result of [{ error:{ context:{ json:async () => ({ error:'Mot de passe incorrect.' }) } } }, { data:{} }]) {
    const h = authSetup({ result });
    await h.auth.ready();
    await assert.rejects(h.auth.deleteAccount({ confirmation:'SUPPRIMER', password:'wrong' }));
    assert.equal(h.auth.getCurrentUser().id, 'owner');
    assert.equal(h.values.get('boop_supabase_auth_v1'), 'cached-session');
    assert.equal(h.calls.length, 1);
  }
});

test('suppression distante: propage le démarrage partiel et refuse invités ou confirmation invalide', async () => {
  const h = authSetup({ result:{ error:{ context:{ json:async () => ({ error:'Suppression à reprendre.', deletionStarted:true }) } } } });
  await h.auth.ready();
  await assert.rejects(h.auth.deleteAccount({ confirmation:'SUPPRIMER', password:'password' }), e => e.deletionStarted === true && /reprendre/.test(e.message));
  assert.equal(h.auth.getDeletionState(), true);
  for (const options of [{ guest:true }, {}]) {
    const other = authSetup(options); await other.auth.ready();
    await assert.rejects(other.auth.deleteAccount({ confirmation:options.guest ? 'SUPPRIMER' : 'supprimer', password:'password' }));
    assert.equal(other.calls.length, 0);
  }
});

test('suppression partielle après rechargement: garde une session utilisable sans recréer le profil puis permet la reprise', async () => {
  const h = authSetup({ resumed:true });
  const user = await h.auth.ready();
  assert.equal(user.id, 'owner');
  assert.equal(user.profile, null);
  assert.equal(h.auth.getDeletionState(), true);
  assert.equal(h.calls[0][1], 'get_boop_account_deletion_status');
  const result = await h.auth.deleteAccount({ confirmation:'SUPPRIMER', password:'password' });
  assert.equal(result.deleted, true);
  assert.equal(h.auth.getDeletionState(), false);
});

test('statut suppression: les erreurs ordinaires de profil ou réseau restent visibles', async () => {
  for (const statusResult of [{ data:false }, { error:{ code:'PGRST202' } }]) {
    const h = authSetup({ resumed:true, statusResult });
    await assert.rejects(h.auth.ready(), /Profile unavailable/);
  }
  const h = authSetup({ resumed:true, statusResult:{ error:{ message:'Network failure' } } });
  await assert.rejects(h.auth.ready(), /Internet/);
  assert.equal(h.auth.getDeletionState(), false);
});

function formStub() {
  const submit = { disabled:false, textContent:'Supprimer définitivement mon compte' }, status = { textContent:'' }, attributes = new Map();
  const form = { dataset:{}, isConnected:true, innerHTML:'',
    querySelector:selector => selector === '[data-safety-status]' ? status : submit,
    setAttribute:(k,v) => attributes.set(k,v), removeAttribute:k => attributes.delete(k) };
  return { form, submit, status, attributes };
}

function uiSetup({ deletion = async () => ({ deleted:true }), safety = {}, guest = false } = {}) {
  const events = [], state = { owner:'owner', storeOwner:'owner' };
  const ui = { syncReady:true, syncPending:true, clubSpaces:new Map(), syncUnsubscribe:() => events.push('unsubscribe'), notificationUnsubscribe:() => events.push('unsubscribe-notifications') };
  const BT = { auth:{ getCurrentUser:() => state.owner ? { id:state.owner } : null, deleteAccount:deletion },
    communitySafety:safety, readingCards:{ clearLocal:async id => events.push('erase-cards:'+id) } };
  const context = { BT, ui, window:{ BT }, isGuestMode:() => guest,
    store:{ getUserId:() => state.storeOwner, clearAll:() => events.push('erase-store'), getCommunity:() => ({ users:[{ id:'reader', name:'Camille' }] }),
      blockUser:id => events.push('block:'+id), unblockUser:id => events.push('unblock:'+id), replaceBlockedUsers:ids => events.push('loaded:'+ids.join(',')) },
    location:{}, clearTimeout:() => events.push('cancel-sync'), clearInterval(){}, scheduleUserDataSync:() => events.push('resume-sync'),
    showToast:m => events.push(m), closeDialog:() => events.push('close'), render:() => events.push('render'), confirm:() => true,
    refreshCommunity:async () => {}, refreshReaders:async () => {}, refreshNotifications:async () => {} };
  vm.runInNewContext(reportCode + deletionCode + blockingCode + loadingCode + '\nthis.actions = { submitDeleteAccount, submitReport, confirmBlock, unblockReader, refreshBlockedUsers };', context);
  return { ...formStub(), context, actions:context.actions, events, ui, state };
}
const deletionData = () => new Map([['confirmation','SUPPRIMER'], ['password','password']]);

test('interface suppression: double envoi bloqué et copie locale préservée jusqu’au succès', async () => {
  const pending = deferred(); let calls = 0;
  const h = uiSetup({ deletion:() => { calls++; return pending.promise; } });
  const request = h.actions.submitDeleteAccount(h.form, deletionData());
  await h.actions.submitDeleteAccount(h.form, deletionData());
  assert.equal(calls, 1); assert.equal(h.submit.disabled, true); assert.equal(h.ui.syncStopped, true);
  assert.equal(h.events.includes('erase-store'), false);
  pending.resolve({ deleted:true }); await request;
  assert.ok(h.events.indexOf('erase-cards:owner') < h.events.indexOf('erase-store'));
  assert.equal(h.context.location.href, 'index.html?reason=account-deleted');
});

test('interface suppression: erreur normale reprise sync, erreur partielle sync suspendue, jamais effacement local', async () => {
  for (const partial of [false, true]) {
    const h = uiSetup({ deletion:async () => { throw Object.assign(Error(partial ? 'Suppression à reprendre.' : 'Mot de passe incorrect.'), { deletionStarted:partial }); } });
    await h.actions.submitDeleteAccount(h.form, deletionData());
    assert.equal(h.events.includes('erase-store'), false);
    assert.equal(h.events.includes('resume-sync'), !partial);
    assert.equal(h.ui.syncReady, !partial);
    assert.equal(h.submit.disabled, false);
    assert.match(h.status.textContent, partial ? /reprendre/ : /incorrect/);
    assert.equal(h.context.location.href, undefined);
  }
});

test('interface suppression: invité refusé, compte changé préservé et nettoyage incomplet annoncé après succès', async () => {
  let calls = 0;
  const guest = uiSetup({ guest:true, deletion:async () => { calls++; } });
  await guest.actions.submitDeleteAccount(guest.form, deletionData()); assert.equal(calls, 0);
  const changed = uiSetup(); changed.state.storeOwner = 'another-account';
  await changed.actions.submitDeleteAccount(changed.form, deletionData());
  assert.equal(changed.events.includes('erase-store'), false);
  const cleanup = uiSetup(); cleanup.context.BT.readingCards.clearLocal = async () => { throw Error('IndexedDB unavailable'); };
  await cleanup.actions.submitDeleteAccount(cleanup.form, deletionData());
  assert.equal(cleanup.events.includes('erase-store'), true);
  assert.match(cleanup.form.innerHTML, /en ligne ont été supprimés/);
  assert.match(cleanup.form.innerHTML, /n’a pas pu être terminé/);
});

test('signalement: aucun faux succès, puis confirmation uniquement après enregistrement serveur', async () => {
  const pending = deferred(); let calls = 0;
  const h = uiSetup({ safety:{ reportUser:() => { calls++; return pending.promise; } } });
  const data = new Map([['targetId','reader'], ['reason','Spam ou publicité'], ['details','example']]);
  const request = h.actions.submitReport(h.form, data);
  await h.actions.submitReport(h.form, data);
  assert.equal(calls, 1); assert.equal(h.submit.disabled, true);
  assert.equal(h.form.innerHTML, '');
  pending.reject(Error('Signalement non enregistré.')); await request;
  assert.equal(h.submit.disabled, false); assert.equal(h.form.innerHTML, '');
  assert.match(h.status.textContent, /non enregistré/);
  h.context.BT.communitySafety.reportUser = async () => {};
  await h.actions.submitReport(h.form, data);
  assert.match(h.form.innerHTML, /enregistré pour examen/);
});

test('blocage: mise à jour locale après serveur uniquement, déblocage refusé reste inchangé', async () => {
  const pending = deferred();
  const h = uiSetup({ safety:{ blockUser:() => pending.promise, unblockUser:async () => { throw Error('offline'); } } });
  const trigger = { disabled:false }, request = h.actions.confirmBlock('reader', trigger);
  assert.equal(h.events.includes('block:reader'), false); assert.equal(trigger.disabled, true);
  pending.resolve(); await request;
  assert.equal(h.events.includes('block:reader'), true); assert.equal(trigger.disabled, false);
  await h.actions.unblockReader('reader', trigger);
  assert.equal(h.events.includes('unblock:reader'), false); assert.equal(trigger.disabled, false);
});

test('blocages: hydratation serveur et rejet des réponses obsolètes après mutation ou changement de compte', async () => {
  for (const change of ['none', 'account', 'mutation']) {
    const pending = deferred(), h = uiSetup({ safety:{ loadBlockedUsers:() => pending.promise } });
    const request = h.actions.refreshBlockedUsers();
    if (change === 'account') h.state.owner = 'another-owner';
    if (change === 'mutation') h.ui.blockedUsersRequest++;
    pending.resolve(['reader']); await request;
    assert.equal(h.events.includes('loaded:reader'), change === 'none');
  }
});

test('store: restaure les blocages sur un autre appareil et retire les anciennes amitiés sans restauration au déblocage', () => {
  const values = new Map(), BT = {};
  const storage = { getItem:k => values.get(k) || null, setItem:(k,v) => values.set(k,v), removeItem:k => values.delete(k) };
  vm.runInNewContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8'), { BT, window:{ BT, addEventListener(){} }, localStorage:storage, navigator:{ onLine:true }, console, Date, Math, JSON, Set, Map, Intl });
  BT.store.useUser('owner');
  BT.store.mergeRemoteUsers([{ id:'reader', name:'Camille', friendState:'friend' }]);
  BT.store.addPost({ id:'post', authorId:'reader', text:'hello', isRemote:true });
  BT.store.replaceBlockedUsers(['reader','reader','owner']);
  assert.deepEqual(Array.from(BT.store.getSettings().blockedUsers), ['reader']);
  assert.equal(BT.store.getCommunity().posts.some(post => post.authorId === 'reader'), false);
  BT.store.mergeRemoteUsers([{ id:'reader', name:'Camille', friendState:'friend' }]);
  assert.equal(BT.store.getCommunity().users.find(user => user.id === 'reader').friendState, 'blocked');
  BT.store.replaceBlockedUsers([]);
  assert.equal(BT.store.getCommunity().users.find(user => user.id === 'reader').friendState, 'none');
  assert.equal(BT.store.getCommunity().posts.some(post => post.authorId === 'reader'), false);
});

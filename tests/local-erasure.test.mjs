import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../js/mvp-app.js', import.meta.url), 'utf8');
const deletion = app.slice(app.indexOf('  async function submitDeleteAccount('), app.indexOf('  function openPostDialog('));

function setup(signOut) {
  const events = [];
  const ui = { syncReady:true, syncPending:true, syncUnsubscribe:() => events.push('unsubscribe') };
  const BT={auth:{signOut,isGuest:()=>false,getCurrentUser:()=>({id:'owner'})},readingCards:{clearLocal:async id=>events.push('erase-cards:'+id)}};
  const context = {
    ui, store:{ clearAll:() => events.push('erase') },
    BT,window:{BT}, location:{},
    clearTimeout:() => events.push('cancel-sync'), clearInterval:() => {},
    showToast:message => events.push(message)
  };
  vm.runInNewContext(deletion + '\nthis.erase = submitDeleteAccount;', context);
  return { context, events, ui };
}

test('effacement: suspend les envois avant une déconnexion lente et efface ensuite', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { context, events, ui } = setup(() => pending);
  const task = context.erase(null, new Map([['confirmation','SUPPRIMER']]));
  assert.equal(ui.syncStopped, true);
  assert.equal(ui.syncReady, false);
  assert.deepEqual(events, ['cancel-sync','unsubscribe']);
  finish();
  await task;
  assert.equal(events.at(-1), 'erase');
  assert.equal(events.includes('erase-cards:owner'),true);
  assert.equal(context.location.href, 'index.html?reason=local-data-deleted');
});

test('effacement: conserve la copie locale si la déconnexion échoue', async () => {
  const { context, events } = setup(async () => { throw new Error('offline'); });
  await context.erase(null, new Map([['confirmation','SUPPRIMER']]));
  assert.equal(events.includes('erase'), false);
  assert.equal(events.includes('erase-cards:owner'),false);
  assert.equal(context.location.href, undefined);
});

test('effacement du store: aucune donnée de démonstration ni notification de synchronisation', () => {
  const storage = new Map();
  const BT = {};
  const context = { BT, window:{ BT, addEventListener(){} },
    localStorage:{ getItem:key => storage.get(key) ?? null, setItem:(key,value) => storage.set(key,value), removeItem:key => storage.delete(key) },
    navigator:{ onLine:true }, console, Date, Math, JSON, Set, Map, Intl };
  vm.runInNewContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8'), context);
  BT.store.useUser('erasure-test');
  const snapshot = BT.store.getSyncedData();
  const reordered = Object.fromEntries(Object.entries(snapshot).reverse());
  BT.store.markDataSynced(new Date().toISOString(), reordered);
  assert.equal(BT.store.getDataSyncStatus().dirty, false);
  reordered.books.push({id:'different'});
  assert.equal(BT.store.getSyncBaseline().books.length, 0);
  storage.set('boop_sync_recovery:erasure-test','[]');
  let calls = 0;
  BT.store.subscribe(() => calls++);
  BT.store.clearAll();
  assert.equal(calls, 0);
  assert.equal(BT.store.getSyncedData().books.length, 0);
  assert.equal(storage.has('boop_mvp_v5:erasure-test'), false);
  assert.equal(storage.has('boop_sync_recovery:erasure-test'), false);
});

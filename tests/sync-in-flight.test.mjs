import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../js/mvp-app.js',import.meta.url),'utf8');
const code = app.slice(app.indexOf('  async function syncUserDataNow()'),app.indexOf('  async function bootstrapUserDataSync('));

test('une modification pendant l’envoi reste locale et non acquittée',async () => {
  let current = {books:[{id:'a',title:'Sent'}]};
  let acknowledged;
  let finish;
  const pending = new Promise(resolve => {finish=resolve;});
  const clone = x => JSON.parse(JSON.stringify(x));
  const context = {
    ui:{syncReady:true},isGuestMode:() => false,navigator:{onLine:true},console,
    store:{
      getSyncedData:() => clone(current),getSyncBaseline:() => ({books:[{id:'a',title:'Base'}]}),
      getDataSyncStatus:() => ({dirty:true}),
      markDataSynced:(_,snapshot) => { acknowledged=clone(snapshot); },
      replaceSyncedData:() => { throw new Error('Must not replace edits made during request'); }
    },
    window:{BT:{userDataSync:{mergeSnapshot:() => pending}}},
    showToast:() => {},scheduleUserDataSync:() => {}
  };
  vm.runInNewContext(code+'\nthis.sync = syncUserDataNow;',context);
  const sending = context.sync();
  current.books[0].title='Edited during send';
  finish({books:[{id:'a',title:'Sent'},{id:'b',title:'Other device'}]});
  await sending;
  assert.equal(current.books[0].title,'Edited during send');
  assert.equal(acknowledged.books[0].title,'Sent');
  assert.equal(acknowledged.books.length,1);
});

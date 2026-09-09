import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
function setup() {
  const storage = new Map(), BT = {};
  let now = Date.parse('2026-09-09T12:00:00Z'), full = false;
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  vm.runInNewContext(source, { BT, window:{ BT, addEventListener(){} }, navigator:{onLine:true}, console, Date:ClockDate, Math, JSON, Set, Map, Intl,
    localStorage:{ getItem:key => storage.get(key) ?? null, setItem:(key,value) => { if(full) throw new Error('QuotaExceeded'); storage.set(key,value); }, removeItem:key => storage.delete(key) } });
  return { store:BT.store, storage, advance:ms => now+=ms, fill:() => { full=true; } };
}

test('brouillons : séparation des comptes et absence dans les données synchronisées', () => {
  const { store } = setup();
  store.useUser('reader-a');
  const before = JSON.stringify(store.getSyncedData());
  assert.equal(store.saveDraft('trace:book-1',{text:'Pensée privée A'}),true);
  assert.equal(store.getDraft('trace:book-1').text,'Pensée privée A');
  assert.equal(JSON.stringify(store.getSyncedData()),before);
  store.useUser('reader-b');
  assert.equal(store.getDraft('trace:book-1'),null);
  store.useUser('reader-a');
  assert.equal(store.getDraft('trace:book-1').text,'Pensée privée A');
  store.clearAll();
  assert.equal(store.getDraft('trace:book-1'),null);
});

test('brouillons : limite de conservation et stockage plein signalé', () => {
  const {store,advance,fill}=setup(); store.useUser('reader');
  store.saveDraft('trace:b',{text:'Une pensée'});
  advance(31*86400000);
  assert.equal(store.getDraft('trace:b'),null);
  fill();
  assert.equal(store.saveDraft('trace:c',{text:'Échec de stockage'}),false);
  assert.equal(store.getDraft('trace:c'),null);
});

test('brouillons : seuls les dix derniers sont conservés', () => {
  const {store,storage}=setup(); store.useUser('reader');
  for(let n=0;n<12;n++) store.saveDraft(`trace:${n}`,{text:`Pensée ${n}`});
  assert.equal(store.getDraft('trace:0'),null);
  assert.equal(store.getDraft('trace:11').text,'Pensée 11');
  assert.equal(Object.keys(JSON.parse(storage.get('boop_mvp_v5:reader:drafts'))).length,10);
});

test('lecture : la durée reste figée pendant le bilan et une reprise relance le temps', () => {
  const {store,advance}=setup(); store.useUser('reader');
  const book=store.addBook({title:'Lecture test',authors:['Auteur'],totalPages:400,status:'en-cours'});
  store.startActiveSession(book.id); advance(60000); store.pauseActiveSession();
  advance(180000); assert.equal(store.activeDuration(),60);
  store.resumeActiveSession(); advance(30000); store.pauseActiveSession();
  const saved=store.finishActiveSession({endPage:237});
  assert.equal(saved.durationSeconds,90);
  assert.equal(store.getBookById(book.id).currentPage,237);
});

test('affichage : la grille démarre par défaut et un choix explicite reste conservé', () => {
  const {store}=setup(); store.useUser('reader');
  assert.equal(store.getSettings().libraryView,'grid');
  store.saveSettings({libraryView:'shelf'}); store.useUser('another'); store.useUser('reader');
  assert.equal(store.getSettings().libraryView,'shelf');
});

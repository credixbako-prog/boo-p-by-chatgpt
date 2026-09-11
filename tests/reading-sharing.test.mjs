import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
async function setup() {
  const memory=new Map(),context={console,Date,Math,JSON,Set,Map,navigator:{onLine:true},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},window:{BT:{},addEventListener(){}},setTimeout,clearTimeout};
  context.BT=context.window.BT;vm.createContext(context);vm.runInContext(await read('js/store.js'),context);
  context.BT.store.useUser('sharing-test');vm.runInContext(await read('js/reading-sharing.js'),context);
  return {store:context.BT.store,sharing:context.BT.sharing,memory};
}
test('partage : seul le carnet enregistré est proposé, sans messages IA ni brouillons',async()=>{
  const {store,sharing}=await setup();const book=store.addBook({title:'Un livre',authors:['Une autrice'],reflection:{notebook:'Mon texte enregistré',sections:{retained:'Une idée',questions:'Une question'},edit:'SECRET EDIT',draft:'SECRET AI DRAFT',messages:[{role:'user',content:'SECRET CHAT'}],sectionDraft:{retained:'SECRET SECTION'}}});
  const before=JSON.stringify(store.getBookById(book.id));const result=sharing.source('notebook',book.id);
  assert.match(result.content,/Mon texte enregistré/);assert.match(result.content,/Une question/);assert.doesNotMatch(JSON.stringify(result),/SECRET/);
  result.content='Ma copie publique';assert.equal(JSON.stringify(store.getBookById(book.id)),before);
});
test('partage : les messages proposés couvrent les souvenirs et étapes de lecture sans notes privées',async()=>{
  const {store,sharing}=await setup();const book=store.addBook({title:'Un livre',authors:['Autrice']});
  for(const kind of ['word','expression','citation']){
    const entry=store.addLexiconWord({kind,word:'Découverte',definition:'Un sens',note:'SECRET NOTE',bookId:book.id});
    const result=sharing.source(kind,entry.id);assert.ok(result.text);assert.match(result.content,/Découverte/);assert.doesNotMatch(JSON.stringify(result),/SECRET/);
  }
  const thought=store.saveTrace({bookId:book.id,text:'Une pensée personnelle',privacy:'private'});
  assert.equal(sharing.source('thought',thought.id).content,'Une pensée personnelle');
  assert.match(sharing.source('debut',book.id).text,/nouvelle lecture/);assert.match(sharing.source('fin',book.id).text,/refermer/);
  assert.throws(()=>sharing.source('notebook','missing'),/plus disponible/);
});
test('partage : une publication retirée est purgée du fil et les publications distantes ne sont pas persistées',async()=>{
  const {store,memory}=await setup();store.addPost({id:'local',text:'Mon essai local'});
  store.mergeRemotePosts([{id:'remote',authorId:'friend',text:'Copie privée',visibility:'friends',readingKind:'notebook',isRemote:true}]);
  assert.equal(store.getCommunity().posts.find(p=>p.id==='remote').readingKind,'notebook');
  assert.ok(!memory.get('boop_mvp_v5:sharing-test').includes('Copie privée'));
  store.mergeRemotePosts([]);assert.ok(!store.getCommunity().posts.some(p=>p.id==='remote'));assert.ok(store.getCommunity().posts.some(p=>p.id==='local'));
});
test('partage : changer de compte pendant la préparation réseau empêche la publication et le retrait',async()=>{
  let user={id:'first',name:'Lecteur'},release,writes=0;
  const auth={isGuest:()=>false,isAuthenticated:()=>true,getCurrentUser:()=>user,
    ready:()=>new Promise(resolve=>{release=resolve;}),getClient:()=>{writes++;throw new Error('No request expected');}};
  const context={console,window:{BT:{auth}}};
  context.BT=context.window.BT;vm.createContext(context);vm.runInContext(await read('js/community-api.js'),context);
  const pending=context.BT.community.publishReading({kind:'word',sourceId:'one',text:'Bonjour',content:'Un mot',visibility:'friends'});
  user={id:'second'};release();await assert.rejects(pending,/compte a changé/);
  user={id:'first'};const withdrawal=context.BT.community.withdrawReading('publication');user={id:'second'};release();await assert.rejects(withdrawal,/compte a changé/);
  assert.equal(writes,0);
});

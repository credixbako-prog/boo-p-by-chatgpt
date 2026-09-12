import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=f=>readFile(new URL('../'+f,import.meta.url),'utf8');
async function setup(memory=new Map()) {
  const context={console,Date,Math,JSON,Set,Map,navigator:{onLine:true},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},window:{BT:{},addEventListener(){}},setTimeout,clearTimeout};context.BT=context.window.BT;vm.createContext(context);
  for(const f of ['js/thought-editor.js','js/store.js','js/reading-sharing.js'])vm.runInContext(await read(f),context);
  context.BT.store.useUser('thoughts');return {...context.BT,memory};
}
test('pensées : format allowlist, HTML échappé et incohérences ignorées',async()=>{
  const {thoughtEditor:e}=await setup();const text='<img src=x onerror=alert(1)> mot';const format={version:1,runs:[{text,bold:true,italic:true,underline:true,size:'large',html:'<script>',style:'color:red',url:'javascript:bad'}]};
  const html=e.html(text,format);assert.ok(html.includes('&lt;img'));assert.ok(html.includes('<strong>'));assert.ok(html.includes('<em>'));assert.ok(html.includes('<u>'));assert.ok(html.includes('thought-size-large'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('color:red'));
  assert.equal(e.normalize('autre texte',format),null);assert.equal(e.normalize(text,'bad json'),null);assert.equal(e.html('Nouveau texte',format),'Nouveau texte');
});
test('pensées : sauvegarde, édition et redémarrage conservent texte, date et mise en forme',async()=>{
  const a=await setup(),book=a.store.addBook({title:'Un livre'}),format={version:1,runs:[{text:'Une idée',bold:true},{text:' en devenir',italic:true}]};
  const trace=a.store.saveTrace({bookId:book.id,text:'Une idée en devenir',formatting:format,createdAt:'2026-08-01T12:00:00Z',page:30});
  a.store.saveTrace({id:trace.id,text:'Une idée en devenir',formatting:format,page:32});
  const b=await setup(a.memory),saved=b.store.getTraces().find(t=>t.id===trace.id);
  assert.equal(saved.page,32);assert.equal(saved.bookId,book.id);assert.equal(saved.createdAt,'2026-08-01T12:00:00Z');assert.equal(saved.formatting.runs[0].bold,true);
  const c=await setup();c.store.replaceSyncedData(b.store.getSyncedData());assert.equal(c.store.getTraces().find(t=>t.id===trace.id).formatting.runs[0].bold,true);
  const pub=b.sharing.source('thought',trace.id);assert.equal(b.sharing.thought(pub.content).text,saved.text);assert.ok(b.sharing.publicationHTML('thought',pub.content,'Légende').includes('<strong>Une idée</strong>'));
});
test('session : brouillon enrichi restauré puis enregistré dans le carnet privé',async()=>{
  const a=await setup(),book=a.store.addBook({title:'Lecture'}),session=a.store.startActiveSession(book.id),formatting={version:1,runs:[{text:'La fin',underline:true,size:'large'}]};
  a.store.updateActiveSession({traceDraft:'La fin',traceFormatting:formatting},session.id);
  const b=await setup(a.memory),draft=b.store.getActiveSession();assert.equal(draft.traceFormatting.runs[0].underline,true);
  b.store.finishActiveSession({traceText:draft.traceDraft,endPage:10},draft.id);
  const saved=b.store.getTraces().find(t=>t.text==='La fin');assert.equal(saved.privacy,'private');assert.equal(saved.formatting.runs[0].size,'large');
});
test('fil : le chargement garde le contenu entier de toutes les publications',async()=>{
  const {store}=await setup();const content='Une réflexion complète. '.repeat(100);
  store.mergeRemotePosts([{id:'remote',readingKind:'notebook',readingContent:content,text:'Ma légende',authorId:'friend'}]);
  assert.equal(store.getCommunity().posts.find(p=>p.id==='remote').readingContent,content);
});
test('édition de publication : filtres propriétaire et changement de compte avant écriture',async()=>{
  let user={id:'owner'},release,writes=0,filters=[];
  const request={update(){writes++;return this;},eq(...v){filters.push(v);return this;},is(...v){filters.push(v);return this;},select(){return this;},single:async()=>({data:{id:'post'}})};
  const auth={isGuest:()=>false,isAuthenticated:()=>true,getCurrentUser:()=>user,ready:async()=>{},getClient:()=>({from:()=>request})};const c={window:{BT:{auth}},console};c.BT=c.window.BT;vm.createContext(c);vm.runInContext(await read('js/community-api.js'),c);
  await c.BT.community.updatePost({id:'post',text:'Modifié',bookTitle:'Livre',type:'trace',visibility:'friends'});assert.equal(writes,1);assert.deepEqual(filters,[['id','post'],['author_id','owner'],['reading_kind',null]]);
  auth.ready=()=>new Promise(r=>release=r);const pending=c.BT.community.updatePost({id:'post',text:'Modifié',type:'trace',visibility:'friends'});user={id:'other'};release();await assert.rejects(pending,/compte a changé/);assert.equal(writes,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/store.js',import.meta.url),'utf8');
function setup(){const memory=new Map(), BT={};const context={BT,window:{BT,addEventListener(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},navigator:{onLine:true},Date,Math,JSON,Set,Map,Intl,TextEncoder,console};vm.runInNewContext(source,context);BT.store.useUser('badge-test');return BT.store;}
test('30 milestones retain acquired dates, and awards fire once after an actual action',()=>{
 const s=setup();assert.equal(s.getBadges().items.length,30);assert.equal(s.consumeBadgeCelebrations().length,0);
 s.addLexiconWord({word:'Sérendipité'});const award=s.consumeBadgeCelebrations();assert.equal(award.length,1);assert.equal(award[0].id,'first-word');
 const date=award[0].unlockedAt;s.saveSettings({theme:'dark'});assert.equal(s.consumeBadgeCelebrations().length,0);
 s.deleteLexiconWord(s.getLexicon()[0].id);assert.equal(s.getBadges().items.find(b=>b.id==='first-word').unlockedAt,date);
 s.useUser('another-reader');assert.equal(s.getBadges().latest,null);
});
test('hydration and remote awards are silent, while manual notebooks unlock without AI',()=>{
 const s=setup();s.replaceSyncedData({books:[{id:'b',title:'Livre',status:'lu',libraryState:'library',reflection:{messages:[{content:'Conversation seule'}]}}],lexicon:[{id:'w',word:'Mot',kind:'word'}]});
 assert.equal(s.consumeBadgeCelebrations().length,0);assert.equal(s.getBadges().items.find(b=>b.id==='first-notebook').unlockedAt,null);
 assert.equal(s.saveBookReflection('b',{notebook:'Ma réflexion libre'}),true);
 assert.ok(s.consumeBadgeCelebrations().some(b=>b.id==='first-notebook'));
 s.mergeBadgeAwards([{badge_id:'first-word',unlocked_at:'2025-01-01T12:00:00.000Z'},{badge_id:'injected',unlocked_at:new Date().toISOString()}]);
 assert.equal(s.getBadges().items.find(b=>b.id==='first-word').unlockedAt,'2025-01-01T12:00:00.000Z');assert.equal(s.consumeBadgeCelebrations().length,0);
});
test('multiple thresholds are grouped and remain pending through a sync round trip',()=>{
 const s=setup();s.addBook({title:'Un livre',status:'lu',genre:'Romans',situation:'donne'});
 const pending=s.getState().badges.pending;assert.ok(pending.includes('last-page'));assert.ok(pending.includes('book-passer'));
 const awards=s.getBadges().items.filter(b=>b.unlockedAt).map(b=>({badge_id:b.id,unlocked_at:b.unlockedAt}));
 s.mergeBadgeAwards(awards,{preservePending:true});assert.ok(s.consumeBadgeCelebrations().length>=2);assert.equal(s.consumeBadgeCelebrations().length,0);
});

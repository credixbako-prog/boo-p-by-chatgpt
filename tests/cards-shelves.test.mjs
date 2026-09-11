import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('rayons : accents, casse et espaces réutilisent le même libellé',()=>{
 const BT={store:{getBooks:()=>[{libraryState:'library',genre:'Poésie'},{libraryState:'library',genre:'Romans'},{libraryState:'library',genre:'romans'}]}};
 const ctx={window:{BT,addEventListener(){}},BT,document:{addEventListener(){}}};vm.runInNewContext(read('js/library-shelves.js'),ctx);
 assert.equal(BT.shelves.names().length,2);assert.equal(BT.shelves.canonical('  poesie '),'Poésie');assert.equal(BT.shelves.canonical(' ROMANS '),'Romans');assert.equal(BT.shelves.canonical('  Littérature   japonaise '),'Littérature japonaise');
 assert.match(BT.shelves.field('Romans'),/Créer un rayon/);assert.doesNotMatch(BT.shelves.field('Romans'),/<datalist/);
});
test('citation : guillemets et légende échappent les contenus, sans HTML utilisateur',()=>{
 const BT={store:{subscribe(){}}},ctx={BT,window:{BT,addEventListener(){}}};vm.runInNewContext(read('js/reading-sharing.js'),ctx);
 const data=JSON.stringify({type:'boop-citation-v1',quote:'<img src=x onerror=alert(1)>',author:'Une autrice'});
 const html=BT.sharing.quoteHTML(data,'<script>ma légende</script>');assert.match(html,/<blockquote>/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img/);assert.ok(html.indexOf('Une autrice')<html.indexOf('ma légende'));
 assert.equal(BT.sharing.citation('Une citation historique').quote,'Une citation historique');
});
test('cartes : publication serveur limitée à une image figée et une audience explicite',()=>{
 const sql=read('supabase/migrations/20260911204712_reading_cards.sql');assert.match(sql,/grant update\(caption,visibility\)/);assert.match(sql,/visibility='private'/);assert.match(sql,/private.is_accepted_reader_friend/);assert.match(sql,/enable row level security/);
 const js=read('js/reading-cards.js');assert.match(js,/canvas.toDataURL\('image\/jpeg'/);assert.doesNotMatch(js,/buildData|reading_content|\.reflection/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/reader-profile-api.js',import.meta.url),'utf8');
function setup(){let user='first',release,writes=0;const BT={auth:{isAuthenticated:()=>!!user,isGuest:()=>!user,getCurrentUser:()=>({id:user,name:'Lecteur'}),ready:()=>new Promise(r=>{release=r;}),getClient:()=>{writes++;throw new Error('No request expected');}}};const context={window:{BT},BT};vm.createContext(context);vm.runInContext(source,context);return {api:BT.readerProfileApi,user:id=>{user=id;},release:()=>release(),writes:()=>writes};}
test('profil : un changement de compte bloque tous les nouveaux envois',async()=>{
 for(const action of [a=>a.savePreferences({welcome:'Moi',show_current:true,featured:[]},'first'),a=>a.trace({owner:'friend',book:'b'},'Une Trace',null,'first'),a=>a.encourage({post:'p'},false,'first'),a=>a.removeTrace({post:'p'},'t','first')]){const s=setup(),pending=action(s.api);s.user('second');s.release();await assert.rejects(pending,/Reconnectez-vous/);assert.equal(s.writes(),0);}
});
test('profil : un invité ne peut pas lire une bibliothèque ou envoyer une Trace',async()=>{
 const s=setup();s.user(null);let pending=s.api.books('friend');s.release();await assert.rejects(pending,/Reconnectez-vous/);pending=s.api.trace({post:'p'},'Une Trace');s.release();await assert.rejects(pending,/Reconnectez-vous/);assert.equal(s.writes(),0);
});
test('profil : une Trace vide ou trop longue est refusée avant le réseau',async()=>{
 for(const body of ['   ','x'.repeat(1201)]){const s=setup(),pending=s.api.trace({post:'p'},body,null,'first');s.release();await assert.rejects(pending,/1 200/);assert.equal(s.writes(),0);}
});

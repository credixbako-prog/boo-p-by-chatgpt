import fs from 'node:fs';
// Contrôles d’audit hors réseau. Exécuter depuis la racine du dépôt :
// node security/audit-local-checks.mjs
// Réutilise le double Supabase des tests existants ; ne simule pas PostgreSQL/RLS.
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync('tests/user-data-sync.test.mjs','utf8');
const syncSource = fs.readFileSync('js/user-data-sync-api.js','utf8');
const helper = source.slice(source.indexOf('class MemoryQuery'), source.indexOf("\ntest('"));
const sandbox = {vm, syncSource, USER_ID:'11111111-1111-1111-1111-111111111111', plain:value=>JSON.parse(JSON.stringify(value))};
vm.runInNewContext(helper+'\nthis.auditLoadSync = loadSync;',sandbox);
const {sync} = sandbox.auditLoadSync();
await assert.rejects(sync.pushAll({books:[]},{replaceRemote:true}), /désactivé/);
console.log('CORRIGÉ : ancien remplacement destructif refusé. Tests du nouveau protocole : security/atomic-sync-regression.sql.');
const storage = new Map();
const BT = {};
const context = {BT,window:{BT,addEventListener(){}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},navigator:{onLine:true},console,Date,Math,JSON,Set,Map,Intl};
vm.runInNewContext(fs.readFileSync('js/store.js','utf8'),context);
BT.store.useUser('audit-account');
let emissions=0;
BT.store.subscribe(()=>emissions++);
BT.store.clearAll();
assert.equal(emissions,0);
assert.equal(BT.store.getSyncedData().books.length,0);
assert.equal(storage.has('boop_mvp_v5:audit-account'),false);
console.log('CORRIGÉ EN MÉMOIRE : clearAll retire la copie du compte sans exemples, réécriture ni notification des abonnés.');

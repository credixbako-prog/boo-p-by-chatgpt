import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../js/community-safety.js', import.meta.url), 'utf8');
const first='27c2da67-6666-4111-9222-000000000001', second='27c2da67-6666-4111-9222-000000000002';
function setup({deferReady=false, response={data:[],error:null}}={}) {
  let user=first, release, calls=[], result=response;
  const chain={then:resolve=>Promise.resolve(typeof result==='function'?result():result).then(resolve)};
  for(const key of ['insert','delete','select','eq','order','range']) chain[key]=(...args)=>{calls.push([key,...args]);return chain;};
  const BT={auth:{isAuthenticated:()=>!!user,isGuest:()=>!user,getCurrentUser:()=>({id:user}),ready:()=>deferReady?new Promise(r=>{release=r;}):Promise.resolve(),getClient:()=>({from:table=>{calls.push(['from',table]);return chain;}})}};
  vm.runInNewContext(source,{window:{BT},BT});
  return {api:BT.communitySafety,calls,setUser:value=>{user=value;},release:()=>release(),setResult:value=>{result=value;}};
}
test('a report records the current account and bounded plain text',async()=>{
  const s=setup();await s.api.reportUser(second,{reason:'Autre motif',details:'  Mon signalement  '});
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls)),[['from','user_reports'],['insert',{reporter_id:first,reported_user_id:second,reason:'Autre motif',details:'Mon signalement'}]]);
});
test('invalid targets, reasons, and details never write',async()=>{
  for(const action of [s=>s.api.blockUser(first),s=>s.api.blockUser('demo-reader'),s=>s.api.reportUser(second,{reason:'unknown'}),s=>s.api.reportUser(second,{reason:'Autre motif',details:'x'.repeat(2001)})]){const s=setup();await assert.rejects(action(s));assert.equal(s.calls.length,0);}
});
test('guests and account switches while waiting cannot write or hydrate',async()=>{
  for(const action of [a=>a.blockUser(second),a=>a.unblockUser(second),a=>a.reportUser(second,{reason:'Autre motif'}),a=>a.loadBlockedUsers()]){
    const s=setup({deferReady:true}),pending=action(s.api);s.setUser(second);s.release();await assert.rejects(pending,/compte a changé/);assert.equal(s.calls.length,0);
    const guest=setup();guest.setUser(null);await assert.rejects(action(guest.api),/compte a changé/);assert.equal(guest.calls.length,0);
  }
});
test('an account change during a response prevents a stale local success',async()=>{
  const s=setup({response:()=>{s.setUser(second);return {data:[],error:null};}});
  await assert.rejects(s.api.blockUser(second),/compte a changé/);
});
test('network and database failures remain failures; duplicate blocks are idempotent',async()=>{
  const s=setup({response:{error:{message:'Failed to fetch'}}});await assert.rejects(s.api.blockUser(second),/Internet/);
  s.setResult({error:{code:'23505'}});await s.api.blockUser(second);await assert.rejects(s.api.reportUser(second,{reason:'Autre motif'}),/déjà/);
  s.setResult({error:{code:'42501'}});await assert.rejects(s.api.unblockUser(second),/accessible/);
});
test('unblocking is constrained to the current account and requested target',async()=>{
  const s=setup();await s.api.unblockUser(second);
  assert.deepEqual(s.calls,[['from','user_blocks'],['delete'],['eq','blocker_id',first],['eq','blocked_id',second]]);
});
test('hydration pages through every block without returning a partial result',async()=>{
  let page=0;const s=setup({response:()=>({data:page++===0?Array.from({length:500},(_,i)=>({blocked_id:'reader-'+i})):[{blocked_id:second}]})});
  const ids=await s.api.loadBlockedUsers();assert.equal(ids.length,501);assert.equal(ids[500],second);
  assert.deepEqual(s.calls.filter(c=>c[0]==='range'),[['range',0,499],['range',500,999]]);
});

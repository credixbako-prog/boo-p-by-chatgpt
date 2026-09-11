import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHandler,cleanPreferences,permits} from '../supabase/functions/push-notifications/core.mjs';
const owner='11111111-1111-4111-8111-111111111111',device='22222222-2222-4222-8222-222222222222';
const job='33333333-3333-4333-8333-333333333333';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
function setup({auth=true,secret=true,route}={}) {
 const calls=[];
 const handler=createHandler({env:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',FIREBASE_SERVICE_ACCOUNT:secret?JSON.stringify({project_id:'boo-p-a4461',client_email:'test',private_key:'test'}):''})[key],getGoogleToken:async()=> 'mock-oauth',fetchImpl:async(url,options={})=>{
   const body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});
   if(url.endsWith('/auth/v1/user'))return json(auth?{id:owner}:{},auth?200:401);
   return route?.(url,options,body) || json([]);
 }});
 const send=(body,{bearer='test-user',origin='https://credixbako-prog.github.io'}={})=>handler(new Request('https://test/push',{method:'POST',headers:{origin,...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)}));
 return {send,calls};
}
test('push: refuse origine tierce et session invalide avant accès aux appareils',async()=>{
 const h=setup({auth:false});assert.equal((await h.send({action:'register'},{origin:'https://evil.test'})).status,403);assert.equal(h.calls.length,0);
 assert.equal((await h.send({action:'register'},{bearer:''})).status,401);assert.equal(h.calls.length,0);
 assert.equal((await h.send({action:'register'})).status,401);assert.equal(h.calls.length,1);
});
test('push: clé manquante donne un état honnête et bloque Firebase',async()=>{
 const h=setup({secret:false});assert.deepEqual(await (await h.send({action:'status'})).json(),{ready:false});assert.equal((await h.send({action:'test',deviceId:device})).status,503);assert.ok(h.calls.every(c=>c.url.endsWith('/auth/v1/user')));
});
test('push: inscription prend le propriétaire depuis Auth et borne les paramètres',async()=>{
 const h=setup();assert.equal((await h.send({action:'register',deviceId:'invalid',token:'short'})).status,400);
 assert.equal((await h.send({action:'register',deviceId:device,userId:job,token:'a'.repeat(150),preferences:{friends:false,extra:true}})).status,200);
 const rpc=h.calls.find(c=>c.url.includes('/rpc/'));assert.equal(rpc.body.p_user,owner);assert.equal(rpc.body.p_preferences.friends,false);assert.equal(rpc.body.p_preferences.extra,undefined);
});
test('push: désactivation et préférences ne peuvent viser un autre compte',async()=>{
 const h=setup();await h.send({action:'disable',deviceId:device,userId:job});await h.send({action:'preferences',userId:job});
 for(const c of h.calls.filter(c=>c.url.includes('/push_devices')))assert.ok(c.url.includes('user_id=eq.'+owner));
});
test('push: test réservé à son appareil avec réservation atomique et quota',async()=>{
 const h=setup();assert.equal((await h.send({action:'test',deviceId:device})).status,429);assert.equal(h.calls.some(c=>c.url.includes('fcm.googleapis')),false);
 const reservation=h.calls.find(c=>c.options.method==='PATCH');assert.ok(reservation.url.includes('user_id=eq.'+owner));assert.ok(reservation.url.includes('last_test_at=lt.'));
});
test('push: livraison ne révèle pas de texte privé et invalide les jetons expirés',async()=>{
 const h=setup({route:(url,opts)=>url.includes('fcm.googleapis')?json({error:{details:[{errorCode:'UNREGISTERED'}]}},404):url.includes('push_devices')?json(opts.method==='DELETE'?[]:[{device_id:device,user_id:owner,token:'device-token'}]):null});
 assert.equal((await h.send({action:'test',deviceId:device})).status,502);
 const delivery=h.calls.find(c=>c.url.includes('fcm.googleapis')).body.message;
 assert.equal(delivery.data.owner,owner);assert.equal(delivery.data.test,'1');assert.equal(delivery.notification,undefined);
 assert.ok(h.calls.some(c=>c.options.method==='DELETE'&&c.url.includes('token=eq.device-token')));
});
test('push: faux webhook et répétition ne déclenchent aucun envoi',async()=>{
 const h=setup();assert.equal((await h.send({action:'dispatch',jobId:job,capability:'guess'},{bearer:''})).status,403);
 assert.equal((await h.send({action:'dispatch',jobId:job,capability:device},{bearer:''})).status,403);
 assert.ok(h.calls[0].url.includes('status=eq.pending'));assert.equal(h.calls.some(c=>c.url.includes('fcm.googleapis')),false);
});
test('push: filtres et destinataire viennent de la notification stockée',async()=>{
 const h=setup({route:(url,opts)=>{
  if(url.includes('push_jobs'))return json(opts.body&&JSON.parse(opts.body).status==='sending'?[{id:job,notification_id:9}]:[]);
  if(url.includes('/notifications?'))return json([{id:9,recipient_id:owner,type:'friend',route:'#community'}]);
  if(url.includes('push_devices'))return json([{device_id:device,user_id:owner,preferences:{friends:false},token:'private-token'}]);
 }});
 assert.equal((await h.send({action:'dispatch',jobId:job,capability:device,userId:job},{bearer:''})).status,200);
 assert.equal(h.calls.some(c=>c.url.includes('fcm.googleapis')),false);assert.equal(permits(cleanPreferences({friends:false}),'friend'),false);
});
const worker=readFileSync(new URL('../js/push-worker.js',import.meta.url),'utf8');
function workerHarness(state={enabled:true,owner}) {
 const handlers={},shown=[],opened=[];
 const self={BoopPushState:{access:async()=>state},registration:{scope:'https://example.com/boo-p/',showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async(url)=>opened.push(url)},addEventListener:(event,fn)=>handlers[event]=fn};
 vm.runInNewContext(worker,{self,importScripts(){},URL});
 return {shown,opened,async push(payload){let pending;handlers.push({data:{json:()=>({data:payload})},waitUntil:p=>pending=p});await pending;},async click(route){let pending;handlers.notificationclick({notification:{close(){},data:{owner,route}},waitUntil:p=>pending=p});await pending;}};
}
test('push worker: refuse autre compte et appareil désactivé',async()=>{
 const h=workerHarness();await h.push({boop:'1',owner:job});assert.equal(h.shown.length,0);
 const disabled=workerHarness({enabled:false,owner});await disabled.push({boop:'1',owner});assert.equal(disabled.shown.length,0);
 await h.push({boop:'1',owner,id:'42',body:'Texte privé',route:'#home'});assert.equal(h.shown.length,1);assert.ok(!JSON.stringify(h.shown).includes('Texte privé'));assert.equal(h.shown[0][1].icon,'https://example.com/boo-p/assets/icons/boo-p-icon-192.png');
});
test('push worker: clic reste dans la portée de BOO-P même avec URL malveillante',async()=>{
 const h=workerHarness();await h.click('https://evil.test');assert.equal(h.opened[0],'https://example.com/boo-p/app.html#home');await h.click('#profile?section=settings');assert.equal(h.opened[1],'https://example.com/boo-p/app.html#profile?section=settings');
});

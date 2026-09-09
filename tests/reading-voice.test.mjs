import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,sessionConfig} from '../supabase/functions/reading-voice/core.mjs';
import {createMeter} from '../js/voice-metrics.mjs';
const uid='12345678-1234-1234-1234-123456789abc', rid='aaaaaaaa-1234-1234-1234-123456789abc';
const request=(body,headers={})=>new Request('https://boop.test/reading-voice',{method:'POST',headers:{origin:'https://credixbako-prog.github.io',Authorization:'Bearer user-token',...headers},body:JSON.stringify(body)});
function setup(overrides={}, options={}) {
 const calls=[];
 const vars={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'server-secret',BOOP_VOICE_TESTER_IDS:uid,OPENAI_API_KEY:'openai-secret',...overrides};
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:options.user || uid,is_anonymous:options.anonymous || false});
  if(url.includes('/rpc/')) return options.quota?Response.json({code:'P0001'},{status:400}):Response.json(rid);
  if(url==='https://api.openai.com/v1/realtime/calls')return options.upstreamError?new Response('secret debug',{status:429}):new Response('v=0\r\nanswer',{headers:{location:'/v1/realtime/calls/rtc_test'}});
  if(url.includes('select=id'))return Response.json([]);
  return new Response(null,{status:204});
 };
 return {handler:createHandler({env:n=>vars[n],fetchImpl}),calls};
}
test('voix : aucun appel OpenAI sans compte autorisé, consentement et clé serveur',async()=>{
 for(const [vars,opts,body,status] of [[{}, {user:'outsider'},{action:'start'},403],[{}, {anonymous:true},{action:'status'},403],[{OPENAI_API_KEY:''},{},{action:'start'},503],[{},{},{action:'start',sdp:'v=0'},400]]){
  const {handler,calls}=setup(vars,opts);assert.equal((await handler(request(body))).status,status);assert.ok(!calls.some(c=>c.url.includes('api.openai.com')));
 }
});
test('voix : origine et session manquante sont refusées avant tout accès distant',async()=>{
 const {handler,calls}=setup();assert.equal((await handler(request({}, {origin:'https://attacker.test'}))).status,403);
 assert.equal((await handler(request({}, {Authorization:''}))).status,401);assert.equal(calls.length,0);
});
test('voix : démarrage autorisé réserve le quota et transmet uniquement la configuration serveur',async()=>{
 const {handler,calls}=setup();const response=await handler(request({action:'start',adultConsent:true,sdp:'v=0\r\noffer',model:'expensive-model',book:{title:'Hadrien',authors:'Yourcenar'},apiKey:'client-key'}));
 assert.equal(response.status,200);const data=await response.json();assert.equal(data.id,rid);assert.equal(data.model,'gpt-realtime-2.1');
 assert.ok(!JSON.stringify(data).includes('secret'));
 const upstream=calls.find(c=>c.url==='https://api.openai.com/v1/realtime/calls');
 assert.equal(upstream.init.headers.Authorization,'Bearer openai-secret');assert.equal(JSON.parse(upstream.init.body.get('session')).model,'gpt-realtime-2.1');
 assert.ok(calls.findIndex(c=>c.url.includes('/rpc/'))<calls.indexOf(upstream));
});
test('voix : quota serveur bloque OpenAI et la fermeture ne permet pas de viser autrui',async()=>{
 const {handler,calls}=setup({}, {quota:true});assert.equal((await handler(request({action:'start',adultConsent:true,sdp:'v=0'}))).status,429);assert.ok(!calls.some(c=>c.url.includes('api.openai.com')));
 assert.equal((await handler(request({action:'stop',id:rid}))).status,404);assert.ok(calls.some(c=>c.url.includes(`user_id=eq.${uid}`)));assert.ok(!calls.some(c=>c.url.includes('/hangup')));
});
test('voix : une erreur fournisseur reste lisible et ne révèle pas son contenu',async()=>{
 const {handler}=setup({}, {upstreamError:true});const result=await handler(request({action:'start',adultConsent:true,sdp:'v=0'}));assert.equal(result.status,502);const text=await result.text();assert.ok(text.includes('crédits'));assert.ok(!text.includes('secret debug'));
});
test('voix : contexte borné et absence de récupération automatique des notes privées',()=>{
 const config=sessionConfig({title:'a'.repeat(2000),notes:'secret-note'});assert.ok(config.instructions.length<2200);assert.ok(!JSON.stringify(config).includes('secret-note'));assert.equal(config.max_output_tokens,768);
});
test('voix : compteurs dédupliqués, cache non compté deux fois et transcription distincte',()=>{
 const meter=createMeter();const event={type:'response.done',response:{id:'r1',status:'completed',usage:{input_token_details:{audio_tokens:100,text_tokens:200,cached_tokens_details:{audio_tokens:50,text_tokens:100}},output_token_details:{audio_tokens:80,text_tokens:20}}}};
 meter.add(event);meter.add(event);meter.add({type:'conversation.item.input_audio_transcription.completed',item_id:'t1',usage:{type:'duration',seconds:4}});
 const result=meter.snapshot();assert.equal(result.responses.length,1);assert.equal(result.transcriptions.length,1);assert.equal(result.inputAudio,100);assert.ok(Math.abs(result.estimatedResponseUSD-.00766)<1e-10);
});
test('voix : usage absent reste inconnu au lieu de devenir un coût nul',()=>{
 const meter=createMeter();meter.add({type:'response.done',response:{id:'r1'}});assert.equal(meter.snapshot().estimatedResponseUSD,null);assert.equal(meter.snapshot().inputAudio,null);
});

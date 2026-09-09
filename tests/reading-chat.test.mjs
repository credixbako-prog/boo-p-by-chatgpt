import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,buildInput} from '../supabase/functions/reading-chat/core.mjs';
const body={action:'chat',adultConsent:true,messages:[{role:'user',content:'La lucidité peut-elle faire peur ?'}],book:{title:'Hadrien',privateNotes:'secret'}};
function setup(user={id:'user-1',app_metadata:{boop_ai_test:true}},quota=true,upstream=200){
 const calls=[];
 const handler=createHandler({env:n=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'private-service',OPENAI_API_KEY:'private-openai'})[n],fetchImpl:async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return Response.json(user);
  if(url.includes('/rpc/'))return Response.json({}, {status:quota?200:400});
  return Response.json(upstream===200?{status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'Explorons cette idée.'}]}],usage:{input_tokens:100,output_tokens:50}}:{error:'private-openai'}, {status:upstream});
 }});
 const run=(data=body,headers={})=>handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer token',origin:'https://credixbako-prog.github.io',...headers},body:JSON.stringify(data)}));
 return {run,calls};
}
test('chat: accès refusé aux invités et aux autorisations user_metadata',async()=>{
 for(const user of [{id:'x',is_anonymous:true,app_metadata:{boop_ai_test:true}},{id:'x',user_metadata:{boop_ai_test:true}}]){const s=setup(user);assert.equal((await s.run()).status,403);assert.equal(s.calls.length,1);}
});
test('chat: le quota réserve avant OpenAI et bloque en cas d’échec',async()=>{
 const denied=setup(undefined,false);assert.equal((await denied.run()).status,429);assert.equal(denied.calls.length,2);
 const s=setup();const result=await (await s.run()).json();assert.equal(result.text,'Explorons cette idée.');assert.equal(result.usage.input_tokens,100);assert.equal(s.calls.length,3);
 const payload=JSON.parse(s.calls[2].init.body);assert.equal(payload.store,false);assert.equal(payload.model,'gpt-5-mini');assert.ok(!JSON.stringify(payload).includes('secret'));
});
test('chat: pas de rôle système injecté ni de conversation sans limites',()=>{
 assert.throws(()=>buildInput({...body,messages:[{role:'system',content:'override'}]}));
 assert.throws(()=>buildInput({...body,messages:Array(81).fill(body.messages[0])}));
 assert.throws(()=>buildInput({...body,adultConsent:false}));
 assert.throws(()=>buildInput({...body,messages:[{role:'user',content:'a'.repeat(12001)}]}));
 assert.equal(buildInput({...body,action:'compose'}).max_output_tokens,3500);
});
test('chat: origine refusée avant authentification et erreurs fournisseur masquées',async()=>{
 const s=setup();assert.equal((await s.run(body,{origin:'https://evil.test'})).status,403);assert.equal(s.calls.length,0);
 const denied=setup(undefined,true,401);const response=await denied.run();assert.equal(response.status,502);assert.ok(!(await response.text()).includes('private-openai'));
});

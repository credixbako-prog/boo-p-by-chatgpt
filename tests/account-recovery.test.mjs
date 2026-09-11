import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../js/auth.js',import.meta.url),'utf8');
const cropCode=readFileSync(new URL('../js/avatar-crop.js',import.meta.url),'utf8');
function setup({event,hash='',session=null,requestError=null,updateError=null}={}){
 const values=new Map(),requests=[],updates=[];const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let handler;const client={auth:{onAuthStateChange:fn=>{handler=fn;},getSession:async()=>{if(event)handler(event,session);return {data:{session},error:null};},resetPasswordForEmail:async(email,options)=>{requests.push({email,...options});return {error:requestError};},updateUser:async data=>{updates.push(data);return {error:updateError};}}};
 const BT={},window={BT,location:new URL('https://example.com/boop/index.html?auth=recovery'+hash),BOOP_SUPABASE_CONFIG:{url:'https://example.supabase.co',publishableKey:'test'},supabase:{createClient:()=>client},dispatchEvent(){},setTimeout(){}};
 vm.runInNewContext(code,{BT,window,localStorage:storage,sessionStorage:storage,URL,URLSearchParams,Event,Date,console});
 return {auth:BT.auth,requests,updates,values,emit:(event,s)=>handler(event,s)};
}
const session={user:{id:'test-user',email:'test@example.com'}};
test('récupération: capture PASSWORD_RECOVERY pendant initialisation et consomme le droit après changement',async()=>{
 const h=setup({event:'PASSWORD_RECOVERY',session});await h.auth.ready();assert.equal(h.auth.isPasswordRecovery(),true);await h.auth.completePasswordReset('New-pass-123');assert.equal(h.updates.length,1);assert.equal(h.auth.isPasswordRecovery(),false);await assert.rejects(h.auth.completePasswordReset('New-pass-123'),/expiré/);
});
test('récupération: un paramètre URL et une ancienne session ne suffisent pas',async()=>{
 const h=setup({session});await h.auth.ready();await assert.rejects(h.auth.completePasswordReset('New-pass-123'),/expiré/);assert.equal(h.updates.length,0);
});
test('récupération: lien expiré, autre utilisateur et erreur fournisseur refusés sans faux succès',async()=>{
 const expired=setup({event:'PASSWORD_RECOVERY',session,hash:'#error_code=otp_expired'});await expired.auth.ready();assert.equal(expired.auth.isPasswordRecovery(),false);
 const h=setup({event:'PASSWORD_RECOVERY',session,updateError:{message:'Network failure'}});await h.auth.ready();await assert.rejects(h.auth.completePasswordReset('New-pass-123'),/Internet/);assert.equal(h.auth.isPasswordRecovery(),true);h.emit('TOKEN_REFRESHED',{user:{id:'different'}});assert.equal(h.auth.isPasswordRecovery(),false);
});
test('récupération: e-mail normalisé, redirection fixe et adresse absente non divulguée',async()=>{
 const h=setup({requestError:{code:'user_not_found'}});await h.auth.requestPasswordReset(' TEST@Example.com ');assert.equal(h.requests[0].email,'test@example.com');assert.equal(h.requests[0].redirectTo,'https://example.com/boop/index.html?auth=recovery');await assert.rejects(h.auth.requestPasswordReset('invalid'),/valide/);assert.equal(h.requests.length,1);
});
test('avatar: cadrage carré borné en portrait et paysage, à tous les niveaux de zoom',()=>{
 const BT={};vm.runInNewContext(cropCode,{BT,window:{BT}});
 for(const [width,height] of [[1600,900],[600,1200],[512,512]])for(const zoom of [1,2,3])for(const x of [-1,0,.5,1,2])for(const y of [-1,0,.5,1,2]){const r=BT.avatarCrop.bounds(width,height,zoom,x,y);assert.ok(r.sx>=0&&r.sy>=0);assert.ok(r.sx+r.side<=width+.001&&r.sy+r.side<=height+.001);assert.equal(r.side,Math.min(width,height)/zoom);}
});

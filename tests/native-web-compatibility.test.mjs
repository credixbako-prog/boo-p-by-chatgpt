import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = file => readFileSync(new URL('../js/' + file, import.meta.url), 'utf8');
const publicAppUrl = 'https://credixbako-prog.github.io/boo-p-by-chatgpt/';
const native = {isNative:true, publicAppUrl};
const storage = () => {
  const data = new Map();
  return {getItem:key=>data.get(key) || null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
};

function authHarness(href, nativeConfig) {
  const requests = [];
  const client = {auth:{
    onAuthStateChange(){},
    getSession:async()=>({data:{session:null}}),
    signUp:async body=>{requests.push({action:'signup',...body});return {data:{user:{id:'new-reader'},session:null}};},
    resetPasswordForEmail:async(email,options)=>{requests.push({action:'reset',email,...options});return {};}
  }};
  const BT = {native:nativeConfig};
  const window = {BT,location:new URL(href),BOOP_SUPABASE_CONFIG:{url:'https://example.supabase.co',publishableKey:'test'},supabase:{createClient:()=>client}};
  vm.runInNewContext(source('auth.js'),{BT,window,URL,URLSearchParams,localStorage:storage(),sessionStorage:storage(),console});
  return {auth:BT.auth,requests};
}

for (const href of ['capacitor://localhost/index.html','https://localhost/index.html']) {
  test(`native auth: confirmation et récupération ouvrent le site public depuis ${href}`, async()=>{
    const h = authHarness(href,native);
    const account = await h.auth.createAccount({name:'Lectrice',email:' READER@example.com ',password:'Example-123'});
    await h.auth.requestPasswordReset(' READER@example.com ');
    assert.equal(account.requiresEmailConfirmation,true);
    assert.equal(h.requests[0].options.emailRedirectTo,publicAppUrl+'onboarding.html');
    assert.equal(h.requests[1].redirectTo,publicAppUrl+'index.html?auth=recovery');
    assert.equal(h.requests[1].email,'reader@example.com');
    assert.equal(h.auth.isAuthenticated(),false);
    await assert.rejects(h.auth.completePasswordReset('Updated-123'),/expiré/);
  });
}

test('web auth: les retours restent sur le site courant sans configuration native',async()=>{
  const h = authHarness('https://web.example/boop/index.html');
  await h.auth.createAccount({name:'Lectrice',email:'reader@example.com',password:'Example-123'});
  await h.auth.requestPasswordReset('reader@example.com');
  assert.equal(h.requests[0].options.emailRedirectTo,'https://web.example/boop/onboarding.html');
  assert.equal(h.requests[1].redirectTo,'https://web.example/boop/index.html?auth=recovery');
});

test('native auth: une URL de retour non HTTPS ne déclenche pas de demande e-mail',async()=>{
  const h = authHarness('capacitor://localhost/index.html',{isNative:true,publicAppUrl:'http://localhost/'});
  await assert.rejects(h.auth.requestPasswordReset('reader@example.com'),/adresse de retour/);
  await assert.rejects(h.auth.createAccount({name:'Lectrice',email:'reader@example.com',password:'Example-123'}),/adresse de retour/);
  assert.equal(h.requests.length,0);
});

function pwaHarness(href,nativeConfig) {
  const listeners = {},registrations = [];
  const window = {BT:{native:nativeConfig},addEventListener:(event,callback)=>{listeners[event]=callback;},dispatchEvent(){}};
  const navigator = {serviceWorker:{register:async(...args)=>{registrations.push(args);return {};}}};
  vm.runInNewContext(source('pwa.js'),{window,navigator,location:new URL(href),CustomEvent:class {},console});
  return {listeners,registrations};
}

test('native PWA: Android et iOS ne démarrent aucun service worker',()=>{
  for(const href of ['https://localhost/app.html','capacitor://localhost/app.html']) {
    const h = pwaHarness(href,native);
    assert.equal(h.listeners.load,undefined);
    assert.equal(h.registrations.length,0);
  }
});

test('web PWA: conserve le service worker et sa portée relative',async()=>{
  const h = pwaHarness('https://web.example/boop/app.html');
  h.listeners.load();
  await Promise.resolve();
  assert.equal(h.registrations.length,1);
  assert.equal(h.registrations[0][0],'./service-worker.js');
  assert.equal(h.registrations[0][1].scope,'./');
});

function publicationHarness(href,nativeConfig) {
  const shared = [],BT = {native:nativeConfig};
  vm.runInNewContext(source('publication-actions.js'),{
    BT,window:{BT,addEventListener(){}},document:{addEventListener(){}},location:new URL(href),URL,
    navigator:{share:async data=>{shared.push(data);}}
  });
  return {publications:BT.publications,shared};
}

test('native partage: une publication publique utilise son adresse web, les autres restent sans lien',()=>{
  const h = publicationHarness('capacitor://localhost/app.html',native);
  h.publications.share({table:'community_posts',remote:true,visibility:'public',id:'post&extra',text:'Ma lecture'});
  assert.equal(h.shared[0].url,publicAppUrl+'app.html#community?publication=post%26extra');
  for(const visibility of ['friends','private','me'])h.publications.share({table:'community_posts',remote:true,visibility,id:'private',text:'Mon texte choisi'});
  h.publications.share({table:'community_posts',remote:false,visibility:'public',id:'local',text:'Un essai'});
  assert.ok(h.shared.slice(1).every(item=>item.url===undefined));
});

test('web partage: conserve l’origine et le sous-répertoire courants',()=>{
  const h = publicationHarness('https://web.example/boop/app.html',{isNative:false,publicAppUrl});
  h.publications.share({table:'community_posts',remote:true,visibility:'public',id:'one',text:'Ma lecture'});
  assert.equal(h.shared[0].url,'https://web.example/boop/app.html#community?publication=one');
});

function pushHarness(nativeConfig,{supported=true}={}) {
  const calls = {state:0,permission:0,network:0},controls = {};
  for(const name of ['enable','disable','test'])controls[name]={};
  controls.status={};
  const panel = {isConnected:true,querySelector:selector=>selector==='[data-push-status]'?controls.status:controls[selector.match(/"(\w+)"/)[1]]};
  const BT = {native:nativeConfig,auth:{getCurrentUser:()=>({id:'reader'}),getClient:()=>{calls.network++;throw new Error('No network expected');}}};
  const Notification = {permission:'granted',requestPermission:async()=>{calls.permission++;return 'granted';}};
  const navigator = supported?{serviceWorker:{}}:{};
  const window = {BT,isSecureContext:supported,BoopPushState:{access:async()=>{calls.state++;return {enabled:true,owner:'reader'};}},addEventListener(){},...(supported?{Notification,PushManager:class {}}:{})};
  vm.runInNewContext(source('push-notifications.js'),{BT,window,navigator,Notification,document:{addEventListener(){},querySelector:()=>panel},console});
  return {push:BT.push,calls,controls};
}

test('native push: ne sollicite ni permission navigateur ni service web et annonce son indisponibilité',async()=>{
  const h = pushHarness(native);
  const info = await h.push.describe();
  assert.equal(info.enabled,false);
  assert.match(info.reason,/prochaine version/);
  assert.doesNotMatch(info.reason,/écran d’accueil|navigateur/);
  await assert.rejects(h.push.enable({}),/prochaine version/);
  await assert.rejects(h.push.test(),/prochaine version/);
  await h.push.reconcile();
  await h.push.disable();
  await h.push.renderControls();
  assert.equal(h.controls.enable.disabled,true);
  assert.equal(h.controls.disable.hidden,true);
  assert.equal(h.controls.test.hidden,true);
  assert.match(h.controls.status.textContent,/consultables dans BOO-P/);
  assert.deepEqual(h.calls,{state:0,permission:0,network:0});
});

test('web push: état actif et consignes iPhone préservés selon les capacités',async()=>{
  const h = pushHarness(undefined);
  const info = await h.push.describe();
  assert.equal(info.enabled,true);
  assert.equal(info.reason,'');
  const unsupported = await pushHarness(undefined,{supported:false}).push.describe();
  assert.equal(unsupported.enabled,false);
  assert.match(unsupported.reason,/écran d’accueil/);
});

function invitationHarness(nativeConfig) {
  const calls = {state:0,user:0,timers:0};
  const BT = {native:nativeConfig,auth:{getCurrentUser:()=>({id:'reader'}),getClient:()=>({auth:{getUser:async()=>{calls.user++;return {data:{user:{id:'reader',user_metadata:{boop_push_invitation_seen_v1:true}}}};}}})}};
  const window = {BT,addEventListener(){},BoopPushState:{access:async()=>{calls.state++;return {};}}};
  const document = {body:{dataset:{authMode:'account'}},visibilityState:'visible',querySelector:()=>null,addEventListener(){}};
  vm.runInNewContext(source('push-invitation.js'),{BT,window,document,location:{hash:'#home'},setTimeout:()=>{calls.timers++;},clearTimeout(){}});
  return {invitation:BT.pushInvitation,calls};
}

test('native invitation: ne marque pas le compte et ne propose pas une activation non disponible',async()=>{
  const h = invitationHarness(native);
  h.invitation.schedule();
  await h.invitation.check();
  assert.deepEqual(h.calls,{state:0,user:0,timers:0});
});

test('web invitation: la planification et le choix déjà enregistré restent consultés',async()=>{
  const h = invitationHarness();
  h.invitation.schedule();
  await h.invitation.check();
  assert.deepEqual(h.calls,{state:1,user:1,timers:1});
});

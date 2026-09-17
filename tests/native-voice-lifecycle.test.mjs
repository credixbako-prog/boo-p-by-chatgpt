import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const voiceFile = new URL('../js/reading-voice.js',import.meta.url);
const source = readFileSync(voiceFile,'utf8');
const deferred = () => {let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

function harness({waitMicrophone=false,waitRemoteDescription=false,waitStart=false}={}) {
  const listeners={},nodes=new Map(),requests=[],intervals=new Set();
  const mic=deferred(),remote=deferred(),start=deferred(),microphoneRequested=deferred(),remoteRequested=deferred(),startRequested=deferred();
  let dialog;
  const node=()=>({disabled:false,hidden:false,checked:false,textContent:'',dataset:{},append(){},replaceChildren(){},addEventListener(){},setAttribute(){}});
  const element=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  const document={body:{append(value){dialog=value;},classList:{add(){},remove(){}}},createElement(tag){
    const value=node();
    if(tag==='dialog')Object.assign(value,{open:false,querySelector:element,showModal(){this.open=true;},close(){this.open=false;},remove(){}});
    return value;
  }};
  const track={enabled:true,stops:0,stop(){this.stops++;}};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const channel={closes:0,close(){this.closes++;}};
  const peer={closes:0,addTrack(){},createDataChannel:()=>channel,createOffer:async()=>({sdp:'offer'}),setLocalDescription:async()=>{},setRemoteDescription:async()=>{remoteRequested.resolve();if(waitRemoteDescription)await remote.promise;},close(){this.closes++;}};
  const audio={pauses:0,pause(){this.pauses++;}};
  const BT={auth:{getCurrentUser:()=>({id:'reader'}),isGuest:()=>false,isAuthenticated:()=>true,getClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}})},store:{getBookById:()=>({id:'book',title:'Un livre',authors:['Autrice'],status:'en-cours',currentPage:5}),subscribe(){}}};
  const window={BT,BOOP_SUPABASE_CONFIG:{url:'https://example.test',publishableKey:'test'},addEventListener:(name,callback)=>{listeners[name]=callback;}};
  const fetch=async(url,options)=>{
    const body=JSON.parse(options.body);requests.push({body,options});
    if(body.action==='status')return Response.json({ready:true});
    if(body.action==='start'){startRequested.resolve();if(waitStart)await start.promise;return Response.json({id:'voice-call',sdp:'answer',maxSeconds:1800});}
    return Response.json({ok:true});
  };
  vm.runInNewContext(source,{
    BT,window,document,fetch,URL,URLSearchParams,AbortController,
    navigator:{mediaDevices:{getUserMedia:async()=>{microphoneRequested.resolve();if(waitMicrophone)await mic.promise;return stream;}}},
    RTCPeerConnection:function(){return peer;},Audio:function(){return audio;},
    setInterval:callback=>{intervals.add(callback);return callback;},clearInterval:id=>intervals.delete(id)
  },{filename:fileURLToPath(voiceFile),importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
  return {
    BT,requests,nodes,track,peer,channel,audio,intervals,mic,remote,start,microphoneRequested,remoteRequested,startRequested,
    pause:()=>listeners['boop:native-paused'](),
    async begin(){await BT.voice.open('book');element('[data-voice-consent]').checked=true;return element('[data-voice-start]').onclick();},
    get dialog(){return dialog;}
  };
}

test('native voix: passer en arrière-plan sans conversation ne fait rien',()=>{
  const h=harness();
  h.pause();
  assert.equal(h.requests.length,0);
  assert.equal(h.track.stops,0);
});

test('native voix: suspendre coupe immédiatement le micro et ferme la session côté serveur une fois',async()=>{
  const h=harness();
  await h.begin();
  assert.equal(h.intervals.size,1);
  h.pause();
  assert.equal(h.track.stops,1);
  assert.equal(h.peer.closes,1);
  assert.equal(h.channel.closes,1);
  assert.equal(h.audio.pauses,1);
  assert.equal(h.intervals.size,0);
  assert.equal(h.requests.find(r=>r.body.action==='start').options.signal.aborted,true);
  h.pause();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.requests.filter(r=>r.body.action==='stop').length,1);
  assert.equal(h.requests.at(-1).body.id,'voice-call');
  assert.equal(h.requests.at(-1).options.signal,undefined);
  assert.equal(h.dialog.open,true);
  assert.match(h.nodes.get('[data-voice-status]').textContent,/arrière-plan/);
});

test('native voix: une permission micro tardive après suspension ne démarre pas de conversation',async()=>{
  const h=harness({waitMicrophone:true});
  const pending=h.begin();
  await h.microphoneRequested.promise;
  h.pause();
  h.mic.resolve();
  await pending;
  assert.equal(h.track.stops,1);
  assert.ok(h.requests.every(r=>r.body.action==='status'));
  assert.equal(h.intervals.size,0);
});

test('native voix: une session renvoyée après suspension est aussitôt fermée',async()=>{
  const h=harness({waitStart:true});
  const pending=h.begin();
  await h.startRequested.promise;
  h.pause();
  h.start.resolve();
  await pending;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.requests.filter(r=>r.body.action==='stop').length,1);
  assert.equal(h.requests.at(-1).body.id,'voice-call');
  assert.equal(h.intervals.size,0);
});

test('native voix: la fin tardive de la négociation WebRTC ne réactive pas le minuteur',async()=>{
  const h=harness({waitRemoteDescription:true});
  const pending=h.begin();
  await h.remoteRequested.promise;
  h.pause();
  h.remote.resolve();
  await pending;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.intervals.size,0);
  assert.equal(h.requests.filter(r=>r.body.action==='stop').length,1);
  assert.equal(h.track.stops,1);
});

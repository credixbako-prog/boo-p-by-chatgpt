window.BT = window.BT || {};
BT.voice = (() => {
  let dialog, pc, dc, stream, audio, callId, timer, controller, meter, book, running=false, stopping=false;
  let transcript=[], transcriptIds=new Set(), startTime=null, endTime=null, generation=0, owner;
  const $=selector=>dialog.querySelector(selector);
  function decorate(view) {
    const row=view.querySelector('.book-detail-copy > .button-row:last-child');
    if(!row || row.querySelector('[data-voice-open]')) return;
    const button=document.createElement('button'); button.type='button'; button.className='button button--secondary';
    button.dataset.voiceOpen=''; button.textContent='Parler de ce livre · test IA';
    button.addEventListener('click',()=>open()); row.append(button);
  }
  async function api(body,signal) {
    const client=BT.auth.getClient();
    const {data,error}=await client.auth.getSession();
    if(error || !data.session?.access_token) throw new Error('Reconnectez-vous à BOO-P pour ouvrir le test.');
    const config=window.BOOP_SUPABASE_CONFIG;
    const response=await fetch(`${config.url}/functions/v1/reading-voice`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body),signal});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error || 'Le service vocal n’est pas encore disponible.');
    return result;
  }
  function status(text) { if(dialog) $('[data-voice-status]').textContent=text; }
  function download(name,content,type) {
    const url=URL.createObjectURL(new Blob([content],{type})); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function open(bookId) {
    if(dialog?.open) return;
    const id=bookId || new URLSearchParams(location.hash.split('?')[1]).get('id'); book=BT.store.getBookById(id);if(!book)return;
    owner=BT.auth.getCurrentUser?.()?.id;
    dialog?.remove(); dialog=document.createElement('dialog');dialog.className='app-dialog voice-dialog';dialog.setAttribute('aria-labelledby','voice-title');
    dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">Un moment pour réfléchir</p><h2 id="voice-title" data-voice-book></h2></div><button class="icon-button" type="button" data-voice-close aria-label="Fermer">×</button></div><div class="dialog-body"><div class="reflection-toolbar"><div class="reflection-mode"><button type="button" data-voice-text>Texte</button><span aria-current="true">Voix</span></div><details class="reflection-about"><summary>À propos</summary><div><p>Conversation avec une voix IA OpenAI. Le contexte du livre et votre audio sont transmis à OpenAI. L’IA peut se tromper. BOO-P ne conserve pas l’audio. La transcription reste temporaire jusqu’à votre choix de la conserver.</p><p>La voix Realtime est plus coûteuse que le texte. Ce test s’arrête après 30 minutes dans l’interface ; ce n’est pas un plafond financier garanti.</p><details><summary>Mesures et export</summary><pre data-voice-metrics>Aucune réponse reçue.</pre><p>Estimation hors transcription et taxes. La facturation OpenAI fait référence.</p><button type="button" class="text-link" data-voice-export disabled>Télécharger la transcription</button><button type="button" class="text-link" data-voice-usage disabled>Télécharger les mesures</button></details></div></details></div><div class="voice-focus"><div class="voice-orb" aria-hidden="true"></div><p role="status" data-voice-status>Connexion…</p><p data-voice-clock class="voice-clock"></p><label class="checkbox-row voice-consent"><input type="checkbox" data-voice-consent> Je suis majeur et j’accepte le test vocal avec OpenAI.</label><p class="voice-cost">Voix Realtime · facturation audio</p><div class="button-row voice-controls"><button type="button" class="button button--primary" data-voice-start disabled>Commencer à parler</button><button type="button" class="button button--secondary" data-voice-mute disabled>Couper le micro</button><button type="button" class="button button--secondary" data-voice-stop disabled>Terminer</button></div></div><details class="voice-transcript-panel"><summary>Le fil de notre échange</summary><ol class="voice-transcript" data-voice-transcript></ol></details></div>`;
    document.body.append(dialog); $('[data-voice-book]').textContent=book.title+' — '+book.authors.join(', ');
    const keep=document.createElement('button');keep.type='button';keep.className='button button--sage';keep.textContent='Conserver cet échange pour mon carnet';keep.dataset.voiceKeep='';keep.disabled=true;
    keep.onclick=async()=>{const id=book.id,copy=transcript.map(t=>({...t})),user=owner;await close();if(BT.auth.getCurrentUser?.()?.id===user)BT.reflection?.importVoice(id,copy);};
    $('.dialog-body').append(keep);
    keep.hidden=true;
    BT.reflection?.ambiance(dialog);
    $('[data-voice-text]').onclick=async()=>{const id=book.id;await close();BT.reflection?.open(id);};
    $('[data-voice-close]').onclick=()=>close();
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    $('[data-voice-start]').onclick=start; $('[data-voice-stop]').onclick=()=>stop();
    $('[data-voice-mute]').onclick=()=>{const track=stream?.getAudioTracks()[0];if(track){track.enabled=!track.enabled;$('[data-voice-mute]').textContent=track.enabled?'Couper le micro':'Réactiver le micro';status(track.enabled?'Micro actif. Vous pouvez parler.':'Micro coupé.');}};
    $('[data-voice-export]').onclick=()=>download('boop-conversation.txt',book.title+'\n\n'+transcript.map(t=>`${t.role==='user'?'Vous':'IA'} : ${t.text}`).join('\n\n'),'text/plain;charset=utf-8');
    $('[data-voice-usage]').onclick=()=>download('boop-mesures-vocales.json',JSON.stringify({startedAt:startTime,elapsedSeconds:startTime?Math.round(((endTime || Date.now())-startTime)/1000):0,...meter.snapshot()},null,2),'application/json');
    transcript=[];transcriptIds=new Set();startTime=null;endTime=null;meter=null;callId=null;
    dialog.showModal();document.body.classList.add('reflection-open'); const current=++generation;
    try {
      if(BT.auth.isGuest() || !BT.auth.isAuthenticated()) throw new Error('Connectez-vous à un compte adulte autorisé pour ce test.');
      const access=await api({action:'status'});
      if(current!==generation || !dialog.open)return;
      if(!access.ready) throw new Error('Le test est préparé. La clé OpenAI doit encore être activée côté serveur.');
      status('Prenez le temps. Puis commencez à parler.');
      $('[data-voice-consent]').onchange=()=>{$('[data-voice-start]').disabled=!$('[data-voice-consent]').checked;};
    } catch(error) {if(current===generation)status(error.message);}
  }
  async function start() {
    if(running || stopping || !$('[data-voice-consent]').checked)return;
    const current=++generation;running=true;controller=new AbortController();
    $('[data-voice-start]').disabled=true; $('[data-voice-consent]').disabled=true;$('[data-voice-stop]').disabled=false;
    $('.voice-consent').hidden=true;$('[data-voice-start]').hidden=true;status('Connexion au microphone…');
    try {
      const metrics=await import('./voice-metrics.mjs');
      if(current!==generation)return;
      meter=metrics.createMeter(); transcript=[];transcriptIds=new Set();$('[data-voice-transcript]').replaceChildren();
      const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(current!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
      stream=acquired;pc=new RTCPeerConnection();audio=new Audio();audio.autoplay=true;
      pc.ontrack=event=>{audio.srcObject=event.streams[0];audio.play().catch(()=>status('La lecture audio est bloquée par le navigateur. Terminez puis réessayez.'));};
      stream.getTracks().forEach(track=>pc.addTrack(track,stream));
      dc=pc.createDataChannel('oai-events');
      dc.onmessage=event=>{try{receive(JSON.parse(event.data));}catch{status('Un événement vocal n’a pas pu être lu.');}};
      dc.onopen=()=>{if(current!==generation)return;status('Micro actif. Vous pouvez parler.');$('[data-voice-mute]').disabled=false;};
      pc.onconnectionstatechange=()=>{if(current===generation && ['failed','disconnected'].includes(pc?.connectionState))void stop('Connexion interrompue. Les mesures peuvent être incomplètes.');};
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);
      const result=await api({action:'start',adultConsent:true,sdp:offer.sdp,book:{title:book.title,authors:book.authors.join(', '),finished:book.status==='lu',position:book.mediaType==='audio'?`${book.currentMinute} minutes`:`page ${book.currentPage}`}},controller.signal);
      if(current!==generation){void api({action:'stop',id:result.id}).catch(()=>{});return;}
      callId=result.id;await pc.setRemoteDescription({type:'answer',sdp:result.sdp});startTime=Date.now();
      timer=setInterval(()=>{const seconds=Math.floor((Date.now()-startTime)/1000);$('[data-voice-clock]').textContent=`${Math.floor(seconds/60)} min ${seconds%60} s`;if(seconds>=result.maxSeconds)void stop('Les 30 minutes de test sont terminées.');},1000);
    } catch(error) {if(current===generation)await stop(error.name==='NotAllowedError'?'Le microphone n’a pas été autorisé.':error.message || 'Connexion impossible.');}
  }
  function receive(event) {
    meter?.add(event);
    const user=event.type==='conversation.item.input_audio_transcription.completed';
    if(user || event.type==='response.output_audio_transcript.done') {
      const key=(user?'u':'a')+event.item_id+':'+(event.content_index || 0);
      if(event.transcript && !transcriptIds.has(key)){transcriptIds.add(key);const item={role:user?'user':'assistant',text:event.transcript};transcript.push(item);const li=document.createElement('li');li.textContent=(user?'Vous : ':'IA : ')+item.text;$('[data-voice-transcript]').append(li);$('[data-voice-export]').disabled=false;}
    }
    if(event.type==='error') status('OpenAI a signalé une erreur pendant l’échange. Vous pouvez terminer et conserver les mesures.');
    if(event.type==='response.done') {
      const data=meter.snapshot(), format=n=>n===null?'indisponible':n;
      $('[data-voice-metrics]').textContent=`Entrée audio : ${format(data.inputAudio)}\nEntrée texte : ${format(data.inputText)}\nSortie audio : ${format(data.outputAudio)}\nSortie texte : ${format(data.outputText)}\nEstimation réponses : ${data.estimatedResponseUSD===null?'indisponible':data.estimatedResponseUSD.toFixed(4)+' $'}`;
      $('[data-voice-usage]').disabled=false;
    }
  }
  async function stop(message='Conversation terminée. Vous pouvez télécharger le texte et les mesures.') {
    if(stopping)return;stopping=true;generation++;running=false;controller?.abort();clearInterval(timer);if(startTime && !endTime)endTime=Date.now();
    stream?.getTracks().forEach(t=>t.stop());stream=null;dc?.close();pc?.close();pc=null;dc=null;if(audio){audio.pause();audio.srcObject=null;audio=null;}
    $('[data-voice-mute]').disabled=true;$('[data-voice-stop]').disabled=true;status(message);
    const id=callId;callId=null;
    try{if(id)await api({action:'stop',id});}catch(error){status(message+' '+error.message);}
    finally{stopping=false;$('[data-voice-keep]').disabled=!transcript.length;$('[data-voice-keep]').hidden=!transcript.length;}
  }
  async function close(){await stop();dialog.close();document.body.classList.remove('reflection-open');transcript=[];meter=null;}
  window.addEventListener('pagehide',()=>{controller?.abort();stream?.getTracks().forEach(t=>t.stop());pc?.close();});
  BT.store?.subscribe(()=>{if(dialog?.open && (BT.auth.getCurrentUser?.()?.id!==owner || !BT.store.getBookById(book.id)))void close();});
  return {decorate,open};
})();

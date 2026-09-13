window.BT=window.BT||{};
BT.photoFrame=(()=>{
  const limit=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  const dialogs=new Set();
  function cropRect(width,height,ratio,zoom=1,x=.5,y=.5){
    let sw=Math.min(width,height*ratio)/limit(zoom,1,4),sh=sw/ratio;
    return {sx:Math.max(0,width-sw)*limit(x,0,1),sy:Math.max(0,height-sh)*limit(y,0,1),sw,sh};
  }
  // Map the visible guide through object-fit:cover to the original camera pixels.
  function cameraRect(width,height,viewport,guide){
    const scale=Math.max(viewport.width/width,viewport.height/height);
    return {sx:((width*scale-viewport.width)/2+guide.left-viewport.left)/scale,
      sy:((height*scale-viewport.height)/2+guide.top-viewport.top)/scale,sw:guide.width/scale,sh:guide.height/scale};
  }
  function makeDialog(title,body){
    const d=document.createElement('dialog'),id='photo-'+crypto.randomUUID();
    d.className='app-dialog photo-frame-dialog';d.setAttribute('aria-labelledby',id);
    d.innerHTML=`<h2 id="${id}">${title}</h2>${body}`;
    const previous=document.activeElement,parent=previous?.closest('dialog');
    const close=()=>d.close();parent?.addEventListener('close',close,{once:true});
    d.addEventListener('close',()=>{dialogs.delete(d);parent?.removeEventListener('close',close);d.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
    dialogs.add(d);document.body.append(d);d.showModal();return d;
  }
  function jpeg(canvas,name){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],name,{type:'image/jpeg'})):reject(new Error('Cette photo ne peut pas être préparée.')),'image/jpeg',.92));}
  async function open(file,{isbn=false}={}){
    if(!file||file.size>15*1024*1024)throw new Error('Choisissez une photo de moins de 15 Mo.');
    const parent=document.activeElement?.closest('dialog'),account=BT.auth.getCurrentUser?.()?.id;
    const source=await BT.auth.decodeAvatarImage(file),w=source.width||source.naturalWidth,h=source.height||source.naturalHeight;
    if((parent&&!parent.open)||account!==BT.auth.getCurrentUser?.()?.id){source.close?.();return null;}
    if(!w||!h){source.close?.();throw new Error('Photo illisible. Essayez une image JPEG.');}
    const d=makeDialog(isbn?'Cadrer le code ISBN':'Cadrer ma photo',`${isbn?'':'<label class="field">Format<select data-photo-ratio><option value="original">Original</option><option value="0.8">Portrait · 4:5</option><option value="1">Carré</option><option value="1.333333333">Paysage · 4:3</option></select></label>'}<div class="photo-crop-stage"><canvas tabindex="0" role="img" aria-label="Cadrage de la photo. Déplacez avec les flèches ou le doigt."></canvas></div><p class="ui-help">${isbn?'Incluez toutes les barres et les chiffres.':'Ce cadrage sera conservé dans le fil.'}</p><label class="field">Zoom<input data-photo-zoom type="range" min="1" max="4" step="0.01" value="1"></label><button type="button" class="text-link" data-photo-rotate>↻ Tourner</button><details class="notebook-filters"><summary>Position</summary><label class="field">Horizontale<input data-photo-x type="range" min="0" max="100" value="50"></label><label class="field">Verticale<input data-photo-y type="range" min="0" max="100" value="50"></label></details><p data-photo-status role="status"></p><div class="button-row"><button type="button" class="button button--secondary" data-photo-cancel>Annuler</button><button type="button" class="button button--primary" data-photo-apply>Utiliser ce cadrage</button></div>`);
    const canvas=d.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false}),zoom=d.querySelector('[data-photo-zoom]'),x=d.querySelector('[data-photo-x]'),y=d.querySelector('[data-photo-y]'),format=d.querySelector('[data-photo-ratio]');
    const rotated=document.createElement('canvas');let angle=0,drag=null;
    function orient(){const scale=Math.min(1,2560/Math.max(w,h)),rw=Math.round(w*scale),rh=Math.round(h*scale);rotated.width=angle%180?rh:rw;rotated.height=angle%180?rw:rh;const g=rotated.getContext('2d');g.translate(rotated.width/2,rotated.height/2);g.rotate(angle*Math.PI/180);g.drawImage(source,-rw/2,-rh/2,rw,rh);}
    const rect=()=>cropRect(rotated.width,rotated.height,isbn?2.8:format.value==='original'?rotated.width/rotated.height:Number(format.value),zoom.value,x.value/100,y.value/100);
    function draw(){const r=rect(),scale=Math.min(1,1600/Math.max(r.sw,r.sh));canvas.width=Math.max(1,Math.round(r.sw*scale));canvas.height=Math.max(1,Math.round(r.sh*scale));ctx.fillStyle='#f6f1e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(rotated,r.sx,r.sy,r.sw,r.sh,0,0,canvas.width,canvas.height);}
    [zoom,x,y,format].filter(Boolean).forEach(c=>c.oninput=draw);
    d.querySelector('[data-photo-rotate]').onclick=()=>{angle=(angle+90)%360;orient();draw();};
    canvas.onpointerdown=e=>{if(e.button!==0||drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;const r=rect(),box=canvas.getBoundingClientRect();if(rotated.width>r.sw)x.value=Number(x.value)-(e.clientX-drag.x)*r.sw/box.width/(rotated.width-r.sw)*100;if(rotated.height>r.sh)y.value=Number(y.value)-(e.clientY-drag.y)*r.sh/box.height/(rotated.height-r.sh)*100;drag={id:e.pointerId,x:e.clientX,y:e.clientY};draw();};
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,()=>drag=null));
    canvas.onkeydown=e=>{const a={ArrowLeft:[x,-2],ArrowRight:[x,2],ArrowUp:[y,-2],ArrowDown:[y,2]}[e.key];if(a){e.preventDefault();a[0].value=Number(a[0].value)+a[1];draw();}};
    orient();draw();
    return new Promise(resolve=>{let result=null;d.querySelector('[data-photo-cancel]').onclick=()=>d.close();d.querySelector('[data-photo-apply]').onclick=async e=>{e.target.disabled=true;try{result=await jpeg(canvas,isbn?'isbn-cadre.jpg':'photo-cadree.jpg');if(d.open)d.close();}catch(error){d.querySelector('[data-photo-status]').textContent=error.message;e.target.disabled=false;}};d.addEventListener('close',()=>{source.close?.();rotated.width=rotated.height=0;resolve(result);},{once:true});});
  }
  function camera(){
    const d=makeDialog('Scanner un ISBN','<div class="isbn-camera-viewport"><video autoplay muted playsinline></video><div class="isbn-camera-guide" aria-hidden="true"></div></div><p class="small muted">Placez le code-barres dans le cadre : l’ISBN sera détecté automatiquement. Reculez légèrement si l’image est floue.</p><div data-camera-tools></div><p data-camera-status role="status">Ouverture de la caméra…</p><div class="button-row"><button type="button" class="button button--secondary" data-camera-cancel>Annuler</button><button type="button" class="button button--primary" data-camera-capture disabled>Photographier</button></div>');
    const video=d.querySelector('video'),capture=d.querySelector('[data-camera-capture]'),status=d.querySelector('[data-camera-status]'),tools=d.querySelector('[data-camera-tools]'),canvas=document.createElement('canvas');let stream,result=null,decoder,timer,request=0,capturing=false,last='',matches=0;
    const stopStream=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;};
    const stop=()=>{request++;clearTimeout(timer);stopStream();decoder?.close();canvas.width=canvas.height=0;};
    const frame=()=>{if(!video.videoWidth||video.readyState<2)return null;const viewport=video.getBoundingClientRect(),guide=d.querySelector('.isbn-camera-guide').getBoundingClientRect();if(!viewport.width||!guide.width)return null;const r=cameraRect(video.videoWidth,video.videoHeight,viewport,guide),scale=Math.min(1,1920/r.sw);canvas.width=Math.max(1,Math.round(r.sw*scale));canvas.height=Math.max(1,Math.round(r.sh*scale));canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,r.sx,r.sy,r.sw,r.sh,0,0,canvas.width,canvas.height);return canvas;};
    async function scan(token){if(!d.open||token!==request||capturing||!decoder)return;const image=frame();if(image){const isbn=await decoder.decode(image);if(!d.open||token!==request||capturing)return;if(isbn){matches=last===isbn?matches+1:1;last=isbn;if(matches>=2){result={isbn};status.textContent='ISBN reconnu : '+isbn;d.close();return;}}else{last='';matches=0;}}timer=setTimeout(()=>scan(token),400);}
    async function start(deviceId){const token=++request;clearTimeout(timer);stopStream();capture.disabled=true;last='';matches=0;tools.replaceChildren();try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Caméra indisponible.');
      const constraints={audio:false,video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),width:{ideal:2560},height:{ideal:1440},frameRate:{ideal:24,max:30}}};
      const next=await navigator.mediaDevices.getUserMedia(constraints);if(!d.open||token!==request){next.getTracks().forEach(t=>t.stop());return;}stream=next;const track=stream.getVideoTracks()[0],caps=track.getCapabilities?.()||{};
      const continuous={};for(const name of ['focusMode','exposureMode','whiteBalanceMode'])if(caps[name]?.includes?.('continuous'))continuous[name]='continuous';
      if(Object.keys(continuous).length)try{await track.applyConstraints({advanced:[continuous]});}catch{/* Some devices report settings that they cannot apply. */}
      if(!d.open||token!==request)return;video.srcObject=stream;await video.play();if(!d.open||token!==request)return;capture.disabled=false;status.textContent='Recherche automatique du code ISBN…';
      if(caps.torch){const torch=document.createElement('button');torch.type='button';torch.className='button button--secondary button--small';torch.textContent='Éclairage';torch.setAttribute('aria-pressed','false');torch.onclick=async()=>{try{const on=torch.getAttribute('aria-pressed')!=='true';await track.applyConstraints({advanced:[{torch:on}]});torch.setAttribute('aria-pressed',String(on));}catch{status.textContent='Éclairage indisponible sur cette caméra.';}};tools.append(torch);}
      if(caps.zoom&&caps.zoom.max>caps.zoom.min){const label=document.createElement('label'),zoom=document.createElement('input');label.className='field';label.textContent='Zoom de la caméra';zoom.type='range';zoom.min=Math.max(1,caps.zoom.min);zoom.max=Math.min(3,caps.zoom.max);zoom.step=caps.zoom.step||.1;zoom.value=track.getSettings?.().zoom||zoom.min;zoom.oninput=()=>track.applyConstraints({advanced:[{zoom:Number(zoom.value)}]}).catch(()=>{});label.append(zoom);tools.append(label);}
      try{const devices=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput');if(d.open&&token===request&&devices.length>1){const label=document.createElement('label'),select=document.createElement('select');label.className='field';label.textContent='Objectif';devices.forEach((device,index)=>{const o=document.createElement('option');o.value=device.deviceId;o.textContent=device.label||'Caméra '+(index+1);select.append(o);});select.value=track.getSettings?.().deviceId||deviceId||devices[0].deviceId;select.onchange=()=>start(select.value);label.append(select);tools.append(label);}}catch{}
      try{decoder||=await BT.bookLookup.createLiveISBNDecoder();if(d.open&&token===request)scan(token);}catch{if(d.open&&token===request)status.textContent='Détection automatique indisponible. Vous pouvez photographier le code ou importer une image.';}
    }catch{if(token===request){stopStream();status.textContent='Caméra indisponible ou refusée. Fermez cette fenêtre pour importer une photo ou saisir l’ISBN.';}}}
    const account=BT.auth.getCurrentUser?.()?.id;const unsubscribe=BT.store?.subscribe(()=>{if(BT.auth.getCurrentUser?.()?.id!==account)d.close();});
    return new Promise(resolve=>{d.querySelector('[data-camera-cancel]').onclick=()=>d.close();d.addEventListener('close',()=>{unsubscribe?.();stop();resolve(result);},{once:true});capture.onclick=async()=>{capture.disabled=true;capturing=true;clearTimeout(timer);try{const image=frame();if(!image)throw new Error('La caméra n’est pas encore prête.');result=await jpeg(image,'isbn-camera.jpg');if(d.open)d.close();}catch(error){if(d.open){status.textContent=error.message;capture.disabled=false;capturing=false;scan(request);}}};start();});
  }
  window.addEventListener('pagehide',()=>{for(const d of dialogs)d.close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const d of dialogs)if(d.querySelector('video'))d.close();});
  return {open,camera,cropRect,cameraRect};
})();

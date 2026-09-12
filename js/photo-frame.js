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
    const d=makeDialog('Scanner un ISBN','<div class="isbn-camera-viewport"><video autoplay muted playsinline></video><div class="isbn-camera-guide" aria-hidden="true"></div></div><p class="ui-help">Placez le code-barres et ses chiffres dans le cadre.</p><p data-camera-status role="status">Ouverture de la caméra…</p><div class="button-row"><button type="button" class="button button--secondary" data-camera-cancel>Annuler</button><button type="button" class="button button--primary" data-camera-capture disabled>Photographier</button></div>');
    const video=d.querySelector('video'),capture=d.querySelector('[data-camera-capture]'),status=d.querySelector('[data-camera-status]');let stream,result=null;
    const stop=()=>{stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;};
    return new Promise(resolve=>{
      d.querySelector('[data-camera-cancel]').onclick=()=>d.close();
      d.addEventListener('close',()=>{stop();resolve(result);},{once:true});
      capture.onclick=async()=>{capture.disabled=true;try{if(!video.videoWidth)throw new Error('La caméra n’est pas encore prête.');const r=cameraRect(video.videoWidth,video.videoHeight,video.getBoundingClientRect(),d.querySelector('.isbn-camera-guide').getBoundingClientRect()),canvas=document.createElement('canvas'),scale=Math.min(1,1600/r.sw);canvas.width=Math.round(r.sw*scale);canvas.height=Math.round(r.sh*scale);canvas.getContext('2d').drawImage(video,r.sx,r.sy,r.sw,r.sh,0,0,canvas.width,canvas.height);result=await jpeg(canvas,'isbn-camera.jpg');if(d.open)d.close();}catch(error){status.textContent=error.message;capture.disabled=false;}};
      (async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Caméra indisponible. Importez une photo depuis le formulaire.');stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});if(!d.open){stop();return;}video.srcObject=stream;await video.play();if(!d.open){stop();return;}capture.disabled=false;status.textContent='';}catch{stop();status.textContent='Caméra indisponible ou refusée. Fermez cette fenêtre pour importer une photo.';}})();
    });
  }
  window.addEventListener('pagehide',()=>{for(const d of dialogs)d.close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const d of dialogs)if(d.querySelector('video'))d.close();});
  return {open,camera,cropRect,cameraRect};
})();

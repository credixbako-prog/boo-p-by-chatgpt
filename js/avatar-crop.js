window.BT = window.BT || {};
BT.avatarCrop = (() => {
  function bounds(width,height,zoom,x,y) {
    const side=Math.min(width,height)/Math.max(1,Math.min(3,Number(zoom)||1));
    return {side,sx:(width-side)*Math.max(0,Math.min(1,x)),sy:(height-side)*Math.max(0,Math.min(1,y))};
  }
  async function open(file) {
    const source=await BT.auth.decodeAvatarImage(file);
    const width=source.width || source.naturalWidth,height=source.height || source.naturalHeight;
    if(!width || !height){source.close?.();throw new Error('Cette photo ne peut pas être lue.');}
    const previous=document.activeElement,dialog=document.createElement('dialog');
    dialog.className='app-dialog avatar-crop-dialog';dialog.setAttribute('aria-labelledby','avatar-crop-title');
    dialog.innerHTML='<h2 id="avatar-crop-title">Cadrer ma photo</h2><p id="avatar-crop-help">Déplacez la photo pour choisir votre cadrage, puis ajustez le zoom.</p><div class="avatar-crop-frame"><canvas width="512" height="512" tabindex="0" role="img" aria-label="Aperçu de la photo. Utilisez les flèches pour déplacer le cadrage." aria-describedby="avatar-crop-help"></canvas></div><label class="field">Zoom<input data-crop-zoom type="range" min="1" max="3" step="0.01" value="1"></label><details><summary>Ajuster la position</summary><label class="field">Position horizontale<input data-crop-x type="range" min="0" max="100" value="50"></label><label class="field">Position verticale<input data-crop-y type="range" min="0" max="100" value="50"></label></details><p data-crop-status role="status"></p><div class="button-row"><button class="button button--secondary" type="button" data-crop-cancel>Annuler</button><button class="button button--primary" type="button" data-crop-apply>Utiliser ce cadrage</button></div>';
    const canvas=dialog.querySelector('canvas'),context=canvas.getContext('2d',{alpha:false}),zoom=dialog.querySelector('[data-crop-zoom]'),x=dialog.querySelector('[data-crop-x]'),y=dialog.querySelector('[data-crop-y]');
    const draw=()=>{const crop=bounds(width,height,zoom.value,x.value/100,y.value/100);context.fillStyle='#f6f1e8';context.fillRect(0,0,512,512);context.drawImage(source,crop.sx,crop.sy,crop.side,crop.side,0,0,512,512);};
    [zoom,x,y].forEach(control=>control.addEventListener('input',draw));
    let drag=null;
    canvas.addEventListener('pointerdown',event=>{if(drag || event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{
      if(!drag || event.pointerId!==drag.id)return;const crop=bounds(width,height,zoom.value,x.value/100,y.value/100),scale=crop.side/canvas.getBoundingClientRect().width;
      if(width>crop.side)x.value=Number(x.value)-(event.clientX-drag.x)*scale/(width-crop.side)*100;
      if(height>crop.side)y.value=Number(y.value)-(event.clientY-drag.y)*scale/(height-crop.side)*100;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};draw();
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,()=>{drag=null;}));
    canvas.addEventListener('keydown',event=>{const controls={ArrowLeft:[x,-2],ArrowRight:[x,2],ArrowUp:[y,-2],ArrowDown:[y,2]};const action=controls[event.key];if(action){event.preventDefault();action[0].value=Number(action[0].value)+action[1];draw();}});
    return new Promise(resolve=>{
      let result=null;
      dialog.querySelector('[data-crop-cancel]').onclick=()=>dialog.close();
      dialog.querySelector('[data-crop-apply]').onclick=()=>{
        const apply=dialog.querySelector('[data-crop-apply]');if(apply.disabled)return;apply.disabled=true;
        canvas.toBlob(blob=>{if(!dialog.open)return;if(!blob){apply.disabled=false;dialog.querySelector('[data-crop-status]').textContent='Impossible de préparer cette photo. Réessayez.';return;}result=new File([blob],'avatar-cadre.png',{type:'image/png'});dialog.close();},'image/png');
      };
      dialog.addEventListener('close',()=>{source.close?.();dialog.remove();previous?.focus?.({preventScroll:true});resolve(result);},{once:true});
      document.body.append(dialog);draw();dialog.showModal();canvas.focus();
    });
  }
  return {open,bounds};
})();

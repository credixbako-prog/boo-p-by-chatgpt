window.BT=window.BT||{};
BT.shelves=(()=>{
  const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
  const clean=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,60);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function names(){const out=[];for(const book of BT.store.getBooks().filter(b=>b.libraryState==='library')){const name=clean(book.genre)||'À classer';if(!out.some(v=>key(v)===key(name)))out.push(name);}return out.sort((a,b)=>a.localeCompare(b,'fr'));}
  function canonical(value){const name=clean(value)||'À classer';return names().find(n=>key(n)===key(name))||name;}
  function field(value=''){const choices=names();if(!choices.some(v=>key(v)===key('À classer')))choices.unshift('À classer');const selected=canonical(value),exists=choices.some(v=>key(v)===key(selected));return `<label class="field">Rayon de ma bibliothèque<select id="book-genre-field" name="genre" data-shelf-choice>${choices.map(name=>`<option value="${escape(name)}" ${key(name)===key(selected)?'selected':''}>${escape(name)}</option>`).join('')}<option value="__new__" ${exists?'':'selected'}>＋ Créer un rayon</option></select><span class="field-help">Choisissez un rayon existant ou créez-en un nouveau.</span></label><label class="field" data-new-shelf ${exists?'hidden':''}>Nom du nouveau rayon<input name="newGenre" maxlength="60" value="${exists?'':escape(selected)}" ${exists?'':'required'} placeholder="Ex. Littérature japonaise"></label>`;}
  function setValue(form,value){const select=form?.querySelector('[data-shelf-choice]');if(!select)return;const name=canonical(value),option=[...select.options].find(o=>key(o.value)===key(name));select.value=option?option.value:'__new__';form.querySelector('[name=newGenre]').value=option?'':name;toggle(select);}
  function toggle(select){const label=select.form.querySelector('[data-new-shelf]'),input=label.querySelector('input');label.hidden=select.value!=='__new__';input.required=!label.hidden;}
  document.addEventListener('change',e=>{if(e.target.matches('[data-shelf-choice]'))toggle(e.target);});
  function formValue(form){const select=form.querySelector('[data-shelf-choice]');return canonical(select?.value==='__new__'?form.querySelector('[name=newGenre]').value:select?.value);}

  let hold=null,drag=null,suppressUntil=0,frame;
  function cancel(){clearTimeout(hold?.timer);hold=null;if(drag){drag.ghost.remove();drag.source.classList.remove('is-shelf-dragging');document.querySelectorAll('.is-shelf-target').forEach(n=>n.classList.remove('is-shelf-target'));document.body.classList.remove('is-rearranging-shelf');drag=null;}cancelAnimationFrame(frame);}
  function targetAt(x,y){return document.elementFromPoint(x,y)?.closest('[data-drop-genre]');}
  function motion(){if(!drag)return;const {x,y}=drag;drag.ghost.style.left=x+'px';drag.ghost.style.top=y+'px';const target=targetAt(x,y);document.querySelectorAll('.is-shelf-target').forEach(n=>{if(n!==target)n.classList.remove('is-shelf-target');});target?.classList.add('is-shelf-target');
    if(target&&target!==drag.target){drag.target=target;drag.targetSince=performance.now();}if(target&&!target.open&&performance.now()-drag.targetSince>550)target.open=true;
    if(y<120)window.scrollBy(0,-9);else if(y>innerHeight-95)window.scrollBy(0,9);frame=requestAnimationFrame(motion);
  }
  function start(){if(!hold?.source.isConnected)return;const {source,x,y,id,account}=hold;drag={source,x,y,id,account,book:BT.store.getBookById(source.dataset.id),ghost:source.cloneNode(true)};hold=null;
    drag.ghost.removeAttribute('id');drag.ghost.removeAttribute('data-action');drag.ghost.className='book-spine shelf-drag-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.tabIndex=-1;document.body.append(drag.ghost);source.classList.add('is-shelf-dragging');document.body.classList.add('is-rearranging-shelf');
    const live=document.getElementById('live-region');if(live)live.textContent='Livre saisi. Déplacez-le vers un rayon, puis relâchez. Échap pour annuler.';motion();
  }
  document.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;const source=e.target.closest('.book-spine[data-action="select-book"]');if(!source)return;cancel();hold={source,x:e.clientX,y:e.clientY,id:e.pointerId,account:BT.auth.getCurrentUser()?.id,timer:setTimeout(start,450)};});
  document.addEventListener('pointermove',e=>{if(drag&&e.pointerId===drag.id){drag.x=e.clientX;drag.y=e.clientY;e.preventDefault();}else if(hold&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>9)cancel();},{passive:false});
  document.addEventListener('touchmove',e=>{if(drag)e.preventDefault();},{passive:false});
  document.addEventListener('touchstart',e=>{if(e.touches.length>1)cancel();},{passive:true});
  document.addEventListener('pointerup',e=>{if(!drag){cancel();return;}if(e.pointerId!==drag.id)return;const target=targetAt(e.clientX,e.clientY),book=drag.book,account=drag.account;suppressUntil=performance.now()+650;cancel();if(target&&book&&account===BT.auth.getCurrentUser()?.id){const genre=canonical(target.dataset.dropGenre);if(key(genre)!==key(book.genre)){BT.store.updateBook(book.id,{genre,genres:[genre]});document.dispatchEvent(new CustomEvent('boop:shelf-moved',{detail:{genre,title:book.title}}));}}});
  document.addEventListener('pointercancel',()=>{if(drag)suppressUntil=performance.now()+650;cancel();});
  document.addEventListener('click',e=>{if(performance.now()<suppressUntil && e.target.closest(".bookcase")){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
  document.addEventListener('contextmenu',e=>{if(e.target.closest('.book-spine[data-action="select-book"]'))e.preventDefault();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(drag||hold)){suppressUntil=performance.now()+650;cancel();}});
  window.addEventListener('blur',cancel);window.addEventListener('hashchange',cancel);
  return {names,canonical,field,setValue,formValue};
})();

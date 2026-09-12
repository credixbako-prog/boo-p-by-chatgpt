/* Saved reader cards contain only the rendered image, never hidden report source data. */
window.BT=window.BT||{};
BT.readingCards=(()=>{
  const who=()=>BT.auth?.isAuthenticated()&&!BT.auth?.isGuest()?BT.auth.getCurrentUser()?.id:null;
  const scope=()=>who()||'guest';
  const views=new Set(),dialogs=new Map(),erasing=new Set();
  let database;
  function db(){return database ||= new Promise((resolve,reject)=>{const req=indexedDB.open('boop-reading-cards-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('cards',{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>{database=null;reject(new Error('L’enregistrement local est indisponible. Téléchargez la carte pour la conserver.'));};});}
  async function local(mode,operation){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('cards',mode),req=operation(tx.objectStore('cards'));tx.oncomplete=()=>resolve(req.result);tx.onabort=tx.onerror=()=>reject(new Error('La carte n’a pas pu être conservée sur cet appareil.'));});}
  const cache=card=>{if(erasing.has(card.user_id))return Promise.reject(new Error('Effacement local en cours.'));return local('readwrite',s=>s.put({...card,key:card.user_id+':'+card.id}));};
  const cached=async id=>(await local('readonly',s=>s.getAll())).filter(c=>c.user_id===id).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  async function clearLocal(account=scope()){erasing.add(account);const cards=await cached(account);await local('readwrite',s=>{for(const c of cards)s.delete(c.key);return s.getAll();});}
  async function exportLocal(){const account=scope(),cards=await cached(account);if(scope()!==account)throw new Error('Le compte a changé.');return cards;}
  async function ready(expected=who()){await BT.auth.ready();if(!expected||who()!==expected)throw new Error('Reconnectez-vous pour gérer vos cartes.');return BT.auth.getClient();}
  function result(r){if(r.error)throw new Error('Les cartes ne peuvent pas être synchronisées. Réessayez quand la connexion est disponible.');return r.data;}
  async function list(owner,offset=0,published=false){const account=who(),client=await ready(account);let q=client.from('reading_cards').select('id,user_id,month_key,title,caption,visibility,image_data,created_at').eq('user_id',owner).order('created_at',{ascending:false}).order('id').range(offset,offset+5);if(published)q=q.neq('visibility','private');const rows=result(await q)||[];if(account!==who())throw new Error('Le compte a changé.');return rows;}
  async function upload(card,account){const client=await ready(account);const row={id:card.id,user_id:account,month_key:card.month_key,title:card.title,caption:'',visibility:'private',image_data:card.image_data,created_at:card.created_at};result(await client.from('reading_cards').upsert(row,{onConflict:'id',ignoreDuplicates:true}));if(who()!==account)throw new Error('Le compte a changé.');return {...card,synced:true};}
  async function save(canvas,data){const account=scope();const card={id:crypto.randomUUID(),user_id:account,month_key:data.monthKey,title:'Mon mois de lecture · '+data.label,caption:'',visibility:'private',image_data:canvas.toDataURL('image/jpeg',.9),created_at:new Date().toISOString(),synced:false};
    if(card.image_data.length>2200000)throw new Error('Cette image est trop volumineuse. Téléchargez-la pour la conserver.');
    await cache(card);if(scope()!==account)throw new Error('Le compte a changé.');
    if(who()&&navigator.onLine){try{const saved=await upload(card,account);await cache(saved);Object.assign(card,saved);}catch{/* Private local copy stays available for retry. */}}
    if(scope()!==account)throw new Error('Le compte a changé.');changed();return card;
  }
  function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn,cls='button button--secondary button--small'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
  function image(card){const img=el('img');img.alt=card.title;img.loading='lazy';if(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(card.image_data||''))img.src=card.image_data;return img;}
  function download(card){const a=el('a');a.href=card.image_data;a.download='boo-p-carte-'+card.month_key+'.jpg';document.body.append(a);a.click();a.remove();}
  function modal(title){const d=el('dialog',null,'app-dialog saved-card-dialog'),head=el('div',null,'dialog-head'),h=el('h2',title),body=el('div',null,'dialog-body');h.id='card-'+crypto.randomUUID();d.setAttribute('aria-labelledby',h.id);const close=button('×',()=>d.close(),'icon-button');close.setAttribute('aria-label','Fermer');head.append(h,close);d.append(head,body);document.body.append(d);dialogs.set(d,scope());d.onclose=()=>{dialogs.delete(d);d.remove();};d.showModal();return {d,body};}
  function changed(){window.dispatchEvent(new Event('boop:reading-cards-changed'));}
  function open(card,mine=false){const {d,body}=modal(card.title),account=scope();body.append(image(card));if(card.caption)body.append(el('p',card.caption,'saved-card-caption'));const actions=el('div',null,'button-row');actions.append(button('Télécharger',()=>download(card)));body.append(actions);
    if(mine){actions.append(button(card.visibility==='private'?'Publier la carte':'Modifier la publication',()=>editPublication(card)));if(!card.synced)body.append(el('p','Enregistrée sur cet appareil · à synchroniser','small muted'));}
    if(scope()!==account)d.close();
  }
  function editPublication(card){const {d,body}=modal('Partager ma carte'),account=who(),status=el('p','','small muted');body.append(image(card));
    if(!account){body.append(el('p','La carte reste dans votre carnet sur cet appareil. Connectez-vous à votre compte pour publier une carte.'));return;}
    const form=el('form',null,'form-grid'),label=el('label','Mon texte','field'),input=el('textarea');input.maxLength=1200;input.value=card.caption||`Un mois de lectures, de découvertes et de moments pour soi. Voici ma carte BOO-P.`;label.append(input);const audience=el('label','Qui peut voir cette carte ?','field'),select=el('select');for(const [value,text] of [['friends','Mes amis'],['public','La communauté'],['private','Moi uniquement · retirer la publication']]){const option=el('option',text);option.value=value;select.append(option);}select.value=card.visibility==='private'?'friends':card.visibility;audience.append(select);const submit=el('button','Enregistrer la publication','button button--primary');submit.type='submit';form.append(label,audience,el('p','Seule cette image et votre texte seront partagés. Vérifiez les informations visibles sur la carte.','small muted'),submit,status);body.append(form);
    form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{
      if(!card.synced)card=await upload(card,account);
      const client=await ready(account),rows=result(await client.from('reading_cards').update({caption:input.value.trim(),visibility:select.value}).eq('id',card.id).eq('user_id',account).select('id'));
      if(!rows?.length)throw new Error('Cette carte n’est plus accessible.');if(who()!==account||!d.isConnected)return;
      card={...card,caption:input.value.trim(),visibility:select.value,synced:true};await cache(card);status.textContent=select.value==='private'?'Carte conservée en privé.':'Carte publiée sur votre profil.';changed();
    }catch(e){status.textContent=e.message;}finally{submit.disabled=false;}};
  }
  function mount(host,{owner=scope(),creation=false,published=false,layout='carousel',compact=false}={}){
    for(const refresh of views)if(!refresh.host?.isConnected)refresh();
    const account=scope();let generation=0,offset=0,rows=[],more=false;const current=()=>host.isConnected&&scope()===account;
    async function load(next=false){const token=++generation;const status=el('p','Chargement des cartes…','small muted');status.setAttribute('role','status');if(!next)host.replaceChildren(status);else host.append(status);
      try{
        let remote=[];if(who())remote=await list(owner,next?offset:0,published);
        if(!current()||token!==generation)return;
        if(!published&&owner===account){const locals=await cached(account);if(!current())return;
          for(const c of locals.filter(c=>!c.synced)){if(who()&&navigator.onLine){try{const saved=await upload(c,account);if(!current())return;await cache(saved);}catch{/* Retry remains available. */}}}
          for(const c of remote)await cache({...c,synced:true});
          const all=await cached(account);if(!current())return;rows=all;
        }else rows=next?[...rows,...remote]:remote;
        offset=(next?offset:0)+remote.length;more=remote.length===6;paint();
      }catch(error){if(!current()||token!==generation)return;
        if(!published&&owner===account){try{rows=await cached(account);if(!current())return;paint();}catch{host.replaceChildren();}}
        else if(!next)host.replaceChildren();status.textContent=error.message;host.append(status,button('Réessayer',()=>load(next),'text-link'));
      }
    }
    function paint(){host.replaceChildren();const heading=el('div',null,'section-heading'),title=el('h3',creation?'Mes cartes de lecture':'Cartes partagées'),controls=el('div',null,'saved-card-dots'),rail=el('div',null,layout==='list'?'saved-card-list':'saved-card-carousel saved-card-carousel--paged');rail.setAttribute('role','region');rail.setAttribute('aria-label',layout==='list'?'Mes cartes de lecture':'Cartes de lecture à faire défiler horizontalement');if(layout!=='list')rail.tabIndex=0;
      controls.setAttribute('role','group');controls.setAttribute('aria-label','Choisir une carte');heading.append(title);host.append(heading,rail);
      if(creation){const add=el('article',null,'saved-card-slide saved-card-create');add.append(el('span','＋','saved-card-plus'),el('h3','Un mois, une carte'),button('Créer ma carte du mois',()=>document.dispatchEvent(new CustomEvent('boop:create-reading-card')),'button button--primary'));rail.append(add);}
      for(const card of rows){const slide=el('article',null,'saved-card-slide'+(compact?' saved-card-slide--image':'')),preview=button('',()=>open(card,!published),'saved-card-preview');preview.setAttribute('aria-label','Ouvrir '+card.title);preview.append(image(card));slide.append(preview);if(!compact){slide.append(el('h4',card.title));if(!published)slide.append(el('p',card.visibility==='private'?'Privée · dans mon carnet':card.visibility==='friends'?'Publiée · amis':'Publiée · communauté','small muted'));if(card.caption)slide.append(el('p',card.caption,'saved-card-caption'));if(!published)slide.append(button(card.visibility==='private'?'Publier':'Gérer la publication',()=>editPublication(card),'text-link'));}rail.append(slide);}
      if(more){const last=el('article',null,'saved-card-slide saved-card-more');last.append(button('Charger les cartes suivantes',()=>load(true)));rail.append(last);}
      if(!rows.length&&!creation)rail.append(el('p','Les cartes publiées apparaîtront ici.','small muted'));
      if(layout!=='list'&&rail.children.length>1){
        const slides=[...rail.children],dots=slides.map((slide,i)=>{const dot=button('',()=>rail.scrollTo({left:slide.offsetLeft-slides[0].offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),'saved-card-dot');dot.setAttribute('aria-label','Carte '+(i+1)+' sur '+slides.length);dot.setAttribute('aria-current',i===0?'true':'false');dot.append(el('span'));controls.append(dot);return dot;});
        const update=()=>{let index=0,distance=Infinity;slides.forEach((slide,i)=>{const d=Math.abs(slide.offsetLeft-slides[0].offsetLeft-rail.scrollLeft);if(d<distance){distance=d;index=i;}});dots.forEach((dot,i)=>dot.setAttribute('aria-current',String(i===index)));};
        rail.addEventListener('scroll',update,{passive:true});host.append(controls);
      }
    }
    const refresh=()=>{if(current())load();else{if(host.isConnected&&scope()!==account)host.replaceChildren();views.delete(refresh);window.removeEventListener('boop:reading-cards-changed',refresh);}};refresh.account=account;refresh.host=host;views.add(refresh);window.addEventListener('boop:reading-cards-changed',refresh);load();return ()=>{views.delete(refresh);window.removeEventListener('boop:reading-cards-changed',refresh);generation++;};
  }
  window.addEventListener('online',()=>{for(const refresh of views)refresh();});
  document.addEventListener('DOMContentLoaded',()=>BT.store.subscribe(()=>{for(const [d,account] of dialogs)if(scope()!==account)d.close();for(const refresh of views)if(scope()!==refresh.account)refresh();}));
  return {save,mount,open,list,clearLocal,exportLocal};
})();

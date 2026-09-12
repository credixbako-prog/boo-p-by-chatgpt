window.BT=window.BT || {};
BT.readerProfile=(()=>{
  const api=()=>BT.readerProfileApi, who=()=>BT.auth.isAuthenticated()&&!BT.auth.isGuest()?BT.auth.getCurrentUser()?.id:null;
  const labels=BT.sharing.labels,statuses={'en-cours':'En cours',lu:'Lu','a-lire':'À lire','en-pause':'En pause',abandonne:'Abandonné'};
  const windows=new Map(),profiles=new Map();
  function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
  function button(text,fn,cls='button button--secondary button--small'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
  function actionIcon(kind){return '<svg class="reader-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(kind==='encourage'?'<path d="M20.5 5.8a5.1 5.1 0 0 0-7.2 0L12 7.1l-1.3-1.3a5.1 5.1 0 0 0-7.2 7.2L12 21l8.5-8a5.1 5.1 0 0 0 0-7.2Z"/>':'<path d="M20 13v4a3 3 0 0 1-3 3H8l-5 2V7a3 3 0 0 1 3-3h6"/><path d="m14 5 3 3m-8 8 4-1 8-8a2.1 2.1 0 0 0-3-3l-8 8-1 4Z"/>')+'</svg>';}
  function actionLabel(b,kind,label,count){const icon=el('span');icon.innerHTML=actionIcon(kind);b.replaceChildren(icon.firstChild,el('span',label),el('span',String(count),'reader-action-count'));}
  function modal(title){const d=el('dialog',null,'app-dialog reader-dialog'),h=el('div',null,'dialog-head'),heading=el('h2',title);heading.id='reader-'+crypto.randomUUID();d.setAttribute('aria-labelledby',heading.id);h.append(heading,button('×',()=>d.close(),'icon-button'));h.lastChild.setAttribute('aria-label','Fermer');const body=el('div',null,'dialog-body');d.append(h,body);document.body.append(d);windows.set(d,who());d.addEventListener('close',()=>{windows.delete(d);d.remove();},{once:true});d.showModal();return {d,body};}
  function message(text='Chargement…'){const p=el('p',text,'small muted');p.setAttribute('role','status');return p;}
  function cover(book){const c=el('div',null,'reader-cover');c.append(el('span',book.title));
    try{const url=new URL(book.coverUrl);if(url.protocol==='https:'&&['covers.openlibrary.org','books.google.com','books.google.fr','books.googleusercontent.com'].includes(url.hostname)){
      const img=el('img');img.src=url.href;img.alt='Couverture de '+book.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();c.append(img);
    }}catch{}return c;
  }
  function addBook(book){const {body}=modal('Garder ce livre');const p=message();body.append(el('h3',book.title),el('p',(book.authors||[]).join(', '),'muted'));
    const duplicate=BT.store.getBooks().some(b=>(book.isbn&&b.isbn===book.isbn)||b.title.toLocaleLowerCase('fr')===book.title.toLocaleLowerCase('fr'));
    if(duplicate){body.append(el('p','Ce livre figure déjà dans votre espace personnel.'));return;}
    const label=el('label','Où souhaitez-vous le garder ?','field'),select=el('select');for(const [value,text] of [['library','Ma bibliothèque · À lire'],['wishlist','Ma liste d’envies']]){const o=el('option',text);o.value=value;select.append(o);}label.append(select);body.append(label);
    const account=who(),save=button('Ajouter à mon espace',()=>{if(account!==who())return;BT.store.addBook({title:book.title,authors:[...(book.authors||[])],isbn:book.isbn||'',coverUrl:book.coverUrl||'',mediaType:book.mediaType||'print',status:'a-lire',libraryState:select.value});save.disabled=true;p.textContent='Livre ajouté. Vous pourrez compléter sa fiche dans votre bibliothèque.';},'button button--primary');body.append(save,p);p.textContent='';
  }
  function bookCard(book,userId,compact=false){const card=el('article',null,'reader-book-card reader-book-tile'+(compact?' reader-book-card--compact':''));const open=button('',()=>openBook(userId,book.id),'reader-cover-button');open.setAttribute('aria-label','Découvrir '+book.title);open.title=book.title;open.append(cover(book));card.append(open);return card;}
  const finishes=[['terracotta','Terracotta'],['blue','Bleu'],['sage','Sauge'],['red','Rouge'],['black','Noir'],['white','Blanc']];
  function furniture(finish){const box=el('div',null,'bookcase reader-bookcase bookcase--'+finish);box.setAttribute('aria-label','Bibliothèque du lecteur présentée en meuble');box.append(el('div',null,'bookcase__top'),el('p','Glissez un rayon. Touchez un livre pour le sélectionner, puis à nouveau pour ouvrir sa fiche.','bookcase__instruction'));return box;}
  function appendFurniture(box,books,userId){for(const book of books){
    const status=Object.hasOwn(statuses,book.status)?book.status:'a-lire';let shelf=box.querySelector('[data-reader-shelf="'+status+'"]');
    if(!shelf){shelf=el('details',null,'genre-shelf');shelf.dataset.readerShelf=status;shelf.open=true;const heading=el('summary');heading.append(el('span',statuses[status]),el('small'));const row=el('div',null,'physical-shelf');row.tabIndex=0;row.setAttribute('role','group');row.setAttribute('aria-label','Rayon '+statuses[status]+' · défilement horizontal');shelf.append(heading,row);box.append(shelf);}
    const row=shelf.querySelector('.physical-shelf');let hash=17;for(const character of book.title)hash=character.charCodeAt(0)+((hash<<5)-hash);const hue=Math.abs(hash)%360;
    const spine=button('',()=>{if(spine.getAttribute('aria-pressed')==='true'){openBook(userId,book.id);return;}box.querySelectorAll('.book-spine').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Sélectionner '+b.title);});spine.classList.add('is-selected');spine.setAttribute('aria-pressed','true');spine.setAttribute('aria-label',book.title+' sélectionné. Appuyez à nouveau pour ouvrir sa fiche.');},'book-spine');
    spine.title=book.title;spine.setAttribute('aria-label','Sélectionner '+book.title);spine.setAttribute('aria-pressed','false');
    for(const [key,value] of Object.entries({'--spine-h':(122+Math.abs((hash>>4)%45))+'px','--spine-w':(27+Math.abs(hash%13))+'px','--spine-a':`hsl(${hue} 46% 40%)`,'--spine-b':`hsl(${(hue+24)%360} 50% 56%)`}))spine.style.setProperty(key,value);
    const image=cover(book).querySelector('img');if(image){image.className='book-spine__peek';image.alt='';image.setAttribute('aria-hidden','true');spine.append(image);}spine.append(el('span',book.title));row.append(spine);shelf.querySelector('small').textContent=row.children.length+' livre'+(row.children.length>1?'s':'')+' · glissez';
  }}
  async function openBook(userId,bookId,traceFocus=false){const {d,body}=modal('Autour de ce livre'),account=who(),p=message();body.append(p);
    try{const data=await api().books(userId,'all','',bookId);if(!d.isConnected||account!==who())return;body.replaceChildren();const book=data.books?.[0];if(!data.available||!book){body.append(message('Cette lecture n’est plus accessible.'));return;}
      const head=el('section',null,'reader-book-heading');head.append(cover(book),el('div'));head.lastChild.append(el('h2',book.title),el('p',(book.authors||[]).join(', '),'muted'),el('span',statuses[book.status],'status-chip'));body.append(head,button('Ajouter à ma bibliothèque',()=>addBook(book)));
      const interactions=el('section');body.append(interactions);mountInteractions(interactions,{owner:userId,book:bookId},'Bonne lecture !',traceFocus);
      const pubHost=el('section',null,'reader-content');body.append(el('h3','Ce que cette lecture a laissé'),pubHost);
      const posts=await api().publications(userId,'all',0,bookId);if(!d.isConnected||account!==who())return;
      if(!posts.rows.length)pubHost.append(el('p','Pas encore de publication partagée pour ce livre. Une Trace peut ouvrir la conversation.','small muted'));
      posts.rows.forEach(post=>pubHost.append(postCard(post)));
    }catch(e){p.textContent=e.message;if(!p.isConnected)body.append(message(e.message));}
  }
  function postCard(post){const card=el('article',null,'reader-post-card'),kind=labels[post.reading_kind]||({debut:'Début de lecture',fin:'Livre terminé'})[post.activity_type]||'Une Trace';
    const top=el('div',null,'reader-post-meta');top.append(el('span',kind,'eyebrow'),el('time',new Date(post.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}),'small muted'));if(who()===post.author_id)top.append(BT.sharing.editButton(()=>BT.sharing.editRemotePost(post)));card.append(top);
    if(post.book_title){const heading=el('div',null,'reader-post-book'),slot=el('div');slot.append(cover({title:post.book_title}));heading.append(slot,el('h3',post.book_title));card.append(heading);
      if(who()&&['notebook','debut','fin'].includes(post.reading_kind)){const account=who();api().books(post.author_id,'all','',post.reading_source_id).then(data=>{if(slot.isConnected&&who()===account&&data.available&&data.books[0])slot.replaceChildren(cover(data.books[0]));}).catch(()=>{});}
    }const content=el('div');content.innerHTML=BT.sharing.publicationHTML(post.reading_kind,post.reading_content,post.body);card.append(content);
    const actions=el('section');card.append(actions);mountInteractions(actions,{post:post.id},post.reading_kind==='notebook'?'Cette réflexion me parle':'Encourager');return card;
  }
  async function openPublication(id,focus=false){const {d,body}=modal('Une lecture en partage'),account=who(),p=message();body.append(p);
    try{const post=await api().publication(id);if(!d.isConnected||account!==who())return;body.replaceChildren();if(!post){body.append(message('Cette publication a été retirée ou n’est plus accessible.'));return;}
      body.append(el('p',post.author_name,'eyebrow'),el('h2',post.book_title||labels[post.reading_kind]||'Une Trace'));const content=el('div');content.innerHTML=BT.sharing.publicationHTML(post.reading_kind,post.reading_content,post.body);body.append(content);
      const host=el('section');body.append(host);mountInteractions(host,{post:id},post.reading_kind==='notebook'?'Cette réflexion me parle':'Encourager',focus);
      if(account===post.author_id)body.append(BT.sharing.editButton(()=>{d.close();BT.sharing.editRemotePost(post);}));
    }catch(e){p.textContent=e.message;}
  }
  function mountInteractions(host,target,likeLabel='Encourager',expanded=false){
    const account=who();if(!account){host.append(message('Connectez-vous pour encourager ou laisser une Trace.'));return;}
    host.classList.add('reader-interactions');const bar=el('div',null,'reader-actionbar'),notice=message(),details=el('div',null,'reader-traces'),list=el('div',null,'reader-trace-list');details.hidden=!expanded;details.id='reader-traces-'+crypto.randomUUID();
    const like=button('',()=>mutate(()=>api().encourage(target,state.mine,account)),'button reader-interaction-button');like.title=likeLabel;actionLabel(like,'encourage','Encourager',0);like.disabled=true;
    const trace=button('',()=>{details.hidden=!details.hidden;trace.setAttribute('aria-expanded',String(!details.hidden));},'button reader-interaction-button');actionLabel(trace,'trace','Trace',0);trace.setAttribute('aria-controls',details.id);trace.setAttribute('aria-expanded',String(expanded));bar.append(like,trace);details.append(list);
    const form=el('form',null,'form-grid'),audience=el('p','','small muted'),label=el('label','Votre Trace','field'),input=el('textarea');input.name='trace';input.maxLength=1200;input.rows=3;input.required=true;input.placeholder='Une question, une pensée, un écho à cette lecture…';label.append(input);
    const reply=el('div',null,'reader-reply'),send=el('button','Envoyer la Trace','button button--primary');send.type='submit';send.disabled=true;form.append(audience,reply,label,send);details.append(form);host.append(bar,details,notice);
    let state={rows:[],total:0,count:0,mine:null},parent=null,busy=false,loaded=false,request=0;
    const current=()=>host.isConnected&&who()===account;
    async function load(offset=0){const token=++request;try{const data=await api().thread(target,offset);if(!current()||token!==request)return;
      state={...data,rows:offset?[...state.rows,...data.rows]:data.rows};loaded=true;actionLabel(like,'encourage','Encourager',state.count);like.setAttribute('aria-pressed',String(!!state.mine));like.disabled=false;send.disabled=false;audience.textContent=state.audience;actionLabel(trace,'trace','Trace',state.total);notice.textContent='';renderRows();
    }catch(e){if(current()&&token===request){loaded=false;notice.textContent=e.message;like.disabled=send.disabled=true;list.replaceChildren();const retry=button('Réessayer',()=>{retry.remove();load();},'text-link');list.append(retry);}}}
    function renderRows(){list.replaceChildren();if(!state.rows.length)list.append(el('p','La conversation peut commencer avec vous.','small muted'));
      for(const row of state.rows){const item=el('article',null,'reader-trace');item.append(el('strong',row.author_name),el('time',new Date(row.created_at).toLocaleDateString('fr-FR'),'micro muted'));
        if(row.parent_id){const previous=state.rows.find(r=>r.id===row.parent_id);item.append(el('p',previous?'En réponse à '+previous.author_name+' : '+previous.body.slice(0,100):'En réponse à une Trace précédente','small muted'));}
        item.append(el('p',row.body,'sharing-content'));const actions=el('div',null,'reader-card-actions');actions.append(button('Répondre',()=>{parent=row.id;reply.replaceChildren(el('span','Réponse à '+row.author_name),button('Annuler',()=>{parent=null;reply.replaceChildren();},'text-link'));input.focus();},'text-link'));
        if(account===state.owner||account===row.author_id)actions.append(button('Supprimer',()=>{if(confirm('Supprimer cette Trace et ses réponses ?'))mutate(()=>api().removeTrace(target,row.id,account));},'text-link'));item.append(actions);list.append(item);}
      if(state.rows.length<state.total)list.append(button('Traces suivantes',()=>load(state.rows.length),'text-link'));
    }
    async function mutate(action,after){if(busy||!current())return;busy=true;like.disabled=send.disabled=true;notice.textContent='Enregistrement…';try{await action();if(!current())return;after?.();await load();window.dispatchEvent(new CustomEvent('boop:sharing-changed'));}catch(e){if(current())notice.textContent=e.message;}finally{busy=false;if(current())like.disabled=send.disabled=!loaded;}}
    form.onsubmit=e=>{e.preventDefault();if(!input.value.trim())return;mutate(()=>api().trace(target,input.value,parent,account),()=>{input.value='';parent=null;reply.replaceChildren();});};load();
  }
  async function editPreferences(){const account=who();if(!account)return;const {d,body}=modal('Mon profil de lecteur'),p=message();body.append(p);
    try{const prefs=await api().preferences(account);if(!d.isConnected||who()!==account)return;body.replaceChildren();const form=el('form',null,'form-grid'),label=el('label','Ma phrase d’accueil','field'),welcome=el('textarea');welcome.name='welcome';welcome.maxLength=180;welcome.rows=3;welcome.value=prefs.welcome;welcome.placeholder='En ce moment, je découvre…';label.append(welcome);form.append(label);
      const currentLabel=el('label',null,'checkbox-row'),show=el('input');show.type='checkbox';show.name='showCurrent';show.checked=prefs.show_current;currentLabel.append(show,el('span','Afficher « En ce moment, je lis… »'));form.append(currentLabel,el('p','Masquer cette section ne masque pas les livres de votre bibliothèque, qui reste accessible à vos amis.','small muted'));
      const picks=el('fieldset');picks.append(el('legend','Mes livres à découvrir · jusqu’à 6'));for(const b of BT.store.getBooks().filter(b=>b.libraryState==='library')){const l=el('label',null,'checkbox-row'),i=el('input');i.type='checkbox';i.name='featured';i.value=b.id;i.checked=prefs.featured.includes(b.id);l.append(i,el('span',b.title));picks.append(l);}form.append(picks);
      const submit=el('button','Enregistrer mon profil','button button--primary');submit.type='submit';p.textContent='';form.append(submit,p);body.append(form,button('Régler mes notifications',()=>{d.close();document.getElementById('app-dialog')?.close();location.hash='#profile?section=settings';},'text-link'));
      form.onsubmit=async e=>{e.preventDefault();const featured=[...picks.querySelectorAll('input:checked')].map(i=>i.value);if(featured.length>6){p.textContent='Choisissez au maximum six livres.';return;}submit.disabled=true;try{await api().savePreferences({welcome:welcome.value,show_current:show.checked,featured},account);if(d.isConnected&&who()===account){p.textContent='Profil enregistré.';window.dispatchEvent(new CustomEvent('boop:profile-changed'));}}catch(e){p.textContent=e.message;}finally{submit.disabled=false;}};
    }catch(e){p.textContent=e.message;}
  }
  function mount(host,userId){const account=who();profiles.set(host,account);host.closest('dialog')?.addEventListener('close',()=>profiles.delete(host),{once:true});host.classList.add('reader-profile');const welcome=el('section',null,'reader-welcome'),stats=el('div',null,'reader-stats'),nav=el('nav',null,'reader-tabs filter-chips'),area=el('section',null,'reader-content');nav.setAttribute('aria-label','Le profil de lecture');host.append(welcome,stats,nav,area);
    let tab='path',filter='all',generation=0,libraryView='shelf',finish=BT.store.getSettings().libraryFinish || 'terracotta';if(!finishes.some(([key])=>key===finish))finish='terracotta';const current=()=>host.isConnected&&account===who();
    const tabLabels=[['path','Son parcours'],['library','Bibliothèque'],['notebook','Carnets']];
    async function intro(){try{const [prefs,library,posts,notebooks]=await Promise.all([api().preferences(userId),api().books(userId),api().publications(userId),api().publications(userId,'notebook')]);if(!current())return;
      welcome.replaceChildren();if(prefs.welcome)welcome.append(el('blockquote',prefs.welcome));
      const badgeHost=host.closest('.dialog-body')?.querySelector('.profile-main>div');
      if(badgeHost && api().latestBadge)api().latestBadge(userId).then(row=>{if(!current())return;badgeHost.querySelector('.profile-badge-chip')?.remove();const badge=BT.store.getBadges().items.find(b=>b.id===row?.badge_id);if(badge)badgeHost.append(BT.badges.chip(badge));}).catch(()=>{});
      if(userId===account)welcome.append(button('Personnaliser mon profil',editPreferences,'text-link'));
      stats.replaceChildren();for(const [value,label] of [[library.available?library.finished:null,'livres terminés'],[notebooks.count,'carnets partagés'],[Math.max(0,posts.count-notebooks.count),'autres partages']]){if(value===null)continue;const s=el('div');s.append(el('strong',String(value)),el('span',label));stats.append(s);}
    }catch(e){if(current())welcome.replaceChildren(message(e.message));}}
    async function load(cursor=''){const token=++generation;if(!cursor)area.replaceChildren();nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));const pending=message();area.append(pending);
      try{
        if(!cursor&&tab==='path'){
          const [reading,featured]=await Promise.all([api().books(userId,'current'),api().books(userId,'featured')]);if(!current()||token!==generation)return;
          if(reading.available&&reading.showCurrent){area.append(el('h3','En ce moment, je lis…'));const shelf=el('div',null,'reader-current-shelf');area.append(shelf);
            if(!reading.books.length)shelf.append(el('p','Une pause entre deux lectures. Sa bibliothèque peut vous donner des idées.','small muted'));
            reading.books.slice(0,6).forEach(b=>{const c=bookCard(b,userId,true),interactions=el('section');c.append(interactions);mountInteractions(interactions,{owner:userId,book:b.id},'Bonne lecture !');shelf.append(c);});}
          if(featured.books.length){area.append(el('h3','Mes livres à découvrir'));const shelf=el('div',null,'reader-featured-shelf');featured.books.forEach(b=>shelf.append(bookCard(b,userId,true)));area.append(shelf);}
          const cards=el('section',null,'section-block');area.append(cards);BT.readingCards?.mount(cards,{owner:userId,published:true});
          area.append(el('h3','Les nouvelles de son parcours'));const l=el('label','Afficher','field reader-filter'),select=el('select');for(const [value,label] of [['all','Toutes les publications'],...Object.entries(labels).filter(([k])=>k!=='notebook')]){const o=el('option',label);o.value=value;select.append(o);}select.value=filter;select.onchange=()=>{filter=select.value;load();};l.append(select);const filters=el('details',null,'notebook-filters');filters.append(el('summary',filter==='all'?'Filtres':'Filtres · actifs'),l);area.append(filters);
        }
        if(tab==='library'){

          const result=await api().books(userId,filter,cursor);if(!current()||token!==generation)return;pending.remove();if(!result.available){area.append(message('La bibliothèque s’ouvre après acceptation de votre amitié.'));return;}
          if(!cursor){
            const tools=el('div',null,'reader-library-tools'),options=el('details',null,'notebook-filters');options.append(el('summary',filter==='all'?'Filtres':'Filtres · actifs'));
            const filters=el('div',null,'filter-chips');filters.setAttribute('aria-label','Statut de lecture');
            for(const [value,label] of [['all','Tous'],['en-cours','En cours'],['lu','Lus'],['a-lire','À lire']]){const b=button(label,()=>{filter=value;load();},'');b.setAttribute('aria-pressed',String(filter===value));filters.append(b);}options.append(filters);
            const modes=el('div',null,'filter-chips');modes.setAttribute('aria-label','Affichage de la bibliothèque');for(const [value,label] of [['shelf','Meuble'],['grid','Couvertures']]){const b=button(label,()=>{libraryView=value;load();},'');b.setAttribute('aria-pressed',String(libraryView===value));modes.append(b);}options.append(modes);tools.append(options);
            if(libraryView==='shelf'){const picker=el('details',null,'surface-color-picker'),summary=el('summary'),icon=el('span','◐');icon.setAttribute('aria-hidden','true');summary.setAttribute('aria-label','Couleur de la bibliothèque');summary.title='Couleur de la bibliothèque';summary.append(icon);picker.append(summary);const colors=el('div',null,'surface-color-picker__menu');colors.setAttribute('role','group');colors.setAttribute('aria-label','Couleur du meuble');for(const [value,label] of finishes){const b=button('',()=>{finish=value;const box=area.querySelector('.reader-bookcase');if(box)box.className='bookcase reader-bookcase bookcase--'+finish;colors.querySelectorAll('button').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));picker.open=false;},'bookcase-finish-swatch bookcase-finish-swatch--'+value);b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(finish===value));b.append(el('span'));colors.append(b);}picker.append(colors);tools.append(picker);}area.append(tools);
          }
          if(libraryView==='shelf'&&result.books.length){let box=area.querySelector('.reader-bookcase');if(!box){box=furniture(finish);area.append(box);}appendFurniture(box,result.books,userId);}else if(libraryView==='grid'){const grid=el('div',null,'reader-library-grid');result.books.forEach(b=>grid.append(bookCard(b,userId)));area.append(grid);}if(!result.books.length&&!cursor)area.append(message('Aucun livre dans ce rayon pour le moment.'));if(result.next)more(result.next);
        }else{const posts=await api().publications(userId,tab==='notebook'?'notebook':filter,Number(cursor)||0);if(!current()||token!==generation)return;pending.remove();posts.rows.forEach(p=>area.append(postCard(p)));if(!posts.rows.length&&!cursor)area.append(message(tab==='notebook'?'Les carnets partagés apparaîtront ici. Ses réflexions personnelles restent dans son espace privé.':'Pas encore de publication ici. Vous pouvez échanger autour d’une lecture en cours.'));if((Number(cursor)||0)+posts.rows.length<posts.count)more(String((Number(cursor)||0)+posts.rows.length));}
      }catch(e){if(current()&&token===generation){pending.textContent=e.message;area.append(button('Réessayer',()=>load(cursor),'text-link'));}}
    }
    function more(cursor){const b=button('Voir la suite',()=>{b.remove();load(cursor);},'text-link');area.append(b);}
    for(const [value,label] of tabLabels){const b=button(label,()=>{tab=value;filter='all';load();},'');b.dataset.tab=value;nav.append(b);}
    const update=()=>{if(current()){intro();load();}else window.removeEventListener('boop:profile-changed',update);};window.addEventListener('boop:profile-changed',update);host.closest('dialog')?.addEventListener('close',()=>window.removeEventListener('boop:profile-changed',update),{once:true});intro();load();
  }
  BT.store.subscribe(()=>{for(const [d,account] of windows)if(who()!==account)d.close();for(const [host,account] of profiles){if(!host.isConnected){profiles.delete(host);continue;}if(who()!==account){const d=host.closest('dialog');host.replaceChildren();d?.close();d?.querySelector('.dialog-body')?.replaceChildren();profiles.delete(host);}}});
  return {mount,openPublication,openBook,editPreferences,mountInteractions,cover,actionIcon};
})();

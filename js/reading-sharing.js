window.BT = window.BT || {};
BT.sharing = (() => {
  'use strict';
  const labels={notebook:'Carnet de réflexion',word:'Mot découvert',expression:'Expression',citation:'Citation',thought:'Pensée',debut:'Début de lecture',fin:'Livre terminé',session:'Moment de lecture'};
  const owner=()=>BT.auth?.isAuthenticated?.() && !BT.auth?.isGuest?.()?BT.auth.getCurrentUser()?.id:null;
  const clean=value=>String(value || '').trim();
  let composer;
  const windows=new Map();
  function source(kind,id) {
    const store=BT.store,bookKind=['notebook','debut','fin'].includes(kind);
    const item=bookKind?store.getBookById(id):kind==='session'?store.getSessions().find(t=>t.id===id):kind==='thought'?store.getTraces().find(t=>t.id===id):store.getLexicon().find(t=>t.id===id && (t.kind || 'word')===kind);
    if(!item || !labels[kind])throw new Error('Ce contenu n’est plus disponible dans votre espace personnel.');
    const book=bookKind?item:store.getBookById(item.bookId),bookTitle=book?.title || item.bookTitle || '';
    let text='',content='';
    if(kind==='notebook'){
      const r=item.reflection || {};
      content=[['Ce que je retiens',r.sections?.retained],['Ma réflexion personnelle',r.notebook],['Questions à poursuivre',r.sections?.questions]].filter(([,v])=>clean(v)).map(([h,v])=>h+'\n'+clean(v)).join('\n\n');
      text=`Certaines lectures continuent de nous accompagner. Voici ce que « ${bookTitle} » a laissé en moi.`;
    }else if(kind==='word' || kind==='expression'){
      text=kind==='word'?`Un nouveau mot rejoint mon lexique : « ${item.word} ». Je vous partage cette découverte.`:`Une expression a retenu mon attention : « ${item.word} ». Je vous la partage.`;
      content=[clean(item.word),clean(item.definition)].filter(Boolean).join('\n\n');
    }else if(kind==='citation'){
      text='Quelques mots qui résonnent encore après la lecture. Et vous, que vous évoquent-ils ?';
      content=JSON.stringify({type:'boop-citation-v1',quote:clean(item.word),author:clean(item.author || book?.authors?.join(', '))});
    }else if(kind==='thought'){
      text='Une pensée née de ma lecture, que j’ai envie de partager avec vous.';content=clean(item.text);
    }else text=kind==='session'?`Un moment de lecture avec « ${bookTitle} ». Voici ce que j’ai envie d’en partager.`:kind==='debut'?`J’ouvre « ${bookTitle} » : une nouvelle lecture commence. L’avez-vous déjà lu ?`:`Je viens de refermer « ${bookTitle} ». Une lecture de plus, et des idées qui continuent leur chemin.`;
    return {kind,sourceId:id,bookTitle,text:text.slice(0,1200),content};
  }
  function element(tag,text,className) {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
  function button(text,action,cls='button button--secondary') {const b=element('button',text,cls);b.type='button';b.onclick=action;return b;}
  function dialog(title) {
    const d=element('dialog',undefined,'app-dialog sharing-dialog'),head=element('div',undefined,'dialog-head'),h=element('h2',title);
    h.id='sharing-'+crypto.randomUUID();d.setAttribute('aria-labelledby',h.id);head.append(h,button('×',()=>d.close(),'icon-button'));
    head.lastChild.setAttribute('aria-label','Fermer');const body=element('div',undefined,'dialog-body');d.append(head,body);
    windows.set(d,owner());d.addEventListener('close',()=>{windows.delete(d);d.remove();},{once:true});document.body.append(d);d.showModal();return {d,body};
  }
  function notice(d,text){d.querySelector('[data-sharing-status]').textContent=text;}
  function field(form,label,tag,attributes={}) {
    const l=element('label',label,'field'),input=element(tag);Object.assign(input,attributes);l.append(input);form.append(l);return input;
  }
  function changed(id) {if(id)BT.store.removeCommunityPost?.(id);window.dispatchEvent(new CustomEvent('boop:sharing-changed'));}
  function citation(value){try{const data=JSON.parse(value);if(data?.type==='boop-citation-v1'&&typeof data.quote==='string')return {quote:data.quote,author:typeof data.author==='string'?data.author:''};}catch{}return {quote:String(value||''),author:''};}
  function quoteHTML(content,caption='') {const data=citation(content),escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<figure class="publication-quote"><blockquote><p>${escape(data.quote)}</p></blockquote><figcaption>${data.author?`<cite>${escape(data.author)}</cite>`:''}${caption?`<p class="publication-quote-caption">${escape(caption)}</p>`:''}</figcaption></figure>`;}
  async function open(kind,id,extraText='',allowMissing=false) {
    composer?.close();
    if(kind==='book'){
      const {d,body}=dialog('Partager ma lecture');composer=d;
      body.append(button('Je commence ce livre',()=>{d.close();open('debut',id);}),button('J’ai terminé ce livre',()=>{d.close();open('fin',id);}));return;
    }
    let original;try{original=source(kind,id);}catch(e){if(allowMissing)original={kind,sourceId:id,bookTitle:'',text:'',content:''};else{const {body}=dialog('Partage indisponible');body.append(element('p',e.message));return;}}
    if(extraText)original.content=[original.content,extraText].filter(Boolean).join('\n\n');
    const {d,body}=dialog('Préparer ma publication');composer=d;const account=owner();
    body.append(element('p',labels[kind]+(original.bookTitle?' · '+original.bookTitle:''),'eyebrow'));
    const form=element('form',undefined,'form-grid');body.append(form);
    const quote=kind==='citation'?citation(original.content):null;
    const intro=field(form,quote?'Légende personnelle · sous la citation':'Votre message · modifiable et personnel','textarea',{name:'message',rows:quote?2:4,maxLength:1200,required:true,value:original.text});
    const content=field(form,quote?'La citation':'Contenu partagé · vous pouvez le modifier','textarea',{name:'content',rows:kind==='notebook'?8:4,maxLength:100000,value:quote?quote.quote:original.content});
    let author;
    if(quote){const box=element('div',undefined,'citation-editor');author=field(form,'Auteur ou autrice','input',{name:'citationAuthor',maxLength:240,value:quote.author});box.append(content.closest('label'),author.closest('label'));form.prepend(box);intro.closest('label').classList.add('citation-legend-field');}
    if(kind==='notebook' && !original.content)body.prepend(element('p','Votre carnet enregistré est vide. Vous pouvez rédiger une version à partager ci-dessous. Les brouillons non enregistrés et les échanges avec l’IA ne sont pas repris.','small muted'));
    const audience=field(form,'Qui pourra lire cette publication ?','select',{name:'audience'});
    for(const [value,label] of [['friends','Amis uniquement'],['public','Communauté · public, même sans compte']]){const opt=element('option',label);opt.value=value;audience.append(opt);}
    form.append(element('p','Vous publiez une copie. Vos modifications ici ne changent pas votre carnet personnel. Les modifications futures de l’original ne seront pas publiées automatiquement.','small muted'));
    const preview=element('details',undefined,'sharing-preview');preview.append(element('summary','Aperçu de la publication'));
    const messagePreview=element('p'),contentPreview=element('div',undefined,'sharing-content');preview.append(messagePreview,contentPreview);form.append(preview);
    const preparedContent=()=>quote?JSON.stringify({type:'boop-citation-v1',quote:content.value,author:author.value.trim()}):content.value;
    function paint(){if(quote){messagePreview.hidden=true;contentPreview.innerHTML=quoteHTML(preparedContent(),intro.value);}else{messagePreview.textContent=intro.value;contentPreview.textContent=content.value;}}intro.oninput=content.oninput=paint;if(author)author.oninput=paint;paint();
    const status=element('p','Vérification du statut de publication…','small');status.dataset.sharingStatus='';status.setAttribute('role','status');form.append(status);
    const submit=element('button','Publier','button button--primary');submit.type='submit';submit.disabled=true;form.append(submit);
    const withdraw=button('Retirer la publication',async()=>{
      if(!existing || !confirm('Retirer cette publication ? Votre contenu personnel sera conservé.'))return;
      submit.disabled=withdraw.disabled=true;
      try{if(owner()!==account)throw new Error('Votre compte a changé.');await BT.community.withdrawReading(existing.id,account);if(!sameAccount())return;changed(existing.id);existing=null;submit.textContent='Publier';withdraw.hidden=true;notice(d,'Publication retirée. Votre contenu personnel est conservé.');}
      catch(e){notice(d,e.message);}finally{submit.disabled=withdraw.disabled=false;}
    },'text-link');withdraw.hidden=true;form.append(withdraw);
    let existing=null,busy=false;
    const sameAccount=()=>d.isConnected && owner()===account;
    if(!account){notice(d,'Connectez-vous pour publier. Cet aperçu n’est envoyé à personne.');return;}
    intro.disabled=content.disabled=audience.disabled=true;if(author)author.disabled=true;
    try{
      existing=await BT.community.getOwnReadingPublication(kind,id);if(!sameAccount())return;
      if(existing){original.bookTitle=existing.book_title;intro.value=existing.body;content.value=quote?citation(existing.reading_content).quote:existing.reading_content;if(author)author.value=citation(existing.reading_content).author;audience.value=existing.visibility==='public'?'public':'friends';submit.textContent='Mettre à jour la publication';withdraw.hidden=false;
        form.insertBefore(button('Reprendre le contenu personnel actuel',()=>{try{const saved=source(kind,id).content;content.value=quote?citation(saved).quote:saved;if(author)author.value=citation(saved).author;paint();}catch(e){notice(d,e.message);}} ,'text-link'),preview);paint();}
      notice(d,existing?'Déjà publié · '+(existing.visibility==='public'?'Public':'Amis uniquement'):'Privé · rien n’est encore publié.');submit.disabled=false;intro.disabled=content.disabled=audience.disabled=false;if(author)author.disabled=false;
    }catch(e){notice(d,e.message+' Fermez puis réessayez.');}
    form.onsubmit=async e=>{
      e.preventDefault();if(busy || submit.disabled || !sameAccount())return;
      busy=true;submit.disabled=withdraw.disabled=true;notice(d,'Publication en cours…');
      try{
        const post=await BT.community.publishReading({...original,text:intro.value,content:preparedContent(),visibility:audience.value,expectedUserId:account});
        if(!sameAccount())return;existing=post;submit.textContent='Mettre à jour la publication';withdraw.hidden=false;changed(post.id);
        notice(d,'Publication enregistrée · '+(post.visibility==='public'?'Public':'Amis uniquement')+'.');
      }catch(error){if(sameAccount())notice(d,error.message);}finally{busy=false;if(sameAccount())submit.disabled=withdraw.disabled=false;}
    };
  }
  async function view(id) {
    if(BT.readerProfile)return BT.readerProfile.openPublication(id);
    const {d,body}=dialog('Publication'),account=owner();body.append(element('p','Chargement…'));
    try{
      const post=await BT.community.getReadingPublication(id);if(!d.isConnected || owner()!==account)return;
      body.replaceChildren();if(!post){body.append(element('p','Cette publication a été retirée ou n’est plus accessible.'));changed(id);return;}
      body.append(element('p',post.author_name,'eyebrow'),element('h3',post.book_title || labels[post.reading_kind]),element('p',post.body,'sharing-content'),element('div',post.reading_content,'sharing-content'));
      if(post.reading_kind==='citation'){body.querySelectorAll('.sharing-content').forEach(n=>n.remove());const quote=element('div');quote.innerHTML=quoteHTML(post.reading_content,post.body);body.append(quote);}
      if(account===post.author_id)body.append(button('Modifier ou retirer',()=>{d.close();open(post.reading_kind,post.reading_source_id,'',true);}));
    }catch(e){body.replaceChildren(element('p',e.message));}
  }
  function mountReader(host,userId) {
    if(BT.readerProfile)return BT.readerProfile.mount(host,userId);
    const account=owner(),nav=element('div',undefined,'filter-chips reader-tabs'),area=element('section',undefined,'reader-content');host.append(nav,area);let request=0;
    const tabs=[['library','Bibliothèque'],['notebook','Carnets publiés'],['publications','Publications']];
    async function load(tab,cursor='') {
      const generation=++request;if(!cursor)area.replaceChildren();
      nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
      const message=element('p','Chargement…','small muted');message.setAttribute('role','status');area.append(message);
      try{
        const result=tab==='library'?await BT.community.getReaderLibrary(userId,cursor):await BT.community.listReaderPublications(userId,tab,Number(cursor)||0);
        if(!host.isConnected || request!==generation || owner()!==account)return;message.remove();
        if(tab==='library'){
          if(!result.available){area.replaceChildren(element('p','La bibliothèque est accessible après acceptation de votre demande d’amitié.','small muted'));return;}
          if(!cursor)area.append(element('p','Titres, auteurs et statuts de lecture · les notes personnelles restent privées.','small muted'));
          for(const b of result.books){const card=element('article',undefined,'card reader-book');card.append(element('h3',b.title),element('p',b.authors.join(', '),'muted'),element('span',({'a-lire':'À lire','en-cours':'En cours','en-pause':'En pause',lu:'Lu',abandonne:'Abandonné'})[b.status] || 'À lire','status-chip'));area.append(card);}
          if(!result.books.length && !cursor)area.append(element('p','Aucun livre synchronisé dans cette bibliothèque pour le moment.'));
          if(result.next)more(tab,result.next);
        }else{
          for(const p of result){const card=element('article',undefined,'card reader-publication');card.append(element('span',labels[p.reading_kind],'eyebrow'),element('h3',p.book_title || labels[p.reading_kind]),element('p',p.body),button('Lire la publication',()=>view(p.id),'text-link'));area.append(card);}
          if(!result.length && !cursor)area.append(element('p','Aucune publication accessible dans cette section.','small muted'));
          if(result.length===24)more(tab,(Number(cursor)||0)+24);
        }
      }catch(e){if(request===generation && host.isConnected){message.textContent=e.message;area.append(button('Réessayer',()=>load(tab,cursor),'text-link'));}}
    }
    function more(tab,cursor){const b=button('Voir la suite',()=>{b.remove();load(tab,cursor);},'text-link');area.append(b);}
    for(const [value,label] of tabs){const b=button(label,()=>load(value),'');b.dataset.tab=value;nav.append(b);}load('library');
  }
  window.addEventListener('pagehide',()=>composer?.close());
  BT.store?.subscribe(()=>{for(const [d,account] of windows)if(d.open && owner()!==account)d.close();});
  return {source,open,view,mountReader,labels,citation,quoteHTML};
})();

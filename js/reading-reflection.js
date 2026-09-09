window.BT = window.BT || {};
BT.reflection = (() => {
  let dialog, book, state, owner, busy=false, aborter, recognition;
  const consented = new Set();
  function ambiance(target) {
    const themes={night:['Bleu nuit','#101e2b'],forest:['Forêt','#142620'],plum:['Prune','#292032'],paper:['Papier','#f2ede3']};
    const picker=document.createElement('details');picker.className='surface-color-picker reflection-color-picker';
    const summary=document.createElement('summary');summary.setAttribute('aria-label','Personnaliser la couleur du fond');summary.title='Personnaliser la couleur du fond';summary.innerHTML='<span aria-hidden="true">◐</span>';picker.append(summary);
    const choices=document.createElement('div');choices.className='surface-color-picker__menu';choices.setAttribute('role','group');choices.setAttribute('aria-label','Couleur du fond');
    for(const [value,[label,color]] of Object.entries(themes)){
      const choice=button('',()=>{const key=target.dataset.panel==='notebook'?'notebookTheme':'reflectionTheme';BT.store.saveSettings({[key]:value});setTheme(target);},'bookcase-finish-swatch');
      choice.dataset.theme=value;choice.setAttribute('aria-label',label);choice.title=label;const dot=document.createElement('span');dot.style.background=color;choice.append(dot);choices.append(choice);
    }
    picker.append(choices);(target.querySelector('.reflection-toolbar') || target.querySelector('.dialog-head')).append(picker);setTheme(target);
  }
  function setTheme(target) {
    const notebook=target.dataset.panel==='notebook',settings=BT.store.getSettings();
    const value=settings[notebook?'notebookTheme':'reflectionTheme'] || (notebook?'paper':'night');
    target.dataset.ambiance=['night','forest','plum','paper'].includes(value)?value:'paper';
    target.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===target.dataset.ambiance)));
  }
  const $=s=>dialog.querySelector(s);
  const identity=()=>BT.auth?.getCurrentUser?.()?.id;
  const empty=()=>({messages:[],draft:'',notebook:'',versions:[],usage:[]});
  const status=t=>{if(dialog?.open)$('[data-status]').textContent=t;};
  function save() {
    if(identity()!==owner || !BT.store.getBookById(book.id))return false;
    const ok=BT.store.saveBookReflection(book.id,state);if(!ok)status('Enregistrement impossible sur cet appareil. Votre texte reste dans l’éditeur : copiez-le ou exportez-le avant de fermer.');return ok;
  }
  function button(text,fn,cls='button button--secondary') {const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.onclick=fn;return b;}
  function decorate(view) {
    if(view.querySelector('[data-reflection-entry]'))return;
    const params=new URLSearchParams(location.hash.split('?')[1]);
    const fromNotebook=params.get('tab')==='notebook',label=fromNotebook?'Ouvrir mon carnet':'Ouvrir la réflexion',initial=fromNotebook?'notebook':'chat';
    let id=null,row=view.querySelector('.book-detail-copy > .button-row:last-child');
    if(row)id=params.get('id');
    if(!row && view.querySelector('.session-view')){row=view.querySelector('.session-book');id=BT.store.getActiveSession()?.bookId;}
    if(!row && ['notebook','lexicon'].includes(params.get('tab'))){
      row=view.querySelector('[data-reflection-host]') || view.querySelector('.lexicon-view');id=params.get('book');
    }
    if(!row)return;
    const entry=document.createElement('div');entry.dataset.reflectionEntry='';entry.className='button-row reflection-entry';
    if(id)entry.append(button(label,()=>open(id,initial)));
    else {
      const label=document.createElement('label');label.textContent=fromNotebook?'Mon carnet pour ce livre':'Réfléchir à un livre ';const select=document.createElement('select');select.setAttribute('aria-label','Livre à explorer');
      BT.store.getBooks().filter(b=>b.libraryState==='library').forEach(b=>{const opt=document.createElement('option');opt.value=b.id;opt.textContent=b.title;select.append(opt);});label.append(select);entry.append(label,button(fromNotebook?'Ouvrir mon carnet':'Ouvrir la réflexion',()=>{if(select.value)open(select.value,initial);}));
    }
    if(row.matches('.session-book'))row.after(entry);else if(row.matches('.lexicon-view'))row.prepend(entry);else row.append(entry);
    view.querySelectorAll('[data-open-reflection]').forEach(b=>{b.onclick=()=>open(b.dataset.openReflection,b.dataset.reflectionTab || 'chat');});
  }
  async function api(body) {
    const {data,error}=await BT.auth.getClient().auth.getSession();
    if(error || !data.session?.access_token)throw new Error('Reconnectez-vous à BOO-P.');
    const config=window.BOOP_SUPABASE_CONFIG;
    const res=await fetch(`${config.url}/functions/v1/reading-chat`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body),signal:aborter.signal});
    const result=await res.json();if(!res.ok)throw new Error(result.error || 'Service indisponible.');return result;
  }
  function tab(name) {
    dialog.dataset.panel=name;setTheme(dialog);
    $('[data-consent-box]').hidden=name==='notebook' || consented.has(owner);
    $('[data-about]').hidden=name==='notebook';
    $('#reflection-title').textContent=name==='notebook'?'Mon carnet de réflexion':book.title;
    dialog.querySelector('.dialog-head .eyebrow').textContent=name==='notebook'?'BOO-P · Chaque lecture laisse une trace':'Un moment pour réfléchir';
    if(name==='notebook')status('');
    $('[data-chat]').hidden=name!=='chat';$('[data-notebook]').hidden=name!=='notebook';
    $('[data-tab-chat]').setAttribute('aria-pressed',String(name==='chat'));$('[data-tab-notebook]').setAttribute('aria-pressed',String(name==='notebook'));
  }
  function paint() {
    const list=$('[data-messages]');list.replaceChildren();
    state.messages.forEach(m=>{const li=document.createElement('li');li.className=`reflection-message reflection-message--${m.role}`;const label=document.createElement('strong');label.textContent=m.role==='user'?'Vous':'IA · OpenAI';const p=document.createElement('p');p.textContent=m.content;li.append(label,p);list.append(li);});
    if(!state.messages.length){const p=document.createElement('p');p.className='muted';p.textContent='Qu’est-ce qui vous a marqué dans cette lecture ? Une impression, un désaccord ou une question suffit pour commencer.';list.append(p);}
    list.scrollTop=list.scrollHeight;
    $('[data-proposal]').open=Boolean(state.draft);
    $('[data-proposal]').hidden=!state.draft;
    $('.notebook-history').hidden=!state.versions.length;
    $('[data-draft]').value=state.draft || '';$('[data-notebook-text]').value=state.edit ?? state.notebook ?? '';
    $('[data-retained]').value=state.sectionDraft?.retained ?? state.sections?.retained ?? '';
    $('[data-questions]').value=state.sectionDraft?.questions ?? state.sections?.questions ?? '';
    renderNotebook();
    const history=$('[data-versions]');history.replaceChildren();
    state.versions.forEach(v=>{const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');s.textContent=new Date(v.at).toLocaleString('fr-FR');p.textContent=v.text;d.append(s,p);history.append(d);});
    const totals=state.usage.reduce((a,u)=>({input:a.input+(u?.input_tokens || 0),output:a.output+(u?.output_tokens || 0)}),{input:0,output:0});
    $('[data-usage]').textContent=state.usage.length?`Mesures texte reçues : ${totals.input} tokens en entrée · ${totals.output} en sortie. Audio Realtime compté séparément.`:'Aucune mesure texte reçue.';
  }
  function renderNotebook() {
    $('[data-book-title]').textContent=book.title;$('[data-book-author]').textContent=book.authors.join(', ');
    const cover=$('[data-book-cover]');
    cover.onerror=()=>{cover.hidden=true;};
    if(book.coverUrl && /^(https?:|data:image\/)/.test(book.coverUrl)){if(cover.getAttribute('src')!==book.coverUrl)cover.src=book.coverUrl;cover.hidden=!cover.complete || !cover.naturalWidth;}else cover.hidden=true;
    cover.onload=()=>{cover.hidden=false;};
    const sections=[['retained','Ce que je retiens','Une idée essentielle à garder.'],['personal','Ma réflexion personnelle','Écrivez ici librement, même sans échanger avec l’IA.'],['questions','Questions à poursuivre','Les questions que cette lecture laisse ouvertes.']];
    const list=$('[data-notebook-sections]');list.replaceChildren();
    for(const [key,title,hint] of sections){const area=document.createElement('section');area.className='notebook-reading-section';const heading=document.createElement('div');heading.className='notebook-section-heading';const h=document.createElement('h3');h.textContent=title;heading.append(h,button('Modifier',()=>editNotebook(key),'text-link'));const text=document.createElement('p');text.textContent=key==='personal'?state.notebook || hint:state.sections?.[key] || hint;if((key==='personal'?!state.notebook:!state.sections?.[key]))text.className='muted';area.append(heading,text);list.append(area);}
    $('[data-notebook-badge]').textContent=state.edit!==undefined || state.sectionDraft?'Brouillon personnel à enregistrer':state.notebook || state.sections?.retained || state.sections?.questions?'Carnet personnel':'Brouillon personnel';
    $('[data-resume-draft]').hidden=state.edit===undefined && !state.sectionDraft;
  }
  function editNotebook(section='personal') {
    $('[data-editor]').hidden=false;$('[data-notebook-reading]').hidden=true;$('[data-notebook-footer]').hidden=true;
    const field=section==='retained'?$('[data-retained]'):section==='questions'?$('[data-questions]'):$('[data-notebook-text]');field.focus();
  }
  function readNotebook() {$('[data-editor]').hidden=true;$('[data-notebook-reading]').hidden=false;$('[data-notebook-footer]').hidden=false;renderNotebook();$('[data-notebook]').scrollTop=0;}
  function saveNotebook() {
    const before=structuredClone(state),text=$('[data-notebook-text]').value;
    if(state.notebook && (text!==state.notebook || state.sectionDraft))state.versions.unshift({at:new Date().toISOString(),text:exportText()});
    state.notebook=text;state.sections={retained:$('[data-retained]').value,questions:$('[data-questions]').value};state.versions=state.versions.slice(0,20);state.savedAt=new Date().toISOString();delete state.edit;delete state.sectionDraft;
    if(!save()){state=before;return;}
    paint();readNotebook();status('Carnet enregistré sur cet appareil.');
  }
  function exportText(draft=false) {return [['Ce que je retiens',draft?$('[data-retained]').value:state.sections?.retained],['Ma réflexion personnelle',draft?$('[data-notebook-text]').value:state.notebook],['Questions à poursuivre',draft?$('[data-questions]').value:state.sections?.questions]].filter(([,v])=>v).map(([h,v])=>h+'\n'+v).join('\n\n');}
  function viewport() {if(dialog?.open){dialog.style.setProperty('--reflection-height',`${window.visualViewport?.height || innerHeight}px`);dialog.style.setProperty('--reflection-top',`${window.visualViewport?.offsetTop || 0}px`);}}
  function close() {aborter?.abort();recognition?.abort();recognition=null;busy=false;dialog?.close();document.body.classList.remove('reflection-open');}
  async function open(id,initial='chat') {
    close();book=BT.store.getBookById(id);if(!book)return;
    owner=identity();state={...empty(),...(book.reflection || {})};aborter=new AbortController();const current=aborter;
    dialog?.remove();dialog=document.createElement('dialog');dialog.className='app-dialog reflection-dialog';dialog.setAttribute('aria-labelledby','reflection-title');
    dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">Un moment pour réfléchir</p><h2 id="reflection-title"></h2></div><button type="button" class="icon-button" data-close aria-label="Fermer">×</button></div><div class="dialog-body"><div class="reflection-toolbar"><div class="reflection-tabs"><button type="button" data-tab-chat>Conversation</button><button type="button" data-tab-notebook>Mon carnet</button></div><details class="reflection-about" data-about><summary>À propos</summary><div><p>Vous échangez avec une IA OpenAI, qui peut se tromper. Vos messages, le titre du livre et votre progression lui sont transmis. Le carnet suit la synchronisation privée de votre bibliothèque.</p><p>La dictée prépare un texte à corriger avant envoi ; elle peut utiliser un service distant du navigateur.</p><details><summary>Consommation du test</summary><p data-usage></p><p>50 demandes texte par jour. La synthèse compte comme une demande. La voix Realtime est facturée séparément.</p></details></div></details></div><div class="reflection-consent" data-consent-box><label class="checkbox-row"><input type="checkbox" data-consent> Je suis majeur et j’accepte ce test avec OpenAI.</label></div><p role="status" data-status>Connexion…</p><section data-chat><div class="reflection-mode" aria-label="Mode de conversation"><span aria-current="true">Texte</span><button type="button" data-voice>Voix</button></div><ol data-messages class="reflection-messages" aria-label="Conversation"></ol><div class="reflection-composer"><label class="sr-only" for="reflection-input">Votre message</label><textarea id="reflection-input" data-input maxlength="6000" rows="2" placeholder="Laissez venir votre pensée…"></textarea><div class="reflection-composer-actions"><button type="button" class="text-link" data-dictate>Dicter</button><button type="button" class="button button--primary" data-send disabled>Envoyer ↑</button></div></div><button type="button" class="text-link reflection-compose" data-compose disabled>Garder une trace de cet échange</button></section><section data-notebook hidden><div class="notebook-book-heading"><img data-book-cover alt="Couverture du livre"><div><h2 data-book-title></h2><p data-book-author></p><span class="notebook-badge" data-notebook-badge>Brouillon personnel</span></div></div><details class="reflection-proposal" data-proposal><summary>Proposition de l’IA · à relire</summary><textarea id="reflection-draft" data-draft rows="8" aria-label="Proposition de l’IA"></textarea><button type="button" class="button button--secondary" data-accept>Ajouter au carnet</button></details><div data-notebook-reading><button type="button" class="text-link" data-resume-draft hidden>Reprendre mon brouillon</button><div data-notebook-sections></div></div><div data-editor hidden><p class="notebook-editor-intro">Écriture libre · aucun échange avec l’IA nécessaire</p><label class="field">Ma réflexion personnelle<textarea data-notebook-text rows="10" maxlength="60000" placeholder="Collez votre texte ou écrivez ce que cette lecture vous inspire…"></textarea></label><label class="field">Ce que je retiens · facultatif<textarea data-retained rows="3" maxlength="12000"></textarea></label><label class="field">Questions à poursuivre · facultatif<textarea data-questions rows="3" maxlength="12000"></textarea></label><div class="notebook-save-bar"><button type="button" class="button button--primary" data-save>Enregistrer mon texte</button><button type="button" class="text-link" data-read>Revenir au carnet</button><button type="button" class="text-link" data-editor-export>Exporter mon brouillon</button></div><button type="button" class="text-link" data-deepen>Approfondir le passage sélectionné</button></div><div class="notebook-footer" data-notebook-footer><button type="button" class="button button--secondary" data-free-write>Écrire librement</button><button type="button" class="button button--primary" data-continue>Continuer ma réflexion avec l’IA</button><details class="reflection-notebook-tools"><summary>Exporter</summary><div class="button-row"><button type="button" class="text-link" data-export>Texte</button><button type="button" class="text-link" data-print>Imprimer / PDF</button></div></details></div><details class="notebook-history"><summary>Versions précédentes</summary><div data-versions class="reflection-versions"></div></details></section></div>`;
    document.body.append(dialog);$('#reflection-title').textContent=book.title;ambiance(dialog);dialog.showModal();document.body.classList.add('reflection-open');viewport();paint();tab(initial);$('[data-consent]').checked=consented.has(owner);$('[data-consent-box]').hidden=initial==='notebook' || consented.has(owner);$('[data-about]').open=false;
    $('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    $('[data-tab-chat]').onclick=()=>{tab('chat');ensureAccess();};$('[data-tab-notebook]').onclick=()=>tab('notebook');
    $('[data-send]').onclick=()=>generate('chat');$('[data-compose]').onclick=()=>generate('compose');
    $('[data-input]').value=state.input || '';$('[data-input]').oninput=()=>{state.input=$('[data-input]').value;save();};
    $('[data-draft]').oninput=()=>{state.draft=$('[data-draft]').value;save();};
    $('[data-notebook-text]').oninput=()=>{state.edit=$('[data-notebook-text]').value;save();};
    if(state.edit!==undefined)$('[data-notebook-text]').value=state.edit;
    $('[data-save]').onclick=saveNotebook;
    $('[data-free-write]').onclick=()=>editNotebook();$('[data-resume-draft]').onclick=()=>editNotebook();$('[data-read]').onclick=readNotebook;
    for(const field of ['[data-retained]','[data-questions]'])$(field).oninput=()=>{state.sectionDraft={retained:$('[data-retained]').value,questions:$('[data-questions]').value};save();};
    $('[data-accept]').onclick=()=>{const text=$('[data-draft]').value.trim();if(!text)return;const before=structuredClone(state);if(state.notebook)state.versions.unshift({at:new Date().toISOString(),text:exportText()});state.notebook=[$('[data-notebook-text]').value,text].filter(Boolean).join('\n\n');state.draft='';delete state.edit;state.versions=state.versions.slice(0,20);if(!save()){state=before;return;}paint();status('Proposition ajoutée. Vous pouvez encore modifier votre carnet.');};
    $('[data-continue]').onclick=()=>{tab('chat');ensureAccess();$('[data-input]').focus();};
    $('[data-deepen]').onclick=()=>{const area=$('[data-notebook-text]'),text=area.value.slice(area.selectionStart,area.selectionEnd).trim();if(!text){status('Sélectionnez un passage de votre carnet à approfondir.');return;}tab('chat');ensureAccess();$('[data-input]').value=`J’aimerais approfondir cette idée : ${text}`;$('[data-input]').focus();};
    $('[data-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([`BOO-P · Carnet de réflexion\n${book.title}\n${book.authors.join(', ')}\n\n${exportText(!$('[data-editor]').hidden)}`],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='boop-carnet-reflexion.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    $('[data-editor-export]').onclick=()=> $('[data-export]').click();
    $('[data-print]').onclick=print;
    $('[data-voice]').onclick=()=>{const id=book.id;close();BT.voice?.open(id);};
    $('[data-dictate]').onclick=dictate;
    const supported=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!supported){$('[data-dictate]').disabled=true;$('[data-dictate]').textContent='Utilisez la dictée de votre clavier';}
    if(initial==='chat')await ensureAccess();
  }
  async function ensureAccess() {
    const current=aborter;
    try {
      if(BT.auth.isGuest() || !BT.auth.isAuthenticated())throw new Error('Connectez-vous au compte adulte autorisé pour tester l’IA.');
      const access=await api({action:'status'});if(current!==aborter || current.signal.aborted)return;
      if(!access.ready)throw new Error('La clé OPENAI_API_KEY manque dans les secrets Supabase.');
      const toggle=()=>{if($('[data-consent]').checked){consented.add(owner);$('[data-consent-box]').hidden=true;$('[data-about]').open=false;status('');}const disabled=!$('[data-consent]').checked || busy;$('[data-send]').disabled=disabled;$('[data-compose]').disabled=disabled;};$('[data-consent]').onchange=toggle;
      toggle();if(dialog.dataset.panel==='chat')status(consented.has(owner)?'':'Confirmez le test pour commencer.');
    } catch(e){if(!current.signal.aborted && dialog.dataset.panel==='chat')status(e.message);}
  }
  async function generate(action) {
    if(busy || !$('[data-consent]').checked)return;
    const message=$('[data-input]').value.trim();if(action==='chat' && !message)return;
    if(action==='compose' && !state.messages.length){status('Échangez d’abord avec l’IA pour alimenter votre carnet.');return;}
    recognition?.stop();const messages=action==='chat'?[...state.messages,{role:'user',content:message}]:state.messages;
    const current=aborter;busy=true;$('[data-send]').disabled=true;$('[data-compose]').disabled=true;status(action==='compose'?'Composition du brouillon…':'L’IA réfléchit à votre message…');
    $('[data-input]').disabled=true;$('[data-dictate]').disabled=true;
    try {
      const result=await api({action,adultConsent:true,messages,book:{title:book.title,authors:book.authors.join(', '),position:book.mediaType==='audio'?`minute ${book.currentMinute}`:`page ${book.currentPage}`,finished:book.status==='lu'}});
      if(current!==aborter || current.signal.aborted || identity()!==owner)return;
      if(result.usage)state.usage.push(result.usage);
      if(action==='chat'){state.messages=[...messages,{role:'assistant',content:result.text}];state.input='';$('[data-input]').value='';}else{state.draft=result.text;tab('notebook');$('[data-proposal]').open=true;}
      const persisted=save();paint();if(state.edit!==undefined)$('[data-notebook-text]').value=state.edit;if(!persisted)return;
      status(result.incomplete?'Réponse partielle reçue : la limite de sortie a été atteinte.':'');
    }catch(e){if(!current.signal.aborted)status(e.message);}
    finally{if(current===aborter && !current.signal.aborted){busy=false;$('[data-input]').disabled=false;$('[data-dictate]').disabled=!(window.SpeechRecognition || window.webkitSpeechRecognition);$('[data-send]').disabled=!$('[data-consent]').checked;$('[data-compose]').disabled=!$('[data-consent]').checked;}}
  }
  function dictate() {
    if(recognition){recognition.stop();return;}
    const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;if(!Recognition)return;
    const r=new Recognition();recognition=r;r.lang='fr-FR';r.continuous=true;r.interimResults=false;const input=$('[data-input]');
    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)input.value=(input.value+' '+e.results[i][0].transcript).trim().slice(0,6000);state.input=input.value;save();};
    r.onend=()=>{recognition=null;if(dialog.open)$('[data-dictate]').textContent='Dicter';};r.onerror=()=>status('Dictée indisponible. Vous pouvez écrire ou utiliser le micro du clavier.');
    try{r.start();$('[data-dictate]').textContent='Arrêter la dictée';}catch{recognition=null;status('Impossible de démarrer la dictée.');}
  }
  function print() {
    const win=window.open('','_blank');if(!win){status('Autorisez l’ouverture de la fenêtre d’impression.');return;}
    const d=win.document;d.title=`BOO-P — ${book.title}`;const style=d.createElement('style');style.textContent='@page{size:A4;margin:22mm}body{font:12pt/1.6 Georgia,serif;color:#142438;max-width:170mm;margin:20px auto}header{color:#547460;font:12pt Arial}h1{font-size:30pt;line-height:1.15}main{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:30px;font:10pt Arial;color:#547460}';d.head.append(style);
    for(const [tag,text] of [['header','BOO-P · Carnet de réflexion'],['h1',book.title],['p',book.authors.join(', ')],['main',exportText(!$('[data-editor]').hidden)],['footer','Carnet personnel · '+new Date().toLocaleDateString('fr-FR')]]){const el=d.createElement(tag);el.textContent=text;d.body.append(el);}win.print();
  }
  function importVoice(id,messages) {
    const target=BT.store.getBookById(id);if(!target)return;
    const reflection={...empty(),...(target.reflection || {})};reflection.messages.push(...messages.map(m=>({role:m.role,content:m.text})));BT.store.updateBook(id,{reflection});open(id);
  }
  window.addEventListener('pagehide',close);
  window.visualViewport?.addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('scroll',viewport);
  BT.store?.subscribe(()=>{if(dialog?.open && (identity()!==owner || !BT.store.getBookById(book.id)))close();});
  return {decorate,open,importVoice,ambiance};
})();

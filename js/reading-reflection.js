window.BT = window.BT || {};
BT.reflection = (() => {
  let dialog, book, state, owner, busy=false, aborter, recognition;
  const consented = new Set();
  function ambiance(target) {
    const themes={night:'Bleu nuit',forest:'Forêt',plum:'Prune',paper:'Papier'};
    const current=BT.store.getSettings().reflectionTheme;
    target.dataset.ambiance=Object.hasOwn(themes,current)?current:'night';
    const picker=document.createElement('details');picker.className='reflection-ambiance';
    const summary=document.createElement('summary');summary.textContent='Ambiance';picker.append(summary);
    const choices=document.createElement('div');choices.setAttribute('role','group');choices.setAttribute('aria-label','Couleur de fond');
    for(const [value,label] of Object.entries(themes)){
      const choice=button(label,()=>{target.dataset.ambiance=value;BT.store.saveSettings({reflectionTheme:value});choices.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===value)));});
      choice.dataset.theme=value;choice.setAttribute('aria-pressed',String(value===target.dataset.ambiance));choices.append(choice);
    }
    picker.append(choices);(target.querySelector('.reflection-toolbar') || target.querySelector('.dialog-head')).append(picker);
  }
  const $=s=>dialog.querySelector(s);
  const identity=()=>BT.auth?.getCurrentUser?.()?.id;
  const empty=()=>({messages:[],draft:'',notebook:'',versions:[],usage:[]});
  const status=t=>{if(dialog?.open)$('[data-status]').textContent=t;};
  function save() {
    if(identity()!==owner || !BT.store.getBookById(book.id))return false;
    BT.store.updateBook(book.id,{reflection:state});return true;
  }
  function button(text,fn,cls='button button--secondary') {const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.onclick=fn;return b;}
  function decorate(view) {
    if(view.querySelector('[data-reflection-entry]'))return;
    const params=new URLSearchParams(location.hash.split('?')[1]);
    let id=null,row=view.querySelector('.book-detail-copy > .button-row:last-child');
    if(row)id=params.get('id');
    if(!row && view.querySelector('.session-view')){row=view.querySelector('.session-book');id=BT.store.getActiveSession()?.bookId;}
    if(!row && ['notebook','lexicon'].includes(params.get('tab'))){
      row=view.querySelector('[data-reflection-host]') || view.querySelector('.lexicon-view');id=params.get('book');
    }
    if(!row)return;
    const entry=document.createElement('div');entry.dataset.reflectionEntry='';entry.className='button-row reflection-entry';
    if(id)entry.append(button('Ouvrir la réflexion',()=>open(id)));
    else {
      const label=document.createElement('label');label.textContent='Réfléchir à un livre ';const select=document.createElement('select');select.setAttribute('aria-label','Livre à explorer');
      BT.store.getBooks().filter(b=>b.libraryState==='library').forEach(b=>{const opt=document.createElement('option');opt.value=b.id;opt.textContent=b.title;select.append(opt);});label.append(select);entry.append(label,button('Ouvrir la réflexion',()=>{if(select.value)open(select.value);}));
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
    dialog.dataset.panel=name;
    $('[data-chat]').hidden=name!=='chat';$('[data-notebook]').hidden=name!=='notebook';
    $('[data-tab-chat]').setAttribute('aria-pressed',String(name==='chat'));$('[data-tab-notebook]').setAttribute('aria-pressed',String(name==='notebook'));
  }
  function paint() {
    const list=$('[data-messages]');list.replaceChildren();
    state.messages.forEach(m=>{const li=document.createElement('li');li.className=`reflection-message reflection-message--${m.role}`;const label=document.createElement('strong');label.textContent=m.role==='user'?'Vous':'IA · OpenAI';const p=document.createElement('p');p.textContent=m.content;li.append(label,p);list.append(li);});
    if(!state.messages.length){const p=document.createElement('p');p.className='muted';p.textContent='Qu’est-ce qui vous a marqué dans cette lecture ? Une impression, un désaccord ou une question suffit pour commencer.';list.append(p);}
    list.scrollTop=list.scrollHeight;
    $('[data-proposal]').open=Boolean(state.draft);
    $('[data-draft]').value=state.draft || '';$('[data-notebook-text]').value=state.notebook || '';
    const history=$('[data-versions]');history.replaceChildren();
    state.versions.forEach(v=>{const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');s.textContent=new Date(v.at).toLocaleString('fr-FR');p.textContent=v.text;d.append(s,p);history.append(d);});
    const totals=state.usage.reduce((a,u)=>({input:a.input+(u?.input_tokens || 0),output:a.output+(u?.output_tokens || 0)}),{input:0,output:0});
    $('[data-usage]').textContent=state.usage.length?`Mesures texte reçues : ${totals.input} tokens en entrée · ${totals.output} en sortie. Audio Realtime compté séparément.`:'Aucune mesure texte reçue.';
  }
  function viewport() {if(dialog?.open){dialog.style.setProperty('--reflection-height',`${window.visualViewport?.height || innerHeight}px`);dialog.style.setProperty('--reflection-top',`${window.visualViewport?.offsetTop || 0}px`);}}
  function close() {aborter?.abort();recognition?.abort();recognition=null;busy=false;dialog?.close();document.body.classList.remove('reflection-open');}
  async function open(id,initial='chat') {
    close();book=BT.store.getBookById(id);if(!book)return;
    owner=identity();state={...empty(),...(book.reflection || {})};aborter=new AbortController();const current=aborter;
    dialog?.remove();dialog=document.createElement('dialog');dialog.className='app-dialog reflection-dialog';dialog.setAttribute('aria-labelledby','reflection-title');
    dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">Un moment pour réfléchir</p><h2 id="reflection-title"></h2></div><button type="button" class="icon-button" data-close aria-label="Fermer">×</button></div><div class="dialog-body"><div class="reflection-toolbar"><div class="reflection-tabs"><button type="button" data-tab-chat>Conversation</button><button type="button" data-tab-notebook>Mon carnet</button></div><details class="reflection-about" data-about><summary>À propos</summary><div><p>Vous échangez avec une IA OpenAI, qui peut se tromper. Vos messages, le titre du livre et votre progression lui sont transmis. Le carnet suit la synchronisation privée de votre bibliothèque.</p><p>La dictée prépare un texte à corriger avant envoi ; elle peut utiliser un service distant du navigateur.</p><details><summary>Consommation du test</summary><p data-usage></p><p>50 demandes texte par jour. La synthèse compte comme une demande. La voix Realtime est facturée séparément.</p></details></div></details></div><div class="reflection-consent" data-consent-box><label class="checkbox-row"><input type="checkbox" data-consent> Je suis majeur et j’accepte ce test avec OpenAI.</label></div><p role="status" data-status>Connexion…</p><section data-chat><div class="reflection-mode" aria-label="Mode de conversation"><span aria-current="true">Texte</span><button type="button" data-voice>Voix</button></div><ol data-messages class="reflection-messages" aria-label="Conversation"></ol><div class="reflection-composer"><label class="sr-only" for="reflection-input">Votre message</label><textarea id="reflection-input" data-input maxlength="6000" rows="2" placeholder="Laissez venir votre pensée…"></textarea><div class="reflection-composer-actions"><button type="button" class="text-link" data-dictate>Dicter</button><button type="button" class="button button--primary" data-send disabled>Envoyer ↑</button></div></div><button type="button" class="text-link reflection-compose" data-compose disabled>Garder une trace de cet échange</button></section><section data-notebook hidden><details class="reflection-proposal" data-proposal><summary>Proposition de l’IA · à relire</summary><label class="sr-only" for="reflection-draft">Proposition de l’IA</label><textarea id="reflection-draft" data-draft rows="8"></textarea><button type="button" class="button button--secondary" data-accept>Ajouter au carnet</button></details><label class="field">Mon carnet<textarea data-notebook-text rows="10" placeholder="Vos échanges prendront forme ici…"></textarea></label><div class="button-row"><button type="button" class="button button--primary" data-save>Enregistrer</button><button type="button" class="text-link" data-continue>Continuer ma réflexion</button></div><details class="reflection-notebook-tools"><summary>Approfondir, exporter et retrouver mes versions</summary><button type="button" class="text-link" data-deepen>Approfondir le passage sélectionné</button><div class="button-row"><button type="button" class="text-link" data-export>Exporter le texte</button><button type="button" class="text-link" data-print>Imprimer / PDF</button></div><details><summary>Versions précédentes</summary><div data-versions class="reflection-versions"></div></details></details></section></div>`;
    document.body.append(dialog);$('#reflection-title').textContent=book.title;ambiance(dialog);dialog.showModal();document.body.classList.add('reflection-open');viewport();paint();tab(initial);$('[data-consent]').checked=consented.has(owner);$('[data-consent-box]').hidden=consented.has(owner);$('[data-about]').open=false;
    $('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    $('[data-tab-chat]').onclick=()=>tab('chat');$('[data-tab-notebook]').onclick=()=>tab('notebook');
    $('[data-send]').onclick=()=>generate('chat');$('[data-compose]').onclick=()=>generate('compose');
    $('[data-input]').value=state.input || '';$('[data-input]').oninput=()=>{state.input=$('[data-input]').value;save();};
    $('[data-draft]').oninput=()=>{state.draft=$('[data-draft]').value;save();};
    $('[data-notebook-text]').oninput=()=>{state.edit=$('[data-notebook-text]').value;save();};
    if(state.edit!==undefined)$('[data-notebook-text]').value=state.edit;
    $('[data-save]').onclick=()=>{const text=$('[data-notebook-text]').value;if(state.notebook && text!==state.notebook)state.versions.unshift({at:new Date().toISOString(),text:state.notebook});state.notebook=text;state.versions=state.versions.slice(0,20);delete state.edit;save();paint();status('Carnet enregistré.');};
    $('[data-accept]').onclick=()=>{const text=$('[data-draft]').value.trim();if(!text)return;if(state.notebook)state.versions.unshift({at:new Date().toISOString(),text:state.notebook});state.notebook=[$('[data-notebook-text]').value,text].filter(Boolean).join('\n\n');state.draft='';delete state.edit;state.versions=state.versions.slice(0,20);save();paint();status('Proposition ajoutée. Vous pouvez encore modifier votre carnet.');};
    $('[data-continue]').onclick=()=>{tab('chat');$('[data-input]').focus();};
    $('[data-deepen]').onclick=()=>{const area=$('[data-notebook-text]'),text=area.value.slice(area.selectionStart,area.selectionEnd).trim();if(!text){status('Sélectionnez un passage de votre carnet à approfondir.');return;}tab('chat');$('[data-input]').value=`J’aimerais approfondir cette idée : ${text}`;$('[data-input]').focus();};
    $('[data-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([`BOO-P · Carnet de réflexion\n${book.title}\n${book.authors.join(', ')}\n\n${$('[data-notebook-text]').value}`],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='boop-carnet-reflexion.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    $('[data-print]').onclick=print;
    $('[data-voice]').onclick=()=>{const id=book.id;close();BT.voice?.open(id);};
    $('[data-dictate]').onclick=dictate;
    const supported=window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!supported){$('[data-dictate]').disabled=true;$('[data-dictate]').textContent='Utilisez la dictée de votre clavier';}
    try {
      if(BT.auth.isGuest() || !BT.auth.isAuthenticated())throw new Error('Connectez-vous au compte adulte autorisé pour tester l’IA.');
      const access=await api({action:'status'});if(current!==aborter || current.signal.aborted)return;
      if(!access.ready)throw new Error('La clé OPENAI_API_KEY manque dans les secrets Supabase.');
      const toggle=()=>{if($('[data-consent]').checked){consented.add(owner);$('[data-consent-box]').hidden=true;$('[data-about]').open=false;status('');}const disabled=!$('[data-consent]').checked || busy;$('[data-send]').disabled=disabled;$('[data-compose]').disabled=disabled;};$('[data-consent]').onchange=toggle;
      toggle();status(consented.has(owner)?'':'Confirmez le test pour commencer.');
    } catch(e){if(!current.signal.aborted)status(e.message);}
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
      save();paint();if(state.edit!==undefined)$('[data-notebook-text]').value=state.edit;
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
    for(const [tag,text] of [['header','BOO-P · Carnet de réflexion'],['h1',book.title],['p',book.authors.join(', ')],['main',$('[data-notebook-text]').value],['footer','Carnet personnel · '+new Date().toLocaleDateString('fr-FR')]]){const el=d.createElement(tag);el.textContent=text;d.body.append(el);}win.print();
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

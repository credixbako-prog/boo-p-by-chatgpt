/* Thoughts stay plain text plus a small allowlist of formatting runs. Never store HTML. */
window.BT = window.BT || {};
BT.thoughtEditor = (() => {
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(text, value) {
    try { if (typeof value === 'string') value = JSON.parse(value); } catch { return null; }
    if (value?.version !== 1 || !Array.isArray(value.runs) || value.runs.length > 6000) return null;
    const runs = value.runs.filter(r => r && typeof r.text === 'string').map(r => ({text:r.text, ...(r.bold === true ? {bold:true}:{}), ...(r.italic === true ? {italic:true}:{}), ...(r.underline === true ? {underline:true}:{}), ...(['small','large'].includes(r.size) ? {size:r.size}:{})}));
    const joined = runs.map(r => r.text).join('');
    if (joined.trim() !== String(text || '').trim()) return null;
    let start = joined.length - joined.trimStart().length, end = joined.trimEnd().length, offset = 0;
    const trimmed = [];
    for (const run of runs) { const from = Math.max(0,start-offset), to = Math.min(run.text.length,end-offset); offset += run.text.length; if (to > from) trimmed.push({...run,text:run.text.slice(from,to)}); }
    return {version:1,runs:trimmed};
  }
  function html(text, formatting) {
    const runs = normalize(text,formatting)?.runs || [{text:String(text || '')}];
    return runs.map(r => { let value=escape(r.text); if(r.bold)value='<strong>'+value+'</strong>'; if(r.italic)value='<em>'+value+'</em>'; if(r.underline)value='<u>'+value+'</u>'; return r.size?'<span class="thought-size-'+r.size+'">'+value+'</span>':value; }).join('');
  }
  function readDOM(root) {
    const runs=[];
    function push(text,marks={}) { if(!text)return; const last=runs.at(-1); if(last && ['bold','italic','underline','size'].every(k=>last[k]===marks[k]))last.text+=text;else runs.push({text,...marks}); }
    function walk(node,marks={}) {
      if(node.nodeType===3){push(node.textContent,marks);return;}
      if(node.nodeType!==1)return;
      const tag=node.tagName, next={...marks};
      if(tag==='BR'){push('\n',marks);return;}
      if(['SCRIPT','STYLE','IMG','IFRAME','OBJECT'].includes(tag))return;
      if(['B','STRONG'].includes(tag))next.bold=true;
      if(['I','EM'].includes(tag))next.italic=true;
      if(tag==='U')next.underline=true;
      if(node.style.fontWeight)next.bold=node.style.fontWeight==='bold'||Number(node.style.fontWeight)>=600;
      if(node.style.fontStyle)next.italic=node.style.fontStyle==='italic';
      if(node.style.textDecorationLine)next.underline=node.style.textDecorationLine.includes('underline');
      if(node.style.fontSize){const px=parseFloat(node.style.fontSize);next.size=node.style.fontSize==='small'||px===14?'small':['large','x-large'].includes(node.style.fontSize)||px>=18?'large':undefined;}
      if(tag==='FONT' && node.hasAttribute('size'))next.size=Number(node.getAttribute('size'))<3?'small':Number(node.getAttribute('size'))>3?'large':undefined;
      if(node.classList.contains('thought-size-small'))next.size='small';
      if(node.classList.contains('thought-size-large'))next.size='large';
      const block=['DIV','P'].includes(tag) && node!==root;
      if(block && runs.length && !runs.at(-1).text.endsWith('\n'))push('\n');
      node.childNodes.forEach(child=>walk(child,next));
      if(block && node.nextSibling && !runs.at(-1)?.text.endsWith('\n'))push('\n');
    }
    walk(root);const text=runs.map(r=>r.text).join('');return {text,formatting:normalize(text,{version:1,runs})};
  }
  function attach(textarea,{formatting=null,formatName='formatting',onChange=null,dictation=true,label='Votre pensée'}={}) {
    const form=textarea.closest('form'), box=document.createElement('div');box.className='thought-editor';
    const tools=document.createElement('div');tools.className='thought-toolbar';tools.setAttribute('role','group');tools.setAttribute('aria-label','Mise en forme');
    const editor=document.createElement('div');editor.className='thought-writing';editor.contentEditable='true';editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-label',label);editor.dataset.placeholder=textarea.placeholder||'Écrivez votre pensée…';editor.spellcheck=true;
    const saved=form?.elements.namedItem(formatName) || document.createElement('input');saved.type='hidden';saved.name=formatName;if(!saved.isConnected)textarea.after(saved);
    formatting=saved.value||formatting;
    editor.innerHTML=html(textarea.value,formatting);textarea.hidden=true;const required=textarea.required;textarea.required=false;
    const status=document.createElement('p');status.className='small muted thought-editor-status';status.setAttribute('role','status');
    let range=null,disposed=false,recognizing=false;
    const limit=Math.max(textarea.maxLength>0?textarea.maxLength:1200,textarea.value.length);
    function selection(){const s=getSelection();if(s?.rangeCount && editor.contains(s.anchorNode)&&editor.contains(s.focusNode))range=s.getRangeAt(0).cloneRange();}
    function restore(){editor.focus();const s=getSelection();if(range && editor.contains(range.commonAncestorContainer)){s.removeAllRanges();s.addRange(range);}else{const r=document.createRange();r.selectNodeContents(editor);r.collapse(false);s.removeAllRanges();s.addRange(r);}}
    function sync(){const value=readDOM(editor);textarea.value=value.text;saved.value=JSON.stringify(value.formatting);textarea.setCustomValidity(required&&!value.text.trim()?'Écrivez une pensée.':value.text.length>limit?'Votre pensée est trop longue.':'');status.textContent=value.text.length>limit?'Votre pensée dépasse '+limit+' caractères.':recognizing?'Dictée en cours…':'';onChange?.(value);textarea.dispatchEvent(new Event('input',{bubbles:true}));selection();}
    function command(name,value){restore();document.execCommand(name,false,value);sync();}
    function tool(label,text,commandName){const b=document.createElement('button');b.type='button';b.className='thought-tool';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed','false');b.onpointerdown=e=>{selection();e.preventDefault();};b.onclick=()=>command(commandName);tools.append(b);return b;}
    const sizeLabel=document.createElement('label');sizeLabel.className='thought-size-control';const size=document.createElement('select');size.setAttribute('aria-label','Taille du texte');for(const [v,t] of [['2','Petite'],['3','Normale'],['5','Grande']]){const o=document.createElement('option');o.value=v;o.textContent=t;size.append(o);}size.value='3';size.onpointerdown=selection;size.onchange=()=>command('fontSize',size.value);sizeLabel.append(size);tools.append(sizeLabel);
    const bold=tool('Gras','G','bold'),italic=tool('Italique','I','italic'),underline=tool('Souligné','S','underline');bold.style.fontWeight='700';italic.style.fontStyle='italic';underline.style.textDecoration='underline';
    function updateSelection(){selection();if(!editor.contains(getSelection()?.anchorNode))return;for(const [b,cmd] of [[bold,'bold'],[italic,'italic'],[underline,'underline']])b.setAttribute('aria-pressed',String(document.queryCommandState(cmd)));const font=Number(document.queryCommandValue('fontSize'));size.value=font&&font<3?'2':font>3?'5':'3';}
    document.addEventListener('selectionchange',updateSelection);
    editor.addEventListener('input',sync);
    editor.addEventListener('paste',e=>{e.preventDefault();selection();const available=limit-textarea.value.length+(getSelection()?.toString().length||0);command('insertText',(e.clipboardData?.getData('text/plain')||'').slice(0,Math.max(0,available)));});
    editor.addEventListener('drop',e=>e.preventDefault());
    editor.addEventListener('beforeinput',e=>{if(e.inputType.startsWith('insert') && !e.isComposing && textarea.value.length-(getSelection()?.toString().length||0)+(e.data?.length||1)>limit){e.preventDefault();status.textContent='Limite de '+limit+' caractères atteinte.';}});
    textarea.setCustomValidity(required&&!textarea.value.trim()?'Écrivez une pensée.':'');
    textarea.addEventListener('invalid',event=>{event.preventDefault();editor.focus();status.textContent=textarea.validationMessage;});
    const speech=window.SpeechRecognition||window.webkitSpeechRecognition;let recognition;
    if(dictation){const mic=document.createElement('button');mic.type='button';mic.className='thought-tool thought-dictation';mic.textContent='Dicter';mic.setAttribute('aria-label','Dicter une Trace');mic.disabled=!speech;if(!speech)mic.title='La dictée n’est pas disponible dans ce navigateur';
      mic.onclick=()=>{if(recognizing){recognition?.stop();return;}selection();recognition=new speech();recognition.lang='fr-FR';recognition.continuous=true;recognition.interimResults=false;recognition.onresult=e=>{if(disposed)return;for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)command('insertText',((textarea.value?' ':'')+e.results[i][0].transcript).slice(0,Math.max(0,limit-textarea.value.length)));}};recognition.onerror=()=>{status.textContent='La dictée est indisponible. Votre texte est conservé.';};recognition.onend=()=>{recognizing=false;mic.textContent='Dicter';mic.setAttribute('aria-pressed','false');if(status.textContent==='Dictée en cours…')status.textContent='';};try{recognition.start();recognizing=true;mic.textContent='Arrêter la dictée';mic.setAttribute('aria-pressed','true');status.textContent='Dictée en cours…';}catch{status.textContent='Impossible de démarrer la dictée.';}};tools.append(mic);}
    box.append(tools,editor,status);textarea.after(box);
    saved.value=JSON.stringify(normalize(textarea.value,formatting));
    const dispose=()=>{if(disposed)return;disposed=true;recognition?.abort();document.removeEventListener('selectionchange',updateSelection);observer.disconnect();};
    const observer=new MutationObserver(()=>{if(!box.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});box.closest('dialog')?.addEventListener('close',dispose,{once:true});
    return {editor,dispose,value:()=>readDOM(editor),set(text,format){textarea.value=text;editor.innerHTML=html(text,format);sync();}};
  }
  function open({title='Trace en brouillon',text='',formatting=null,onChange=()=>{},current=()=>true,onClose=()=>{}}={}) {
    const d=document.createElement('dialog');d.className='app-dialog thought-fullscreen';const form=document.createElement('form');form.className='thought-page';
    const head=document.createElement('header');head.className='thought-page-head';const h=document.createElement('h2');h.textContent=title;h.id='thought-'+crypto.randomUUID();d.setAttribute('aria-labelledby',h.id);const done=document.createElement('button');done.type='button';done.className='button button--primary button--small';done.textContent='Terminer';done.onclick=()=>d.close();head.append(h,done);
    const input=document.createElement('textarea');input.value=text;input.maxLength=1200;form.append(head,input);d.append(form);document.body.append(d);
    const mounted=attach(input,{formatting,onChange:value=>{if(current())onChange(value);else d.close();},label:title});
    const check=()=>{if(!current())d.close();};const unsubscribe=BT.store?.subscribe(check);const hide=()=>d.close();window.addEventListener('pagehide',hide);
    d.addEventListener('close',()=>{mounted.dispose();unsubscribe?.();window.removeEventListener('pagehide',hide);d.remove();onClose();},{once:true});d.showModal();mounted.editor.focus();return d;
  }
  return {normalize,html,readDOM,attach,open};
})();

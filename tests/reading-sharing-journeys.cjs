/** Local UI tests: API is mocked; no user account or publication is changed. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  fs.mkdirSync('.tmp/sharing-review',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto((process.env.BOOP_TEST_URL || 'http://127.0.0.1:8766')+'/app.html?guest=1#home');
  await page.locator('[data-action=start-session]').waitFor();
  const ids=await page.evaluate(()=>{
   // Isolate the publication composer; profile interactions have their own journey suite.
   BT.readerProfile=null;
   const b=BT.store.addBook({title:'Mémoires d’Hadrien',authors:['Marguerite Yourcenar'],reflection:{notebook:'Ma réflexion enregistrée.',sections:{retained:'La lucidité.',questions:'Que transmettre ?'},messages:[{content:'SECRET CHAT'}],draft:'SECRET DRAFT'}});
   const w=BT.store.addLexiconWord({kind:'word',word:'Sérendipité',definition:'Une découverte inattendue',bookId:b.id,note:'SECRET NOTE'});
   const ex=BT.store.addLexiconWord({kind:'expression',word:'Prendre le temps',bookId:b.id});
   const ci=BT.store.addLexiconWord({kind:'citation',word:'Les mots qui restent',bookId:b.id});
   const th=BT.store.saveTrace({bookId:b.id,text:'Ma pensée',privacy:'private'});
   return {book:b.id,word:w.id,expression:ex.id,citation:ci.id,thought:th.id};
  });
  await page.evaluate(id=>BT.sharing.open('word',id),ids.word);
  assert.match(await page.locator('[data-sharing-status]').textContent(),/Connectez-vous/);
  assert.equal(await page.locator('.sharing-dialog button[type=submit]').isDisabled(),true);
  await page.locator('.sharing-dialog [aria-label=Fermer]').click();
  await page.evaluate(()=>{
   document.body.dataset.authMode='account';let user='test-owner';
   BT.auth.isGuest=()=>false;BT.auth.isAuthenticated=()=>true;BT.auth.getCurrentUser=()=>({id:user,name:'Lecteur test'});BT.auth.ready=async()=>{};
   const records=new Map();window.sharingTest={writes:0,fail:false,setUser:id=>{user=id;BT.store.saveSettings({});}};
   BT.community.listPosts=BT.community.listClubs=BT.community.listSalons=async()=>[];
   BT.community.getOwnReadingPublication=async(k,s)=>[...records.values()].find(r=>r.reading_kind===k && r.reading_source_id===s)||null;
   BT.community.publishReading=async p=>{
    if(sharingTest.fail)throw new Error('Réseau de test indisponible');
    sharingTest.writes++;const key=p.kind+':'+p.sourceId;
    const row={id:key,author_id:user,author_name:'Lecteur test',body:p.text,reading_content:p.content,reading_kind:p.kind,reading_source_id:p.sourceId,book_title:p.bookTitle,visibility:p.visibility};records.set(key,row);return row;
   };
   BT.community.withdrawReading=async id=>records.delete(id);
   BT.community.getReadingPublication=async id=>records.get(id)||null;
   BT.community.getReaderLibrary=async(id,cursor)=>({available:true,books:[{title:cursor?'Deuxième livre':'Un livre ami',authors:['Autrice'],status:'lu'}],next:cursor?null:'next'});
   BT.community.listReaderPublications=async(id,kind)=>[...records.values()].filter(p=>kind==='notebook'?p.reading_kind==='notebook':p.reading_kind!=='notebook');
  });
  const form=page.locator('.sharing-dialog form'),submit=()=>form.locator('button[type=submit]');
  const open=async(kind,id)=>{await page.evaluate(([k,i])=>BT.sharing.open(k,i),[kind,id]);await submit().waitFor();};
  const close=()=>page.locator('.sharing-dialog [aria-label=Fermer]').last().click();
  await page.evaluate(()=>location.hash='#path?tab=lexicon');
  await page.locator(`[data-action=share-reading][data-id="${ids.word}"]`).click();
  assert.equal(await form.locator('[name=audience]').inputValue(),'friends');
  await form.locator('[name=message]').fill('Mon message personnel, écrit avant de partager.');
  await form.locator('[name=content]').fill('Sérendipité : ma définition à partager.');
  await form.locator('summary').click();
  assert.match(await form.locator('.sharing-preview').textContent(),/Mon message personnel/);
  assert.equal(await page.evaluate(()=>sharingTest.writes),0);
  assert.equal(await form.locator('textarea').first().evaluate(e=>getComputedStyle(e).fontSize),'16px');
  await page.screenshot({path:'.tmp/sharing-review/composer-mobile.png'});
  await submit().click();await page.waitForFunction(()=>sharingTest.writes===1);
  assert.match(await form.locator('[data-sharing-status]').textContent(),/enregistrée/);await close();
  await open('word',ids.word);assert.equal(await form.locator('[name=message]').inputValue(),'Mon message personnel, écrit avant de partager.');
  await form.locator('[name=audience]').selectOption('public');await submit().click();await close();
  await page.evaluate(id=>BT.sharing.view('word:'+id),ids.word);
  assert.match(await page.locator('.sharing-dialog').textContent(),/ma définition à partager/);await close();
  await open('word',ids.word);await page.evaluate(()=>sharingTest.fail=true);await form.locator('[name=message]').fill('Mon brouillon conservé après erreur');await submit().click();
  assert.match(await form.locator('[data-sharing-status]').textContent(),/Réseau/);assert.equal(await form.locator('[name=message]').inputValue(),'Mon brouillon conservé après erreur');
  await page.evaluate(()=>sharingTest.fail=false);page.once('dialog',d=>d.accept());await form.getByText('Retirer la publication',{exact:true}).click();
  assert.match(await form.locator('[data-sharing-status]').textContent(),/retirée/);await close();
  await page.evaluate(id=>BT.sharing.view('word:'+id),ids.word);assert.match(await page.locator('.sharing-dialog').textContent(),/plus accessible/);await close();
  for(const kind of ['expression','citation','thought','debut','fin']){await open(kind,ids[kind]||ids.book);assert.ok(await form.locator('[name=message]').inputValue());await close();}
  await page.evaluate(id=>BT.reflection.open(id,'notebook'),ids.book);
  await page.locator('[data-share-notebook]').click();
  assert.doesNotMatch(await form.locator('[name=content]').inputValue(),/SECRET/);
  await form.locator('[name=content]').fill('Une copie choisie de mon carnet.');await submit().click();await close();
  assert.equal(await page.evaluate(id=>BT.store.getBookById(id).reflection.notebook,ids.book),'Ma réflexion enregistrée.');
  await page.locator('.reflection-dialog [data-close]').click();
  const beforeFinish=await page.evaluate(()=>sharingTest.writes);
  await page.evaluate(id=>{BT.store.startActiveSession(id);location.hash='#session';},ids.book);
  await page.locator('[data-action=finish-session]').click();
  const finish=page.locator('form[data-form=finish-session]');
  await finish.locator('[name=markRead]').check();await finish.locator('summary').click();
  const fullThought='Une pensée de lecture. '.repeat(50);await finish.locator('[name=traceText]').fill(fullThought);
  await finish.locator('[name=share]').check();await finish.locator('button[type=submit]').click();
  await page.locator('.completion-dialog').waitFor();assert.equal(await page.evaluate(()=>sharingTest.writes),beforeFinish);
  await page.locator('.completion-dialog button').click();await form.waitFor();
  assert.equal(await form.locator('[name=content]').inputValue(),fullThought.trim());
  assert.equal(await page.evaluate(()=>sharingTest.writes),beforeFinish);await close();
  await page.evaluate(()=>{const h=document.createElement('div');h.id='reader-test';document.querySelector('main').prepend(h);BT.sharing.mountReader(h,'friend');});
  const reader=page.locator('#reader-test');await reader.getByText('Un livre ami',{exact:true}).waitFor();await reader.getByText('Voir la suite',{exact:true}).click();await reader.getByText('Deuxième livre',{exact:true}).waitFor();
  await reader.getByText('Carnets publiés',{exact:true}).click();await reader.getByText('Lire la publication',{exact:true}).waitFor();
  await page.screenshot({path:'.tmp/sharing-review/reader-mobile.png'});
  await open('notebook',ids.book);await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.tmp/sharing-review/composer-desktop.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>sharingTest.setUser('other-account'));await page.waitForFunction(()=>!document.querySelector('.sharing-dialog[open]'));
  assert.deepEqual(errors,[]);console.log('PASS: mobile/desktop, guest guard, preview, editing, audience, retry, withdrawal, all sharing kinds, notebook isolation, friend pagination, account switch');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

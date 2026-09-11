/** Local isolated browser, no real messages or publications. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{
 fs.mkdirSync('.tmp/profile-review',{recursive:true});const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,serviceWorkers:'block'});
 await ctx.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto((process.env.BOOP_TEST_URL||'http://127.0.0.1:8766')+'/app.html?guest=1#home');await page.locator('[data-action=start-session]').waitFor();
 await page.evaluate(()=>{
  let user='me';document.body.dataset.authMode='account';BT.auth.isGuest=()=>false;BT.auth.isAuthenticated=()=>true;BT.auth.getCurrentUser=()=>({id:user,name:'Camille'});BT.auth.ready=async()=>{};
  BT.community.listPosts=BT.community.listClubs=BT.community.listSalons=async()=>[];
  const friend={id:'friend',name:'Léa Martin',handle:'@lea',initials:'LM',profileVisibility:'private',isRemote:true,friendState:'friend'};
  BT.store.mergeRemoteUsers([friend]);BT.community.searchReaders=async()=>[friend];BT.community.getReaderProfile=async()=>({bio:'Les livres m’aident à regarder autrement.',interests:['Romans','Histoire']});
  const book={id:'b1',title:'Mémoires d’Hadrien',authors:['Marguerite Yourcenar'],status:'en-cours',isbn:'9782070369218',mediaType:'print',coverUrl:''};
  const post={id:'p1',author_id:'friend',author_name:'Léa Martin',book_title:book.title,body:'Cette lecture me fait réfléchir à ce que nous transmettons.',reading_kind:'notebook',reading_source_id:'b1',reading_content:'Le temps et la transmission.\nUne réflexion partagée, sans mon journal privé.',created_at:new Date().toISOString(),visibility:'friends'};
  const rows=[];let mine=null,prefs={welcome:'En ce moment, je prends le temps de découvrir Yourcenar.',show_current:true,featured:['b1']};
  window.profileTest={writes:0,fail:false,revoked:false,setUser:v=>{user=v;BT.store.saveSettings({});}};
  BT.readerProfileApi={identity:async()=>friend,preferences:async()=>prefs,
   savePreferences:async p=>{prefs=p;profileTest.writes++;return p;},
   books:async(id,shelf,cursor,bookId)=>({available:!profileTest.revoked,total:7,finished:4,showCurrent:prefs.show_current,next:null,books:profileTest.revoked?[]:shelf==='current'&&!prefs.show_current?[]:shelf==='lu'||shelf==='a-lire'?[]:[book]}),
   publications:async(id,kind,offset=0)=>({rows:offset?[]:[post],count:1}),publication:async()=>profileTest.revoked?null:post,
   thread:async target=>{if(profileTest.revoked)throw new Error('Cette lecture n’est plus accessible.');return {rows:rows.slice(),total:rows.length,count:mine?1:0,mine,owner:'friend',audience:'Visible par ce lecteur et ses amis acceptés'};},
   encourage:async()=>{mine=mine?null:'like';profileTest.writes++;},
   trace:async(target,body,parent)=>{if(profileTest.fail)throw new Error('Connexion interrompue');rows.push({id:'t'+rows.length,author_id:user,author_name:user==='me'?'Camille':'Léa',body,parent_id:parent,created_at:new Date().toISOString()});profileTest.writes++;},
   removeTrace:async(target,id)=>{rows.splice(rows.findIndex(r=>r.id===id),1);profileTest.writes++;}
  };
 });
 await page.evaluate(()=>location.hash='#community?tab=friends');await page.locator('[data-action=view-user][data-id=friend]').click();
 const profile=page.locator('#app-dialog [data-reader-sharing]');await profile.getByText('En ce moment, je lis…',{exact:true}).waitFor();await profile.getByText('En ce moment, je prends le temps de découvrir Yourcenar.',{exact:true}).waitFor();
 await page.screenshot({path:'.tmp/profile-review/profile-mobile.png'});
 assert.equal(await page.evaluate(()=>profileTest.writes),0);
 const current=profile.locator('.reader-current-shelf');await current.getByRole('button',{name:/Bonne lecture/}).click();await page.waitForFunction(()=>profileTest.writes===1);
 await current.locator('.reader-traces summary').click();await current.locator('textarea').fill('Que retiens-tu de cette lecture ?');await current.getByRole('button',{name:'Envoyer la Trace'}).click();await current.getByText('Que retiens-tu de cette lecture ?',{exact:true}).waitFor();
 await current.getByText('Répondre',{exact:true}).click();await current.locator('textarea').fill('Une seconde pensée.');await current.getByRole('button',{name:'Envoyer la Trace'}).click();await current.getByText('Une seconde pensée.',{exact:true}).waitFor();
 await page.evaluate(()=>profileTest.fail=true);await current.locator('textarea').fill('Mon texte reste ici');await current.getByRole('button',{name:'Envoyer la Trace'}).click();await current.getByText('Connexion interrompue',{exact:true}).waitFor();assert.equal(await current.locator('textarea').inputValue(),'Mon texte reste ici');await page.evaluate(()=>profileTest.fail=false);
 await current.getByRole('button',{name:'Découvrir ce livre'}).click();const dialog=page.locator('.reader-dialog').last();await dialog.getByRole('button',{name:'Ajouter à ma bibliothèque',exact:true}).click();const add=page.locator('.reader-dialog').last();await add.getByRole('button',{name:'Ajouter à mon espace'}).click();
 assert.ok(await page.evaluate(()=>BT.store.getBooks().some(b=>b.isbn==='9782070369218'&&b.status==='a-lire'&&!b.reflection?.notebook)));await add.getByRole('button',{name:'Fermer',exact:true}).click();await dialog.getByRole('button',{name:'Fermer',exact:true}).click();
 await profile.getByRole('button',{name:'Bibliothèque',exact:true}).click();await profile.getByRole('button',{name:'Lus',exact:true}).click();await profile.getByText('Aucun livre dans ce rayon pour le moment.',{exact:true}).waitFor();
 await profile.getByRole('button',{name:'Carnets',exact:true}).click();await profile.getByRole('button',{name:'Lire le carnet'}).click();await page.locator('.reader-dialog').getByText(/Le temps et la transmission/).waitFor();await page.locator('.reader-dialog').getByRole('button',{name:'Fermer',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await profile.getByRole('button',{name:'Son parcours',exact:true}).click();await profile.locator('.reader-current-shelf').waitFor();await page.screenshot({path:'.tmp/profile-review/profile-desktop.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#app-dialog [data-action=close-dialog]').click();await page.evaluate(()=>BT.readerProfile.editPreferences());const settings=page.locator('.reader-dialog');await settings.locator('[name=welcome]').fill('Mon nouveau mot d’accueil');await settings.locator('[name=showCurrent]').uncheck();await settings.getByRole('button',{name:'Enregistrer mon profil'}).click();await settings.getByText('Profil enregistré.',{exact:true}).waitFor();await settings.getByRole('button',{name:'Fermer',exact:true}).click();
 await page.locator('[data-action=view-user][data-id=friend]').click();await profile.getByText('Mon nouveau mot d’accueil',{exact:true}).waitFor();assert.equal(await profile.getByText('En ce moment, je lis…',{exact:true}).count(),0);
 await page.evaluate(()=>profileTest.revoked=true);await profile.getByRole('button',{name:'Bibliothèque',exact:true}).click();await profile.getByText('La bibliothèque s’ouvre après acceptation de votre amitié.',{exact:true}).waitFor();
 await page.evaluate(()=>profileTest.setUser('another-account'));assert.equal(await page.locator('#app-dialog').evaluate(d=>d.open),false);
 assert.deepEqual(errors,[]);console.log('PASS: profile, interactions, replies, retry, add book without private data, shelves, notebook, preferences, revocation, mobile and desktop');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

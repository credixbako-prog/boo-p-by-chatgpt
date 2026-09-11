/** Isolated profile and achievement journeys, with no remote writes. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});try{
 fs.mkdirSync('.tmp/badges-review',{recursive:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,serviceWorkers:'block'});
 await context.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:8766/app.html?guest=1#home');await page.locator('[data-action=start-session]').waitFor();
 assert.equal(await page.locator('#main-view .monthly-report-cta').count(),1);
 assert.equal(await page.locator('#main-view').evaluate(el=>el.lastElementChild.classList.contains('monthly-report-cta')),true);
 await page.evaluate(()=>{BT.store.useUser('badge-browser');BT.store.saveProfile({name:'Camille Martin',title:'Un livre, un regard nouveau',bio:'Je lis pour découvrir d’autres façons de voir le monde.',handle:'@camille'});BT.store.replaceSyncedData({books:[{id:'hadrien',title:'Mémoires d’Hadrien',authors:['Marguerite Yourcenar'],genre:'Romans',libraryState:'library',status:'lu',reflection:{notebook:'Le temps, le pouvoir et la liberté.'}}],lexicon:[{id:'word',word:'Sérendipité',kind:'word'}]});location.hash='#profile';});
 await page.locator('.profile-hero--compact').waitFor();await page.locator('[data-own-badge] .profile-badge-chip').waitFor();
 assert.equal(await page.locator('.profile-hero [href*="section=goals"]').count(),0);
 assert.equal(await page.locator('.profile-statistics').evaluate(el=>el.open),false);
 await page.locator('.profile-statistics summary').click();assert.equal(await page.locator('.profile-statistics').evaluate(el=>el.open),true);await page.locator('.profile-statistics summary').click();
 for(const width of [320,390,1024]){await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,0));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
 assert.equal(await page.locator('.profile-dna blockquote').evaluate(el=>getComputedStyle(el).fontSize),'16px');
 await page.screenshot({path:'.tmp/badges-review/profile-'+width+'.png',fullPage:width===1024});}
 await page.setViewportSize({width:390,height:844});await page.locator('[data-action=profile-customize]').click();
 await page.getByRole('button',{name:'Photo et identité',exact:true}).click();await page.locator('[data-form=profile]').waitFor();await page.locator('#app-dialog [data-action=close-dialog]').click();
 await page.locator('.profile-badges [data-action=open-badges]').first().click();assert.equal(await page.locator('.badge-collection-item').count(),30);assert.equal(await page.locator('.badge-collection-item svg').count(),30);
 await page.screenshot({path:'.tmp/badges-review/collection.png'});
 // Pending awards wait while the collection modal is open.
 await page.evaluate(()=>BT.store.saveTrace({bookId:'hadrien',text:'Ce livre me donne envie de prendre le temps.'}));
 await page.waitForTimeout(400);assert.equal(await page.locator('.badge-celebration[open]').count(),0);
 await page.locator('#app-dialog [data-action=close-dialog]').click();await page.locator('.badge-celebration[open]').waitFor();
 assert.equal(await page.locator('.badge-celebration .badge-moving').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.locator('.badge-celebration-close').click();await page.waitForTimeout(450);assert.equal(await page.locator('.badge-celebration').count(),0);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{const b=BT.store.addBook({title:'Un livre à transmettre',situation:'donne'});window.badgeTestBook=b.id;});
 await page.locator('.badge-celebration[open]').waitFor();
 assert.notEqual(await page.locator('.badge-celebration .badge-moving').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.waitForTimeout(1700);assert.ok((await page.locator('.badge-celebration').boundingBox()).height<550,'Compact celebration');
 await page.screenshot({path:'.tmp/badges-review/celebration.png'});await page.locator('.badge-celebration').waitFor({state:'detached'});
 await page.evaluate(()=>BT.store.saveSettings({theme:'dark'}));await page.waitForTimeout(500);assert.equal(await page.locator('.badge-celebration').count(),0);
 await page.reload();await page.locator('.profile-hero--compact').waitFor();assert.equal(await page.locator('.badge-celebration').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: profile layout 320/390/1024, 30 medals, compact DNA, statistics, personalization, grouped/deferred celebration, reduced motion, auto close and no replay');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

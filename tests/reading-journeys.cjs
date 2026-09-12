/** Run against a local server: PLAYWRIGHT_MODULE and CHROME_PATH may select installed runtimes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BOOP_TEST_URL || 'http://127.0.0.1:8766';
const out = path.resolve('.tmp/ux-updated');

(async () => {
  fs.mkdirSync(out, { recursive:true });
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, serviceWorkers:'block' });
  const page = await context.newPage(), errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(8000);
  await page.addLocatorHandler(page.locator('.badge-celebration[open]'),async()=>page.locator('.badge-celebration-close').click());
  await page.emulateMedia({ reducedMotion:'reduce' });
  const action = name => page.locator(`[data-action="${name}"]`);
  const shot = name => page.screenshot({ path:path.join(out,`${name}.png`) });
  const check = name => { checks.push(name); console.log('PASS',name); };
  const route = async hash => { await page.evaluate(hash => { location.hash = hash; },hash); await page.waitForTimeout(120); };
  const close = async () => { await page.locator('#app-dialog [data-action="close-dialog"]').click(); };
  try {
    await page.goto(`${base}/app.html?guest=1#home`, { waitUntil:'domcontentloaded' });
    await action('start-session').waitFor();
    const start = await action('start-session').boundingBox();
    assert.ok(start.y + start.height < 770);
    check('Accueil : lecture accessible sans défilement');

    let fileChoosers = 0; page.on('filechooser',() => fileChoosers++);
    await action('add-book').click();
    await page.locator('#catalog-query').waitFor();
    assert.equal(fileChoosers,0);
    await shot('add-search-mobile');
    await page.locator('[data-action="book-entry-mode"][data-mode="manual"]').click();
    const form = page.locator('form[data-form="book"]');
    await form.locator('[name="title"]').fill('Le livre du test UX');
    await form.locator('[name="authors"]').fill('Lecteur Test');
    await form.locator('[name="totalPages"]').fill('400');
    await form.locator('[name="status"]').selectOption('en-cours');
    await shot('add-manual-mobile');
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#book?'));
    const book = await page.evaluate(() => BT.store.getBooks().find(book => book.title === 'Le livre du test UX'));
    assert.equal(book.totalPages,400); assert.equal(book.authors[0],'Lecteur Test');
    check('Ajout manuel : les données sont sauvegardées, sans ouverture automatique de caméra');

    await action('book-session').click();
    await page.locator('#session-page-slider-number').fill('237');
    await page.locator('#session-page-slider-number').blur();
    assert.equal(await page.locator('#session-page-slider').inputValue(),'237');
    await page.locator('#session-citation-draft').fill('Une citation conservée en quittant la lecture.');
    await shot('session-mobile');
    await action('finish-session').click();
    await page.locator('form[data-form="finish-session"]').waitFor();
    const paused = await page.evaluate(() => ({session:BT.store.getActiveSession(),duration:BT.store.activeDuration()}));
    assert.equal(paused.session.status,'paused');
    assert.equal(paused.session.citations.length,1);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => BT.store.activeDuration()),paused.duration);
    await shot('finish-mobile');
    await page.locator('form[data-form="finish-session"] button[type="submit"]').click();
    await action('start-session').waitFor();
    assert.equal(await page.evaluate(id => BT.store.getBookById(id).currentPage,book.id),237);
    assert.equal(await page.evaluate(() => BT.store.getActiveSession()),null);
    check('Session : page précise, citation conservée, durée figée pendant le bilan');

    await action('capture-memory').click();
    await page.locator('[data-action="capture-kind"][data-kind="thought"]').click();
    await page.locator('[data-form=trace] .thought-writing').fill('Une pensée privée à retrouver après fermeture.');
    await close();
    await page.reload({waitUntil:'domcontentloaded'});
    await action('capture-memory').click();
    await page.locator('[data-action="capture-kind"][data-kind="thought"]').click();
    assert.equal(await page.locator('#trace-dialog-text').inputValue(),'Une pensée privée à retrouver après fermeture.');
    await page.locator('form[data-form="trace"] button[type="submit"]').click();
    assert.equal(await page.evaluate(() => BT.store.getTraces().find(t => t.text.startsWith('Une pensée privée')).privacy),'private');
    await route(`#path?tab=notebook&book=${book.id}`);
    assert.match(await page.locator('#main-view').innerText(),/Une pensée privée/);
    assert.match(await page.locator('#main-view').innerText(),/Une citation conservée/);
    await shot('notebook-mobile');
    check('Carnet : brouillon retrouvé après rechargement et pensée privée avec sa citation');

    await action('capture-memory').click();
    await page.locator('[data-action="capture-kind"][data-kind="word"]').click();
    await page.locator('form[data-form="lexicon"] [name="word"]').fill('Palimpseste');
    await close();
    await action('capture-memory').click();
    await page.locator('[data-action="capture-kind"][data-kind="citation"]').click();
    assert.equal(await page.locator('form[data-form="lexicon"] [name="word"]').inputValue(),'');
    await page.locator('form[data-form="lexicon"] [name="word"]').fill('Une phrase sans définition obligatoire.');
    await page.locator('form[data-form="lexicon"] button[type="submit"]').click();
    assert.ok(await page.evaluate(() => BT.store.getLexicon().some(e => e.word === 'Une phrase sans définition obligatoire.' && e.kind === 'citation')));
    check('Carnet : les brouillons de mots et de citations restent distincts');

    await route('#path?tab=library');
    await page.locator('.book-grid .book-card').first().waitFor();
    assert.ok((await page.locator('.book-grid .book-card').first().boundingBox()).y < 700);
    await page.locator('.library-filters > summary').click();
    await page.locator('[data-action="library-view"][data-view="list"]').click();
    await page.locator('.book-grid--list').waitFor();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.book-grid--list').waitFor();
    check('Bibliothèque : vue liste persistante');

    // Exercise the actual search adapter with deterministic publisher response fixtures.
    await page.route('https://www.googleapis.com/books/v1/volumes**', route => route.fulfill({json:{items:[{id:'ux-edition',volumeInfo:{title:'Les chemins du carnet',authors:['Autrice Test'],publisher:'Éditions Test',publishedDate:'2025',pageCount:240,description:'Un résumé de catalogue.',industryIdentifiers:[{type:'ISBN_13',identifier:'9782070360024'}]}}]}}));
    await page.route('https://openlibrary.org/**',route => route.fulfill({json:{docs:[]}}));
    await action('add-book').click();
    await page.locator('#catalog-query').fill('Les chemins du carnet');
    await page.locator('form[data-form="catalog-search"] button').click();
    await action('pick-book-result').first().click();
    assert.equal(await page.locator('#book-title-field').inputValue(),'Les chemins du carnet');
    assert.equal(await page.locator('#book-pages-field').inputValue(),'240');
    await shot('add-edition-mobile');
    await close();
    check('Catalogue : requête, résultat, sélection et métadonnées préremplies (réponse simulée)');

    await page.unroute('https://www.googleapis.com/books/v1/volumes**');
    await page.route('https://www.googleapis.com/books/v1/volumes**', route => route.fulfill({json:{items:[]}}));
    await action('add-book').click();
    await page.locator('#catalog-query').fill('Un titre introuvable');
    await page.locator('form[data-form="catalog-search"] button').click();
    await page.locator('#book-lookup-results [data-mode="manual"]').click();
    assert.equal(await page.locator('#book-title-field').inputValue(),'Un titre introuvable');
    await page.locator('#book-title-field').fill('Le livre du test UX');
    await page.locator('#book-authors-field').fill('Lecteur Test');
    await page.locator('form[data-form="book"] button[type="submit"]').click();
    await page.locator('.duplicate-notice').waitFor();
    assert.equal(await page.evaluate(() => BT.store.getBooks().filter(b => b.title === 'Le livre du test UX').length),1);
    await page.locator('.duplicate-notice [data-action="open-book"]').click();
    assert.equal(await page.locator('#app-dialog').evaluate(e => e.open),false);
    check('Catalogue vide et doublon : saisie conservée, livre existant proposé sans duplication');

    await route('#path?tab=trail');
    await page.locator('[data-action="trail-mode"][data-mode="timeline"]').click();
    await page.locator('.trail-chronology').waitFor();
    await shot('trail-timeline-mobile');
    await page.locator('[data-action="trail-mode"][data-mode="map"]').click();
    await action('trail-immersive').click();
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('is-trail-immersive')),true);
    await shot('trail-immersive-mobile');
    await action('trail-immersive').click();
    check('Sentier : chronologie et agrandissement réversibles');

    await route('#profile');
    await page.locator('a[href="#profile?section=settings"]').click();
    await page.locator('#profile-settings').waitFor();
    assert.ok((await page.locator('#profile-settings').boundingBox()).y < 220);
    await shot('settings-mobile');
    check('Profil : accès direct aux réglages');

    await page.setViewportSize({width:320,height:740});
    await route('#home');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await shot('home-small');
    await route('#profile'); await action('toggle-theme').click();
    await route('#path?tab=lexicon'); await shot('notebook-dark');
    check('Petit écran et thème sombre : contenu disponible sans débordement de page');

    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'journeys.json'),JSON.stringify({checks,errors},null,2));
  } catch (error) {
    await shot('failure').catch(()=>{});
    console.error('FAIL',error.message,'URL',page.url(),'JS',errors);
    throw error;
  } finally { await browser.close(); }
})().catch(() => { process.exitCode=1; });

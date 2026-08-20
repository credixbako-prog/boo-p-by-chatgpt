import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('inscription: les trois mots de passe disposent d’un contrôle de visibilité', async () => {
  const [html, script] = await Promise.all([read('index.html'), read('js/landing.js')]);
  assert.equal((html.match(/data-password-toggle=/g) || []).length, 3);
  assert.match(script, /Votre sentier attend son premier pas/);
});

test('onboarding: quatre étapes, couvertures, objectif et thème libre', async () => {
  const [html, script] = await Promise.all([read('onboarding.html'), read('js/onboarding.js')]);
  assert.equal((html.match(/class="step-wrapper/g) || []).length, 4);
  assert.doesNotMatch(html, /id="step5"/);
  assert.equal((html.match(/class="indicator-dot/g) || []).length, 4);
  assert.match(html, /id="customTheme"/);
  assert.match(html, /data-goal-preset="30"/);
  assert.match(script, /book-tile__cover/);
  assert.match(script, /setTimeout\(finishOnboarding/);
  assert.match(script, /const visibility = 'private'/);
});

test('mémoire, communauté et parcours exposent les fonctions demandées', async () => {
  const [app, store] = await Promise.all([read('js/mvp-app.js'), read('js/store.js')]);
  assert.match(app, /\$\{memory\.length\} devinettes à réviser/);
  assert.match(app, /Trace · \$\{comments\.length\}/);
  assert.match(app, /Photo facultative/);
  assert.match(app, /customBookTitle/);
  assert.match(app, /Ne plus rendre actif/);
  assert.match(app, /Suggestions BOO-P · prototype local/);
  assert.match(store, /post-10/);
  assert.match(store, /function clearActiveBook/);
});

test('Supabase: photos compressées et couche communautaire chargée', async () => {
  const [html, api] = await Promise.all([read('app.html'), read('js/community-api.js')]);
  assert.match(html, /community-api\.js/);
  assert.match(api, /MAX_UPLOAD_BYTES = 5 \* 1024 \* 1024/);
  assert.match(api, /MAX_EDGE = 1920/);
  assert.match(api, /canvasBlob\(canvas, 'image\/jpeg'/);
  assert.match(api, /community_posts/);
  assert.match(api, /community_comments/);
  await access(path.join(root, 'assets/community/boo-p-reading-moments-sprite-v1.png'));
});

test('ajout de livre: image réelle, ISBN et saisie manuelle restent disponibles', async () => {
  const [html, app, lookup, store] = await Promise.all([
    read('app.html'), read('js/mvp-app.js'), read('js/book-lookup.js'), read('js/store.js')
  ]);
  assert.match(html, /js\/book-lookup\.js/);
  assert.match(app, /data-form="isbn-lookup"/);
  assert.match(app, /id="book-isbn-field"/);
  assert.match(app, /data-action="analyze-book-cover"/);
  assert.match(app, /Saisie manuelle ou correction/);
  assert.doesNotMatch(app, /reconnaissance de couverture est simulée/i);
  assert.doesNotMatch(app, /case 'recognize-cover'/);
  assert.match(lookup, /www\.googleapis\.com\/books\/v1\/volumes/);
  assert.match(lookup, /openlibrary\.org\/api\/books/);
  assert.match(lookup, /tesseract\.js@7\.0\.0/);
  assert.match(lookup, /BarcodeDetector/);
  assert.match(lookup, /COVER_TARGET_BYTES = 360 \* 1024/);
  assert.match(store, /isbn: data\.isbn/);
  await access(path.join(root, 'tests/fixtures/book-cover-ocr.svg'));
});

test('ajout de livre: validation ISBN-10 et ISBN-13', async () => {
  const source = await read('js/book-lookup.js');
  const context = { window: { BT: {}, setTimeout, clearTimeout }, console };
  vm.runInNewContext(source, context);
  const lookup = context.window.BT.bookLookup;
  assert.equal(lookup.normalizeISBN('978-2-07-036002-4'), '9782070360024');
  assert.equal(lookup.isValidISBN('9782070360024'), true);
  assert.equal(lookup.isValidISBN('2070360024'), true);
  assert.equal(lookup.isValidISBN('9782070360023'), false);
});

test('webapp: manifeste, icônes, cache et publication GitHub Pages sont prêts', async () => {
  const [manifestSource, index, app, onboarding, worker, workflow] = await Promise.all([
    read('manifest.webmanifest'), read('index.html'), read('app.html'), read('onboarding.html'),
    read('service-worker.js'), read('.github/workflows/deploy-pages.yml')
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.short_name, 'BOO-P');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './app.html#home');
  for (const html of [index, app, onboarding]) {
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.match(html, /js\/pwa\.js/);
  }
  assert.match(worker, /boo-p-webapp-v2/);
  assert.match(worker, /js\/book-lookup\.js/);
  assert.match(worker, /\['script', 'style', 'worker'\]/);
  assert.match(worker, /ignoreSearch: true/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  await Promise.all([
    access(path.join(root, 'assets/icons/boo-p-apple-touch-icon.png')),
    access(path.join(root, 'assets/icons/boo-p-icon-192.png')),
    access(path.join(root, 'assets/icons/boo-p-icon-512.png'))
  ]);
});

test('la marque visible reste BOO-P', async () => {
  const files = ['index.html','app.html','onboarding.html','js/landing.js','js/onboarding.js','js/mvp-app.js'];
  const content = (await Promise.all(files.map(read))).join('\n');
  assert.doesNotMatch(content, /\b(?:BOOP|Boop|Boo-p|Booktrail)\b/);
});

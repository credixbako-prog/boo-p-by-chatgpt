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
  const [app, store, css] = await Promise.all([read('js/mvp-app.js'), read('js/store.js'), read('css/mvp-v5.css')]);
  assert.match(app, /\$\{memory\.length\} devinettes à réviser/);
  assert.match(app, /Trace · \$\{comments\.length\}/);
  assert.match(app, /Photo facultative/);
  assert.match(app, /customBookTitle/);
  assert.doesNotMatch(app, /Ne plus rendre actif/);
  assert.match(app, /data-action="wishlist-recommendation"/);
  assert.match(app, /data-action="dismiss-recommendation"/);
  assert.match(app, /data-action="refresh-recommendations"/);
  assert.match(app, /data-change="goal-all-books"/);
  assert.match(app, /data-change="goal-book"/);
  assert.match(app, /class="bookcase"/);
  assert.match(app, /class="genre-shelf"/);
  assert.match(app, /class="physical-shelf"/);
  assert.match(app, /class="book-spine"/);
  assert.match(app, /data-change="library-sort"/);
  assert.match(app, /Suggestions BOO-P · analyse locale/);
  assert.match(store, /post-10/);
  assert.match(store, /activeSessions/);
  assert.match(store, /pauseOtherRunningSessions/);
  assert.match(store, /libraryState/);
  assert.match(store, /mediaType/);
  assert.match(store, /collapsedLibraryGenres/);
  assert.match(store, /genre: genres\[0\]/);
  assert.match(css, /\.memory-list \{ display: grid; gap:/);
  assert.match(css, /\.book-spine span/);
  assert.match(css, /writing-mode: vertical-rl/);
  assert.doesNotMatch(css, /\.memory-list \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(css, /\.public-feed \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(css, /\.physical-shelf \{[^}]*overflow-y: auto/);
});

test('lexique: dictionnaire, questions ciblées et répétition espacée', async () => {
  const [html, app, dictionary, store] = await Promise.all([read('app.html'), read('js/mvp-app.js'), read('js/dictionary.js'), read('js/store.js')]);
  assert.match(html, /js\/dictionary\.js/);
  assert.match(app, /data-action="session-lexicon"/);
  assert.match(app, /data-action="dictionary-lookup"/);
  assert.match(app, /Quel mot manque dans ce passage/);
  assert.match(app, /data-action="memory-recalled"/);
  assert.match(app, /data-action="memory-retry"/);
  assert.doesNotMatch(app, /Quel souvenir aviez-vous gardé/);
  assert.match(dictionary, /fr\.wiktionary/);
  assert.match(dictionary, /fr\.wikipedia/);
  assert.match(dictionary, /action: 'parse'/);
  assert.match(dictionary, /wiktionary-search/);
  assert.match(dictionary, /getElementById\('Français'\)/);
  assert.match(dictionary, /REQUEST_TIMEOUT_MS = 9000/);
  assert.match(store, /REVIEW_OFFSETS = \[1, 3, 5, 30\]/);
  assert.match(store, /reviewLexiconWord/);
});

test('lexique: la recherche tolérante retrouve une définition française', async () => {
  const source = await read('js/dictionary.js');
  const calls = [];
  const frenchDocument = () => {
    const copy = { textContent:'Qui ne dure qu’un jour.', querySelectorAll:() => [] };
    const item = { parentElement:{ closest:() => null }, cloneNode:() => copy };
    const end = { matches:selector => selector === '.mw-heading2, h2', nextElementSibling:null };
    const content = {
      matches:() => false,
      querySelectorAll:selector => selector === 'ol > li' ? [item] : [],
      nextElementSibling:end
    };
    const heading = { nextElementSibling:content };
    const title = { closest:selector => selector === '.mw-heading2' ? heading : null };
    return { getElementById:id => id === 'Français' ? title : null };
  };
  class DOMParser {
    parseFromString(value) { return value === 'FRENCH' ? frenchDocument() : { getElementById:() => null }; }
  }
  const fetch = async endpoint => {
    const action = endpoint.searchParams.get('action');
    const page = endpoint.searchParams.get('page');
    calls.push(`${action}:${page || endpoint.searchParams.get('gsrsearch')}`);
    if (action === 'query') {
      return { ok:true, json:async () => ({ query:{ pages:[
        { index:0, title:'ephemere' }, { index:1, title:'éphémère' }
      ] } }) };
    }
    return { ok:true, json:async () => ({ parse:{ title:page, text:page === 'éphémère' ? 'FRENCH' : 'OTHER' } }) };
  };
  const BT = {};
  const context = {
    window:{ BT }, BT, fetch, DOMParser, URL, URLSearchParams, AbortController,
    setTimeout, clearTimeout, console
  };
  vm.runInNewContext(source, context);
  const found = await context.window.BT.dictionary.lookup('ephemere', 'word');
  assert.equal(found.definition, 'Qui ne dure qu’un jour.');
  assert.equal(found.sourceLabel, 'Wiktionnaire');
  assert.match(found.sourceUrl, /%C3%A9ph%C3%A9m%C3%A8re/);
  assert.deepEqual(calls, ['parse:ephemere', 'query:ephemere', 'parse:éphémère']);
});

test('profil: annuaire réel, amitiés et carnet de badges privés', async () => {
  const [api, auth, app] = await Promise.all([read('js/community-api.js'), read('js/auth.js'), read('js/mvp-app.js')]);
  assert.match(api, /profile_directory/);
  assert.match(api, /friendships/);
  assert.match(api, /profile_shared_details/);
  assert.match(auth, /ensureDirectory/);
  assert.match(app, /plus longue session/);
  assert.match(app, /Dernier badge/);
  assert.match(app, /data-action="open-badges"/);
  assert.match(app, /Tous les badges/);
  assert.match(app, /À acquérir/);
  assert.match(app, /Profil privé · verrouillé avant acceptation/);
  assert.match(app, /Voir l’aperçu/);
});

test('Supabase: l’annuaire minimal et les profils privés sont protégés par RLS', async () => {
  const [directory, shared] = await Promise.all([
    read('supabase/migrations/202608210001_minimal_profile_directory_and_friendships.sql'),
    read('supabase/migrations/202608210002_shareable_profile_details.sql')
  ]);
  assert.match(directory, /profile_directory_select_authenticated/);
  assert.match(directory, /friendships_accept_addressee/);
  assert.doesNotMatch(directory, /\bemail\s+(?:text|varchar)/i);
  assert.match(shared, /profile_visibility = 'public'/);
  assert.match(shared, /f\.status = 'accepted'/);
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

test('Supabase: notifications sociales privées et temps réel', async () => {
  const [html, api, app, store, migration, actorIndex, worker] = await Promise.all([
    read('app.html'), read('js/notifications-api.js'), read('js/mvp-app.js'), read('js/store.js'),
    read('supabase/migrations/202608210003_realtime_social_notifications.sql'),
    read('supabase/migrations/202608210004_index_notification_actors.sql'), read('service-worker.js')
  ]);
  assert.match(html, /js\/notifications-api\.js/);
  assert.match(api, /from\('notifications'\)/);
  assert.match(api, /postgres_changes/);
  assert.match(api, /recipient_id=eq\./);
  assert.match(app, /refreshNotifications/);
  assert.match(app, /markAllNotificationsRead/);
  assert.match(store, /replaceNotifications/);
  assert.match(migration, /alter table public\.notifications enable row level security/);
  assert.match(migration, /notifications_select_own/);
  assert.match(migration, /boopp_notify_friendship/);
  assert.match(migration, /boopp_notify_trace/);
  assert.match(migration, /boopp_notify_encouragement/);
  assert.match(migration, /supabase_realtime add table public\.notifications/);
  assert.match(actorIndex, /notifications_actor_idx/);
  assert.match(worker, /js\/notifications-api\.js/);
});

test('ajout de livre: image réelle, ISBN et saisie manuelle restent disponibles', async () => {
  const [html, app, lookup, store, proxy] = await Promise.all([
    read('app.html'), read('js/mvp-app.js'), read('js/book-lookup.js'), read('js/store.js'),
    read('supabase/functions/isbn-fallback/index.ts')
  ]);
  assert.match(html, /js\/book-lookup\.js/);
  assert.match(app, /data-form="isbn-lookup"/);
  assert.match(app, /data-form="book-search"/);
  assert.match(app, /id="book-isbn-field"/);
  assert.match(app, /id="book-genre-field"/);
  assert.match(app, /data-action="analyze-book-cover"/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /Aucune édition trouvée dans les catalogues consultés/);
  assert.match(app, /Saisie manuelle ou correction/);
  assert.doesNotMatch(app, /reconnaissance de couverture est simulée/i);
  assert.doesNotMatch(app, /case 'recognize-cover'/);
  assert.match(lookup, /www\.googleapis\.com\/books\/v1\/volumes/);
  assert.match(lookup, /openlibrary\.org\/api\/books/);
  assert.match(lookup, /openlibrary\.org\/search\.json/);
  assert.match(lookup, /openlibrary\.org\$\{workKey\}\.json/);
  assert.match(lookup, /www\.chasse-aux-livres\.fr\/search\?query=/);
  assert.match(lookup, /nicebooks\.com\/fr\/search\/isbn\?isbn=/);
  assert.match(lookup, /functions\.invoke\(ISBN_FALLBACK_FUNCTION/);
  assert.match(proxy, /NICEBOOKS_ORIGIN = "https:\/\/nicebooks\.com"/);
  assert.match(proxy, /CHASSE_ORIGIN = "https:\/\/www\.chasse-aux-livres\.fr"/);
  assert.match(proxy, /\/rest\/search-results\?h=/);
  assert.match(proxy, /request\.method !== "POST"/);
  assert.match(proxy, /isValidISBN\(isbn\)/);
  assert.match(proxy, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(proxy, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(lookup, /info\.categories/);
  assert.match(lookup, /work\?\.subjects/);
  assert.match(lookup, /tesseract\.js@7\.0\.0/);
  assert.match(lookup, /BarcodeDetector/);
  assert.match(lookup, /@zxing\/browser@0\.2\.1/);
  assert.match(lookup, /BrowserMultiFormatReader/);
  assert.match(lookup, /COVER_TARGET_BYTES = 360 \* 1024/);
  assert.match(store, /isbn: data\.isbn/);
  await access(path.join(root, 'tests/fixtures/book-cover-ocr.svg'));
  await access(path.join(root, 'tests/fixtures/book-cover-title-ocr.svg'));
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
  assert.equal(Array.from(lookup.isbnVariants('2070360024')).join(','), '2070360024,9782070360024');
  assert.equal(Array.from(lookup.isbnVariants('9782070360024')).join(','), '9782070360024,2070360024');
  const external = Array.from(lookup.externalISBNLinks('9782070360024'));
  assert.equal(external.length, 2);
  assert.match(external[0].url, /query=9782070360024&catalog=fr/);
  assert.match(external[1].url, /isbn=9782070360024/);
});

test('ajout de livre: le proxy Supabase prend automatiquement le relais', async () => {
  const source = await read('js/book-lookup.js');
  const calls = [];
  let publicCalls = 0;
  const BT = {
    auth: {
      getClient: () => ({
        functions: {
          invoke: async (name, options) => {
            calls.push({ name, options });
            return {
              data: { books:[{ source:'NiceBooks', isbn:'9782070360024', title:"L'étranger", authors:['Albert Camus'], publisher:'FOLIO', totalPages:191 }] },
              error: null
            };
          }
        }
      })
    }
  };
  const fetch = async url => {
    publicCalls += 1;
    return {
      ok: true,
      json: async () => String(url).includes('openlibrary.org/search.json') ? { docs:[] }
        : String(url).includes('openlibrary.org/api/books') ? {}
        : { items:[] }
    };
  };
  const context = {
    window:{ BT, setTimeout, clearTimeout }, BT, fetch, URLSearchParams, AbortController,
    encodeURIComponent, console
  };
  vm.runInNewContext(source, context);
  const results = await context.window.BT.bookLookup.lookupISBN('9782070360024');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'isbn-fallback');
  assert.equal(calls[0].options.body.isbn, '9782070360024');
  assert.equal(results[0].source, 'NiceBooks');
  assert.equal(results[0].title, "L'étranger");
  assert.equal(publicCalls, 5, 'un résultat du proxy ne doit pas relancer les catalogues publics');
});

test('ajout de livre: une recherche ISBN vide peut être relancée', async () => {
  const source = await read('js/book-lookup.js');
  let invokeCalls = 0;
  const BT = {
    auth: {
      getClient: () => ({ functions:{ invoke:async () => {
        invokeCalls += 1;
        return { data:{ books:[] }, error:null };
      } } })
    }
  };
  const fetch = async url => ({
    ok:true,
    json:async () => String(url).includes('openlibrary.org/search.json') ? { docs:[] }
      : String(url).includes('openlibrary.org/api/books') ? {}
      : { items:[] }
  });
  const context = {
    window:{ BT, setTimeout, clearTimeout }, BT, fetch, URLSearchParams, AbortController,
    encodeURIComponent, console
  };
  vm.runInNewContext(source, context);
  await context.window.BT.bookLookup.lookupISBN('9782070360024');
  await context.window.BT.bookLookup.lookupISBN('9782070360024');
  assert.equal(invokeCalls, 2, 'un résultat vide ne doit pas rester bloqué dans le cache');
});

test('modèle local: plusieurs sessions, un seul chrono et rappels persistants', async () => {
  const source = await read('js/store.js');
  const memory = new Map();
  const localStorage = {
    getItem:key => memory.has(key) ? memory.get(key) : null,
    setItem:(key,value) => memory.set(key,String(value)),
    removeItem:key => memory.delete(key)
  };
  const BT = {};
  const context = { BT, window:{ BT, addEventListener(){} }, localStorage, navigator:{ onLine:true }, console, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const store = context.window.BT.store;
  store.startActiveSession('book-etranger');
  store.startActiveSession('book-dune');
  let active = store.getActiveSessions();
  assert.equal(active.length, 2);
  assert.equal(active.filter(session => session.status === 'running').length, 1);
  store.focusActiveSession(active[0].id);
  store.resumeActiveSession(active[0].id);
  active = store.getActiveSessions();
  assert.equal(active.filter(session => session.status === 'running').length, 1);
  const reviewed = store.reviewLexiconWord('lex-1', true);
  assert.ok(reviewed.reviewSchedule[0].completedAt);
  assert.equal(reviewed.reviewSchedule.find(stage => !stage.completedAt).day, 3);
  const shelved = store.addBook({ title:'Un essai rangé', author:'Lectrice test', genre:'Essais' });
  assert.equal(shelved.genre, 'Essais');
  store.saveSettings({ collapsedLibraryGenres:['essais'] });
  assert.equal(store.getSettings().collapsedLibraryGenres.join(','), 'essais');
  const monthKey = store.localDateKey().slice(0, 7);
  const finished = store.addBook({ title:'Objectif terminé', author:'Lectrice test', status:'lu', completedAt:`${monthKey}-10T12:00:00.000Z` });
  const planned = store.addBook({ title:'Objectif à venir', author:'Lectrice test', status:'a-lire' });
  store.updateGoal('month', { targetBooks:2, bookIds:[finished.id] });
  assert.equal(store.getGoalProgress().month.value, 1);
  store.updateGoal('month', { targetBooks:2, bookIds:[planned.id] });
  assert.equal(store.getGoalProgress().month.value, 0);
  store.updateGoal('year', { targetBooks:2, bookIds:[finished.id] });
  assert.equal(store.getGoalProgress().year.value, 1);
  store.updateGoal('year', { targetBooks:2, bookIds:[planned.id] });
  assert.equal(store.getGoalProgress().year.value, 0);
  assert.match(memory.get('boop_mvp_v5'), /reviewSuccesses/);
});

test('rapport mensuel: image Instagram et notes personnelles sur consentement', async () => {
  const [html, app, report, css] = await Promise.all([read('app.html'), read('js/mvp-app.js'), read('js/monthly-report.js'), read('css/mvp-v5.css')]);
  assert.match(html, /js\/monthly-report\.js/);
  assert.match(app, /data-action="open-monthly-report"/);
  assert.match(app, /name="includePersonalNotes"/);
  assert.match(app, /data-action="share-monthly-report"/);
  assert.match(report, /const WIDTH = 1080/);
  assert.match(report, /const HEIGHT = 1350/);
  assert.match(report, /navigator\.canShare/);
  assert.match(css, /\.monthly-report-preview/);

  const context = { window:{ BT:{} }, Intl, Date, console };
  vm.runInNewContext(report, context);
  const key = new Date().toISOString().slice(0, 7), at = `${key}-10T12:00:00.000Z`;
  const state = { profile:{ name:'Lina', handle:'@lina' }, books:[{ title:'Le Livre', authors:['A. Auteur'], libraryState:'library', status:'lu', completedAt:at }], sessions:[{ startedAt:at, durationSeconds:3600, note:'Une note privée' }], lexicon:[{ kind:'word', word:'Clairière', definition:'Une ouverture.', createdAt:at }], traces:[{ text:'Une Trace privée', createdAt:at }] };
  const withoutNotes = context.window.BT.monthlyReport.buildData(state, key, false);
  const withNotes = context.window.BT.monthlyReport.buildData(state, key, true);
  assert.equal(withoutNotes.books.length, 1);
  assert.equal(withoutNotes.minutes, 60);
  assert.equal(withoutNotes.notes.length, 0);
  assert.ok(withNotes.notes.length >= 1);
});

test('mobile: aucun défilement horizontal, y compris dans les dialogues', async () => {
  const css = await read('css/mvp-v5.css');
  assert.match(css, /overscroll-behavior-x: none/);
  assert.match(css, /\.dialog-body \{[^}]*overflow-x: (?:hidden|clip)/);
  assert.match(css, /\.app-dialog \{[^}]*overflow-x: (?:hidden|clip)/);
  assert.match(css, /\.tabs \{ flex-wrap: wrap; overflow-x: clip/);
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
  assert.match(worker, /boo-p-webapp-v13/);
  assert.match(worker, /js\/book-lookup\.js/);
  assert.match(worker, /js\/dictionary\.js/);
  assert.match(worker, /js\/monthly-report\.js/);
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

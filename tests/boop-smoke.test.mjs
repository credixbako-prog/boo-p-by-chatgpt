import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('connexion, inscription et récupération: les mots de passe disposent d’un contrôle de visibilité', async () => {
  const [html, script] = await Promise.all([read('index.html'), read('js/landing.js')]);
  assert.equal((html.match(/data-password-toggle=/g) || []).length, 5);
  assert.match(script, /Votre sentier attend son premier pas/);
});

test('onboarding: quatre étapes, choix facultatif de cinq livres, objectif et thème libre', async () => {
  const [html, script, catalog, store, app, css] = await Promise.all([read('onboarding.html'), read('js/onboarding.js'), read('js/onboarding-catalog.js'), read('js/store.js'), read('js/mvp-app.js'), read('css/mvp-v5.css')]);
  assert.equal((html.match(/class="step-wrapper/g) || []).length, 4);
  assert.doesNotMatch(html, /id="step5"/);
  assert.equal((html.match(/class="indicator-dot/g) || []).length, 4);
  assert.match(html, /id="customTheme"/);
  assert.match(html, /data-goal-preset="30"/);
  assert.match(script, /book-tile__cover/);
  assert.match(html, /id="bookSparks"/);
  assert.match(script, /Pourquoi ce livre vous a-t-il marqué/);
  assert.match(script, /initialTraces/);
  assert.match(script, /type:'onboarding'/);
  assert.match(script, /BT\.store\.saveTrace/);
  assert.match(script, /setTimeout\(finishOnboarding/);
  assert.match(script, /const visibility = 'private'/);
  assert.match(script, /MAX_SELECTED_BOOKS = 5/);
  assert.match(script, /Passer cette étape/);
  assert.match(html, /jusqu’à 5 livres/i);
  assert.match(html, /js\/onboarding-catalog\.js/);
  assert.match(html, /capture="environment"/);
  assert.match(script, /scanPhysicalBook/);
  assert.match(script, /scanISBNFromImage/);
  const catalogContext = { window:{} };
  vm.runInNewContext(catalog, catalogContext);
  const onboardingBooks = catalogContext.window.BT.ONBOARDING_BOOKS;
  assert.ok(onboardingBooks.length >= 20);
  assert.ok(Math.min(...onboardingBooks.map(book => book.year)) < 1900);
  assert.ok(Math.max(...onboardingBooks.map(book => book.year)) >= 2023);
  for (const title of ['Les Misérables', 'L’Étranger', 'Harry Potter à l’école des sorciers', 'Americanah', 'La Femme de ménage', 'La Dernière Allumette']) {
    assert.match(catalog, new RegExp(title));
  }
  assert.match(app, /dnaBooksRemaining/);
  assert.match(app, /dnaBookTarget = 10/);
  assert.match(app, /livres ajoutés/);
  assert.match(app, /data-action="add-book"/);
  assert.match(css, /\.dna-onboarding-nudge/);
  assert.match(store, /makeEmptyAccountState/);
});

test('nouveau compte: la bibliothèque commence vide avant les choix de l’onboarding', async () => {
  const source = await read('js/store.js');
  const memory = new Map();
  const localStorage = {
    getItem:key => memory.has(key) ? memory.get(key) : null,
    setItem:(key,value) => memory.set(key,String(value)),
    removeItem:key => memory.delete(key)
  };
  const BT = {};
  const context = { BT, window:{ BT, addEventListener(){} }, localStorage, navigator:{ onLine:true }, console, Date, Math, JSON, Set, Map, Intl };
  vm.runInNewContext(source, context);
  context.BT.store.useUser('new-reader');
  assert.equal(context.BT.store.getBooks().length, 0);
  assert.equal(context.BT.store.getTraces().length, 0);
});

test('mémoire, communauté et parcours exposent les fonctions demandées', async () => {
  const [app, store, css] = await Promise.all([read('js/mvp-app.js'), read('js/store.js'), read('css/mvp-v5.css')]);
  assert.match(app, /\$\{memory\.length\} carte/);
  assert.match(app, /Trace · \$\{comments\.length\}/);
  assert.match(app, /Photo facultative/);
  assert.match(app, /customBookTitle/);
  assert.doesNotMatch(app, /Ne plus rendre actif/);
  assert.match(app, /data-action="wishlist-recommendation"/);
  assert.match(app, /data-action="dismiss-recommendation"/);
  assert.match(app, /data-action="refresh-recommendations"/);
  assert.match(app, /data-change="goal-all-books"/);
  assert.match(app, /data-change="goal-book"/);
  assert.match(app, /class="bookcase bookcase--\$\{finish\}"/);
  assert.match(app, /class="genre-shelf"/);
  assert.match(app, /class="physical-shelf"/);
  assert.match(app, /class="book-spine \$\{selected/);
  assert.match(app, /class="book-spine__peek"/);
  assert.match(app, /data-action="select-book"/);
  assert.match(app, /selectedLibraryBookId/);
  assert.match(app, /Touchez une première fois pour sélectionner/);
  assert.match(app, /data-change="library-sort"/);
  assert.match(app, /Suggestions BOO-P · analyse locale/);
  assert.match(store, /post-10/);
  assert.match(store, /activeSessions/);
  assert.match(store, /pauseOtherRunningSessions/);
  assert.match(store, /libraryState/);
  assert.match(store, /mediaType/);
  assert.match(store, /collapsedLibraryGenres/);
  assert.match(store, /genre: genres\[0\]/);
  assert.match(app, /surfaceColorPicker\('memory-card-color'/);
  assert.match(app, /memory-list--\$\{memoryColor\}/);
  assert.match(store, /memoryCardColor: 'sage'/);
  assert.match(app, /surfaceColorPicker\('quiz-card-color'/);
  assert.match(store, /quizCardColor: 'terracotta'/);
  assert.match(css, /\.surface-color-picker/);
  assert.match(css, /\.quiz-surface--black/);
  assert.match(css, /\.memory-list \{[^}]*display: grid;[^}]*gap: 10px/);
  assert.match(css, /\.memory-list--black/);
  assert.match(css, /\.book-spine span/);
  assert.match(css, /\.book-spine\.is-selected/);
  assert.match(css, /translateY\(-19px\)/);
  assert.match(css, /writing-mode: vertical-rl/);
  assert.doesNotMatch(css, /\.memory-list \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(css, /\.public-feed \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(css, /\.physical-shelf \{[^}]*overflow-y: auto/);
});

test('lecture: dates éditables, étoiles et sélection de bibliothèque sans friction', async () => {
  const [app, store, css] = await Promise.all([read('js/mvp-app.js'), read('js/store.js'), read('css/mvp-v5.css')]);
  const sessionView = app.slice(app.indexOf('function renderSessionPositionSlider'), app.indexOf('function tickSessionClock'));
  assert.match(app, /name="startedAt"/);
  assert.match(app, /name="completedAt"/);
  assert.match(app, /Date de fin de lecture/);
  assert.match(app, /ratingPicker\(book\?\.rating, 'book-rating'\)/);
  assert.match(app, /Note de 1 à 5 étoiles/);
  assert.match(app, /ratingStars\(book\.rating\)/);
  assert.doesNotMatch(app, /🔖|Choisissez un signet/);
  assert.doesNotMatch(sessionView, /data-action="quick-trace"/);
  assert.match(sessionView, /data-action="session-lexicon"/);
  assert.match(sessionView, /type="range"/);
  assert.match(sessionView, /data-session-page-output/);
  assert.match(sessionView, /<label class="field" for="session-citation-draft">Citation/);
  assert.match(sessionView, /data-action="save-session-citation"/);
  assert.match(sessionView, /session-citation-list/);
  assert.doesNotMatch(sessionView, /Note de session/);
  assert.match(store, /addActiveSessionCitation/);
  assert.match(app, /includeCitation:false/);
  assert.match(app, /Les citations se saisissent directement dans la session de lecture/);
  assert.match(app, /function clearLibraryBookSelection/);
  assert.match(app, /clickedSpine\?\.dataset\.id !== ui\.selectedLibraryBookId/);
  assert.match(store, /normalizeBookDate/);
  assert.match(css, /\.rating-button\.is-filled/);
  assert.match(css, /\.book-rating-stars/);
});

test('lexique: dictionnaire, questions ciblées et répétition espacée', async () => {
  const [html, app, dictionary, store] = await Promise.all([read('app.html'), read('js/mvp-app.js'), read('js/dictionary.js'), read('js/store.js')]);
  assert.match(html, /js\/dictionary\.js/);
  assert.match(app, /data-action="session-lexicon"/);
  assert.match(app, /data-action="dictionary-lookup"/);
  assert.match(app, /Quiz de lecture/);
  assert.match(app, /Expression en situation/);
  assert.match(app, /Dans quel livre trouve-t-on cette citation/);
  assert.match(app, /Qui est l’auteur de cette citation/);
  assert.match(app, /filter\(item => item\.kind === 'word'\)/);
  assert.match(app, /data-action="flip-memory"/);
  assert.match(app, /data-action="memory-rate"/);
  assert.match(app, /data-quality="retry"/);
  assert.match(app, /data-quality="almost"/);
  assert.match(app, /data-quality="recalled"/);
  assert.match(app, /Sérendipité/);
  assert.match(app, /items\.slice\(0, 10\)/);
  assert.match(app, /data-memory-carousel/);
  assert.match(app, /normalizedQuality === 'recalled'/);
  assert.match(app, /ui\.memoryDeckKeys\.push\(next\.memoryKey\)/);
  assert.doesNotMatch(app, /Quel souvenir aviez-vous gardé/);
  assert.match(dictionary, /fr\.wiktionary/);
  assert.match(dictionary, /fr\.wikipedia/);
  assert.match(dictionary, /action: 'parse'/);
  assert.match(dictionary, /wiktionary-search/);
  assert.match(dictionary, /getElementById\('Français'\)/);
  assert.match(dictionary, /REQUEST_TIMEOUT_MS = 9000/);
  assert.match(dictionary, /dictionnaire\.lerobert\.com\/definition/);
  assert.match(dictionary, /larousse\.fr\/dictionnaires\/francais/);
  assert.match(app, /data-action="dictionary-choice"/);
  assert.match(store, /REVIEW_OFFSETS = \[1, 3, 7, 14, 30\]/);
  assert.match(store, /reviewLexiconWord/);
});

test('bibliothèque: sentier arborescent et carnet filtrable', async () => {
  const [app, css] = await Promise.all([read('js/mvp-app.js'), read('css/mvp-v5.css')]);
  assert.match(app, /label: 'Bibliothèque'/);
  assert.match(app, /class="gallery-nav-glyph"/);
  assert.match(css, /\.nav-link__icon \{ display: grid; width: 24px; height: 24px; place-items: center;/);
  assert.match(css, /\.gallery-nav-glyph \{[^}]*transform: translate\(-4px,-4px\)/);
  assert.match(app, /\['library','Livres'\]/);
  assert.match(app, /\['trail','Sentier'\]/);
  assert.match(app, /\['notebook','Carnet'\]/);
  assert.match(app, /\['lexicon','Lexique'\]/);
  assert.doesNotMatch(app, /const tabs = \[\['overview','Profil'\],\['goals','Objectifs'\]\]/);
  assert.match(app, /id="profile-goals"/);
  assert.match(app, /href="#profile\?section=goals"/);
  assert.match(app, /filter\(book => book\.libraryState === 'library'\)/);
  assert.match(app, /data-change="trail-year"/);
  assert.match(app, /data-change="trail-status"/);
  assert.match(app, /class="trail-canvas-shell"/);
  assert.match(app, /class="trail-canvas-book/);
  assert.match(app, /class="trail-genre-node/);
  assert.match(app, /data-action="trail-zoom-in"/);
  assert.match(app, /data-action="trail-zoom-out"/);
  assert.match(app, /data-action="trail-zoom-fit"/);
  assert.match(app, /addEventListener\('touchmove', handleTrailPinchMove, \{ passive:false \}\)/);
  assert.match(app, /function handleTrailPinchStart\(event\)/);
  assert.match(app, /function handleTrailPinchMove\(event\)/);
  assert.match(app, /pincez à deux doigts pour zoomer/);
  assert.match(app, /Commentaires/);
  assert.match(app, /Notes & Traces/);
  assert.match(app, /window\.BT\.trailMindmap/);
  assert.match(app, /data-action="notebook-filter"/);
  assert.match(css, /\.trail-map-controls/);
  assert.match(css, /\.trail-genre-node/);
  assert.match(css, /data:image\/svg\+xml/);
  assert.match(css, /\.lexicon-filter-fab/);
  assert.match(app, /class="notebook-text"/);
  assert.match(css, /\.lexicon-filter-fab__menu \{ position: absolute; top:/);
});

test('communauté: adhésions, salons et messages sont persistants et protégés', async () => {
  const [app, api, store, migration, hardening, clubSpaces] = await Promise.all([
    read('js/mvp-app.js'),
    read('js/community-api.js'),
    read('js/store.js'),
    read('supabase/migrations/20260825154647_reading_club_members_and_salons.sql'),
    read('supabase/migrations/20260825161100_harden_reading_community_helpers.sql'),
    read('supabase/migrations/20260825173002_reading_club_spaces.sql')
  ]);
  assert.match(api, /async function listClubs/);
  assert.match(api, /async function listSalons/);
  assert.match(api, /async function addClubMember/);
  assert.match(api, /async function createSalonMessage/);
  assert.match(api, /async function getClubSpace/);
  assert.match(api, /async function createClubPost/);
  assert.match(api, /async function toggleClubPostEncouragement/);
  assert.match(app, /data-form="club-edit"/);
  assert.match(app, /data-form="club-member"/);
  assert.match(app, /data-form="salon-message"/);
  assert.match(app, /class="club-space-layout"/);
  assert.match(app, /data-form="club-post"/);
  assert.match(app, /data-form="club-comment"/);
  assert.match(store, /replaceRemoteClubs/);
  assert.match(store, /replaceRemoteSalons/);
  assert.match(migration, /create table if not exists public\.reading_club_members/);
  assert.match(migration, /create table if not exists public\.reading_salons/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update, delete/);
  assert.match(hardening, /create schema if not exists private/);
  assert.match(hardening, /revoke all on schema private from public, anon/);
  assert.match(clubSpaces, /create table public\.reading_club_books/);
  assert.match(clubSpaces, /create table public\.reading_club_posts/);
  assert.match(clubSpaces, /create table public\.reading_club_comments/);
  assert.match(clubSpaces, /create table public\.reading_club_encouragements/);
  assert.match(clubSpaces, /enable row level security/);
});

test('objectifs: le mois conserve sa sélection et l’année calcule automatiquement les demi-livres', async () => {
  const source = await read('js/store.js');
  const values = new Map();
  const localStorage = {
    getItem:key => values.has(key) ? values.get(key) : null,
    setItem:(key,value) => values.set(key, String(value)),
    removeItem:key => values.delete(key)
  };
  const BT = {};
  const context = {
    window:{ BT, addEventListener(){} }, BT, localStorage,
    navigator:{ onLine:true }, console, Date, Math, JSON, Set, Map
  };
  vm.runInNewContext(source, context);
  const store = context.BT.store;
  store.getBooks().forEach(book => store.deleteBook(book.id));
  const monthKey = store.localDateKey().slice(0, 7);
  const finished = store.addBook({ title:'Terminé ce mois', author:'Lectrice test', status:'lu', completedAt:`${monthKey}-02T12:00:00.000Z` });
  const reading = store.addBook({ title:'Lecture en cours', author:'Lectrice test', status:'en-cours' });
  const paused = store.addBook({ title:'Lecture en pause', author:'Lectrice test', status:'en-pause' });
  const abandoned = store.addBook({ title:'Lecture abandonnée', author:'Lectrice test', status:'abandonne' });
  const selected = [finished.id,reading.id];
  store.updateGoal('month', { targetBooks:2, bookIds:selected });
  store.updateGoal('year', { targetBooks:4, bookIds:[abandoned.id] });
  const progress = store.getGoalProgress();
  assert.equal(progress.month.value, 1);
  assert.equal(progress.month.inProgress, 1);
  assert.equal(progress.month.greenPct, 50);
  assert.equal(progress.month.orangePct, 50);
  assert.equal(progress.year.value, 1);
  assert.equal(progress.year.inProgress, 2);
  assert.equal(progress.year.filledValue, 2);
  assert.equal(progress.year.greenPct, 25);
  assert.equal(progress.year.orangePct, 25);
  assert.equal(progress.year.selectedBookIds.length, 0);
  assert.equal(progress.year.bookScores[reading.id], .5);
  assert.equal(progress.year.bookScores[paused.id], .5);
  assert.equal(progress.year.bookScores[abandoned.id], undefined);
  const historical = store.addBook({ title:'Lecture d’avant BOO-P datée', author:'Lectrice test', status:'lu', historicalBeforeJoin:true, completedAt:`${monthKey}-03T12:00:00.000Z` });
  store.updateGoal('month', { targetBooks:1, bookIds:[historical.id] });
  store.updateGoal('year', { targetBooks:10, bookIds:[historical.id] });
  assert.equal(store.getGoalProgress().month.value, 1, 'une lecture antérieure à l’inscription compte si sa date appartient au mois');
  assert.equal(store.getGoalProgress().year.value, 2, 'une lecture antérieure à l’inscription compte si sa date appartient à l’année');
  const undatedHistorical = store.addBook({ title:'Lecture d’avant BOO-P non datée', author:'Lectrice test', status:'lu', historicalBeforeJoin:true });
  store.updateGoal('month', { targetBooks:1, bookIds:[undatedHistorical.id] });
  assert.equal(store.getGoalProgress().month.value, 0, 'une lecture historique sans date ne doit pas être attribuée à une période arbitraire');
});

test('objectifs: l’écran montre les livres concernés et leur état daté', async () => {
  const [app, css] = await Promise.all([read('js/mvp-app.js'), read('css/mvp-v5.css')]);
  assert.match(app, /function goalBooksBlock/);
  assert.match(app, /Livres concernés/);
  assert.match(app, /Toute la bibliothèque/);
  assert.match(app, /hors période/);
  assert.match(app, /completedAt: status === 'lu' \? readingDateISO\(completedDate\) : null/);
  assert.match(css, /\.goal-book-list/);
  assert.match(css, /\.goal-books-more/);
  assert.match(css, /\.goal-accordion/);
  assert.match(app, /L’objectif annuel ne demande plus aucune sélection manuelle/);
  assert.match(app, /updates\.bookIds = period === 'year' \? \[\]/);
});

test('bibliothèque: six finitions visuelles et rayons horizontaux restent contenus', async () => {
  const [app, store, css] = await Promise.all([read('js/mvp-app.js'), read('js/store.js'), read('css/mvp-v5.css')]);
  assert.match(app, /\['terracotta','Terracotta'\]/);
  assert.match(app, /\['blue','Bleu'\]/);
  assert.match(app, /\['sage','Vert sauge'\]/);
  assert.match(app, /\['red','Rouge'\]/);
  assert.match(app, /\['black','Noir'\]/);
  assert.match(app, /\['white','Blanc'\]/);
  assert.doesNotMatch(app, /<span aria-hidden="true"><\/span>\$\{label\}<\/button>/);
  assert.match(store, /libraryFinish: 'terracotta'/);
  assert.match(store, /sessionCardColor: 'sage'/);
  assert.match(app, /surfaceColorPicker\('session-card-color'/);
  assert.match(app, /class="active-book-actions"/);
  assert.match(css, /\.active-book-card--black/);
  assert.match(css, /\.goal-mini \{[^}]*grid-template-rows:/);
  assert.match(css, /\.physical-shelf \{[^}]*overflow-x: auto/);
  assert.match(css, /\.bookcase--blue/);
  assert.match(css, /\.bookcase--sage/);
  assert.match(css, /\.bookcase--red/);
  assert.match(css, /\.bookcase--black/);
  assert.match(css, /\.bookcase--white/);
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
  const [api, auth, app, store, css] = await Promise.all([read('js/community-api.js'), read('js/auth.js'), read('js/mvp-app.js'), read('js/store.js'), read('css/mvp-v5.css')]);
  assert.match(api, /profile_directory/);
  assert.match(api, /friendships/);
  assert.match(api, /profile_shared_details/);
  assert.match(auth, /ensureDirectory/);
  assert.match(app, /plus longue session/);
  assert.match(app, /Dernier badge/);
  assert.match(app, /data-action="open-badges"/);
  assert.match(app, /Tous les badges/);
  assert.match(app, /À acquérir/);
  assert.match(app, /data-action="open-dna-history"/);
  assert.match(app, /Évolution de votre ADN/);
  assert.doesNotMatch(app, /data-action="edit-adn"/);
  assert.match(store, /function getReaderDNA/);
  assert.match(store, /readerDNA: \{ snapshots:\[\]/);
  assert.match(css, /\.reader-dna-card/);
  assert.match(css, /\.dna-history-card/);
  assert.match(app, /Profil privé · verrouillé avant acceptation/);
  assert.match(app, /Voir l’aperçu/);
});

test('profil: photo compressée, privée et visible dans le profil et l’annuaire', async () => {
  const [auth, api, app, store, css, migration] = await Promise.all([
    read('js/auth.js'), read('js/community-api.js'), read('js/mvp-app.js'), read('js/store.js'),
    read('css/mvp-v5.css'), read('supabase/migrations/20260908154010_profile_avatars.sql')
  ]);
  assert.match(auth, /AVATAR_BUCKET = 'profile-avatars'/);
  assert.match(auth, /AVATAR_EDGE = 512/);
  assert.match(auth, /function prepareAvatar/);
  assert.match(auth, /createSignedUrl\(path, 3600\)/);
  assert.match(auth, /async function updateAvatar/);
  assert.match(auth, /async function removeAvatar/);
  assert.match(api, /avatar_path/);
  assert.match(api, /signedAvatarUrl/);
  assert.match(app, /id="profile-photo-file"/);
  assert.match(app, /data-action="remove-profile-photo"/);
  assert.match(app, /avatarBubble\(profile,'profile-avatar'\)/);
  assert.match(store, /avatarPath: ''/);
  assert.match(css, /\.profile-photo-preview/);
  assert.match(migration, /values \('profile-avatars', 'profile-avatars', false, 1048576/);
  assert.match(migration, /profile_avatars_insert_own/);
  assert.match(migration, /profile_avatars_update_own/);
  assert.match(migration, /name = \(select auth\.uid\(\)\)::text \|\| '\/avatar\.jpg'/);
  assert.match(migration, /allowed_mime_types/);
});

test('ADN: le portrait automatique conserve un historique sans dépendre des résultats du quiz', async () => {
  const source = await read('js/store.js');
  const memory = new Map();
  const localStorage = {
    getItem:key => memory.has(key) ? memory.get(key) : null,
    setItem:(key,value) => memory.set(key,String(value)),
    removeItem:key => memory.delete(key)
  };
  const BT = {};
  const context = { BT, window:{ BT, addEventListener(){} }, localStorage, navigator:{ onLine:true }, console, Date, Math, JSON, Set, Map, Intl };
  vm.runInNewContext(source, context);
  const store = context.BT.store;
  const initial = store.getReaderDNA();
  assert.ok(initial.phrase.length > 40);
  assert.ok(initial.fragments.length >= 3);
  assert.equal(initial.history.length, 1);
  store.reviewLexiconWord('lex-1', 'recalled');
  assert.equal(store.getReaderDNA().history.length, 1, 'un résultat de mémorisation ne change pas l’ADN');
  for (const word of ['Nuance','Élan','Lisière']) store.addLexiconWord({ kind:'word', word, definition:`Définition de ${word}` });
  const evolved = store.getReaderDNA();
  assert.equal(evolved.history.length, 2);
  assert.match(memory.get('boop_mvp_v5'), /readerDNA/);
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

test('mode invité: essai complet local et lecture publique sans mutation anonyme', async () => {
  const [index, appHtml, landing, auth, app, community, migration] = await Promise.all([
    read('index.html'), read('app.html'), read('js/landing.js'), read('js/auth.js'), read('js/mvp-app.js'),
    read('js/community-api.js'), read('supabase/migrations/20260825223307_user_data_sync_and_guest_public_reads.sql')
  ]);
  assert.match(index, /data-guest-open/);
  assert.match(appHtml, /id="guest-banner"/);
  assert.match(landing, /enterGuestMode/);
  assert.match(auth, /function isGuest/);
  assert.match(app, /localOwner = guest \? 'guest'/);
  assert.match(app, /Trace conservée uniquement sur cet appareil/);
  assert.match(community, /if \(window\.BT\.auth\?\.isGuest\?\.\(\)\) return null/);
  assert.match(migration, /community_posts_select_public_anon/);
  assert.match(migration, /revoke all on table public\.user_books/);
});

test('synchronisation: bibliothèque, sessions, Traces, lexiques et objectifs sont privés', async () => {
  const [appHtml, app, store, api, migration] = await Promise.all([
    read('app.html'), read('js/mvp-app.js'), read('js/store.js'), read('js/user-data-sync-api.js'),
    read('supabase/migrations/20260825223307_user_data_sync_and_guest_public_reads.sql')
  ]);
  assert.match(appHtml, /js\/user-data-sync-api\.js/);
  assert.match(app, /bootstrapUserDataSync/);
  assert.match(app, /mergeSnapshot/);
  assert.doesNotMatch(app, /replaceRemote:true/);
  assert.match(store, /function replaceSyncedData/);
  assert.match(store, /function markDataSynced/);
  assert.match(api, /user_books/);
  assert.match(api, /user_reading_sessions/);
  assert.match(api, /user_traces/);
  assert.match(api, /user_lexicon_entries/);
  assert.match(api, /user_reading_goals/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /auth\.uid\(\)\) = user_id/);
});

test('notifications: un chat endormi accompagne l’état vide', async () => {
  const [app, css] = await Promise.all([read('js/mvp-app.js'), read('css/mvp-v5.css')]);
  assert.match(app, /class="notification-sleeper"/);
  assert.match(css, /\.notification-sleeper \{ width: 136px; height: 84px; background:/);
  assert.match(css, /\.notification-sleeper > span \{ display: none;/);
  assert.match(css, /@keyframes sleeper-z/);
});

test('ajout de livre: photo du code ISBN et saisie manuelle restent disponibles', async () => {
  const [html, app, lookup, store, proxy] = await Promise.all([
    read('app.html'), read('js/mvp-app.js'), read('js/book-lookup.js'), read('js/store.js'),
    read('supabase/functions/isbn-fallback/index.ts')
  ]);
  assert.match(html, /js\/book-lookup\.js/);
  assert.match(app, /data-form="isbn-lookup"/);
  assert.doesNotMatch(app, /data-form="book-search"/);
  assert.match(app, /id="book-isbn-field"/);
  assert.match(app, /id="book-genre-field"/);
  assert.match(app, /knownGenres\.concat\(DEFAULT_GENRES\)/);
  assert.match(app, /Les rayons déjà présents dans votre bibliothèque sont proposés en premier/);
  assert.match(app, /data-action="scan-book-isbn"/);
  assert.match(app, /capture="environment"/);
  assert.match(app, /La photo reste sur cet appareil et n’est pas enregistrée comme couverture/);
  assert.doesNotMatch(app, /Rechercher par titre ou auteur/);
  assert.doesNotMatch(app, /Reconnaître la couverture/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /Aucune édition trouvée après plusieurs tentatives automatiques/);
  assert.doesNotMatch(app, /Poursuivez la recherche préremplie/);
  assert.doesNotMatch(app, /externalISBNFallback/);
  assert.match(app, /Saisie manuelle ou correction/);
  assert.doesNotMatch(app, /reconnaissance de couverture est simulée/i);
  assert.doesNotMatch(app, /case 'recognize-cover'/);
  assert.match(lookup, /www\.googleapis\.com\/books\/v1\/volumes/);
  assert.match(lookup, /openlibrary\.org\/api\/books/);
  assert.match(lookup, /openlibrary\.org\/search\.json/);
  assert.match(lookup, /openlibrary\.org\$\{workKey\}\.json/);
  assert.match(lookup, /functions\.invoke\(ISBN_FALLBACK_FUNCTION/);
  assert.match(lookup, /ISBN_FALLBACK_ATTEMPTS = 2/);
  assert.doesNotMatch(lookup, /externalISBNLinks/);
  assert.match(proxy, /NICEBOOKS_ORIGIN = "https:\/\/nicebooks\.com"/);
  assert.match(proxy, /CHASSE_ORIGIN = "https:\/\/www\.chasse-aux-livres\.fr"/);
  assert.match(proxy, /\/rest\/search-results\?h=/);
  assert.match(proxy, /SOURCE_ATTEMPTS = 3/);
  assert.match(proxy, /Promise\.all\(\[/);
  assert.match(proxy, /lookupWithRetries/);
  assert.match(proxy, /containsISBN\(html, isbn\)/, 'NiceBooks expose l’ISBN hors du bloc résultat');
  assert.match(proxy, /cachedBook\(isbn\)/);
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
  assert.match(lookup, /scanISBNFromImage/);
  assert.match(lookup, /findISBNInText/);
  assert.doesNotMatch(lookup, /ocrQueries|scoreOCRResult|analyzeCover/);
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
  assert.equal(Array.from(lookup.isbnVariants('2070360024')).join(','), '2070360024,9782070360024');
  assert.equal(Array.from(lookup.isbnVariants('9782070360024')).join(','), '9782070360024,2070360024');
  assert.equal(lookup.externalISBNLinks, undefined);
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
            if (calls.length === 1) return { data:{ books:[] }, error:null };
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
  assert.equal(calls.length, 2, 'une réponse vide doit être retentée sans action de l’utilisateur');
  assert.equal(calls[0].name, 'isbn-fallback');
  assert.equal(calls[0].options.body.isbn, '9782070360024');
  assert.equal(results[0].source, 'NiceBooks');
  assert.equal(results[0].title, "L'étranger");
  assert.equal(publicCalls, 3, 'le proxy doit démarrer en parallèle des catalogues publics');
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
  assert.equal(invokeCalls, 4, 'chaque recherche vide doit être retentée et ne pas rester bloquée dans le cache');
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
  store.updateActiveSession({ citationDraft:'Première citation' });
  store.addActiveSessionCitation('Première citation');
  store.addActiveSessionCitation('Deuxième citation');
  const sessionWithCitations = store.getActiveSession();
  assert.equal(sessionWithCitations.citations.length, 2);
  assert.equal(sessionWithCitations.citationDraft, '');
  assert.equal(store.getLexicon().filter(item => item.kind === 'citation' && item.sessionId === sessionWithCitations.id).length, 2);
  const almost = store.reviewLexiconWord('lex-1', 'almost');
  assert.equal(almost.lastReviewQuality, 'almost');
  assert.equal(almost.reviewAlmosts, 1);
  const reviewed = store.reviewLexiconWord('lex-1', true);
  assert.ok(reviewed.reviewSchedule[0].completedAt);
  assert.equal(reviewed.reviewSchedule.find(stage => !stage.completedAt).day, 3);
  const shelved = store.addBook({ title:'Un essai rangé', author:'Lectrice test', genre:'Essais' });
  assert.equal(shelved.genre, 'Essais');
  store.saveSettings({ collapsedLibraryGenres:['essais'] });
  assert.equal(store.getSettings().collapsedLibraryGenres.join(','), 'essais');
  const monthKey = store.localDateKey().slice(0, 7);
  const finished = store.addBook({ title:'Objectif terminé', author:'Lectrice test', status:'lu', completedAt:`${monthKey}-10T12:00:00.000Z` });
  const dated = store.addBook({ title:'Lecture datée', author:'Lectrice test', status:'lu', startedAt:'2024-02-02T12:00:00.000Z', completedAt:'2024-03-03T12:00:00.000Z', rating:4 });
  assert.equal(dated.startedAt.slice(0,10), '2024-02-02');
  assert.equal(dated.completedAt.slice(0,10), '2024-03-03');
  assert.equal(dated.rating, 4);
  assert.equal(store.updateBook(dated.id, { rating:8 }).rating, null);
  const planned = store.addBook({ title:'Objectif à venir', author:'Lectrice test', status:'a-lire' });
  store.updateGoal('month', { targetBooks:2, bookIds:[finished.id] });
  assert.equal(store.getGoalProgress().month.value, 1);
  store.updateGoal('month', { targetBooks:2, bookIds:[planned.id] });
  assert.equal(store.getGoalProgress().month.value, 0);
  store.updateGoal('year', { targetBooks:2, bookIds:[finished.id] });
  const automaticAnnualValue = store.getGoalProgress().year.value;
  assert.equal(automaticAnnualValue, 2);
  store.updateGoal('year', { targetBooks:2, bookIds:[planned.id] });
  assert.equal(store.getGoalProgress().year.value, automaticAnnualValue, 'la sélection de titres ne modifie plus l’objectif annuel');
  const previousMonth = new Date();
  previousMonth.setDate(1);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
  const expiredMonthBook = store.addBook({ title:'Terminé le mois précédent', author:'Lectrice test', status:'lu', completedAt:`${previousMonthKey}-15T12:00:00.000Z` });
  store.updateGoal('month', { targetBooks:1, bookIds:[expiredMonthBook.id] });
  assert.equal(store.getGoalProgress().month.value, 0, 'un livre terminé le mois précédent ne doit pas remplir le nouvel objectif mensuel');
  const expiredYearBook = store.addBook({ title:'Terminé l’année précédente', author:'Lectrice test', status:'lu', completedAt:`${new Date().getFullYear() - 1}-06-15T12:00:00.000Z` });
  store.updateGoal('year', { targetBooks:1, bookIds:[expiredYearBook.id] });
  assert.equal(store.getGoalProgress().year.bookScores[expiredYearBook.id], undefined, 'un livre terminé l’année précédente ne doit pas remplir le nouvel objectif annuel');
  assert.equal(store.getState().goals.month.periodKey, store.localDateKey().slice(0, 7));
  assert.equal(store.getState().goals.year.periodKey, store.localDateKey().slice(0, 4));
  assert.match(memory.get('boop_mvp_v5'), /reviewSuccesses/);
});

test('objectifs: le changement de mois et d’année archive la période puis repart à zéro', async () => {
  const source = await read('js/store.js');
  const memory = new Map();
  const localStorage = {
    getItem:key => memory.has(key) ? memory.get(key) : null,
    setItem:(key,value) => memory.set(key,String(value)),
    removeItem:key => memory.delete(key)
  };
  const loadStore = () => {
    const BT = {};
    const context = { BT, window:{ BT, addEventListener(){} }, localStorage, navigator:{ onLine:true }, console, setTimeout, clearTimeout, Intl };
    vm.runInNewContext(source, context);
    return context.window.BT.store;
  };
  const firstStore = loadStore();
  const previousState = firstStore.getState();
  const today = new Date();
  const priorMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const priorMonthKey = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, '0')}`;
  const priorYearKey = String(today.getFullYear() - 1);
  previousState.goals.month.periodKey = priorMonthKey;
  previousState.goals.year.periodKey = priorYearKey;
  previousState.goals.month.history = [];
  previousState.goals.year.history = [];
  previousState.books.forEach(book => {
    if (book.status === 'lu') book.completedAt = `${priorYearKey}-06-15T12:00:00.000Z`;
  });
  localStorage.setItem('boop_mvp_v5', JSON.stringify(previousState));

  const reloadedStore = loadStore();
  const progress = reloadedStore.getGoalProgress();
  const rolled = reloadedStore.getState().goals;
  assert.equal(rolled.month.periodKey, progress.keys.month);
  assert.equal(rolled.year.periodKey, progress.keys.year);
  assert.equal(rolled.month.history[0].key, priorMonthKey);
  assert.equal(rolled.year.history[0].key, priorYearKey);
  assert.equal(progress.month.value, 0);
  assert.equal(progress.year.value, 0);
});

test('rapport mensuel: image Instagram et notes personnelles sur consentement', async () => {
  const [html, app, report, css, coverProxy] = await Promise.all([read('app.html'), read('js/mvp-app.js'), read('js/monthly-report.js'), read('css/mvp-v5.css'), read('supabase/functions/cover-image-proxy/index.ts')]);
  assert.match(html, /js\/monthly-report\.js/);
  assert.match(app, /data-action="open-monthly-report"/);
  assert.match(app, /name="includePersonalNotes"/);
  assert.match(app, /data-action="share-monthly-report"/);
  assert.match(report, /const WIDTH = 1080/);
  assert.match(report, /const HEIGHT = 1350/);
  assert.match(report, /const COVER_ZONE_HEIGHT = Math\.round\(HEIGHT \* \.75\)/);
  assert.match(report, /REPORT_STATUSES = \['lu', 'en-cours', 'en-pause', 'abandonne'\]/);
  assert.match(report, /book\.statusUpdatedAt/);
  assert.match(report, /drawBookGallery/);
  assert.match(report, /drawContainedImage/);
  assert.match(report, /function imageHasVisibleContent/);
  assert.match(report, /COVER_PROXY_FUNCTION = 'cover-image-proxy'/);
  assert.match(report, /Authorization:`Bearer \$\{token\}`/);
  assert.match(report, /await Promise\.all\(shown\.map\(book => loadCoverImage\(book\.coverUrl\)\)\)/);
  assert.match(report, /Quel chemin vos lectures dessinent-elles/);
  assert.doesNotMatch(report, /!book\.historicalBeforeJoin/);
  assert.match(report, /navigator\.canShare/);
  assert.match(css, /\.monthly-report-preview/);
  assert.match(coverProxy, /MAX_IMAGE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(coverProxy, /covers\.openlibrary\.org/);
  assert.match(coverProxy, /Cross-Origin-Resource-Policy/);
  assert.match(coverProxy, /isAllowedHost\(url\.hostname\)/);

  const context = { window:{ BT:{}, BOOP_SUPABASE_CONFIG:{ url:'https://project.supabase.co' } }, Intl, Date, console };
  vm.runInNewContext(report, context);
  const key = new Date().toISOString().slice(0, 7), at = `${key}-10T12:00:00.000Z`;
  const state = { profile:{ name:'Lina', handle:'@lina' }, books:[{ id:'read', title:'Le Livre', authors:['A. Auteur'], libraryState:'library', status:'lu', completedAt:at, coverUrl:'https://example.test/cover.jpg', coverColor:'linear-gradient(#123456,#654321)' }, { id:'old', title:'Lecture antérieure', authors:['B. Auteur'], libraryState:'library', status:'lu', completedAt:at, historicalBeforeJoin:true, coverUrl:'https://example.test/old.jpg' }, { id:'active', title:'En chemin', authors:['C. Auteur'], libraryState:'library', status:'en-cours', startedAt:at, coverUrl:'https://example.test/active.jpg' }, { id:'paused', title:'En suspens', authors:['D. Auteur'], libraryState:'library', status:'en-pause', lastUsedAt:at, coverUrl:'https://example.test/paused.jpg' }, { id:'abandoned', title:'Chemin interrompu', authors:['E. Auteur'], libraryState:'library', status:'abandonne', startedAt:at, coverUrl:'https://example.test/abandoned.jpg' }], sessions:[{ bookId:'read', startedAt:at, durationSeconds:3600, note:'Une citation privée' }], lexicon:[{ kind:'word', word:'Clairière', definition:'Une ouverture.', createdAt:at }], traces:[{ text:'Une Trace privée', createdAt:at }], activeSessions:[], timeline:[] };
  const withoutNotes = context.window.BT.monthlyReport.buildData(state, key, false);
  const withNotes = context.window.BT.monthlyReport.buildData(state, key, true);
  assert.equal(withoutNotes.books.length, 5);
  assert.equal(withoutNotes.statusCounts.lu, 2);
  assert.equal(withoutNotes.statusCounts['en-cours'], 1);
  assert.equal(withoutNotes.statusCounts['en-pause'], 1);
  assert.equal(withoutNotes.statusCounts.abandonne, 1);
  assert.ok(withoutNotes.books.some(book => book.coverUrl === 'https://example.test/cover.jpg'));
  assert.match(context.window.BT.monthlyReport.coverProxyUrl('https://covers.openlibrary.org/b/id/1-L.jpg'), /functions\/v1\/cover-image-proxy/);
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
  assert.match(css, /input, select, textarea \{ font-size: var\(--boo-text-body\); \}/);
});

test('ajout: la caméra reste réservée au choix explicite Scanner', async () => {
  const [app, css] = await Promise.all([read('js/mvp-app.js'), read('css/mvp-v5.css')]);
  assert.match(app, /class="page-head home-heading"/);
  assert.match(app, /Scanner un ISBN/);
  assert.match(app, /data-form="catalog-search"/);
  assert.match(app, /case 'add-book': openBookDialog\(\)/);
  assert.match(app, /mode === 'scan' && userAction/);
  assert.match(app, /function cropISBNAnalysisBlob/);
  assert.match(app, /const ratio = 1\.8/);
  assert.match(css, /\.barcode-add-icon/);
  assert.match(css, /\.isbn-scan-frame/);
  assert.match(css, /aspect-ratio: 1\.8 \/ 1/);
});

test('design: papier, ombres colorées, monospace et transitions restent progressifs', async () => {
  const [tokens, base, css, app] = await Promise.all([
    read('css/tokens.css'), read('css/base.css'), read('css/mvp-v5.css'), read('js/mvp-app.js')
  ]);
  assert.match(tokens, /--paper-grain:/);
  assert.match(tokens, /--font-mono:/);
  assert.match(tokens, /--shadow-ocre:/);
  assert.match(base, /background-image: var\(--paper-grain\)/);
  assert.match(css, /--boo-shadow-sage:/);
  assert.match(css, /--boo-mono:/);
  assert.match(css, /view-transition-name: boo-view/);
  assert.match(css, /::view-transition-new\(boo-view\)/);
  assert.match(css, /\.book-spine__peek/);
  assert.match(css, /\.memory-card-shell\.is-flipped/);
  assert.match(css, /rotateY\(180deg\)/);
  assert.match(css, /backface-visibility: hidden/);
  assert.match(app, /document\.startViewTransition\(paint\)/);
  assert.match(app, /prefers-reduced-motion: reduce/);
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
  assert.match(worker, /boo-p-webapp-v45/);
  assert.match(worker, /js\/book-lookup\.js/);
  assert.match(worker, /js\/dictionary\.js/);
  assert.match(worker, /js\/monthly-report\.js/);
  assert.match(worker, /js\/user-data-sync-api\.js/);
  assert.match(worker, /js\/components\/trail-mindmap\.js/);
  assert.match(worker, /js\/onboarding-catalog\.js/);
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

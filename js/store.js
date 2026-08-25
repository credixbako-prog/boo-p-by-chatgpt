/**
 * BOO-P MVP v5 — modèle local résilient de la Phase 1.
 * Les lectures restent disponibles hors ligne ; les Traces communautaires peuvent
 * être synchronisées avec Supabase par la couche community-api.
 */
window.BT = window.BT || {};

BT.store = (() => {
  'use strict';

  const LEGACY_STATE_KEY = 'boop_mvp_v5';
  const LEGACY_ONBOARDING_KEY = 'boop_onboarding';
  const LEGACY_OWNER_KEY = 'boop_mvp_v5_legacy_owner';
  let STATE_KEY = LEGACY_STATE_KEY;
  let ONBOARDING_KEY = LEGACY_ONBOARDING_KEY;
  let activeUserId = null;
  const SCHEMA_VERSION = 9;
  const listeners = new Set();

  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nowISO = () => new Date().toISOString();
  const localDateKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const daysAgo = count => new Date(Date.now() - count * 86400000).toISOString();
  const minutesAgo = count => new Date(Date.now() - count * 60000).toISOString();
  const REVIEW_OFFSETS = [1, 3, 7, 14, 30];
  function makeReviewSchedule(createdAt) {
    const origin = Number.isNaN(new Date(createdAt).getTime()) ? Date.now() : new Date(createdAt).getTime();
    return REVIEW_OFFSETS.map(day => ({ day, dueAt:new Date(origin + day * 86400000).toISOString(), completedAt:null, attempts:0 }));
  }
  function normalizeLexiconEntry(item = {}) {
    const createdAt = item.createdAt || item.updatedAt || nowISO();
    return { ...item, kind:['word','expression','citation'].includes(item.kind) ? item.kind : 'word', createdAt, updatedAt:item.updatedAt || createdAt, reviewSchedule:Array.isArray(item.reviewSchedule) && item.reviewSchedule.length ? item.reviewSchedule : makeReviewSchedule(createdAt), reviewSuccesses:Math.max(0, Number(item.reviewSuccesses) || 0), reviewAlmosts:Math.max(0, Number(item.reviewAlmosts) || 0), reviewAttempts:Math.max(0, Number(item.reviewAttempts) || 0), lastReviewQuality:['retry','almost','recalled'].includes(item.lastReviewQuality) ? item.lastReviewQuality : null };
  }
  const DEFAULT_BOOK_COVERS = {
    'book-etranger':'https://covers.openlibrary.org/b/isbn/9782070360024-L.jpg',
    'book-peste':'https://covers.openlibrary.org/b/isbn/9782070360420-L.jpg',
    'book-dune':'https://covers.openlibrary.org/b/isbn/9782266320481-L.jpg',
    'book-1984':'https://covers.openlibrary.org/b/isbn/9782070368228-L.jpg',
    'book-sisyphe':'https://covers.openlibrary.org/b/isbn/9782070322886-L.jpg',
    'book-origines':'https://covers.openlibrary.org/b/isbn/9782070117505-L.jpg'
  };
  const DEFAULT_BOOK_GENRES = {
    'book-etranger':'Romans', 'book-peste':'Romans', 'book-dune':'Science-fiction',
    'book-1984':'Science-fiction', 'book-sisyphe':'Philosophie', 'book-origines':'Histoire'
  };

  function readJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function makeBook(data = {}) {
    const totalPages = Math.max(0, Number(data.totalPages) || 0);
    const currentPage = Math.min(totalPages || Number.MAX_SAFE_INTEGER, Math.max(0, Number(data.currentPage) || 0));
    const statuses = ['a-lire', 'en-cours', 'en-pause', 'lu', 'abandonne'];
    const mediaTypes = ['print', 'ebook', 'audio'];
    const migratedStatus = data.status === 'transmis' ? 'lu' : data.status;
    const mediaType = mediaTypes.includes(data.mediaType) ? data.mediaType : (/audio/i.test(data.format || '') ? 'audio' : /num|ebook|epub|kindle/i.test(data.format || '') ? 'ebook' : 'print');
    const durationMinutes = Math.max(0, Number(data.durationMinutes) || 0);
    const currentMinute = Math.min(durationMinutes || Number.MAX_SAFE_INTEGER, Math.max(0, Number(data.currentMinute) || 0));
    const genreValues = Array.isArray(data.genres) && data.genres.length ? data.genres : [data.genre || DEFAULT_BOOK_GENRES[data.id]];
    const genres = [...new Set(genreValues.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 8);
    return {
      id: data.id || uid('book'), title: String(data.title || 'Sans titre'),
      authors: Array.isArray(data.authors) ? data.authors : [data.author || 'Auteur inconnu'].filter(Boolean),
      isbn: data.isbn || '', publishedDate: data.publishedDate || '',
      publisher: data.publisher || '', edition: data.edition || '', format: data.format || (mediaType === 'audio' ? 'Livre audio' : mediaType === 'ebook' ? 'Livre numérique' : 'Broché'),
      mediaType, durationMinutes, currentMinute, narrator: data.narrator || '', audioPlatform: data.audioPlatform || '', playbackSpeed: Math.max(.5, Math.min(3, Number(data.playbackSpeed) || 1)),
      totalPages, currentPage, description: data.description || '', genre: genres[0] || '', genres,
      status: statuses.includes(migratedStatus) ? migratedStatus : 'a-lire',
      libraryState: data.libraryState === 'wishlist' ? 'wishlist' : 'library',
      situation: data.situation || (data.status === 'transmis' ? 'donne' : 'possede'),
      coverColor: data.coverColor || 'linear-gradient(145deg,#17324d,#6f927c)', coverUrl: data.coverUrl || DEFAULT_BOOK_COVERS[data.id] || '',
      addedAt: data.addedAt || nowISO(), startedAt: data.startedAt || null, completedAt: data.completedAt || null,
      historicalBeforeJoin: Boolean(data.historicalBeforeJoin || (data.isADN && !data.completedAt)),
      rating: Number(data.rating) || null, isADN: Boolean(data.isADN),
      adnOrder: Number.isFinite(Number(data.adnOrder)) ? Number(data.adnOrder) : null,
      lastUsedAt: data.lastUsedAt || null, customCover: Boolean(data.customCover)
    };
  }

  function demoBooks() {
    const year = new Date().getFullYear();
    return [
      makeBook({ id: 'book-etranger', title: 'L’Étranger', author: 'Albert Camus', genre:'Romans', publisher: 'Gallimard', edition: 'Folio', format: 'Poche', totalPages: 185, currentPage: 78, status: 'en-cours', description: 'À Alger, Meursault traverse les événements avec une étrange distance au monde.', coverColor: 'linear-gradient(145deg,#14243a,#59718d)', startedAt: daysAgo(12), lastUsedAt: minutesAgo(48) }),
      makeBook({ id: 'book-peste', title: 'La Peste', author: 'Albert Camus', genre:'Romans', publisher: 'Gallimard', edition: 'Folio', format: 'Poche', totalPages: 308, currentPage: 308, status: 'lu', description: 'La ville d’Oran se ferme sur elle-même face à une épidémie.', coverColor: 'linear-gradient(145deg,#29483c,#86aa93)', completedAt: `${year}-07-18T19:10:00.000Z`, rating: 4 }),
      makeBook({ id: 'book-dune', title: 'Dune', author: 'Frank Herbert', genre:'Science-fiction', publisher: 'Robert Laffont', edition: 'Ailleurs et Demain', totalPages: 688, currentPage: 112, status: 'en-cours', situation: 'emprunte', description: 'Sur Arrakis, le destin de Paul Atréides se noue autour de l’Épice.', coverColor: 'linear-gradient(145deg,#6f3f1e,#d49442)', startedAt: daysAgo(26), lastUsedAt: daysAgo(3) }),
      makeBook({ id: 'book-1984', title: '1984', author: 'George Orwell', genre:'Science-fiction', publisher: 'Gallimard', edition: 'Du monde entier', format: 'Poche', totalPages: 328, currentPage: 328, status: 'lu', situation: 'donne', description: 'Winston Smith tente de préserver une pensée libre sous le regard de Big Brother.', coverColor: 'linear-gradient(145deg,#5e191c,#c35b4b)', completedAt: `${year}-03-12T20:00:00.000Z`, rating: 5 }),
      makeBook({ id: 'book-sisyphe', title: 'Le Mythe de Sisyphe', author: 'Albert Camus', genre:'Philosophie', publisher: 'Gallimard', edition: 'Folio essais', totalPages: 192, status: 'a-lire', description: 'Un essai sur l’absurde, la révolte et la liberté.', coverColor: 'linear-gradient(145deg,#25211e,#9c6a36)' }),
      makeBook({ id: 'book-origines', title: 'Les Origines du totalitarisme', author: 'Hannah Arendt', genre:'Histoire', publisher: 'Gallimard', edition: 'Quarto', format: 'Relié', totalPages: 832, currentPage: 214, status: 'en-pause', situation: 'prete', description: 'Une enquête majeure sur l’antisémitisme, l’impérialisme et le totalitarisme.', coverColor: 'linear-gradient(145deg,#1d3135,#66888a)', startedAt: daysAgo(80) })
    ];
  }

  function demoCommunity() {
    return {
      users: [
        { id: 'user-clara', name: 'Clara Dupont', initials: 'CD', bio: 'Romans de l’absurde et carnets de lecture.', profileVisibility: 'public', friendState: 'friend' },
        { id: 'user-marc', name: 'Marc Lefèvre', initials: 'ML', bio: 'Lecteur lent, amateur de Proust.', profileVisibility: 'private', friendState: 'none' },
        { id: 'user-ines', name: 'Inès Martin', initials: 'IM', bio: 'Science-fiction et philosophie.', profileVisibility: 'public', friendState: 'received' },
        { id: 'user-noe', name: 'Noé Bernard', initials: 'NB', bio: 'Poésie contemporaine.', profileVisibility: 'public', friendState: 'sent' },
        { id: 'user-leila', name: 'Leïla Benali', initials: 'LB', bio: 'Essais, récits de voyage et cafés calmes.', profileVisibility: 'public', friendState: 'none' },
        { id: 'user-jules', name: 'Jules Moreau', initials: 'JM', bio: 'Fantastique, nature et grands voyages.', profileVisibility: 'public', friendState: 'none' }
      ],
      posts: [
        { id: 'post-1', authorId: 'user-clara', authorName: 'Clara Dupont', initials: 'CD', type: 'fin', date: minutesAgo(42), bookTitle: 'L’Étranger', text: 'Le soleil d’Alger semble brûler à travers les pages. Une lecture qui continue de résonner.', visibility: 'public', photoIndex:0, encouraged: false, encouragements: 18, comments: [{ id: 'comment-1', authorName: 'Inès Martin', text: 'Cette lumière écrasante m’est restée aussi.', date: minutesAgo(20), replies: [{ id: 'reply-1', authorName: 'Clara Dupont', text: 'Oui, elle devient presque un personnage.', date: minutesAgo(12) }] }] },
        { id: 'post-2', authorId: 'user-marc', authorName: 'Marc Lefèvre', initials: 'ML', type: 'debut', date: daysAgo(1), bookTitle: 'Du côté de chez Swann', text: 'Je commence sans me presser. Une phrase à la fois.', visibility: 'public', encouraged: true, encouragements: 9, comments: [] },
        { id: 'post-3', authorId: 'user-ines', authorName: 'Inès Martin', initials: 'IM', type: 'trace', date: daysAgo(2), bookTitle: 'Dune', text: 'La peur tue l’esprit, mais la relire lentement change la portée de la phrase.', visibility: 'public', photoIndex:2, encouraged: false, encouragements: 25, comments: [] },
        { id: 'post-4', authorId: 'user-noe', authorName: 'Noé Bernard', initials: 'NB', type: 'trace', date: daysAgo(3), bookTitle: 'Les Fleurs du mal', text: 'Certains vers changent de couleur selon l’heure à laquelle on les relit.', visibility: 'public', encouraged: false, encouragements: 12, comments: [] },
        { id: 'post-5', authorId: 'user-leila', authorName: 'Leïla Benali', initials: 'LB', type: 'debut', date: daysAgo(4), bookTitle: 'Une chambre à soi', text: 'Premières pages au café : une voix directe, libre, encore très actuelle.', visibility: 'public', photoIndex:4, encouraged: false, encouragements: 21, comments: [] },
        { id: 'post-6', authorId: 'user-jules', authorName: 'Jules Moreau', initials: 'JM', type: 'goal', date: daysAgo(5), bookTitle: 'Le Hobbit', text: 'Dix jours de lecture régulière. Le rythme compte davantage que la vitesse.', visibility: 'public', encouraged: true, encouragements: 31, comments: [] },
        { id: 'post-7', authorId: 'user-clara', authorName: 'Clara Dupont', initials: 'CD', type: 'trace', date: daysAgo(6), bookTitle: 'La Peste', text: 'Ce livre rappelle que les gestes ordinaires peuvent devenir une forme de courage.', visibility: 'public', encouraged: false, encouragements: 16, comments: [] },
        { id: 'post-8', authorId: 'user-marc', authorName: 'Marc Lefèvre', initials: 'ML', type: 'fin', date: daysAgo(7), bookTitle: 'Le Désert des Tartares', text: 'Refermé au coucher du soleil. Une attente immense, et pourtant si silencieuse.', visibility: 'public', photoIndex:7, encouraged: false, encouragements: 19, comments: [] },
        { id: 'post-9', authorId: 'user-ines', authorName: 'Inès Martin', initials: 'IM', type: 'debut', date: daysAgo(8), bookTitle: 'La Main gauche de la nuit', text: 'Entrer dans un monde inconnu demande de laisser quelques certitudes à la porte.', visibility: 'public', encouraged: false, encouragements: 23, comments: [] },
        { id: 'post-10', authorId: 'user-leila', authorName: 'Leïla Benali', initials: 'LB', type: 'trace', date: daysAgo(9), bookTitle: 'L’Usage du monde', text: 'Lire dehors fait parfois voyager deux fois : par le paysage et par la phrase.', visibility: 'public', photoIndex:9, encouraged: false, encouragements: 27, comments: [] }
      ],
      clubs: [
        { id: 'club-1', name: 'Cercle des Classiques', description: 'Un classique, un mois, des échanges sans précipitation.', visibility: 'public', access: 'approval', bookTitle: 'La Peste', membersCount: 8, role: 'member', joined: true, color: '#cf873d' },
        { id: 'club-2', name: 'Horizons spéculatifs', description: 'Science-fiction et futurs possibles.', visibility: 'public', access: 'open', bookTitle: 'Dune', membersCount: 14, role: null, joined: false, color: '#6f927c' }
      ],
      salons: [
        { id: 'salon-1', clubId: 'club-1', clubName: 'Cercle des Classiques', title: 'Lecture calme du jeudi', bookTitle: 'La Peste', scheduledAt: new Date(Date.now() + 86400000).toISOString(), status: 'scheduled', joined: true, myStatus: 'waiting', sharePages: false, participants: [{ name: 'Clara', status: 'reading', minutes: 18 }, { name: 'Marc', status: 'paused', minutes: 12 }], messages: [{ id: 'msg-1', authorName: 'Clara', text: 'On se retrouve au chapitre 3.', date: minutesAgo(15) }] },
        { id: 'salon-2', clubId: 'club-2', clubName: 'Horizons spéculatifs', title: 'Arrakis au petit matin', bookTitle: 'Dune', scheduledAt: daysAgo(4), status: 'finished', joined: false, myStatus: 'finished', sharePages: false, participants: [{ name: 'Inès', status: 'finished', minutes: 42 }], messages: [] }
      ]
    };
  }

  function makeDefaultState() {
    const year = new Date().getFullYear();
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: { name: 'Dixon', handle: '@dixonlit', title: 'LECTEUR EXPLORATEUR', bio: 'Je marche de livre en livre, sans me presser.', email: 'dixon@prototype.local', interests: ['Philosophie', 'Roman', 'Histoire'], visibility: 'private', createdAt: nowISO() },
      books: demoBooks(), activeBookId: 'book-etranger',
      sessions: [
        { id: 'session-demo-1', bookId: 'book-etranger', startedAt: daysAgo(1), endedAt: daysAgo(1), durationSeconds: 1560, startPage: 65, endPage: 78, note: 'Lecture du soir.', manual: false },
        { id: 'session-demo-2', bookId: 'book-dune', startedAt: daysAgo(3), endedAt: daysAgo(3), durationSeconds: 2100, startPage: 94, endPage: 112, note: '', manual: false }
      ], activeSession: null, activeSessions: [], focusedSessionId: null,
      traces: [
        { id: 'trace-demo-1', bookId: 'book-etranger', text: 'L’indifférence de Meursault laisse un espace étrange au lecteur.', page: 72, privacy: 'private', createdAt: daysAgo(1), type: 'trace' },
        { id: 'trace-demo-2', bookId: 'book-dune', text: 'Le désert impose son propre rythme à toutes les décisions.', page: 108, privacy: 'private', createdAt: daysAgo(3), type: 'trace' }
      ],
      lexicon: [
        { id: 'lex-1', word: 'Absurde', definition: 'Écart entre notre recherche de sens et le silence du monde.', bookId: 'book-etranger', bookTitle: 'L’Étranger', author: 'Albert Camus', page: 44, note: '', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
        { id: 'lex-2', word: 'Gom Jabbar', definition: 'Épreuve et aiguille empoisonnée du Bene Gesserit.', bookId: 'book-dune', bookTitle: 'Dune', author: 'Frank Herbert', page: 21, note: '', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
        { id: 'lex-3', word: 'Prescience', definition: 'Perception possible de futurs encore ouverts.', bookId: 'book-dune', bookTitle: 'Dune', author: 'Frank Herbert', page: 96, note: '', createdAt: daysAgo(7), updatedAt: daysAgo(7) }
      ],
      goals: {
        week: { dailyMinutes: 20, daysTarget: 4, bookIds: [], history: [{ label: 'Semaine précédente', result: '3/4 jours' }] },
        month: { targetBooks: 2, bookIds: [], history: [{ label: 'Mois précédent', result: '1/2 livre' }] },
        year: { targetBooks: 12, bookIds: [], history: [{ label: String(year - 1), result: '9/10 livres' }] }, celebrated: {}
      },
      community: demoCommunity(),
      notifications: [],
      badges: { unlocked: {} },
      settings: { theme: 'light', defaultPostVisibility: 'me', notifications: { friends: true, encouragements: true, traces: true, clubs: true, salons: true, goals: true, remote: false }, blockedUsers: [], recentSearches: [], memoryIndex: 0, dismissedRecommendationIds: [], libraryView: 'shelf', librarySort: 'author', collapsedLibraryGenres: [] },
      outbox: [], timeline: [], meta: { initializedAt: nowISO(), updatedAt: nowISO(), simulated: true }
    };
  }

  function migrateLegacy(base) {
    const legacyBooks = readJSON('boop_books', readJSON('bt_books', []));
    const legacyProfile = readJSON('boop_profile', readJSON('bt_profile', null));
    const legacySessions = readJSON('boop_sessions', readJSON('bt_sessions', []));
    const legacyTraces = readJSON('boop_traces', readJSON('bt_traces', []));
    const legacyLexicon = readJSON('boop_lexicon', readJSON('bt_lexicon', []));
    const legacyGoal = readJSON('boop_goal', readJSON('bt_goal', null));
    if (legacyProfile) base.profile = { ...base.profile, ...legacyProfile, visibility: legacyProfile.visibility || 'private' };
    if (Array.isArray(legacyBooks) && legacyBooks.length) {
      const migrated = legacyBooks.map((book, index) => makeBook({ ...book, adnOrder: book.isADN ? index : null }));
      const titles = new Set(migrated.map(book => book.title.toLocaleLowerCase('fr')));
      base.books = migrated.concat(base.books.filter(book => !titles.has(book.title.toLocaleLowerCase('fr'))));
      base.activeBookId = base.books.find(book => book.status === 'en-cours')?.id || null;
    }
    if (Array.isArray(legacySessions) && legacySessions.length) base.sessions = legacySessions.map(session => ({ ...session, durationSeconds: Number(session.durationSeconds ?? session.duration) || 0 }));
    if (Array.isArray(legacyTraces) && legacyTraces.length) base.traces = legacyTraces;
    if (Array.isArray(legacyLexicon) && legacyLexicon.length) base.lexicon = legacyLexicon.map(item => ({ ...item, updatedAt: item.updatedAt || item.createdAt || nowISO() }));
    if (legacyGoal?.dailyMinutes) base.goals.week.dailyMinutes = Number(legacyGoal.dailyMinutes) || 20;
    return base;
  }

  function normalizeState(input) {
    const base = makeDefaultState();
    const state = input && typeof input === 'object' ? { ...base, ...input } : migrateLegacy(base);
    state.schemaVersion = SCHEMA_VERSION;
    state.profile = { ...base.profile, ...(state.profile || {}), visibility: state.profile?.visibility || 'private' };
    state.books = (state.books || []).map(makeBook);
    state.sessions = Array.isArray(state.sessions) ? state.sessions : [];
    state.activeSessions = Array.isArray(state.activeSessions) ? state.activeSessions : [];
    if (state.activeSession && !state.activeSessions.some(session => session.id === state.activeSession.id)) state.activeSessions.push(state.activeSession);
    state.activeSession = null;
    state.focusedSessionId = state.activeSessions.some(session => session.id === state.focusedSessionId) ? state.focusedSessionId : (state.activeSessions[0]?.id || null);
    state.traces = Array.isArray(state.traces) ? state.traces : [];
    state.lexicon = (Array.isArray(state.lexicon) ? state.lexicon : []).map(normalizeLexiconEntry);
    state.goals = { ...base.goals, ...(state.goals || {}), week: { ...base.goals.week, ...(state.goals?.week || {}) }, month: { ...base.goals.month, ...(state.goals?.month || {}) }, year: { ...base.goals.year, ...(state.goals?.year || {}) }, celebrated: state.goals?.celebrated || {} };
    const savedCommunity = state.community || {};
    state.community = { ...base.community, ...savedCommunity };
    state.community.users = Array.isArray(savedCommunity.users) ? savedCommunity.users : base.community.users;
    state.community.clubs = Array.isArray(savedCommunity.clubs) ? savedCommunity.clubs : base.community.clubs;
    state.community.salons = Array.isArray(savedCommunity.salons) ? savedCommunity.salons : base.community.salons;
    const defaultPosts = new Map(base.community.posts.map(post => [post.id, post]));
    const savedPosts = Array.isArray(savedCommunity.posts) ? savedCommunity.posts : [];
    const normalizedPosts = savedPosts.map(post => ({ ...(defaultPosts.get(post.id) || {}), ...post }));
    const savedPostIds = new Set(normalizedPosts.map(post => post.id));
    state.community.posts = normalizedPosts.concat(base.community.posts.filter(post => !savedPostIds.has(post.id)));
    state.notifications = Array.isArray(state.notifications) ? state.notifications : base.notifications;
    state.badges = { ...base.badges, ...(state.badges || {}), unlocked: state.badges?.unlocked || {} };
    state.settings = { ...base.settings, ...(state.settings || {}), notifications: { ...base.settings.notifications, ...(state.settings?.notifications || {}) }, blockedUsers: state.settings?.blockedUsers || [], recentSearches: state.settings?.recentSearches || [], dismissedRecommendationIds: state.settings?.dismissedRecommendationIds || [], collapsedLibraryGenres:state.settings?.collapsedLibraryGenres || [] };
    state.outbox = Array.isArray(state.outbox) ? state.outbox : [];
    state.timeline = Array.isArray(state.timeline) ? state.timeline : [];
    state.meta = { ...base.meta, ...(state.meta || {}) };
    return state;
  }

  let state = normalizeState(readJSON(STATE_KEY, null));
  writeJSON(STATE_KEY, state);

  function emit() { listeners.forEach(listener => { try { listener(clone(state)); } catch { /* view isolation */ } }); }
  function commit({ queue = null } = {}) {
    state.meta.updatedAt = nowISO();
    if (queue && typeof navigator !== 'undefined' && !navigator.onLine) state.outbox.push({ id: uid('queued'), action: queue, createdAt: nowISO(), status: 'waiting-for-network' });
    writeJSON(STATE_KEY, state); emit();
  }
  function getState() { return clone(state); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function useUser(userId) {
    const cleanId = String(userId || '').trim();
    if (!cleanId || cleanId === activeUserId) return getState();
    activeUserId = cleanId;
    STATE_KEY = `${LEGACY_STATE_KEY}:${cleanId}`;
    ONBOARDING_KEY = `${LEGACY_ONBOARDING_KEY}:${cleanId}`;
    const legacyOwner = localStorage.getItem(LEGACY_OWNER_KEY);
    const canMigrateLegacy = !legacyOwner || legacyOwner === cleanId;
    if (!localStorage.getItem(STATE_KEY) && localStorage.getItem(LEGACY_STATE_KEY) && canMigrateLegacy) {
      localStorage.setItem(STATE_KEY, localStorage.getItem(LEGACY_STATE_KEY));
      localStorage.setItem(LEGACY_OWNER_KEY, cleanId);
    }
    if (!localStorage.getItem(ONBOARDING_KEY) && localStorage.getItem(LEGACY_ONBOARDING_KEY) && canMigrateLegacy) {
      localStorage.setItem(ONBOARDING_KEY, localStorage.getItem(LEGACY_ONBOARDING_KEY));
    }
    state = normalizeState(readJSON(STATE_KEY, null));
    writeJSON(STATE_KEY, state);
    emit();
    return getState();
  }
  function getOnboarding() { return readJSON(ONBOARDING_KEY, { completed: false }); }
  function saveOnboarding(data) { writeJSON(ONBOARDING_KEY, data); }
  function isOnboardingComplete() { return Boolean(getOnboarding()?.completed); }
  function getProfile() { return clone(state.profile); }
  function saveProfile(profile) { state.profile = { ...state.profile, ...profile }; commit({ queue: 'profile.update' }); return getProfile(); }
  function getSettings() { return clone(state.settings); }
  function saveSettings(settings) { state.settings = { ...state.settings, ...settings, notifications: { ...state.settings.notifications, ...(settings.notifications || {}) } }; commit(); return getSettings(); }

  function statusLabel(status) { return ({ 'a-lire': 'À lire', 'en-cours': 'En cours', 'en-pause': 'En pause', lu: 'Lu', abandonne: 'Abandonné' })[status] || status; }
  function situationLabel(situation) { return ({ possede: 'Possédé', emprunte: 'Emprunté', prete: 'Prêté', donne: 'Donné' })[situation] || situation; }
  function addTimelineEvent(type, bookId, label) { state.timeline.unshift({ id: uid('event'), type, bookId: bookId || null, label, date: nowISO() }); state.timeline = state.timeline.slice(0, 100); }

  function getBooks() { return clone(state.books); }
  function getBookById(id) { const book = state.books.find(item => item.id === id); return book ? clone(book) : null; }
  function addBook(book) { const record = makeBook(book); if (record.status === 'lu' && !record.completedAt && !record.historicalBeforeJoin) record.completedAt = nowISO(); if (record.status === 'en-cours' && !record.startedAt) record.startedAt = nowISO(); state.books.push(record); if (!state.activeBookId && record.status === 'en-cours') state.activeBookId = record.id; addTimelineEvent(record.libraryState === 'wishlist' ? 'wishlist-added' : 'book-added', record.id, `« ${record.title} » ajouté ${record.libraryState === 'wishlist' ? 'à la wishlist' : 'à la bibliothèque'}`); commit({ queue: 'book.create' }); return clone(record); }
  function updateBook(id, updates) {
    const index = state.books.findIndex(book => book.id === id); if (index < 0) return null;
    const previous = state.books[index]; const next = makeBook({ ...previous, ...updates, id });
    if (updates.status === 'en-cours' && !next.startedAt) next.startedAt = nowISO();
    if (updates.status === 'lu' && !next.completedAt && !next.historicalBeforeJoin) next.completedAt = nowISO();
    if (updates.status && updates.status !== previous.status) addTimelineEvent(`status-${updates.status}`, id, `« ${next.title} » : ${statusLabel(updates.status)}`);
    if (updates.situation && updates.situation !== previous.situation) addTimelineEvent(`situation-${updates.situation}`, id, `« ${next.title} » : ${situationLabel(updates.situation)}`);
    state.books[index] = next; commit({ queue: 'book.update' }); return clone(next);
  }
  function deleteBook(id) { state.books = state.books.filter(book => book.id !== id); state.sessions = state.sessions.filter(session => session.bookId !== id); state.activeSessions = state.activeSessions.filter(session => session.bookId !== id); state.traces = state.traces.filter(trace => trace.bookId !== id); state.lexicon = state.lexicon.map(item => item.bookId === id ? { ...item, bookId: null } : item); if (state.activeBookId === id) state.activeBookId = state.books.find(book => book.status === 'en-cours' && book.libraryState === 'library')?.id || null; if (!state.activeSessions.some(session => session.id === state.focusedSessionId)) state.focusedSessionId = state.activeSessions[0]?.id || null; commit({ queue: 'book.delete' }); }
  function getCurrentBook() { const session = getActiveSession(); const sessionBook = session && state.books.find(book => book.id === session.bookId && book.status === 'en-cours' && book.libraryState === 'library'); if (sessionBook) return clone(sessionBook); const active = state.books.filter(book => book.status === 'en-cours' && book.libraryState === 'library').sort((a, b) => new Date(b.lastUsedAt || b.startedAt || b.addedAt) - new Date(a.lastUsedAt || a.startedAt || a.addedAt))[0]; return active ? clone(active) : null; }
  function setActiveBook(id) { const book = state.books.find(item => item.id === id && item.libraryState === 'library'); if (!book) return null; state.activeBookId = id; book.lastUsedAt = nowISO(); if (book.status !== 'en-cours') { book.status = 'en-cours'; book.startedAt = nowISO(); } commit(); return clone(book); }
  function setCurrentBook(id) { return setActiveBook(id); }
  function clearActiveBook(id = null) { if (!state.activeBookId || (id && state.activeBookId !== id) || state.activeSessions.length) return false; state.activeBookId = null; commit(); return true; }
  function completeBook(id) { const book = getBookById(id); return book ? updateBook(id, { status: 'lu', currentPage: book.totalPages, completedAt: nowISO() }) : null; }

  function getSessions() { return clone(state.sessions); }
  function getSessionsForBook(bookId) { return clone(state.sessions.filter(session => session.bookId === bookId).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))); }
  function saveSession(session) {
    const record = { id: session.id || uid('session'), manual: Boolean(session.manual), startedAt: session.startedAt || nowISO(), endedAt: session.endedAt || nowISO(), durationSeconds: Math.max(0, Number(session.durationSeconds ?? session.duration) || 0), startPage: Math.max(0, Number(session.startPage) || 0), endPage: Math.max(0, Number(session.endPage) || 0), note: session.note || '', bookId: session.bookId };
    const index = state.sessions.findIndex(item => item.id === record.id); if (index >= 0) state.sessions[index] = record; else state.sessions.push(record);
    const book = state.books.find(item => item.id === record.bookId); if (book) { if (book.mediaType === 'audio') book.currentMinute = Math.min(book.durationMinutes || Number.MAX_SAFE_INTEGER, record.endPage); else book.currentPage = Math.min(book.totalPages || Number.MAX_SAFE_INTEGER, record.endPage); book.lastUsedAt = record.endedAt; const completed = book.mediaType === 'audio' ? (book.durationMinutes && book.currentMinute >= book.durationMinutes) : (book.totalPages && book.currentPage >= book.totalPages); if (completed) { book.status = 'lu'; book.completedAt ||= record.endedAt; } }
    addTimelineEvent(record.manual ? 'manual-session' : 'session', record.bookId, `${Math.max(1, Math.round(record.durationSeconds / 60))} min de lecture`); commit({ queue: 'session.save' }); return clone(record);
  }
  function updateSession(id, updates) { const existing = state.sessions.find(item => item.id === id); return existing ? saveSession({ ...existing, ...updates, id }) : null; }
  function deleteSession(id) { state.sessions = state.sessions.filter(session => session.id !== id); commit({ queue: 'session.delete' }); }
  function getTodaySessions() { const today = localDateKey(); return getSessions().filter(session => localDateKey(session.startedAt) === today); }
  function getTodayReadingTime() { return getTodaySessions().reduce((sum, session) => sum + (session.durationSeconds || 0), 0); }

  function getActiveSessions() { return clone(state.activeSessions.slice().sort((a, b) => new Date(b.lastSeenAt || b.startedAt) - new Date(a.lastSeenAt || a.startedAt))); }
  function findActiveSession(id = null) { return state.activeSessions.find(session => session.id === (id || state.focusedSessionId)) || state.activeSessions.find(session => session.status === 'running') || state.activeSessions[0] || null; }
  function getActiveSession(id = null) { const session = findActiveSession(id); return session ? clone(session) : null; }
  function getActiveSessionForBook(bookId) { const session = state.activeSessions.find(item => item.bookId === bookId); return session ? clone(session) : null; }
  function focusActiveSession(id) { if (!state.activeSessions.some(session => session.id === id)) return null; state.focusedSessionId = id; commit(); return getActiveSession(id); }
  function activeDuration(session = findActiveSession(), timestamp = Date.now()) { if (!session) return 0; const running = session.status === 'running' ? Math.max(0, Math.floor((timestamp - new Date(session.resumedAt).getTime()) / 1000)) : 0; return Math.max(0, Number(session.accumulatedSeconds) || 0) + running; }
  function pauseOtherRunningSessions(exceptId) { state.activeSessions.forEach(session => { if (session.id !== exceptId && session.status === 'running') { session.accumulatedSeconds = activeDuration(session); session.status = 'paused'; session.pausedAt = nowISO(); session.lastSeenAt = session.pausedAt; } }); }
  function startActiveSession(bookId) { const existing = state.activeSessions.find(session => session.bookId === bookId); if (existing) { state.focusedSessionId = existing.id; if (existing.status !== 'running') { pauseOtherRunningSessions(existing.id); existing.status = 'running'; existing.resumedAt = nowISO(); existing.lastSeenAt = existing.resumedAt; } commit(); return getActiveSession(existing.id); } const book = state.books.find(item => item.id === bookId && item.libraryState === 'library'); if (!book) return null; setActiveBook(bookId); const timestamp = nowISO(), position = book.mediaType === 'audio' ? book.currentMinute : book.currentPage; const session = { id: uid('active'), bookId, startedAt: timestamp, resumedAt: timestamp, lastSeenAt: timestamp, accumulatedSeconds: 0, status: 'running', startPage: position, endPage: position, note: '', traceDraft: '' }; pauseOtherRunningSessions(session.id); state.activeSessions.push(session); state.focusedSessionId = session.id; commit(); return getActiveSession(session.id); }
  function recoverActiveSession() {
    const session = findActiveSession(); if (!session || session.status !== 'running') return getActiveSession();
    const timestamp = Date.now(); const lastSeen = new Date(session.lastSeenAt || session.resumedAt).getTime();
    if (timestamp - lastSeen > 1800000) { const beforeBackground = Math.max(0, Math.floor((lastSeen - new Date(session.resumedAt).getTime()) / 1000)); session.accumulatedSeconds = (Number(session.accumulatedSeconds) || 0) + beforeBackground + 1800; session.status = 'paused'; session.pausedAt = new Date(lastSeen + 1800000).toISOString(); session.autoPaused = true; addNotification({ type: 'session', title: 'Session mise en pause', text: 'Après 30 minutes en arrière-plan, votre session a été mise en pause automatiquement.', route: '#session' }, false); commit(); }
    return getActiveSession();
  }
  function heartbeatActiveSession() { const session = state.activeSessions.find(item => item.status === 'running'); if (session) { session.lastSeenAt = nowISO(); writeJSON(STATE_KEY, state); } }
  function updateActiveSession(updates, id = null) { const session = findActiveSession(id); if (!session) return null; Object.assign(session, updates, { lastSeenAt: nowISO() }); state.focusedSessionId = session.id; commit(); return getActiveSession(session.id); }
  function pauseActiveSession(id = null) { const session = findActiveSession(id); if (!session || session.status !== 'running') return getActiveSession(id); session.accumulatedSeconds = activeDuration(session); session.status = 'paused'; session.pausedAt = nowISO(); session.lastSeenAt = nowISO(); commit(); return getActiveSession(session.id); }
  function resumeActiveSession(id = null) { const session = findActiveSession(id); if (!session || session.status === 'running') return getActiveSession(id); pauseOtherRunningSessions(session.id); state.focusedSessionId = session.id; session.status = 'running'; session.resumedAt = nowISO(); session.lastSeenAt = session.resumedAt; session.autoPaused = false; commit(); return getActiveSession(session.id); }
  function finishActiveSession(summary = {}, id = null) {
    const session = findActiveSession(id); if (!session) return null; const durationSeconds = activeDuration(session);
    const saved = saveSession({ id: uid('session'), bookId: session.bookId, startedAt: session.startedAt, endedAt: nowISO(), durationSeconds, startPage: session.startPage, endPage: summary.endPage ?? session.endPage, note: summary.note ?? session.note });
    if (summary.traceText) saveTrace({ bookId: session.bookId, sessionId: saved.id, text: summary.traceText, page: summary.endPage ?? session.endPage, privacy: summary.share ? 'public' : 'private' });
    if (summary.rating || summary.markRead) updateBook(session.bookId, { rating: Number(summary.rating) || getBookById(session.bookId)?.rating, status: summary.markRead ? 'lu' : getBookById(session.bookId)?.status, completedAt: summary.markRead ? nowISO() : getBookById(session.bookId)?.completedAt });
    state.activeSessions = state.activeSessions.filter(item => item.id !== session.id); state.focusedSessionId = state.activeSessions[0]?.id || null; commit(); return saved;
  }

  function getTraces(bookId) { return clone(bookId ? state.traces.filter(trace => trace.bookId === bookId) : state.traces); }
  function getTracesForBook(bookId) { return getTraces(bookId); }
  function saveTrace(trace) { const record = { id: trace.id || uid('trace'), bookId: trace.bookId || null, sessionId: trace.sessionId || null, text: String(trace.text || '').trim(), page: Math.max(0, Number(trace.page) || 0), privacy: trace.privacy || 'private', type: trace.type || 'trace', source: trace.source || 'personnel', createdAt: trace.createdAt || nowISO(), updatedAt: nowISO() }; const index = state.traces.findIndex(item => item.id === record.id); if (index >= 0) state.traces[index] = record; else state.traces.unshift(record); addTimelineEvent('trace', record.bookId, 'Nouvelle Trace personnelle'); commit({ queue: 'trace.save' }); return clone(record); }
  function deleteTrace(id) { state.traces = state.traces.filter(trace => trace.id !== id); commit({ queue: 'trace.delete' }); }
  function getLexicon() { return clone(state.lexicon.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))); }
  function addLexiconWord(entry) { const book = state.books.find(item => item.id === entry.bookId); const createdAt = entry.createdAt || nowISO(); const existing = state.lexicon.find(item => item.id === entry.id); const record = normalizeLexiconEntry({ id: entry.id || uid('lex'), word: String(entry.word || '').trim(), kind: ['word','expression','citation'].includes(entry.kind) ? entry.kind : 'word', definition: String(entry.definition || '').trim(), sourceLabel: entry.sourceLabel || '', sourceUrl: entry.sourceUrl || '', bookId: entry.bookId || null, bookTitle: entry.bookTitle || book?.title || '', author: entry.author || book?.authors?.join(', ') || '', page: Math.max(0, Number(entry.page) || 0) || null, note: entry.note || '', createdAt:existing?.createdAt || createdAt, updatedAt:nowISO(), reviewSchedule:entry.reviewSchedule || existing?.reviewSchedule || makeReviewSchedule(createdAt), reviewSuccesses:existing?.reviewSuccesses || 0, reviewAlmosts:existing?.reviewAlmosts || 0, reviewAttempts:existing?.reviewAttempts || 0, lastReviewQuality:existing?.lastReviewQuality || null, lastReviewedAt:existing?.lastReviewedAt || null }); const index = state.lexicon.findIndex(item => item.id === record.id); if (index >= 0) state.lexicon[index] = record; else state.lexicon.unshift(record); addTimelineEvent('lexicon', record.bookId, `« ${record.word} » ajouté au lexique`); commit({ queue: 'lexicon.save' }); return clone(record); }
  function reviewLexiconWord(id, result = 'recalled') {
    const entry = state.lexicon.find(item => item.id === id); if (!entry) return null;
    const quality = result === true ? 'recalled' : result === false ? 'retry' : ['retry','almost','recalled'].includes(result) ? result : 'recalled';
    entry.reviewSchedule = Array.isArray(entry.reviewSchedule) && entry.reviewSchedule.length ? entry.reviewSchedule : makeReviewSchedule(entry.createdAt);
    const now = new Date(), nowValue = now.getTime();
    let stage = entry.reviewSchedule.find(item => !item.completedAt && new Date(item.dueAt).getTime() <= nowValue) || entry.reviewSchedule.find(item => !item.completedAt);
    if (!stage) {
      const maintenanceDays = entry.reviewSuccesses >= 8 ? 30 : entry.reviewSuccesses >= 4 ? 14 : 7;
      stage = { day:`entretien-${entry.reviewSchedule.length + 1}`, dueAt:new Date(nowValue + maintenanceDays * 86400000).toISOString(), completedAt:null, attempts:0, adaptive:true };
      entry.reviewSchedule.push(stage);
    }
    entry.reviewAttempts = Math.max(0, Number(entry.reviewAttempts) || 0) + 1;
    stage.attempts = Math.max(0, Number(stage.attempts) || 0) + 1;
    if (quality === 'recalled') {
      stage.completedAt = now.toISOString();
      entry.reviewSuccesses = Math.max(0, Number(entry.reviewSuccesses) || 0) + 1;
      if (!entry.reviewSchedule.some(item => !item.completedAt)) {
        const maintenanceDays = entry.reviewSuccesses >= 8 ? 30 : entry.reviewSuccesses >= 4 ? 14 : 7;
        entry.reviewSchedule.push({ day:`entretien-${entry.reviewSchedule.length + 1}`, dueAt:new Date(nowValue + maintenanceDays * 86400000).toISOString(), completedAt:null, attempts:0, adaptive:true });
      }
    } else if (quality === 'almost') {
      entry.reviewAlmosts = Math.max(0, Number(entry.reviewAlmosts) || 0) + 1;
      stage.dueAt = new Date(nowValue + 3 * 86400000).toISOString();
    } else stage.dueAt = new Date(nowValue + 86400000).toISOString();
    entry.lastReviewQuality = quality; entry.lastReviewedAt = now.toISOString(); entry.updatedAt = now.toISOString();
    commit({ queue:'lexicon.review' }); return clone(entry);
  }
  function deleteLexiconWord(id) { state.lexicon = state.lexicon.filter(item => item.id !== id); commit({ queue: 'lexicon.delete' }); }

  function weekStart(date = new Date()) { const result = new Date(date); const day = result.getDay() || 7; result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - day + 1); return result; }
  function currentPeriodKeys() { const current = new Date(); return { week: localDateKey(weekStart(current)), month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`, year: String(current.getFullYear()) }; }
  function sessionMinutesByDay() { const map = {}; state.sessions.forEach(session => { const key = localDateKey(session.startedAt); map[key] = (map[key] || 0) + (Number(session.durationSeconds) || 0) / 60; }); state.activeSessions.forEach(session => { map[localDateKey()] = (map[localDateKey()] || 0) + activeDuration(session) / 60; }); return map; }
  function getGoalProgress() {
    const keys = currentPeriodKeys(), minutes = sessionMinutesByDay(), start = weekStart();
    const weekDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); const key = localDateKey(date), value = Math.round(minutes[key] || 0); return { key, label: ['L','M','M','J','V','S','D'][index], minutes: value, target: state.goals.week.dailyMinutes, reached: value >= state.goals.week.dailyMinutes, today: key === localDateKey() }; });
    const completed = state.books.filter(book => book.status === 'lu' && book.completedAt && !book.historicalBeforeJoin);
    const filterBooks = (period, goal) => completed.filter(book => { if (goal.bookIds?.length && !goal.bookIds.includes(book.id)) return false; const date = new Date(book.completedAt); return period === 'month' ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === keys.month : String(date.getFullYear()) === keys.year; });
    const daysReached = weekDays.filter(day => day.reached).length, monthBooks = filterBooks('month', state.goals.month), yearBooks = filterBooks('year', state.goals.year);
    return { keys, week: { days: weekDays, value: daysReached, target: state.goals.week.daysTarget, todayMinutes: weekDays.find(day => day.today)?.minutes || 0, dailyTarget: state.goals.week.dailyMinutes }, month: { value: monthBooks.length, target: state.goals.month.targetBooks, bookIds: monthBooks.map(book => book.id) }, year: { value: yearBooks.length, target: state.goals.year.targetBooks, bookIds: yearBooks.map(book => book.id) } };
  }
  function getGoal() { const progress = getGoalProgress(); return { dailyMinutes: state.goals.week.dailyMinutes, streak: getStats().streak, streakDays: progress.week.days.map(day => day.reached), ...clone(state.goals) }; }
  function saveGoal(goal) { if (goal.dailyMinutes) state.goals.week.dailyMinutes = Number(goal.dailyMinutes); commit(); return getGoal(); }
  function updateGoal(period, updates) {
    if (!state.goals[period]) return null;
    state.goals[period] = { ...state.goals[period], ...updates };
    delete state.goals[period].floorProgress;
    const keys = currentPeriodKeys(), progress = getGoalProgress()[period];
    if (progress.value < progress.target) delete state.goals.celebrated[`${period}:${keys[period]}`];
    commit({ queue: 'goal.update' });
    return clone(state.goals[period]);
  }
  function markGoalCelebrated(period) { const keys = currentPeriodKeys(); state.goals.celebrated[`${period}:${keys[period]}`] = true; commit(); }
  function isGoalCelebrated(period) { const keys = currentPeriodKeys(); return Boolean(state.goals.celebrated[`${period}:${keys[period]}`]); }

  function getCommunity() { return clone(state.community); }
  function toggleEncouragement(postId) { const post = state.community.posts.find(item => item.id === postId); if (!post) return null; post.encouraged = !post.encouraged; post.encouragements = Math.max(0, Number(post.encouragements) + (post.encouraged ? 1 : -1)); commit({ queue: 'community.encouragement' }); return clone(post); }
  function addComment(postId, text, parentId = null) { const post = state.community.posts.find(item => item.id === postId); if (!post || !String(text).trim()) return null; const comment = { id: uid(parentId ? 'reply' : 'comment'), authorName: state.profile.name, text: String(text).trim(), date: nowISO(), replies: [] }; if (parentId) { const parent = post.comments.find(item => item.id === parentId); if (!parent) return null; parent.replies ||= []; parent.replies.push(comment); } else post.comments.push(comment); commit({ queue: 'community.comment' }); return clone(comment); }
  function addPost(post) { const record = { id: post.id || uid('post'), remoteId: post.remoteId || null, authorId: post.authorId || 'me', authorName: post.authorName || state.profile.name, initials: post.initials || state.profile.name.split(/\s+/).map(item => item[0]).slice(0, 2).join('').toUpperCase(), type: post.type || 'trace', date: post.date || nowISO(), bookTitle: post.bookTitle || '', text: String(post.text || '').trim(), visibility: post.visibility || state.settings.defaultPostVisibility, photoData: post.photoData || null, photoPath: post.photoPath || null, photoUrl: post.photoUrl || null, isRemote: Boolean(post.isRemote), encouraged: Boolean(post.encouraged), encouragements: Number(post.encouragements) || 0, comments: Array.isArray(post.comments) ? post.comments : [] }; const existing = state.community.posts.findIndex(item => item.id === record.id || (record.remoteId && item.remoteId === record.remoteId)); if (existing >= 0) state.community.posts[existing] = { ...state.community.posts[existing], ...record }; else state.community.posts.unshift(record); commit({ queue: 'community.post' }); return clone(record); }
  function mergeRemotePosts(posts) { if (!Array.isArray(posts)) return getCommunity(); posts.forEach(post => addPost({ ...post, isRemote:true })); return getCommunity(); }
  function mergeRemoteUsers(users) { if (!Array.isArray(users)) return getCommunity(); users.forEach(user => { const index = state.community.users.findIndex(item => item.id === user.id); const record = { ...user, isRemote:true }; if (index >= 0) state.community.users[index] = { ...state.community.users[index], ...record }; else state.community.users.push(record); }); commit(); return getCommunity(); }
  function updateFriend(userId, action) { const user = state.community.users.find(item => item.id === userId); if (!user) return null; user.friendState = ({ send: 'sent', cancel: 'none', accept: 'friend', refuse: 'none', remove: 'none' })[action] || user.friendState; commit({ queue: `friend.${action}` }); return clone(user); }
  function blockUser(userId) { if (!state.settings.blockedUsers.includes(userId)) state.settings.blockedUsers.push(userId); state.community.posts = state.community.posts.filter(post => post.authorId !== userId); const user = state.community.users.find(item => item.id === userId); if (user) user.friendState = 'blocked'; commit({ queue: 'user.block' }); }
  function unblockUser(userId) { state.settings.blockedUsers = state.settings.blockedUsers.filter(id => id !== userId); const user = state.community.users.find(item => item.id === userId); if (user?.friendState === 'blocked') user.friendState = 'none'; commit({ queue: 'user.unblock' }); }
  function addGroup(group) { const record = { id: group.id || uid('club'), remoteId: group.remoteId || null, name: group.name, description: group.description || '', visibility: group.visibility || 'private', access: group.access || 'approval', bookTitle: group.bookTitle || '', membersCount: 1, role: 'owner', joined: true, color: group.color || '#6f927c' }; const existing = state.community.clubs.findIndex(item => item.id === record.id || (record.remoteId && item.remoteId === record.remoteId)); if (existing >= 0) state.community.clubs[existing] = { ...state.community.clubs[existing], ...record }; else state.community.clubs.unshift(record); commit({ queue: 'club.create' }); return clone(record); }
  function getGroups() { return clone(state.community.clubs); }
  function toggleClub(clubId) { const club = state.community.clubs.find(item => item.id === clubId); if (!club) return null; club.joined = !club.joined; club.role = club.joined ? 'member' : null; club.membersCount = Math.max(0, Number(club.membersCount) + (club.joined ? 1 : -1)); commit({ queue: club.joined ? 'club.join' : 'club.leave' }); return clone(club); }
  function updateSalon(salonId, updates) { const salon = state.community.salons.find(item => item.id === salonId); if (!salon) return null; Object.assign(salon, updates); commit({ queue: 'salon.update' }); return clone(salon); }
  function addSalon(salon) { const record = { id: uid('salon'), clubId: salon.clubId, clubName: salon.clubName, title: salon.title, bookTitle: salon.bookTitle, scheduledAt: salon.scheduledAt || nowISO(), status: 'scheduled', joined: true, myStatus: 'waiting', sharePages: false, participants: [], messages: [] }; state.community.salons.unshift(record); commit({ queue: 'salon.create' }); return clone(record); }
  function addSalonMessage(salonId, text) { const salon = state.community.salons.find(item => item.id === salonId); if (!salon || !String(text).trim()) return null; const message = { id: uid('message'), authorName: state.profile.name, text: String(text).trim(), date: nowISO() }; salon.messages.push(message); commit({ queue: 'salon.message' }); return clone(message); }

  function getNotifications() { return clone(state.notifications.slice().sort((a, b) => new Date(b.date) - new Date(a.date))); }
  function replaceNotifications(notifications) { state.notifications = Array.isArray(notifications) ? notifications.map(item => ({ id:String(item.id), type:item.type || 'info', title:item.title || 'Information', text:item.text || '', date:item.date || nowISO(), read:Boolean(item.read), route:item.route || '#home', actorName:item.actorName || '', remote:Boolean(item.remote) })) : []; commit(); return getNotifications(); }
  function addNotification(notification, shouldCommit = true) { state.notifications.unshift({ id: notification.id || uid('notif'), type: notification.type || 'info', title: notification.title || 'Information', text: notification.text || '', date: notification.date || nowISO(), read: Boolean(notification.read), route: notification.route || '#home' }); if (shouldCommit) commit(); }
  function markNotification(id, read = true) { const item = state.notifications.find(notification => String(notification.id) === String(id)); if (item) item.read = read; commit(); }
  function markAllNotifications() { state.notifications.forEach(notification => { notification.read = true; }); commit(); }
  function getTimeline() { const events = [...state.timeline]; state.books.forEach(book => { const date = book.completedAt || book.startedAt; if (date) events.push({ id: `book-event-${book.id}`, type: book.completedAt ? 'status-lu' : 'status-en-cours', bookId: book.id, label: `« ${book.title} » ${book.completedAt ? 'terminé' : 'commencé'}`, date }); }); state.sessions.forEach(session => { const book = state.books.find(item => item.id === session.bookId); events.push({ id: `timeline-${session.id}`, type: 'session', bookId: session.bookId, label: `${Math.max(1, Math.round(session.durationSeconds / 60))} min avec « ${book?.title || 'un livre'} »`, date: session.startedAt }); }); return clone(events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 80)); }
  function getStats() { const libraryBooks = state.books.filter(book => book.libraryState === 'library'); const totalSeconds = state.sessions.reduce((sum, session) => sum + (Number(session.durationSeconds) || 0), 0) + state.activeSessions.reduce((sum, session) => sum + activeDuration(session), 0); const readDates = new Set(state.sessions.map(session => localDateKey(session.startedAt))); let streak = 0; const cursor = new Date(); if (!readDates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1); while (readDates.has(localDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); } const progress = getGoalProgress(); return { totalBooks: libraryBooks.length, wishlistBooks: state.books.filter(book => book.libraryState === 'wishlist').length, booksRead: libraryBooks.filter(book => book.status === 'lu').length, booksInProgress: libraryBooks.filter(book => book.status === 'en-cours').length, booksToRead: libraryBooks.filter(book => book.status === 'a-lire').length, booksTransmitted: libraryBooks.filter(book => ['prete','donne'].includes(book.situation)).length, totalHours: Math.floor(totalSeconds / 3600), totalMinutes: Math.round(totalSeconds / 60), totalSessions: state.sessions.length, totalTraces: state.traces.length + state.lexicon.length, streak, booksReadThisYear: progress.year.value, dailyGoalMinutes: state.goals.week.dailyMinutes, todayReadingMinutes: Math.round(getTodayReadingTime() / 60) }; }

  function getBadges() {
    const progress = getGoalProgress(), libraryBooks = state.books.filter(book => book.libraryState === 'library');
    const longestSeconds = Math.max(
      state.sessions.reduce((max, session) => Math.max(max, Number(session.durationSeconds) || 0), 0),
      state.activeSessions.reduce((max, session) => Math.max(max, activeDuration(session)), 0)
    );
    const mediaCount = new Set(libraryBooks.map(book => book.mediaType)).size;
    const readingDays = [...new Set(state.sessions.map(session => localDateKey(session.startedAt)))].sort();
    let longestStreak = 0, runningStreak = 0, previousDay = null;
    readingDays.forEach(key => { const day = new Date(`${key}T12:00:00`); runningStreak = previousDay && Math.round((day - previousDay) / 86400000) === 1 ? runningStreak + 1 : 1; longestStreak = Math.max(longestStreak, runningStreak); previousDay = day; });
    const completedByMonth = {};
    libraryBooks.filter(book => book.status === 'lu' && book.completedAt).forEach(book => { const key = String(book.completedAt).slice(0, 7); completedByMonth[key] = (completedByMonth[key] || 0) + 1; });
    const booksInBestMonth = Math.max(0, ...Object.values(completedByMonth));
    const definitions = [
      { id:'first-step', icon:'✦', name:'Premier pas', description:'Première session de lecture terminée.', unlocked:state.sessions.length >= 1 },
      { id:'between-pages', icon:'Ⅱ', name:'Entre deux pages', description:'Deux lectures En cours en parallèle.', unlocked:libraryBooks.filter(book => book.status === 'en-cours').length >= 2 },
      { id:'words-path', icon:'Aa', name:'Mot après mot', description:'Dix entrées comprises et ajoutées au lexique.', unlocked:state.lexicon.length >= 10 },
      { id:'deep-trace', icon:'✎', name:'Trace profonde', description:'Un livre Lu accompagné d’une Trace personnelle.', unlocked:libraryBooks.some(book => book.status === 'lu' && state.traces.some(trace => trace.bookId === book.id)) },
      { id:'open-curiosity', icon:'◈', name:'Curiosité ouverte', description:'Papier, ebook et audio réunis dans le sentier.', unlocked:mediaCount >= 3 },
      { id:'long-reading', icon:'◷', name:'Le temps suspendu', description:'Une session personnelle d’au moins une heure.', unlocked:longestSeconds >= 3600 },
      { id:'goal-day', icon:'1', name:'Journée accomplie', description:'Objectif de lecture du jour atteint.', unlocked:progress.week.todayMinutes >= progress.week.dailyTarget },
      { id:'goal-week', icon:'7', name:'Semaine accomplie', description:'Objectif principal de la semaine atteint.', unlocked:progress.week.value >= progress.week.target },
      { id:'goal-month', icon:'M', name:'Mois accompli', description:'Objectif principal du mois atteint.', unlocked:progress.month.value >= progress.month.target },
      { id:'goal-year', icon:'A', name:'Année accomplie', description:'Objectif principal de l’année atteint.', unlocked:progress.year.value >= progress.year.target }
    ];
    let changed = false;
    definitions.forEach(badge => { if (badge.unlocked && !state.badges.unlocked[badge.id]) { state.badges.unlocked[badge.id] = nowISO(); changed = true; } });
    if (changed) commit();
    return { items:clone(definitions.map(badge => ({ ...badge, unlockedAt:state.badges.unlocked[badge.id] || null }))), records:{ longestSessionSeconds:longestSeconds, longestStreakDays:longestStreak, booksInBestMonth } };
  }

  function exportData() { return clone(state); }
  function flushOutbox() { if (typeof navigator !== 'undefined' && navigator.onLine && state.outbox.length) { state.outbox = []; commit(); } }
  function clearAll() { localStorage.removeItem(STATE_KEY); localStorage.removeItem(ONBOARDING_KEY); state = makeDefaultState(); writeJSON(STATE_KEY, state); emit(); }
  function loadDemoData() { return getState(); }
  window.addEventListener?.('online', flushOutbox);

  return {
    getState, subscribe, useUser, getOnboarding, saveOnboarding, isOnboardingComplete, getProfile, saveProfile, getSettings, saveSettings,
    getBooks, getBookById, addBook, updateBook, deleteBook, getCurrentBook, setActiveBook, setCurrentBook, clearActiveBook, completeBook,
    getSessions, getSessionsForBook, saveSession, updateSession, deleteSession, getTodaySessions, getTodayReadingTime,
    getActiveSession, getActiveSessions, getActiveSessionForBook, focusActiveSession, startActiveSession, recoverActiveSession, heartbeatActiveSession, activeDuration, updateActiveSession, pauseActiveSession, resumeActiveSession, finishActiveSession,
    getTraces, getTracesForBook, saveTrace, deleteTrace, getLexicon, addLexiconWord, reviewLexiconWord, deleteLexiconWord,
    getGoal, saveGoal, getGoalProgress, updateGoal, markGoalCelebrated, isGoalCelebrated,
    getCommunity, toggleEncouragement, addComment, addPost, mergeRemotePosts, mergeRemoteUsers, updateFriend, blockUser, unblockUser, addGroup, getGroups, toggleClub, updateSalon, addSalon, addSalonMessage,
    getNotifications, replaceNotifications, addNotification, markNotification, markAllNotifications, getTimeline, getStats, getBadges, exportData, flushOutbox, clearAll, loadDemoData,
    statusLabel, situationLabel, localDateKey
  };
})();

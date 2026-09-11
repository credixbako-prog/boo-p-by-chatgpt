/** BOO-P MVP v5 — interface interactive du prototype local. */
(() => {
  'use strict';

  const store = window.BT.store;
  const ui = {
    route: 'home', params: new URLSearchParams(),
    communityTab: 'public', pathTab: 'library', profileTab: 'overview', memoryIndex: 0,
    libraryQuery: '', libraryStatus: 'tous', notificationFilter: 'all',
    openComments: new Set(), friendQuery: '', lexiconQuery: '', timer: null, heartbeat: null,
    lastFocus: null, pendingCover: '', pendingCoverKind: '', pendingISBNPhoto: '', pendingISBNPhotoFile: null, bookSuggestions: [],
    pendingPostPhotoUrl: '', pendingProfilePhotoUrl: '', pendingProfilePhotoFile: null, removeProfilePhoto:false, searchQuery: '', communityLoaded: false,
    friendResults: [], friendSearchBusy: false, friendSearchTimer: null,
    catalogRecommendations: [], recommendationsBusy: false, currentRecommendations: [],
    monthlyReportCanvas: null, monthlyReportData: null, notificationUnsubscribe: null, renderedRoute: null,
    selectedLibraryBookId: null, memoryDeckKeys: [], memoryDeckSignature: '', memorySessionTotal: 0, memorySessionComplete: false,
    memoryCursor: 0, memoryCompletedKeys: [], lexiconKind: 'all', notebookBook: '', trailMode: 'map', trailImmersive: false, catalogRequest: 0,
    quizSignature: '', quizQuestionIds: [], quizIndex: 0, quizScore: 0, quizAnswered: false, quizSelected: '', quizStarted: false, memoryExpanded: false, quizFinished: false, quizSeed: 0,
    expandedTrailBooks: new Set(), trailYear: 'all', trailStatus: 'all', trailScale: .72, trailViewCenter: null, trailPinch: null, clubSpaces: new Map(), clubSpaceLoading: new Set(), clubSpaceErrors: new Map(),
    syncReady: false, syncBusy: false, syncPending: false, syncTimer: null, syncUnsubscribe: null, syncBootstrapping: false, syncErrorShown: false
  };

  const NAV = [
    { id: 'home', label: 'Accueil', icon: '⌂', href: '#home' },
    { id: 'path', label: 'Bibliothèque', icon: '<span class="gallery-nav-glyph"></span>', href: '#path?tab=library' },
    { id: 'community', label: 'Communauté', icon: '◎', href: '#community?tab=public' },
    { id: 'profile', label: 'Profil', icon: '◉', href: '#profile?tab=overview' }
  ];
  const TITLES = {
    home: ['Votre espace', 'Accueil'], community: ['Échanges choisis', 'Communauté'],
    path: ['Livres et souvenirs', 'Bibliothèque'], profile: ['Identité du lecteur', 'Profil'],
    session: ['Mode immersif', 'Session de lecture'], book: ['Dans votre bibliothèque', 'Fiche du livre'],
    club: ['Communauté à taille humaine', 'Club de lecture']
  };
  const STATUS_LABELS = { 'a-lire': 'À lire', 'en-cours': 'En cours', 'en-pause': 'En pause', lu: 'Lu', abandonne: 'Abandonné' };
  const SITUATION_LABELS = { possede: 'Possédé', emprunte: 'Emprunté', prete: 'Prêté', donne: 'Donné' };
  const VISIBILITY_LABELS = { public: 'Public', friends: 'Amis uniquement', club: 'Club', me: 'Moi uniquement', private: 'Privé' };
  const MEDIA_LABELS = { print: 'Livre papier', ebook: 'Livre numérique', audio: 'Livre audio' };
  const SURFACE_COLORS = [['terracotta','Terracotta'],['blue','Bleu'],['sage','Vert sauge'],['red','Rouge'],['black','Noir'],['white','Blanc']];
  const DEFAULT_GENRES = ['Romans','Essais','Science-fiction','Fantasy et fantastique','Policier et thriller','Philosophie','Histoire','Poésie','Biographies et mémoires','Sciences humaines','Jeunesse','Bande dessinée et manga','À classer'];
  const PHOTO_SCENES = [
    'Lectrice avec son livre dans un café lumineux', 'Lecture au bord d’une fenêtre un jour de pluie',
    'Lecteur au coucher du soleil', 'Livre ouvert dans un parc', 'Pause lecture dans un train',
    'Lecture calme à la maison', 'Livre face à la mer', 'Lecteur dans une librairie',
    'Amis lisant dans un parc', 'Lecture du soir près d’une lampe'
  ];
  const RECOMMENDATIONS = [
    { id:'rec-nausee', isbn:'9782070368051', title:'La Nausée', authors:['Jean-Paul Sartre'], genre:'Romans', totalPages:256, status:'a-lire', coverUrl:'https://covers.openlibrary.org/b/isbn/9782070368051-L.jpg', coverColor:'linear-gradient(145deg,#3b2d28,#a56c43)', reason:'Pour prolonger une réflexion romanesque sur l’existence et le regard.' },
    { id:'rec-tartares', isbn:'9782264032270', title:'Le Désert des Tartares', authors:['Dino Buzzati'], genre:'Romans', totalPages:320, status:'a-lire', coverUrl:'https://covers.openlibrary.org/b/isbn/9782264032270-L.jpg', coverColor:'linear-gradient(145deg,#3c4747,#a48e65)', reason:'Un roman lent et magnétique sur l’attente, le temps et les choix.' },
    { id:'rec-main-gauche', isbn:'9782253073277', title:'La Main gauche de la nuit', authors:['Ursula K. Le Guin'], genre:'Science-fiction', totalPages:352, status:'a-lire', coverUrl:'https://covers.openlibrary.org/b/isbn/9782253073277-L.jpg', coverColor:'linear-gradient(145deg,#26364d,#8daab3)', reason:'Une science-fiction profondément humaine sur l’altérité et les sociétés.' },
    { id:'rec-chambre-soi', isbn:'9782264060495', title:'Une chambre à soi', authors:['Virginia Woolf'], genre:'Essais', totalPages:192, status:'a-lire', coverUrl:'https://covers.openlibrary.org/b/isbn/9782264060495-L.jpg', coverColor:'linear-gradient(145deg,#593c4f,#c8999a)', reason:'Un essai vif sur la création, l’indépendance et la place des voix.' },
    { id:'rec-fahrenheit', title:'Fahrenheit 451', authors:['Ray Bradbury'], genre:'Science-fiction', totalPages:224, status:'a-lire', coverColor:'linear-gradient(145deg,#512724,#d27b45)', reason:'Une dystopie brève où les livres deviennent un espace de résistance.' },
    { id:'rec-klara', title:'Klara et le Soleil', authors:['Kazuo Ishiguro'], genre:'Science-fiction', totalPages:384, status:'a-lire', coverColor:'linear-gradient(145deg,#6f3e2d,#e1a262)', reason:'Un regard délicat sur l’humanité, la mémoire et la technologie.' },
    { id:'rec-hadrien', title:'Mémoires d’Hadrien', authors:['Marguerite Yourcenar'], genre:'Romans', totalPages:368, status:'a-lire', coverColor:'linear-gradient(145deg,#424443,#aa9b7d)', reason:'Une voix intérieure ample pour suivre le pouvoir, le temps et la transmission.' },
    { id:'rec-vivre', title:'Vivre', authors:['Yu Hua'], genre:'Romans', totalPages:240, status:'a-lire', coverColor:'linear-gradient(145deg,#603323,#bc7653)', reason:'Un récit épuré sur la dignité et ce qui demeure quand tout vacille.' },
    { id:'rec-sapiens', title:'Sapiens', authors:['Yuval Noah Harari'], genre:'Histoire', totalPages:544, status:'a-lire', coverColor:'linear-gradient(145deg,#594536,#b99765)', reason:'Une vaste synthèse pour relier histoire, sociétés et récits collectifs.' },
    { id:'rec-annie-ernaux', title:'Les Années', authors:['Annie Ernaux'], genre:'Biographies et mémoires', totalPages:256, status:'a-lire', coverColor:'linear-gradient(145deg,#4f3e42,#b08e8e)', reason:'Une mémoire intime qui devient le portrait sensible d’une époque.' },
    { id:'rec-bell-hooks', title:'À propos d’amour', authors:['bell hooks'], genre:'Essais', totalPages:288, status:'a-lire', coverColor:'linear-gradient(145deg,#6b3a4b,#ca8da0)', reason:'Un essai accessible pour penser le soin, les liens et la responsabilité.' },
    { id:'rec-silence', title:'Le Silence de la mer', authors:['Vercors'], genre:'Romans', totalPages:128, status:'a-lire', coverColor:'linear-gradient(145deg,#263d4a,#7195a3)', reason:'Un texte court et dense sur la résistance, l’écoute et les non-dits.' },
    { id:'rec-temps', title:'L’Ordre du temps', authors:['Carlo Rovelli'], genre:'Sciences et technologies', totalPages:208, status:'a-lire', coverColor:'linear-gradient(145deg,#25394b,#7896ad)', reason:'Une promenade limpide entre physique, perception et expérience du temps.' },
    { id:'rec-prophetie', title:'La Parabole du semeur', authors:['Octavia E. Butler'], genre:'Science-fiction', totalPages:480, status:'a-lire', coverColor:'linear-gradient(145deg,#513228,#c17b50)', reason:'Une anticipation lucide sur l’adaptation, la communauté et l’espoir.' },
    { id:'rec-poetique', title:'Une poétique de la relation', authors:['Édouard Glissant'], genre:'Essais', totalPages:256, status:'a-lire', coverColor:'linear-gradient(145deg,#24474b,#71a099)', reason:'Une pensée ouverte des identités, des langues et des mondes en relation.' },
    { id:'rec-piranese', title:'Piranèse', authors:['Susanna Clarke'], genre:'Fantasy et fantastique', totalPages:272, status:'a-lire', coverColor:'linear-gradient(145deg,#344952,#9bb0a5)', reason:'Un labyrinthe élégant, contemplatif et porté par le pouvoir des traces.' }
  ];

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]);
  const attr = esc;
  const isGuestMode = () => Boolean(window.BT.auth?.isGuest?.());
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const pct = (value, total) => total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const initials = name => String(name || 'L').trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const avatarSource = profile => profile?.avatarUrl || profile?.avatar_url || profile?.avatarData || '';
  const avatarInner = profile => {
    const source = avatarSource(profile);
    return `${source ? `<img src="${attr(source)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true">` : ''}<span class="avatar-fallback" aria-hidden="true">${esc(initials(profile?.name || profile?.display_name))}</span>`;
  };
  const avatarBubble = (profile, className = 'avatar') => `<span class="${className}" aria-hidden="true">${avatarInner(profile)}</span>`;
  const surfaceColorPicker = (action, color, label, className = '') => `<details class="surface-color-picker ${className}"><summary aria-label="${attr(label)}" title="${attr(label)}"><span aria-hidden="true">◐</span></summary><div class="surface-color-picker__menu" role="group" aria-label="${attr(label)}">${SURFACE_COLORS.map(([key,name]) => `<button type="button" class="bookcase-finish-swatch bookcase-finish-swatch--${key}" data-action="${attr(action)}" data-color="${key}" aria-label="${name}" title="${name}" aria-pressed="${color === key}"><span aria-hidden="true"></span></button>`).join('')}</div></details>`;
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const formatDate = value => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: new Date(value).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(new Date(value));
  const dateInputValue = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
  const readingDateISO = value => value ? new Date(`${value}T12:00:00`).toISOString() : null;
  const ratingStars = value => {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `<span class="book-rating-stars" role="img" aria-label="${rating} étoile${rating > 1 ? 's' : ''} sur 5"><span aria-hidden="true">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span></span>`;
  };
  const ratingPicker = (value = 0, target = 'finish-rating') => {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `<div class="rating-row" role="group" aria-label="Note de 1 à 5 étoiles">${[1,2,3,4,5].map(star => `<button class="rating-button ${star <= rating ? 'is-filled' : ''}" type="button" data-action="select-rating" data-target="${attr(target)}" data-value="${star}" aria-pressed="${star === rating}" aria-label="${star} étoile${star > 1 ? 's' : ''} sur 5"><span aria-hidden="true">★</span></button>`).join('')}</div>`;
  };
  const formatDateTime = value => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const formatDuration = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), secs = total % 60;
    return hours ? `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  };
  const relativeDate = value => {
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.round(diff / 60000));
    if (minutes < 2) return 'à l’instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60); if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24); return days < 7 ? `il y a ${days} j` : formatDate(value);
  };

  function parseRoute() {
    const raw = (location.hash || '#home').slice(1);
    const [route, query = ''] = raw.split('?');
    ui.route = ['home','community','path','profile','session','book','club'].includes(route) ? route : 'home';
    ui.params = new URLSearchParams(query);
    if (ui.route === 'community') ui.communityTab = ['public','clubs','salons','friends'].includes(ui.params.get('tab')) ? ui.params.get('tab') : 'public';
    if (ui.route === 'path') ui.pathTab = ['library','notebook','trail','lexicon'].includes(ui.params.get('tab')) ? ui.params.get('tab') : 'library';
    if (ui.route === 'profile') ui.profileTab = 'overview';
  }

  function init() {
    store.recoverActiveSession();
    const user = isGuestMode() ? null : window.BT.auth?.getCurrentUser?.();
    const profile = store.getProfile();
    if (isGuestMode() && (profile.name === 'Dixon' || !profile.name)) store.saveProfile({ name:'Invité BOO-P', handle:'@invite', visibility:'public' });
    if (user) {
      const remote = user.profile || {};
      const synchronized = {
        email:user.email,
        name:remote.display_name || (profile.name === 'Dixon' ? user.name : profile.name),
        handle:remote.handle ? `@${remote.handle}` : profile.handle,
        title:remote.profile_title || profile.title,
        bio:remote.bio ?? profile.bio,
        interests:Array.isArray(remote.interests) ? remote.interests : profile.interests,
        visibility:remote.profile_visibility || profile.visibility,
        avatarPath:remote.avatar_path || '',
        avatarUrl:remote.avatar_url || '',
        avatarData:''
      };
      if (Object.entries(synchronized).some(([key,value]) => JSON.stringify(profile[key]) !== JSON.stringify(value))) store.saveProfile(synchronized);
    }
    ui.memoryIndex = Number(store.getSettings().memoryIndex) || 0;
    applyTheme();
    bindGlobalEvents();
    renderNavigation();
    window.addEventListener('hashchange', () => { render(true); });
    window.addEventListener('boop:sharing-changed', async () => { await refreshCommunity({quiet:true}); render(); });
    window.addEventListener('online', () => { updateNetworkState(); bootstrapUserDataSync({ quiet:true }); });
    window.addEventListener('offline', updateNetworkState);
    updateNetworkState();
    if (!location.hash) location.hash = '#home'; else render();
    refreshCommunity({ quiet:true });
    refreshReaders('', { quiet:true });
    if (user && window.BT.notifications) {
      store.replaceNotifications([]);
      refreshNotifications({ quiet:true }).then(startNotificationSubscription);
    }
    ui.timer = window.setInterval(() => { tickSessionClock(); updateSyncIndicator(); }, 1000);
    ui.heartbeat = window.setInterval(() => store.heartbeatActiveSession(), 10000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { store.recoverActiveSession(); refreshNotifications({ quiet:true }); refreshCommunity({quiet:true}); bootstrapUserDataSync({ quiet:true, refresh:true }).finally(() => render()); } });
    window.addEventListener('pagehide', () => { ui.notificationUnsubscribe?.(); ui.syncUnsubscribe?.(); clearTimeout(ui.syncTimer); }, { once:true });
  }

  function remoteSnapshotHasData(snapshot) {
    return ['books','sessions','traces','lexicon'].some(key => Array.isArray(snapshot?.[key]) && snapshot[key].length)
      || Boolean(snapshot?.goals && Object.keys(snapshot.goals).length);
  }

  function scheduleUserDataSync(delay = 750) {
    if (ui.syncStopped || !ui.syncReady || isGuestMode() || !navigator.onLine) return;
    clearTimeout(ui.syncTimer);
    ui.syncTimer = window.setTimeout(() => syncUserDataNow(), delay);
  }

  async function syncUserDataNow() {
    if (ui.syncStopped || !ui.syncReady || isGuestMode() || !navigator.onLine || !window.BT.userDataSync) return;
    if (!store.getDataSyncStatus?.().dirty) return;
    if (ui.syncBusy || ui.syncBootstrapping) { ui.syncPending = true; return; }
    ui.syncBusy = true;
    const sent = store.getSyncedData();
    try {
      const baseline = store.getSyncBaseline();
      if (!baseline) throw new Error('Exportez votre copie locale, puis reprenez la version synchronisée depuis les réglages.');
      const remote = await window.BT.userDataSync.mergeSnapshot(baseline, sent);
      if (ui.syncStopped) return;
      if (remote?._sync?.skipped) throw new Error('Session indisponible.');
      if (JSON.stringify(store.getSyncedData()) === JSON.stringify(sent)) {
        store.replaceSyncedData(remote);
        store.markDataSynced(new Date().toISOString(), remote);
      } else {
        // Only acknowledge the exact snapshot sent. Later edits remain dirty.
        store.markDataSynced(new Date().toISOString(), sent);
        ui.syncPending = true;
      }
      ui.syncErrorShown = false;
    } catch (error) {
      console.error('BOO-P personal data sync', error);
      if (!ui.syncErrorShown) { showToast(error.code === 'BOOP_SYNC_CONFLICT' ? error.message : 'Vos changements restent sur cet appareil ; synchronisation en attente.'); ui.syncErrorShown = true; }
    } finally {
      ui.syncBusy = false;
      if (ui.syncPending) { ui.syncPending = false; scheduleUserDataSync(100); }
    }
  }

  async function bootstrapUserDataSync({ quiet = false, refresh = false } = {}) {
    if (ui.syncStopped || isGuestMode() || !window.BT.userDataSync || !navigator.onLine || ui.syncBootstrapping || ui.syncBusy) return false;
    if (ui.syncReady && !refresh) return true;
    ui.syncBootstrapping = true;
    try {
      window.BT.userDataSync.configure({ isGuest:isGuestMode });
      const localStatus = store.getDataSyncStatus();
      const local = store.getSyncedData();
      const baseline = store.getSyncBaseline();
      let remote = await window.BT.userDataSync.readSnapshot();
      if (ui.syncStopped) return false;
      if (remote?._sync?.skipped) return false;
      if (JSON.stringify(local) !== JSON.stringify(store.getSyncedData())) return false;
      if (baseline && localStatus.dirty) {
        remote = await window.BT.userDataSync.mergeSnapshot(baseline, local);
      } else if (!baseline && !localStatus.lastSyncedFingerprint && !remoteSnapshotHasData(remote)) {
        remote = await window.BT.userDataSync.mergeSnapshot(null, local);
      } else if (!baseline && (localStatus.dirty || (!localStatus.lastSyncedFingerprint && ['books','sessions','traces','lexicon'].some(key => local[key].length)))) {
        throw new Error('Ancienne copie locale : exportez-la puis reprenez la version synchronisée depuis les réglages.');
      }
      if (ui.syncStopped) return false;
      if (remote?._sync?.skipped) return false;
      if (JSON.stringify(local) === JSON.stringify(store.getSyncedData())) {
        store.replaceSyncedData(remote);
        store.markDataSynced(new Date().toISOString(), remote);
      } else {
        store.markDataSynced(new Date().toISOString(), local);
      }
      if (!ui.syncUnsubscribe) ui.syncUnsubscribe = store.subscribe(() => scheduleUserDataSync());
      ui.syncReady = true;
      ui.syncErrorShown = false;
      return true;
    } catch (error) {
      console.error('BOO-P initial data sync', error);
      ui.syncReady = false;
      if (!quiet && !ui.syncErrorShown) { showToast(error.message || 'Synchronisation indisponible ; vos données locales sont conservées.'); ui.syncErrorShown = true; }
      return false;
    } finally {
      ui.syncBootstrapping = false;
      if (ui.syncReady && store.getDataSyncStatus().dirty) scheduleUserDataSync();
    }
  }

  function bindGlobalEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('input', saveNotebookDraft);
    document.addEventListener('change', saveNotebookDraft);
    document.addEventListener('toggle', handleLibraryShelfToggle, true);
    document.addEventListener('toggle', event => { if (event.target.isConnected && event.target.matches('details.memory-disclosure')) ui.memoryExpanded = event.target.open; }, true);
    document.addEventListener('scroll', handleMemoryCarouselScroll, true);
    document.addEventListener('input', handleInput);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('touchstart', handleTrailPinchStart, { passive:false });
    document.addEventListener('touchmove', handleTrailPinchMove, { passive:false });
    document.addEventListener('touchend', handleTrailPinchEnd, { passive:true });
    document.addEventListener('touchcancel', handleTrailPinchEnd, { passive:true });
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog(dialog);
    }));
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); openSearch(); }
      const clubCard = event.target.closest?.('.club-card[data-action="open-club"]');
      if (clubCard && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); clubCard.click(); }
    });
  }

  function renderNavigation() {
    const links = NAV.map(item => `<a class="nav-link" href="${item.href}" data-nav="${item.id}"><span class="nav-link__icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join('');
    document.getElementById('desktop-nav').innerHTML = links;
    document.getElementById('mobile-nav').innerHTML = links;
  }

  function updateSyncIndicator() {
    const label = document.getElementById('sync-indicator'); if (!label) return;
    const status = store.getDataSyncStatus();
    const message = isGuestMode() ? 'Enregistré sur cet appareil' : !navigator.onLine ? 'Hors connexion · copie locale' : ui.syncBusy || ui.syncBootstrapping ? 'Synchronisation en cours…' : ui.syncReady && !status.dirty && status.lastSyncedAt ? 'Synchronisé' : status.dirty && ui.syncReady ? 'Modifications à synchroniser' : 'Synchronisation à reprendre';
    if (label.textContent !== message) label.textContent = message;
  }

  function updateNavigation() {
    const active = ui.route === 'book' || ui.route === 'session' || ui.route === 'club'
      ? (ui.route === 'book' ? 'path' : ui.route === 'club' ? 'community' : 'home')
      : ui.route;
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const [eyebrow, title] = TITLES[ui.route] || TITLES.home;
    document.getElementById('view-eyebrow').textContent = eyebrow;
    document.getElementById('view-title').textContent = title;
    document.title = `BOO-P — ${title}`;
  }

  function render(shouldFocus = false) {
    const previousRoute = ui.renderedRoute, previousHash = ui.renderedHash;
    parseRoute();
    if (ui.route !== 'path' || ui.pathTab !== 'library') ui.selectedLibraryBookId = null;
    if (ui.route === 'session' && !store.getActiveSession()) { location.hash = '#home'; return; }
    const view = document.getElementById('main-view');
    const renderers = { home: renderHome, community: renderCommunity, path: renderPath, profile: renderProfile, session: renderSession, book: renderBookDetail, club: renderClubSpace };
    const paint = () => {
      updateNavigation(); updateHeader();
      document.body.classList.toggle('is-reading', ui.route === 'session');
      document.body.classList.toggle('is-trail-immersive', ui.route === 'path' && ui.pathTab === 'trail' && ui.trailImmersive);
      try { view.innerHTML = renderers[ui.route](); }
      catch (error) {
        console.error('BOO-P render error', error);
        view.innerHTML = `<section class="empty-state" role="alert"><h1>Un passage s’est refermé trop vite</h1><p>Vos données locales sont intactes. Vous pouvez revenir à l’Accueil et réessayer.</p><a class="button button--primary" href="#home">Revenir à l’Accueil</a></section>`;
      }
      BT.reflection?.decorate(view);
      BT.push?.renderControls?.();
      ui.renderedRoute = ui.route; ui.renderedHash = location.hash;
      checkCelebrations();
      tickSessionClock(); updateSyncIndicator();
      requestAnimationFrame(() => {
        if (previousHash && previousHash !== location.hash) window.scrollTo({ top:0, behavior:'instant' });
        const carousel = document.querySelector('[data-memory-carousel]');
        if (carousel) carousel.scrollLeft = Math.min(ui.memoryCursor, carousel.children.length - 1) * carousel.clientWidth;
        if (ui.route === 'club') loadClubSpace(ui.params.get('id'));
        if(ui.route==='community' && ui.params.get('reader') && ui.readerLink!==location.hash){ui.readerLink=location.hash;openUserDialog(ui.params.get('reader'));}
        if (ui.route === 'path' && ui.pathTab === 'trail') restoreTrailViewport();
        if (ui.route === 'profile' && ['goals', 'settings'].includes(ui.params.get('section'))) {
          const section = document.getElementById('profile-' + ui.params.get('section'));
          section?.scrollIntoView({ behavior:'auto', block:'start' }); section?.focus({ preventScroll:true });
        }
      });
    };
    const routeChanged = Boolean(previousRoute && previousRoute !== ui.route);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (routeChanged && !reducedMotion && typeof document.startViewTransition === 'function') {
      const transition = document.startViewTransition(paint);
      if (shouldFocus) transition.finished.then(() => view.focus({ preventScroll:true })).catch(() => view.focus({ preventScroll:true }));
      return;
    }
    paint();
    if (shouldFocus) view.focus({ preventScroll: true });
  }

  function handleMemoryCarouselScroll(event) {
    const carousel = event.target;
    if (!(carousel instanceof HTMLElement) || !carousel.matches('[data-memory-carousel]') || !carousel.clientWidth) return;
    const next = Math.max(0, Math.min(carousel.children.length - 1, Math.round(carousel.scrollLeft / carousel.clientWidth)));
    if (next === ui.memoryCursor) return;
    ui.memoryCursor = next;
    carousel.parentElement?.querySelectorAll('.memory-carousel-dots span').forEach((dot, index) => dot.classList.toggle('is-current', index === next));
  }

  function trailViewportElements() {
    const shell = document.querySelector('[data-trail-shell]');
    const stage = shell?.querySelector('[data-trail-stage]');
    const canvas = shell?.querySelector('[data-trail-canvas]');
    return { shell, stage, canvas };
  }

  function rememberTrailViewport() {
    const { shell, canvas } = trailViewportElements();
    if (!shell || !canvas) return ui.trailViewCenter;
    const scale = Number(canvas.dataset.scale) || ui.trailScale || 1;
    ui.trailViewCenter = {
      x:(shell.scrollLeft + shell.clientWidth / 2) / scale,
      y:(shell.scrollTop + shell.clientHeight / 2) / scale
    };
    return ui.trailViewCenter;
  }

  function setTrailZoom(value, { center = null, announce = true, viewportPoint = null } = {}) {
    const { shell, stage, canvas } = trailViewportElements();
    if (!shell || !stage || !canvas) return;
    const width = Number(canvas.dataset.width) || canvas.offsetWidth;
    const height = Number(canvas.dataset.height) || canvas.offsetHeight;
    const previousScale = Number(canvas.dataset.scale) || ui.trailScale || 1;
    const focus = center || ui.trailViewCenter || {
      x:(shell.scrollLeft + shell.clientWidth / 2) / previousScale,
      y:(shell.scrollTop + shell.clientHeight / 2) / previousScale
    };
    const fitScale = Math.min((shell.clientWidth - 28) / width, (shell.clientHeight - 28) / height, 1);
    const nextScale = Math.max(.12, Math.min(1.6, value === 'fit' ? fitScale : Number(value) || previousScale));
    ui.trailScale = Math.round(nextScale * 100) / 100;
    ui.trailViewCenter = value === 'fit' ? { x:width / 2, y:height / 2 } : focus;
    canvas.dataset.scale = String(ui.trailScale);
    canvas.style.transform = `scale(${ui.trailScale})`;
    stage.style.width = `${Math.round(width * ui.trailScale)}px`;
    stage.style.height = `${Math.round(height * ui.trailScale)}px`;
    stage.classList.toggle('is-fitted', value === 'fit');
    const output = document.querySelector('[data-trail-zoom-value]');
    if (output) output.textContent = `${Math.round(ui.trailScale * 100)} %`;
    const anchor = viewportPoint || { x:shell.clientWidth / 2, y:shell.clientHeight / 2 };
    requestAnimationFrame(() => {
      shell.scrollLeft = Math.max(0, ui.trailViewCenter.x * ui.trailScale - anchor.x);
      shell.scrollTop = Math.max(0, ui.trailViewCenter.y * ui.trailScale - anchor.y);
    });
    if (announce) document.getElementById('live-region').textContent = value === 'fit' ? 'Toute la carte est maintenant visible.' : `Zoom du Sentier : ${Math.round(ui.trailScale * 100)} pour cent.`;
  }

  function restoreTrailViewport() {
    const { shell } = trailViewportElements(); if (!shell) return;
    const root = { x:Number(shell.dataset.rootX), y:Number(shell.dataset.rootY) };
    setTrailZoom(ui.trailScale, { center:ui.trailViewCenter || root, announce:false });
  }

  function trailTouchDistance(touches) {
    const x = touches[0].clientX - touches[1].clientX;
    const y = touches[0].clientY - touches[1].clientY;
    return Math.hypot(x, y);
  }

  function trailTouchPoint(touches, shell) {
    const rect = shell.getBoundingClientRect();
    return {
      x:(touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y:(touches[0].clientY + touches[1].clientY) / 2 - rect.top
    };
  }

  function handleTrailPinchStart(event) {
    const shell = event.target.closest?.('[data-trail-shell]');
    if (!shell || event.touches.length !== 2) return;
    const canvas = shell.querySelector('[data-trail-canvas]');
    if (!canvas) return;
    event.preventDefault();
    const scale = Number(canvas.dataset.scale) || ui.trailScale || 1;
    const point = trailTouchPoint(event.touches, shell);
    ui.trailPinch = {
      shell,
      startDistance:trailTouchDistance(event.touches),
      startScale:scale,
      focus:{ x:(shell.scrollLeft + point.x) / scale, y:(shell.scrollTop + point.y) / scale }
    };
    shell.classList.add('is-pinching');
  }

  function handleTrailPinchMove(event) {
    const pinch = ui.trailPinch;
    if (!pinch || event.touches.length !== 2 || !pinch.shell.isConnected) return;
    event.preventDefault();
    const distance = trailTouchDistance(event.touches);
    if (!pinch.startDistance || !distance) return;
    const nextScale = pinch.startScale * (distance / pinch.startDistance);
    setTrailZoom(nextScale, { center:pinch.focus, viewportPoint:trailTouchPoint(event.touches, pinch.shell), announce:false });
  }

  function handleTrailPinchEnd(event) {
    if (!ui.trailPinch || event.touches.length >= 2) return;
    const shell = ui.trailPinch.shell;
    shell?.classList.remove('is-pinching');
    ui.trailPinch = null;
    requestAnimationFrame(() => {
      rememberTrailViewport();
      document.getElementById('live-region').textContent = `Zoom du Sentier : ${Math.round(ui.trailScale * 100)} pour cent.`;
    });
  }

  function updateHeader() {
    const profile = store.getProfile();
    const shortcut = document.getElementById('profile-shortcut');
    shortcut.innerHTML = avatarInner(profile); shortcut.setAttribute('aria-label', `Ouvrir le profil de ${profile.name}`);
    const unread = store.getNotifications().filter(item => !item.read).length;
    const badge = document.getElementById('notification-badge');
    badge.hidden = unread === 0; badge.textContent = unread > 9 ? '9+' : String(unread);
    document.querySelector('[data-action="open-notifications"]')?.setAttribute('aria-label', unread ? `Ouvrir les notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Ouvrir les notifications');
  }

  function updateNetworkState() {
    const offline = !navigator.onLine;
    document.getElementById('offline-banner').hidden = !offline;
    if (!offline) store.flushOutbox();
  }

  function applyTheme() {
    const theme = store.getSettings().theme || 'light';
    document.body.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111923' : '#f6f1e8');
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message; toast.classList.add('is-visible');
    document.getElementById('live-region').textContent = message;
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function openDialog({ title, eyebrow = 'BOO-P', body, wide = false }) {
    const dialog = document.getElementById('app-dialog');
    ui.lastFocus = document.activeElement;
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-eyebrow').textContent = eyebrow;
    document.getElementById('dialog-body').innerHTML = body;
    dialog.classList.toggle('app-dialog--wide', wide);
    if (!dialog.open) dialog.showModal();
    setTimeout(() => dialog.querySelector('input,textarea,select,button')?.focus(), 40);
  }
  function closeDialog(dialog = document.getElementById('app-dialog')) { if (dialog?.open) dialog.close(); ui.lastFocus?.focus?.(); }

  function cover(book, size = '') {
    const image = book.coverUrl ? `<img src="${attr(book.coverUrl)}" alt="Couverture de ${attr(book.title)}" loading="lazy" decoding="async" onerror="this.hidden=true">` : '';
    return `<div class="book-cover ${size ? `book-cover--${size}` : ''}" style="background:${attr(book.coverColor || '#315066')}">${image}<span>${esc(book.title)}</span></div>`;
  }

  function addBookButton() {
    return '<button class="icon-button add-book-scan" type="button" data-action="add-book" aria-label="Ajouter un livre" title="Ajouter un livre · code-barres ou saisie"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M7 3H3v4m14-4h4v4M3 17v4h4m14-4v4h-4M7 7v10m3-10v10m4-10v10m3-10v10"/></svg></button>';
  }

  function bookProgress(book) {
    const audio = book.mediaType === 'audio';
    return {
      value: audio ? book.currentMinute : book.currentPage,
      total: audio ? book.durationMinutes : book.totalPages,
      label: audio ? `${book.currentMinute || 0} min sur ${book.durationMinutes || '—'}` : `page ${book.currentPage || 0} sur ${book.totalPages || '—'}`
    };
  }

  function renderHome() {
    const profile = store.getProfile(), active = store.getCurrentBook(), session = active ? store.getActiveSessionForBook(active.id) : null, goals = store.getGoalProgress();
    const settings = store.getSettings();
    const libraryBookCount = store.getBooks().filter(book => book.libraryState === 'library').length;
    const dnaBookTarget = 10, dnaBooksRemaining = Math.max(0, dnaBookTarget - libraryBookCount);
    const memoryColor = SURFACE_COLORS.some(([key]) => key === settings.memoryCardColor) ? settings.memoryCardColor : 'sage';
    const sessionColor = SURFACE_COLORS.some(([key]) => key === settings.sessionCardColor) ? settings.sessionCardColor : 'sage';
    const inProgress = store.getBooks().filter(book => book.status === 'en-cours' && book.libraryState === 'library');
    const openSessions = store.getActiveSessions();
    const progress = active ? bookProgress(active) : null;
    const memoryItems = getMemoryItems(), memory = getMemoryDeck(memoryItems);
    const weekPct = pct(goals.week.value, goals.week.target);
    return `
      <section class="page-head home-heading"><div><p class="eyebrow">Bonjour ${esc(profile.name)}</p><h1>Un moment pour lire.</h1></div>${addBookButton()}</section>
      <section class="section-block card active-book-card active-book-card--${sessionColor}" aria-labelledby="active-book-title">
        ${surfaceColorPicker('session-card-color', sessionColor, 'Personnaliser la couleur de la session', 'session-card-color-picker')}
        <div class="active-book-main">
          ${active ? cover(active) : `<div class="book-cover" style="background:linear-gradient(145deg,#17324d,#6f927c)"><span>Votre prochain livre</span></div>`}
          <div class="active-book-info">
            <p class="eyebrow">Lectures en cours</p>
            ${inProgress.length > 1 ? `<label class="sr-only" for="active-book-select">Choisir la lecture affichée</label><select class="book-switcher" id="active-book-select" data-change="active-book">${inProgress.map(book => `<option value="${attr(book.id)}" ${active?.id === book.id ? 'selected' : ''}>${esc(book.title)} — ${esc(book.authors.join(', '))}</option>`).join('')}</select>` : ''}
            <h2 id="active-book-title">${active ? esc(active.title) : 'Aucune lecture en cours'}</h2>
            <p class="muted small">${active ? `${esc(active.authors.join(', '))} · ${progress.label}` : 'Choisissez un livre dans votre bibliothèque pour commencer.'}</p>
            ${active ? `<div class="progress-track" aria-label="Progression ${pct(progress.value,progress.total)} %"><span style="--width:${pct(progress.value,progress.total)}%"></span></div>` : ''}
            ${session ? `<p class="session-state">${session.status === 'paused' ? 'Session en pause' : 'Session en cours'} · <span data-session-clock>${formatDuration(store.activeDuration(session))}</span>${session.autoPaused ? ' · pause automatique après 30 min' : ''}</p>` : ''}
          </div>
        </div>
        ${active ? `<div class="active-book-actions"><button class="button button--secondary" type="button" data-action="capture-memory" data-book-id="${attr(active.id)}">Garder une Trace</button><button class="button button--primary" type="button" data-action="${session ? 'resume-session' : 'start-session'}" data-id="${attr(session?.id || '')}">${session ? 'Reprendre la session' : 'Commencer à lire'}</button></div>` : `<a class="button button--primary" href="#path?tab=library">Choisir un livre</a>`}
        ${active ? `<button class="text-link" type="button" data-action="quick-progress" data-id="${attr(active.id)}">Mettre à jour ma ${active.mediaType === 'audio' ? 'minute' : 'page'}</button>` : ''}
        <button class="button button--ghost active-book-manual" type="button" data-action="manual-session">Ajouter une session passée</button>
        ${openSessions.length > 1 ? `<div class="open-session-list" aria-label="Sessions ouvertes">${openSessions.map(item => { const itemBook = store.getBookById(item.bookId); return `<button class="open-session-chip" type="button" data-action="focus-session" data-id="${attr(item.id)}"><span>${item.status === 'running' ? '▶' : 'Ⅱ'}</span><strong>${esc(itemBook?.title || 'Livre')}</strong><small>${formatDuration(store.activeDuration(item))}</small></button>`; }).join('')}</div>` : ''}
      </section>


      <section class="card week-overview" aria-labelledby="week-overview-title"><div><p class="eyebrow">À votre rythme</p><h2 id="week-overview-title">Votre semaine</h2><p>${goals.week.value} jour${goals.week.value > 1 ? 's' : ''} de lecture sur ${goals.week.target} souhaité${goals.week.target > 1 ? 's' : ''}</p></div><a class="text-link" href="#profile?section=goals">Voir mes objectifs →</a><div class="day-rings">${goals.week.days.map(day => `<button class="day-ring ${day.today ? 'is-today' : ''} ${day.reached ? 'is-reached' : ''}" type="button" data-action="show-day" data-day="${day.key}" style="--progress:${Math.min(360, pct(day.minutes, day.target) * 3.6)}deg" aria-label="${day.label}, ${day.minutes} minutes sur ${day.target}${day.today ? ', aujourd’hui' : ''}"><span>${day.label}</span></button>`).join('')}</div></section>
      <details class="memory-disclosure section-block" ${ui.memoryExpanded || ui.quizStarted ? 'open' : ''}><summary><span><span class="eyebrow">Ce qui reste des livres</span><strong>Retrouver mes souvenirs</strong><span class="small muted">Mots, citations et jeux de mémoire</span></span><span aria-hidden="true">＋</span></summary><div>
      <section class="section-block memory-section" aria-labelledby="memory-title">
        <div class="section-heading"><div><p class="eyebrow">${memory.length} carte${memory.length > 1 ? 's' : ''} disponible${memory.length > 1 ? 's' : ''}</p><h2 id="memory-title">Mémoire active</h2><p class="small muted">Cherchez la réponse, touchez une carte pour la retourner ou balayez pour en choisir une autre.</p></div><div class="section-heading__actions"><a class="text-link" href="#path?tab=lexicon">Mon lexique</a>${surfaceColorPicker('memory-card-color', memoryColor, 'Personnaliser la couleur des cartes devinettes', 'memory-color-picker')}</div></div>
        <div class="memory-list memory-list--${memoryColor}" aria-label="Cartes de la mémoire active">${memory.length ? `<div class="memory-carousel" data-memory-carousel tabindex="0" aria-label="Balayez horizontalement entre les cartes">${memory.map((item, index) => renderMemoryQuiz(item, index + 1, memory.length)).join('')}</div><div class="memory-carousel-dots" aria-hidden="true">${memory.map((_, index) => `<span class="${index === Math.min(ui.memoryCursor, memory.length - 1) ? 'is-current' : ''}"></span>`).join('')}</div>` : renderMemoryComplete()}</div>
        <p class="memory-reminder small muted">Les cartes sont réservées aux mots nouveaux · une nouvelle entrée arrive automatiquement après « Retrouvé ».</p>
      </section>

      ${renderLexiconQuiz()}


      </div></details>
      <div class="home-explore section-block"><a class="card" href="#path?tab=trail"><span aria-hidden="true">✦</span><div><strong>Explorer mon Sentier</strong><p class="small muted">Les liens entre vos lectures.</p></div><span aria-hidden="true">→</span></a><a class="card" href="#community?tab=clubs"><span aria-hidden="true">◎</span><div><strong>Retrouver mes clubs</strong><p class="small muted">Un livre, une conversation.</p></div><span aria-hidden="true">→</span></a></div>
      ${dnaBooksRemaining && !settings.dnaNudgeDismissed ? `<aside class="dna-note"><p class="small muted">Votre portrait se précise au fil des livres ajoutés. <a class="text-link" href="#profile">Voir mon portrait</a></p><button class="icon-button" type="button" data-action="dismiss-dna-nudge" aria-label="Masquer cette invitation">×</button></aside>` : ''}`;
  }

  function goalMini(label, value, progress) {
    const mixed = typeof progress === 'object';
    const green = mixed ? progress.greenPct : progress, orange = mixed ? progress.orangePct : 0, total = Math.min(100, green + orange);
    return `<a class="goal-mini" href="#profile?section=goals" aria-label="${label}, ${value}"><strong class="goal-mini__title">${label}</strong><span class="progress-ring ${mixed ? 'progress-ring--mixed' : ''}" style="--pct:${green};--green-pct:${green};--orange-pct:${orange};--total-pct:${total}"><span>${total}%</span></span><small class="goal-mini__value">${value}</small></a>`;
  }

  function goalStatusText(progress) {
    if (progress.period === 'year') return `${String(progress.filledValue).replace('.', ',')} / ${progress.target} livre${progress.target > 1 ? 's' : ''}`;
    return `${progress.value} lu${progress.value > 1 ? 's' : ''}${progress.inProgress ? ` · ${progress.inProgress} en cours` : ''} / ${progress.target}`;
  }

  function memoryDefinitionClue(definition, answer) {
    const escaped = String(answer || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? String(definition || '').replace(new RegExp(escaped, 'gi'), '_____') : String(definition || '');
  }

  function lexiconMemoryMeta(item) {
    const next = (item.reviewSchedule || []).find(stage => !stage.completedAt);
    if (!next) return { memoryId:item.id, memoryType:'lexicon', reviewLabel:'Cycle initial terminé · entretien adaptatif à venir', nextDueAt:null };
    const due = new Date(next.dueAt), dueToday = due.getTime() <= Date.now();
    const step = next.adaptive ? 'Entretien adaptatif' : `Étape J+${next.day}`;
    return { memoryId:item.id, memoryType:'lexicon', reviewLabel:dueToday ? `${step} · à revoir maintenant` : `${step} · prévue le ${formatDate(next.dueAt)}`, nextDueAt:next.dueAt };
  }

  function getMemoryItems() {
    const personal = store.getLexicon().filter(item => item.kind === 'word').map(item => {
      const memoryKey = `lexicon:${item.id}`;
      const source = [item.bookTitle || 'Note personnelle', item.author, item.page ? `p. ${item.page}` : ''].filter(Boolean).join(' · ');
      const clue = memoryDefinitionClue(item.definition, item.word).trim().replace(/[.!?]+$/, '');
      const riddle = clue ? `${clue.charAt(0).toLowerCase()}${clue.slice(1)}` : 'une idée rencontrée pendant votre lecture';
      const wordQuestion = /^(un|une|le|la|les|l['’]|du|des|de la)\b/i.test(clue)
        ? `Je suis ${riddle}. Qui suis-je ?`
        : `Je désigne l’idée suivante : « ${clue || 'une idée rencontrée pendant votre lecture'} ». Quel mot suis-je ?`;
      const content = { kind:'Mot à retrouver', question:wordQuestion, answer:item.word, detail:item.definition, source, date:item.updatedAt, memoryKey };
      return { ...content, ...lexiconMemoryMeta(item) };
    }).filter(Boolean).sort((a,b) => {
      const aDue = a.nextDueAt ? new Date(a.nextDueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.nextDueAt ? new Date(b.nextDueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue || new Date(b.date) - new Date(a.date);
    });
    const examples = [
      { kind:'Mot à retrouver', question:'Je suis une découverte inattendue et fructueuse faite par hasard, grâce à la curiosité et à l’esprit d’observation. Qui suis-je ?', answer:'Sérendipité', detail:'Une découverte heureuse réalisée alors que l’on cherchait autre chose.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis un manuscrit ancien dont le texte visible recouvre une écriture effacée. Qui suis-je ?', answer:'Palimpseste', detail:'Un manuscrit réutilisé après effacement d’un premier texte.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis une révélation soudaine qui fait apparaître le sens d’une situation. Qui suis-je ?', answer:'Épiphanie', detail:'Une manifestation ou une compréhension soudaine et lumineuse.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis une intention fragile qui ne se transforme presque jamais en action. Qui suis-je ?', answer:'Velléité', detail:'Une volonté faible ou passagère, sans effet réel.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je désigne un jugement fin, lucide et perspicace. Qui suis-je ?', answer:'Sagacité', detail:'La capacité à comprendre rapidement et justement.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Chez les philosophes antiques, je suis la tranquillité de l’âme libérée des troubles. Qui suis-je ?', answer:'Ataraxie', detail:'Un état de sérénité et d’absence de trouble.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je donne l’impression d’être présent partout à la fois. Qui suis-je ?', answer:'Ubiquité', detail:'Le fait d’être ou de sembler être en plusieurs lieux simultanément.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis une phrase brève qui condense une pensée ou une vérité. Qui suis-je ?', answer:'Aphorisme', detail:'Une formule concise exprimant une idée générale.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je me situe au seuil d’un ouvrage et j’en ouvre la lecture. Qui suis-je ?', answer:'Liminaire', detail:'Ce qui est placé au commencement d’un texte ou sert d’introduction.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je ne peux pas être exprimé avec des mots tant je dépasse le langage. Qui suis-je ?', answer:'Indicible', detail:'Ce qu’on ne peut pas dire ou décrire.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis la capacité à se reconstruire après une épreuve. Qui suis-je ?', answer:'Résilience', detail:'La faculté de retrouver un équilibre après un choc ou une difficulté.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis le sentiment de nouveauté et de surprise provoqué par un changement de cadre. Qui suis-je ?', answer:'Dépaysement', detail:'Le changement agréable ou déroutant ressenti loin de ses habitudes.', source:'Exemple BOO-P' }
    ].map((item,index) => ({ ...item, memoryKey:`example:${index}:${normalize(item.answer)}`, date:new Date(0).toISOString() }));
    return personal.concat(examples.slice(0, Math.max(0, 10 - personal.length)));
  }

  function getMemoryDeck(items) {
    const signature = items.map(item => item.memoryKey).sort().join('|');
    if (signature !== ui.memoryDeckSignature) {
      ui.memoryDeckSignature = signature;
      ui.memoryDeckKeys = items.slice(0, 10).map(item => item.memoryKey);
      ui.memorySessionTotal = ui.memoryDeckKeys.length;
      ui.memorySessionComplete = false;
      ui.memoryCursor = 0;
      ui.memoryCompletedKeys = [];
    }
    const byKey = new Map(items.map(item => [item.memoryKey, item]));
    ui.memoryDeckKeys = ui.memoryDeckKeys.filter(key => byKey.has(key));
    return ui.memoryDeckKeys.map(key => byKey.get(key));
  }

  function renderMemoryQuiz(item, position, total) {
    const label = `Afficher la réponse à la devinette : ${item.question}`;
    return `<article class="memory-card-shell" data-memory-key="${attr(item.memoryKey)}">
      <div class="memory-deck-status"><span>Carte ${position} sur ${total}</span><span>Balayer ↔</span></div>
      <button class="memory-flip-card" type="button" data-action="flip-memory" data-front-label="${attr(label)}" aria-pressed="false" aria-label="${attr(label)}">
        <span class="memory-flip-card__inner">
          <span class="memory-flip-card__face memory-flip-card__front" aria-hidden="false"><span class="status-chip">${esc(item.kind)}</span><span class="memory-flip-card__question">${esc(item.question)}</span><span class="memory-flip-card__gesture"><span aria-hidden="true">↻</span> Toucher pour retourner</span></span>
          <span class="memory-flip-card__face memory-flip-card__back" aria-hidden="true"><span class="eyebrow">Réponse</span><strong class="memory-flip-card__answer">${esc(item.answer)}</strong>${item.detail ? `<span class="memory-flip-card__detail">${esc(item.detail)}</span>` : ''}<small>${esc(item.source)}</small></span>
        </span>
      </button>
      <div class="memory-review-actions" hidden><small class="muted">${esc(item.reviewLabel || 'Exemple BOO-P · entraînement local')}</small><p>Avant de retourner la carte, aviez-vous retrouvé la réponse&nbsp;?</p><div class="memory-rating-row"><button class="button button--ghost button--small" type="button" data-action="memory-rate" data-quality="retry" data-id="${attr(item.memoryId || '')}" data-memory-key="${attr(item.memoryKey)}">À revoir</button><button class="button button--secondary button--small" type="button" data-action="memory-rate" data-quality="almost" data-id="${attr(item.memoryId || '')}" data-memory-key="${attr(item.memoryKey)}">Presque</button><button class="button button--sage button--small" type="button" data-action="memory-rate" data-quality="recalled" data-id="${attr(item.memoryId || '')}" data-memory-key="${attr(item.memoryKey)}">Retrouvé</button></div></div>
    </article>`;
  }

  function renderMemoryComplete() {
    if (!ui.memorySessionComplete) return '<div class="memory-complete"><p class="eyebrow">Rien à réviser</p><h3>Votre mémoire est au calme</h3><p>Ajoutez un nouveau mot dans votre lexique pour préparer une prochaine carte.</p><a class="button button--secondary" href="#path?tab=lexicon">Ouvrir mon lexique</a></div>';
    return `<div class="memory-complete"><span class="memory-complete__mark" aria-hidden="true">✓</span><p class="eyebrow">Séance terminée</p><h3>${ui.memorySessionTotal} carte${ui.memorySessionTotal > 1 ? 's' : ''} travaillée${ui.memorySessionTotal > 1 ? 's' : ''}</h3><p>Les prochaines cartes reviendront selon vos réponses, sans surcharger votre journée.</p><button class="button button--secondary" type="button" data-action="restart-memory">Revoir dix cartes</button></div>`;
  }

  const QUIZ_EXAMPLES = [
    { id:'quiz-exp-page', demo:true, kind:'expression', word:'tourner la page', definition:'Laisser une période derrière soi et avancer.', note:'Après une épreuve, une personne décide de ne plus rester enfermée dans le passé.' },
    { id:'quiz-exp-lines', demo:true, kind:'expression', word:'lire entre les lignes', definition:'Comprendre ce qui est suggéré sans être écrit explicitement.', note:'Le sens véritable d’un message se cache dans ses sous-entendus.' },
    { id:'quiz-exp-cart', demo:true, kind:'expression', word:'mettre la charrue avant les bœufs', definition:'Faire les choses dans le désordre en commençant par ce qui devrait venir après.', note:'Une personne prépare les détails avant même d’avoir posé les bases de son projet.' },
    { id:'quiz-exp-book', demo:true, kind:'expression', word:'dévorer un livre', definition:'Lire un livre très vite avec beaucoup d’intérêt.', note:'Le roman était si prenant que la lectrice l’a terminé en une soirée.' },
    { id:'quiz-quote-candide', demo:true, kind:'citation', word:'Il faut cultiver notre jardin.', definition:'Une invitation à agir concrètement sur ce qui dépend de nous.', bookTitle:'Candide', author:'Voltaire' },
    { id:'quiz-quote-pantagruel', demo:true, kind:'citation', word:'Science sans conscience n’est que ruine de l’âme.', definition:'Le savoir doit rester guidé par une exigence morale.', bookTitle:'Pantagruel', author:'François Rabelais' },
    { id:'quiz-quote-pensees', demo:true, kind:'citation', word:'Le cœur a ses raisons que la raison ne connaît point.', definition:'Les sentiments obéissent à une logique qui échappe parfois à l’analyse rationnelle.', bookTitle:'Pensées', author:'Blaise Pascal' },
    { id:'quiz-quote-discours', demo:true, kind:'citation', word:'Je pense, donc je suis.', definition:'La pensée consciente constitue une première certitude de l’existence.', bookTitle:'Discours de la méthode', author:'René Descartes' }
  ];

  function quizChoices(correct, pool, seed, limit = 4) {
    const normalizedCorrect = normalize(correct);
    const distractors = [...new Set(pool.filter(Boolean))].filter(value => normalize(value) !== normalizedCorrect).sort((a,b) => recommendationHash(`${seed}:${a}`) - recommendationHash(`${seed}:${b}`)).slice(0, Math.max(2, limit - 1));
    return [correct, ...distractors].sort((a,b) => recommendationHash(`${seed}:choice:${a}`) - recommendationHash(`${seed}:choice:${b}`));
  }

  function splitCitation(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (words.length < 6) return null;
    const cut = Math.min(words.length - 2, Math.max(3, Math.round(words.length * .48)));
    return { beginning:words.slice(0, cut).join(' '), ending:words.slice(cut).join(' ') };
  }

  function getQuizCandidates() {
    const books = store.getBooks().filter(book => book.libraryState === 'library');
    const personal = store.getLexicon().filter(item => ['expression','citation'].includes(item.kind)).map(item => {
      const book = item.bookId ? books.find(value => value.id === item.bookId) : null;
      return { ...item, demo:false, bookTitle:item.bookTitle || book?.title || '', author:item.author || book?.authors?.join(', ') || '' };
    });
    const entries = [...personal, ...QUIZ_EXAMPLES];
    const expressions = entries.filter(item => item.kind === 'expression');
    const citations = entries.filter(item => item.kind === 'citation');
    const expressionAnswers = expressions.map(item => item.word);
    const bookAnswers = [...new Set(citations.map(item => item.bookTitle).filter(Boolean))];
    const authorAnswers = [...new Set(citations.map(item => item.author).filter(Boolean))];
    const citationEndings = citations.map(item => splitCitation(item.word)?.ending).filter(Boolean);
    const questions = [];
    expressions.forEach(item => {
      const id = item.id || `quiz-expression-${recommendationHash(item.word)}`;
      questions.push({ id:`${id}:meaning`, entryId:item.demo ? '' : item.id, kind:'Expression en situation', prompt:`Quelle expression correspond à cette situation ?\n${item.note || item.definition || 'Retrouvez l’expression qui convient.'}`, choices:quizChoices(item.word, expressionAnswers, `${id}:meaning`), correct:item.word, explanation:item.definition || 'Expression rencontrée dans votre lecture.', source:[item.bookTitle, item.author].filter(Boolean).join(' · ') || 'Exemple BOO-P', bookId:item.bookId || null });
      if (item.bookTitle && bookAnswers.length >= 3) questions.push({ id:`${id}:book`, entryId:item.demo ? '' : item.id, kind:'Expression et livre', prompt:`Dans quel livre avez-vous conservé l’expression « ${item.word} » ?`, choices:quizChoices(item.bookTitle, bookAnswers, `${id}:book`), correct:item.bookTitle, explanation:item.definition || item.note || 'Expression conservée dans votre lexique.', source:[item.bookTitle, item.author].filter(Boolean).join(' · '), bookId:item.bookId || null });
    });
    citations.forEach(item => {
      const id = item.id || `quiz-citation-${recommendationHash(item.word)}`;
      const parts = splitCitation(item.word);
      if (parts && citationEndings.length >= 3) questions.push({ id:`${id}:continue`, entryId:item.demo ? '' : item.id, kind:'Suite de citation', prompt:`Quelle suite complète cette citation ?\n« ${parts.beginning}… »`, choices:quizChoices(parts.ending, citationEndings, `${id}:continue`), correct:parts.ending, explanation:item.definition || 'Retrouvez la formulation exacte de la citation.', source:[item.bookTitle, item.author].filter(Boolean).join(' · ') || 'Citation personnelle', fullText:item.word, bookId:item.bookId || null });
      if (item.bookTitle && bookAnswers.length >= 3) questions.push({ id:`${id}:book`, entryId:item.demo ? '' : item.id, kind:'Citation et livre', prompt:`Dans quel livre trouve-t-on cette citation ?\n« ${item.word} »`, choices:quizChoices(item.bookTitle, bookAnswers, `${id}:book`), correct:item.bookTitle, explanation:item.definition || 'Citation conservée dans votre lexique.', source:[item.bookTitle, item.author].filter(Boolean).join(' · '), fullText:item.word, bookId:item.bookId || null });
      if (item.author && authorAnswers.length >= 3) questions.push({ id:`${id}:author`, entryId:item.demo ? '' : item.id, kind:'Retrouver l’auteur', prompt:`Qui est l’auteur de cette citation ?\n« ${item.word} »`, choices:quizChoices(item.author, authorAnswers, `${id}:author`), correct:item.author, explanation:item.definition || 'Citation conservée dans votre lexique.', source:[item.bookTitle, item.author].filter(Boolean).join(' · '), fullText:item.word, bookId:item.bookId || null });
    });
    return questions.sort((a,b) => Number(Boolean(b.entryId)) - Number(Boolean(a.entryId)) || recommendationHash(a.id) - recommendationHash(b.id));
  }

  function getQuizDeck() {
    const candidates = getQuizCandidates();
    const signature = candidates.map(item => item.id).sort().join('|');
    if (signature !== ui.quizSignature) {
      ui.quizSignature = signature;
      ui.quizQuestionIds = [];
      ui.quizStarted = false;
      ui.quizFinished = false;
      ui.quizIndex = 0;
      ui.quizScore = 0;
    }
    const byId = new Map(candidates.map(item => [item.id, item]));
    return { candidates, questions:ui.quizQuestionIds.map(id => byId.get(id)).filter(Boolean) };
  }

  function renderLexiconQuiz() {
    const { candidates, questions } = getQuizDeck();
    const personalCount = store.getLexicon().filter(item => ['expression','citation'].includes(item.kind)).length;
    const settings = store.getSettings();
    const quizColor = SURFACE_COLORS.some(([key]) => key === settings.quizCardColor) ? settings.quizCardColor : 'terracotta';
    const colorPicker = surfaceColorPicker('quiz-card-color', quizColor, 'Personnaliser la couleur du quiz', 'quiz-color-picker');
    if (!ui.quizStarted) return `<section class="section-block lexicon-quiz" aria-labelledby="lexicon-quiz-title"><div class="section-heading"><div><p class="eyebrow">Expressions & citations</p><h2 id="lexicon-quiz-title">Quiz de lecture</h2><p class="small muted">Sens, contexte, auteur et livre d’origine : cinq questions pour faire revenir les phrases autrement.</p></div>${colorPicker}</div><div class="card quiz-intro quiz-surface quiz-surface--${quizColor}"><span class="quiz-intro__mark" aria-hidden="true">?</span><div><strong>${personalCount ? `${personalCount} souvenir${personalCount > 1 ? 's' : ''} personnel${personalCount > 1 ? 's' : ''} prêt${personalCount > 1 ? 's' : ''}` : 'Quiz de découverte prêt'}</strong><p class="small muted">Les exemples BOO-P complètent vos propres expressions et citations lorsque le lexique est encore court.</p></div><button class="button button--primary" type="button" data-action="start-quiz" ${candidates.length ? '' : 'disabled'}>Lancer 5 questions</button></div></section>`;
    if (ui.quizFinished || !questions.length) return `<section class="section-block lexicon-quiz" aria-labelledby="lexicon-quiz-title"><div class="section-heading"><div><p class="eyebrow">Quiz terminé</p><h2 id="lexicon-quiz-title">${ui.quizScore}/${questions.length || 5} bonnes réponses</h2><p class="small muted">Les réponses difficiles reviendront plus tôt dans vos prochaines révisions.</p></div><div class="section-heading__actions"><button class="button button--secondary button--small" type="button" data-action="restart-quiz">Recommencer</button>${colorPicker}</div></div></section>`;
    const question = questions[ui.quizIndex];
    if (!question) return '';
    const selected = ui.quizSelected, answered = ui.quizAnswered, correct = selected === question.correct;
    const book = question.bookId ? store.getBookById(question.bookId) : store.getBooks().find(item => normalize(item.title) === normalize(question.source?.split(' · ')[0]));
    const choices = question.choices.map(choice => `<button class="quiz-choice ${answered && choice === question.correct ? 'is-correct' : ''} ${answered && choice === selected && choice !== question.correct ? 'is-wrong' : ''}" type="button" data-action="quiz-answer" data-answer="${attr(choice)}" ${answered ? 'disabled' : ''}><span aria-hidden="true"></span>${esc(choice)}</button>`).join('');
    const feedback = answered ? `<div class="quiz-feedback ${correct ? 'is-correct' : 'is-wrong'}"><div>${book ? cover(book,'small') : `<span class="quiz-feedback__mark" aria-hidden="true">${correct ? '✓' : '↺'}</span>`}</div><div><strong>${correct ? 'Bonne réponse' : `La réponse était : ${esc(question.correct)}`}</strong>${question.fullText ? `<q>${esc(question.fullText)}</q>` : ''}<p>${esc(question.explanation)}</p><small>${esc(question.source)}</small></div></div><button class="button button--primary quiz-next" type="button" data-action="next-quiz">${ui.quizIndex + 1 >= questions.length ? 'Voir mon résultat' : 'Question suivante'}</button>` : '';
    return `<section class="section-block lexicon-quiz" aria-labelledby="lexicon-quiz-title"><div class="section-heading"><div><p class="eyebrow">Question ${ui.quizIndex + 1} sur ${questions.length}</p><h2 id="lexicon-quiz-title">Quiz expressions & citations</h2></div><div class="section-heading__actions"><span class="quiz-score">${ui.quizScore} point${ui.quizScore > 1 ? 's' : ''}</span>${colorPicker}</div></div><article class="card quiz-card quiz-surface quiz-surface--${quizColor}" aria-live="polite"><span class="status-chip">${esc(question.kind)}</span><h3>${esc(question.prompt).replace(/\n/g, '<br>')}</h3><div class="quiz-choices">${choices}</div>${feedback}</article></section>`;
  }

  function renderSessionPositionSlider(book, value, { id = 'session-page-slider', name = '', dataChange = '' } = {}) {
    const audio = book.mediaType === 'audio', knownMaximum = Number(audio ? book.durationMinutes : book.totalPages);
    const maximum = knownMaximum || 99999, position = Math.round(clamp(value, 0, maximum));
    const rangeMaximum = knownMaximum || Math.max(1000, position);
    const label = audio ? 'Minute atteinte' : 'Page atteinte';
    return `<div class="field session-page-slider"><label for="${attr(id)}-number">${label}</label><div class="position-number-row"><input id="${attr(id)}-number" type="number" inputmode="numeric" min="0" max="${maximum}" step="1" required value="${position}" ${name ? `name="${attr(name)}"` : ''} ${dataChange ? `data-change="${attr(dataChange)}"` : ''} data-position-number><span class="small muted">${knownMaximum ? `sur ${knownMaximum} ${audio ? 'minutes' : 'pages'}` : 'Longueur non renseignée'}</span></div><label class="sr-only" for="${attr(id)}">Ajuster la ${audio ? 'minute' : 'page'} avec le curseur</label><input id="${attr(id)}" type="range" min="0" max="${rangeMaximum}" step="1" value="${position}" ${dataChange ? `data-change="${attr(dataChange)}"` : ''} data-position-range><output class="sr-only" data-session-page-output for="${attr(id)} ${attr(id)}-number">${position}</output></div>`;
  }

  function renderSession() {
    const session = store.getActiveSession();
    if (!session) return '';
    const book = store.getBookById(session.bookId);
    const sessions = store.getActiveSessions(), audio = book.mediaType === 'audio';
    const citations = Array.isArray(session.citations) ? session.citations : [];
    return `<section class="session-view">
      <div class="session-top"><button class="button button--ghost" type="button" data-action="leave-session">← Accueil</button>${sessions.length > 1 ? `<label class="session-switcher">Session<select data-change="focus-session">${sessions.map(item => { const itemBook = store.getBookById(item.bookId); return `<option value="${attr(item.id)}" ${item.id === session.id ? 'selected' : ''}>${esc(itemBook?.title || 'Livre')} · ${item.status === 'running' ? 'en lecture' : 'en pause'}</option>`; }).join('')}</select></label>` : ''}<span class="simulated-badge">Sauvegarde locale active</span></div>
      <div class="session-book">${cover(book,'small')}<div><p class="eyebrow">Lecture en cours</p><h1>${esc(book.title)}</h1><p class="muted">${esc(book.authors.join(', '))}</p></div></div>
      <div class="session-timer"><span class="session-timer__value" data-session-clock>${formatDuration(store.activeDuration(session))}</span><span class="session-timer__status">${session.status === 'paused' ? 'En pause' : 'En lecture'}</span>${session.autoPaused ? '<p class="small muted">BOO-P a mis cette session en pause après 30 minutes en arrière-plan.</p>' : ''}</div>
      <div class="session-controls"><button class="button button--secondary" type="button" data-action="session-lexicon">+ Lexique</button><button class="button button--primary session-control-main" type="button" data-action="toggle-session" aria-label="${session.status === 'paused' ? 'Reprendre' : 'Mettre en pause'}">${session.status === 'paused' ? '▶' : 'Ⅱ'}</button><button class="button button--sage" type="button" data-action="finish-session">Terminer</button></div>
      <aside class="card card-pad session-panel">
        <p class="eyebrow">Progression et note</p><div class="form-grid">
          ${renderSessionPositionSlider(book, session.endPage, { dataChange:'session-page' })}
          <div class="session-citation-composer"><label class="field" for="session-citation-draft">Citation<textarea id="session-citation-draft" data-input="session-citation" placeholder="Une phrase du livre à conserver…">${esc(session.citationDraft || session.note || '')}</textarea></label><div class="session-citation-actions"><button class="button button--secondary" type="button" data-action="save-session-citation">Ajouter la citation</button><span class="small muted" role="status" aria-live="polite">${citations.length} citation${citations.length > 1 ? 's' : ''} ajoutée${citations.length > 1 ? 's' : ''} pendant cette session</span></div></div>
          ${citations.length ? `<ol class="session-citation-list" aria-label="Citations ajoutées pendant cette session">${citations.map(citation => `<li><q>${esc(citation.text)}</q>${citation.page ? `<small>${audio ? 'Minute' : 'Page'} ${citation.page}</small>` : ''}</li>`).join('')}</ol>` : '<p class="small muted session-citation-empty">Validez chaque citation : le champ se videra pour accueillir la suivante.</p>'}
          <label class="field">Trace en brouillon<textarea id="session-trace-draft" data-input="session-trace" placeholder="Écrivez ou dictez une Trace…">${esc(session.traceDraft)}</textarea></label>
          <button class="button button--secondary" type="button" data-action="dictate-trace">Dicter une Trace <span class="simulated-badge">selon navigateur</span></button>
        </div>
      </aside>
    </section>`;
  }

  function tickSessionClock() {
    const session = store.getActiveSession();
    document.querySelectorAll('[data-session-clock]').forEach(element => { element.textContent = session ? formatDuration(store.activeDuration(session)) : '00:00'; });
  }

  function renderCommunity() {
    const tabs = [
      ['public','Fil'], ['clubs','Mes clubs'], ['salons','Salons'], ['friends','Amis']
    ];
    const bodies = { public: renderPublicFeed, clubs: renderClubs, salons: renderSalons, friends: renderFriends };
    return `<section class="page-head"><div><p class="eyebrow">Des échanges sans classement</p><h1>Communauté</h1><p>Découvrez des lectures partagées et choisissez toujours ce qui devient visible.</p></div><span class="simulated-badge">Exemples fictifs · contributions Supabase</span></section>
      <nav class="tabs" aria-label="Sections de la Communauté">${tabs.map(([id,label]) => `<a class="tab" href="#community?tab=${id}" aria-current="${ui.communityTab === id ? 'page' : 'false'}">${label}</a>`).join('')}</nav>
      ${bodies[ui.communityTab]()}`;
  }

  function renderPublicFeed() {
    const posts = store.getCommunity().posts.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    return `<div class="section-heading"><div><h2>Fil des lecteurs</h2><p class="small muted">Publications de la communauté et de vos amis, selon l’audience choisie. Les exemples sont fictifs.</p></div><button class="button button--primary button--small" type="button" data-action="create-post">Laisser une Trace</button></div>
      <div class="public-feed" tabindex="0" aria-label="Fil de Traces, faire défiler pour voir toutes les publications">${posts.map(post => renderPost(post)).join('')}</div>`;
  }

  function renderPost(post) {
    const open = ui.openComments.has(post.id);
    const comments = post.comments || [];
    return `<article class="card activity-card" data-post="${attr(post.id)}">
      <header class="activity-head"><span class="avatar">${esc(post.initials || initials(post.authorName))}</span><div class="activity-meta"><strong>${esc(post.authorName)}</strong><span>${activityLabel(post)} · ${relativeDate(post.date)}</span></div>
        ${post.authorId !== 'me' ? `<details class="safety-menu"><summary aria-label="Modérer cette publication">•••</summary><div class="safety-menu__panel"><button type="button" data-action="report-post" data-id="${attr(post.id)}">Signaler la publication</button><button type="button" data-action="block-user" data-id="${attr(post.authorId)}">Bloquer ${esc(post.authorName)}</button></div></details>` : `<span class="privacy-badge">${VISIBILITY_LABELS[post.visibility] || post.visibility}</span>`}
      </header>
      ${renderPostPhoto(post)}
      ${post.bookTitle ? `<p class="eyebrow">${esc(post.bookTitle)}</p>` : ''}<p class="activity-text">${esc(post.text)}</p>${post.readingKind ? `<button class="text-link activity-publication-link" type="button" data-action="view-publication" data-id="${attr(post.id)}">${post.readingKind === 'notebook' ? 'Lire le carnet' : 'Lire la publication'}</button>` : ''}
      <div class="activity-actions">
        <button class="button button--ghost button--small" type="button" data-action="encourage" data-id="${attr(post.id)}" aria-pressed="${post.encouraged}">Encourager · ${post.encouragements}</button>
        <button class="button button--ghost button--small" type="button" data-action="comment-post" data-id="${attr(post.id)}" aria-expanded="${open}">Trace · ${comments.length}</button>
      </div>
      ${open ? renderComments(post) : ''}
    </article>`;
  }

  function renderPostPhoto(post) {
    if (post.photoUrl || post.photoData) return `<figure class="activity-photo"><img src="${attr(post.photoUrl || post.photoData)}" alt="Photo ajoutée à la Trace de ${attr(post.authorName)}" loading="lazy" decoding="async"></figure>`;
    if (!Number.isInteger(post.photoIndex)) return '';
    const column = post.photoIndex % 5, row = Math.floor(post.photoIndex / 5);
    return `<figure class="activity-photo activity-photo--sprite" role="img" aria-label="Exemple fictif : ${attr(PHOTO_SCENES[post.photoIndex] || 'moment de lecture')}" style="--photo-x:${column * 25}%;--photo-y:${row * 100}%"><figcaption>Photo fictive de démonstration</figcaption></figure>`;
  }

  function activityLabel(post) {
    if (post.readingKind) return ({notebook:'a publié un carnet',word:'a découvert un mot',expression:'a partagé une expression',citation:'a partagé une citation',thought:'a partagé une pensée',session:'a partagé un moment de lecture',debut:'a commencé une lecture',fin:'a terminé une lecture'})[post.readingKind];
    return ({ fin: 'a terminé une lecture', debut: 'a commencé une lecture', trace: 'a partagé une Trace', goal: 'a atteint un objectif' })[post.type] || 'a partagé une lecture';
  }

  function renderComments(post) {
    return `<div class="comments"><form class="inline-form" data-form="comment" data-post-id="${attr(post.id)}"><label class="sr-only" for="comment-${attr(post.id)}">Votre Trace pour ${attr(post.authorName)}</label><input id="comment-${attr(post.id)}" name="text" required maxlength="500" placeholder="Une réponse bienveillante…"><button class="button button--sage button--small" type="submit">Envoyer</button></form>
      ${post.comments.length ? post.comments.map(comment => `<div class="comment"><p><strong>${esc(comment.authorName)}</strong> · <span class="muted">${relativeDate(comment.date)}</span></p><p>${esc(comment.text)}</p><button class="text-link small" type="button" data-action="reply-comment" data-post-id="${attr(post.id)}" data-id="${attr(comment.id)}">Répondre</button>${(comment.replies || []).map(reply => `<div class="comment-reply"><strong>${esc(reply.authorName)}</strong><p>${esc(reply.text)}</p></div>`).join('')}</div>`).join('') : '<p class="small muted">Soyez la première personne à laisser une Trace.</p>'}</div>`;
  }

  function renderClubs() {
    const clubs = store.getCommunity().clubs;
    return `<div class="section-heading"><div><h2>Clubs</h2><p class="small muted">Chaque club possède désormais son espace : lectures, annonces, membres, salons et échanges.</p></div><button class="button button--primary button--small" type="button" data-action="create-club">Créer un club</button></div>
      ${clubs.length ? `<div class="grid-2">${clubs.map(club => {
        const pending = club.membershipStatus === 'pending';
        const membershipButton = club.role === 'owner' ? ''
          : `<button class="button ${club.joined || pending ? 'button--secondary' : 'button--sage'} button--small" type="button" data-action="toggle-club" data-id="${attr(club.id)}" data-current="${Boolean(club.membershipStatus)}">${club.joined ? 'Quitter le club' : pending ? 'Annuler la demande' : club.access === 'open' ? 'Rejoindre' : 'Demander à rejoindre'}</button>`;
        return `<article class="card club-card ${club.joined ? 'club-card--member' : ''}" data-action="open-club" data-id="${attr(club.id)}" tabindex="0" role="link" aria-label="Entrer dans le club ${attr(club.name)}"><span class="club-mark" style="--club-color:${attr(club.color)}"></span><div class="card-content"><div class="button-row"><span class="privacy-badge">${club.visibility === 'private' ? 'Privé' : 'Public'}</span>${club.role ? `<span class="status-chip">${club.role === 'owner' ? 'Propriétaire' : club.role === 'moderator' ? 'Modérateur' : 'Membre'}</span>` : pending ? '<span class="status-chip status-chip--warning">Demande en attente</span>' : ''}</div><h3>${esc(club.name)}</h3><p class="small muted">${esc(club.description)}</p><p class="small"><strong>Livre actuel :</strong> ${esc(club.bookTitle || 'À choisir')}</p><p class="micro muted">${club.membersCount} membre${club.membersCount > 1 ? 's' : ''} · ${club.access === 'open' ? 'accès libre' : 'sur approbation'}</p><div class="card-actions">${membershipButton}<button class="button button--ghost button--small" type="button" data-action="open-club" data-id="${attr(club.id)}">Entrer dans le club →</button></div></div></article>`;
      }).join('')}</div>` : '<div class="empty-state"><h3>Aucun club accessible</h3><p>Créez un club ou rejoignez un club public lorsque d’autres lecteurs en auront publié.</p></div>'}`;
  }

  function renderClubSpace() {
    const id = ui.params.get('id');
    const club = store.getCommunity().clubs.find(item => item.id === id);
    if (!club) return `<a class="text-link" href="#community?tab=clubs">← Tous les clubs</a><div class="empty-state section-block"><h1>Club introuvable</h1><p>Ce club n’est peut-être plus accessible avec votre compte.</p></div>`;
    if (!club.joined) {
      const pending = club.membershipStatus === 'pending';
      return `<a class="text-link" href="#community?tab=clubs">← Tous les clubs</a><section class="club-space-hero section-block" style="--club-color:${attr(club.color)}"><div><p class="eyebrow">${club.visibility === 'private' ? 'Club privé' : 'Club public'}</p><h1>${esc(club.name)}</h1><p>${esc(club.description)}</p></div><span class="club-space-hero__mark" aria-hidden="true">◌</span></section><div class="empty-state club-space-locked"><h2>La porte du club est encore fermée</h2><p>Les lectures, annonces et échanges sont réservés aux membres actifs.</p><button class="button button--sage" type="button" data-action="toggle-club" data-id="${attr(club.id)}" data-current="${Boolean(club.membershipStatus)}">${pending ? 'Annuler la demande' : club.access === 'open' ? 'Rejoindre ce club' : 'Demander à rejoindre'}</button></div>`;
    }
    const space = ui.clubSpaces.get(id), loadError = ui.clubSpaceErrors.get(id);
    if (!space) return `<a class="text-link" href="#community?tab=clubs">← Tous les clubs</a><section class="club-space-hero section-block" style="--club-color:${attr(club.color)}"><div><p class="eyebrow">Espace du club</p><h1>${esc(club.name)}</h1><p>${esc(club.description)}</p></div><span class="club-space-hero__mark" aria-hidden="true">◌</span></section>${loadError ? `<div class="empty-state section-block"><h2>Le carnet partagé ne répond pas encore</h2><p>${esc(loadError)}</p><button class="button button--secondary" type="button" data-action="refresh-club" data-id="${attr(id)}">Réessayer</button></div>` : '<div class="view-loading" role="status"><span class="loader" aria-hidden="true"></span> Préparation du carnet partagé…</div>'}`;
    const owner = club.role === 'owner', manager = ['owner','moderator'].includes(club.role);
    const current = space.books.find(book => book.status === 'current') || (club.bookTitle ? { id:'', title:club.bookTitle, status:'current' } : null);
    const booksRead = space.books.filter(book => book.status === 'read').sort((a,b) => new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at));
    const upcoming = space.salons.filter(salon => salon.status !== 'closed' && new Date(salon.scheduledAt) >= new Date(Date.now() - 3600000)).sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const members = (club.members || []).filter(member => member.status === 'active');
    const renderClubPost = post => `<article class="club-post ${post.type === 'announcement' ? 'club-post--announcement' : ''}"><header><div><span class="avatar">${esc(initials(post.authorName))}</span><span><strong>${esc(post.authorName)}</strong><small>${post.type === 'announcement' ? 'Annonce du club' : 'Discussion'} · ${relativeDate(post.date)}</small></span></div>${post.type === 'announcement' ? '<span class="status-chip status-chip--warning">Annonce</span>' : ''}</header><p>${esc(post.text)}</p><div class="club-post__actions"><button class="text-link small" type="button" data-action="club-encourage" data-id="${attr(post.id)}" data-club-id="${attr(id)}" data-current="${post.encouraged}">${post.encouraged ? '♥ Encouragé' : '♡ Encourager'} · ${post.encouragements}</button><span class="small muted">${post.comments.length} commentaire${post.comments.length > 1 ? 's' : ''}</span></div>${post.comments.length ? `<div class="club-comments">${post.comments.map(comment => `<div class="comment"><strong>${esc(comment.authorName)}</strong><p>${esc(comment.text)}</p><span class="micro muted">${relativeDate(comment.date)}</span></div>`).join('')}</div>` : ''}<form class="inline-form" data-form="club-comment" data-club-id="${attr(id)}" data-post-id="${attr(post.id)}"><label class="sr-only" for="club-comment-${attr(post.id)}">Commenter</label><input id="club-comment-${attr(post.id)}" name="text" required maxlength="500" placeholder="Ajouter un commentaire bienveillant…"><button class="button button--sage button--small" type="submit">Envoyer</button></form></article>`;
    return `<a class="text-link" href="#community?tab=clubs">← Tous les clubs</a>
      <section class="club-space-hero section-block" style="--club-color:${attr(club.color)}"><div><p class="eyebrow">${club.visibility === 'private' ? 'Club privé' : 'Club public'} · ${club.membersCount} membre${club.membersCount > 1 ? 's' : ''}</p><h1>${esc(club.name)}</h1><p>${esc(club.description)}</p><div class="button-row">${owner ? `<button class="button button--secondary button--small" type="button" data-action="club-details" data-id="${attr(id)}">Réglages et membres</button><button class="button button--ghost button--small" type="button" data-action="create-salon" data-club-id="${attr(id)}">Programmer un salon</button>` : ''}</div></div><span class="club-space-hero__mark" aria-hidden="true">◌</span></section>
      <div class="club-space-layout">
        <main class="club-space-feed">
          <section class="card club-current-book"><div><p class="eyebrow">Lecture en cours</p><h2>${esc(current?.title || 'Le prochain livre reste à choisir')}</h2><p class="small muted">${current ? 'Le point de rencontre actuel du club.' : 'Un modérateur pourra bientôt ouvrir une nouvelle lecture.'}</p></div>${current?.id && manager ? `<button class="button button--sage button--small" type="button" data-action="club-book-read" data-id="${attr(current.id)}" data-club-id="${attr(id)}">Marquer comme lu</button>` : ''}</section>
          <section class="section-block" aria-labelledby="club-feed-title"><div class="section-heading"><div><p class="eyebrow">Carnet partagé</p><h2 id="club-feed-title">Annonces et échanges</h2></div><button class="button button--ghost button--small" type="button" data-action="refresh-club" data-id="${attr(id)}">↻ Actualiser</button></div><form class="card club-composer form-grid" data-form="club-post" data-club-id="${attr(id)}"><label class="field">Partager avec le club<textarea name="text" required maxlength="1200" placeholder="Une pensée, une question ou une information pour le club…"></textarea></label>${manager ? '<label class="field">Type<select name="type"><option value="discussion">Discussion</option><option value="announcement">Annonce du club</option></select></label>' : '<input type="hidden" name="type" value="discussion">'}<button class="button button--primary button--small" type="submit">Publier dans le club</button></form><div class="club-post-list">${space.posts.length ? space.posts.map(renderClubPost).join('') : '<div class="empty-state"><h3>Le carnet partagé est prêt</h3><p>Publiez la première pensée ou annonce du club.</p></div>'}</div></section>
        </main>
        <aside class="club-space-aside">
          <section class="card card-pad"><div class="section-heading"><h2>Prochains salons</h2>${owner ? `<button class="text-link small" type="button" data-action="create-salon" data-club-id="${attr(id)}">Ajouter</button>` : ''}</div>${upcoming.length ? upcoming.slice(0,4).map(salon => `<article class="club-aside-item"><span aria-hidden="true">◷</span><div><strong>${esc(salon.title)}</strong><small>${formatDateTime(salon.scheduledAt)} · ${esc(salon.bookTitle || 'Lecture du club')}</small><button class="text-link small" type="button" data-action="${salon.joined ? 'salon-thread' : 'toggle-salon'}" data-id="${attr(salon.id)}">${salon.joined ? 'Ouvrir le salon' : 'Rejoindre'}</button></div></article>`).join('') : '<p class="small muted">Aucun salon programmé.</p>'}</section>
          <section class="card card-pad"><h2>Livres lus dans le club</h2>${booksRead.length ? `<div class="club-book-history">${booksRead.map(book => `<div class="club-aside-item"><span aria-hidden="true">✓</span><div><strong>${esc(book.title)}</strong><small>${book.completed_at ? `Terminé le ${formatDate(book.completed_at)}` : 'Lecture terminée'}</small></div></div>`).join('')}</div>` : '<p class="small muted">L’histoire de lecture du club commencera ici.</p>'}${manager ? `<details class="setting-card section-block"><summary>Ajouter une lecture</summary><div class="setting-card__body"><form class="form-grid" data-form="club-book" data-club-id="${attr(id)}"><label class="field">Titre<input name="title" required maxlength="240" list="club-library-books"></label><datalist id="club-library-books">${store.getBooks().map(book => `<option value="${attr(book.title)}">`).join('')}</datalist><label class="field">Place dans le club<select name="status"><option value="current">Livre en cours</option><option value="planned">À venir</option><option value="read">Déjà lu</option></select></label><button class="button button--sage button--small" type="submit">Ajouter</button></form></div></details>` : ''}</section>
          <section class="card card-pad"><h2>Membres</h2><div class="club-member-cloud">${members.length ? members.map(member => `<span title="${attr(member.role)}"><span class="avatar">${esc(initials(member.name))}</span>${esc(member.name)}</span>`).join('') : '<p class="small muted">Aucun membre visible.</p>'}</div></section>
        </aside>
      </div>`;
  }

  async function loadClubSpace(id, { force = false } = {}) {
    if (!id || !window.BT.community?.getClubSpace || ui.clubSpaceLoading.has(id) || (!force && (ui.clubSpaces.has(id) || ui.clubSpaceErrors.has(id)))) return;
    const localCommunity = store.getCommunity();
    const localClub = localCommunity.clubs.find(club => club.id === id);
    if (localClub && (isGuestMode() || !localClub.isRemote)) {
      ui.clubSpaceErrors.delete(id);
      ui.clubSpaces.set(id, {
        club:localClub,
        locked:!localClub.joined,
        books:Array.isArray(localClub.books) && localClub.books.length ? localClub.books : (localClub.bookTitle ? [{ id:`local-current-${id}`, title:localClub.bookTitle, status:'current', updated_at:new Date().toISOString() }] : []),
        posts:Array.isArray(localClub.posts) ? localClub.posts : [],
        salons:localCommunity.salons.filter(salon => salon.clubId === id)
      });
      if (ui.route === 'club' && ui.params.get('id') === id) render();
      return;
    }
    ui.clubSpaceLoading.add(id);
    ui.clubSpaceErrors.delete(id);
    try {
      const community = store.getCommunity();
      const space = await window.BT.community.getClubSpace(id, community.clubs, community.salons);
      ui.clubSpaces.set(id, space);
      if (ui.route === 'club' && ui.params.get('id') === id) render();
    } catch (error) {
      ui.clubSpaceErrors.set(id, error.message || 'L’espace du club ne peut pas être chargé');
      showToast(error.message || 'L’espace du club ne peut pas être chargé');
      if (ui.route === 'club' && ui.params.get('id') === id) render();
    }
    finally { ui.clubSpaceLoading.delete(id); }
  }

  function renderSalons() {
    const community = store.getCommunity(), salons = community.salons, canCreate = community.clubs.some(club => club.role === 'owner');
    return `<div class="section-heading"><div><h2>Salons de lecture</h2><p class="small muted">Présence, progression choisie et messages enregistrés pour les membres du club.</p></div>${canCreate ? '<button class="button button--primary button--small" type="button" data-action="create-salon">Créer un salon</button>' : ''}</div>
      ${salons.length ? `<div class="grid-2">${salons.map(salon => `<article class="card salon-card"><div class="card-content"><div class="button-row"><span class="status-chip ${salon.status === 'scheduled' ? 'status-chip--warning' : ''}">${salon.status === 'scheduled' ? 'Programmé' : salon.status === 'live' ? 'En cours' : 'Terminé'}</span><span class="privacy-badge">${esc(salon.clubName)}</span></div><h3>${esc(salon.title)}</h3><p class="small"><strong>${esc(salon.bookTitle || 'Lecture à choisir')}</strong> · ${formatDateTime(salon.scheduledAt)}</p><div class="participant-list">${salon.participants.length ? salon.participants.map(person => `<span class="participant">${esc(person.name)} · ${salonStatus(person.status)}${person.sharePages ? ` · ${person.minutes} min` : ''}</span>`).join('') : '<span class="participant">Aucun participant</span>'}</div><p class="micro muted">Votre progression en pages est ${salon.sharePages ? 'partagée avec votre accord' : 'masquée par défaut'}.</p><div class="card-actions">${salon.joined ? `<button class="button button--secondary button--small" type="button" data-action="salon-thread" data-id="${attr(salon.id)}">Ouvrir · ${salon.messages.length} message${salon.messages.length > 1 ? 's' : ''}</button><button class="button button--ghost button--small" type="button" data-action="leave-salon" data-id="${attr(salon.id)}">Quitter</button>` : `<button class="button button--sage button--small" type="button" data-action="toggle-salon" data-id="${attr(salon.id)}">Rejoindre</button>`}${salon.canManage ? `<button class="button button--ghost button--small" type="button" data-action="edit-salon" data-id="${attr(salon.id)}">Modifier</button>` : ''}</div></div></article>`).join('')}</div>` : '<div class="empty-state"><h3>Aucun salon programmé</h3><p>Le propriétaire d’un club peut préparer la prochaine lecture partagée.</p></div>'}`;
  }
  function salonStatus(status) { return ({ waiting:'en attente', reading:'en lecture', paused:'en pause', finished:'terminé' })[status] || status; }

  function renderFriends() {
    const users = store.getCommunity().users.filter(user => user.isRemote && normalize(`${user.name} ${user.handle || ''}`).includes(normalize(ui.friendQuery)));
    const accessLabel = user => user.profileVisibility === 'public'
      ? 'Profil public · consultable maintenant'
      : user.friendState === 'friend'
        ? 'Profil privé · accès accepté'
        : 'Profil privé · verrouillé avant acceptation';
    return `<label class="search-field friend-search" for="friend-search"><span aria-hidden="true">⌕</span><span class="sr-only">Rechercher un lecteur ou un pseudonyme</span><input id="friend-search" data-input="friend-search" type="search" value="${attr(ui.friendQuery)}" placeholder="Rechercher un lecteur…"></label>
      <p class="small muted">En devenant amis, vous partagez les titres, auteurs et statuts de votre bibliothèque. Vos carnets et souvenirs restent privés jusqu’à leur publication.</p>
      ${ui.friendSearchBusy ? '<div class="view-loading" role="status"><span class="loader" aria-hidden="true"></span> Recherche des lecteurs…</div>' : `<div class="grid-2">${users.length ? users.map(user => `<article class="card friend-card">${avatarBubble(user)}<div class="card-content"><h3>${esc(user.name)}</h3><p class="micro muted">${esc(user.handle || '')}</p><p class="small muted">${accessLabel(user)}</p><div class="card-actions">${friendAction(user)}<button class="button button--ghost button--small" type="button" data-action="view-user" data-id="${attr(user.id)}">${user.profileVisibility === 'private' && user.friendState !== 'friend' ? 'Voir l’aperçu' : 'Voir le profil'}</button></div></div><details class="safety-menu"><summary aria-label="Options de sécurité">•••</summary><div class="safety-menu__panel"><button type="button" data-action="report-user" data-id="${attr(user.id)}">Signaler</button><button type="button" data-action="block-user" data-id="${attr(user.id)}">Bloquer</button></div></details></article>`).join('') : `<div class="empty-state"><h3>Aucun lecteur trouvé</h3><p>${ui.friendQuery ? 'Essayez un prénom ou un pseudonyme plus court.' : 'Aucun autre compte BOO-P n’est encore visible.'}</p></div>`}</div>`}`;
  }
  function friendAction(user) {
    const map = {
      none: `<button class="button button--sage button--small" type="button" data-action="friend" data-mode="send" data-id="${attr(user.id)}">Ajouter</button>`,
      sent: `<button class="button button--secondary button--small" type="button" data-action="friend" data-mode="cancel" data-id="${attr(user.id)}">Annuler la demande</button>`,
      received: `<button class="button button--sage button--small" type="button" data-action="friend" data-mode="accept" data-id="${attr(user.id)}">Accepter</button><button class="button button--ghost button--small" type="button" data-action="friend" data-mode="refuse" data-id="${attr(user.id)}">Refuser</button>`,
      friend: `<button class="button button--secondary button--small" type="button" data-action="friend" data-mode="remove" data-id="${attr(user.id)}">Retirer des amis</button>`,
      blocked: `<span class="status-chip">Bloqué</span>`
    };
    return map[user.friendState] || map.none;
  }

  function renderPath() {
    const tabs = [['library','Livres'],['notebook','Carnet'],['lexicon','Lexique'],['trail','Sentier']];
    const bodies = { library: renderLibrary, notebook: renderNotebook, trail: renderTrail, lexicon: renderLexicon };
    return `<section class="page-head library-heading"><div><p class="eyebrow">Livres et souvenirs</p><h1>${ui.pathTab === 'notebook' ? 'Mon carnet' : ui.pathTab === 'lexicon' ? 'Mon lexique' : ui.pathTab === 'trail' ? 'Mon Sentier' : 'Ma bibliothèque'}</h1></div></section><nav class="tabs" aria-label="Sections de la bibliothèque">${tabs.map(([id,label]) => `<a class="tab" href="#path?tab=${id}" aria-current="${ui.pathTab === id ? 'page' : 'false'}">${label}</a>`).join('')}</nav>${bodies[ui.pathTab]()}`;
  }

  function renderLibrary() {
    const settings = store.getSettings();
    const books = store.getBooks().filter(book => {
      const matchesQuery = normalize(`${book.title} ${book.authors.join(' ')} ${book.genre || ''}`).includes(normalize(ui.libraryQuery));
      const matchesStatus = ui.libraryStatus === 'tous' ? book.libraryState === 'library' : ui.libraryStatus === 'wishlist' ? book.libraryState === 'wishlist' : (book.libraryState === 'library' && book.status === ui.libraryStatus);
      return matchesQuery && matchesStatus;
    });
    const sort = settings.librarySort || 'author';
    books.sort((a,b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'fr');
      if (sort === 'recent') return new Date(b.addedAt) - new Date(a.addedAt);
      if (sort === 'status') return String(a.status).localeCompare(String(b.status), 'fr') || a.title.localeCompare(b.title, 'fr');
      return String(a.authors[0] || '').localeCompare(String(b.authors[0] || ''), 'fr') || a.title.localeCompare(b.title, 'fr');
    });
    const view = ['shelf','list'].includes(settings.libraryView) ? settings.libraryView : 'grid';
    return `<div class="library-search-row"><label class="search-field" for="library-search"><span aria-hidden="true">⌕</span><input id="library-search" data-input="library-search" type="search" value="${attr(ui.libraryQuery)}" placeholder="Titre, auteur ou rayon…"></label>${addBookButton()}</div>
      <div class="filter-chips" role="group" aria-label="Lectures à afficher">${[['tous','Tous'],['en-cours','En cours'],['a-lire','À lire'],['lu','Lus'],['wishlist','Envies']].map(([value,label]) => `<button type="button" data-action="library-filter" data-status="${value}" aria-pressed="${ui.libraryStatus === value}">${label}</button>`).join('')}</div>
      <div class="library-tools"><p class="small muted" role="status">${books.length} livre${books.length > 1 ? 's' : ''}</p><details class="library-options"><summary>Filtres et affichage</summary><div class="form-grid"><label class="field">Statut<select id="library-status" data-change="library-status"><option value="tous" ${ui.libraryStatus === 'tous' ? 'selected' : ''}>Tous mes livres</option><option value="wishlist" ${ui.libraryStatus === 'wishlist' ? 'selected' : ''}>Mes envies</option>${Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${value}" ${ui.libraryStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">Trier<select id="library-sort" data-change="library-sort">${[['author','Par auteur'],['title','Par titre'],['recent','Ajouts récents'],['status','Par statut']].map(([value,label]) => `<option value="${value}" ${sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="view-toggle" role="group" aria-label="Affichage de la bibliothèque">${[['grid','Grille'],['list','Liste'],['shelf','Étagère']].map(([value,label]) => `<button class="button button--secondary button--small" type="button" data-action="library-view" data-view="${value}" aria-pressed="${view === value}">${label}</button>`).join('')}</div></div></details></div>
      ${books.length ? renderLibraryBooks(books, view) : `<div class="empty-state"><h3>${ui.libraryStatus === 'wishlist' ? 'Votre wishlist est prête à accueillir des envies' : 'Aucun livre ne correspond'}</h3><p>${ui.libraryStatus === 'wishlist' ? 'Ajoutez une suggestion ou un livre manuellement.' : 'Modifiez le filtre ou ajoutez un ouvrage manuellement.'}</p><button class="button button--primary" type="button" data-action="add-book">Ajouter un livre</button></div>`}
      ${renderRecommendations()}`;
  }

  function renderLibraryBooks(books, view) {
    const renderCard = book => {
      const progress = bookProgress(book);
      const meta = book.libraryState === 'wishlist' ? '<span class="status-chip">Wishlist</span>' : `<span class="status-chip ${book.status === 'en-cours' ? 'status-chip--active' : ''}">${STATUS_LABELS[book.status]}</span><span class="micro muted">${SITUATION_LABELS[book.situation]}</span>`;
      return `<button class="book-card ${view === 'shelf' ? 'book-card--shelf' : ''}" type="button" data-action="open-book" data-id="${attr(book.id)}" aria-label="Ouvrir ${attr(book.title)}, ${MEDIA_LABELS[book.mediaType] || 'livre'}">${cover(book)}<strong>${esc(book.title)}</strong><small>${esc(book.authors.join(', '))}</small>${book.libraryState === 'library' ? `<div class="progress-track" aria-label="${attr(progress.label)}"><span style="--width:${pct(progress.value,progress.total)}%"></span></div>` : ''}<div class="book-meta-row"><span class="media-chip">${book.mediaType === 'audio' ? '🎧' : book.mediaType === 'ebook' ? '▤' : '▥'}</span>${meta}</div></button>`;
    };
    if (view !== 'shelf') return `<div class="book-grid ${view === 'list' ? 'book-grid--list' : ''}">${books.map(renderCard).join('')}</div>`;
    const settings = store.getSettings(), collapsed = new Set(settings.collapsedLibraryGenres || []), groups = new Map();
    const finish = ['terracotta','blue','sage','red','black','white'].includes(settings.libraryFinish) ? settings.libraryFinish : 'terracotta';
    books.forEach(book => { const genre = String(book.genre || '').trim() || 'À classer'; if (!groups.has(genre)) groups.set(genre, []); groups.get(genre).push(book); });
    const ordered = [...groups.entries()].sort(([a],[b]) => a === 'À classer' ? 1 : b === 'À classer' ? -1 : a.localeCompare(b, 'fr'));
    const shelves = ordered.map(([genre, items]) => {
      const genreKey = normalize(genre).replace(/\s+/g, '-') || 'a-classer';
      const isOpen = ui.libraryQuery || !collapsed.has(genreKey);
      return `<details class="genre-shelf" data-library-genre="${attr(genreKey)}" ${isOpen ? 'open' : ''}><summary><span>${esc(genre)}</span><small>${items.length} livre${items.length > 1 ? 's' : ''} · glissez horizontalement</small></summary><div class="physical-shelf" role="group" tabindex="0" aria-label="Rayon ${attr(genre)}, défilement horizontal">${items.map((book,index) => renderBookSpine(book,index)).join('')}</div></details>`;
    }).join('');
    return `<details class="shelf-appearance"><summary>Apparence de l’étagère</summary><div class="bookcase-finish-picker" role="group" aria-label="Couleur du meuble">${SURFACE_COLORS.map(([key,label]) => `<button type="button" class="bookcase-finish-swatch bookcase-finish-swatch--${key}" data-action="library-finish" data-finish="${key}" aria-label="${label}" title="${label}" aria-pressed="${finish === key}"><span aria-hidden="true"></span></button>`).join('')}</div></details><div class="bookcase bookcase--${finish}" aria-label="Bibliothèque physique organisée par rayons"><div class="bookcase__top"></div><p class="bookcase__instruction"><span aria-hidden="true">↔</span> Glissez un rayon pour parcourir les livres. Touchez une première fois pour sélectionner, puis une seconde fois pour ouvrir.</p>${shelves}</div>`;
  }

  function renderBookSpine(book, index) {
    let hash = index + 17; for (const character of `${book.genre}${book.title}`) hash = character.charCodeAt(0) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360, width = 27 + Math.abs(hash % 13), height = 122 + Math.abs((hash >> 4) % 45);
    const peek = book.coverUrl ? `<img class="book-spine__peek" src="${attr(book.coverUrl)}" alt="" loading="lazy" aria-hidden="true">` : '';
    const selected = ui.selectedLibraryBookId === book.id;
    const label = selected ? `${book.title} sélectionné. Appuyez encore pour ouvrir sa fiche.` : `Sélectionner ${book.title}, ${book.authors.join(', ')}, rayon ${book.genre || 'À classer'}`;
    return `<button class="book-spine ${selected ? 'is-selected' : ''}" type="button" data-action="select-book" data-id="${attr(book.id)}" title="${selected ? 'Appuyer encore pour ouvrir la fiche' : attr(book.title)}" aria-label="${attr(label)}" aria-pressed="${selected}" style="--spine-h:${height}px;--spine-w:${width}px;--spine-a:hsl(${hue} 46% 40%);--spine-b:hsl(${(hue + 24) % 360} 50% 56%)">${peek}<span>${esc(book.title)}</span></button>`;
  }

  function selectLibraryBook(trigger, id) {
    if (!id) return;
    if (ui.selectedLibraryBookId === id) {
      ui.selectedLibraryBookId = null;
      location.hash = `#book?id=${encodeURIComponent(id)}`;
      return;
    }
    ui.selectedLibraryBookId = id;
    document.querySelectorAll('.book-spine[data-action="select-book"]').forEach(spine => {
      const selected = spine === trigger;
      spine.classList.toggle('is-selected', selected);
      spine.setAttribute('aria-pressed', String(selected));
      const book = store.getBookById(spine.dataset.id);
      if (!book) return;
      spine.title = selected ? 'Appuyer encore pour ouvrir la fiche' : book.title;
      spine.setAttribute('aria-label', selected
        ? `${book.title} sélectionné. Appuyez encore pour ouvrir sa fiche.`
        : `Sélectionner ${book.title}, ${book.authors.join(', ')}, rayon ${book.genre || 'À classer'}`);
    });
    const book = store.getBookById(id);
    const message = `${book?.title || 'Livre'} sélectionné. Touchez-le encore pour ouvrir sa fiche.`;
    document.getElementById('live-region').textContent = message;
  }

  function clearLibraryBookSelection(announce = false) {
    if (!ui.selectedLibraryBookId) return false;
    ui.selectedLibraryBookId = null;
    document.querySelectorAll('.book-spine[data-action="select-book"]').forEach(spine => {
      spine.classList.remove('is-selected');
      spine.setAttribute('aria-pressed', 'false');
      const book = store.getBookById(spine.dataset.id);
      if (!book) return;
      spine.title = book.title;
      spine.setAttribute('aria-label', `Sélectionner ${book.title}, ${book.authors.join(', ')}, rayon ${book.genre || 'À classer'}`);
    });
    if (announce) document.getElementById('live-region').textContent = 'Sélection du livre annulée.';
    return true;
  }

  function handleLibraryShelfToggle(event) {
    const shelf = event.target;
    if (!(shelf instanceof HTMLDetailsElement) || !shelf.matches('[data-library-genre]')) return;
    const settings = store.getSettings(), collapsed = new Set(settings.collapsedLibraryGenres || []), key = shelf.dataset.libraryGenre;
    if (shelf.open) collapsed.delete(key); else {
      collapsed.add(key);
      if (shelf.querySelector(`.book-spine[data-id="${CSS.escape(ui.selectedLibraryBookId || '')}"]`)) ui.selectedLibraryBookId = null;
    }
    store.saveSettings({ collapsedLibraryGenres:[...collapsed] });
  }

  function recommendationProfile() {
    const books = store.getBooks().filter(book => book.libraryState === 'library');
    const count = values => values.reduce((map, value) => { const key = String(value || '').trim(); if (key) map.set(key, (map.get(key) || 0) + 1); return map; }, new Map());
    const genres = count(books.flatMap(book => book.genres?.length ? book.genres : [book.genre]));
    const authors = count(books.flatMap(book => book.authors || []));
    const ranked = map => [...map.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([name]) => name);
    return { books, genres, authors, topGenres:ranked(genres), topAuthors:ranked(authors) };
  }

  function recommendationHash(value) {
    let hash = 17; for (const character of String(value || '')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return Math.abs(hash);
  }

  function recommendationCandidates() {
    const owned = new Set(store.getBooks().map(book => normalize(book.title)));
    const dismissed = new Set(store.getSettings().dismissedRecommendationIds || []);
    const merged = new Map();
    [...ui.catalogRecommendations, ...RECOMMENDATIONS].forEach(book => {
      const key = normalize(`${book.title}|${book.authors?.[0] || ''}`);
      if (key && !merged.has(key)) merged.set(key, book);
    });
    return [...merged.values()].filter(book => !owned.has(normalize(book.title)) && !dismissed.has(book.id));
  }

  function selectRecommendations(limit = 4) {
    const profile = recommendationProfile(), settings = store.getSettings(), seed = Number(settings.recommendationRefreshSeed) || 0;
    const suggestions = recommendationCandidates().sort((a,b) => {
      const score = book => (profile.genres.get(book.genre) || 0) * 20 + (book.authors || []).reduce((sum, author) => sum + (profile.authors.get(author) || 0) * 12, 0) + (book.catalogResult ? 8 : 0) + ((recommendationHash(book.id) + seed * 37) % 17);
      return score(b) - score(a);
    }).slice(0, limit);
    ui.currentRecommendations = suggestions;
    return { suggestions, profile };
  }

  function renderRecommendations() {
    const { suggestions, profile } = selectRecommendations();
    const tastes = profile.topGenres.slice(0, 2).join(' et ');
    const explanation = tastes ? `Sélection recalculée à partir de vos rayons ${tastes}.` : 'Sélection de départ, affinée dès que votre bibliothèque grandit.';
    return `<section class="section-block recommendations" aria-labelledby="recommendations-title"><div class="section-heading"><div><p class="eyebrow">Suggestions BOO-P · analyse locale</p><h2 id="recommendations-title">À découvrir</h2><p class="small muted">${esc(explanation)} Un rejet ou un ajout affiche immédiatement une autre proposition.</p></div><button class="button button--secondary button--small" type="button" data-action="refresh-recommendations" ${ui.recommendationsBusy ? 'disabled aria-busy="true"' : ''}>${ui.recommendationsBusy ? 'Analyse…' : '↻ Actualiser'}</button></div>${suggestions.length ? `<div class="recommendation-grid">${suggestions.map(book => `<article class="card recommendation-card">${cover(book)}<div><h3>${esc(book.title)}</h3><p class="small muted">${esc((book.authors || []).join(', '))}</p><p class="small">${esc(book.reason)}</p><div class="card-actions"><button class="button button--secondary button--small" type="button" data-action="wishlist-recommendation" data-id="${attr(book.id)}">♡ Wishlist</button><button class="button button--ghost button--small" type="button" data-action="dismiss-recommendation" data-id="${attr(book.id)}">Pas pour moi</button></div></div></article>`).join('')}</div>` : '<div class="empty-state"><h3>Votre sélection est à jour</h3><p>Lancez une nouvelle analyse pour interroger les catalogues publics à partir de votre bibliothèque.</p></div>'}</section>`;
  }

  function renderTrail() {
    const activityDate = book => book.status === 'lu' ? (book.completedAt || book.startedAt || book.addedAt) : (book.startedAt || book.addedAt);
    const allBooks = store.getBooks().filter(book => book.libraryState === 'library');
    const years = [...new Set(allBooks.map(book => new Date(activityDate(book)).getFullYear()).filter(Number.isFinite))].sort((a,b) => b - a);
    if (ui.trailYear !== 'all' && !years.includes(Number(ui.trailYear))) ui.trailYear = 'all';
    const books = allBooks.filter(book => {
      const matchesYear = ui.trailYear === 'all' || new Date(activityDate(book)).getFullYear() === Number(ui.trailYear);
      return matchesYear && (ui.trailStatus === 'all' || book.status === ui.trailStatus);
    }).sort((a,b) => (new Date(activityDate(b)) - new Date(activityDate(a))) || a.title.localeCompare(b.title, 'fr'));
    const palette = window.BT.trailMindmap?.colors || ['#d45a94','#12a9cf','#ef7a2d','#4455b8','#27a26d','#d9a116'];
    const grouped = new Map();
    books.forEach(book => {
      const genre = String(book.genre || book.genres?.[0] || 'À classer').trim() || 'À classer';
      if (!grouped.has(genre)) grouped.set(genre, []);
      grouped.get(genre).push(book);
    });
    const genreGroups = [...grouped.entries()].sort(([a],[b]) => a.localeCompare(b, 'fr')).map(([name, genreBooks], index) => ({ id:`genre-${recommendationHash(name)}`, name, color:palette[index % palette.length], books:genreBooks }));
    const lexicon = store.getLexicon(), traces = store.getTraces(), posts = store.getCommunity().posts;
    const readerDNA = store.getReaderDNA();
    const layout = window.BT.trailMindmap?.layout?.(genreGroups, ui.expandedTrailBooks, readerDNA.fragments) || { width:2360, height:920, root:{ x:1180, y:460 }, genres:[], nodes:[], insights:[] };
    const details = new Map(books.map(book => {
      const bookLexicon = lexicon.filter(item => item.bookId === book.id);
      const bookTraces = traces.filter(item => item.bookId === book.id);
      const sessionNotes = store.getSessionsForBook(book.id).filter(session => String(session.note || '').trim());
      const bookPosts = posts.filter(post => normalize(post.bookTitle) === normalize(book.title));
      const comments = bookPosts.flatMap(post => (post.comments || []).flatMap(comment => [comment, ...(comment.replies || [])]));
      const notesCount = bookTraces.length + sessionNotes.length;
      return [book.id, [
        { kind:'lexicon', icon:'Aa', title:'Lexiques', count:bookLexicon.length, preview:bookLexicon[0] ? `${bookLexicon[0].word} · ${bookLexicon[0].definition}` : 'Aucun lexique lié' },
        { kind:'comment', icon:'☍', title:'Commentaires', count:comments.length, preview:comments[0] ? `${comments[0].authorName || 'Lecteur BOO-P'} · ${comments[0].text}` : 'Aucun commentaire' },
        { kind:'note', icon:'✦', title:'Notes & Traces', count:notesCount, preview:bookTraces[0]?.text || sessionNotes[0]?.note || 'Aucune note personnelle' }
      ]];
    }));
    const paths = layout.genres.map(genre => `<path class="trail-canvas-link trail-canvas-link--genre" style="--trail-branch-color:${attr(genre.color)}" d="${attr(genre.path)}"></path>${genre.books.map(node => `<path class="trail-canvas-link trail-canvas-link--book" style="--trail-branch-color:${attr(genre.color)}" d="${attr(node.path)}"></path>${node.branches.map(branch => `<path class="trail-canvas-link trail-canvas-link--detail" style="--trail-branch-color:${attr(genre.color)}" d="${attr(branch.path)}"></path>`).join('')}`).join('')}`).join('');
    const genreNodes = layout.genres.map(genre => `<article class="trail-genre-node trail-genre-node--${genre.side}" style="--x:${genre.x}px;--y:${genre.y}px;--trail-branch-color:${attr(genre.color)}"><span aria-hidden="true">${genre.books.length > 3 ? '✺' : '✦'}</span><strong>${esc(genre.name)}</strong><small>${genre.books.length} livre${genre.books.length > 1 ? 's' : ''}</small></article>`).join('');
    const dnaFragments = (layout.insights || []).map(insight => `<blockquote class="trail-adn-fragment trail-adn-fragment--${insight.align}" style="--x:${insight.x}px;--y:${insight.y}px;--adn-color:${attr(insight.color)};--adn-tilt:${insight.tilt}deg">${esc(insight.text)}</blockquote>`).join('');
    const bookNodes = layout.nodes.map(node => {
      const book = books.find(item => item.id === node.id); if (!book) return '';
      const expanded = ui.expandedTrailBooks.has(book.id), branches = details.get(book.id) || [];
      const date = activityDate(book), dateLabel = book.status === 'lu' ? 'Terminé' : book.startedAt ? 'Commencé' : 'Ajouté';
      const satellites = expanded ? node.branches.map((branch,index) => {
        const item = branches[index];
        return `<article class="trail-detail-leaf trail-detail-leaf--${item.kind} trail-detail-leaf--${node.side}" style="--x:${branch.x}px;--y:${branch.y}px;--trail-branch-color:${attr(node.color)}"><span class="trail-detail-leaf__icon" aria-hidden="true">${item.icon}</span><span><small>${item.count}</small><strong>${item.title}</strong><em>${esc(item.preview)}</em></span></article>`;
      }).join('') : '';
      return `<div class="trail-canvas-book-wrap trail-canvas-book-wrap--${node.side} ${expanded ? 'is-expanded' : ''}" style="--x:${node.x}px;--y:${node.y}px;--trail-branch-color:${attr(node.color)}"><button class="trail-canvas-book trail-canvas-book--${attr(book.status)}" type="button" data-action="toggle-trail-book" data-id="${attr(book.id)}" aria-expanded="${expanded}" aria-label="${expanded ? 'Replier' : 'Déployer'} les détails de ${attr(book.title)}"><span class="trail-canvas-book__status">${esc(STATUS_LABELS[book.status])}</span><strong>${esc(book.title)}</strong><small>${esc(book.authors.join(', '))}</small><time datetime="${attr(date)}">${dateLabel} · ${formatDate(date)}</time><span class="trail-canvas-book__toggle" aria-hidden="true">${expanded ? '−' : '+'}</span></button>${expanded ? `<a class="trail-canvas-book__open" href="#book?id=${encodeURIComponent(book.id)}">Ouvrir la fiche →</a>` : ''}</div>${satellites}`;
    }).join('');
    const filters = `<div class="trail-toolbar"><div><label for="trail-year">Année</label><select id="trail-year" data-change="trail-year"><option value="all" ${ui.trailYear === 'all' ? 'selected' : ''}>Toutes</option>${years.map(year => `<option value="${year}" ${String(year) === ui.trailYear ? 'selected' : ''}>${year}</option>`).join('')}</select></div><div><label for="trail-status">Statut</label><select id="trail-status" data-change="trail-status"><option value="all" ${ui.trailStatus === 'all' ? 'selected' : ''}>Tous les livres</option>${Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${value}" ${ui.trailStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><span>${books.length} livre${books.length > 1 ? 's' : ''} affiché${books.length > 1 ? 's' : ''}</span></div>`;
    const modes = `<div class="trail-view-modes"><div class="filter-chips" role="group" aria-label="Présentation du Sentier"><button type="button" data-action="trail-mode" data-mode="map" aria-pressed="${ui.trailMode === 'map'}">Carte</button><button type="button" data-action="trail-mode" data-mode="timeline" aria-pressed="${ui.trailMode === 'timeline'}">Chronologie</button></div><button class="button button--secondary button--small" type="button" data-action="trail-immersive" aria-pressed="${ui.trailImmersive}">${ui.trailImmersive ? 'Réduire le Sentier' : 'Agrandir le Sentier'}</button></div>`;
    if (ui.trailMode === 'timeline') return `${modes}${filters}<ol class="trail-chronology">${books.map(book => `<li><time datetime="${attr(activityDate(book))}">${formatDate(activityDate(book))}</time><a class="card" href="#book?id=${encodeURIComponent(book.id)}">${cover(book,'small')}<span><strong>${esc(book.title)}</strong><span class="small muted">${esc(book.authors.join(', '))}</span><span class="status-chip">${STATUS_LABELS[book.status]}</span></span><span aria-hidden="true">→</span></a></li>`).join('') || '<li>Aucun livre pour ces filtres.</li>'}</ol>`;
    const profile = store.getProfile(), scaledWidth = Math.round(layout.width * ui.trailScale), scaledHeight = Math.round(layout.height * ui.trailScale);
    return `${modes}${filters}<div class="trail-legend" aria-label="Légende des statuts">${Object.entries(STATUS_LABELS).map(([value,label]) => `<span class="trail-legend__${value}"><i></i>${label}</span>`).join('')}</div>${books.length ? `<div class="trail-map-frame"><div class="trail-map-controls" role="group" aria-label="Zoom de la carte"><button type="button" data-action="trail-zoom-out" aria-label="Dézoomer" title="Dézoomer">−</button><output data-trail-zoom-value>${Math.round(ui.trailScale * 100)} %</output><button type="button" data-action="trail-zoom-in" aria-label="Zoomer" title="Zoomer">+</button><button class="trail-map-controls__fit" type="button" data-action="trail-zoom-fit" aria-label="Afficher toute l’étendue de la carte" title="Afficher toute la carte"><span aria-hidden="true">⛶</span> Étendue</button></div><p class="trail-pan-hint"><span aria-hidden="true">↔</span> Glissez pour explorer · pincez à deux doigts pour zoomer</p><div class="trail-canvas-shell" data-trail-shell data-root-x="${layout.root.x}" data-root-y="${layout.root.y}" tabindex="0" aria-label="Carte mentale interactive. Pincez à deux doigts, utilisez les boutons de zoom ou faites glisser la carte."><div class="trail-zoom-stage" data-trail-stage style="width:${scaledWidth}px;height:${scaledHeight}px"><div class="trail-canvas" data-trail-canvas data-width="${layout.width}" data-height="${layout.height}" data-scale="${ui.trailScale}" style="width:${layout.width}px;height:${layout.height}px;transform:scale(${ui.trailScale})"><svg viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true" focusable="false">${paths}</svg><div class="trail-root" style="--x:${layout.root.x}px;--y:${layout.root.y}px"><span class="trail-root__avatar" aria-hidden="true">${esc(initials(profile.name))}</span><strong>${esc(profile.name)}</strong><small>${genreGroups.length} genre${genreGroups.length > 1 ? 's' : ''} · ${allBooks.length} livre${allBooks.length > 1 ? 's' : ''}</small></div>${dnaFragments}${genreNodes}${bookNodes}</div></div></div></div>` : `<div class="empty-state"><h3>Aucun livre dans ce filtre</h3><p>Affichez toutes les années et tous les statuts, ou ajoutez un livre à votre bibliothèque.</p><a class="button button--primary" href="#path?tab=library">Bibliothèque</a></div>`}`;
  }

  function renderLexicon() { return renderNotebookEntries(false); }
  function renderNotebook() {
    const selectedBook = ui.params.get('book') || ui.notebookBook;
    const books = store.getBooks().filter(b => b.libraryState === 'library' && (!selectedBook || b.id === selectedBook) && b.reflection && (b.reflection.messages?.length || b.reflection.notebook || b.reflection.draft || b.reflection.edit || b.reflection.sections?.retained || b.reflection.sections?.questions || b.reflection.sectionDraft));
    return `<section class="notebook-intro"><p class="eyebrow">Chaque lecture laisse une trace</p><h2>Vos lectures, vos réflexions</h2><div data-reflection-host></div></section>${books.length ? `<div class="reflection-book-grid">${books.map(b => `<article class="card reflection-book-card"><p class="eyebrow">${b.reflection.edit !== undefined || b.reflection.sectionDraft ? 'Brouillon personnel' : b.reflection.notebook || b.reflection.sections ? 'Carnet de réflexion' : 'Conversation en cours'}</p><h2>${esc(b.title)}</h2><p class="muted">${esc((b.reflection.notebook || b.reflection.edit || b.reflection.sections?.retained || b.reflection.draft || 'Reprenez le fil de votre échange.').slice(0,160))}</p><div class="button-row"><button type="button" class="text-link" data-open-reflection="${attr(b.id)}" data-reflection-tab="notebook">Ouvrir le carnet</button><button type="button" class="text-link" data-open-reflection="${attr(b.id)}">Poursuivre l’échange</button><button type="button" class="text-link" data-action="share-reading" data-kind="notebook" data-id="${attr(b.id)}">Partager le carnet</button></div></article>`).join('')}</div>` : ''}${renderNotebookEntries(true)}`;
  }
  function renderNotebookEntries(notebook) {
    const labels = notebook ? { all:'Tout', thought:'Pensées', citation:'Citations' } : { all:'Tout', word:'Mots', expression:'Expressions' };
    const kind = Object.hasOwn(labels, ui.lexiconKind) ? ui.lexiconKind : 'all';
    const selectedBook = ui.params.get('book') || ui.notebookBook;
    const thoughts = store.getTraces().map(trace => ({...trace, kind:'thought', word:trace.text, definition:'', bookTitle:store.getBookById(trace.bookId)?.title || '', updatedAt:trace.updatedAt || trace.createdAt }));
    const entries = [...thoughts,...store.getLexicon()].filter(item => (notebook ? ['thought','citation'].includes(item.kind) : ['word','expression'].includes(item.kind)) && (!selectedBook || item.bookId === selectedBook) && (kind === 'all' || item.kind === kind) && normalize(`${item.word} ${item.definition} ${item.bookTitle}`).includes(normalize(ui.lexiconQuery))).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return `<section class="lexicon-view"><div class="library-search-row"><label class="search-field" for="lexicon-search"><span aria-hidden="true">⌕</span><input id="lexicon-search" data-input="lexicon-search" type="search" value="${attr(ui.lexiconQuery)}" placeholder="${notebook ? 'Chercher une pensée ou une citation…' : 'Chercher un mot ou une expression…'}"></label><button class="button button--primary" type="button" data-action="${notebook ? 'capture-memory' : 'add-lexicon'}" data-book-id="${attr(selectedBook)}">${notebook ? '+ Garder' : '+ Mot'}</button></div><details class="notebook-filters"><summary>Filtres${kind !== 'all' || selectedBook ? ' · actifs' : ''}</summary><div class="filter-chips" role="group" aria-label="Type de souvenir">${Object.entries(labels).map(([kind,label]) => `<button type="button" data-action="notebook-filter" data-kind="${kind}" aria-pressed="${(Object.hasOwn(labels,ui.lexiconKind) ? ui.lexiconKind : 'all') === kind}">${label}</button>`).join('')}</div><label class="field notebook-book-filter">Livre<select data-change="notebook-book"><option value="">Tous mes livres</option>${store.getBooks().map(book => `<option value="${attr(book.id)}" ${selectedBook === book.id ? 'selected' : ''}>${esc(book.title)}</option>`).join('')}</select></label></details><p class="small muted" role="status">${entries.length} ${notebook ? 'souvenir' : 'entrée'}${entries.length > 1 ? 's' : ''}</p>${entries.length ? `<div class="lexicon-grid">${entries.map(item => `<article class="card lexicon-card"><span class="lexicon-kind">${labels[item.kind]}</span><${item.kind === 'thought' ? 'p' : 'h3'} class="notebook-text">${esc(item.word)}</${item.kind === 'thought' ? 'p' : 'h3'}>${item.definition && item.definition !== item.word ? `<p>${esc(item.definition)}</p>` : ''}${item.note ? `<p class="small muted">${esc(item.note)}</p>` : ''}<footer>${item.bookId && store.getBookById(item.bookId) ? `<a class="text-link" href="#book?id=${encodeURIComponent(item.bookId)}">${esc(item.bookTitle || store.getBookById(item.bookId).title)}</a>` : 'Sans livre associé'}${item.page ? ` · ${store.getBookById(item.bookId)?.mediaType === 'audio' ? 'min.' : 'p.'} ${item.page}` : ''} · ${formatDate(item.updatedAt)}${item.kind === 'thought' ? ` · ${VISIBILITY_LABELS[item.privacy] || 'Privé'}` : ''}</footer>${item.kind !== 'thought' ? `<div class="card-actions"><button class="text-link" type="button" data-action="edit-lexicon" data-id="${attr(item.id)}">Modifier</button><button class="text-link" type="button" data-action="delete-lexicon" data-id="${attr(item.id)}">Supprimer</button></div>` : ''}<button class="text-link" type="button" data-action="share-reading" data-kind="${attr(item.kind)}" data-id="${attr(item.id)}">Partager</button></article>`).join('')}</div>` : `<div class="empty-state"><h2>${notebook ? 'Votre carnet attend un souvenir.' : 'Votre lexique attend un premier mot.'}</h2><p>${notebook ? 'Gardez une pensée ou une citation.' : 'Conservez un mot ou une expression à retrouver.'}</p></div>`}</section>`;
  }

  function renderGoals() {
    const progress = store.getGoalProgress(), state = store.getState().goals;
    return `<div class="goal-accordion">
      ${goalCard('week','Cette semaine',`${progress.week.value}/${progress.week.target} jours`,`Lire ${state.week.dailyMinutes} min par jour`,pct(progress.week.value,progress.week.target),state.week.history)}
      ${goalCard('month','Ce mois',goalStatusText(progress.month),'Chaque livre choisi vaut une part : vert s’il est lu, orange s’il est en cours.',progress.month,state.month.history)}
      ${goalCard('year','Cette année',goalStatusText(progress.year),'Calcul automatique sur toute la bibliothèque : un livre terminé vaut 1, un livre en cours ou en pause vaut 0,5.',progress.year,state.year.history)}
    </div><p class="small muted section-block">Dépliez un objectif pour voir son détail et les livres qui composent sa progression. L’objectif annuel ne demande plus aucune sélection manuelle.</p>
    <section class="card monthly-report-cta section-block" aria-labelledby="monthly-report-title"><div><p class="eyebrow">Carte 1080 × 1350 · prête à partager</p><h2 id="monthly-report-title">Votre mois de lecture mérite sa couverture</h2><p class="small muted">Retrouvez les livres terminés, en cours, en pause ou abandonnés ce mois, avec leurs couvertures et vos statistiques dans une image signée BOO-P.</p></div><button class="button button--primary" type="button" data-action="open-monthly-report">Créer ma carte du mois</button></section>`;
  }

  function goalBookRows(books, progress) {
    const contributingIds = new Set(progress.bookIds || []);
    return books.map(book => {
      const contributes = contributingIds.has(book.id);
      const contribution = progress.bookScores?.[book.id] || 0;
      const detail = contribution === 1 && book.status === 'lu'
        ? `1 livre · terminé le ${formatDate(book.completedAt)}`
        : contribution === .5
          ? `${STATUS_LABELS[book.status]} · compte pour 0,5 livre`
          : contributes && book.status === 'en-cours'
            ? 'En cours · compte en orange'
          : book.status === 'lu' && book.completedAt
            ? `Lu le ${formatDate(book.completedAt)} · hors période`
            : STATUS_LABELS[book.status] || 'À lire';
      return `<li><a class="goal-book-item" href="#book?id=${encodeURIComponent(book.id)}">${cover(book,'small')}<span><strong>${esc(book.title)}</strong><small>${esc(detail)}</small></span><span aria-hidden="true">→</span></a></li>`;
    }).join('');
  }

  function goalBooksBlock(progress, period) {
    const libraryBooks = store.getBooks().filter(book => book.libraryState === 'library');
    const selectedIds = Array.isArray(progress.selectedBookIds) ? progress.selectedBookIds : [];
    const books = period === 'year'
      ? (progress.bookIds || []).map(id => libraryBooks.find(book => book.id === id)).filter(Boolean)
      : selectedIds.length
        ? selectedIds.map(id => libraryBooks.find(book => book.id === id)).filter(Boolean)
        : libraryBooks;
    const firstBooks = books.slice(0, 4), remainingBooks = books.slice(4);
    const scope = period === 'year'
      ? `${books.length} lecture${books.length > 1 ? 's' : ''} contribue${books.length > 1 ? 'nt' : ''} automatiquement`
      : selectedIds.length
      ? `${books.length} livre${books.length > 1 ? 's' : ''} choisi${books.length > 1 ? 's' : ''}`
      : `Toute la bibliothèque · ${books.length} livre${books.length > 1 ? 's' : ''}`;
    if (!books.length) return `<section class="goal-books"><p class="eyebrow">Livres concernés</p><p class="small muted">${period === 'year' ? 'Terminez ou commencez une lecture pour alimenter automatiquement cet objectif.' : 'Ajoutez un livre à votre bibliothèque pour alimenter cet objectif.'}</p></section>`;
    return `<section class="goal-books" aria-label="Livres concernés par cet objectif"><p class="eyebrow">Livres concernés</p><p class="micro muted">${scope}</p><ul class="goal-book-list">${goalBookRows(firstBooks, progress)}</ul>${remainingBooks.length ? `<details class="goal-books-more"><summary>Afficher ${remainingBooks.length} autre${remainingBooks.length > 1 ? 's' : ''} livre${remainingBooks.length > 1 ? 's' : ''}</summary><ul class="goal-book-list">${goalBookRows(remainingBooks, progress)}</ul></details>` : ''}</section>`;
  }

  function goalCard(period, title, value, description, progress, history) {
    const mixed = typeof progress === 'object';
    const green = mixed ? progress.greenPct : progress, orange = mixed ? progress.orangePct : 0, total = Math.min(100, green + orange);
    const readingLegend = period === 'year'
      ? `${progress.inProgress} en cours ou en pause · ${String(progress.inProgressValue).replace('.', ',')} livre`
      : `${progress.inProgress} en cours`;
    return `<details class="card goal-card goal-disclosure"><summary><span><span class="eyebrow">Objectif principal</span><strong>${title}</strong><small>${value}</small></span><span class="progress-ring ${mixed ? 'progress-ring--mixed' : ''}" style="--pct:${green};--green-pct:${green};--orange-pct:${orange};--total-pct:${total}"><span>${total}%</span></span></summary><div class="goal-disclosure__body"><p class="small muted">${description}</p>${mixed ? `<div class="goal-segment-bar" role="img" aria-label="${green} pour cent terminé en vert et ${orange} pour cent commencé en orange"><span class="goal-segment-bar__read" style="--segment:${green}%"></span><span class="goal-segment-bar__reading" style="--segment:${orange}%"></span></div><div class="goal-segment-legend"><span><i class="is-read"></i>${progress.value} terminé${progress.value > 1 ? 's' : ''}</span><span><i class="is-reading"></i>${readingLegend}</span></div>${goalBooksBlock(progress, period)}` : ''}<div class="goal-detail-list">${(history || []).map(item => `<span><span>${esc(item.label)}</span><strong>${esc(item.result)}</strong></span>`).join('')}</div><button class="button button--secondary button--small" type="button" data-action="edit-goal" data-period="${period}">Modifier</button></div></details>`;
  }

  function renderBookDetail() {
    const id = ui.params.get('id'), book = store.getBookById(id);
    if (!book) return `<div class="empty-state"><h1>Livre introuvable</h1><p>Il a peut-être été retiré de cette bibliothèque locale.</p><a class="button button--primary" href="#path?tab=library">Retour à la bibliothèque</a></div>`;
    const sessions = store.getSessionsForBook(id), traces = store.getTraces(id), lexicon = store.getLexicon().filter(item => item.bookId === id), openSession = store.getActiveSessionForBook(id), progress = bookProgress(book), wishlist = book.libraryState === 'wishlist', audio = book.mediaType === 'audio';
    return `<a class="text-link" href="#path?tab=${wishlist ? 'library' : 'library'}">← Ma bibliothèque</a><section class="book-detail-head section-block">${cover(book,'large')}<div class="book-detail-copy"><div class="button-row"><span class="status-chip ${book.status === 'en-cours' ? 'status-chip--active' : ''}">${wishlist ? 'Wishlist' : STATUS_LABELS[book.status]}</span>${!wishlist ? `<span class="privacy-badge">${SITUATION_LABELS[book.situation]}</span>` : ''}<span class="media-chip">${MEDIA_LABELS[book.mediaType] || 'Livre'}</span>${book.historicalBeforeJoin ? '<span class="status-chip">Lu avant mon inscription</span>' : ''}</div><h1>${esc(book.title)}</h1><p class="muted">${esc(book.authors.join(', '))}</p><p>${esc(book.description || 'Aucun résumé pour cette édition.')}</p>${!wishlist ? `<div class="progress-track" aria-label="Progression ${pct(progress.value,progress.total)} %"><span style="--width:${pct(progress.value,progress.total)}%"></span></div><p class="small muted">${progress.label}${book.rating ? ` · ${ratingStars(book.rating)}` : ''}</p>` : '<p class="small muted">Envie de lecture conservée dans votre wishlist.</p>'}<div class="button-row">${wishlist ? `<button class="button button--primary" type="button" data-action="move-to-library" data-id="${attr(id)}">Ajouter à ma bibliothèque</button>` : `<button class="button button--primary" type="button" data-action="book-session" data-id="${attr(id)}">${openSession ? 'Reprendre la session' : 'Démarrer une session'}</button>`}<button class="button button--ghost" type="button" data-action="edit-book" data-id="${attr(id)}">Modifier</button><a class="button button--secondary" href="#path?tab=notebook&book=${encodeURIComponent(id)}">Ouvrir le carnet</a><button class="text-link" type="button" data-action="capture-memory" data-book-id="${attr(id)}">Garder quelque chose</button><button class="text-link" type="button" data-action="share-reading" data-kind="book" data-id="${attr(id)}">Partager ma lecture</button></div></div></section>
      <div class="grid-2">
        <section class="card card-pad"><div class="section-heading"><h2>Édition et progression</h2><button class="text-link" type="button" data-action="edit-book" data-id="${attr(id)}">Modifier</button></div><dl class="metadata-list"><div><dt>Rayon</dt><dd>${esc(book.genre || 'À classer')}</dd></div><div><dt>Éditeur</dt><dd>${esc(book.publisher || 'Non renseigné')}</dd></div><div><dt>Édition</dt><dd>${esc(book.edition || 'Non renseignée')}</dd></div>${audio ? `<div><dt>Support</dt><dd>Livre audio</dd></div><div><dt>Durée</dt><dd>${book.durationMinutes || 'Non renseignée'} min</dd></div><div><dt>Narration</dt><dd>${esc(book.narrator || 'Non renseignée')}</dd></div><div><dt>Plateforme</dt><dd>${esc(book.audioPlatform || 'Non renseignée')}</dd></div>` : `<div><dt>Format</dt><dd>${esc(book.format || (book.mediaType === 'ebook' ? 'Livre numérique' : 'Non renseigné'))}</dd></div><div><dt>Pages</dt><dd>${book.totalPages || 'Non renseigné'}</dd></div>`}<div><dt>Statut</dt><dd>${wishlist ? 'Wishlist' : STATUS_LABELS[book.status]}</dd></div>${!wishlist ? `<div><dt>Début de lecture</dt><dd>${book.startedAt ? formatDate(book.startedAt) : 'Non renseigné'}</dd></div><div><dt>Fin de lecture</dt><dd>${book.completedAt ? formatDate(book.completedAt) : 'Non renseignée'}</dd></div><div><dt>Situation</dt><dd>${SITUATION_LABELS[book.situation]}</dd></div>` : ''}</dl></section>
        <section class="card card-pad"><div class="section-heading"><h2>Sessions</h2><button class="text-link" type="button" data-action="manual-session" data-book-id="${attr(id)}">Ajouter une session passée</button></div>${sessions.length ? `<div class="history-list">${sessions.map(session => `<div class="history-item"><span class="history-item__icon">◷</span><div class="history-item__content"><strong>${Math.round(session.durationSeconds/60)} min · ${audio ? 'min.' : 'p.'} ${session.startPage} à ${session.endPage}</strong><span class="small muted">${formatDate(session.startedAt)}${session.manual ? ' · ajoutée manuellement' : ''}</span></div><button class="text-link small" type="button" data-action="edit-session" data-id="${attr(session.id)}">Modifier</button></div>`).join('')}</div>` : `<p class="small muted">Aucune session enregistrée.</p>`}</section>
        <section class="card card-pad"><div class="section-heading"><h2>Traces</h2><button class="text-link" type="button" data-action="quick-trace" data-book-id="${attr(id)}">Ajouter</button></div>${traces.length ? traces.map(trace => `<article class="history-item"><span class="history-item__icon">✦</span><div class="history-item__content"><strong>${esc(trace.text)}</strong><span class="small muted">${trace.page ? `${audio ? 'min.' : 'p.'} ${trace.page} · ` : ''}${VISIBILITY_LABELS[trace.privacy] || 'Privé'}</span></div></article>`).join('') : '<p class="small muted">Aucune Trace pour ce livre.</p>'}</section>
        <section class="card card-pad"><div class="section-heading"><h2>Lexique</h2><button class="text-link" type="button" data-action="add-lexicon" data-book-id="${attr(id)}">Ajouter</button></div>${lexicon.length ? lexicon.map(item => `<article class="history-item"><span class="history-item__icon">Aa</span><div class="history-item__content"><strong>${esc(item.word)}</strong><span class="small muted">${esc(item.definition)}</span></div></article>`).join('') : '<p class="small muted">Aucune entrée associée.</p>'}</section>
      </div><div class="danger-zone section-block"><h2>Retirer ce livre</h2><p class="small">La suppression retire aussi ses sessions et ses Traces locales. Une confirmation est obligatoire.</p><button class="button button--danger" type="button" data-action="delete-book" data-id="${attr(id)}">Supprimer le livre</button></div>`;
  }

  function renderProfile() {
    const profile = store.getProfile(), settings = store.getSettings(), stats = store.getStats();
    const dna = store.getReaderDNA();
    const badges = store.getBadges();
    return `<section class="card profile-hero"><button class="icon-button theme-button" type="button" data-action="toggle-theme" aria-label="Passer au thème ${settings.theme === 'dark' ? 'clair' : 'sombre'}" aria-pressed="${settings.theme === 'dark'}">${settings.theme === 'dark' ? '☀' : '☾'}</button><div class="profile-main">${avatarBubble(profile,'profile-avatar')}<div><p class="eyebrow">${esc(profile.title)}</p><h1>${esc(profile.name)}</h1><p class="muted">${esc(profile.handle || '')} · Profil ${profile.visibility === 'private' ? 'privé' : 'public'}</p></div></div><p>${esc(profile.bio || '')}</p><button class="button button--secondary button--small" type="button" data-action="edit-profile">Modifier le profil</button><button class="button button--secondary button--small" type="button" data-action="reader-preferences">Mon espace de lecteur</button><button class="text-link" type="button" data-action="preview-reader">Voir mon profil de lecture</button><a class="button button--secondary button--small" href="#profile?section=settings">Réglages</a><a class="text-link" href="#profile?section=goals">Mes objectifs</a></section>
      <section class="section-block" aria-labelledby="reader-dna-title"><div class="section-heading"><div><p class="eyebrow">Portrait vivant</p><h2 id="reader-dna-title">ADN du lecteur</h2></div><button class="text-link" type="button" data-action="open-dna-history">Voir mon évolution</button></div><article class="reader-dna-card"><span class="reader-dna-card__mark" aria-hidden="true">✦</span><div><p class="eyebrow">Aujourd’hui</p><blockquote>${esc(dna.phrase)}</blockquote>${dna.topGenres.length ? `<div class="reader-dna-traits" aria-label="Territoires littéraires dominants">${dna.topGenres.map(genre => `<span>${esc(genre)}</span>`).join('')}</div>` : ''}<details class="reader-dna-evidence"><summary>Ce qui façonne cet ADN</summary><ul><li>${dna.metrics.completedCount} livre${dna.metrics.completedCount > 1 ? 's' : ''} terminé${dna.metrics.completedCount > 1 ? 's' : ''}</li><li>${store.getLexicon().length} élément${store.getLexicon().length > 1 ? 's' : ''} conservé${store.getLexicon().length > 1 ? 's' : ''} dans le lexique</li><li>${store.getTraces().length} Trace${store.getTraces().length > 1 ? 's' : ''} personnelle${store.getTraces().length > 1 ? 's' : ''}</li></ul></details></div></article></section>
      <section class="section-block"><h2>Statistiques</h2><div class="stats-grid"><div class="card stat-card"><strong>${stats.booksRead}</strong><span>livres lus</span></div><div class="card stat-card"><strong>${Math.floor(stats.totalMinutes/60)} h ${stats.totalMinutes%60}</strong><span>temps de lecture</span></div><div class="card stat-card"><strong>${stats.streak}</strong><span>jours de série</span></div><div class="card stat-card"><strong>${stats.totalTraces}</strong><span>Traces et lexique</span></div><div class="card stat-card"><strong>${stats.booksTransmitted}</strong><span>prêtés ou donnés</span></div></div></section>
      <section class="section-block profile-goals" id="profile-goals" tabindex="-1"><div class="section-heading"><div><p class="eyebrow">Progression personnelle</p><h2>Objectifs</h2><p class="small muted">Ouvrez seulement la période que vous souhaitez consulter ou modifier.</p></div></div>${renderGoals()}</section>
      ${renderLatestBadge(badges)}
      <section class="section-block" id="profile-settings" tabindex="-1"><h2>Compte et préférences</h2><p class="sync-indicator" id="sync-indicator" role="status"></p><div class="settings-list">
        <details class="setting-card"><summary>Informations du compte</summary><div class="setting-card__body"><p><strong>${esc(profile.email)}</strong></p><p class="small muted">Gérez votre mot de passe et les informations de votre compte.</p><button class="button button--secondary button--small" type="button" data-action="simulated-password">Changer le mot de passe</button></div></details>
        <details class="setting-card"><summary>Confidentialité et visibilité</summary><div class="setting-card__body"><form class="form-grid" data-form="privacy"><fieldset><legend>Visibilité du profil</legend><label class="checkbox-row"><input type="radio" name="profileVisibility" value="private" ${profile.visibility === 'private' ? 'checked' : ''}><span><strong>Privé</strong><br><span class="muted">Vos détails sont visibles uniquement par vos amis. Recommandé et sélectionné par défaut.</span></span></label><label class="checkbox-row"><input type="radio" name="profileVisibility" value="public" ${profile.visibility === 'public' ? 'checked' : ''}><span><strong>Public</strong><br><span class="muted">Toute la communauté peut consulter le profil.</span></span></label></fieldset><label class="field">Visibilité par défaut des publications<select name="defaultVisibility"><option value="me" ${settings.defaultPostVisibility === 'me' ? 'selected' : ''}>Moi uniquement</option><option value="friends" ${settings.defaultPostVisibility === 'friends' ? 'selected' : ''}>Amis uniquement</option><option value="public" ${settings.defaultPostVisibility === 'public' ? 'selected' : ''}>Public</option></select></label><button class="button button--primary" type="submit">Enregistrer</button></form></div></details>
        <details class="setting-card"><summary>Préférences de notifications</summary><div class="setting-card__body"><form class="form-grid" data-form="notification-settings">${Object.entries({ friends:'Amitiés', encouragements:'Encouragements', traces:'Traces et réponses', clubs:'Clubs', salons:'Salons', goals:'Objectifs' }).map(([key,label]) => `<label class="checkbox-row"><input type="checkbox" name="${key}" ${settings.notifications[key] ? 'checked' : ''}> ${label}</label>`).join('')}<div data-push-controls><h3>Sur cet appareil</h3><p class="small muted" data-push-status role="status" aria-live="polite">Vérification des notifications…</p><div class="button-row"><button class="button button--secondary button--small" type="button" data-push-action="enable">Activer les notifications</button><button class="button button--secondary button--small" type="button" data-push-action="test" hidden>Tester</button><button class="button button--ghost button--small" type="button" data-push-action="disable" hidden>Désactiver</button></div><p class="small muted">Avec votre accord, Google Firebase reçoit un identifiant technique de cet appareil pour livrer les alertes. Aucun contenu de votre carnet n’est affiché.</p></div><button class="button button--primary" type="submit">Enregistrer</button></form></div></details>
        <details class="setting-card"><summary>Utilisateurs bloqués</summary><div class="setting-card__body">${settings.blockedUsers.length ? settings.blockedUsers.map(id => { const user = store.getCommunity().users.find(item => item.id === id); return `<div class="history-item"><div class="history-item__content"><strong>${esc(user?.name || 'Utilisateur')}</strong></div><button class="text-link small" type="button" data-action="unblock-user" data-id="${attr(id)}">Débloquer</button></div>`; }).join('') : '<p class="small muted">Aucun utilisateur bloqué.</p>'}</div></details>
        <details class="setting-card"><summary>Données et aide</summary><div class="setting-card__body"><div class="button-row"><button class="button button--secondary button--small" type="button" data-action="export-data">Exporter mes données</button><button class="button button--secondary button--small" type="button" data-action="sync-recover">Reprendre la version synchronisée</button><button class="button button--secondary button--small" type="button" data-action="export-recovery">Exporter les copies de récupération</button><button class="button button--secondary button--small" type="button" data-action="help">Aide et signalement</button></div><p class="small muted">L’export est un fichier JSON local. Aucun rapport PDF premium n’est généré dans cette phase.</p></div></details>
      </div></section><section class="danger-zone section-block"><h2>Fin de session et compte</h2><div class="button-row"><button class="button button--secondary" type="button" data-action="logout">Se déconnecter</button><button class="button button--danger" type="button" data-action="delete-account">Effacer les données locales</button></div></section>`;
  }

  function renderLatestBadge(badges) {
    const latest = badges.items.filter(item => item.unlockedAt).sort((a,b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))[0];
    const acquired = badges.items.filter(item => item.unlockedAt).length;
    return `<section class="section-block" aria-labelledby="badges-title"><div class="section-heading section-heading--compact"><div><p class="eyebrow">Progression personnelle</p><h2 id="badges-title">Dernier badge</h2></div><button class="text-link small" type="button" data-action="open-badges">Voir les ${badges.items.length} badges</button></div>${latest ? `<article class="latest-badge-card"><span class="latest-badge-card__medal" aria-hidden="true"><span>${esc(latest.icon)}</span></span><div><span class="status-chip">${acquired} acquis</span><h3>${esc(latest.name)}</h3><p>${esc(latest.description)}</p><small>Obtenu le ${formatDate(latest.unlockedAt)} · visible uniquement par vous</small></div></article>` : `<div class="latest-badge-card latest-badge-card--empty"><span class="latest-badge-card__medal" aria-hidden="true"><span>✦</span></span><div><h3>Votre premier badge vous attend</h3><p>Terminez une première session pour marquer ce premier pas.</p><button class="text-link small" type="button" data-action="open-badges">Découvrir les badges</button></div></div>`}</section>`;
  }

  function openReaderDNAHistory() {
    const dna = store.getReaderDNA();
    const snapshots = dna.history || [];
    const cards = snapshots.map((snapshot, index) => {
      const books = (snapshot.sourceBookIds || []).map(id => store.getBookById(id)).filter(Boolean).slice(0, 4);
      return `<article class="dna-history-card ${index === 0 ? 'is-current' : ''}"><header><div><p class="eyebrow">${index === 0 ? 'Aujourd’hui' : esc(snapshot.label || 'Étape précédente')}</p><time datetime="${attr(snapshot.createdAt)}">${formatDate(snapshot.createdAt)}</time></div>${index === 0 ? '<span class="status-chip">ADN actuel</span>' : ''}</header><blockquote>${esc(snapshot.phrase)}</blockquote>${snapshot.topGenres?.length ? `<div class="reader-dna-traits">${snapshot.topGenres.map(genre => `<span>${esc(genre)}</span>`).join('')}</div>` : ''}${books.length ? `<div class="dna-history-books" aria-label="Lectures ayant façonné cette étape">${books.map(book => `<span title="${attr(book.title)}">${cover(book,'small')}</span>`).join('')}</div>` : ''}</article>`;
    }).join('');
    openDialog({ title:'Évolution de votre ADN', eyebrow:`${snapshots.length} étape${snapshots.length > 1 ? 's' : ''} conservée${snapshots.length > 1 ? 's' : ''}`, wide:true, body:`<p class="small muted">Ce portrait évolue après une lecture terminée, un changement de chemin important ou plusieurs nouvelles Traces et entrées de lexique. Les résultats aux quiz ne modifient pas votre ADN.</p><div class="dna-history">${cards || '<div class="empty-state"><h3>Votre première étape se prépare</h3><p>Ajoutez quelques lectures pour commencer votre histoire.</p></div>'}</div>` });
  }

  function openBadgesDialog() {
    const badges = store.getBadges(), acquired = badges.items.filter(item => item.unlockedAt).length;
    openDialog({ title:'Tous les badges', eyebrow:`${acquired} acquis · ${badges.items.length - acquired} à acquérir`, wide:true, body:`<p class="small muted">Ces jalons restent personnels : aucun classement public et aucune comparaison avec les autres lecteurs.</p><div class="personal-records section-block"><span><strong>${formatDuration(badges.records.longestSessionSeconds)}</strong><small>plus longue session</small></span><span><strong>${badges.records.longestStreakDays} jour${badges.records.longestStreakDays > 1 ? 's' : ''}</strong><small>plus longue série</small></span><span><strong>${badges.records.booksInBestMonth} livre${badges.records.booksInBestMonth > 1 ? 's' : ''}</strong><small>meilleur mois</small></span></div><div class="badge-grid">${badges.items.map(badge => `<article class="reading-badge ${badge.unlockedAt ? 'is-unlocked' : 'is-locked'}"><span class="reading-badge__icon" aria-hidden="true">${esc(badge.icon)}</span><div><h3>${esc(badge.name)}</h3><p>${esc(badge.description)}</p>${badge.unlockedAt ? `<small>Obtenu le ${formatDate(badge.unlockedAt)}</small>` : '<small>À acquérir</small>'}</div></article>`).join('')}</div>` });
  }

  function openSearch() {
    const dialog = document.getElementById('search-dialog');
    ui.lastFocus = document.activeElement;
    document.getElementById('global-search').value = ui.searchQuery;
    renderSearchResults(ui.searchQuery);
    if (!dialog.open) dialog.showModal();
    setTimeout(() => document.getElementById('global-search').focus(), 40);
  }

  function fuzzyMatch(haystack, query) {
    const source = normalize(haystack), needle = normalize(query);
    if (!needle) return true;
    if (source.includes(needle)) return true;
    const tokens = source.split(' '), queries = needle.split(' ');
    return queries.every(term => tokens.some(token => token.startsWith(term) || editDistance(token, term) <= (term.length > 5 ? 2 : 1)));
  }
  function editDistance(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row]);
    for (let col = 0; col <= a.length; col++) matrix[0][col] = col;
    for (let row = 1; row <= b.length; row++) for (let col = 1; col <= a.length; col++) matrix[row][col] = b[row-1] === a[col-1] ? matrix[row-1][col-1] : 1 + Math.min(matrix[row-1][col-1], matrix[row][col-1], matrix[row-1][col]);
    return matrix[b.length][a.length];
  }
  function renderSearchResults(query) {
    const container = document.getElementById('global-search-results'); if (!container) return;
    const state = store.getState(), community = store.getCommunity(), blocked = new Set(state.settings.blockedUsers);
    if (!query.trim()) {
      const recent = state.settings.recentSearches || [];
      container.innerHTML = recent.length ? `<div class="search-results"><section class="search-group"><h3>Recherches récentes</h3>${recent.map(term => `<button class="search-result" type="button" data-action="recent-search" data-query="${attr(term)}"><span class="search-result__icon">⌕</span><span>${esc(term)}</span></button>`).join('')}</section></div>` : `<div class="empty-state section-block"><h3>Explorez votre univers BOO-P</h3><p>La recherche couvre livres, lecteurs, clubs et salons, avec tolérance aux accents et petites erreurs.</p></div>`;
      return;
    }
    const books = state.books.filter(book => fuzzyMatch(`${book.title} ${book.authors.join(' ')} ${book.publisher} ${book.genre || ''}`, query));
    const users = community.users.filter(user => !blocked.has(user.id) && fuzzyMatch(`${user.name} ${user.bio}`, query));
    const clubs = community.clubs.filter(club => club.visibility === 'public' && fuzzyMatch(`${club.name} ${club.description} ${club.bookTitle}`, query));
    const salons = community.salons.filter(salon => fuzzyMatch(`${salon.title} ${salon.bookTitle} ${salon.clubName}`, query));
    const groups = [
      ['Livres et éditions', books.map(book => searchResult('▥', book.title, `${book.authors.join(', ')} · ${book.publisher || 'édition locale'}`, '#book?id=' + encodeURIComponent(book.id)))],
      ['Lecteurs', users.map(user => searchResult('◉', user.name, user.profileVisibility === 'private' ? 'Profil privé · aperçu minimal' : user.bio, '#community?tab=friends'))],
      ['Clubs publics', clubs.map(club => searchResult('◎', club.name, club.bookTitle || 'Club public', '#community?tab=clubs'))],
      ['Salons accessibles', salons.map(salon => searchResult('◷', salon.title, `${salon.clubName} · ${salon.bookTitle}`, '#community?tab=salons'))]
    ].filter(([,items]) => items.length);
    container.innerHTML = groups.length ? `<div class="search-results">${groups.map(([label,items]) => `<section class="search-group"><h3>${label}</h3>${items.join('')}</section>`).join('')}</div>` : `<div class="empty-state section-block"><h3>Aucun résultat</h3><p>Essayez un titre, un auteur ou un nom plus court.</p><button class="button button--secondary button--small" type="button" data-action="search-add-book">Ajouter ce livre manuellement</button></div>`;
  }
  function searchResult(icon, title, detail, route) { return `<button class="search-result" type="button" data-action="search-navigate" data-route="${attr(route)}"><span class="search-result__icon">${icon}</span><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></button>`; }
  function saveRecentSearch(query) { const settings = store.getSettings(); const clean = query.trim(); if (!clean) return; settings.recentSearches = [clean, ...(settings.recentSearches || []).filter(item => normalize(item) !== normalize(clean))].slice(0, 5); store.saveSettings(settings); }

  function openNotifications() {
    const dialog = document.getElementById('notifications-dialog'); ui.lastFocus = document.activeElement;
    renderNotifications(); refreshNotifications({ quiet:true }); if (!dialog.open) dialog.showModal();
  }
  function renderNotifications() {
    const all = store.getNotifications();
    const items = ui.notificationFilter === 'unread' ? all.filter(item => !item.read) : ui.notificationFilter === 'social' ? all.filter(item => ['friend','trace','encouragement'].includes(item.type)) : all;
    const syncNote = isGuestMode() ? 'En mode invité, les notifications de test restent sur cet appareil.' : 'Demandes d’amis, Traces et encouragements sont synchronisés avec votre compte BOO-P.';
    document.getElementById('notifications-body').innerHTML = `<div class="toolbar"><label class="sr-only" for="notification-filter">Filtrer</label><select id="notification-filter" data-change="notification-filter"><option value="all" ${ui.notificationFilter === 'all' ? 'selected' : ''}>Toutes</option><option value="unread" ${ui.notificationFilter === 'unread' ? 'selected' : ''}>Non lues</option><option value="social" ${ui.notificationFilter === 'social' ? 'selected' : ''}>Communauté</option></select><button class="button button--ghost button--small" type="button" data-action="mark-all-notifications">Tout marquer comme lu</button></div><p class="small muted">${syncNote}</p>${items.length ? items.map(item => `<article class="notification-item ${item.read ? '' : 'is-unread'}">${item.read ? '<span class="notification-dot" style="opacity:.2"></span>' : '<span class="notification-dot"></span>'}<div class="card-content"><strong>${esc(item.title)}</strong><p class="small">${esc(item.text)}</p><span class="micro muted">${relativeDate(item.date)}</span><div class="card-actions"><button class="text-link small" type="button" data-action="open-notification" data-id="${attr(item.id)}" data-route="${attr(item.route)}">Ouvrir</button>${!item.read ? `<button class="text-link small" type="button" data-action="mark-notification" data-id="${attr(item.id)}">Marquer comme lue</button>` : ''}</div></div></article>`).join('') : `<div class="empty-state notification-empty"><div class="notification-sleeper" aria-hidden="true"><span class="notification-sleeper__pillow"></span><span class="notification-sleeper__head"></span><span class="notification-sleeper__body"></span><span class="notification-sleeper__blanket"></span><i>Z</i><i>Z</i><i>Z</i></div><h3>Tout est calme</h3><p>Aucune notification dans ce filtre.</p></div>`}`;
  }

  function openTraceDialog(bookId = null) {
    const book = store.getBookById(bookId) || store.getCurrentBook();
    const audio = book?.mediaType === 'audio';
    openDialog({ title: 'Garder une pensée', eyebrow: 'Privée par défaut', body: `<form class="form-grid" data-form="trace"><input type="hidden" name="bookId" value="${attr(book?.id || '')}"><label class="field">Livre<select name="bookIdSelect">${store.getBooks().filter(item => item.libraryState === 'library').map(item => `<option value="${attr(item.id)}" ${item.id === book?.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><label class="field">${audio ? 'Minute' : 'Page'} facultative<input type="number" min="0" max="${audio ? (book?.durationMinutes || 99999) : (book?.totalPages || 99999)}" name="page" value="${audio ? (book?.currentMinute || '') : (book?.currentPage || '')}"></label><label class="field">Votre Trace<textarea id="trace-dialog-text" name="text" required maxlength="1200" placeholder="Une idée, une émotion, ce qui vous a marqué…"></textarea></label><div class="button-row"><button class="button button--secondary" type="button" data-action="dictate-dialog-trace">Dicter</button><button class="button button--primary" type="submit">Enregistrer en privé</button></div><p class="small muted">Le partage reste un choix séparé et explicite.</p></form>` });
    enableNotebookDraft(document.querySelector('form[data-form="trace"]'), `trace:${book?.id || 'none'}`);
  }

  function openManualSessionDialog(bookId = null, sessionId = null) {
    const session = sessionId ? store.getSessions().find(item => item.id === sessionId) : null;
    const book = store.getBookById(bookId || session?.bookId) || store.getCurrentBook() || store.getBooks()[0];
    const date = session ? store.localDateKey(session.startedAt) : store.localDateKey(), audio = book?.mediaType === 'audio', position = audio ? book?.currentMinute : book?.currentPage;
    openDialog({ title: session ? 'Modifier la session passée' : 'Ajouter une session passée', eyebrow: 'Historique local', body: `<form class="form-grid" data-form="manual-session"><input type="hidden" name="sessionId" value="${attr(session?.id || '')}"><label class="field">Livre<select name="bookId">${store.getBooks().filter(item => item.libraryState === 'library').map(item => `<option value="${attr(item.id)}" ${item.id === book?.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><label class="field">Date<input type="date" name="date" required value="${date}"></label><div class="field-row"><label class="field">Durée (minutes)<input type="number" min="1" max="1440" name="duration" required value="${session ? Math.max(1,Math.round(session.durationSeconds/60)) : 30}"></label><label class="field">Ou horaires (facultatif)<span class="field-row"><input type="time" name="startTime"><input type="time" name="endTime"></span></label></div><div class="field-row"><label class="field">${audio ? 'Minute de départ' : 'Page de départ'}<input type="number" min="0" name="startPage" value="${session?.startPage ?? position ?? 0}"></label><label class="field">${audio ? 'Minute d’arrivée' : 'Page d’arrivée'}<input type="number" min="0" name="endPage" value="${session?.endPage ?? position ?? 0}"></label></div><label class="field">Note facultative<textarea name="note">${esc(session?.note || '')}</textarea></label><div class="button-row"><button class="button button--primary" type="submit">${session ? 'Enregistrer les modifications' : 'Ajouter la session'}</button>${session ? `<button class="button button--danger" type="button" data-action="delete-session" data-id="${attr(session.id)}">Supprimer</button>` : ''}</div></form>` });
  }

  function openBookDialog(book = null, { openScanner = false } = {}) {
    const editing = Boolean(book);
    ui.catalogRequest++;
    const knownGenres = store.getBooks().flatMap(item => [item.genre, ...(item.genres || [])]).map(value => String(value || '').trim()).filter(Boolean).sort((a,b) => a.localeCompare(b, 'fr'));
    const genreKeys = new Set();
    const genreOptions = knownGenres.concat(DEFAULT_GENRES).filter(value => { const key = normalize(value); if (!key || genreKeys.has(key)) return false; genreKeys.add(key); return true; });
    ui.pendingCover = book?.coverUrl || '';
    ui.pendingCoverKind = book?.customCover ? 'custom' : (book?.coverUrl ? 'catalogue' : '');
    ui.pendingISBNPhoto = '';
    ui.pendingISBNPhotoFile = null;
    ui.bookSuggestions = [];
    openDialog({ title: editing ? 'Modifier le livre' : 'Ajouter un livre', eyebrow: editing ? 'Métadonnées modifiables' : 'ISBN ou saisie manuelle', wide: true, body: `
      <section class="book-import-panel" aria-labelledby="book-isbn-photo-title">
        <div class="book-import-grid">
          <label class="camera-dropzone" for="isbn-photo-file"><img class="isbn-photo-preview" id="book-isbn-photo-preview" alt="Aperçu du code-barres ISBN" hidden><span class="isbn-scan-frame" aria-hidden="true"><i></i></span><span id="book-isbn-photo-prompt"><strong>Photographier le code-barres ISBN</strong><br><span class="small muted">Placez le code-barres et ses chiffres dans le cadre horizontal</span></span><input class="sr-only" id="isbn-photo-file" type="file" accept="image/*,.heic,.heif" capture="environment" data-change="isbn-photo-file"></label>
          <div class="book-import-copy"><h3 id="book-isbn-photo-title">Lire le code ISBN</h3><p class="small muted">BOO-P analyse uniquement le code-barres ou le numéro ISBN visible sur la photo. La photo reste sur cet appareil et n’est pas enregistrée comme couverture.</p><button class="button button--sage" id="scan-book-isbn" type="button" data-action="scan-book-isbn" disabled>Lire l’ISBN</button></div>
        </div>
        <div class="book-analysis-status small" id="book-analysis-status" role="status" aria-live="polite"><span id="book-analysis-message">Vous pouvez photographier le code ou saisir l’ISBN ci-dessous.</span><progress id="book-analysis-progress" max="1" value="0" hidden></progress></div>
      </section>
      <section class="isbn-lookup-card section-block" aria-labelledby="isbn-lookup-title"><h3 id="isbn-lookup-title">Rechercher avec le code ISBN</h3><p class="small muted">Le numéro se trouve généralement près du code-barres au dos du livre.</p><form class="isbn-lookup-form" data-form="isbn-lookup"><label class="field" for="book-isbn-lookup"><span class="sr-only">ISBN-10 ou ISBN-13</span><input id="book-isbn-lookup" name="isbn" inputmode="text" autocapitalize="characters" spellcheck="false" autocomplete="off" placeholder="Ex. 9782070360024" value="${attr(book?.isbn || '')}" required></label><button class="button button--secondary" type="submit">Rechercher l’ISBN</button></form></section>
      <div id="book-lookup-results" aria-live="polite"></div>
      <hr class="section-block"><p class="eyebrow">Saisie manuelle ou correction</p>
      <form class="form-grid" data-form="book"><input type="hidden" name="id" value="${attr(book?.id || '')}"><input type="hidden" name="coverUrl" id="book-cover-value" value="${attr(book?.coverUrl || '')}"><input type="hidden" name="coverSource" id="book-cover-source" value="${attr(ui.pendingCoverKind)}"><div class="field-row"><label class="field">Destination<select name="libraryState"><option value="library" ${book?.libraryState !== 'wishlist' ? 'selected' : ''}>Ma bibliothèque</option><option value="wishlist" ${book?.libraryState === 'wishlist' ? 'selected' : ''}>Ma wishlist</option></select></label><label class="field">Support<select name="mediaType" data-change="book-media"><option value="print" ${book?.mediaType !== 'ebook' && book?.mediaType !== 'audio' ? 'selected' : ''}>Livre papier</option><option value="ebook" ${book?.mediaType === 'ebook' ? 'selected' : ''}>Livre numérique</option><option value="audio" ${book?.mediaType === 'audio' ? 'selected' : ''}>Livre audio</option></select></label></div><div class="field-row"><label class="field">Titre<input id="book-title-field" name="title" required value="${attr(book?.title || '')}" placeholder="Titre du livre"></label><label class="field">Auteur(s)<input id="book-authors-field" name="authors" required value="${attr(book?.authors.join(', ') || '')}" placeholder="Prénom Nom, autre auteur"></label></div><label class="field">Rayon littéraire<input id="book-genre-field" name="genre" list="book-genres" value="${attr(book?.genre || '')}" placeholder="Ex. Romans, Science-fiction…"><datalist id="book-genres">${genreOptions.map(genre => `<option value="${attr(genre)}"></option>`).join('')}</datalist><span class="field-help">Les rayons déjà présents dans votre bibliothèque sont proposés en premier, puis les catégories BOO-P.</span></label><div class="field-row"><label class="field">ISBN<input id="book-isbn-field" name="isbn" inputmode="text" autocapitalize="characters" spellcheck="false" autocomplete="off" value="${attr(book?.isbn || '')}" placeholder="ISBN-10 ou ISBN-13"></label><label class="field">Date de publication<input id="book-published-field" name="publishedDate" value="${attr(book?.publishedDate || '')}" placeholder="Ex. 2024"></label></div><div class="field-row"><label class="field">Éditeur<input id="book-publisher-field" name="publisher" value="${attr(book?.publisher || '')}"></label><label class="field">Édition<input id="book-edition-field" name="edition" value="${attr(book?.edition || '')}"></label></div><div class="field-row" data-page-fields ${book?.mediaType === 'audio' ? 'hidden' : ''}><label class="field">Format<input id="book-format-field" name="format" value="${attr(book?.format || 'Broché')}"></label><label class="field">Nombre de pages<input id="book-pages-field" type="number" min="0" name="totalPages" value="${book?.totalPages || ''}"></label></div><fieldset class="audio-book-fields" data-audio-fields ${book?.mediaType === 'audio' ? '' : 'hidden'}><legend>Informations du livre audio</legend><div class="field-row"><label class="field">Durée totale (minutes)<input type="number" min="0" name="durationMinutes" value="${book?.durationMinutes || ''}"></label><label class="field">Minute atteinte<input type="number" min="0" name="currentMinute" value="${book?.currentMinute || 0}"></label></div><div class="field-row"><label class="field">Narrateur ou narratrice<input name="narrator" value="${attr(book?.narrator || '')}"></label><label class="field">Plateforme ou source<input name="audioPlatform" value="${attr(book?.audioPlatform || '')}" placeholder="Audible, CD, bibliothèque…"></label></div></fieldset><label class="field">Résumé<textarea id="book-description-field" name="description">${esc(book?.description || '')}</textarea></label><div class="field-row"><label class="field">Statut<select name="status">${Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${value}" ${book?.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">Situation<select name="situation">${Object.entries(SITUATION_LABELS).map(([value,label]) => `<option value="${value}" ${book?.situation === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="field-row"><label class="field" data-page-fields ${book?.mediaType === 'audio' ? 'hidden' : ''}>Page atteinte<input type="number" min="0" name="currentPage" value="${book?.currentPage || 0}"></label><label class="checkbox-row"><input type="checkbox" name="historicalBeforeJoin" ${book?.historicalBeforeJoin ? 'checked' : ''}> Lu avant mon inscription</label></div><p class="small muted">Vous pouvez toujours compléter ou corriger les informations avant l’ajout.</p><button class="button button--primary" type="submit">${editing ? 'Enregistrer le livre' : 'Ajouter à BOO-P'}</button></form>` });
    const bookForm = document.querySelector('form[data-form="book"]');
    const formHint = bookForm?.querySelector(':scope > p.small.muted');
    if (bookForm && formHint) {
      formHint.insertAdjacentHTML('beforebegin', `<div class="field-row reading-date-fields"><label class="field">Date de début de lecture<input type="date" name="startedAt" value="${attr(dateInputValue(book?.startedAt))}"></label><label class="field">Date de fin de lecture<input type="date" name="completedAt" value="${attr(dateInputValue(book?.completedAt))}"><span class="field-help">Cette date classe le livre dans le Sentier et le fait compter dans les objectifs du mois et de l’année correspondants.</span></label></div><p class="small muted">Pour une lecture antérieure à votre inscription, indiquez la date de fin si vous la connaissez. Sans date, le livre reste dans votre bibliothèque mais ne compte dans aucun objectif daté.</p><fieldset class="book-rating-field"><legend>Note du livre</legend>${ratingPicker(book?.rating, 'book-rating')}<input type="hidden" name="rating" id="book-rating" value="${book?.rating || ''}"><p class="small muted" id="book-rating-description">${book?.rating ? `${book.rating} étoile${book.rating > 1 ? 's' : ''} sur 5.` : 'Notation facultative de 1 à 5 étoiles.'}</p></fieldset>`);
    }
    prepareBookDialog(editing);
    setBookEntryMode(editing ? 'manual' : 'search');
  }


  function prepareBookDialog(editing) {
    const body = document.getElementById('dialog-body'), form = body.querySelector('form[data-form="book"]');
    const scan = body.querySelector('.book-import-panel'), isbn = body.querySelector('.isbn-lookup-card');
    scan.dataset.bookEntry = 'scan'; isbn.dataset.bookEntry = 'scan';
    body.querySelector('hr')?.remove();
    body.querySelector(':scope > p.eyebrow')?.remove();
    document.getElementById('dialog-eyebrow').textContent = editing ? 'Votre édition' : 'Un livre, plusieurs façons de le trouver';
    const search = document.createElement('section');
    search.dataset.bookEntry = 'search';
    search.innerHTML = `<form class="form-grid" data-form="catalog-search"><label class="field" for="catalog-query">Titre, auteur ou ISBN<input id="catalog-query" name="query" type="search" required minlength="2" maxlength="240" placeholder="Ex. L’Étranger, Albert Camus…" autocomplete="off"></label><button class="button button--primary" type="submit">Rechercher un livre</button><p class="small muted">Recherche dans Google Books et Open Library.</p></form>`;
    body.prepend(search);
    const modes = document.createElement('div'); modes.className = 'entry-modes'; modes.setAttribute('role','group'); modes.setAttribute('aria-label','Méthode d’ajout');
    modes.innerHTML = [['search','Rechercher'],['scan','Scanner un ISBN'],['manual','Saisie manuelle']].map(([value,label]) => `<button type="button" data-action="book-entry-mode" data-mode="${value}" aria-pressed="false">${label}</button>`).join('');
    if (!editing) body.prepend(modes);
    const essential = document.createElement('div'); essential.className = 'form-grid book-essential';
    const advanced = document.createElement('details'); advanced.className = 'optional-fields'; advanced.open = editing;
    advanced.innerHTML = '<summary>Plus de détails sur cette édition</summary><div class="form-grid"></div>';
    const extra = advanced.querySelector('div');
    const submit = form.querySelector('button[type="submit"]');
    const fieldFor = name => form.querySelector(`[name="${name}"]`)?.closest('label.field');
    for (const name of ['title','authors','mediaType','status']) { const field = fieldFor(name); if (field) essential.append(field); }
    const pageFields = form.querySelector('[data-page-fields]');
    const pageCount = pageFields?.querySelector('[name="totalPages"]')?.closest('label');
    if (pageCount) { pageCount.dataset.pageFields = ''; pageCount.hidden = pageFields.hidden; essential.append(pageCount); }
    const audioFields = form.querySelector('[data-audio-fields]'); if (audioFields) essential.append(audioFields);
    const remaining = [...form.children];
    for (const child of remaining) {
      if (child === submit || child.matches('input[type="hidden"]')) continue;
      if (child.matches('.field-row') && !child.children.length) { child.remove(); continue; }
      extra.append(child);
    }
    const preview = document.createElement('div'); preview.id = 'book-selection-preview'; preview.hidden = true;
    form.prepend(preview,essential,advanced);
    form.dataset.bookEntry = 'manual';
    if (submit) submit.textContent = editing ? 'Enregistrer les modifications' : 'Ajouter ce livre';
  }

  function setBookEntryMode(mode, userAction = false) {
    const body = document.getElementById('dialog-body');
    body.querySelectorAll('[data-book-entry]').forEach(panel => { panel.hidden = panel.dataset.bookEntry !== mode; });
    body.querySelectorAll('[data-action="book-entry-mode"]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.mode === mode)));
    const results = document.getElementById('book-lookup-results'); if (results) results.hidden = mode === 'manual';
    if (mode === 'manual') {
      const title = document.getElementById('book-title-field');
      if (title && !title.value) title.value = document.getElementById('catalog-query')?.value || '';
      if (userAction) title?.focus();
    } else if (mode === 'search' && userAction) document.getElementById('catalog-query')?.focus();
    if (mode === 'scan' && userAction) document.getElementById('isbn-photo-file')?.click();
  }

  async function submitCatalogSearch(form, data) {
    const query = String(data.get('query') || '').trim();
    if (query.length < 2) return;
    const request = ++ui.catalogRequest, button = form.querySelector('button[type="submit"]');
    const results = document.getElementById('book-lookup-results');
    button.disabled = true; button.setAttribute('aria-busy','true');
    results.hidden = false; results.innerHTML = '<p class="small muted" role="status">Recherche des livres…</p>';
    try {
      const books = await window.BT.bookLookup.searchBooks(query);
      if (!form.isConnected || request !== ui.catalogRequest) return;
      renderBookLookupResults(books, 'Aucun livre trouvé. Essayez un autre titre ou passez à la saisie manuelle.');
    } catch (error) {
      if (!form.isConnected || request !== ui.catalogRequest) return;
      renderBookLookupResults([], error.message || 'Le catalogue est indisponible. Vous pouvez saisir le livre manuellement.');
    } finally {
      if (button.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }

  function openQuickProgress(bookId) {
    const book = store.getBookById(bookId); if (!book) return;
    const active = store.getActiveSessionForBook(bookId), progress = bookProgress(book);
    openDialog({ title:'Mettre à jour ma progression', eyebrow:book.title, body:`<form class="form-grid" data-form="quick-progress"><input type="hidden" name="bookId" value="${attr(book.id)}">${renderSessionPositionSlider(book, active?.endPage ?? progress.value, { id:'quick-position', name:'position' })}<p class="small muted">Vous pouvez avancer ou corriger votre position, même sans chronomètre.</p><button class="button button--primary" type="submit">Enregistrer ma progression</button></form>` });
  }

  function submitQuickProgress(form, data) {
    const book = store.getBookById(data.get('bookId')); if (!book) return;
    const audio = book.mediaType === 'audio', total = audio ? book.durationMinutes : book.totalPages;
    const position = Math.round(clamp(data.get('position'), 0, total || 99999));
    store.updateBook(book.id, { [audio ? 'currentMinute' : 'currentPage']:position });
    const active = store.getActiveSessionForBook(book.id);
    if (active) store.updateActiveSession({ endPage:position }, active.id);
    closeDialog(); showToast('Progression enregistrée'); render();
  }

  function enableNotebookDraft(form, key) {
    if (!form) return;
    form.dataset.draftKey = key;
    const draft = store.getDraft(key);
    if (draft) Object.entries(draft).forEach(([name,value]) => {
      const field = form.elements.namedItem(name);
      if (field && name !== 'id') field.value = value;
    });
    const status = document.createElement('p'); status.className = 'draft-status'; status.dataset.draftStatus = ''; status.setAttribute('role','status');
    status.textContent = draft ? 'Brouillon retrouvé sur cet appareil.' : 'Votre brouillon sera conservé sur cet appareil pendant 30 jours.';
    form.append(status);
  }

  function saveNotebookDraft(event) {
    const form = event.target.closest('form[data-draft-key]'); if (!form) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const saved = store.saveDraft(form.dataset.draftKey, values);
    const status = form.querySelector('[data-draft-status]');
    if (status) status.textContent = saved ? 'Brouillon enregistré sur cet appareil.' : 'Brouillon non sauvegardé : le stockage de cet appareil est plein.';
  }

  function openMemoryCapture(bookId = null) {
    const book = store.getBookById(bookId) || store.getCurrentBook();
    openDialog({ title:'Garder quelque chose', eyebrow:book?.title || 'Mon carnet', body:`<p class="muted">Un souvenir pour vous, à retrouver au fil de vos lectures.</p><div class="capture-choices">${[['thought','Une pensée','Une idée, une émotion : votre Trace personnelle.','✦'],['citation','Une citation','Une phrase du livre à conserver.','“'],['word','Un mot','Un mot ou une expression à comprendre.','Aa']].map(([kind,label,description,icon]) => `<button type="button" data-action="capture-kind" data-kind="${kind}" data-book-id="${attr(book?.id || '')}"><span aria-hidden="true">${icon}</span><span><strong>${label}</strong><small>${description}</small></span><span aria-hidden="true">→</span></button>`).join('')}</div>` });
  }

  function openMemoryKind(kind, bookId) {
    if (kind === 'thought') { openTraceDialog(bookId); return; }
    openLexiconDialog(null, bookId, { initialKind:kind === 'citation' ? 'citation' : 'word' });
  }

  function updateNotebookComposer(form) {
    if (!form) return;
    const citation = form.elements.kind.value === 'citation';
    form.querySelector('[data-action="dictionary-lookup"]')?.toggleAttribute('hidden',citation);
    document.getElementById('dictionary-result')?.toggleAttribute('hidden',citation);
    form.elements.definition.required = !citation;
    const label = form.elements.definition.closest('label');
    if (label?.firstChild) label.firstChild.textContent = citation ? 'Ce que cette phrase évoque · facultatif' : 'Définition ou explication';
    form.querySelector('button[type="submit"]').textContent = 'Enregistrer dans mon carnet';
  }

  function revealBookLookupResults(container) {
    if (!container) return;
    window.requestAnimationFrame(() => {
      const firstResult = container.querySelector('.recognition-result');
      const target = firstResult || container;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      target.scrollIntoView({ behavior:reducedMotion ? 'auto' : 'smooth', block:'center', inline:'nearest' });
      firstResult?.focus({ preventScroll:true });
    });
  }

  function renderBookLookupResults(suggestions, message = '', isbn = '') {
    const container = document.getElementById('book-lookup-results'); if (!container) return;
    ui.bookSuggestions = Array.isArray(suggestions) ? suggestions : [];
    if (!ui.bookSuggestions.length) {
      container.innerHTML = `<div class="book-lookup-empty section-block"><strong>Aucun livre trouvé</strong><p class="small muted">${esc(message || 'Vérifiez le numéro ou saisissez le livre manuellement.')}</p><button class="button button--secondary" type="button" data-action="book-entry-mode" data-mode="manual">Saisir le livre manuellement</button></div>`;
      revealBookLookupResults(container);
      return;
    }
    container.innerHTML = `<div class="success-panel section-block"><strong>${ui.bookSuggestions.length} édition${ui.bookSuggestions.length > 1 ? 's' : ''} trouvée${ui.bookSuggestions.length > 1 ? 's' : ''}</strong><p class="small">Choisissez la bonne édition, puis vérifiez les champs préremplis.${ui.pendingCover ? ' La couverture actuelle sera conservée si le catalogue n’en fournit pas.' : ''}</p></div><div class="book-lookup-results section-block">${ui.bookSuggestions.map((item,index) => { const resultCover = item.coverUrl || ui.pendingCover; return `<button class="recognition-result" type="button" data-action="pick-book-result" data-index="${index}">${resultCover ? `<span class="book-cover book-cover--small"><img src="${attr(resultCover)}" alt="Couverture de ${attr(item.title)}" loading="lazy"></span>` : `<span class="book-cover book-cover--small" style="background:${gradientFor(item.title)}"><span>${esc(item.title)}</span></span>`}<span class="card-content"><strong>${esc(item.title)}</strong><span class="small muted">${esc((item.authors || []).join(', ') || 'Auteur non renseigné')}${item.publisher ? ` · ${esc(item.publisher)}` : ''}${item.totalPages ? ` · ${item.totalPages} pages` : ''}</span><span class="micro muted">${esc(item.isbn ? `ISBN ${item.isbn} · ` : '')}${esc(item.source || 'Catalogues publics')}${item.description ? ` · résumé ${esc(item.descriptionSource || 'disponible')}` : ' · résumé non fourni'}${!item.coverUrl && ui.pendingCover ? ' · couverture actuelle' : ''}</span></span></button>`; }).join('')}</div>`;
    revealBookLookupResults(container);
  }

  function openLexiconDialog(entry = null, bookId = null, { includeCitation = true, initialKind = 'word' } = {}) {
    const book = store.getBookById(bookId || entry?.bookId);
    const initialType = entry?.kind || initialKind;
    const citationOption = includeCitation || initialType === 'citation' ? `<option value="citation" ${initialType === 'citation' ? 'selected' : ''}>Citation</option>` : '';
    const entryLabel = includeCitation ? 'Mot, expression ou citation' : 'Mot ou expression';
    openDialog({ title: entry ? 'Modifier l’entrée' : 'Ajouter au lexique', eyebrow: 'Comprendre puis mémoriser', body: `<form class="form-grid" data-form="lexicon"><input type="hidden" name="id" value="${attr(entry?.id || '')}"><input type="hidden" name="sourceLabel" value="${attr(entry?.sourceLabel || '')}"><input type="hidden" name="sourceUrl" value="${attr(entry?.sourceUrl || '')}"><div class="field-row"><label class="field">Type<select name="kind" data-change="notebook-kind"><option value="word" ${initialType !== 'expression' && initialType !== 'citation' ? 'selected' : ''}>Mot</option><option value="expression" ${initialType === 'expression' ? 'selected' : ''}>Expression</option>${citationOption}</select></label><label class="field">${entryLabel}<input name="word" required value="${attr(entry?.word || '')}"></label></div>${includeCitation ? '' : '<p class="small muted">Les citations se saisissent directement dans la session de lecture.</p>'}<button class="button button--sage" type="button" data-action="dictionary-lookup">Chercher une explication</button><div class="dictionary-result small" id="dictionary-result" role="status" aria-live="polite">${entry?.sourceLabel ? `Source actuelle : ${esc(entry.sourceLabel)}. Vous pouvez toujours corriger le texte.` : 'BOO-P propose plusieurs sens issus d’une source ouverte, puis prépare les liens exacts vers Le Robert et Larousse.'}</div><label class="field">Définition ou explication modifiable<textarea name="definition" required>${esc(entry?.definition || '')}</textarea></label><label class="field">Livre facultatif<select name="bookId"><option value="">Sans livre</option>${store.getBooks().filter(item => item.libraryState === 'library').map(item => `<option value="${attr(item.id)}" ${(entry?.bookId || book?.id) === item.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><div class="field-row"><label class="field">Auteur<input name="author" value="${attr(entry?.author || book?.authors.join(', ') || '')}"></label><label class="field">${book?.mediaType === 'audio' ? 'Minute' : 'Page'}<input type="number" min="0" name="page" value="${entry?.page || ''}"></label></div><label class="field">Contexte ou note personnelle<textarea name="note">${esc(entry?.note || '')}</textarea></label><p class="small muted">Après l’enregistrement, cette entrée rejoint la Mémoire active avec des rappels adaptés à J+1, J+3, J+7, J+14 et J+30.</p><button class="button button--primary" type="submit">Enregistrer et apprendre</button></form>` });
    if (!entry) enableNotebookDraft(document.querySelector('form[data-form="lexicon"]'), `lexicon:${initialKind}:${book?.id || 'none'}`);
    updateNotebookComposer(document.querySelector('form[data-form="lexicon"]'));
  }

  async function lookupDictionary(button) {
    const form = button.closest('form'), term = form?.elements.word?.value, kind = form?.elements.kind?.value;
    const result = document.getElementById('dictionary-result');
    if (!form || !result) return;
    button.disabled = true; button.setAttribute('aria-busy', 'true'); result.textContent = 'Recherche de l’explication…';
    try {
      const found = await window.BT.dictionary.lookup(term, kind);
      form.elements.definition.value = found.definition;
      form.elements.sourceLabel.value = found.sourceLabel;
      form.elements.sourceUrl.value = found.sourceUrl;
      const candidates = (found.candidates || []).map((candidate, index) => `<button class="dictionary-choice ${index === 0 ? 'is-selected' : ''}" type="button" data-action="dictionary-choice" data-definition="${attr(candidate.definition)}" data-source-label="${attr(candidate.sourceLabel)}" data-source-url="${attr(candidate.sourceUrl)}"><span>Sens ${index + 1}</span>${esc(candidate.definition)}</button>`).join('');
      const references = (found.externalSources || []).map(source => `<a class="button button--ghost button--small" href="${attr(source.url)}" target="_blank" rel="noopener">${esc(source.label)} ↗</a>`).join('');
      result.innerHTML = `<p><strong>Choisissez le sens qui correspond à votre lecture.</strong> La première proposition reste entièrement modifiable.</p><div class="dictionary-choices">${candidates}</div><p class="micro muted">Propositions issues du <a href="${attr(found.sourceUrl)}" target="_blank" rel="noopener">${esc(found.sourceLabel)}</a>.</p><div class="dictionary-reference-links"><span>Vérifier sans retaper le mot :</span>${references}</div>`;
      form.elements.definition.focus();
    } catch (error) {
      result.textContent = error.message || 'Aucune explication trouvée. Saisissez la vôtre.';
      showToast(result.textContent);
      form.elements.word.focus();
    }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  }

  function chooseDictionaryDefinition(trigger) {
    const form = trigger.closest('form'); if (!form) return;
    form.elements.definition.value = trigger.dataset.definition || '';
    form.elements.sourceLabel.value = trigger.dataset.sourceLabel || '';
    form.elements.sourceUrl.value = trigger.dataset.sourceUrl || '';
    form.querySelectorAll('.dictionary-choice').forEach(button => button.classList.toggle('is-selected', button === trigger));
    document.getElementById('live-region').textContent = 'Définition sélectionnée. Vous pouvez encore la modifier.';
  }

  function openGoalDialog(period) {
    const goals = store.getState().goals, goal = goals[period], books = store.getBooks().filter(book => book.libraryState === 'library');
    const labels = { week:'Cette semaine', month:'Ce mois', year:'Cette année' };
    const weeklyFields = `<div class="field-row"><label class="field">Minutes par jour<input type="number" name="dailyMinutes" min="5" max="240" step="5" value="${goal.dailyMinutes}"></label><label class="field">Nombre de jours à atteindre<input type="number" name="daysTarget" min="1" max="7" value="${goal.daysTarget}"></label></div><p class="small muted">La semaine va du lundi au dimanche et se renouvelle automatiquement.</p>`;
    const monthlyFields = `<label class="field">Livres à terminer<input type="number" name="targetBooks" min="1" max="100" value="${goal.targetBooks}"></label><fieldset><legend>Livres concernés</legend><label class="checkbox-row"><input type="checkbox" name="allBooks" data-change="goal-all-books" ${!goal.bookIds.length ? 'checked' : ''}> Tous les livres</label><div class="form-grid">${books.map(book => `<label class="checkbox-row"><input type="checkbox" name="bookIds" data-change="goal-book" value="${attr(book.id)}" ${goal.bookIds.includes(book.id) ? 'checked' : ''}> ${esc(book.title)}</label>`).join('')}</div></fieldset><p class="small muted">Choisir un titre désactive automatiquement « Tous les livres ». La progression est recalculée à partir des dates de fin du mois.</p>`;
    const yearlyFields = `<label class="field">Nombre de livres souhaité<input type="number" name="targetBooks" min="1" max="500" value="${goal.targetBooks}"></label><div class="goal-form-note"><strong>Calcul automatique</strong><p>Chaque livre terminé cette année vaut 1. Chaque livre en cours ou en pause vaut 0,5. Les livres abandonnés et la wishlist ne comptent pas.</p></div>`;
    openDialog({ title: `Objectif · ${labels[period]}`, eyebrow: 'Un seul objectif principal', body: `<form class="form-grid" data-form="goal" data-period="${period}">${period === 'week' ? weeklyFields : period === 'month' ? monthlyFields : yearlyFields}<button class="button button--primary" type="submit">Enregistrer l’objectif</button></form>` });
  }

  function monthlyReportOptions(selected = window.BT.monthlyReport.normalizeMonthKey()) {
    const options = [];
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push(`<option value="${key}" ${key === selected ? 'selected' : ''}>${esc(window.BT.monthlyReport.monthLabel(key))}</option>`);
    }
    return options.join('');
  }

  function openMonthlyReportDialog(monthKey = window.BT.monthlyReport.normalizeMonthKey()) {
    const includeNotes = Boolean(ui.monthlyReportData?.includePersonalNotes);
    openDialog({ title:'Rapport mensuel', eyebrow:'Image privée créée sur cet appareil', wide:true, body:`<form class="form-grid" data-form="monthly-report"><label class="field">Mois du rapport<select name="monthKey">${monthlyReportOptions(monthKey)}</select></label><fieldset><legend>Notes personnelles</legend><label class="checkbox-row"><input type="checkbox" name="includePersonalNotes" ${includeNotes ? 'checked' : ''}> Inclure un court extrait de mes Traces et notes de session</label><p class="small muted">Si cette option reste décochée, seules les statistiques, les livres et les entrées du lexique apparaissent. Aucune donnée n’est envoyée : l’image est générée localement.</p></fieldset><div class="report-format-note"><span aria-hidden="true">▣</span><div><strong>Format portrait 4:5</strong><p class="small muted">1080 × 1350 px, adapté au fil Instagram et au partage depuis un téléphone.</p></div></div><button class="button button--primary" type="submit">Générer mon image</button></form>` });
  }

  async function submitMonthlyReport(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Création de l’image…';
    try {
      ui.monthlyReportData = window.BT.monthlyReport.buildData(store.getState(), data.get('monthKey'), data.get('includePersonalNotes') === 'on');
      ui.monthlyReportCanvas = await window.BT.monthlyReport.render(ui.monthlyReportData);
      ui.monthlyReportCanvas.className = 'monthly-report-preview';
      ui.monthlyReportCanvas.setAttribute('role', 'img');
      ui.monthlyReportCanvas.setAttribute('aria-label', `Rapport de lecture de ${ui.monthlyReportData.label}`);
      const body = document.getElementById('dialog-body');
      body.innerHTML = `<div class="report-preview-wrap" id="monthly-report-preview-host"></div><p class="small muted">Relisez l’image avant de la publier. Le bouton Partager ouvre la feuille de partage de votre téléphone lorsque le navigateur le permet.</p><div class="button-row report-actions"><button class="button button--primary" type="button" data-action="share-monthly-report">Partager l’image</button><button class="button button--secondary" type="button" data-action="download-monthly-report">Télécharger le PNG</button><button class="button button--ghost" type="button" data-action="edit-monthly-report">Modifier les options</button></div>`;
      document.getElementById('monthly-report-preview-host').appendChild(ui.monthlyReportCanvas);
      showToast('Rapport mensuel prêt à être publié');
    } catch (error) { submit.disabled = false; submit.textContent = 'Générer mon image'; showToast(error.message || 'Le rapport ne peut pas être créé sur cet appareil'); }
  }

  async function downloadMonthlyReport() {
    if (!ui.monthlyReportCanvas || !ui.monthlyReportData) return;
    await window.BT.monthlyReport.download(ui.monthlyReportCanvas, ui.monthlyReportData);
    showToast('Rapport PNG téléchargé');
  }

  async function shareMonthlyReport() {
    if (!ui.monthlyReportCanvas || !ui.monthlyReportData) return;
    try {
      const shared = await window.BT.monthlyReport.share(ui.monthlyReportCanvas, ui.monthlyReportData);
      if (shared) showToast('Feuille de partage ouverte');
      else { await downloadMonthlyReport(); showToast('Partage direct indisponible · image téléchargée'); }
    } catch (error) { if (error?.name !== 'AbortError') showToast(error.message || 'Partage interrompu'); }
  }

  function openProfileDialog() {
    const profile = store.getProfile();
    if (ui.pendingProfilePhotoUrl) URL.revokeObjectURL(ui.pendingProfilePhotoUrl);
    ui.pendingProfilePhotoUrl = '';
    ui.pendingProfilePhotoFile = null;
    ui.removeProfilePhoto = false;
    const hasPhoto = Boolean(avatarSource(profile));
    openDialog({ title: 'Modifier le profil', eyebrow: 'Identité du lecteur', body: `<form class="form-grid" data-form="profile"><div class="profile-photo-field"><span class="profile-photo-preview" id="profile-photo-preview" aria-hidden="true">${avatarInner(profile)}</span><div><label class="button button--secondary button--small profile-photo-button" for="profile-photo-file">${hasPhoto ? 'Changer la photo' : 'Ajouter une photo'}<input class="sr-only" id="profile-photo-file" name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" data-change="profile-photo"></label><button class="text-link small" id="remove-profile-photo" type="button" data-action="remove-profile-photo" ${hasPhoto ? '' : 'hidden'}>Retirer la photo</button><p class="field-help" id="profile-photo-help">Déplacez la photo et zoomez pour choisir le cadrage · 15 Mo maximum.</p></div></div><label class="field">Nom ou pseudonyme<input name="name" required value="${attr(profile.name)}"></label><label class="field">Identifiant<input name="handle" value="${attr(profile.handle || '')}"></label><label class="field">Phrase de profil<input name="title" value="${attr(profile.title || '')}"></label><label class="field">Biographie<textarea name="bio">${esc(profile.bio || '')}</textarea></label><label class="field">Centres d’intérêt<input name="interests" value="${attr((profile.interests || []).join(', '))}"><span class="field-help">Séparés par des virgules</span></label><button class="button button--primary" type="submit">Enregistrer</button></form>` });
  }

  function openFinishSessionDialog() {
    let session = store.getActiveSession();
    if (!session) return;
    store.pauseActiveSession(session.id);
    const pendingCitation = String(session.citationDraft || '').trim();
    if (pendingCitation) store.addActiveSessionCitation(pendingCitation);
    session = store.getActiveSession();
    const book = store.getBookById(session.bookId), audio = book.mediaType === 'audio', total = audio ? book.durationMinutes : book.totalPages;
    const citations = Array.isArray(session.citations) ? session.citations : [];
    render();
    openDialog({ title: 'Terminer ma lecture', eyebrow: 'Chronomètre en pause', body: `<form class="form-grid" data-form="finish-session"><p class="muted">Où vous êtes-vous arrêté dans <strong>${esc(book.title)}</strong> ?</p>${renderSessionPositionSlider(book, session.endPage, { id:'finish-session-page', name:'endPage' })}<label class="checkbox-row"><input type="checkbox" name="markRead" ${Number(session.endPage) >= Number(total) && total ? 'checked' : ''}> J’ai terminé ce livre</label><details class="optional-fields" ${session.traceDraft ? 'open' : ''}><summary>Garder une pensée ou noter le livre · facultatif</summary><div class="form-grid"><label class="field">Une pensée pour mon carnet<textarea name="traceText" maxlength="1200">${esc(session.traceDraft || '')}</textarea></label><fieldset class="book-rating-field"><legend>Note du livre · facultative</legend>${ratingPicker(book.rating, 'finish-rating')}<input type="hidden" name="rating" id="finish-rating" value="${book.rating || ''}"><p class="small muted" id="finish-rating-description">${book.rating ? `${book.rating} étoiles sur 5.` : 'Choisissez une note de 1 à 5 étoiles.'}</p></fieldset><label class="checkbox-row"><input type="checkbox" name="share"> Préparer une publication après ma lecture</label><p class="small muted">Un aperçu modifiable vous permettra de choisir l’audience et de confirmer. Votre pensée reste privée tant que vous ne publiez pas.</p></div></details>${citations.length ? `<p class="small muted">${citations.length} citation${citations.length > 1 ? 's' : ''} conservée${citations.length > 1 ? 's' : ''} dans votre carnet.</p>` : ''}<button class="button button--primary" type="submit">Enregistrer ma lecture</button><button class="text-link" type="button" data-action="resume-from-finish">Revenir à ma lecture</button></form>` });
  }

  async function handleClick(event) {
    const clickedSpine = event.target.closest?.('.book-spine[data-action="select-book"]');
    if (ui.selectedLibraryBookId && clickedSpine?.dataset.id !== ui.selectedLibraryBookId) clearLibraryBookSelection(true);
    const trigger = event.target.closest('[data-action]'); if (!trigger) return;
    const action = trigger.dataset.action, id = trigger.dataset.id;
    switch (action) {
      case 'close-dialog': closeDialog(); break;
      case 'open-search': openSearch(); break;
      case 'close-search': closeDialog(document.getElementById('search-dialog')); break;
      case 'open-notifications': openNotifications(); break;
      case 'close-notifications': closeDialog(document.getElementById('notifications-dialog')); break;
      case 'mark-all-notifications': await markAllNotificationsRead(); break;
      case 'mark-notification': await markNotificationRead(id); break;
      case 'open-notification': await markNotificationRead(id); closeDialog(document.getElementById('notifications-dialog')); location.hash = trigger.dataset.route || '#home'; break;
      case 'recent-search': ui.searchQuery = trigger.dataset.query || ''; document.getElementById('global-search').value = ui.searchQuery; renderSearchResults(ui.searchQuery); break;
      case 'search-navigate': saveRecentSearch(ui.searchQuery); closeDialog(document.getElementById('search-dialog')); location.hash = trigger.dataset.route; break;
      case 'search-add-book': { const query = ui.searchQuery; closeDialog(document.getElementById('search-dialog')); openBookDialog(); setTimeout(() => { document.getElementById('book-title-field').value = query; }, 60); break; }
      case 'start-session': startSession(store.getCurrentBook()?.id); break;
      case 'resume-session': if (id) { store.focusActiveSession(id); store.resumeActiveSession(id); } location.hash = '#session'; break;
      case 'focus-session': store.focusActiveSession(id); location.hash = '#session'; render(); break;
      case 'book-session': startSession(id); break;
      case 'leave-session': location.hash = '#home'; showToast('Session conservée en arrière-plan'); break;
      case 'toggle-session': { const session = store.getActiveSession(); session?.status === 'running' ? store.pauseActiveSession() : store.resumeActiveSession(); render(); break; }
      case 'save-session-citation': saveSessionCitation(); break;
      case 'finish-session': openFinishSessionDialog(); break;
      case 'quick-trace': openTraceDialog(trigger.dataset.bookId || store.getActiveSession()?.bookId); break;
      case 'session-lexicon': openLexiconDialog(null, store.getActiveSession()?.bookId, { includeCitation:false }); break;
      case 'dictate-trace': startDictation(document.getElementById('session-trace-draft'), text => store.updateActiveSession({ traceDraft: text })); break;
      case 'dictate-dialog-trace': startDictation(document.getElementById('trace-dialog-text')); break;
      case 'flip-memory': flipMemoryCard(trigger); break;
      case 'memory-rate': reviewMemory(id, trigger.dataset.quality, trigger.dataset.memoryKey); break;
      case 'memory-card-color': store.saveSettings({ memoryCardColor:trigger.dataset.color }); render(); break;
      case 'session-card-color': store.saveSettings({ sessionCardColor:trigger.dataset.color }); render(); break;
      case 'quiz-card-color': store.saveSettings({ quizCardColor:trigger.dataset.color }); render(); break;
      case 'restart-memory': ui.memoryDeckSignature = ''; ui.memoryDeckKeys = []; ui.memoryCompletedKeys = []; ui.memorySessionComplete = false; ui.memoryCursor = 0; render(); break;
      case 'start-quiz': startLexiconQuiz(); break;
      case 'quiz-answer': answerLexiconQuiz(trigger.dataset.answer || ''); break;
      case 'next-quiz': nextLexiconQuizQuestion(); break;
      case 'restart-quiz': ui.quizSeed += 1; ui.quizStarted = false; ui.quizFinished = false; ui.quizQuestionIds = []; ui.quizIndex = 0; ui.quizScore = 0; render(); break;
      case 'show-day': showDayDetail(trigger.dataset.day); break;
      case 'show-week-detail': showWeekDetail(); break;
      case 'create-post': openPostDialog(); break;
      case 'encourage': await togglePostEncouragement(id); break;
      case 'toggle-comments': ui.openComments.has(id) ? ui.openComments.delete(id) : ui.openComments.add(id); render(); break;
      case 'comment-post': ui.openComments.add(id); render(); setTimeout(() => document.getElementById(`comment-${id}`)?.focus(), 30); break;
      case 'reply-comment': openReplyDialog(trigger.dataset.postId, id); break;
      case 'report-post': openReportDialog('publication', id); break;
      case 'report-user': openReportDialog('utilisateur', id); break;
      case 'block-user': confirmBlock(id); break;
      case 'unblock-user': store.unblockUser(id); showToast('Utilisateur débloqué'); render(); break;
      case 'friend': await updateFriendRelation(id, trigger.dataset.mode); break;
      case 'view-user': await openUserDialog(id); break;
      case 'create-club': openClubDialog(); break;
      case 'open-club': location.hash = `#club?id=${encodeURIComponent(id)}`; break;
      case 'toggle-club': await toggleClub(id, trigger.dataset.current === 'true'); break;
      case 'club-details': openClubDetails(id); break;
      case 'refresh-club': await refreshClubSpace(id, true); break;
      case 'club-encourage': await toggleClubSpaceEncouragement(trigger.dataset.clubId, id, trigger.dataset.current === 'true'); break;
      case 'club-book-read': await markClubBookRead(trigger.dataset.clubId, id); break;
      case 'approve-club-member': await approveClubMember(trigger.dataset.clubId, trigger.dataset.userId); break;
      case 'remove-club-member': await removeClubMember(trigger.dataset.clubId, trigger.dataset.userId); break;
      case 'toggle-salon': await toggleSalon(id, false); break;
      case 'leave-salon': await toggleSalon(id, true); break;
      case 'salon-thread': openSalonThread(id); break;
      case 'edit-salon': openSalonCreateDialog(store.getCommunity().salons.find(item => item.id === id)); break;
      case 'create-salon': openSalonCreateDialog(null, trigger.dataset.clubId || null); break;
      case 'select-book': selectLibraryBook(trigger, id); break;
      case 'open-book': closeDialog(); location.hash = `#book?id=${encodeURIComponent(id)}`; break;
      case 'add-book': openBookDialog(); break;
      case 'book-entry-mode': setBookEntryMode(trigger.dataset.mode, true); break;
      case 'library-filter': ui.libraryStatus = trigger.dataset.status; ui.selectedLibraryBookId = null; render(); break;
      case 'dismiss-dna-nudge': store.saveSettings({ dnaNudgeDismissed:true }); render(); break;
      case 'quick-progress': openQuickProgress(id); break;
      case 'resume-from-finish': closeDialog(); store.resumeActiveSession(); render(); break;
      case 'capture-memory': openMemoryCapture(trigger.dataset.bookId || null); break;
      case 'capture-kind': openMemoryKind(trigger.dataset.kind, trigger.dataset.bookId || null); break;
      case 'notebook-filter': ui.lexiconKind = trigger.dataset.kind; render(); break;
      case 'trail-mode': rememberTrailViewport(); ui.trailMode = trigger.dataset.mode; render(); break;
      case 'trail-immersive': rememberTrailViewport(); ui.trailImmersive = !ui.trailImmersive; render(); requestAnimationFrame(() => document.querySelector('[data-action="trail-immersive"]')?.focus()); break;
      case 'library-view': ui.selectedLibraryBookId = null; store.saveSettings({ libraryView: trigger.dataset.view }); render(); break;
      case 'library-finish': store.saveSettings({ libraryFinish:trigger.dataset.finish }); render(); break;
      case 'toggle-trail-book': rememberTrailViewport(); ui.expandedTrailBooks.has(id) ? ui.expandedTrailBooks.delete(id) : ui.expandedTrailBooks.add(id); render(); break;
      case 'trail-zoom-in': rememberTrailViewport(); setTrailZoom(ui.trailScale + .15); break;
      case 'trail-zoom-out': rememberTrailViewport(); setTrailZoom(ui.trailScale - .15); break;
      case 'trail-zoom-fit': setTrailZoom('fit'); break;
      case 'refresh-recommendations': await refreshRecommendations(); break;
      case 'wishlist-recommendation': addRecommendationToWishlist(id); break;
      case 'dismiss-recommendation': dismissRecommendation(id); break;
      case 'move-to-library': store.updateBook(id, { libraryState:'library' }); showToast('Livre ajouté à votre bibliothèque'); render(); break;
      case 'edit-book': openBookDialog(store.getBookById(id)); break;
      case 'delete-book': confirmDeleteBook(id); break;
      case 'scan-book-isbn': await scanBookISBN(trigger); break;
      case 'pick-book-result': pickBookResult(Number(trigger.dataset.index)); break;
      case 'manual-session': openManualSessionDialog(trigger.dataset.bookId || null); break;
      case 'edit-session': openManualSessionDialog(null, id); break;
      case 'delete-session': if (confirm('Supprimer définitivement cette session locale ?')) { store.deleteSession(id); closeDialog(); showToast('Session supprimée'); render(); } break;
      case 'add-lexicon': openLexiconDialog(null, trigger.dataset.bookId || null); break;
      case 'share-reading': BT.sharing.open(trigger.dataset.kind,id); break;
      case 'view-publication': BT.sharing.view(id); break;
      case 'edit-lexicon': openLexiconDialog(store.getLexicon().find(item => item.id === id)); break;
      case 'delete-lexicon': if (confirm('Supprimer cette entrée du lexique ?')) { store.deleteLexiconWord(id); showToast('Entrée supprimée'); render(); } break;
      case 'dictionary-lookup': await lookupDictionary(trigger); break;
      case 'dictionary-choice': chooseDictionaryDefinition(trigger); break;
      case 'lexicon-filter': ui.lexiconKind = trigger.dataset.kind || 'all'; render(); break;
      case 'edit-goal': openGoalDialog(trigger.dataset.period); break;
      case 'open-monthly-report': openMonthlyReportDialog(); break;
      case 'download-monthly-report': await downloadMonthlyReport(); break;
      case 'share-monthly-report': await shareMonthlyReport(); break;
      case 'edit-monthly-report': openMonthlyReportDialog(ui.monthlyReportData?.monthKey); break;
      case 'edit-profile': openProfileDialog(); break;
      case 'reader-preferences': BT.readerProfile.editPreferences(); break;
      case 'preview-reader': openUserDialog(BT.auth.getCurrentUser()?.id); break;
      case 'remove-profile-photo': removePendingProfilePhoto(); break;
      case 'open-dna-history': openReaderDNAHistory(); break;
      case 'open-badges': openBadgesDialog(); break;
      case 'toggle-theme': { const settings = store.getSettings(); settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; store.saveSettings(settings); applyTheme(); render(); break; }
      case 'select-rating': selectRating(trigger, Number(trigger.dataset.value)); break;
      case 'simulated-password': openChangePasswordDialog(); break;
      case 'export-data': exportData(); break;
      case 'sync-recover': await recoverSyncedVersion(); break;
      case 'export-recovery': exportRecoveryData(); break;
      case 'help': openHelpDialog(); break;
      case 'logout': if (isGuestMode()) { window.BT.auth.leaveGuestMode(); location.href = 'index.html?reason=guest-ended'; } else { await window.BT.auth.signOut(); location.href = 'index.html?reason=signed-out'; } break;
      case 'delete-account': openDeleteAccountDialog(); break;
    }
  }

  function updateSessionPageOutput(control, value) {
    const group = control.closest('.session-page-slider');
    group?.querySelectorAll('input').forEach(input => {
      if (input === control) return;
      if (input.type === 'range' && value > Number(input.max)) input.max = value;
      input.value = value;
    });
    const output = group?.querySelector('[data-session-page-output]');
    if (output) output.textContent = String(value);
  }

  function handleChange(event) {
    const control = event.target.closest('[data-change]'); if (!control) return;
    switch (control.dataset.change) {
      case 'active-book': if (control.value) { store.setActiveBook(control.value); showToast('Lecture affichée modifiée'); } render(); break;
      case 'focus-session': store.focusActiveSession(control.value); render(); break;
      case 'library-status': ui.selectedLibraryBookId = null; ui.libraryStatus = control.value; render(); break;
      case 'notebook-kind': updateNotebookComposer(control.closest('form')); break;
      case 'notebook-book': ui.notebookBook = control.value; if (ui.params.has('book')) location.hash = '#path?tab=' + ui.pathTab; else render(); break;
      case 'library-sort': ui.selectedLibraryBookId = null; store.saveSettings({ librarySort:control.value }); render(); break;
      case 'trail-year': ui.trailYear = control.value; ui.expandedTrailBooks.clear(); ui.trailViewCenter = null; render(); break;
      case 'trail-status': ui.trailStatus = control.value; ui.expandedTrailBooks.clear(); ui.trailViewCenter = null; render(); break;
      case 'goal-all-books':
        if (control.checked) control.closest('form')?.querySelectorAll('input[name="bookIds"]').forEach(input => { input.checked = false; });
        break;
      case 'goal-book': {
        const form = control.closest('form'), selected = form?.querySelectorAll('input[name="bookIds"]:checked').length || 0;
        const allBooks = form?.querySelector('input[name="allBooks"]'); if (allBooks) allBooks.checked = selected === 0;
        break;
      }
      case 'book-media':
        document.querySelector('[data-audio-fields]')?.toggleAttribute('hidden', control.value !== 'audio');
        document.querySelectorAll('[data-page-fields]').forEach(group => group.toggleAttribute('hidden', control.value === 'audio'));
        break;
      case 'notification-filter': ui.notificationFilter = control.value; renderNotifications(); break;
      case 'session-page': { const value = clamp(control.value, 0, control.max || 99999); control.value = value; updateSessionPageOutput(control, value); store.updateActiveSession({ endPage: value }); break; }
      case 'isbn-photo-file': void readISBNPhoto(control.files?.[0]); break;
      case 'post-photo': previewPostPhoto(control.files?.[0]); break;
      case 'profile-photo': previewProfilePhoto(control.files?.[0]); break;
      case 'salon-pages': void updateSalonSharing(control.dataset.id, control.checked); break;
    }
  }

  function handleInput(event) {
    const control = event.target;
    if (control.matches('.session-page-slider input')) {
      if (control.value === '') return;
      const value = Math.round(clamp(control.value, 0, control.max || 99999));
      updateSessionPageOutput(control, value);
      if (control.dataset.change === 'session-page' || control.closest('form[data-form="finish-session"]')) store.updateActiveSession({ endPage:value });
      return;
    }
    if (control.closest('form[data-form="finish-session"]') && control.name === 'traceText') store.updateActiveSession({ traceDraft:control.value });
    if (control.id === 'global-search') { ui.searchQuery = control.value; renderSearchResults(control.value); return; }
    const type = control.dataset.input; if (!type) return;
    if (type === 'session-citation') { store.updateActiveSession({ citationDraft: control.value }); return; }
    if (type === 'session-trace') { store.updateActiveSession({ traceDraft: control.value }); return; }
    if (type === 'friend-search') {
      ui.friendQuery = control.value; const position = control.selectionStart; render();
      const replacement = document.getElementById('friend-search'); replacement?.focus(); replacement?.setSelectionRange(position, position);
      clearTimeout(ui.friendSearchTimer); ui.friendSearchTimer = setTimeout(() => refreshReaders(ui.friendQuery), 280); return;
    }
    const mappings = { 'library-search':['libraryQuery','library-search'], 'lexicon-search':['lexiconQuery','lexicon-search'] };
    if (mappings[type]) {
      if (type === 'library-search') ui.selectedLibraryBookId = null;
      const [key,id] = mappings[type]; ui[key] = control.value; const position = control.selectionStart; render();
      const replacement = document.getElementById(id); replacement?.focus(); replacement?.setSelectionRange(position, position);
    }
  }

  async function handleSubmit(event) {
    const form = event.target.closest('form[data-form]'); if (!form) return;
    event.preventDefault(); if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form), kind = form.dataset.form;
    const handlers = {
      'quick-progress': submitQuickProgress, 'catalog-search': submitCatalogSearch, trace: submitTrace, 'manual-session': submitManualSession, 'isbn-lookup': submitISBNLookup, book: submitBook, lexicon: submitLexicon,
      goal: submitGoal, 'monthly-report':submitMonthlyReport, profile: submitProfile, 'finish-session': submitFinishSession,
      comment: submitComment, privacy: submitPrivacy, 'notification-settings': submitNotificationSettings,
      post: submitPost, club: submitClub, 'club-edit': submitClubEdit, 'club-member': submitClubMember,
      'club-post':submitClubPost, 'club-comment':submitClubComment, 'club-book':submitClubBook,
      'salon-message': submitSalonMessage, reply: submitReply, salon: submitSalon, 'salon-edit': submitSalonEdit,
      report: submitReport, help: submitHelp, 'change-password': submitChangePassword, 'delete-account': submitDeleteAccount
    };
    await handlers[kind]?.(form, data);
  }

  function startSession(bookId) {
    if (!bookId) return;
    store.startActiveSession(bookId);
    location.hash = '#session';
  }

  function saveSessionCitation() {
    const field = document.getElementById('session-citation-draft');
    const text = String(field?.value || '').trim();
    if (!text) { showToast('Écrivez une citation avant de l’ajouter'); field?.focus(); return; }
    const citation = store.addActiveSessionCitation(text);
    if (!citation) { showToast('La citation n’a pas pu être ajoutée'); return; }
    showToast('Citation ajoutée au lexique');
    render();
    window.setTimeout(() => document.getElementById('session-citation-draft')?.focus(), 30);
  }

  function flipMemoryCard(trigger) {
    const shell = trigger.closest('.memory-card-shell'); if (!shell) return;
    const flipped = !shell.classList.contains('is-flipped');
    shell.classList.toggle('is-flipped', flipped);
    trigger.setAttribute('aria-pressed', String(flipped));
    trigger.setAttribute('aria-label', flipped ? 'Masquer la réponse et revenir à la devinette' : trigger.dataset.frontLabel);
    trigger.querySelector('.memory-flip-card__front')?.setAttribute('aria-hidden', String(flipped));
    trigger.querySelector('.memory-flip-card__back')?.setAttribute('aria-hidden', String(!flipped));
    const actions = shell.querySelector('.memory-review-actions'); if (actions) actions.hidden = !flipped;
    document.getElementById('live-region').textContent = flipped ? 'Réponse révélée. Indiquez maintenant votre niveau de rappel.' : 'Devinette affichée.';
  }

  function reviewMemory(id, quality, memoryKey) {
    const normalizedQuality = ['retry','almost','recalled'].includes(quality) ? quality : 'recalled';
    if (id && !store.reviewLexiconWord(id, normalizedQuality)) return;
    const index = ui.memoryDeckKeys.indexOf(memoryKey);
    if (index >= 0) {
      const [key] = ui.memoryDeckKeys.splice(index, 1);
      if (normalizedQuality === 'retry') ui.memoryDeckKeys.splice(Math.min(index + 2, ui.memoryDeckKeys.length), 0, key);
      else {
        if (!ui.memoryCompletedKeys.includes(key)) ui.memoryCompletedKeys.push(key);
        if (normalizedQuality === 'recalled') {
          const queued = new Set([...ui.memoryDeckKeys, ...ui.memoryCompletedKeys]);
          const next = getMemoryItems().find(item => !queued.has(item.memoryKey));
          if (next) { ui.memoryDeckKeys.push(next.memoryKey); ui.memorySessionTotal += 1; }
        }
      }
    }
    ui.memoryCursor = Math.max(0, Math.min(index < 0 ? ui.memoryCursor : index, ui.memoryDeckKeys.length - 1));
    ui.memorySessionComplete = ui.memoryDeckKeys.length === 0;
    const messages = {
      retry:'La carte reviendra après deux autres cartes, puis demain.',
      almost:'Presque · prochain rappel prévu sous trois jours.',
      recalled:'Retrouvé · le prochain rappel sera davantage espacé.'
    };
    const exampleMessages = {
      retry:'Cette carte d’entraînement reviendra après deux autres cartes.',
      almost:'Presque · cette carte d’entraînement est terminée pour cette séance.',
      recalled:'Retrouvé · cette carte d’entraînement est terminée pour cette séance.'
    };
    showToast(id ? messages[normalizedQuality] : exampleMessages[normalizedQuality]);
    render();
  }

  function startLexiconQuiz() {
    const candidates = getQuizCandidates();
    const selected = [];
    const ranked = (items, salt) => items.slice().sort((a,b) => Number(Boolean(b.entryId)) - Number(Boolean(a.entryId)) || recommendationHash(`${ui.quizSeed}:${salt}:${a.id}`) - recommendationHash(`${ui.quizSeed}:${salt}:${b.id}`));
    const addQuestions = (items, count, salt) => ranked(items, salt).forEach(question => { if (count > 0 && !selected.some(item => item.id === question.id)) { selected.push(question); count -= 1; } });
    addQuestions(candidates.filter(item => item.kind === 'Expression en situation'), 3, 'sens');
    addQuestions(candidates.filter(item => ['Citation et livre','Expression et livre','Retrouver l’auteur'].includes(item.kind)), 1, 'source');
    addQuestions(candidates.filter(item => item.kind === 'Suite de citation'), 1, 'suite');
    addQuestions(candidates, Math.max(0, 5 - selected.length), 'complement');
    ui.quizQuestionIds = selected.map(item => item.id);
    ui.quizStarted = true;
    ui.quizFinished = false;
    ui.quizIndex = 0;
    ui.quizScore = 0;
    ui.quizAnswered = false;
    ui.quizSelected = '';
    render();
  }

  function answerLexiconQuiz(answer) {
    if (ui.quizAnswered) return;
    const { questions } = getQuizDeck(), question = questions[ui.quizIndex];
    if (!question) return;
    const correct = answer === question.correct;
    ui.quizSelected = answer;
    ui.quizAnswered = true;
    if (correct) ui.quizScore += 1;
    if (question.entryId) store.reviewLexiconWord(question.entryId, correct ? 'recalled' : 'retry');
    render();
  }

  function nextLexiconQuizQuestion() {
    const { questions } = getQuizDeck();
    if (ui.quizIndex + 1 >= questions.length) ui.quizFinished = true;
    else ui.quizIndex += 1;
    ui.quizAnswered = false;
    ui.quizSelected = '';
    render();
  }
  function showDayDetail(key) {
    const day = store.getGoalProgress().week.days.find(item => item.key === key);
    openDialog({ title: `Lecture du ${formatDate(key)}`, eyebrow:'Détail quotidien', body:`<div class="goal-card"><p class="goal-card__value">${day.minutes} min</p><p>Objectif quotidien : ${day.target} minutes.</p><div class="progress-track"><span style="--width:${pct(day.minutes,day.target)}%"></span></div><p class="small muted">${day.reached ? 'Objectif atteint, sans comparaison avec les autres lecteurs.' : `${Math.max(0,day.target-day.minutes)} minutes restantes.`}</p></div>` });
  }
  function showWeekDetail() {
    const week = store.getGoalProgress().week;
    openDialog({ title:'Détail de la semaine', eyebrow:'Lundi à dimanche', body:`<div class="history-list">${week.days.map(day => `<div class="history-item"><span class="history-item__icon">${day.label}</span><div class="history-item__content"><strong>${day.minutes} / ${day.target} min</strong><span class="small muted">${formatDate(day.key)} · ${day.reached ? 'objectif atteint' : 'en progression'}</span></div></div>`).join('')}</div>` });
  }

  function startDictation(target, onUpdate = null) {
    if (!target) return;
    if (!window.BT.speech?.isSupported?.()) { showToast('Dictée indisponible dans ce navigateur. Saisissez la Trace au clavier.'); return; }
    const initial = target.value.trim();
    window.BT.speech.onResult(result => { const text = `${initial}${initial && (result.final || result.interim) ? ' ' : ''}${result.final}${result.interim}`; target.value = text; onUpdate?.(text); });
    window.BT.speech.onEnd(() => showToast('Dictée terminée, le texte reste modifiable'));
    if (window.BT.speech.start()) showToast('Dictée en cours…');
  }

  function friendToast(mode) { return ({ send:'Demande envoyée localement', cancel:'Demande annulée', accept:'Demande acceptée', refuse:'Demande refusée', remove:'Ami retiré' })[mode] || 'Relation mise à jour'; }

  let communityRequest=0;
  async function refreshCommunity({ quiet = false } = {}) {
    if (!window.BT.community) return;
    const request=++communityRequest, account=window.BT.auth?.getCurrentUser?.()?.id, guest=isGuestMode();
    const current=()=>request===communityRequest && account===window.BT.auth?.getCurrentUser?.()?.id && guest===isGuestMode();
    try {
      if (isGuestMode()) {
        const posts = await window.BT.community.listPosts();
        if(!current())return;
        store.mergeRemotePosts(posts);
        ui.communityLoaded = true;
        if (ui.route === 'community') render();
        return;
      }
      const [posts, clubs] = await Promise.all([
        window.BT.community.listPosts(),
        window.BT.community.listClubs()
      ]);
      const salons = await window.BT.community.listSalons(clubs);
      if(!current())return;
      store.mergeRemotePosts(posts);
      store.replaceRemoteClubs(clubs);
      store.replaceRemoteSalons(salons);
      ui.communityLoaded = true;
      if (ui.route === 'community') render();
    } catch (error) {
      if(!current())return;
      store.mergeRemotePosts([]);
      if(ui.route==='community')render();
      if (!quiet) showToast(error.message || 'Le fil partagé ne peut pas être actualisé');
    }
  }

  async function refreshReaders(query = ui.friendQuery, { quiet = false } = {}) {
    if (!window.BT.community?.searchReaders) return;
    ui.friendSearchBusy = true;
    if (ui.route === 'community' && ui.communityTab === 'friends') render();
    try {
      const users = await window.BT.community.searchReaders(query);
      ui.friendResults = users;
      store.mergeRemoteUsers(users);
    } catch (error) { if (!quiet) showToast(error.message || 'La recherche de lecteurs ne répond pas'); }
    finally { ui.friendSearchBusy = false; if (ui.route === 'community' && ui.communityTab === 'friends') render(); }
  }

  function notificationPreferenceKey(type) {
    return ({ friend:'friends', trace:'traces', encouragement:'encouragements', club:'clubs', salon:'salons', goal:'goals' })[type] || null;
  }

  async function refreshNotifications({ quiet = false } = {}) {
    if (isGuestMode() || !window.BT.notifications || !window.BT.auth?.isAuthenticated?.()) return;
    try {
      const preferences = store.getSettings().notifications;
      const notifications = (await window.BT.notifications.list()).filter(item => {
        const key = notificationPreferenceKey(item.type);
        return !key || preferences[key] !== false;
      });
      store.replaceNotifications(notifications);
      updateHeader();
      if (document.getElementById('notifications-dialog')?.open) renderNotifications();
    } catch (error) {
      if (!quiet) showToast(error.message || 'Les notifications ne peuvent pas être actualisées');
    }
  }

  function startNotificationSubscription() {
    if (isGuestMode() || !window.BT.notifications || !window.BT.auth?.isAuthenticated?.()) return;
    try {
      ui.notificationUnsubscribe = window.BT.notifications.subscribe(payload => {
        refreshNotifications({ quiet:true });
        if (payload?.eventType === 'INSERT') {
          const title = payload.new?.title || 'Nouvelle notification BOO-P';
          document.getElementById('live-region').textContent = title;
          if (document.visibilityState === 'visible') showToast(title);
        }
      });
    } catch (error) {
      console.warn('BOO-P realtime notifications unavailable', error);
    }
  }

  async function markNotificationRead(id) {
    store.markNotification(id);
    renderNotifications(); updateHeader();
    if (isGuestMode()) return;
    try { await window.BT.notifications?.markRead?.(id); }
    catch (error) { await refreshNotifications({ quiet:true }); showToast(error.message || 'Lecture non synchronisée'); }
  }

  async function markAllNotificationsRead() {
    store.markAllNotifications();
    renderNotifications(); updateHeader();
    if (isGuestMode()) { showToast('Toutes les notifications locales sont lues'); return; }
    try { await window.BT.notifications?.markAllRead?.(); showToast('Toutes les notifications sont lues'); }
    catch (error) { await refreshNotifications({ quiet:true }); showToast(error.message || 'Lecture non synchronisée'); }
  }

  async function updateFriendRelation(userId, mode) {
    const user = store.getCommunity().users.find(item => item.id === userId);
    if (!user) return;
    if (isGuestMode() || !user.isRemote) { store.updateFriend(userId, mode); showToast(`${friendToast(mode)} · conservé sur cet appareil`); render(); return; }
    try {
      const reopen=Boolean(document.querySelector('#app-dialog[open] [data-reader-sharing]'));
      await window.BT.community.updateFriend(userId, mode);
      if(reopen)closeDialog();
      store.updateFriend(userId, mode);
      await refreshReaders(ui.friendQuery, { quiet:true });
      await refreshCommunity({quiet:true});
      if(reopen)openUserDialog(userId);
      showToast(friendToast(mode).replace(' localement',''));
    } catch (error) { showToast(error.message || 'La demande d’amitié ne peut pas être mise à jour'); }
  }

  async function togglePostEncouragement(id) {
    const post = store.getCommunity().posts.find(item => item.id === id);
    if (!post) return;
    if (isGuestMode() || !post.isRemote) {
      store.toggleEncouragement(id); showToast(post.encouraged ? 'Encouragement retiré' : 'Encouragement conservé sur cet appareil'); render(); return;
    }
    try {
      await window.BT.community.toggleEncouragement(post.remoteId || post.id, post.encouraged);
      await refreshCommunity({ quiet:true });
      showToast(post.encouraged ? 'Encouragement retiré' : 'Encouragement envoyé');
    } catch (error) { showToast(error.message || 'Encouragement non enregistré'); }
  }

  async function refreshRecommendations() {
    if (ui.recommendationsBusy) return;
    ui.recommendationsBusy = true; render();
    const profile = recommendationProfile();
    const searches = [
      profile.topAuthors[0] ? { query:`inauthor:"${profile.topAuthors[0]}"`, kind:'author', value:profile.topAuthors[0] } : null,
      profile.topGenres[0] ? { query:`subject:"${profile.topGenres[0]}"`, kind:'genre', value:profile.topGenres[0] } : null,
      profile.topAuthors[1] ? { query:`inauthor:"${profile.topAuthors[1]}"`, kind:'author', value:profile.topAuthors[1] } : null
    ].filter(Boolean).slice(0, 2);
    try {
      const activeSearches = searches.length ? searches : [{ query:'subject:"Romans"', kind:'genre', value:'Romans' }];
      const outcomes = await Promise.allSettled(activeSearches.map(search => window.BT.bookLookup.searchBooks(search.query)));
      const owned = new Set(store.getBooks().map(book => normalize(book.title))), seen = new Set();
      ui.catalogRecommendations = outcomes.flatMap((outcome,index) => outcome.status === 'fulfilled' ? outcome.value.map(book => ({ book, search:activeSearches[index] })) : []).filter(({ book, search }) => {
        const key = normalize(`${book.title}|${book.authors?.[0] || ''}`);
        const target = normalize(search.value);
        const matches = search.kind === 'author'
          ? (book.authors || []).some(author => normalize(author).includes(target) || target.includes(normalize(author)))
          : [book.genre, ...(book.genres || [])].some(genre => normalize(genre).includes(target) || target.includes(normalize(genre)));
        if (!matches || !book.title || owned.has(normalize(book.title)) || seen.has(key)) return false;
        seen.add(key); return true;
      }).slice(0, 12).map(({ book, search }) => ({
        ...book,
        id:`catalog-${book.isbn || book.sourceId || recommendationHash(`${book.title}${book.authors?.[0] || ''}`)}`,
        status:'a-lire', coverColor:book.coverColor || gradientFor(book.title), catalogResult:true,
        reason:search.kind === 'author' ? `Une autre piste autour de ${search.value}, déjà présent dans votre bibliothèque.` : `Proposé parce que votre bibliothèque explore souvent ${search.value}.`
      }));
      const settings = store.getSettings();
      store.saveSettings({ recommendationRefreshSeed:(Number(settings.recommendationRefreshSeed) || 0) + 1 });
      showToast(ui.catalogRecommendations.length ? 'Suggestions actualisées à partir de votre bibliothèque' : 'Sélection locale réorganisée selon votre bibliothèque');
    } catch (error) { showToast(error.message || 'Les catalogues ne répondent pas ; la sélection locale reste disponible'); }
    finally { ui.recommendationsBusy = false; render(); }
  }

  function addRecommendationToWishlist(id) {
    const suggestion = [...ui.currentRecommendations, ...ui.catalogRecommendations, ...RECOMMENDATIONS].find(item => item.id === id);
    if (!suggestion) return;
    if (store.getBooks().some(book => normalize(book.title) === normalize(suggestion.title))) { showToast('Ce livre est déjà enregistré dans BOO-P'); return; }
    const book = store.addBook({ ...suggestion, id:undefined, libraryState:'wishlist', situation:'possede', currentPage:0, description:suggestion.reason });
    showToast(`« ${book.title} » ajouté à votre wishlist · nouvelle suggestion affichée`); render();
  }

  function dismissRecommendation(id) {
    const settings = store.getSettings();
    settings.dismissedRecommendationIds = [...new Set([...(settings.dismissedRecommendationIds || []), id])];
    settings.recommendationRefreshSeed = (Number(settings.recommendationRefreshSeed) || 0) + 1;
    store.saveSettings(settings); showToast('Suggestion écartée · une nouvelle proposition est affichée'); render();
  }

  async function previewProfilePhoto(file) {
    const preview = document.getElementById('profile-photo-preview');
    const help = document.getElementById('profile-photo-help');
    const removeButton = document.getElementById('remove-profile-photo');
    if (!preview || !help || !file) return;
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(String(file.type || '').toLowerCase()) || ['jpg','jpeg','png','webp','heic','heif'].includes(extension);
    if (!allowed || file.size > 15 * 1024 * 1024) {
      showToast(allowed ? 'Cette photo dépasse 15 Mo' : 'Choisissez une photo JPEG, PNG, WebP ou HEIC');
      document.getElementById('profile-photo-file').value = '';
      return;
    }
    const owner=BT.auth.getCurrentUser()?.id;
    let cropped;
    try { cropped=await BT.avatarCrop.open(file); }
    catch(error){showToast(error.message || 'Cette photo ne peut pas être lue. Essayez une image JPEG ou PNG.');}
    const input=document.getElementById('profile-photo-file');if(input)input.value='';
    if(!cropped || !preview.isConnected || owner!==BT.auth.getCurrentUser()?.id)return;
    if (ui.pendingProfilePhotoUrl) URL.revokeObjectURL(ui.pendingProfilePhotoUrl);
    ui.pendingProfilePhotoUrl = URL.createObjectURL(cropped);
    ui.pendingProfilePhotoFile = cropped;
    ui.removeProfilePhoto = false;
    preview.innerHTML = avatarInner({ name:store.getProfile().name, avatarUrl:ui.pendingProfilePhotoUrl });
    help.textContent = 'Cadrage choisi. Enregistrez le profil pour conserver cette photo.';
    removeButton.hidden = false;
  }

  function removePendingProfilePhoto() {
    if (ui.pendingProfilePhotoUrl) URL.revokeObjectURL(ui.pendingProfilePhotoUrl);
    ui.pendingProfilePhotoUrl = '';
    ui.pendingProfilePhotoFile = null;
    ui.removeProfilePhoto = true;
    const profile = store.getProfile();
    const preview = document.getElementById('profile-photo-preview');
    if (preview) preview.innerHTML = avatarInner({ name:profile.name });
    const input = document.getElementById('profile-photo-file');
    if (input) input.value = '';
    const button = document.getElementById('remove-profile-photo');
    if (button) button.hidden = true;
    const help = document.getElementById('profile-photo-help');
    if (help) help.textContent = 'La photo actuelle sera retirée après l’enregistrement.';
  }

  function previewPostPhoto(file) {
    const preview = document.getElementById('post-photo-preview'), help = document.getElementById('post-photo-help');
    if (!preview || !help) return;
    if (ui.pendingPostPhotoUrl) URL.revokeObjectURL(ui.pendingPostPhotoUrl);
    ui.pendingPostPhotoUrl = '';
    if (!file) { preview.hidden = true; preview.removeAttribute('src'); help.textContent = 'Facultatif · la photo sera redimensionnée et compressée avant envoi.'; return; }
    ui.pendingPostPhotoUrl = URL.createObjectURL(file); preview.src = ui.pendingPostPhotoUrl; preview.hidden = false;
    help.textContent = `${file.name} · compression automatique avant l’envoi.`;
  }

  async function localPhotoData(file) {
    let blob = file;
    try {
      const source = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(source.width, source.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
      source.close?.();
      blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Photo illisible')), 'image/jpeg', .7));
    } catch {
      blob = await window.BT.community.compressPhoto(file);
    }
    if (blob.size > 1500000) throw new Error('Cette photo reste trop lourde pour le mode invité. Choisissez une image plus légère.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('La photo ne peut pas être conservée sur cet appareil.'));
      reader.readAsDataURL(blob);
    });
  }

  function checkCelebrations() {
    const progress = store.getGoalProgress();
    ['week','month','year'].forEach(period => {
      if (progress[period].value >= progress[period].target && !store.isGoalCelebrated(period)) {
        store.markGoalCelebrated(period);
        setTimeout(() => showToast(`Objectif ${period === 'week' ? 'de la semaine' : period === 'month' ? 'du mois' : 'de l’année'} atteint — votre chemin avance.`), 150);
      }
    });
  }

  function setBookAnalysisStatus(message, progress = null, isError = false) {
    const status = document.getElementById('book-analysis-status');
    const label = document.getElementById('book-analysis-message');
    const meter = document.getElementById('book-analysis-progress');
    if (!status || !label || !meter) return;
    label.textContent = message;
    status.classList.toggle('is-error', isError);
    if (progress === null) { meter.hidden = true; meter.value = 0; }
    else { meter.hidden = false; meter.value = clamp(progress, 0, 1); }
  }

  function setISBNPhotoPreview(source) {
    const preview = document.getElementById('book-isbn-photo-preview');
    if (!preview) return;
    if (!source) { preview.hidden = true; preview.removeAttribute('src'); return; }
    preview.src = source;
    preview.hidden = false;
  }

  async function cropISBNAnalysisBlob(blob) {
    if (!blob || typeof createImageBitmap !== 'function') return blob;
    const bitmap = await createImageBitmap(blob);
    try {
      const ratio = 1.8;
      let sourceWidth = bitmap.width, sourceHeight = bitmap.height, sourceX = 0, sourceY = 0;
      if (sourceWidth / sourceHeight > ratio) {
        sourceWidth = Math.round(sourceHeight * ratio);
        sourceX = Math.round((bitmap.width - sourceWidth) / 2);
      } else {
        sourceHeight = Math.round(sourceWidth / ratio);
        sourceY = Math.round((bitmap.height - sourceHeight) / 2);
      }
      const scale = Math.min(1, 1600 / sourceWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d', { alpha:false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      return await new Promise(resolve => canvas.toBlob(result => resolve(result || blob), 'image/jpeg', .92));
    } catch { return blob; }
    finally { bitmap.close?.(); }
  }

  async function readISBNPhoto(file) {
    if (!file) return;
    const scanButton = document.getElementById('scan-book-isbn');
    if (scanButton) scanButton.disabled = true;
    setBookAnalysisStatus('Préparation de la photo du code-barres…', 0.05);
    try {
      const prepared = await window.BT.bookLookup.prepareCover(file, update => setBookAnalysisStatus(update.message, update.progress));
      ui.pendingISBNPhoto = prepared.dataUrl;
      ui.pendingISBNPhotoFile = await cropISBNAnalysisBlob(prepared.analysisBlob || file);
      setISBNPhotoPreview(prepared.dataUrl);
      document.getElementById('book-isbn-photo-prompt')?.classList.add('has-preview');
      setBookAnalysisStatus('Photo prête. Lancez maintenant la lecture du code ISBN.', null);
      if (scanButton) scanButton.disabled = false;
      showToast('Photo prête — elle ne sera pas enregistrée comme couverture');
    } catch (error) {
      ui.pendingISBNPhoto = '';
      ui.pendingISBNPhotoFile = null;
      setBookAnalysisStatus(error.message || 'Impossible de préparer cette image.', null, true);
      showToast(error.message || 'Import de l’image impossible');
    }
  }

  async function scanBookISBN(button) {
    if (!ui.pendingISBNPhotoFile) { setBookAnalysisStatus('Photographiez d’abord le code-barres ISBN.', null, true); return; }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    ui.bookSuggestions = [];
    const resultsContainer = document.getElementById('book-lookup-results');
    if (resultsContainer) resultsContainer.innerHTML = '<div class="book-lookup-empty section-block"><strong>Lecture du code ISBN…</strong><p class="small muted">Gardez cette fenêtre ouverte pendant l’analyse locale de la photo.</p></div>';
    try {
      const analysis = await window.BT.bookLookup.scanISBNFromImage(ui.pendingISBNPhotoFile, update => setBookAnalysisStatus(update.message, update.progress));
      const lookupField = document.getElementById('book-isbn-lookup');
      if (lookupField) lookupField.value = analysis.isbn;
      renderBookLookupResults(analysis.results, '', analysis.isbn);
      const method = analysis.method === 'barcode' ? 'Code-barres reconnu' : 'ISBN lu sur la photo';
      setBookAnalysisStatus(analysis.results.length ? `${method} — choisissez la bonne édition ci-dessous.` : `${method}, mais aucune édition n’a été trouvée. Complétez les champs manuellement.`, analysis.results.length ? 1 : null, !analysis.results.length);
    } catch (error) {
      renderBookLookupResults([], error.message);
      setBookAnalysisStatus(error.message || 'Le code ISBN n’a pas pu être lu.', null, true);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  async function submitISBNLookup(form, data) {
    const button = form.querySelector('button[type="submit"]');
    const isbn = window.BT.bookLookup.normalizeISBN(data.get('isbn'));
    const request = ++ui.catalogRequest;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setBookAnalysisStatus(`Recherche de l’ISBN ${isbn}…`, 0.45);
    try {
      const results = await window.BT.bookLookup.lookupISBN(isbn);
      if (!form.isConnected || request !== ui.catalogRequest) return;
      renderBookLookupResults(results, '', isbn);
      const sources = [...new Set(results.map(item => item.source).filter(Boolean))].join(' et ');
      setBookAnalysisStatus(results.length ? `ISBN trouvé${sources ? ` via ${sources}` : ''} — choisissez la bonne édition.` : 'Aucune édition trouvée après plusieurs tentatives automatiques. Vérifiez l’ISBN ou complétez les informations ci-dessous.', results.length ? 1 : null, !results.length);
    } catch (error) {
      if (!form.isConnected || request !== ui.catalogRequest) return;
      renderBookLookupResults([], error.message, isbn);
      setBookAnalysisStatus(error.message || 'Recherche ISBN impossible.', null, true);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function pickBookResult(index) {
    const item = ui.bookSuggestions[index]; if (!item) return;
    const values = {
      'book-title-field': item.title,
      'book-authors-field': (item.authors || []).join(', '),
      'book-genre-field': item.genre || '',
      'book-isbn-field': item.isbn || '',
      'book-published-field': item.publishedDate || '',
      'book-publisher-field': item.publisher || '',
      'book-edition-field': item.edition || '',
      'book-format-field': item.format || 'Livre',
      'book-pages-field': item.totalPages || '',
      'book-description-field': item.description || ''
    };
    Object.entries(values).forEach(([id, value]) => { const field = document.getElementById(id); if (field) field.value = value; });
    const lookupField = document.getElementById('book-isbn-lookup');
    if (lookupField && item.isbn) lookupField.value = item.isbn;
    if (ui.pendingCoverKind !== 'custom' && item.coverUrl) {
      ui.pendingCover = item.coverUrl;
      ui.pendingCoverKind = 'catalogue';
      const coverField = document.getElementById('book-cover-value');
      const sourceField = document.getElementById('book-cover-source');
      if (coverField) coverField.value = item.coverUrl;
      if (sourceField) sourceField.value = 'catalogue';
    }
    setBookEntryMode('manual');
    const preview = document.getElementById('book-selection-preview');
    if (preview) { preview.hidden = false; preview.className = 'book-selection-preview'; preview.innerHTML = `${cover({ ...item, coverColor:gradientFor(item.title) },'small')}<div><strong>${esc(item.title)}</strong><p class="small muted">${esc(item.publisher || '')}${item.publishedDate ? ` · ${esc(item.publishedDate)}` : ''}${item.isbn ? `<br>ISBN ${esc(item.isbn)}` : ''}</p></div>`; }
    showToast('Édition sélectionnée — vérifiez ou corrigez les informations');
    document.getElementById('book-title-field')?.focus();
  }

  function selectRating(trigger, value) {
    const targetId = trigger.dataset.target || 'finish-rating';
    const target = document.getElementById(targetId); if (!target) return;
    target.value = value;
    trigger.closest('.book-rating-field')?.querySelectorAll('.rating-button').forEach(button => {
      button.classList.toggle('is-filled', Number(button.dataset.value) <= value);
      button.setAttribute('aria-pressed', String(Number(button.dataset.value) === value));
    });
    const descriptions = ['Cette lecture m’a laissé indifférent.','Elle a éveillé ma curiosité.','Elle m’a touché.','Elle m’a profondément marqué.','Elle m’a transformé.'];
    const description = document.getElementById(`${targetId}-description`);
    if (description) description.textContent = `${value} étoile${value > 1 ? 's' : ''} sur 5 · ${descriptions[value-1]}`;
  }

  function submitTrace(form, data) {
    const bookId = data.get('bookIdSelect') || data.get('bookId');
    store.saveTrace({ bookId, page: Number(data.get('page')) || 0, text: data.get('text'), privacy: 'private' });
    if (form.dataset.draftKey) store.clearDraft(form.dataset.draftKey);
    closeDialog(); showToast('Pensée enregistrée dans votre carnet privé'); render();
  }

  function submitManualSession(form, data) {
    const book = store.getBookById(data.get('bookId')); if (!book) return;
    let duration = Math.max(1, Number(data.get('duration')) || 1);
    const startTime = data.get('startTime'), endTime = data.get('endTime');
    if (startTime && endTime) {
      const start = new Date(`${data.get('date')}T${startTime}:00`), end = new Date(`${data.get('date')}T${endTime}:00`);
      if (end > start) duration = Math.round((end - start) / 60000);
    }
    const positionMax = book.mediaType === 'audio' ? book.durationMinutes : book.totalPages;
    const startPage = clamp(data.get('startPage'), 0, positionMax || 99999), endPage = clamp(data.get('endPage'), 0, positionMax || 99999);
    const record = { id: data.get('sessionId') || undefined, bookId: book.id, startedAt: new Date(`${data.get('date')}T${startTime || '12:00'}:00`).toISOString(), durationSeconds: duration * 60, startPage, endPage, note: data.get('note'), manual: true };
    data.get('sessionId') ? store.updateSession(data.get('sessionId'), record) : store.saveSession(record);
    closeDialog(); showToast(data.get('sessionId') ? 'Session mise à jour' : 'Session passée ajoutée'); render();
  }

  function gradientFor(text) {
    let hash = 0; for (const char of String(text)) hash = char.charCodeAt(0) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360; return `linear-gradient(145deg,hsl(${hue} 38% 25%),hsl(${(hue+42)%360} 48% 48%))`;
  }

  function submitBook(form, data) {
    const id = data.get('id'), totalPages = Math.max(0, Number(data.get('totalPages')) || 0), currentPage = clamp(data.get('currentPage'), 0, totalPages || 99999);
    const durationMinutes = Math.max(0, Number(data.get('durationMinutes')) || 0), currentMinute = clamp(data.get('currentMinute'), 0, durationMinutes || 99999);
    const rawISBN = String(data.get('isbn') || '').trim();
    const isbn = window.BT.bookLookup.normalizeISBN(rawISBN);
    if (rawISBN && !window.BT.bookLookup.isValidISBN(isbn)) {
      showToast('Vérifiez l’ISBN : le numéro saisi n’est pas valide.');
      document.getElementById('book-isbn-field')?.focus();
      return;
    }
    const duplicate = !id && store.getBooks().find(book => book.mediaType === data.get('mediaType') && (
      (isbn && window.BT.bookLookup.isbnVariants(isbn).includes(window.BT.bookLookup.normalizeISBN(book.isbn))) ||
      (normalize(book.title) === normalize(data.get('title')) && normalize(book.authors.join(', ')) === normalize(data.get('authors')))
    ));
    if (duplicate && !(data.get('allowDuplicate') === 'on' && form.dataset.duplicateId === duplicate.id)) {
      form.querySelector('.duplicate-notice')?.remove();
      const notice = document.createElement('div'); notice.className = 'duplicate-notice'; notice.setAttribute('role','alert');
      notice.innerHTML = `<strong>Ce livre est déjà dans votre collection.</strong><button class="text-link" type="button" data-action="open-book" data-id="${attr(duplicate.id)}">Ouvrir ${esc(duplicate.title)}</button><label class="checkbox-row"><input type="checkbox" name="allowDuplicate"> Ajouter tout de même cet exemplaire ou cette édition</label>`;
      form.dataset.duplicateId = duplicate.id;
      form.querySelector('button[type="submit"]').before(notice); notice.scrollIntoView({block:'center'}); return;
    }
    const mediaType = data.get('mediaType');
    const genre = String(data.get('genre') || '').trim();
    const status = data.get('status'), historicalBeforeJoin = data.get('historicalBeforeJoin') === 'on';
    const startedDate = String(data.get('startedAt') || ''), completedDate = String(data.get('completedAt') || '');
    if (startedDate && completedDate && completedDate < startedDate) {
      showToast('La date de fin de lecture doit être postérieure à la date de début.');
      form.elements.completedAt?.focus();
      return;
    }
    const rawRating = Number(data.get('rating'));
    const record = { title: data.get('title').trim(), authors: data.get('authors').split(',').map(item => item.trim()).filter(Boolean), genre, genres:genre ? [genre] : [], isbn, publishedDate: data.get('publishedDate').trim(), publisher: data.get('publisher').trim(), edition: data.get('edition').trim(), format: mediaType === 'audio' ? '' : data.get('format').trim(), mediaType, durationMinutes, currentMinute, narrator:data.get('narrator')?.trim() || '', audioPlatform:data.get('audioPlatform')?.trim() || '', libraryState:data.get('libraryState'), totalPages:mediaType === 'audio' ? 0 : totalPages, currentPage:mediaType === 'audio' ? 0 : currentPage, description: data.get('description').trim(), status: data.get('status'), situation: data.get('situation'), historicalBeforeJoin: data.get('historicalBeforeJoin') === 'on', coverUrl: data.get('coverUrl') || '', coverColor: gradientFor(`${data.get('title')}${data.get('authors')}`), customCover: data.get('coverSource') === 'custom' };
    Object.assign(record, {
      status,
      historicalBeforeJoin,
      startedAt: readingDateISO(startedDate),
      completedAt: status === 'lu' ? readingDateISO(completedDate) : null,
      rating: Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : null
    });
    const book = id ? store.updateBook(id, record) : store.addBook(record);
    if (!id && book.status === 'en-cours') store.setActiveBook(book.id);
    ui.pendingCover = ''; ui.pendingCoverKind = ''; ui.pendingISBNPhoto = ''; ui.pendingISBNPhotoFile = null; closeDialog(); showToast(id ? 'Livre mis à jour' : `Livre ajouté à ${book.libraryState === 'wishlist' ? 'la wishlist' : 'la bibliothèque'}`); location.hash = `#book?id=${encodeURIComponent(book.id)}`; render();
  }

  function submitLexicon(form, data) {
    const id = data.get('id');
    store.addLexiconWord({ id: id || undefined, kind:data.get('kind'), word: data.get('word'), definition: data.get('definition') || (data.get('kind') === 'citation' ? data.get('word') : ''), sourceLabel:data.get('sourceLabel'), sourceUrl:data.get('sourceUrl'), bookId: data.get('bookId') || null, author: data.get('author'), page: data.get('page'), note: data.get('note') });
    if (form.dataset.draftKey) store.clearDraft(form.dataset.draftKey);
    closeDialog(); showToast(id ? 'Souvenir mis à jour' : 'Souvenir ajouté à votre carnet'); render();
  }

  function submitGoal(form, data) {
    const period = form.dataset.period, selectedBookIds = data.getAll('bookIds');
    const updates = {};
    if (period === 'week') { updates.dailyMinutes = clamp(data.get('dailyMinutes'), 5, 240); updates.daysTarget = clamp(data.get('daysTarget'), 1, 7); }
    else {
      updates.targetBooks = clamp(data.get('targetBooks'), 1, period === 'year' ? 500 : 100);
      updates.bookIds = period === 'year' ? [] : (data.get('allBooks') === 'on' && !selectedBookIds.length ? [] : selectedBookIds);
    }
    store.updateGoal(period, updates); closeDialog(); showToast('Objectif modifié · progression recalculée'); render();
  }

  async function submitProfile(form, data) {
    const submitButton = form.querySelector('[type="submit"]');
    const originalLabel = submitButton?.textContent || 'Enregistrer';
    const fields = {
      name:data.get('name').trim(), handle:data.get('handle').trim(), title:data.get('title').trim(),
      bio:data.get('bio').trim(), interests:data.get('interests').split(',').map(item => item.trim()).filter(Boolean).slice(0,12)
    };
    store.saveProfile(fields);
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Préparation…'; }
    try {
      if (isGuestMode()) {
        if (ui.removeProfilePhoto) store.saveProfile({ avatarData:'', avatarPath:'', avatarUrl:'' });
        else if (ui.pendingProfilePhotoFile) {
          const prepared = await window.BT.auth.prepareAvatar(ui.pendingProfilePhotoFile);
          const avatarData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('La photo ne peut pas être conservée sur cet appareil.'));
            reader.readAsDataURL(prepared);
          });
          store.saveProfile({ avatarData, avatarPath:'', avatarUrl:'' });
        }
        closeDialog(); showToast('Profil invité conservé sur cet appareil'); render(); return;
      }

      if (submitButton) submitButton.textContent = 'Enregistrement…';
      if (ui.removeProfilePhoto) await window.BT.auth.removeAvatar();
      else if (ui.pendingProfilePhotoFile) await window.BT.auth.updateAvatar(ui.pendingProfilePhotoFile);
      const remote = await window.BT.auth.updateProfile({ displayName:fields.name, handle:fields.handle, profileTitle:fields.title, bio:fields.bio, interests:fields.interests });
      store.saveProfile({
        ...fields,
        handle:remote.handle ? `@${remote.handle}` : fields.handle,
        visibility:remote.profile_visibility || store.getProfile().visibility,
        avatarPath:remote.avatar_path || '', avatarUrl:remote.avatar_url || '', avatarData:''
      });
      closeDialog(); showToast(ui.removeProfilePhoto ? 'Photo de profil retirée' : ui.pendingProfilePhotoFile ? 'Photo de profil mise à jour' : 'Profil mis à jour'); render();
    } catch (error) {
      showToast(error.message || 'Profil conservé localement ; synchronisation différée');
    } finally {
      if (ui.pendingProfilePhotoUrl) URL.revokeObjectURL(ui.pendingProfilePhotoUrl);
      ui.pendingProfilePhotoUrl = '';
      if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = originalLabel; }
    }
  }

  async function submitFinishSession(form, data) {
    const session = store.getActiveSession();
    if (!session || form.dataset.saving) return;
    const book = store.getBookById(session.bookId);
    if (!book) return;
    form.dataset.saving = 'true';
    form.querySelector('[type="submit"]').disabled = true;
    const traceText = String(data.get('traceText') || '').trim(), share = data.get('share') === 'on';
    const markRead = data.get('markRead') === 'on';
    const total = book.mediaType === 'audio' ? book.durationMinutes : book.totalPages;
    const saved = store.finishActiveSession({ endPage: clamp(data.get('endPage'), 0, total || 99999), rating: data.get('rating'), traceText, markRead, share:false });
    if (!saved) { delete form.dataset.saving; form.querySelector('[type="submit"]').disabled = false; return; }
    closeDialog(); location.hash = '#home';
    const prepare=()=>{if(share)BT.sharing.open(markRead?'fin':'session',markRead?book.id:saved.id,traceText);};
    if (markRead) celebrateFinishedBook(book,prepare);
    else {showToast('Session enregistrée, bilan privé');prepare();}
  }

  function celebrateFinishedBook(book,afterClose=()=>{}) {
    const dialog = document.createElement('dialog');
    dialog.className = 'app-dialog completion-dialog';
    dialog.setAttribute('aria-labelledby', 'completion-title');
    dialog.setAttribute('aria-describedby', 'completion-message');
    dialog.innerHTML = `<div class="completion-art" aria-hidden="true"><div class="completion-halo"></div><svg class="completion-book" viewBox="0 0 120 100" fill="none"><g class="completion-opening-pages"><path class="completion-page completion-page--left" d="M60 25C44 12 23 12 10 18v62c18-6 34-3 50 9Z"/><path class="completion-page completion-page--right" d="M60 25c16-13 37-13 50-7v62c-18-6-34-3-50 9Z"/><path d="M60 25v64M22 32c9-2 18 0 26 4m-26 8c9-2 18 0 26 4m-26 8c9-2 18 0 26 4m24-24c8-4 17-6 26-4m-26 16c8-4 17-6 26-4m-26 16c8-4 17-6 26-4" stroke="#d4a866" stroke-width="2" stroke-linecap="round"/></g><g class="completion-closed-cover"><rect x="29" y="9" width="64" height="82" rx="5" fill="#142438" stroke="#d4a866" stroke-width="2"/><path d="M38 10v80M44 81h42" stroke="#d4a866" stroke-width="2"/><path d="m65 30 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#d4a866"/></g></svg>${Array.from({length:12},(_,i)=>`<span class="completion-spark" style="--angle:${i*30}deg;--delay:${(i%3)*80}ms">✦</span>`).join('')}</div><p class="eyebrow">Une nouvelle page de votre parcours</p><h2 id="completion-title">Bravo, livre terminé !</h2><p class="completion-book-title">${esc(book.title)}</p><p id="completion-message">Vous avez pris le temps d’aller au bout de cette lecture. Une histoire de plus qui vous accompagne.</p><button class="button button--primary" type="button" autofocus>Savourer ce moment</button>`;
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { dialog.remove(); document.querySelector('.home-heading [data-action="add-book"]')?.focus({preventScroll:true}); afterClose(); }, {once:true});
    document.body.append(dialog); dialog.showModal();
  }

  async function submitComment(form, data) {
    const post = store.getCommunity().posts.find(item => item.id === form.dataset.postId);
    if (!post) return;
    if (isGuestMode() || !post.isRemote) { store.addComment(post.id, data.get('text')); showToast('Trace conservée sur cet appareil'); render(); return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      await window.BT.community.createComment(post.remoteId || post.id, data.get('text'));
      await refreshCommunity({ quiet:true }); showToast('Trace envoyée à l’auteur');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Trace non envoyée'); }
  }

  async function submitPrivacy(form, data) {
    store.saveProfile({ visibility: data.get('profileVisibility') || 'private' });
    store.saveSettings({ defaultPostVisibility: data.get('defaultVisibility') || 'me' });
    if (isGuestMode()) { showToast('Confidentialité conservée sur cet appareil'); render(); return; }
    try { await window.BT.auth.updateProfile({ profileVisibility:data.get('profileVisibility') || 'private' }); }
    catch (error) { showToast(error.message || 'Confidentialité conservée localement ; synchronisation différée'); return; }
    showToast('Confidentialité enregistrée'); render();
  }

  async function submitNotificationSettings(form, data) {
    const keys = ['friends','encouragements','traces','clubs','salons','goals'];
    const notifications = Object.fromEntries(keys.map(key => [key, data.get(key) === 'on']));
    if (!isGuestMode()) await BT.push.preferences(notifications);
    notifications.remote = false; store.saveSettings({ notifications }); await refreshNotifications({ quiet:true }); showToast('Préférences de notifications enregistrées');
  }

  async function submitPost(form, data) {
    const visibility = data.get('visibility');
    if (visibility === 'public' && store.getProfile().visibility === 'private' && !confirm('Votre profil est privé. Confirmez-vous cette publication ponctuelle dans le fil public ?')) return;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Compression et enregistrement…';
    try {
      let post;
      if (isGuestMode()) {
        const file = data.get('photo');
        const photoData = file?.size ? await localPhotoData(file) : null;
        post = { type:data.get('type'), bookTitle:data.get('bookTitle'), text:data.get('text'), visibility, photoData };
      } else {
        post = await window.BT.community.createPost({ type:data.get('type'), bookTitle:data.get('bookTitle'), text:data.get('text'), visibility, file:data.get('photo') });
      }
      if (post) store.addPost(post);
      if (ui.pendingPostPhotoUrl) URL.revokeObjectURL(ui.pendingPostPhotoUrl); ui.pendingPostPhotoUrl = '';
      closeDialog(); showToast(isGuestMode() ? 'Trace conservée uniquement sur cet appareil' : `Trace enregistrée dans BOO-P · ${VISIBILITY_LABELS[visibility]}`); render();
    } catch (error) {
      submit.disabled = false; submit.textContent = 'Enregistrer la Trace'; showToast(error.message || 'La Trace ne peut pas être enregistrée');
    }
  }

  async function submitClub(form, data) {
    const customTitle = String(data.get('customBookTitle') || '').trim();
    const bookTitle = customTitle || data.get('bookTitle');
    if (customTitle && !store.getBooks().some(book => normalize(book.title) === normalize(customTitle)) && confirm(`Ajouter automatiquement « ${customTitle} » à votre bibliothèque ?`)) {
      store.addBook({ title:customTitle, authors:['Auteur à préciser'], status:'a-lire', situation:'possede', coverColor:gradientFor(customTitle) });
    }
    const payload = { name:data.get('name'), description:data.get('description'), visibility:data.get('visibility'), access:data.get('access'), bookTitle, color:data.get('color') };
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.addGroup(payload);
      closeDialog(); showToast('Club créé uniquement sur cet appareil'); render(); return;
    }
    try {
      const remote = await window.BT.community.createClub(payload);
      await refreshCommunity({ quiet:true });
      closeDialog(); showToast('Club enregistré dans BOO-P'); render();
    } catch (error) { submit.disabled = false; showToast(error.message || 'Club non créé'); }
  }

  async function submitClubEdit(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.updateGroup(form.dataset.clubId, { name:data.get('name'), description:data.get('description'), visibility:data.get('visibility'), access:data.get('access'), bookTitle:String(data.get('customBookTitle') || '').trim() || data.get('bookTitle'), color:data.get('color') });
      ui.clubSpaces.delete(form.dataset.clubId); closeDialog(); showToast('Club modifié sur cet appareil'); render(); return;
    }
    try {
      await window.BT.community.updateClub(form.dataset.clubId, {
        name:data.get('name'), description:data.get('description'), visibility:data.get('visibility'),
        access:data.get('access'), bookTitle:String(data.get('customBookTitle') || '').trim() || data.get('bookTitle'),
        color:data.get('color')
      });
      await refreshCommunity({ quiet:true });
      closeDialog(); showToast('Club modifié'); render();
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le club ne peut pas être modifié'); }
  }

  async function submitClubMember(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      const reader = store.getCommunity().users.find(user => user.id === data.get('userId'));
      store.addGroupMember(form.dataset.clubId, reader, data.get('role'));
      ui.clubSpaces.delete(form.dataset.clubId); openClubDetails(form.dataset.clubId); showToast('Membre ajouté pour cet essai local'); return;
    }
    try {
      await window.BT.community.addClubMember(form.dataset.clubId, data.get('userId'), data.get('role'));
      await refreshCommunity({ quiet:true });
      openClubDetails(form.dataset.clubId); showToast('Membre ajouté au club');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le membre ne peut pas être ajouté'); }
  }

  async function refreshClubSpace(clubId, announce = false) {
    ui.clubSpaces.delete(clubId);
    await loadClubSpace(clubId, { force:true });
    if (announce) showToast('Espace du club actualisé');
  }

  async function submitClubPost(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.addGroupPost(form.dataset.clubId, data.get('text'), data.get('type'));
      form.reset(); await refreshClubSpace(form.dataset.clubId); showToast('Message conservé dans ce club local'); return;
    }
    try {
      await window.BT.community.createClubPost(form.dataset.clubId, data.get('text'), data.get('type'));
      form.reset(); await refreshClubSpace(form.dataset.clubId); showToast(data.get('type') === 'announcement' ? 'Annonce publiée dans le club' : 'Message publié dans le club');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le message ne peut pas être publié'); }
  }

  async function submitClubComment(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.addGroupComment(form.dataset.clubId, form.dataset.postId, data.get('text'));
      await refreshClubSpace(form.dataset.clubId); showToast('Commentaire conservé sur cet appareil'); return;
    }
    try {
      await window.BT.community.createClubComment(form.dataset.postId, data.get('text'));
      await refreshClubSpace(form.dataset.clubId); showToast('Commentaire envoyé');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le commentaire ne peut pas être envoyé'); }
  }

  async function submitClubBook(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.addGroupBook(form.dataset.clubId, data.get('title'), data.get('status'));
      await refreshClubSpace(form.dataset.clubId); showToast('Lecture ajoutée au club local'); return;
    }
    try {
      await window.BT.community.addClubBook({ clubId:form.dataset.clubId, title:data.get('title'), status:data.get('status') });
      await refreshCommunity({ quiet:true });
      await refreshClubSpace(form.dataset.clubId);
      showToast(data.get('status') === 'current' ? 'Nouvelle lecture ouverte dans le club' : data.get('status') === 'read' ? 'Livre ajouté à l’histoire du club' : 'Livre ajouté aux prochaines lectures');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le livre ne peut pas être ajouté au club'); }
  }

  async function toggleClubSpaceEncouragement(clubId, postId, encouraged) {
    if (isGuestMode()) {
      store.toggleGroupPostEncouragement(clubId, postId);
      await refreshClubSpace(clubId); showToast(encouraged ? 'Encouragement retiré' : 'Encouragement conservé sur cet appareil'); return;
    }
    try {
      await window.BT.community.toggleClubPostEncouragement(postId, encouraged);
      await refreshClubSpace(clubId);
      showToast(encouraged ? 'Encouragement retiré' : 'Encouragement envoyé');
    } catch (error) { showToast(error.message || 'L’encouragement ne peut pas être enregistré'); }
  }

  async function markClubBookRead(clubId, bookId) {
    if (!confirm('Marquer ce livre comme lu par le club ?')) return;
    if (isGuestMode()) {
      store.updateGroupBook(clubId, bookId, { status:'read' });
      await refreshClubSpace(clubId); showToast('Livre archivé dans ce club local'); return;
    }
    try {
      await window.BT.community.updateClubBook(bookId, clubId, { status:'read' });
      await refreshCommunity({ quiet:true });
      await refreshClubSpace(clubId);
      showToast('Livre ajouté aux lectures terminées du club');
    } catch (error) { showToast(error.message || 'Cette lecture ne peut pas être archivée'); }
  }

  async function submitSalonMessage(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.addSalonMessage(form.dataset.salonId, data.get('text'));
      openSalonThread(form.dataset.salonId); showToast('Message conservé sur cet appareil'); return;
    }
    try {
      await window.BT.community.createSalonMessage(form.dataset.salonId, data.get('text'));
      await refreshCommunity({ quiet:true });
      openSalonThread(form.dataset.salonId); showToast('Message envoyé');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le message ne peut pas être envoyé'); }
  }

  async function submitSalon(form, data) {
    const club = store.getCommunity().clubs.find(item => item.id === data.get('clubId'));
    if (!club || club.role !== 'owner') { showToast('Seul le propriétaire du club peut créer un salon'); return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.addSalon({ clubId:club.id, clubName:club.name, title:data.get('title'), bookTitle:data.get('bookTitle'), scheduledAt:new Date(data.get('scheduledAt')).toISOString() });
      closeDialog(); showToast('Salon programmé sur cet appareil'); render(); return;
    }
    try {
      await window.BT.community.createSalon({ clubId:club.id, title:data.get('title'), bookTitle:data.get('bookTitle'), scheduledAt:new Date(data.get('scheduledAt')).toISOString() });
      await refreshCommunity({ quiet:true });
      closeDialog(); showToast('Salon programmé'); render();
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le salon ne peut pas être créé'); }
  }

  async function submitSalonEdit(form, data) {
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    if (isGuestMode()) {
      store.updateSalon(form.dataset.salonId, { title:data.get('title'), bookTitle:data.get('bookTitle'), scheduledAt:new Date(data.get('scheduledAt')).toISOString(), status:data.get('status') });
      closeDialog(); showToast('Salon modifié sur cet appareil'); render(); return;
    }
    try {
      await window.BT.community.updateSalon(form.dataset.salonId, {
        title:data.get('title'), bookTitle:data.get('bookTitle'),
        scheduledAt:new Date(data.get('scheduledAt')).toISOString(), status:data.get('status')
      });
      await refreshCommunity({ quiet:true });
      closeDialog(); showToast('Salon modifié'); render();
    } catch (error) { submit.disabled = false; showToast(error.message || 'Le salon ne peut pas être modifié'); }
  }
  async function submitReply(form, data) {
    const post = store.getCommunity().posts.find(item => item.id === form.dataset.postId);
    if (isGuestMode() || !post?.isRemote) { store.addComment(form.dataset.postId, data.get('text'), form.dataset.commentId); closeDialog(); ui.openComments.add(form.dataset.postId); showToast('Réponse conservée sur cet appareil'); render(); return; }
    try { await window.BT.community.createComment(post.remoteId || post.id, data.get('text'), form.dataset.commentId); closeDialog(); ui.openComments.add(post.id); await refreshCommunity({ quiet:true }); showToast('Réponse ajoutée'); }
    catch (error) { showToast(error.message || 'Réponse non envoyée'); }
  }
  function submitReport(form, data) { showToast('Signalement non envoyé : le service de modération n’est pas encore disponible.'); }
  function submitHelp(form, data) { showToast('Message non envoyé : le service d’aide n’est pas encore disponible.'); }
  async function submitChangePassword(form, data) {
    if (data.get('password') !== data.get('confirm')) { showToast('Les deux mots de passe ne correspondent pas'); return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      await window.BT.auth.updatePassword(data.get('password'));
      closeDialog(); showToast('Mot de passe modifié');
    } catch (error) {
      submit.disabled = false; showToast(error.message || 'Mot de passe non modifié');
    }
  }
  async function submitDeleteAccount(form, data) {
    if (data.get('confirmation') !== 'SUPPRIMER') { showToast('Saisissez exactement SUPPRIMER'); return; }
    ui.syncStopped = true;
    ui.syncReady = false;
    ui.syncPending = false;
    clearTimeout(ui.syncTimer);
    ui.syncUnsubscribe?.();
    ui.syncUnsubscribe = null;
    try {
      await window.BT.auth.signOut();
      clearInterval(ui.timer);
      clearInterval(ui.heartbeat);
      store.clearAll();
      location.href = 'index.html?reason=local-data-deleted';
    } catch (error) {
      showToast('Déconnexion impossible : les données locales sont conservées. Réessayez ou rechargez la page.');
    }
  }

  function openPostDialog() {
    const settings = store.getSettings();
    const storageNote = isGuestMode()
      ? 'Mode invité : la Trace et sa photo restent uniquement sur cet appareil et ne sont jamais publiées dans Supabase.'
      : 'La Trace et sa photo sont enregistrées dans Supabase. Amis uniquement réserve la lecture aux amitiés acceptées. Pour publier dans un club, utilisez son espace dédié ; ici, Club reste privé.';
    openDialog({ title:'Laisser une Trace', eyebrow:isGuestMode() ? 'Essai local' : 'Enregistrement sécurisé', body:`<form class="form-grid" data-form="post"><label class="field">Type d’activité<select name="type"><option value="trace">Trace ou bilan</option><option value="debut">Début de lecture</option><option value="fin">Fin de lecture</option><option value="goal">Objectif atteint</option></select></label><label class="field">Livre éventuel<select name="bookTitle"><option value="">Sans livre</option>${store.getBooks().map(book => `<option value="${attr(book.title)}">${esc(book.title)}</option>`).join('')}</select></label><label class="field">Texte<textarea name="text" required maxlength="1200" placeholder="Ce que cette lecture laisse en vous…"></textarea></label><label class="field">Photo facultative<input type="file" name="photo" data-change="post-photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"><span class="field-help" id="post-photo-help">Facultatif · redimensionnement et compression automatiques.</span><img class="post-photo-preview" id="post-photo-preview" alt="Aperçu de la photo choisie" hidden></label><label class="field">Visibilité<select name="visibility"><option value="me" ${settings.defaultPostVisibility === 'me' ? 'selected' : ''}>Moi uniquement</option><option value="friends" ${settings.defaultPostVisibility === 'friends' ? 'selected' : ''}>Amis uniquement</option><option value="club">Club</option><option value="public" ${settings.defaultPostVisibility === 'public' ? 'selected' : ''}>Public</option></select></label><p class="small muted">${storageNote}</p><button class="button button--primary" type="submit">Enregistrer la Trace</button></form>` });
  }

  function openReplyDialog(postId, commentId) {
    openDialog({ title:'Répondre à cette Trace', eyebrow:'Un seul niveau de réponse', body:`<form class="form-grid" data-form="reply" data-post-id="${attr(postId)}" data-comment-id="${attr(commentId)}"><label class="field">Votre réponse<textarea name="text" required maxlength="500"></textarea></label><button class="button button--primary" type="submit">Envoyer</button></form>` });
  }
  function openReportDialog(target, id) {
    openDialog({ title:`Signaler ${target === 'utilisateur' ? 'cet utilisateur' : 'cette publication'}`, eyebrow:'Modération simulée', body:`<form class="form-grid" data-form="report"><input type="hidden" name="targetId" value="${attr(id)}"><label class="field">Motif<select name="reason"><option>Contenu inapproprié</option><option>Harcèlement</option><option>Spam</option><option>Autre</option></select></label><label class="field">Précision facultative<textarea name="details"></textarea></label><p class="small muted">Le signalement est enregistré localement. Aucun modérateur réel ne le reçoit dans la Phase 1.</p><button class="button button--primary" type="submit">Envoyer le signalement simulé</button></form>` });
  }
  function confirmBlock(userId) {
    const user = store.getCommunity().users.find(item => item.id === userId); if (!user) return;
    if (confirm(`Bloquer ${user.name} ? Ses publications seront masquées dans ce prototype local.`)) { store.blockUser(userId); showToast('Utilisateur bloqué'); render(); }
  }
  async function openUserDialog(userId) {
    const viewer=BT.auth.getCurrentUser()?.id;
    let user = store.getCommunity().users.find(item => item.id === userId);
    if(!user && !isGuestMode()){try{user=await BT.readerProfileApi.identity(userId);}catch(e){showToast(e.message);return;}}
    if(!user)return;
    let details = null;
    if (user.isRemote) {
      try { details = await window.BT.community.getReaderProfile(userId); }
      catch (error) { showToast(error.message || 'Ce profil ne peut pas être ouvert'); }
    } else details = { bio:user.bio, interests:[] };
    if(viewer!==BT.auth.getCurrentUser()?.id)return;
    const locked = user.profileVisibility === 'private' && !details;
    const avatarProfile = { ...user, avatarUrl:details?.avatarUrl || user.avatarUrl || '' };
    openDialog({ title:userId===viewer?'Mon espace de lecture':'Son espace de lecture', wide:true, eyebrow:locked ? 'Profil privé' : user.profileVisibility === 'private' ? 'Profil privé · ami accepté' : 'Profil public', body:`<div class="profile-main"><span class="profile-avatar">${esc(user.initials)}</span><div><h2>${esc(user.name)}</h2><p class="muted">${esc(user.handle || '')}</p></div></div>${locked ? '<div class="empty-state"><h3>Ce profil protège son sentier</h3><p>Envoyez une demande d’amitié. Son contenu deviendra accessible après acceptation.</p></div>' : `<p>${esc(details?.bio || 'Ce lecteur n’a pas encore rédigé de biographie.')}</p>${details?.interests?.length ? `<div class="interest-list">${details.interests.map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''}`}<div class="reader-profile-options"><details><summary>Confidentialité</summary><p class="small muted">La bibliothèque est réservée aux amis acceptés. Les carnets et souvenirs apparaissent selon leur audience de publication. Les notes et conversations IA restent privées.</p></details>${userId===viewer?'':user.friendState==='friend'?`<details><summary>Vous êtes amis · Gérer</summary>${friendAction(user)}</details>`:friendAction(user)}</div><div data-reader-sharing></div>` });
    const profileDialog=document.getElementById('app-dialog');profileDialog.classList.add('reader-profile-dialog');profileDialog.addEventListener('close',()=>profileDialog.classList.remove('reader-profile-dialog'),{once:true});
    const sharingHost=document.querySelector('#app-dialog [data-reader-sharing]');
    if(sharingHost && user.isRemote && !isGuestMode())BT.sharing.mountReader(sharingHost,userId);
    const dialogAvatar = document.querySelector('#app-dialog .profile-avatar');
    if (dialogAvatar) dialogAvatar.innerHTML = avatarInner(avatarProfile);
  }
  function openClubDialog() {
    openDialog({ title:'Créer un club', eyebrow:'Espace partagé et privé par défaut', body:`<form class="form-grid" data-form="club"><label class="field">Nom<input name="name" required maxlength="80"></label><label class="field">Description<textarea name="description" required maxlength="1200"></textarea></label><label class="field">Couverture<select name="color"><option value="#6f927c">Sauge</option><option value="#cf873d">Ocre</option></select></label><div class="field-row"><label class="field">Visibilité<select name="visibility"><option value="private">Privé</option><option value="public">Public</option></select></label><label class="field">Accès public<select name="access"><option value="approval">Sur approbation</option><option value="open">Accès libre</option></select></label></div><label class="field">Livre de ma bibliothèque<select name="bookTitle"><option value="">À choisir plus tard</option>${store.getBooks().map(book => `<option value="${attr(book.title)}">${esc(book.title)}</option>`).join('')}</select></label><label class="field">Ou un autre livre<input name="customBookTitle" maxlength="240" placeholder="Titre absent de ma bibliothèque"><span class="field-help">BOO-P vous proposera de l’ajouter automatiquement à votre bibliothèque.</span></label><p class="small muted">Après la création, vous pourrez ajouter des membres, modifier le livre et programmer des salons.</p><button class="button button--primary" type="submit">Créer le club</button></form>` });
  }
  function openClubDetails(id) {
    const club = store.getCommunity().clubs.find(item => item.id === id); if (!club) return;
    const manager = club.role === 'owner';
    const books = store.getBooks(), bookTitles = new Set(books.map(book => book.title));
    const bookOptions = `<option value="">À choisir</option>${books.map(book => `<option value="${attr(book.title)}" ${book.title === club.bookTitle ? 'selected' : ''}>${esc(book.title)}</option>`).join('')}`;
    const members = (club.members || []).sort((a,b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.name.localeCompare(b.name, 'fr')));
    const memberIds = new Set(members.map(member => member.userId));
    const candidates = store.getCommunity().users.filter(user => user.isRemote && !memberIds.has(user.id));
    const memberAction = member => !manager || member.role === 'owner' ? '' : member.status === 'pending'
      ? `<span class="button-row"><button class="text-link small" type="button" data-action="approve-club-member" data-club-id="${attr(club.id)}" data-user-id="${attr(member.userId)}">Accepter</button><button class="text-link small" type="button" data-action="remove-club-member" data-club-id="${attr(club.id)}" data-user-id="${attr(member.userId)}">Refuser</button></span>`
      : `<button class="text-link small" type="button" data-action="remove-club-member" data-club-id="${attr(club.id)}" data-user-id="${attr(member.userId)}">Retirer</button>`;
    const memberList = `<div class="club-member-list">${members.map(member => `<div class="club-member-row"><span class="avatar">${esc(initials(member.name))}</span><span><strong>${esc(member.name)}</strong><small>${member.role === 'owner' ? 'Propriétaire' : member.role === 'moderator' ? 'Modérateur' : member.status === 'pending' ? 'Demande en attente' : 'Membre'}</small></span>${memberAction(member)}</div>`).join('')}</div>`;
    const managerPanel = manager ? `<details class="setting-card" open><summary>Modifier le club</summary><div class="setting-card__body"><form class="form-grid" data-form="club-edit" data-club-id="${attr(club.id)}"><label class="field">Nom<input name="name" required maxlength="80" value="${attr(club.name)}"></label><label class="field">Description<textarea name="description" maxlength="1200">${esc(club.description)}</textarea></label><div class="field-row"><label class="field">Visibilité<select name="visibility"><option value="private" ${club.visibility === 'private' ? 'selected' : ''}>Privé</option><option value="public" ${club.visibility === 'public' ? 'selected' : ''}>Public</option></select></label><label class="field">Accès<select name="access"><option value="approval" ${club.access === 'approval' ? 'selected' : ''}>Sur approbation</option><option value="open" ${club.access === 'open' ? 'selected' : ''}>Libre</option></select></label></div><label class="field">Livre actuel<select name="bookTitle">${bookOptions}</select></label><label class="field">Autre titre<input name="customBookTitle" maxlength="240" value="${bookTitles.has(club.bookTitle) ? '' : attr(club.bookTitle || '')}"></label><label class="field">Couleur<select name="color"><option value="#6f927c" ${club.color === '#6f927c' ? 'selected' : ''}>Sauge</option><option value="#cf873d" ${club.color === '#cf873d' ? 'selected' : ''}>Ocre</option></select></label><button class="button button--primary" type="submit">Enregistrer les modifications</button></form></div></details>${candidates.length ? `<details class="setting-card"><summary>Ajouter un membre</summary><div class="setting-card__body"><form class="form-grid" data-form="club-member" data-club-id="${attr(club.id)}"><label class="field">Lecteur<select name="userId">${candidates.map(user => `<option value="${attr(user.id)}">${esc(user.name)} ${esc(user.handle || '')}</option>`).join('')}</select></label><label class="field">Rôle<select name="role"><option value="member">Membre</option><option value="moderator">Modérateur</option></select></label><button class="button button--sage" type="submit">Ajouter au club</button></form></div></details>` : '<p class="small muted">Tous les lecteurs actuellement disponibles sont déjà membres.</p>'}` : '';
    openDialog({ title:club.name, eyebrow:`${club.visibility === 'private' ? 'Club privé' : 'Club public'} · ${club.membersCount} membre${club.membersCount > 1 ? 's' : ''}`, body:`<p>${esc(club.description)}</p><div class="history-item"><span class="history-item__icon">▥</span><div class="history-item__content"><strong>${esc(club.bookTitle || 'Lecture à choisir')}</strong><span class="small muted">Livre en cours</span></div></div><section class="section-block"><h3>Membres</h3>${memberList}</section>${managerPanel}${club.role === 'owner' ? `<button class="button button--secondary section-block" type="button" data-action="create-salon" data-club-id="${attr(club.id)}">Créer un salon pour ce club</button>` : ''}` });
  }

  async function toggleClub(id, currentMembership) {
    if (isGuestMode()) {
      const club = store.toggleClub(id);
      ui.clubSpaces.delete(id);
      showToast(club?.joined ? 'Club rejoint pour cet essai local' : 'Participation retirée de cet appareil');
      render();
      return;
    }
    try {
      const result = await window.BT.community.toggleClubMembership(id, currentMembership);
      await refreshCommunity({ quiet:true });
      showToast(result.status === 'pending' ? 'Demande envoyée au propriétaire' : result.joined ? 'Club rejoint' : 'Participation au club annulée');
      render();
    } catch (error) { showToast(error.message || 'La participation ne peut pas être modifiée'); }
  }

  async function removeClubMember(clubId, userId) {
    if (!confirm('Retirer ce membre du club ?')) return;
    if (isGuestMode()) {
      store.removeGroupMember(clubId, userId); ui.clubSpaces.delete(clubId); openClubDetails(clubId); showToast('Membre retiré de ce club local'); return;
    }
    try {
      await window.BT.community.removeClubMember(clubId, userId);
      await refreshCommunity({ quiet:true });
      openClubDetails(clubId); showToast('Membre retiré');
    } catch (error) { showToast(error.message || 'Ce membre ne peut pas être retiré'); }
  }

  async function approveClubMember(clubId, userId) {
    if (isGuestMode()) {
      const reader = store.getCommunity().users.find(user => user.id === userId);
      store.addGroupMember(clubId, reader, 'member'); ui.clubSpaces.delete(clubId); openClubDetails(clubId); showToast('Demande acceptée localement'); return;
    }
    try {
      await window.BT.community.addClubMember(clubId, userId, 'member');
      await refreshCommunity({ quiet:true });
      openClubDetails(clubId); showToast('Demande acceptée');
    } catch (error) { showToast(error.message || 'Cette demande ne peut pas être acceptée'); }
  }

  async function toggleSalon(id, leave = false) {
    const salon = store.getCommunity().salons.find(item => item.id === id); if (!salon) return;
    if (leave && !confirm('Quitter ce salon de lecture ?')) return;
    if (isGuestMode()) {
      store.updateSalon(id, { joined:!leave, myStatus:leave ? 'waiting' : 'reading' });
      showToast(leave ? 'Salon quitté sur cet appareil' : 'Salon rejoint pour cet essai local'); render(); return;
    }
    try {
      await window.BT.community.toggleSalonMembership(id, leave || salon.joined);
      await refreshCommunity({ quiet:true });
      showToast(leave ? 'Salon quitté' : 'Salon rejoint');
      render();
    } catch (error) { showToast(error.message || 'Le salon ne peut pas être mis à jour'); }
  }

  async function updateSalonSharing(id, checked) {
    if (isGuestMode()) {
      store.updateSalon(id, { sharePages:checked }); showToast(checked ? 'Progression partagée dans cet essai local' : 'Progression masquée'); openSalonThread(id); return;
    }
    try {
      await window.BT.community.updateSalonPresence(id, { sharePages:checked });
      await refreshCommunity({ quiet:true });
      showToast(checked ? 'Progression partagée avec votre accord' : 'Progression en pages masquée');
      openSalonThread(id);
    } catch (error) { showToast(error.message || 'Ce réglage ne peut pas être modifié'); }
  }
  function openSalonThread(id) {
    const salon = store.getCommunity().salons.find(item => item.id === id); if (!salon) return;
    openDialog({ title:salon.title, eyebrow:`${salon.clubName} · ${salon.status === 'live' ? 'en cours' : salon.status === 'closed' ? 'terminé' : 'programmé'}`, body:`<div class="button-row"><span class="status-chip">${salonStatus(salon.myStatus)}</span><label class="checkbox-row"><input type="checkbox" data-change="salon-pages" data-id="${attr(id)}" ${salon.sharePages ? 'checked' : ''}> Partager ma progression en pages</label></div><div class="participant-list section-block">${salon.participants.map(person => `<span class="participant">${esc(person.name)} · ${salonStatus(person.status)}${person.sharePages ? ` · ${person.minutes} min` : ''}</span>`).join('')}</div><div class="comments section-block">${salon.messages.map(message => `<div class="comment"><strong>${esc(message.authorName)}</strong><p>${esc(message.text)}</p><span class="micro muted">${relativeDate(message.date)}</span></div>`).join('') || '<p class="small muted">Aucun message. Ouvrez la discussion.</p>'}</div><form class="inline-form section-block" data-form="salon-message" data-salon-id="${attr(id)}"><label class="sr-only" for="salon-message">Message</label><input id="salon-message" name="text" required maxlength="500" placeholder="Écrire dans le salon…"><button class="button button--sage button--small" type="submit">Envoyer</button></form><p class="small muted">Seuls les membres actifs du club peuvent lire et publier ici.</p>` });
  }
  function openSalonCreateDialog(salon = null, preferredClubId = null) {
    const clubs = store.getCommunity().clubs.filter(club => club.role === 'owner');
    if (!clubs.length) { showToast('Créez d’abord un club dont vous êtes propriétaire'); return; }
    const defaultDate = new Date(salon?.scheduledAt || Date.now() + 86400000); defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset());
    const club = salon ? clubs.find(item => item.id === salon.clubId) : clubs.find(item => item.id === preferredClubId) || clubs[0];
    const books = store.getBooks(), bookOptions = books.map(book => `<option value="${attr(book.title)}" ${book.title === (salon?.bookTitle || club?.bookTitle) ? 'selected' : ''}>${esc(book.title)}</option>`).join('');
    const editing = Boolean(salon);
    openDialog({ title:editing ? 'Modifier le salon' : 'Créer un salon', eyebrow:'Réservé au propriétaire du club', body:`<form class="form-grid" data-form="${editing ? 'salon-edit' : 'salon'}" ${editing ? `data-salon-id="${attr(salon.id)}"` : ''}><label class="field">Club<select name="clubId" ${editing ? 'disabled' : ''}>${clubs.map(item => `<option value="${attr(item.id)}" ${item.id === club?.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><label class="field">Nom du salon<input name="title" required maxlength="120" value="${attr(salon?.title || '')}"></label><label class="field">Livre<select name="bookTitle">${bookOptions}</select></label><label class="field">Date et heure<input type="datetime-local" name="scheduledAt" required value="${defaultDate.toISOString().slice(0,16)}"></label>${editing ? `<label class="field">État<select name="status"><option value="scheduled" ${salon.status === 'scheduled' ? 'selected' : ''}>Programmé</option><option value="live" ${salon.status === 'live' ? 'selected' : ''}>En cours</option><option value="closed" ${salon.status === 'closed' ? 'selected' : ''}>Terminé</option></select></label>` : ''}<p class="small muted">Le salon et ses messages sont accessibles uniquement aux membres actifs du club.</p><button class="button button--primary" type="submit">${editing ? 'Enregistrer' : 'Programmer le salon'}</button></form>` });
  }

  function openHelpDialog() {
    openDialog({ title:'Aide et signalement', eyebrow:'Prototype local', body:`<form class="form-grid" data-form="help"><label class="field">Sujet<select name="subject"><option>J’ai besoin d’aide</option><option>Signaler un problème technique</option><option>Question de confidentialité</option></select></label><label class="field">Message<textarea name="message" required></textarea></label><p class="small muted">Ce formulaire valide le parcours mais n’envoie aucun message à distance.</p><button class="button button--primary" type="submit">Enregistrer le message localement</button></form>` });
  }
  function openChangePasswordDialog() {
    openDialog({ title:'Changer le mot de passe', eyebrow:'Compte Supabase sécurisé', body:`<form class="form-grid" data-form="change-password"><label class="field">Nouveau mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label class="field">Confirmer le mot de passe<input name="confirm" type="password" required minlength="8" autocomplete="new-password"></label><p class="small muted">Le nouveau mot de passe doit contenir au moins 8 caractères.</p><button class="button button--primary" type="submit">Enregistrer le nouveau mot de passe</button></form>` });
  }
  function openDeleteAccountDialog() {
    openDialog({ title:'Effacer les données locales', eyebrow:'Confirmation renforcée', body:`<div class="danger-zone"><p>Cette action efface les lectures BOO-P de ce navigateur et vous déconnecte. Votre compte, vos lectures synchronisées et vos publications restent conservés en ligne. Cette action ne supprime pas le compte distant. Fermez les autres onglets BOO-P avant de continuer.</p><form class="form-grid" data-form="delete-account"><label class="field">Saisissez <strong>SUPPRIMER</strong><input name="confirmation" required autocomplete="off"></label><button class="button button--danger" type="submit">Effacer les données locales</button></form></div>` });
  }
  function confirmDeleteBook(id) {
    const book = store.getBookById(id); if (!book) return;
    if (confirm(`Supprimer « ${book.title} » ainsi que ses sessions et Traces locales ?`)) { store.deleteBook(id); showToast('Livre supprimé'); location.hash = '#path?tab=library'; }
  }
  async function recoverSyncedVersion() {
    if (isGuestMode()) { showToast('Le mode invité reste local.'); return; }
    if (ui.syncBusy || ui.syncBootstrapping) { showToast('Attendez la fin de la synchronisation en cours.'); return; }
    if (!confirm('Votre copie locale sera exportée en JSON, puis remplacée par la version en ligne. Conservez le fichier pour retrouver les changements non synchronisés. Continuer ?')) return;
    ui.syncBootstrapping = true;
    const before = store.getSyncedData();
    try {
      const remote = await window.BT.userDataSync.readSnapshot();
      if (ui.syncStopped || remote?._sync?.skipped) throw new Error('Session indisponible.');
      if (JSON.stringify(before) !== JSON.stringify(store.getSyncedData())) throw new Error('Votre copie vient de changer. Réessayez pour la conserver dans l’export.');
      // Keep an additional local backup: browser downloads can be declined.
      const recoveryKey = `boop_sync_recovery:${window.BT.auth.getSession().user.id}`;
      const backups = JSON.parse(localStorage.getItem(recoveryKey) || '[]');
      backups.push({ savedAt:new Date().toISOString(), data:store.exportData() });
      localStorage.setItem(recoveryKey, JSON.stringify(backups));
      exportData();
      store.replaceSyncedData(remote);
      store.markDataSynced(new Date().toISOString(), remote);
      ui.syncReady = true;
      ui.syncErrorShown = false;
      if (!ui.syncUnsubscribe) ui.syncUnsubscribe = store.subscribe(() => scheduleUserDataSync());
      render();
      showToast('Version synchronisée chargée. Une copie de récupération reste sur cet appareil.');
    } catch (error) { showToast(error.message || 'Récupération impossible ; copie locale conservée.'); }
    finally { ui.syncBootstrapping = false; }
  }

  function exportData() {
    downloadJSON(store.exportData(), 'export');
  }
  function exportRecoveryData() {
    const userId = window.BT.auth.getSession()?.user?.id;
    const saved = userId && localStorage.getItem(`boop_sync_recovery:${userId}`);
    if (!saved) { showToast('Aucune copie de récupération sur cet appareil.'); return; }
    downloadJSON(JSON.parse(saved), 'recuperation');
  }
  function downloadJSON(data, label) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `boo-p-${label}-${store.localDateKey()}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); showToast('Export local préparé');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const query = new URLSearchParams(location.search);
      if (query.has('guest')) window.BT.auth?.enterGuestMode?.();
      const guest = isGuestMode();
      let user = null;
      // Guest data belongs to a separate local store and needs no remote session.
      if (guest) void window.BT.auth.ready().catch(() => {});
      else user = await window.BT.auth.ready();
      const localPreview = ['localhost','127.0.0.1'].includes(location.hostname) && query.has('preview');
      if (!user && !localPreview && !guest) { location.replace('index.html?auth=login&reason=protected'); return; }
      const localOwner = guest ? 'guest' : (user?.id || 'local-preview');
      store.useUser?.(localOwner);
      document.body.dataset.authMode = guest ? 'guest' : (user ? 'account' : 'preview');
      document.documentElement.dataset.authMode = document.body.dataset.authMode;
      document.getElementById('guest-banner').hidden = !guest;
      const completedRemotely = guest || localPreview || Boolean(user?.profile?.onboarding_completed);
      if (completedRemotely && !store.isOnboardingComplete()) store.saveOnboarding({ completed:true, version:5.5, restoredFromProfile:true, completedAt:new Date().toISOString() });
      if (!completedRemotely && !store.isOnboardingComplete()) { location.replace('onboarding.html'); return; }
      if (user) await bootstrapUserDataSync({ quiet:true });
      init();
      BT.pushInvitation?.schedule();
    } catch (error) {
      console.error('BOO-P authentication gate', error);
      location.replace('index.html?auth=login&reason=auth-error');
    }
  });
})();

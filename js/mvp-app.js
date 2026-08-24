/** BOO-P MVP v5 — interface interactive du prototype local. */
(() => {
  'use strict';

  const store = window.BT.store;
  const ui = {
    route: 'home', params: new URLSearchParams(),
    communityTab: 'public', pathTab: 'library', memoryIndex: 0,
    libraryQuery: '', libraryStatus: 'tous', notificationFilter: 'all',
    openComments: new Set(), friendQuery: '', lexiconQuery: '', timer: null, heartbeat: null,
    lastFocus: null, pendingCover: '', pendingCoverFile: null, pendingCoverKind: '', bookSuggestions: [],
    pendingPostPhotoUrl: '', searchQuery: '', communityLoaded: false,
    friendResults: [], friendSearchBusy: false, friendSearchTimer: null,
    catalogRecommendations: [], recommendationsBusy: false, currentRecommendations: [],
    monthlyReportCanvas: null, monthlyReportData: null, notificationUnsubscribe: null
  };

  const NAV = [
    { id: 'home', label: 'Accueil', icon: '⌂', href: '#home' },
    { id: 'community', label: 'Communauté', icon: '◎', href: '#community?tab=public' },
    { id: 'path', label: 'Parcours', icon: '⌁', href: '#path?tab=library' },
    { id: 'profile', label: 'Profil', icon: '◉', href: '#profile' }
  ];
  const TITLES = {
    home: ['Votre espace', 'Accueil'], community: ['Échanges choisis', 'Communauté'],
    path: ['Votre cheminement', 'Parcours'], profile: ['Identité du lecteur', 'Profil'],
    session: ['Mode immersif', 'Session de lecture'], book: ['Dans votre bibliothèque', 'Fiche du livre']
  };
  const STATUS_LABELS = { 'a-lire': 'À lire', 'en-cours': 'En cours', 'en-pause': 'En pause', lu: 'Lu', abandonne: 'Abandonné' };
  const SITUATION_LABELS = { possede: 'Possédé', emprunte: 'Emprunté', prete: 'Prêté', donne: 'Donné' };
  const VISIBILITY_LABELS = { public: 'Public', friends: 'Amis uniquement', club: 'Club', me: 'Moi uniquement', private: 'Privé' };
  const MEDIA_LABELS = { print: 'Livre papier', ebook: 'Livre numérique', audio: 'Livre audio' };
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
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const pct = (value, total) => total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const initials = name => String(name || 'L').trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const formatDate = value => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: new Date(value).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(new Date(value));
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
    ui.route = ['home','community','path','profile','session','book'].includes(route) ? route : 'home';
    ui.params = new URLSearchParams(query);
    if (ui.route === 'community') ui.communityTab = ['public','clubs','salons','friends'].includes(ui.params.get('tab')) ? ui.params.get('tab') : 'public';
    if (ui.route === 'path') ui.pathTab = ['library','trail','lexicon','goals'].includes(ui.params.get('tab')) ? ui.params.get('tab') : 'library';
  }

  function init() {
    store.recoverActiveSession();
    const user = window.BT.auth?.getCurrentUser?.();
    const profile = store.getProfile();
    if (user && (profile.email !== user.email || (!profile.name || profile.name === 'Dixon') || (!profile.handle && user.profile?.handle))) store.saveProfile({ email: user.email, name: profile.name === 'Dixon' ? user.name : profile.name, handle:profile.handle || (user.profile?.handle ? `@${user.profile.handle}` : '') });
    ui.memoryIndex = Number(store.getSettings().memoryIndex) || 0;
    applyTheme();
    bindGlobalEvents();
    renderNavigation();
    window.addEventListener('hashchange', () => { render(true); });
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    updateNetworkState();
    if (!location.hash) location.hash = '#home'; else render();
    refreshCommunity({ quiet:true });
    refreshReaders('', { quiet:true });
    if (user && window.BT.notifications) {
      store.replaceNotifications([]);
      refreshNotifications({ quiet:true }).then(startNotificationSubscription);
    }
    ui.timer = window.setInterval(tickSessionClock, 1000);
    ui.heartbeat = window.setInterval(() => store.heartbeatActiveSession(), 10000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { store.recoverActiveSession(); refreshNotifications({ quiet:true }); render(); } });
    window.addEventListener('pagehide', () => ui.notificationUnsubscribe?.(), { once:true });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('toggle', handleLibraryShelfToggle, true);
    document.addEventListener('input', handleInput);
    document.addEventListener('submit', handleSubmit);
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog(dialog);
    }));
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) { event.preventDefault(); openSearch(); }
    });
  }

  function renderNavigation() {
    const links = NAV.map(item => `<a class="nav-link" href="${item.href}" data-nav="${item.id}"><span class="nav-link__icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></a>`).join('');
    document.getElementById('desktop-nav').innerHTML = links;
    document.getElementById('mobile-nav').innerHTML = links;
  }

  function updateNavigation() {
    const active = ui.route === 'book' || ui.route === 'session' ? (ui.route === 'book' ? 'path' : 'home') : ui.route;
    document.querySelectorAll('[data-nav]').forEach(link => {
      if (link.dataset.nav === active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const [eyebrow, title] = TITLES[ui.route] || TITLES.home;
    document.getElementById('view-eyebrow').textContent = eyebrow;
    document.getElementById('view-title').textContent = title;
    document.title = `BOO-P — ${title}`;
  }

  function render(shouldFocus = false) {
    parseRoute();
    if (ui.route === 'session' && !store.getActiveSession()) { location.hash = '#home'; return; }
    updateNavigation(); updateHeader();
    const view = document.getElementById('main-view');
    const renderers = { home: renderHome, community: renderCommunity, path: renderPath, profile: renderProfile, session: renderSession, book: renderBookDetail };
    try { view.innerHTML = renderers[ui.route](); }
    catch (error) {
      console.error('BOO-P render error', error);
      view.innerHTML = `<section class="empty-state" role="alert"><h1>Un passage s’est refermé trop vite</h1><p>Vos données locales sont intactes. Vous pouvez revenir à l’Accueil et réessayer.</p><a class="button button--primary" href="#home">Revenir à l’Accueil</a></section>`;
    }
    if (shouldFocus) view.focus({ preventScroll: true });
    checkCelebrations();
    tickSessionClock();
  }

  function updateHeader() {
    const profile = store.getProfile();
    const shortcut = document.getElementById('profile-shortcut');
    shortcut.textContent = initials(profile.name); shortcut.setAttribute('aria-label', `Ouvrir le profil de ${profile.name}`);
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
    const inProgress = store.getBooks().filter(book => book.status === 'en-cours' && book.libraryState === 'library');
    const openSessions = store.getActiveSessions();
    const progress = active ? bookProgress(active) : null;
    const memory = getMemoryItems();
    const weekPct = pct(goals.week.value, goals.week.target), monthPct = pct(goals.month.value, goals.month.target), yearPct = pct(goals.year.value, goals.year.target);
    return `
      <section class="page-head"><div><p class="eyebrow">Bonjour ${esc(profile.name)}</p><h1>Où en est votre lecture&nbsp;?</h1><p>Un regard calme sur votre régularité, vos livres et ce que vous souhaitez garder.</p></div><span class="privacy-badge">Profil ${profile.visibility === 'private' ? 'privé' : 'public'}</span></section>

      <section class="card streak-card" aria-labelledby="regularity-title">
        <div class="section-heading"><div><p class="eyebrow">Semaine du lundi au dimanche</p><h2 id="regularity-title">Régularité quotidienne</h2></div><button class="text-link" type="button" data-action="show-week-detail">Voir le détail</button></div>
        <div class="day-rings">${goals.week.days.map(day => `<button class="day-ring ${day.today ? 'is-today' : ''} ${day.reached ? 'is-reached' : ''}" type="button" data-action="show-day" data-day="${day.key}" style="--progress:${Math.min(360, pct(day.minutes, day.target) * 3.6)}deg" aria-label="${day.label}, ${day.minutes} minutes sur ${day.target}${day.today ? ', aujourd’hui' : ''}"><span>${day.label}</span></button>`).join('')}</div>
        <div class="streak-summary"><strong>${goals.week.value}/${goals.week.target} jours atteints</strong><span>Aujourd’hui&nbsp;: ${goals.week.todayMinutes}/${goals.week.dailyTarget} min</span></div>
      </section>

      <section class="section-block" aria-labelledby="home-goals-title">
        <div class="section-heading"><h2 id="home-goals-title">Objectifs</h2><a class="text-link" href="#path?tab=goals">Ajuster dans Parcours</a></div>
        <div class="goal-grid">
          ${goalMini('Semaine', `${goals.week.value}/${goals.week.target} jours`, weekPct)}
          ${goalMini('Mois', `${goals.month.value}/${goals.month.target} livres`, monthPct)}
          ${goalMini('Année', `${goals.year.value}/${goals.year.target} livres`, yearPct)}
        </div>
      </section>

      <section class="section-block card active-book-card" aria-labelledby="active-book-title">
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
        <div class="button-row">
          ${active ? `<button class="button button--primary" type="button" data-action="${session ? 'resume-session' : 'start-session'}" data-id="${attr(session?.id || '')}">${session ? 'Reprendre cette session' : 'Démarrer une session'}</button><button class="button button--secondary" type="button" data-action="quick-trace" data-book-id="${attr(active.id)}">Laisser une Trace</button>` : `<a class="button button--primary" href="#path?tab=library">Choisir un livre</a>`}
          <button class="button button--ghost" type="button" data-action="manual-session">Ajouter une session passée</button>
        </div>
        ${openSessions.length > 1 ? `<div class="open-session-list" aria-label="Sessions ouvertes">${openSessions.map(item => { const itemBook = store.getBookById(item.bookId); return `<button class="open-session-chip" type="button" data-action="focus-session" data-id="${attr(item.id)}"><span>${item.status === 'running' ? '▶' : 'Ⅱ'}</span><strong>${esc(itemBook?.title || 'Livre')}</strong><small>${formatDuration(store.activeDuration(item))}</small></button>`; }).join('')}</div>` : ''}
      </section>

      <section class="section-block" aria-labelledby="memory-title">
        <div class="section-heading"><div><p class="eyebrow">${memory.length} devinettes à réviser</p><h2 id="memory-title">Mémoire active</h2><p class="small muted">Ouvrez une carte pour révéler le mot, l’expression ou la Trace.</p></div><a class="text-link" href="#path?tab=lexicon">Mon lexique</a></div>
        <div class="memory-list" aria-label="Devinettes de la mémoire active">${memory.map((item,index) => renderMemoryQuiz(item,index)).join('')}</div>
        <p class="memory-reminder small muted">Révisions préparées à J+1, J+3, J+5 et J+30. Les rappels distants seront activés ultérieurement.</p>
      </section>`;
  }

  function goalMini(label, value, progress) {
    return `<a class="goal-mini" href="#path?tab=goals" aria-label="${label}, ${value}"><span class="progress-ring" style="--pct:${progress}"><span>${progress}%</span></span><span><strong>${label}</strong><small>${value}</small></span></a>`;
  }

  function makeClozeMemory(text, source, kind = 'Trace personnelle', date = new Date().toISOString()) {
    const stopWords = new Set(['alors','après','avant','avec','avoir','cette','comme','dans','depuis','entre','était','faire','leurs','livre','mais','même','notre','parce','pour','quand','sans','sous','toute','très','votre']);
    const words = String(text || '').match(/[A-Za-zÀ-ÖØ-öø-ÿŒœ'-]{5,}/g) || [];
    const answer = words.filter(word => !stopWords.has(normalize(word))).sort((a, b) => b.length - a.length)[0] || words[0];
    if (!answer) return null;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const clue = String(text).replace(new RegExp(`\\b${escaped}\\b`, 'i'), '_____');
    return { kind, question:`Quel mot manque dans ce passage : « ${clue} » ?`, answer, detail:String(text), source, date };
  }

  function memoryDefinitionClue(definition, answer) {
    const escaped = String(answer || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped ? String(definition || '').replace(new RegExp(escaped, 'gi'), '_____') : String(definition || '');
  }

  function lexiconMemoryMeta(item) {
    const next = (item.reviewSchedule || []).find(stage => !stage.completedAt);
    if (!next) return { memoryId:item.id, memoryType:'lexicon', reviewLabel:'Cycle initial terminé · révisions aléatoires à venir' };
    const due = new Date(next.dueAt), dueToday = due.getTime() <= Date.now();
    const step = next.random ? 'Révision aléatoire' : `Étape J+${next.day}`;
    return { memoryId:item.id, memoryType:'lexicon', reviewLabel:dueToday ? `${step} · à revoir maintenant` : `${step} · prévue le ${formatDate(next.dueAt)}` };
  }

  function getMemoryItems() {
    const books = store.getBooks();
    const personal = [
      ...store.getLexicon().map(item => ({ ...(item.kind === 'citation' ? makeClozeMemory(item.word, item.bookTitle || 'Citation personnelle', 'Citation à compléter', item.updatedAt) : { kind:item.kind === 'expression' ? 'Expression à retrouver' : 'Mot à retrouver', question:`${item.kind === 'expression' ? 'Quelle expression' : 'Quel mot'} correspond à cette explication : « ${memoryDefinitionClue(item.definition, item.word)} » ?`, answer:item.word, detail:item.definition, source:item.bookTitle || 'Note personnelle', date:item.updatedAt }), ...lexiconMemoryMeta(item) })),
      ...store.getTraces().map(item => makeClozeMemory(item.text, books.find(book => book.id === item.bookId)?.title || 'Trace personnelle', 'Trace à compléter', item.createdAt))
    ].filter(Boolean).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    const examples = [
      { kind:'Mot à retrouver', question:'Je suis un manuscrit ancien dont le texte visible recouvre une écriture effacée. Qui suis-je ?', answer:'Palimpseste', detail:'Un manuscrit réutilisé après effacement d’un premier texte.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis une révélation soudaine qui fait apparaître le sens d’une situation. Qui suis-je ?', answer:'Épiphanie', detail:'Une manifestation ou une compréhension soudaine et lumineuse.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis une intention fragile qui ne se transforme presque jamais en action. Qui suis-je ?', answer:'Velléité', detail:'Une volonté faible ou passagère, sans effet réel.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je désigne un jugement fin, lucide et perspicace. Qui suis-je ?', answer:'Sagacité', detail:'La capacité à comprendre rapidement et justement.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Chez les philosophes antiques, je suis la tranquillité de l’âme libérée des troubles. Qui suis-je ?', answer:'Ataraxie', detail:'Un état de sérénité et d’absence de trouble.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je donne l’impression d’être présent partout à la fois. Qui suis-je ?', answer:'Ubiquité', detail:'Le fait d’être ou de sembler être en plusieurs lieux simultanément.', source:'Exemple BOO-P' },
      { kind:'Expression à retrouver', question:'Je suis une phrase brève qui condense une pensée ou une vérité. Qui suis-je ?', answer:'Aphorisme', detail:'Une formule concise exprimant une idée générale.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je me situe au seuil d’un ouvrage et j’en ouvre la lecture. Qui suis-je ?', answer:'Liminaire', detail:'Ce qui est placé au commencement d’un texte ou sert d’introduction.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je ne peux pas être exprimé avec des mots tant je dépasse le langage. Qui suis-je ?', answer:'Indicible', detail:'Ce qu’on ne peut pas dire ou décrire.', source:'Exemple BOO-P' },
      { kind:'Mot à retrouver', question:'Je suis la capacité à se reconstruire après une épreuve. Qui suis-je ?', answer:'Résilience', detail:'La faculté de retrouver un équilibre après un choc ou une difficulté.', source:'Exemple BOO-P' }
    ];
    return personal.concat(examples.slice(0, Math.max(0, 10 - personal.length))).slice(0, 10);
  }

  function renderMemoryQuiz(item, index) {
    const review = item.memoryType === 'lexicon' ? `<div class="memory-review-actions"><small class="muted">${esc(item.reviewLabel)}</small><div class="button-row"><button class="button button--sage button--small" type="button" data-action="memory-recalled" data-id="${attr(item.memoryId)}">Je l’ai retrouvé</button><button class="button button--ghost button--small" type="button" data-action="memory-retry" data-id="${attr(item.memoryId)}">À revoir demain</button></div></div>` : '';
    return `<details class="card memory-quiz"><summary><span class="memory-quiz__index">${String(index + 1).padStart(2,'0')}</span><span><span class="status-chip">${esc(item.kind)}</span><strong>${esc(item.question)}</strong></span><span class="memory-quiz__hint">Voir la réponse</span></summary><div class="memory-quiz__answer"><p class="eyebrow">Réponse</p><h3>${esc(item.answer)}</h3><p>${esc(item.detail || '')}</p><small class="muted">${esc(item.source)}</small>${review}</div></details>`;
  }

  function renderSession() {
    const session = store.getActiveSession();
    if (!session) return '';
    const book = store.getBookById(session.bookId);
    const sessions = store.getActiveSessions(), audio = book.mediaType === 'audio';
    const max = audio ? (book.durationMinutes || 99999) : (book.totalPages || 99999);
    return `<section class="session-view">
      <div class="session-top"><button class="button button--ghost" type="button" data-action="leave-session">← Accueil</button>${sessions.length > 1 ? `<label class="session-switcher">Session<select data-change="focus-session">${sessions.map(item => { const itemBook = store.getBookById(item.bookId); return `<option value="${attr(item.id)}" ${item.id === session.id ? 'selected' : ''}>${esc(itemBook?.title || 'Livre')} · ${item.status === 'running' ? 'en lecture' : 'en pause'}</option>`; }).join('')}</select></label>` : ''}<span class="simulated-badge">Sauvegarde locale active</span></div>
      <div class="session-book">${cover(book,'small')}<div><p class="eyebrow">Lecture en cours</p><h1>${esc(book.title)}</h1><p class="muted">${esc(book.authors.join(', '))}</p></div></div>
      <div class="session-timer"><span class="session-timer__value" data-session-clock>${formatDuration(store.activeDuration(session))}</span><span class="session-timer__status">${session.status === 'paused' ? 'En pause' : 'En lecture'}</span>${session.autoPaused ? '<p class="small muted">BOO-P a mis cette session en pause après 30 minutes en arrière-plan.</p>' : ''}</div>
      <div class="session-controls"><button class="button button--secondary" type="button" data-action="quick-trace">Trace</button><button class="button button--secondary" type="button" data-action="session-lexicon">+ Lexique</button><button class="button button--primary session-control-main" type="button" data-action="toggle-session" aria-label="${session.status === 'paused' ? 'Reprendre' : 'Mettre en pause'}">${session.status === 'paused' ? '▶' : 'Ⅱ'}</button><button class="button button--sage" type="button" data-action="finish-session">Terminer</button></div>
      <aside class="card card-pad session-panel">
        <p class="eyebrow">Progression et note</p><div class="form-grid">
          <label class="field">${audio ? 'Minute atteinte' : 'Page atteinte'}<input type="number" min="0" max="${max}" value="${session.endPage}" data-change="session-page"><span class="field-help">Bornée à ${audio ? `${book.durationMinutes || 'la durée connue'} minutes` : `${book.totalPages || 'la valeur connue du livre'} pages`}.</span></label>
          <label class="field">Note de session<textarea data-input="session-note" placeholder="Une impression à garder…">${esc(session.note)}</textarea></label>
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
      ['public','Public'], ['clubs','Mes clubs'], ['salons','Salons'], ['friends','Amis']
    ];
    const bodies = { public: renderPublicFeed, clubs: renderClubs, salons: renderSalons, friends: renderFriends };
    return `<section class="page-head"><div><p class="eyebrow">Des échanges sans classement</p><h1>Communauté</h1><p>Découvrez des lectures partagées et choisissez toujours ce qui devient visible.</p></div><span class="simulated-badge">Exemples fictifs · contributions Supabase</span></section>
      <nav class="tabs" aria-label="Sections de la Communauté">${tabs.map(([id,label]) => `<a class="tab" href="#community?tab=${id}" aria-current="${ui.communityTab === id ? 'page' : 'false'}">${label}</a>`).join('')}</nav>
      ${bodies[ui.communityTab]()}`;
  }

  function renderPublicFeed() {
    const posts = store.getCommunity().posts.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    return `<div class="section-heading"><div><h2>Fil public</h2><p class="small muted">10 exemples fictifs, avec ou sans photo, puis les Traces réellement enregistrées. Rien n’est publié automatiquement.</p></div><button class="button button--primary button--small" type="button" data-action="create-post">Laisser une Trace</button></div>
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
      ${post.bookTitle ? `<p class="eyebrow">${esc(post.bookTitle)}</p>` : ''}<p class="activity-text">${esc(post.text)}</p>
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
    return ({ fin: 'a terminé une lecture', debut: 'a commencé une lecture', trace: 'a partagé une Trace', goal: 'a atteint un objectif' })[post.type] || 'a partagé une lecture';
  }

  function renderComments(post) {
    return `<div class="comments"><form class="inline-form" data-form="comment" data-post-id="${attr(post.id)}"><label class="sr-only" for="comment-${attr(post.id)}">Votre Trace pour ${attr(post.authorName)}</label><input id="comment-${attr(post.id)}" name="text" required maxlength="500" placeholder="Une réponse bienveillante…"><button class="button button--sage button--small" type="submit">Envoyer</button></form>
      ${post.comments.length ? post.comments.map(comment => `<div class="comment"><p><strong>${esc(comment.authorName)}</strong> · <span class="muted">${relativeDate(comment.date)}</span></p><p>${esc(comment.text)}</p><button class="text-link small" type="button" data-action="reply-comment" data-post-id="${attr(post.id)}" data-id="${attr(comment.id)}">Répondre</button>${(comment.replies || []).map(reply => `<div class="comment-reply"><strong>${esc(reply.authorName)}</strong><p>${esc(reply.text)}</p></div>`).join('')}</div>`).join('') : '<p class="small muted">Soyez la première personne à laisser une Trace.</p>'}</div>`;
  }

  function renderClubs() {
    const clubs = store.getCommunity().clubs;
    return `<div class="section-heading"><div><h2>Clubs</h2><p class="small muted">Les clubs créés sont enregistrés dans Supabase ; adhésions et salons restent simulés.</p></div><button class="button button--primary button--small" type="button" data-action="create-club">Créer un club</button></div>
      <div class="grid-2">${clubs.map(club => `<article class="card club-card"><span class="club-mark" style="--club-color:${attr(club.color)}"></span><div class="card-content"><div class="button-row"><span class="privacy-badge">${club.visibility === 'private' ? 'Privé' : 'Public'}</span>${club.role ? `<span class="status-chip">${club.role === 'owner' ? 'Propriétaire' : club.role === 'moderator' ? 'Modérateur' : 'Membre'}</span>` : ''}</div><h3>${esc(club.name)}</h3><p class="small muted">${esc(club.description)}</p><p class="small"><strong>Livre actuel :</strong> ${esc(club.bookTitle || 'À choisir')}</p><p class="micro muted">${club.membersCount} membres · ${club.access === 'open' ? 'accès libre' : 'sur approbation'}</p><div class="card-actions"><button class="button ${club.joined ? 'button--secondary' : 'button--sage'} button--small" type="button" data-action="toggle-club" data-id="${attr(club.id)}">${club.joined ? 'Quitter le club' : club.access === 'open' ? 'Rejoindre' : 'Demander à rejoindre'}</button><button class="button button--ghost button--small" type="button" data-action="club-details" data-id="${attr(club.id)}">Voir l’historique</button></div></div></article>`).join('')}</div>`;
  }

  function renderSalons() {
    const community = store.getCommunity(), salons = community.salons, canCreate = community.clubs.some(club => club.role === 'owner');
    return `<div class="section-heading"><div><h2>Salons de lecture</h2><p class="small muted">Présence et échanges simulés sur cet appareil.</p></div><div class="button-row">${canCreate ? '<button class="button button--primary button--small" type="button" data-action="create-salon">Créer un salon</button>' : ''}<span class="simulated-badge">Pas de temps réel</span></div></div>
      <div class="grid-2">${salons.map(salon => `<article class="card salon-card"><div class="card-content"><div class="button-row"><span class="status-chip ${salon.status === 'scheduled' ? 'status-chip--warning' : ''}">${salon.status === 'scheduled' ? 'Programmé' : salon.status === 'live' ? 'En cours' : 'Terminé'}</span><span class="privacy-badge">${esc(salon.clubName)}</span></div><h3>${esc(salon.title)}</h3><p class="small"><strong>${esc(salon.bookTitle)}</strong> · ${formatDateTime(salon.scheduledAt)}</p><div class="participant-list">${salon.participants.map(person => `<span class="participant">${esc(person.name)} · ${salonStatus(person.status)} · ${person.minutes} min</span>`).join('')}</div><p class="micro muted">Progression en pages ${salon.sharePages ? 'partagée avec accord' : 'masquée par défaut'}.</p><div class="card-actions"><button class="button ${salon.joined ? 'button--secondary' : 'button--sage'} button--small" type="button" data-action="toggle-salon" data-id="${attr(salon.id)}">${salon.joined ? (salon.status === 'scheduled' ? 'Inscrit' : 'Ouvrir le salon') : 'Rejoindre'}</button><button class="button button--ghost button--small" type="button" data-action="salon-thread" data-id="${attr(salon.id)}">Discussion · ${salon.messages.length}</button></div></div></article>`).join('')}</div>`;
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
      <p class="small muted">Recherche réelle parmi les comptes BOO-P. Les profils privés restent limités à leur aperçu tant que la demande n’est pas acceptée.</p>
      ${ui.friendSearchBusy ? '<div class="view-loading" role="status"><span class="loader" aria-hidden="true"></span> Recherche des lecteurs…</div>' : `<div class="grid-2">${users.length ? users.map(user => `<article class="card friend-card"><span class="avatar">${esc(user.initials)}</span><div class="card-content"><h3>${esc(user.name)}</h3><p class="micro muted">${esc(user.handle || '')}</p><p class="small muted">${accessLabel(user)}</p><div class="card-actions">${friendAction(user)}<button class="button button--ghost button--small" type="button" data-action="view-user" data-id="${attr(user.id)}">${user.profileVisibility === 'private' && user.friendState !== 'friend' ? 'Voir l’aperçu' : 'Voir le profil'}</button></div></div><details class="safety-menu"><summary aria-label="Options de sécurité">•••</summary><div class="safety-menu__panel"><button type="button" data-action="report-user" data-id="${attr(user.id)}">Signaler</button><button type="button" data-action="block-user" data-id="${attr(user.id)}">Bloquer</button></div></details></article>`).join('') : `<div class="empty-state"><h3>Aucun lecteur trouvé</h3><p>${ui.friendQuery ? 'Essayez un prénom ou un pseudonyme plus court.' : 'Aucun autre compte BOO-P n’est encore visible.'}</p></div>`}</div>`}`;
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
    const tabs = [['library','Ma bibliothèque'],['trail','Mon sentier'],['lexicon','Mon lexique'],['goals','Objectifs']];
    const bodies = { library: renderLibrary, trail: renderTrail, lexicon: renderLexicon, goals: renderGoals };
    return `<section class="page-head"><div><p class="eyebrow">Livres, mémoire et objectifs</p><h1>Parcours</h1><p>Votre cheminement reste modifiable : corrigez une page, un statut ou une ancienne lecture à tout moment.</p></div></section>
      <nav class="tabs" aria-label="Sections de Parcours">${tabs.map(([id,label]) => `<a class="tab" href="#path?tab=${id}" aria-current="${ui.pathTab === id ? 'page' : 'false'}">${label}</a>`).join('')}</nav>${bodies[ui.pathTab]()}`;
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
    const view = settings.libraryView === 'grid' ? 'grid' : 'shelf';
    return `<div class="toolbar"><label class="search-field" for="library-search"><span aria-hidden="true">⌕</span><input id="library-search" data-input="library-search" type="search" value="${attr(ui.libraryQuery)}" placeholder="Titre, auteur ou rayon…"></label><label class="sr-only" for="library-status">Filtrer la bibliothèque</label><select id="library-status" data-change="library-status"><option value="tous" ${ui.libraryStatus === 'tous' ? 'selected' : ''}>Ma bibliothèque</option><option value="wishlist" ${ui.libraryStatus === 'wishlist' ? 'selected' : ''}>Ma wishlist</option>${Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${value}" ${ui.libraryStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select><label class="sr-only" for="library-sort">Trier les livres</label><select id="library-sort" data-change="library-sort"><option value="author" ${sort === 'author' ? 'selected' : ''}>Par auteur</option><option value="title" ${sort === 'title' ? 'selected' : ''}>Par titre</option><option value="recent" ${sort === 'recent' ? 'selected' : ''}>Ajouts récents</option><option value="status" ${sort === 'status' ? 'selected' : ''}>Par statut</option></select><div class="view-toggle" role="group" aria-label="Affichage de la bibliothèque"><button class="icon-button" type="button" data-action="library-view" data-view="shelf" aria-pressed="${view === 'shelf'}" title="Meuble bibliothèque">▥</button><button class="icon-button" type="button" data-action="library-view" data-view="grid" aria-pressed="${view === 'grid'}" title="Grille de couvertures">▦</button></div><button class="button button--primary" type="button" data-action="add-book">Ajouter un livre</button></div>
      ${books.length ? renderLibraryBooks(books, view) : `<div class="empty-state"><h3>${ui.libraryStatus === 'wishlist' ? 'Votre wishlist est prête à accueillir des envies' : 'Aucun livre ne correspond'}</h3><p>${ui.libraryStatus === 'wishlist' ? 'Ajoutez une suggestion ou un livre manuellement.' : 'Modifiez le filtre ou ajoutez un ouvrage manuellement.'}</p><button class="button button--primary" type="button" data-action="add-book">Ajouter un livre</button></div>`}
      ${renderRecommendations()}`;
  }

  function renderLibraryBooks(books, view) {
    const renderCard = book => {
      const progress = bookProgress(book);
      const meta = book.libraryState === 'wishlist' ? '<span class="status-chip">Wishlist</span>' : `<span class="status-chip ${book.status === 'en-cours' ? 'status-chip--active' : ''}">${STATUS_LABELS[book.status]}</span><span class="micro muted">${SITUATION_LABELS[book.situation]}</span>`;
      return `<button class="book-card ${view === 'shelf' ? 'book-card--shelf' : ''}" type="button" data-action="open-book" data-id="${attr(book.id)}" aria-label="Ouvrir ${attr(book.title)}, ${MEDIA_LABELS[book.mediaType] || 'livre'}">${cover(book)}<strong>${esc(book.title)}</strong><small>${esc(book.authors.join(', '))}</small>${book.libraryState === 'library' ? `<div class="progress-track" aria-label="${attr(progress.label)}"><span style="--width:${pct(progress.value,progress.total)}%"></span></div>` : ''}<div class="book-meta-row"><span class="media-chip">${book.mediaType === 'audio' ? '🎧' : book.mediaType === 'ebook' ? '▤' : '▥'}</span>${meta}</div></button>`;
    };
    if (view !== 'shelf') return `<div class="book-grid">${books.map(renderCard).join('')}</div>`;
    const settings = store.getSettings(), collapsed = new Set(settings.collapsedLibraryGenres || []), groups = new Map();
    books.forEach(book => { const genre = String(book.genre || '').trim() || 'À classer'; if (!groups.has(genre)) groups.set(genre, []); groups.get(genre).push(book); });
    const ordered = [...groups.entries()].sort(([a],[b]) => a === 'À classer' ? 1 : b === 'À classer' ? -1 : a.localeCompare(b, 'fr'));
    const shelves = ordered.map(([genre, items]) => {
      const genreKey = normalize(genre).replace(/\s+/g, '-') || 'a-classer';
      const isOpen = ui.libraryQuery || !collapsed.has(genreKey);
      return `<details class="genre-shelf" data-library-genre="${attr(genreKey)}" ${isOpen ? 'open' : ''}><summary><span>${esc(genre)}</span><small>${items.length} livre${items.length > 1 ? 's' : ''}</small></summary><div class="physical-shelf" role="group" aria-label="Rayon ${attr(genre)}">${items.map((book,index) => renderBookSpine(book,index)).join('')}</div></details>`;
    }).join('');
    return `<div class="bookcase" aria-label="Bibliothèque physique organisée par rayons"><div class="bookcase__top"></div>${shelves}</div>`;
  }

  function renderBookSpine(book, index) {
    let hash = index + 17; for (const character of `${book.genre}${book.title}`) hash = character.charCodeAt(0) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360, width = 27 + Math.abs(hash % 13), height = 122 + Math.abs((hash >> 4) % 45);
    return `<button class="book-spine" type="button" data-action="open-book" data-id="${attr(book.id)}" title="${attr(book.title)}" aria-label="Ouvrir ${attr(book.title)}, ${attr(book.authors.join(', '))}, rayon ${attr(book.genre || 'À classer')}" style="--spine-h:${height}px;--spine-w:${width}px;--spine-a:hsl(${hue} 46% 40%);--spine-b:hsl(${(hue + 24) % 360} 50% 56%)"><span>${esc(book.title)}</span></button>`;
  }

  function handleLibraryShelfToggle(event) {
    const shelf = event.target;
    if (!(shelf instanceof HTMLDetailsElement) || !shelf.matches('[data-library-genre]')) return;
    const settings = store.getSettings(), collapsed = new Set(settings.collapsedLibraryGenres || []), key = shelf.dataset.libraryGenre;
    if (shelf.open) collapsed.delete(key); else collapsed.add(key);
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
    const events = store.getTimeline();
    return `<div class="section-heading"><div><h2>Mon sentier</h2><p class="small muted">Lectures, sessions, Traces, objectifs et circulation du livre.</p></div></div>${events.length ? `<div class="timeline">${events.map(event => `<article class="timeline-item"><time datetime="${attr(event.date)}">${formatDate(event.date)}</time><h3>${esc(event.label)}</h3>${event.bookId ? `<button class="text-link small" type="button" data-action="open-book" data-id="${attr(event.bookId)}">Voir le livre</button>` : ''}</article>`).join('')}</div>` : `<div class="empty-state"><h3>Votre sentier commence ici</h3><p>Démarrez une lecture ou ajoutez une ancienne lecture.</p><a class="button button--primary" href="#path?tab=library">Ma bibliothèque</a></div>`}`;
  }

  function renderLexicon() {
    const entries = store.getLexicon().filter(item => normalize(`${item.word} ${item.definition} ${item.bookTitle}`).includes(normalize(ui.lexiconQuery)));
    return `<div class="toolbar"><label class="search-field" for="lexicon-search"><span aria-hidden="true">⌕</span><input id="lexicon-search" data-input="lexicon-search" type="search" value="${attr(ui.lexiconQuery)}" placeholder="Mot, définition ou livre…"></label><button class="button button--primary" type="button" data-action="add-lexicon">Ajouter une entrée</button></div>
      ${entries.length ? `<div class="lexicon-grid">${entries.map(item => `<article class="card lexicon-card"><h3>${esc(item.word)}</h3><p>${esc(item.definition)}</p><footer>${item.bookTitle ? `${esc(item.bookTitle)}${item.page ? ` · p. ${item.page}` : ''}` : 'Sans livre associé'} · révisé ${formatDate(item.updatedAt)}</footer><div class="card-actions"><button class="text-link small" type="button" data-action="edit-lexicon" data-id="${attr(item.id)}">Modifier</button><button class="text-link small" type="button" data-action="delete-lexicon" data-id="${attr(item.id)}">Supprimer</button></div></article>`).join('')}</div>` : `<div class="empty-state"><h3>Le mot ne s’est pas encore présenté</h3><p>Ajoutez une explication personnelle ou élargissez la recherche.</p><button class="button button--primary" type="button" data-action="add-lexicon">Ajouter un mot</button></div>`}`;
  }

  function renderGoals() {
    const progress = store.getGoalProgress(), state = store.getState().goals;
    return `<div class="grid-3">
      ${goalCard('week','Cette semaine',`${progress.week.value}/${progress.week.target} jours`,`Lire ${state.week.dailyMinutes} min par jour`,pct(progress.week.value,progress.week.target),state.week.history)}
      ${goalCard('month','Ce mois',`${progress.month.value}/${progress.month.target} livres`,'Livres terminés sur le mois civil',pct(progress.month.value,progress.month.target),state.month.history)}
      ${goalCard('year','Cette année',`${progress.year.value}/${progress.year.target} livres`,'Lectures terminées cette année',pct(progress.year.value,progress.year.target),state.year.history)}
    </div><p class="small muted section-block">Les lectures marquées « Lu avant mon inscription » sans date de fin ne comptent pas. La progression se recalcule immédiatement selon les livres sélectionnés et leur date de fin.</p>
    <section class="card monthly-report-cta section-block" aria-labelledby="monthly-report-title"><div><p class="eyebrow">Image 1080 × 1350 · prête à publier</p><h2 id="monthly-report-title">Votre mois de lecture, en un regard</h2><p class="small muted">Livres lus, temps de lecture, mots, expressions et citations. Avant la création, vous choisissez si vos notes personnelles peuvent apparaître.</p></div><button class="button button--primary" type="button" data-action="open-monthly-report">Créer le rapport mensuel</button></section>`;
  }

  function goalCard(period, title, value, description, progress, history) {
    return `<article class="card goal-card"><div class="goal-card__head"><div><p class="eyebrow">Objectif principal</p><h2>${title}</h2></div><span class="progress-ring" style="--pct:${progress}"><span>${progress}%</span></span></div><p class="goal-card__value">${value}</p><p class="small muted">${description}</p><div class="goal-detail-list">${(history || []).map(item => `<span><span>${esc(item.label)}</span><strong>${esc(item.result)}</strong></span>`).join('')}</div><button class="button button--secondary button--small" type="button" data-action="edit-goal" data-period="${period}">Modifier</button></article>`;
  }

  function renderBookDetail() {
    const id = ui.params.get('id'), book = store.getBookById(id);
    if (!book) return `<div class="empty-state"><h1>Livre introuvable</h1><p>Il a peut-être été retiré de cette bibliothèque locale.</p><a class="button button--primary" href="#path?tab=library">Retour à la bibliothèque</a></div>`;
    const sessions = store.getSessionsForBook(id), traces = store.getTraces(id), lexicon = store.getLexicon().filter(item => item.bookId === id), openSession = store.getActiveSessionForBook(id), progress = bookProgress(book), wishlist = book.libraryState === 'wishlist', audio = book.mediaType === 'audio';
    return `<a class="text-link" href="#path?tab=${wishlist ? 'library' : 'library'}">← Ma bibliothèque</a><section class="book-detail-head section-block">${cover(book,'large')}<div class="book-detail-copy"><div class="button-row"><span class="status-chip ${book.status === 'en-cours' ? 'status-chip--active' : ''}">${wishlist ? 'Wishlist' : STATUS_LABELS[book.status]}</span>${!wishlist ? `<span class="privacy-badge">${SITUATION_LABELS[book.situation]}</span>` : ''}<span class="media-chip">${MEDIA_LABELS[book.mediaType] || 'Livre'}</span>${book.historicalBeforeJoin ? '<span class="status-chip">Lu avant mon inscription</span>' : ''}</div><h1>${esc(book.title)}</h1><p class="muted">${esc(book.authors.join(', '))}</p><p>${esc(book.description || 'Aucun résumé pour cette édition.')}</p>${!wishlist ? `<div class="progress-track" aria-label="Progression ${pct(progress.value,progress.total)} %"><span style="--width:${pct(progress.value,progress.total)}%"></span></div><p class="small muted">${progress.label}${book.rating ? ` · appréciation ${'🔖'.repeat(book.rating)}` : ''}</p>` : '<p class="small muted">Envie de lecture conservée dans votre wishlist.</p>'}<div class="button-row">${wishlist ? `<button class="button button--primary" type="button" data-action="move-to-library" data-id="${attr(id)}">Ajouter à ma bibliothèque</button>` : `<button class="button button--primary" type="button" data-action="book-session" data-id="${attr(id)}">${openSession ? 'Reprendre la session' : 'Démarrer une session'}</button>`}<button class="button button--ghost" type="button" data-action="edit-book" data-id="${attr(id)}">Modifier</button></div></div></section>
      <div class="grid-2">
        <section class="card card-pad"><div class="section-heading"><h2>Édition et progression</h2><button class="text-link" type="button" data-action="edit-book" data-id="${attr(id)}">Modifier</button></div><dl class="metadata-list"><div><dt>Rayon</dt><dd>${esc(book.genre || 'À classer')}</dd></div><div><dt>Éditeur</dt><dd>${esc(book.publisher || 'Non renseigné')}</dd></div><div><dt>Édition</dt><dd>${esc(book.edition || 'Non renseignée')}</dd></div>${audio ? `<div><dt>Support</dt><dd>Livre audio</dd></div><div><dt>Durée</dt><dd>${book.durationMinutes || 'Non renseignée'} min</dd></div><div><dt>Narration</dt><dd>${esc(book.narrator || 'Non renseignée')}</dd></div><div><dt>Plateforme</dt><dd>${esc(book.audioPlatform || 'Non renseignée')}</dd></div>` : `<div><dt>Format</dt><dd>${esc(book.format || (book.mediaType === 'ebook' ? 'Livre numérique' : 'Non renseigné'))}</dd></div><div><dt>Pages</dt><dd>${book.totalPages || 'Non renseigné'}</dd></div>`}<div><dt>Statut</dt><dd>${wishlist ? 'Wishlist' : STATUS_LABELS[book.status]}</dd></div>${!wishlist ? `<div><dt>Situation</dt><dd>${SITUATION_LABELS[book.situation]}</dd></div>` : ''}</dl></section>
        <section class="card card-pad"><div class="section-heading"><h2>Sessions</h2><button class="text-link" type="button" data-action="manual-session" data-book-id="${attr(id)}">Ajouter une session passée</button></div>${sessions.length ? `<div class="history-list">${sessions.map(session => `<div class="history-item"><span class="history-item__icon">◷</span><div class="history-item__content"><strong>${Math.round(session.durationSeconds/60)} min · ${audio ? 'min.' : 'p.'} ${session.startPage} à ${session.endPage}</strong><span class="small muted">${formatDate(session.startedAt)}${session.manual ? ' · ajoutée manuellement' : ''}</span></div><button class="text-link small" type="button" data-action="edit-session" data-id="${attr(session.id)}">Modifier</button></div>`).join('')}</div>` : `<p class="small muted">Aucune session enregistrée.</p>`}</section>
        <section class="card card-pad"><div class="section-heading"><h2>Traces</h2><button class="text-link" type="button" data-action="quick-trace" data-book-id="${attr(id)}">Ajouter</button></div>${traces.length ? traces.map(trace => `<article class="history-item"><span class="history-item__icon">✦</span><div class="history-item__content"><strong>${esc(trace.text)}</strong><span class="small muted">${trace.page ? `${audio ? 'min.' : 'p.'} ${trace.page} · ` : ''}${VISIBILITY_LABELS[trace.privacy] || 'Privé'}</span></div></article>`).join('') : '<p class="small muted">Aucune Trace pour ce livre.</p>'}</section>
        <section class="card card-pad"><div class="section-heading"><h2>Lexique</h2><button class="text-link" type="button" data-action="add-lexicon" data-book-id="${attr(id)}">Ajouter</button></div>${lexicon.length ? lexicon.map(item => `<article class="history-item"><span class="history-item__icon">Aa</span><div class="history-item__content"><strong>${esc(item.word)}</strong><span class="small muted">${esc(item.definition)}</span></div></article>`).join('') : '<p class="small muted">Aucune entrée associée.</p>'}</section>
      </div><div class="danger-zone section-block"><h2>Retirer ce livre</h2><p class="small">La suppression retire aussi ses sessions et ses Traces locales. Une confirmation est obligatoire.</p><button class="button button--danger" type="button" data-action="delete-book" data-id="${attr(id)}">Supprimer le livre</button></div>`;
  }

  function renderProfile() {
    const profile = store.getProfile(), settings = store.getSettings(), stats = store.getStats();
    let adn = store.getBooks().filter(book => book.isADN).sort((a,b) => (a.adnOrder ?? 99) - (b.adnOrder ?? 99)).slice(0,3);
    if (adn.length < 3) adn = adn.concat(store.getBooks().filter(book => !adn.some(item => item.id === book.id)).slice(0, 3 - adn.length));
    const progress = store.getGoalProgress(), badges = store.getBadges();
    return `<section class="card profile-hero"><button class="icon-button theme-button" type="button" data-action="toggle-theme" aria-label="Passer au thème ${settings.theme === 'dark' ? 'clair' : 'sombre'}" aria-pressed="${settings.theme === 'dark'}">${settings.theme === 'dark' ? '☀' : '☾'}</button><div class="profile-main"><span class="profile-avatar">${esc(initials(profile.name))}</span><div><p class="eyebrow">${esc(profile.title)}</p><h1>${esc(profile.name)}</h1><p class="muted">${esc(profile.handle || '')} · Profil ${profile.visibility === 'private' ? 'privé' : 'public'}</p></div></div><p>${esc(profile.bio || '')}</p><button class="button button--secondary button--small" type="button" data-action="edit-profile">Modifier le profil</button></section>
      <section class="section-block"><div class="section-heading"><div><p class="eyebrow">Trois livres, une ligne</p><h2>ADN du lecteur</h2></div><button class="text-link" type="button" data-action="edit-adn">Modifier</button></div><div class="adn-row">${adn.map(book => `<div class="adn-book">${cover(book)}<strong>${esc(book.title)}</strong></div>`).join('')}</div></section>
      <section class="section-block"><h2>Statistiques</h2><div class="stats-grid"><div class="card stat-card"><strong>${stats.booksRead}</strong><span>livres lus</span></div><div class="card stat-card"><strong>${Math.floor(stats.totalMinutes/60)} h ${stats.totalMinutes%60}</strong><span>temps de lecture</span></div><div class="card stat-card"><strong>${stats.streak}</strong><span>jours de série</span></div><div class="card stat-card"><strong>${stats.totalTraces}</strong><span>Traces et lexique</span></div><div class="card stat-card"><strong>${stats.booksTransmitted}</strong><span>prêtés ou donnés</span></div><div class="card stat-card"><strong>${progress.week.value}/${progress.week.target}</strong><span>objectif semaine</span></div><div class="card stat-card"><strong>${progress.month.value}/${progress.month.target}</strong><span>objectif mois</span></div><div class="card stat-card"><strong>${progress.year.value}/${progress.year.target}</strong><span>objectif année</span></div></div></section>
      ${renderLatestBadge(badges)}
      <section class="section-block"><h2>Compte et préférences</h2><div class="settings-list">
        <details class="setting-card"><summary>Informations du compte</summary><div class="setting-card__body"><p><strong>${esc(profile.email)}</strong></p><p class="small muted">Compte sécurisé et session persistante gérés par Supabase.</p><button class="button button--secondary button--small" type="button" data-action="simulated-password">Changer le mot de passe</button></div></details>
        <details class="setting-card"><summary>Confidentialité et visibilité</summary><div class="setting-card__body"><form class="form-grid" data-form="privacy"><fieldset><legend>Visibilité du profil</legend><label class="checkbox-row"><input type="radio" name="profileVisibility" value="private" ${profile.visibility === 'private' ? 'checked' : ''}><span><strong>Privé</strong><br><span class="muted">Vos détails sont visibles uniquement par vos amis. Recommandé et sélectionné par défaut.</span></span></label><label class="checkbox-row"><input type="radio" name="profileVisibility" value="public" ${profile.visibility === 'public' ? 'checked' : ''}><span><strong>Public</strong><br><span class="muted">Toute la communauté peut consulter le profil.</span></span></label></fieldset><label class="field">Visibilité par défaut des publications<select name="defaultVisibility"><option value="me" ${settings.defaultPostVisibility === 'me' ? 'selected' : ''}>Moi uniquement</option><option value="friends" ${settings.defaultPostVisibility === 'friends' ? 'selected' : ''}>Amis uniquement</option><option value="public" ${settings.defaultPostVisibility === 'public' ? 'selected' : ''}>Public</option></select></label><button class="button button--primary" type="submit">Enregistrer</button></form></div></details>
        <details class="setting-card"><summary>Préférences de notifications</summary><div class="setting-card__body"><form class="form-grid" data-form="notification-settings">${Object.entries({ friends:'Amitiés', encouragements:'Encouragements', traces:'Traces et réponses', clubs:'Clubs', salons:'Salons', goals:'Objectifs' }).map(([key,label]) => `<label class="checkbox-row"><input type="checkbox" name="${key}" ${settings.notifications[key] ? 'checked' : ''}> ${label}</label>`).join('')}<label class="checkbox-row"><input type="checkbox" name="remote" ${settings.notifications.remote ? 'checked' : ''} disabled> Notifications système du téléphone <span class="simulated-badge">prochaine étape</span></label><p class="small muted">Les notifications dans BOO-P sont synchronisées en temps réel. Les alertes sur l’écran verrouillé seront activées séparément.</p><button class="button button--primary" type="submit">Enregistrer</button></form></div></details>
        <details class="setting-card"><summary>Utilisateurs bloqués</summary><div class="setting-card__body">${settings.blockedUsers.length ? settings.blockedUsers.map(id => { const user = store.getCommunity().users.find(item => item.id === id); return `<div class="history-item"><div class="history-item__content"><strong>${esc(user?.name || 'Utilisateur')}</strong></div><button class="text-link small" type="button" data-action="unblock-user" data-id="${attr(id)}">Débloquer</button></div>`; }).join('') : '<p class="small muted">Aucun utilisateur bloqué.</p>'}</div></details>
        <details class="setting-card"><summary>Données et aide</summary><div class="setting-card__body"><div class="button-row"><button class="button button--secondary button--small" type="button" data-action="export-data">Exporter mes données</button><button class="button button--secondary button--small" type="button" data-action="help">Aide et signalement</button></div><p class="small muted">L’export est un fichier JSON local. Aucun rapport PDF premium n’est généré dans cette phase.</p></div></details>
      </div></section><section class="danger-zone section-block"><h2>Fin de session et compte</h2><div class="button-row"><button class="button button--secondary" type="button" data-action="logout">Se déconnecter</button><button class="button button--danger" type="button" data-action="delete-account">Supprimer le compte local</button></div></section>`;
  }

  function renderLatestBadge(badges) {
    const latest = badges.items.filter(item => item.unlockedAt).sort((a,b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))[0];
    const acquired = badges.items.filter(item => item.unlockedAt).length;
    return `<section class="section-block" aria-labelledby="badges-title"><div class="section-heading section-heading--compact"><div><p class="eyebrow">Progression personnelle</p><h2 id="badges-title">Dernier badge</h2></div><button class="text-link small" type="button" data-action="open-badges">Voir les ${badges.items.length} badges</button></div>${latest ? `<article class="latest-badge-card"><span class="latest-badge-card__medal" aria-hidden="true"><span>${esc(latest.icon)}</span></span><div><span class="status-chip">${acquired} acquis</span><h3>${esc(latest.name)}</h3><p>${esc(latest.description)}</p><small>Obtenu le ${formatDate(latest.unlockedAt)} · visible uniquement par vous</small></div></article>` : `<div class="latest-badge-card latest-badge-card--empty"><span class="latest-badge-card__medal" aria-hidden="true"><span>✦</span></span><div><h3>Votre premier badge vous attend</h3><p>Terminez une première session pour marquer ce premier pas.</p><button class="text-link small" type="button" data-action="open-badges">Découvrir les badges</button></div></div>`}</section>`;
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
    document.getElementById('notifications-body').innerHTML = `<div class="toolbar"><label class="sr-only" for="notification-filter">Filtrer</label><select id="notification-filter" data-change="notification-filter"><option value="all" ${ui.notificationFilter === 'all' ? 'selected' : ''}>Toutes</option><option value="unread" ${ui.notificationFilter === 'unread' ? 'selected' : ''}>Non lues</option><option value="social" ${ui.notificationFilter === 'social' ? 'selected' : ''}>Communauté</option></select><button class="button button--ghost button--small" type="button" data-action="mark-all-notifications">Tout marquer comme lu</button></div><p class="small muted">Demandes d’amis, Traces et encouragements sont synchronisés avec votre compte BOO-P.</p>${items.length ? items.map(item => `<article class="notification-item ${item.read ? '' : 'is-unread'}">${item.read ? '<span class="notification-dot" style="opacity:.2"></span>' : '<span class="notification-dot"></span>'}<div class="card-content"><strong>${esc(item.title)}</strong><p class="small">${esc(item.text)}</p><span class="micro muted">${relativeDate(item.date)}</span><div class="card-actions"><button class="text-link small" type="button" data-action="open-notification" data-id="${attr(item.id)}" data-route="${attr(item.route)}">Ouvrir</button>${!item.read ? `<button class="text-link small" type="button" data-action="mark-notification" data-id="${attr(item.id)}">Marquer comme lue</button>` : ''}</div></div></article>`).join('') : `<div class="empty-state"><h3>Tout est calme</h3><p>Aucune notification dans ce filtre.</p></div>`}`;
  }

  function openTraceDialog(bookId = null) {
    const book = store.getBookById(bookId) || store.getCurrentBook();
    const audio = book?.mediaType === 'audio';
    openDialog({ title: 'Laisser une Trace', eyebrow: 'Privée par défaut', body: `<form class="form-grid" data-form="trace"><input type="hidden" name="bookId" value="${attr(book?.id || '')}"><label class="field">Livre<select name="bookIdSelect">${store.getBooks().filter(item => item.libraryState === 'library').map(item => `<option value="${attr(item.id)}" ${item.id === book?.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><label class="field">${audio ? 'Minute' : 'Page'} facultative<input type="number" min="0" max="${audio ? (book?.durationMinutes || 99999) : (book?.totalPages || 99999)}" name="page" value="${audio ? (book?.currentMinute || '') : (book?.currentPage || '')}"></label><label class="field">Votre Trace<textarea id="trace-dialog-text" name="text" required maxlength="1200" placeholder="Une idée, une émotion, une citation…"></textarea></label><div class="button-row"><button class="button button--secondary" type="button" data-action="dictate-dialog-trace">Dicter</button><button class="button button--primary" type="submit">Enregistrer en privé</button></div><p class="small muted">Le partage reste un choix séparé et explicite.</p></form>` });
  }

  function openManualSessionDialog(bookId = null, sessionId = null) {
    const session = sessionId ? store.getSessions().find(item => item.id === sessionId) : null;
    const book = store.getBookById(bookId || session?.bookId) || store.getCurrentBook() || store.getBooks()[0];
    const date = session ? store.localDateKey(session.startedAt) : store.localDateKey(), audio = book?.mediaType === 'audio', position = audio ? book?.currentMinute : book?.currentPage;
    openDialog({ title: session ? 'Modifier la session passée' : 'Ajouter une session passée', eyebrow: 'Historique local', body: `<form class="form-grid" data-form="manual-session"><input type="hidden" name="sessionId" value="${attr(session?.id || '')}"><label class="field">Livre<select name="bookId">${store.getBooks().filter(item => item.libraryState === 'library').map(item => `<option value="${attr(item.id)}" ${item.id === book?.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><label class="field">Date<input type="date" name="date" required value="${date}"></label><div class="field-row"><label class="field">Durée (minutes)<input type="number" min="1" max="1440" name="duration" required value="${session ? Math.max(1,Math.round(session.durationSeconds/60)) : 30}"></label><label class="field">Ou horaires (facultatif)<span class="field-row"><input type="time" name="startTime"><input type="time" name="endTime"></span></label></div><div class="field-row"><label class="field">${audio ? 'Minute de départ' : 'Page de départ'}<input type="number" min="0" name="startPage" value="${session?.startPage ?? position ?? 0}"></label><label class="field">${audio ? 'Minute d’arrivée' : 'Page d’arrivée'}<input type="number" min="0" name="endPage" value="${session?.endPage ?? position ?? 0}"></label></div><label class="field">Note facultative<textarea name="note">${esc(session?.note || '')}</textarea></label><div class="button-row"><button class="button button--primary" type="submit">${session ? 'Enregistrer les modifications' : 'Ajouter la session'}</button>${session ? `<button class="button button--danger" type="button" data-action="delete-session" data-id="${attr(session.id)}">Supprimer</button>` : ''}</div></form>` });
  }

  function openBookDialog(book = null) {
    const editing = Boolean(book);
    ui.pendingCover = book?.coverUrl || '';
    ui.pendingCoverFile = null;
    ui.pendingCoverKind = book?.customCover ? 'custom' : (book?.coverUrl ? 'catalogue' : '');
    ui.bookSuggestions = [];
    const existingPreview = book?.coverUrl ? `<img class="book-cover-upload-preview" id="book-cover-preview" src="${attr(book.coverUrl)}" alt="Aperçu de la couverture">` : `<img class="book-cover-upload-preview" id="book-cover-preview" alt="Aperçu de la couverture" hidden>`;
    openDialog({ title: editing ? 'Modifier le livre' : 'Ajouter un livre', eyebrow: editing ? 'Métadonnées modifiables' : 'Photo, ISBN ou saisie manuelle', wide: true, body: `
      <section class="book-import-panel" aria-labelledby="book-photo-title">
        <div class="book-import-grid">
          <label class="camera-dropzone" for="cover-file">${existingPreview}<span id="book-cover-prompt"><strong>${book?.coverUrl ? 'Remplacer la couverture' : 'Prendre une photo ou choisir une image'}</strong><br><span class="small muted">JPG, PNG, WebP ou photo du téléphone · compression automatique</span></span><input class="sr-only" id="cover-file" type="file" accept="image/*,.heic,.heif" data-change="cover-file"></label>
          <div class="book-import-copy"><h3 id="book-photo-title">Reconnaître la couverture</h3><p class="small muted">BOO-P cherche d’abord un code-barres, puis lit le titre et l’auteur sur l’image. L’analyse de l’image se fait sur cet appareil ; seuls les mots ou l’ISBN détectés servent à consulter les catalogues.</p><button class="button button--sage" id="analyze-book-cover" type="button" data-action="analyze-book-cover" disabled>Identifier le livre</button></div>
        </div>
        <div class="book-analysis-status small" id="book-analysis-status" role="status" aria-live="polite"><span id="book-analysis-message">Choisissez une photo nette et bien cadrée.</span><progress id="book-analysis-progress" max="1" value="0" hidden></progress></div>
      </section>
      <section class="isbn-lookup-card section-block" aria-labelledby="isbn-lookup-title"><h3 id="isbn-lookup-title">Rechercher avec le code ISBN</h3><p class="small muted">Le numéro se trouve généralement près du code-barres au dos du livre.</p><form class="isbn-lookup-form" data-form="isbn-lookup"><label class="field" for="book-isbn-lookup"><span class="sr-only">ISBN-10 ou ISBN-13</span><input id="book-isbn-lookup" name="isbn" inputmode="text" autocapitalize="characters" spellcheck="false" autocomplete="off" placeholder="Ex. 9782070360024" value="${attr(book?.isbn || '')}" required></label><button class="button button--secondary" type="submit">Rechercher l’ISBN</button></form></section>
      <section class="isbn-lookup-card section-block" aria-labelledby="book-search-title"><h3 id="book-search-title">Rechercher par titre ou auteur</h3><p class="small muted">Utile si la photo n’est pas reconnue ou si l’ISBN est absent du catalogue.</p><form class="isbn-lookup-form" data-form="book-search"><label class="field" for="book-title-lookup"><span class="sr-only">Titre ou auteur</span><input id="book-title-lookup" name="query" autocomplete="off" placeholder="Ex. L’Étranger Albert Camus" required></label><button class="button button--secondary" type="submit">Rechercher le livre</button></form></section>
      <div id="book-lookup-results" aria-live="polite"></div>
      <hr class="section-block"><p class="eyebrow">Saisie manuelle ou correction</p>
      <form class="form-grid" data-form="book"><input type="hidden" name="id" value="${attr(book?.id || '')}"><input type="hidden" name="coverUrl" id="book-cover-value" value="${attr(book?.coverUrl || '')}"><input type="hidden" name="coverSource" id="book-cover-source" value="${attr(ui.pendingCoverKind)}"><div class="field-row"><label class="field">Destination<select name="libraryState"><option value="library" ${book?.libraryState !== 'wishlist' ? 'selected' : ''}>Ma bibliothèque</option><option value="wishlist" ${book?.libraryState === 'wishlist' ? 'selected' : ''}>Ma wishlist</option></select></label><label class="field">Support<select name="mediaType" data-change="book-media"><option value="print" ${book?.mediaType !== 'ebook' && book?.mediaType !== 'audio' ? 'selected' : ''}>Livre papier</option><option value="ebook" ${book?.mediaType === 'ebook' ? 'selected' : ''}>Livre numérique</option><option value="audio" ${book?.mediaType === 'audio' ? 'selected' : ''}>Livre audio</option></select></label></div><div class="field-row"><label class="field">Titre<input id="book-title-field" name="title" required value="${attr(book?.title || '')}" placeholder="Titre du livre"></label><label class="field">Auteur(s)<input id="book-authors-field" name="authors" required value="${attr(book?.authors.join(', ') || '')}" placeholder="Prénom Nom, autre auteur"></label></div><label class="field">Rayon littéraire<input id="book-genre-field" name="genre" list="book-genres" value="${attr(book?.genre || '')}" placeholder="Ex. Romans, Science-fiction…"><datalist id="book-genres"><option value="Romans"><option value="Essais"><option value="Science-fiction"><option value="Fantasy et fantastique"><option value="Policier et thriller"><option value="Philosophie"><option value="Histoire"><option value="Poésie"><option value="Biographies et mémoires"><option value="Sciences humaines"><option value="Jeunesse"><option value="Bande dessinée et manga"><option value="À classer"></datalist><span class="field-help">Proposé automatiquement par le catalogue et toujours modifiable.</span></label><div class="field-row"><label class="field">ISBN<input id="book-isbn-field" name="isbn" inputmode="text" autocapitalize="characters" spellcheck="false" autocomplete="off" value="${attr(book?.isbn || '')}" placeholder="ISBN-10 ou ISBN-13"></label><label class="field">Date de publication<input id="book-published-field" name="publishedDate" value="${attr(book?.publishedDate || '')}" placeholder="Ex. 2024"></label></div><div class="field-row"><label class="field">Éditeur<input id="book-publisher-field" name="publisher" value="${attr(book?.publisher || '')}"></label><label class="field">Édition<input id="book-edition-field" name="edition" value="${attr(book?.edition || '')}"></label></div><div class="field-row" data-page-fields ${book?.mediaType === 'audio' ? 'hidden' : ''}><label class="field">Format<input id="book-format-field" name="format" value="${attr(book?.format || 'Broché')}"></label><label class="field">Nombre de pages<input id="book-pages-field" type="number" min="0" name="totalPages" value="${book?.totalPages || ''}"></label></div><fieldset class="audio-book-fields" data-audio-fields ${book?.mediaType === 'audio' ? '' : 'hidden'}><legend>Informations du livre audio</legend><div class="field-row"><label class="field">Durée totale (minutes)<input type="number" min="0" name="durationMinutes" value="${book?.durationMinutes || ''}"></label><label class="field">Minute atteinte<input type="number" min="0" name="currentMinute" value="${book?.currentMinute || 0}"></label></div><div class="field-row"><label class="field">Narrateur ou narratrice<input name="narrator" value="${attr(book?.narrator || '')}"></label><label class="field">Plateforme ou source<input name="audioPlatform" value="${attr(book?.audioPlatform || '')}" placeholder="Audible, CD, bibliothèque…"></label></div></fieldset><label class="field">Résumé<textarea id="book-description-field" name="description">${esc(book?.description || '')}</textarea></label><div class="field-row"><label class="field">Statut<select name="status">${Object.entries(STATUS_LABELS).map(([value,label]) => `<option value="${value}" ${book?.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">Situation<select name="situation">${Object.entries(SITUATION_LABELS).map(([value,label]) => `<option value="${value}" ${book?.situation === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="field-row"><label class="field" data-page-fields ${book?.mediaType === 'audio' ? 'hidden' : ''}>Page atteinte<input type="number" min="0" name="currentPage" value="${book?.currentPage || 0}"></label><label class="checkbox-row"><input type="checkbox" name="historicalBeforeJoin" ${book?.historicalBeforeJoin ? 'checked' : ''}> Lu avant mon inscription (sans date annuelle)</label></div><p class="small muted">Vous pouvez toujours compléter ou corriger les informations avant l’ajout.</p><button class="button button--primary" type="submit">${editing ? 'Enregistrer le livre' : 'Ajouter à BOO-P'}</button></form>` });
  }

  function externalISBNFallback(isbn) {
    const links = window.BT.bookLookup.externalISBNLinks(isbn);
    if (!links.length) return '';
    return `<aside class="external-isbn-search section-block" aria-label="Recherche ISBN élargie"><div><strong>Recherche élargie</strong><p class="small muted">Ces comparateurs trouvent souvent les éditions absentes des catalogues publics. La recherche ISBN est déjà préremplie.</p></div><div class="button-row">${links.map(link => `<a class="button button--secondary button--small" href="${attr(link.url)}" target="_blank" rel="noopener noreferrer">Voir sur ${esc(link.label)} ↗</a>`).join('')}</div></aside>`;
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
    const external = externalISBNFallback(isbn);
    if (!ui.bookSuggestions.length) {
      container.innerHTML = `<div class="book-lookup-empty section-block"><strong>Aucune édition trouvée dans les catalogues consultés</strong><p class="small muted">${esc(message || 'Vérifiez le numéro ou saisissez les informations manuellement ci-dessous.')}</p></div>${external}`;
      revealBookLookupResults(container);
      return;
    }
    container.innerHTML = `<div class="success-panel section-block"><strong>${ui.bookSuggestions.length} édition${ui.bookSuggestions.length > 1 ? 's' : ''} trouvée${ui.bookSuggestions.length > 1 ? 's' : ''}</strong><p class="small">Choisissez la bonne édition, puis vérifiez les champs préremplis.${ui.pendingCover ? ' Votre photo restera disponible comme couverture personnalisée.' : ''}</p></div><div class="book-lookup-results section-block">${ui.bookSuggestions.map((item,index) => { const resultCover = item.coverUrl || ui.pendingCover; return `<button class="recognition-result" type="button" data-action="pick-book-result" data-index="${index}">${resultCover ? `<span class="book-cover book-cover--small"><img src="${attr(resultCover)}" alt="Couverture de ${attr(item.title)}" loading="lazy"></span>` : `<span class="book-cover book-cover--small" style="background:${gradientFor(item.title)}"><span>${esc(item.title)}</span></span>`}<span class="card-content"><strong>${esc(item.title)}</strong><span class="small muted">${esc((item.authors || []).join(', ') || 'Auteur non renseigné')}${item.publisher ? ` · ${esc(item.publisher)}` : ''}${item.totalPages ? ` · ${item.totalPages} pages` : ''}</span><span class="micro muted">${esc(item.isbn ? `ISBN ${item.isbn} · ` : '')}${esc(item.source || 'Catalogues publics')}${item.description ? ` · résumé ${esc(item.descriptionSource || 'disponible')}` : ' · résumé non fourni'}${!item.coverUrl && ui.pendingCover ? ' · votre photo' : ''}</span></span></button>`; }).join('')}</div>${external}`;
    revealBookLookupResults(container);
  }

  function openLexiconDialog(entry = null, bookId = null) {
    const book = store.getBookById(bookId || entry?.bookId);
    openDialog({ title: entry ? 'Modifier l’entrée' : 'Ajouter au lexique', eyebrow: 'Comprendre puis mémoriser', body: `<form class="form-grid" data-form="lexicon"><input type="hidden" name="id" value="${attr(entry?.id || '')}"><input type="hidden" name="sourceLabel" value="${attr(entry?.sourceLabel || '')}"><input type="hidden" name="sourceUrl" value="${attr(entry?.sourceUrl || '')}"><div class="field-row"><label class="field">Type<select name="kind"><option value="word" ${entry?.kind !== 'expression' && entry?.kind !== 'citation' ? 'selected' : ''}>Mot</option><option value="expression" ${entry?.kind === 'expression' ? 'selected' : ''}>Expression</option><option value="citation" ${entry?.kind === 'citation' ? 'selected' : ''}>Citation</option></select></label><label class="field">Mot, expression ou citation<input name="word" required value="${attr(entry?.word || '')}"></label></div><button class="button button--sage" type="button" data-action="dictionary-lookup">Chercher une explication</button><div class="dictionary-result small" id="dictionary-result" role="status" aria-live="polite">${entry?.sourceLabel ? `Source actuelle : ${esc(entry.sourceLabel)}. Vous pouvez toujours corriger le texte.` : 'Pour un mot, BOO-P consulte le Wiktionnaire. Pour une expression ou une citation, la recherche est élargie.'}</div><label class="field">Définition ou explication modifiable<textarea name="definition" required>${esc(entry?.definition || '')}</textarea></label><label class="field">Livre facultatif<select name="bookId"><option value="">Sans livre</option>${store.getBooks().filter(item => item.libraryState === 'library').map(item => `<option value="${attr(item.id)}" ${(entry?.bookId || book?.id) === item.id ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}</select></label><div class="field-row"><label class="field">Auteur<input name="author" value="${attr(entry?.author || book?.authors.join(', ') || '')}"></label><label class="field">${book?.mediaType === 'audio' ? 'Minute' : 'Page'}<input type="number" min="0" name="page" value="${entry?.page || ''}"></label></div><label class="field">Contexte ou note personnelle<textarea name="note">${esc(entry?.note || '')}</textarea></label><p class="small muted">Après l’enregistrement, cette entrée rejoint la Mémoire active avec des révisions J+1, J+3, J+5 et J+30.</p><button class="button button--primary" type="submit">Enregistrer et apprendre</button></form>` });
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
      result.innerHTML = `Proposition issue de <a href="${attr(found.sourceUrl)}" target="_blank" rel="noopener">${esc(found.sourceLabel)}</a>. Relisez-la et adaptez-la au contexte du livre avant d’enregistrer.`;
      form.elements.definition.focus();
    } catch (error) {
      result.textContent = error.message || 'Aucune explication trouvée. Saisissez la vôtre.';
      showToast(result.textContent);
      form.elements.word.focus();
    }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  }

  function openGoalDialog(period) {
    const goals = store.getState().goals, goal = goals[period], books = store.getBooks().filter(book => book.libraryState === 'library');
    const labels = { week:'Cette semaine', month:'Ce mois', year:'Cette année' };
    openDialog({ title: `Objectif · ${labels[period]}`, eyebrow: 'Un seul objectif principal', body: `<form class="form-grid" data-form="goal" data-period="${period}">${period === 'week' ? `<div class="field-row"><label class="field">Minutes par jour<input type="number" name="dailyMinutes" min="5" max="240" step="5" value="${goal.dailyMinutes}"></label><label class="field">Nombre de jours à atteindre<input type="number" name="daysTarget" min="1" max="7" value="${goal.daysTarget}"></label></div>` : `<label class="field">Livres à terminer<input type="number" name="targetBooks" min="1" max="100" value="${goal.targetBooks}"></label>`}<fieldset><legend>Livres concernés</legend><label class="checkbox-row"><input type="checkbox" name="allBooks" data-change="goal-all-books" ${!goal.bookIds.length ? 'checked' : ''}> Tous les livres</label><div class="form-grid">${books.map(book => `<label class="checkbox-row"><input type="checkbox" name="bookIds" data-change="goal-book" value="${attr(book.id)}" ${goal.bookIds.includes(book.id) ? 'checked' : ''}> ${esc(book.title)}</label>`).join('')}</div></fieldset><p class="small muted">Choisir un titre désactive automatiquement « Tous les livres ». Après l’enregistrement, la progression est recalculée à partir des livres choisis.</p><button class="button button--primary" type="submit">Enregistrer l’objectif</button></form>` });
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
    openDialog({ title: 'Modifier le profil', eyebrow: 'Identité du lecteur', body: `<form class="form-grid" data-form="profile"><label class="field">Nom ou pseudonyme<input name="name" required value="${attr(profile.name)}"></label><label class="field">Identifiant<input name="handle" value="${attr(profile.handle || '')}"></label><label class="field">Phrase de profil<input name="title" value="${attr(profile.title || '')}"></label><label class="field">Biographie<textarea name="bio">${esc(profile.bio || '')}</textarea></label><label class="field">Centres d’intérêt<input name="interests" value="${attr((profile.interests || []).join(', '))}"><span class="field-help">Séparés par des virgules</span></label><button class="button button--primary" type="submit">Enregistrer</button></form>` });
  }

  function openAdnDialog() {
    const books = store.getBooks(), selected = books.filter(book => book.isADN).sort((a,b) => (a.adnOrder ?? 99) - (b.adnOrder ?? 99)).slice(0,3);
    const ids = selected.map(book => book.id); while (ids.length < 3) { const next = books.find(book => !ids.includes(book.id)); if (!next) break; ids.push(next.id); }
    openDialog({ title: 'Modifier l’ADN du lecteur', eyebrow: 'Exactement trois livres', body: `<form class="form-grid" data-form="adn">${[0,1,2].map(index => `<label class="field">Position ${index+1}<select name="adn${index}" required>${books.map(book => `<option value="${attr(book.id)}" ${ids[index] === book.id ? 'selected' : ''}>${esc(book.title)}</option>`).join('')}</select></label>`).join('')}<p class="small muted">Choisissez trois livres différents. Leur ordre sera conservé sur une seule ligne.</p><div class="button-row"><button class="button button--primary" type="submit">Enregistrer l’ordre</button><button class="button button--secondary" type="button" data-action="add-book">Ajouter un nouveau livre</button></div></form>` });
  }

  function openFinishSessionDialog() {
    const session = store.getActiveSession(), book = store.getBookById(session.bookId);
    const audio = book.mediaType === 'audio', total = audio ? book.durationMinutes : book.totalPages;
    openDialog({ title: 'Bilan de la session', eyebrow: 'Confirmer avant de clôturer', body: `<form class="form-grid" data-form="finish-session"><label class="field">${audio ? 'Minute atteinte' : 'Page atteinte'}<input type="number" name="endPage" min="0" max="${total || 99999}" value="${session.endPage}"></label><label class="field">Note de session<textarea name="note">${esc(session.note || '')}</textarea></label><fieldset><legend>Rituel de fin · appréciation facultative</legend><div class="rating-row">${[1,2,3,4,5].map(value => `<button class="rating-button" type="button" data-action="select-rating" data-value="${value}" aria-pressed="false" aria-label="${value} sur 5">🔖</button>`).join('')}</div><input type="hidden" name="rating" id="finish-rating"><p class="small muted" id="rating-description">Choisissez un signet si cette lecture se termine.</p></fieldset><label class="field">Trace ou bilan facultatif<textarea name="traceText">${esc(session.traceDraft || '')}</textarea></label><label class="checkbox-row"><input type="checkbox" name="markRead" ${Number(session.endPage) >= Number(total) && total ? 'checked' : ''}> Marquer le livre comme Lu</label><label class="checkbox-row"><input type="checkbox" name="share"> Partager explicitement ce bilan dans le fil public</label><p class="small muted">Sans partage, le bilan reste privé.</p><button class="button button--primary" type="submit">Clôturer et enregistrer</button></form>` });
  }

  async function handleClick(event) {
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
      case 'finish-session': openFinishSessionDialog(); break;
      case 'quick-trace': openTraceDialog(trigger.dataset.bookId || store.getActiveSession()?.bookId); break;
      case 'session-lexicon': openLexiconDialog(null, store.getActiveSession()?.bookId); break;
      case 'dictate-trace': startDictation(document.getElementById('session-trace-draft'), text => store.updateActiveSession({ traceDraft: text })); break;
      case 'dictate-dialog-trace': startDictation(document.getElementById('trace-dialog-text')); break;
      case 'memory-prev': changeMemory(-1); break;
      case 'memory-next': changeMemory(1); break;
      case 'memory-recalled': reviewMemory(id, true); break;
      case 'memory-retry': reviewMemory(id, false); break;
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
      case 'toggle-club': store.toggleClub(id); showToast('Participation au club mise à jour localement'); render(); break;
      case 'club-details': openClubDetails(id); break;
      case 'toggle-salon': toggleSalon(id); break;
      case 'salon-thread': openSalonThread(id); break;
      case 'create-salon': openSalonCreateDialog(); break;
      case 'open-book': location.hash = `#book?id=${encodeURIComponent(id)}`; break;
      case 'add-book': openBookDialog(); break;
      case 'library-view': store.saveSettings({ libraryView: trigger.dataset.view }); render(); break;
      case 'refresh-recommendations': await refreshRecommendations(); break;
      case 'wishlist-recommendation': addRecommendationToWishlist(id); break;
      case 'dismiss-recommendation': dismissRecommendation(id); break;
      case 'move-to-library': store.updateBook(id, { libraryState:'library' }); showToast('Livre ajouté à votre bibliothèque'); render(); break;
      case 'edit-book': openBookDialog(store.getBookById(id)); break;
      case 'delete-book': confirmDeleteBook(id); break;
      case 'analyze-book-cover': await analyzeBookCover(trigger); break;
      case 'pick-book-result': pickBookResult(Number(trigger.dataset.index)); break;
      case 'manual-session': openManualSessionDialog(trigger.dataset.bookId || null); break;
      case 'edit-session': openManualSessionDialog(null, id); break;
      case 'delete-session': if (confirm('Supprimer définitivement cette session locale ?')) { store.deleteSession(id); closeDialog(); showToast('Session supprimée'); render(); } break;
      case 'add-lexicon': openLexiconDialog(null, trigger.dataset.bookId || null); break;
      case 'edit-lexicon': openLexiconDialog(store.getLexicon().find(item => item.id === id)); break;
      case 'delete-lexicon': if (confirm('Supprimer cette entrée du lexique ?')) { store.deleteLexiconWord(id); showToast('Entrée supprimée'); render(); } break;
      case 'dictionary-lookup': await lookupDictionary(trigger); break;
      case 'edit-goal': openGoalDialog(trigger.dataset.period); break;
      case 'open-monthly-report': openMonthlyReportDialog(); break;
      case 'download-monthly-report': await downloadMonthlyReport(); break;
      case 'share-monthly-report': await shareMonthlyReport(); break;
      case 'edit-monthly-report': openMonthlyReportDialog(ui.monthlyReportData?.monthKey); break;
      case 'edit-profile': openProfileDialog(); break;
      case 'edit-adn': openAdnDialog(); break;
      case 'open-badges': openBadgesDialog(); break;
      case 'toggle-theme': { const settings = store.getSettings(); settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; store.saveSettings(settings); applyTheme(); render(); break; }
      case 'select-rating': selectRating(Number(trigger.dataset.value)); break;
      case 'simulated-password': openChangePasswordDialog(); break;
      case 'export-data': exportData(); break;
      case 'help': openHelpDialog(); break;
      case 'logout': await window.BT.auth.signOut(); location.href = 'index.html?reason=signed-out'; break;
      case 'delete-account': openDeleteAccountDialog(); break;
    }
  }

  function handleChange(event) {
    const control = event.target.closest('[data-change]'); if (!control) return;
    switch (control.dataset.change) {
      case 'active-book': if (control.value) { store.setActiveBook(control.value); showToast('Lecture affichée modifiée'); } render(); break;
      case 'focus-session': store.focusActiveSession(control.value); render(); break;
      case 'library-status': ui.libraryStatus = control.value; render(); break;
      case 'library-sort': store.saveSettings({ librarySort:control.value }); render(); break;
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
      case 'session-page': { const book = store.getBookById(store.getActiveSession()?.bookId); const total = book?.mediaType === 'audio' ? book?.durationMinutes : book?.totalPages; const value = clamp(control.value, 0, total || 99999); control.value = value; store.updateActiveSession({ endPage: value }); break; }
      case 'cover-file': void readCoverFile(control.files?.[0]); break;
      case 'post-photo': previewPostPhoto(control.files?.[0]); break;
      case 'salon-pages': store.updateSalon(control.dataset.id, { sharePages: control.checked }); showToast(control.checked ? 'Progression partagée avec votre accord' : 'Progression en pages masquée'); break;
    }
  }

  function handleInput(event) {
    const control = event.target;
    if (control.dataset.change === 'session-page') { const book = store.getBookById(store.getActiveSession()?.bookId); const total = book?.mediaType === 'audio' ? book?.durationMinutes : book?.totalPages; const value = clamp(control.value, 0, total || 99999); store.updateActiveSession({ endPage:value }); return; }
    if (control.id === 'global-search') { ui.searchQuery = control.value; renderSearchResults(control.value); return; }
    const type = control.dataset.input; if (!type) return;
    if (type === 'session-note') { store.updateActiveSession({ note: control.value }); return; }
    if (type === 'session-trace') { store.updateActiveSession({ traceDraft: control.value }); return; }
    if (type === 'friend-search') {
      ui.friendQuery = control.value; const position = control.selectionStart; render();
      const replacement = document.getElementById('friend-search'); replacement?.focus(); replacement?.setSelectionRange(position, position);
      clearTimeout(ui.friendSearchTimer); ui.friendSearchTimer = setTimeout(() => refreshReaders(ui.friendQuery), 280); return;
    }
    const mappings = { 'library-search':['libraryQuery','library-search'], 'lexicon-search':['lexiconQuery','lexicon-search'] };
    if (mappings[type]) {
      const [key,id] = mappings[type]; ui[key] = control.value; const position = control.selectionStart; render();
      const replacement = document.getElementById(id); replacement?.focus(); replacement?.setSelectionRange(position, position);
    }
  }

  async function handleSubmit(event) {
    const form = event.target.closest('form[data-form]'); if (!form) return;
    event.preventDefault(); if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form), kind = form.dataset.form;
    const handlers = {
      trace: submitTrace, 'manual-session': submitManualSession, 'isbn-lookup': submitISBNLookup, 'book-search':submitBookSearch, book: submitBook, lexicon: submitLexicon,
      goal: submitGoal, 'monthly-report':submitMonthlyReport, profile: submitProfile, adn: submitAdn, 'finish-session': submitFinishSession,
      comment: submitComment, privacy: submitPrivacy, 'notification-settings': submitNotificationSettings,
      post: submitPost, club: submitClub, 'salon-message': submitSalonMessage, reply: submitReply,
      salon: submitSalon,
      report: submitReport, help: submitHelp, 'change-password': submitChangePassword, 'delete-account': submitDeleteAccount
    };
    await handlers[kind]?.(form, data);
  }

  function startSession(bookId) {
    if (!bookId) return;
    store.startActiveSession(bookId);
    location.hash = '#session';
  }

  function changeMemory(direction) {
    const items = getMemoryItems(); ui.memoryIndex = (ui.memoryIndex + direction + items.length) % items.length;
    store.saveSettings({ memoryIndex: ui.memoryIndex }); render();
  }
  function reviewMemory(id, recalled) {
    const updated = store.reviewLexiconWord(id, recalled);
    if (!updated) return;
    showToast(recalled ? 'Bien joué · la prochaine révision est programmée' : 'Cette entrée reviendra demain');
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

  async function refreshCommunity({ quiet = false } = {}) {
    if (!window.BT.community) return;
    try {
      const posts = await window.BT.community.listPosts();
      store.mergeRemotePosts(posts);
      ui.communityLoaded = true;
      if (ui.route === 'community') render();
    } catch (error) {
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
    if (!window.BT.notifications || !window.BT.auth?.isAuthenticated?.()) return;
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
    if (!window.BT.notifications || !window.BT.auth?.isAuthenticated?.()) return;
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
    try { await window.BT.notifications?.markRead?.(id); }
    catch (error) { await refreshNotifications({ quiet:true }); showToast(error.message || 'Lecture non synchronisée'); }
  }

  async function markAllNotificationsRead() {
    store.markAllNotifications();
    renderNotifications(); updateHeader();
    try { await window.BT.notifications?.markAllRead?.(); showToast('Toutes les notifications sont lues'); }
    catch (error) { await refreshNotifications({ quiet:true }); showToast(error.message || 'Lecture non synchronisée'); }
  }

  async function updateFriendRelation(userId, mode) {
    const user = store.getCommunity().users.find(item => item.id === userId);
    if (!user) return;
    if (!user.isRemote) { store.updateFriend(userId, mode); showToast(`${friendToast(mode)} · exemple fictif`); render(); return; }
    try {
      await window.BT.community.updateFriend(userId, mode);
      store.updateFriend(userId, mode);
      await refreshReaders(ui.friendQuery, { quiet:true });
      showToast(friendToast(mode).replace(' localement',''));
    } catch (error) { showToast(error.message || 'La demande d’amitié ne peut pas être mise à jour'); }
  }

  async function togglePostEncouragement(id) {
    const post = store.getCommunity().posts.find(item => item.id === id);
    if (!post) return;
    if (!post.isRemote) {
      store.toggleEncouragement(id); showToast(post.encouraged ? 'Encouragement retiré' : 'Encouragement ajouté à cet exemple fictif'); render(); return;
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

  function previewPostPhoto(file) {
    const preview = document.getElementById('post-photo-preview'), help = document.getElementById('post-photo-help');
    if (!preview || !help) return;
    if (ui.pendingPostPhotoUrl) URL.revokeObjectURL(ui.pendingPostPhotoUrl);
    ui.pendingPostPhotoUrl = '';
    if (!file) { preview.hidden = true; preview.removeAttribute('src'); help.textContent = 'Facultatif · la photo sera redimensionnée et compressée avant envoi.'; return; }
    ui.pendingPostPhotoUrl = URL.createObjectURL(file); preview.src = ui.pendingPostPhotoUrl; preview.hidden = false;
    help.textContent = `${file.name} · compression automatique avant l’envoi.`;
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

  function setBookCoverPreview(source) {
    const preview = document.getElementById('book-cover-preview');
    if (!preview) return;
    if (!source) { preview.hidden = true; preview.removeAttribute('src'); return; }
    preview.src = source;
    preview.hidden = false;
  }

  async function readCoverFile(file) {
    if (!file) return;
    const analyzeButton = document.getElementById('analyze-book-cover');
    if (analyzeButton) analyzeButton.disabled = true;
    setBookAnalysisStatus('Compression de la photo…', 0.05);
    try {
      const prepared = await window.BT.bookLookup.prepareCover(file, update => setBookAnalysisStatus(update.message, update.progress));
      ui.pendingCover = prepared.dataUrl;
      ui.pendingCoverFile = prepared.analysisBlob || file;
      ui.pendingCoverKind = 'custom';
      const field = document.getElementById('book-cover-value');
      const sourceField = document.getElementById('book-cover-source');
      if (field) field.value = prepared.dataUrl;
      if (sourceField) sourceField.value = 'custom';
      setBookCoverPreview(prepared.dataUrl);
      document.getElementById('book-cover-prompt')?.classList.add('has-preview');
      const before = Math.max(1, prepared.originalBytes), saved = Math.max(0, Math.round((1 - prepared.compressedBytes / before) * 100));
      setBookAnalysisStatus(`Photo importée et compressée${saved ? ` (${saved} % plus légère)` : ''}. Vous pouvez maintenant identifier le livre.`, null);
      if (analyzeButton) analyzeButton.disabled = false;
      showToast('Couverture importée — l’image sera bien enregistrée avec le livre');
    } catch (error) {
      ui.pendingCoverFile = null;
      setBookAnalysisStatus(error.message || 'Impossible de préparer cette image.', null, true);
      showToast(error.message || 'Import de l’image impossible');
    }
  }

  async function analyzeBookCover(button) {
    if (!ui.pendingCoverFile) { setBookAnalysisStatus('Importez d’abord une photo de la couverture.', null, true); return; }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    ui.bookSuggestions = [];
    const resultsContainer = document.getElementById('book-lookup-results');
    if (resultsContainer) resultsContainer.innerHTML = '<div class="book-lookup-empty section-block"><strong>Analyse en cours…</strong><p class="small muted">Gardez cette fenêtre ouverte pendant la lecture de l’image.</p></div>';
    try {
      const analysis = await window.BT.bookLookup.analyzeCover(ui.pendingCoverFile, update => setBookAnalysisStatus(update.message, update.progress));
      renderBookLookupResults(analysis.results);
      if (analysis.isbn) {
        const lookupField = document.getElementById('book-isbn-lookup');
        if (lookupField) lookupField.value = analysis.isbn;
      }
      const titleLookup = document.getElementById('book-title-lookup');
      if (titleLookup && analysis.query && !analysis.isbn) titleLookup.value = analysis.query.replace(/\b(?:intitle|inauthor):"?/g, '').replace(/"/g, ' ').replace(/\s+/g, ' ').trim();
      const method = analysis.method === 'barcode' ? 'Code-barres reconnu' : analysis.method === 'ocr-isbn' ? 'ISBN lu sur la photo' : 'Titre et auteur lus sur la photo';
      setBookAnalysisStatus(`${method} — choisissez la bonne édition ci-dessous.`, 1);
    } catch (error) {
      renderBookLookupResults([], error.message);
      setBookAnalysisStatus(error.message || 'La couverture n’a pas pu être identifiée.', null, true);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  async function submitISBNLookup(form, data) {
    const button = form.querySelector('button[type="submit"]');
    const isbn = window.BT.bookLookup.normalizeISBN(data.get('isbn'));
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setBookAnalysisStatus(`Recherche de l’ISBN ${isbn}…`, 0.45);
    try {
      const results = await window.BT.bookLookup.lookupISBN(isbn);
      renderBookLookupResults(results, '', isbn);
      const sources = [...new Set(results.map(item => item.source).filter(Boolean))].join(' et ');
      setBookAnalysisStatus(results.length ? `ISBN trouvé${sources ? ` via ${sources}` : ''} — choisissez la bonne édition.` : 'Aucune édition trouvée. Poursuivez la recherche préremplie sur Chasse aux Livres ou NiceBooks.', results.length ? 1 : null, !results.length);
    } catch (error) {
      renderBookLookupResults([], error.message, isbn);
      setBookAnalysisStatus(error.message || 'Recherche ISBN impossible.', null, true);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  async function submitBookSearch(form, data) {
    const button = form.querySelector('button[type="submit"]'), query = String(data.get('query') || '').trim();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setBookAnalysisStatus(`Recherche de « ${query} » dans les catalogues…`, 0.45);
    try {
      const results = await window.BT.bookLookup.searchBooks(query);
      renderBookLookupResults(results);
      setBookAnalysisStatus(results.length ? 'Livres trouvés — choisissez l’édition qui correspond.' : 'Aucun résultat. Essayez seulement le titre et le nom de l’auteur.', results.length ? 1 : null, !results.length);
    } catch (error) {
      renderBookLookupResults([], error.message);
      setBookAnalysisStatus(error.message || 'Recherche du livre impossible.', null, true);
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
    const titleLookup = document.getElementById('book-title-lookup');
    if (titleLookup) titleLookup.value = `${item.title} ${(item.authors || []).join(' ')}`.trim();
    if (ui.pendingCoverKind !== 'custom' && item.coverUrl) {
      ui.pendingCover = item.coverUrl;
      ui.pendingCoverKind = 'catalogue';
      const coverField = document.getElementById('book-cover-value');
      const sourceField = document.getElementById('book-cover-source');
      if (coverField) coverField.value = item.coverUrl;
      if (sourceField) sourceField.value = 'catalogue';
      setBookCoverPreview(item.coverUrl);
    }
    showToast('Édition sélectionnée — vérifiez ou corrigez les informations');
    document.getElementById('book-title-field')?.focus();
  }

  function selectRating(value) {
    document.getElementById('finish-rating').value = value;
    document.querySelectorAll('.rating-button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.value) <= value)));
    const descriptions = ['Cette lecture m’a laissé indifférent.','Elle a éveillé ma curiosité.','Elle m’a touché.','Elle m’a profondément marqué.','Elle m’a transformé.'];
    document.getElementById('rating-description').textContent = descriptions[value-1];
  }

  function submitTrace(form, data) {
    const bookId = data.get('bookIdSelect') || data.get('bookId');
    store.saveTrace({ bookId, page: Number(data.get('page')) || 0, text: data.get('text'), privacy: 'private' });
    closeDialog(); showToast('Trace enregistrée en privé'); render();
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
    const mediaType = data.get('mediaType');
    const genre = String(data.get('genre') || '').trim();
    const record = { title: data.get('title').trim(), authors: data.get('authors').split(',').map(item => item.trim()).filter(Boolean), genre, genres:genre ? [genre] : [], isbn, publishedDate: data.get('publishedDate').trim(), publisher: data.get('publisher').trim(), edition: data.get('edition').trim(), format: mediaType === 'audio' ? '' : data.get('format').trim(), mediaType, durationMinutes, currentMinute, narrator:data.get('narrator')?.trim() || '', audioPlatform:data.get('audioPlatform')?.trim() || '', libraryState:data.get('libraryState'), totalPages:mediaType === 'audio' ? 0 : totalPages, currentPage:mediaType === 'audio' ? 0 : currentPage, description: data.get('description').trim(), status: data.get('status'), situation: data.get('situation'), historicalBeforeJoin: data.get('historicalBeforeJoin') === 'on', coverUrl: data.get('coverUrl') || '', coverColor: gradientFor(`${data.get('title')}${data.get('authors')}`), customCover: data.get('coverSource') === 'custom' };
    const book = id ? store.updateBook(id, record) : store.addBook(record);
    if (!id && book.status === 'en-cours') store.setActiveBook(book.id);
    ui.pendingCover = ''; ui.pendingCoverFile = null; ui.pendingCoverKind = ''; closeDialog(); showToast(id ? 'Livre mis à jour' : `Livre ajouté à ${book.libraryState === 'wishlist' ? 'la wishlist' : 'la bibliothèque'}`); location.hash = `#book?id=${encodeURIComponent(book.id)}`; render();
  }

  function submitLexicon(form, data) {
    const id = data.get('id');
    store.addLexiconWord({ id: id || undefined, kind:data.get('kind'), word: data.get('word'), definition: data.get('definition'), sourceLabel:data.get('sourceLabel'), sourceUrl:data.get('sourceUrl'), bookId: data.get('bookId') || null, author: data.get('author'), page: data.get('page'), note: data.get('note') });
    closeDialog(); showToast(id ? 'Entrée mise à jour' : 'Entrée ajoutée au lexique'); render();
  }

  function submitGoal(form, data) {
    const period = form.dataset.period, selectedBookIds = data.getAll('bookIds');
    const updates = { bookIds: data.get('allBooks') === 'on' && !selectedBookIds.length ? [] : selectedBookIds };
    if (period === 'week') { updates.dailyMinutes = clamp(data.get('dailyMinutes'), 5, 240); updates.daysTarget = clamp(data.get('daysTarget'), 1, 7); }
    else updates.targetBooks = clamp(data.get('targetBooks'), 1, 100);
    store.updateGoal(period, updates); closeDialog(); showToast('Objectif modifié · progression recalculée'); render();
  }

  async function submitProfile(form, data) {
    store.saveProfile({ name: data.get('name').trim(), handle: data.get('handle').trim(), title: data.get('title').trim(), bio: data.get('bio').trim(), interests: data.get('interests').split(',').map(item => item.trim()).filter(Boolean).slice(0,12) });
    try { await window.BT.auth.updateProfile({ displayName:data.get('name').trim(), handle:data.get('handle').trim(), profileTitle:data.get('title').trim(), bio:data.get('bio').trim(), interests:store.getProfile().interests }); }
    catch (error) { showToast(error.message || 'Profil conservé localement ; synchronisation différée'); return; }
    closeDialog(); showToast('Profil mis à jour'); render();
  }

  function submitAdn(form, data) {
    const ids = [data.get('adn0'),data.get('adn1'),data.get('adn2')];
    if (new Set(ids).size !== 3) { showToast('Choisissez exactement trois livres différents'); return; }
    store.getBooks().forEach(book => store.updateBook(book.id, { isADN: ids.includes(book.id), adnOrder: ids.includes(book.id) ? ids.indexOf(book.id) : null }));
    closeDialog(); showToast('ADN du lecteur réorganisé'); render();
  }

  async function submitFinishSession(form, data) {
    const session = store.getActiveSession(), book = store.getBookById(session.bookId);
    const traceText = String(data.get('traceText') || '').trim(), share = data.get('share') === 'on';
    const total = book.mediaType === 'audio' ? book.durationMinutes : book.totalPages;
    store.finishActiveSession({ endPage: clamp(data.get('endPage'), 0, total || 99999), note: data.get('note'), rating: data.get('rating'), traceText, markRead: data.get('markRead') === 'on', share });
    if (share && traceText) {
      try { const post = await window.BT.community.createPost({ type:'trace', bookTitle:book.title, text:traceText, visibility:'public' }); if (post) store.addPost(post); }
      catch (error) { showToast(error.message || 'Session enregistrée, mais partage non envoyé'); }
    }
    closeDialog(); showToast(share ? 'Session enregistrée et bilan partagé explicitement' : 'Session enregistrée, bilan privé'); location.hash = '#home';
  }

  async function submitComment(form, data) {
    const post = store.getCommunity().posts.find(item => item.id === form.dataset.postId);
    if (!post) return;
    if (!post.isRemote) { store.addComment(post.id, data.get('text')); showToast('Trace ajoutée à cet exemple fictif'); render(); return; }
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      await window.BT.community.createComment(post.remoteId || post.id, data.get('text'));
      await refreshCommunity({ quiet:true }); showToast('Trace envoyée à l’auteur');
    } catch (error) { submit.disabled = false; showToast(error.message || 'Trace non envoyée'); }
  }

  async function submitPrivacy(form, data) {
    store.saveProfile({ visibility: data.get('profileVisibility') || 'private' });
    store.saveSettings({ defaultPostVisibility: data.get('defaultVisibility') || 'me' });
    try { await window.BT.auth.updateProfile({ profileVisibility:data.get('profileVisibility') || 'private' }); }
    catch (error) { showToast(error.message || 'Confidentialité conservée localement ; synchronisation différée'); return; }
    showToast('Confidentialité enregistrée'); render();
  }

  async function submitNotificationSettings(form, data) {
    const keys = ['friends','encouragements','traces','clubs','salons','goals'];
    const notifications = Object.fromEntries(keys.map(key => [key, data.get(key) === 'on']));
    notifications.remote = false; store.saveSettings({ notifications }); await refreshNotifications({ quiet:true }); showToast('Préférences de notifications enregistrées');
  }

  async function submitPost(form, data) {
    const visibility = data.get('visibility');
    if (visibility === 'public' && store.getProfile().visibility === 'private' && !confirm('Votre profil est privé. Confirmez-vous cette publication ponctuelle dans le fil public ?')) return;
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Compression et enregistrement…';
    try {
      const post = await window.BT.community.createPost({ type:data.get('type'), bookTitle:data.get('bookTitle'), text:data.get('text'), visibility, file:data.get('photo') });
      if (post) store.addPost(post);
      if (ui.pendingPostPhotoUrl) URL.revokeObjectURL(ui.pendingPostPhotoUrl); ui.pendingPostPhotoUrl = '';
      closeDialog(); showToast(`Trace enregistrée dans BOO-P · ${VISIBILITY_LABELS[visibility]}`); render();
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
    try {
      const remote = await window.BT.community.createClub(payload);
      store.addGroup({ ...payload, id:remote.id, remoteId:remote.id });
      closeDialog(); showToast('Club enregistré dans BOO-P'); render();
    } catch (error) { submit.disabled = false; showToast(error.message || 'Club non créé'); }
  }

  function submitSalonMessage(form, data) {
    store.addSalonMessage(form.dataset.salonId, data.get('text')); openSalonThread(form.dataset.salonId); showToast('Message ajouté au salon simulé');
  }
  function submitSalon(form, data) {
    const club = store.getCommunity().clubs.find(item => item.id === data.get('clubId'));
    if (!club || club.role !== 'owner') { showToast('Seul le propriétaire du club peut créer un salon'); return; }
    store.addSalon({ clubId:club.id, clubName:club.name, title:data.get('title'), bookTitle:data.get('bookTitle'), scheduledAt:new Date(data.get('scheduledAt')).toISOString() });
    closeDialog(); showToast('Salon programmé localement'); render();
  }
  async function submitReply(form, data) {
    const post = store.getCommunity().posts.find(item => item.id === form.dataset.postId);
    if (!post?.isRemote) { store.addComment(form.dataset.postId, data.get('text'), form.dataset.commentId); closeDialog(); ui.openComments.add(form.dataset.postId); showToast('Réponse ajoutée à cet exemple fictif'); render(); return; }
    try { await window.BT.community.createComment(post.remoteId || post.id, data.get('text'), form.dataset.commentId); closeDialog(); ui.openComments.add(post.id); await refreshCommunity({ quiet:true }); showToast('Réponse ajoutée'); }
    catch (error) { showToast(error.message || 'Réponse non envoyée'); }
  }
  function submitReport(form, data) { closeDialog(); showToast(`Signalement enregistré localement · motif : ${data.get('reason')}`); }
  function submitHelp(form, data) { closeDialog(); showToast('Message d’aide conservé localement pour démonstration'); }
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
    store.clearAll(); await window.BT.auth.signOut(); location.href = 'index.html?reason=local-data-deleted';
  }

  function openPostDialog() {
    const settings = store.getSettings();
    openDialog({ title:'Laisser une Trace', eyebrow:'Enregistrement sécurisé', body:`<form class="form-grid" data-form="post"><label class="field">Type d’activité<select name="type"><option value="trace">Trace ou bilan</option><option value="debut">Début de lecture</option><option value="fin">Fin de lecture</option><option value="goal">Objectif atteint</option></select></label><label class="field">Livre éventuel<select name="bookTitle"><option value="">Sans livre</option>${store.getBooks().map(book => `<option value="${attr(book.title)}">${esc(book.title)}</option>`).join('')}</select></label><label class="field">Texte<textarea name="text" required maxlength="1200" placeholder="Ce que cette lecture laisse en vous…"></textarea></label><label class="field">Photo facultative<input type="file" name="photo" data-change="post-photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"><span class="field-help" id="post-photo-help">Facultatif · redimensionnement à 1 920 px et compression automatique avant envoi (5 Mo maximum après compression).</span><img class="post-photo-preview" id="post-photo-preview" alt="Aperçu de la photo choisie" hidden></label><label class="field">Visibilité<select name="visibility"><option value="me" ${settings.defaultPostVisibility === 'me' ? 'selected' : ''}>Moi uniquement</option><option value="friends" ${settings.defaultPostVisibility === 'friends' ? 'selected' : ''}>Amis uniquement</option><option value="club">Club</option><option value="public" ${settings.defaultPostVisibility === 'public' ? 'selected' : ''}>Public</option></select></label><p class="small muted">La Trace et sa photo sont enregistrées dans Supabase. Tant que les vrais liens d’amitié et de club ne sont pas activés, les visibilités Amis et Club restent accessibles uniquement à vous.</p><button class="button button--primary" type="submit">Enregistrer la Trace</button></form>` });
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
    const user = store.getCommunity().users.find(item => item.id === userId); if (!user) return;
    let details = null;
    if (user.isRemote) {
      try { details = await window.BT.community.getReaderProfile(userId); }
      catch (error) { showToast(error.message || 'Ce profil ne peut pas être ouvert'); }
    } else details = { bio:user.bio, interests:[] };
    const locked = user.profileVisibility === 'private' && !details;
    openDialog({ title:user.name, eyebrow:locked ? 'Profil privé' : user.profileVisibility === 'private' ? 'Profil privé · ami accepté' : 'Profil public', body:`<div class="profile-main"><span class="profile-avatar">${esc(user.initials)}</span><div><h2>${esc(user.name)}</h2><p class="muted">${esc(user.handle || '')}</p></div></div>${locked ? '<div class="empty-state"><h3>Ce profil protège son sentier</h3><p>Envoyez une demande d’amitié. Son contenu deviendra accessible après acceptation.</p></div>' : `<p>${esc(details?.bio || 'Ce lecteur n’a pas encore rédigé de biographie.')}</p>${details?.interests?.length ? `<div class="interest-list">${details.interests.map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''}`}<p class="small muted">L’adresse e-mail et les lectures privées ne sont jamais affichées dans la recherche.</p>${friendAction(user)}` });
  }
  function openClubDialog() {
    openDialog({ title:'Créer un club', eyebrow:'Club enregistré dans BOO-P', body:`<form class="form-grid" data-form="club"><label class="field">Nom<input name="name" required maxlength="80"></label><label class="field">Description<textarea name="description" required maxlength="1200"></textarea></label><label class="field">Couverture<select name="color"><option value="#6f927c">Sauge proposée</option><option value="#cf873d">Ocre proposée</option></select><span class="field-help">Deux couvertures graphiques sont proposées pour ce prototype.</span></label><div class="field-row"><label class="field">Visibilité<select name="visibility"><option value="private">Privé</option><option value="public">Public</option></select></label><label class="field">Accès public<select name="access"><option value="approval">Sur approbation</option><option value="open">Accès libre</option></select></label></div><label class="field">Livre de ma bibliothèque<select name="bookTitle"><option value="">À choisir plus tard</option>${store.getBooks().map(book => `<option value="${attr(book.title)}">${esc(book.title)}</option>`).join('')}</select></label><label class="field">Ou un autre livre<input name="customBookTitle" maxlength="240" placeholder="Titre absent de ma bibliothèque"><span class="field-help">BOO-P vous proposera de l’ajouter automatiquement à votre bibliothèque.</span></label><p class="small muted">Le club est enregistré dans la base ; invitations, adhésions et présence en direct restent simulées.</p><button class="button button--primary" type="submit">Créer le club</button></form>` });
  }
  function openClubDetails(id) {
    const club = store.getCommunity().clubs.find(item => item.id === id); if (!club) return;
    openDialog({ title:club.name, eyebrow:'Historique du club', body:`<p>${esc(club.description)}</p><div class="history-list"><div class="history-item"><span class="history-item__icon">▥</span><div class="history-item__content"><strong>${esc(club.bookTitle || 'Lecture à choisir')}</strong><span class="small muted">Livre en cours</span></div></div><div class="history-item"><span class="history-item__icon">✓</span><div class="history-item__content"><strong>Les Justes</strong><span class="small muted">Lecture précédente · exemple fictif</span></div></div></div><p class="small muted">Seul le propriétaire peut créer un salon dans cette version.</p>` });
  }
  function toggleSalon(id) {
    const salon = store.getCommunity().salons.find(item => item.id === id); if (!salon) return;
    if (!salon.joined) { store.updateSalon(id,{ joined:true, myStatus:'waiting' }); showToast('Inscription au salon simulée'); render(); }
    else openSalonThread(id);
  }
  function openSalonThread(id) {
    const salon = store.getCommunity().salons.find(item => item.id === id); if (!salon) return;
    openDialog({ title:salon.title, eyebrow:`${salon.clubName} · salon simulé`, body:`<div class="button-row"><span class="status-chip">${salonStatus(salon.myStatus)}</span><label class="checkbox-row"><input type="checkbox" data-change="salon-pages" data-id="${attr(id)}" ${salon.sharePages ? 'checked' : ''}> Partager ma progression en pages</label></div><div class="comments section-block">${salon.messages.map(message => `<div class="comment"><strong>${esc(message.authorName)}</strong><p>${esc(message.text)}</p><span class="micro muted">${relativeDate(message.date)}</span></div>`).join('') || '<p class="small muted">Aucun message.</p>'}</div><form class="inline-form section-block" data-form="salon-message" data-salon-id="${attr(id)}"><label class="sr-only" for="salon-message">Message</label><input id="salon-message" name="text" required maxlength="500" placeholder="Écrire dans le salon…"><button class="button button--sage button--small" type="submit">Envoyer</button></form><p class="small muted">Les temps individuels et présences sont des données fictives ; aucune synchronisation réelle.</p>` });
  }
  function openSalonCreateDialog() {
    const clubs = store.getCommunity().clubs.filter(club => club.role === 'owner');
    if (!clubs.length) { showToast('Créez d’abord un club dont vous êtes propriétaire'); return; }
    const defaultDate = new Date(Date.now() + 86400000); defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset());
    openDialog({ title:'Créer un salon', eyebrow:'Réservé au propriétaire du club', body:`<form class="form-grid" data-form="salon"><label class="field">Club<select name="clubId">${clubs.map(club => `<option value="${attr(club.id)}">${esc(club.name)}</option>`).join('')}</select></label><label class="field">Nom du salon<input name="title" required></label><label class="field">Livre<select name="bookTitle">${store.getBooks().map(book => `<option value="${attr(book.title)}">${esc(book.title)}</option>`).join('')}</select></label><label class="field">Date et heure<input type="datetime-local" name="scheduledAt" required value="${defaultDate.toISOString().slice(0,16)}"></label><p class="small muted">Invitations, rappels et présence sont simulés localement.</p><button class="button button--primary" type="submit">Programmer le salon</button></form>` });
  }

  function openHelpDialog() {
    openDialog({ title:'Aide et signalement', eyebrow:'Prototype local', body:`<form class="form-grid" data-form="help"><label class="field">Sujet<select name="subject"><option>J’ai besoin d’aide</option><option>Signaler un problème technique</option><option>Question de confidentialité</option></select></label><label class="field">Message<textarea name="message" required></textarea></label><p class="small muted">Ce formulaire valide le parcours mais n’envoie aucun message à distance.</p><button class="button button--primary" type="submit">Enregistrer le message localement</button></form>` });
  }
  function openChangePasswordDialog() {
    openDialog({ title:'Changer le mot de passe', eyebrow:'Compte Supabase sécurisé', body:`<form class="form-grid" data-form="change-password"><label class="field">Nouveau mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label class="field">Confirmer le mot de passe<input name="confirm" type="password" required minlength="8" autocomplete="new-password"></label><p class="small muted">Le nouveau mot de passe doit contenir au moins 8 caractères.</p><button class="button button--primary" type="submit">Enregistrer le nouveau mot de passe</button></form>` });
  }
  function openDeleteAccountDialog() {
    openDialog({ title:'Effacer les données locales', eyebrow:'Confirmation renforcée', body:`<div class="danger-zone"><p>Cette action efface les lectures BOO-P de ce navigateur et vous déconnecte. Votre identifiant de connexion Supabase est conservé.</p><form class="form-grid" data-form="delete-account"><label class="field">Saisissez <strong>SUPPRIMER</strong><input name="confirmation" required autocomplete="off"></label><button class="button button--danger" type="submit">Effacer les données locales</button></form></div>` });
  }
  function confirmDeleteBook(id) {
    const book = store.getBookById(id); if (!book) return;
    if (confirm(`Supprimer « ${book.title} » ainsi que ses sessions et Traces locales ?`)) { store.deleteBook(id); showToast('Livre supprimé'); location.hash = '#path?tab=library'; }
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `boo-p-export-${store.localDateKey()}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); showToast('Export local préparé');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const user = await window.BT.auth.ready();
      const localPreview = ['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('preview');
      if (!user && !localPreview) { location.replace('index.html?auth=login&reason=protected'); return; }
      store.useUser?.(user?.id || 'local-preview');
      const completedRemotely = localPreview || Boolean(user.profile?.onboarding_completed);
      if (completedRemotely && !store.isOnboardingComplete()) store.saveOnboarding({ completed:true, version:5, restoredFromProfile:true, completedAt:new Date().toISOString() });
      if (!completedRemotely && !store.isOnboardingComplete()) { location.replace('onboarding.html'); return; }
      init();
    } catch (error) {
      console.error('BOO-P authentication gate', error);
      location.replace('index.html?auth=login&reason=auth-error');
    }
  });
})();

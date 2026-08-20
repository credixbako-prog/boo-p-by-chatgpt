window.BT = window.BT || {};

BT.escapeHTML = function(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
};

BT.openModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
};

BT.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
};

BT.showToast = function(message) {
  let toast = document.getElementById('boop-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'boop-toast';
    toast.className = 'boop-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(BT._toastTimer);
  BT._toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
};

BT.state = {
  currentScreen: 'home',
  activeSession: null,
  books: [],
  timeline: []
};

BT.refreshState = function() {
  if (BT.store) {
    BT.state.books = BT.store.getBooks();
    BT.state.timeline = BT.store.getTimeline();
  }
};

BT.init = function() {
  if (!BT.auth || !BT.auth.isAuthenticated()) {
    window.location.replace('index.html?auth=login&reason=protected');
    return;
  }

  if (BT.store && !BT.store.isOnboardingComplete()) {
    window.location.replace('onboarding.html');
    return;
  }

  if (BT.store && BT.store.loadDemoData) {
    BT.store.loadDemoData();
  }
  
  BT.refreshState();
  
  if (BT.screens.home) BT.screens.home.init();
  if (BT.screens.session) BT.screens.session.init();
  if (BT.screens.library) BT.screens.library.init();
  if (BT.screens.profile) BT.screens.profile.init();
  if (BT.navigation) BT.navigation.init();
  BT.router.init();

  document.querySelectorAll('[data-close-modal]').forEach(element => {
    element.addEventListener('click', () => BT.closeModal(element.dataset.closeModal));
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.modal.active').forEach(modal => BT.closeModal(modal.id));
  });

  const notificationsButton = document.getElementById('btn-notifications');
  if (notificationsButton) {
    notificationsButton.addEventListener('click', () => BT.openModal('notifications-modal'));
  }

  const logoutButton = document.getElementById('btn-logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      BT.auth.signOut();
      window.location.replace('index.html?reason=signed-out');
    });
  }

  document.querySelectorAll('.btn-kudos').forEach(button => {
    button.addEventListener('click', () => {
      const isActive = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', String(!isActive));
      button.classList.toggle('active', !isActive);
      BT.showToast(isActive ? 'Encouragement retiré' : 'Encouragement envoyé');
    });
  });

  document.querySelectorAll('.btn-community-trace').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.saved === 'true') {
        BT.showToast('Cette trace est déjà enregistrée');
        return;
      }
      const card = button.closest('.activity-card');
      const quote = card ? card.querySelector('.activity-card__quote') : null;
      const text = quote ? quote.textContent.trim() : '';
      if (!text) return;
      const currentBook = BT.store.getCurrentBook();
      BT.store.saveTrace({
        bookId: currentBook ? currentBook.id : null,
        page: currentBook ? currentBook.currentPage : 0,
        text,
        source: button.dataset.reader || 'La Clairière',
        type: 'community'
      });
      button.dataset.saved = 'true';
      button.classList.add('active');
      BT.showToast('Trace ajoutée à votre parcours');
    });
  });

  // Reading Groups Listener
  const btnSaveGroup = document.getElementById('btn-save-group');
  if (btnSaveGroup) {
    btnSaveGroup.addEventListener('click', () => {
      const nameInput = document.getElementById('group-name-input');
      const bookInput = document.getElementById('group-book-input');
      const name = nameInput ? nameInput.value.trim() : '';
      const book = bookInput ? bookInput.value.trim() : '';
      if (name) {
        BT.store.addGroup({
          name: name,
          bookTitle: book || 'Lecture commune',
          membersCount: 1
        });
        if (nameInput) nameInput.value = '';
        if (bookInput) bookInput.value = '';
        const modal = document.getElementById('group-modal');
        if (modal) BT.closeModal('group-modal');
        BT.renderGroups();
        BT.showToast('Club créé');
      } else {
        nameInput?.focus();
      }
    });
  }

  // Lexicon Modal Listener
  const btnSaveLexicon = document.getElementById('btn-save-lexicon');
  if (btnSaveLexicon) {
    btnSaveLexicon.addEventListener('click', () => {
      const wordInput = document.getElementById('lexicon-word-input');
      const defInput = document.getElementById('lexicon-def-input');
      const word = wordInput ? wordInput.value.trim() : '';
      const def = defInput ? defInput.value.trim() : '';
      if (word) {
        BT.store.addLexiconWord({
          word: word,
          definition: def,
          type: 'citation'
        });
        if (wordInput) wordInput.value = '';
        if (defInput) defInput.value = '';
        const modal = document.getElementById('lexicon-modal');
        if (modal) BT.closeModal('lexicon-modal');
        if (BT.screens.library && BT.screens.library.renderLexicon) {
          BT.screens.library.renderLexicon();
        }
        BT.showToast('Ajouté au lexique');
      } else {
        wordInput?.focus();
      }
    });
  }

  BT.renderGroups();
};

BT.renderGroups = function() {
  const carousel = document.querySelector('.clubs-carousel');
  if (!carousel) return;
  const groups = BT.store.getGroups();
  carousel.innerHTML = '';
  groups.forEach(g => {
    const safeName = BT.escapeHTML(g.name);
    const safeBook = BT.escapeHTML(g.bookTitle);
    const membersCount = Math.max(0, Number(g.membersCount) || 0);
    const html = `
      <div class="club-card" style="flex: 0 0 200px; background: var(--surface-elevated); border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow-sm);">
        <div style="width: 40px; height: 60px; border-radius: 6px; background-color: ${g.color || 'var(--color-vert-sauge)'};"></div>
        <div>
          <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: var(--color-bleu-nuit);">${safeName}</h4>
          <p style="margin: 2px 0 4px 0; font-size: 10px; color: var(--text-muted);">Livre : <em>${safeBook}</em></p>
          <span style="font-size: 9px; font-weight: 600; color: var(--color-vert-sauge); background: rgba(109,143,122,0.1); padding: 2px 6px; border-radius: 8px;">${membersCount} membre${membersCount > 1 ? 's' : ''}</span>
        </div>
      </div>
    `;
    carousel.insertAdjacentHTML('beforeend', html);
  });
};

BT.router = {
  init: function() {
    window.addEventListener('hashchange', this.handleHashChange.bind(this));
    if(!window.location.hash) {
      window.location.hash = '#home';
    } else {
      this.handleHashChange();
    }
  },
  
  handleHashChange: function() {
    const hash = window.location.hash.substring(1) || 'home';
    this.navigate(hash);
  },
  
  navigate: function(screenId) {
    const allowedScreens = ['home', 'community', 'library', 'profile', 'session'];
    if (!allowedScreens.includes(screenId)) {
      window.location.hash = '#home';
      return;
    }
    BT.state.currentScreen = screenId;
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
      setTimeout(() => screen.classList.remove('visible'), 50);
    });
    
    // Show target screen
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active');
      // small delay to allow display:block to apply before animating opacity
      setTimeout(() => target.classList.add('visible'), 50);
      
      // Update nav if exists
      if (BT.navigation) BT.navigation.updateActive(screenId);
      
      // Screen specific enter hooks
      if (BT.screens[screenId] && BT.screens[screenId].onEnter) {
        BT.screens[screenId].onEnter();
      }

      // Hide/show FAB and Appbar based on screen
      const fab = document.getElementById('fab-scanner');
      const appBar = document.getElementById('app-bar');
      const bottomNav = document.getElementById('bottom-nav');
      
      if (fab) {
        fab.style.display = screenId === 'library' ? 'flex' : 'none';
      }

      if (screenId === 'session') {
        if (appBar) appBar.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';
      } else {
        if (appBar) appBar.style.display = 'flex';
        if (bottomNav) bottomNav.style.display = 'flex';
      }
    }
  }
};

BT.screens = {};

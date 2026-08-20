BT.screens.profile = {
  init: function() {
    this.counters = document.querySelectorAll('.counter');
    
    const btnEditProfile = document.getElementById('btn-edit-profile');
    if (btnEditProfile) {
      btnEditProfile.addEventListener('click', () => {
        const profile = BT.store.getProfile();
        const nameInput = document.getElementById('edit-profile-name');
        const titleInput = document.getElementById('edit-profile-title');
        const locationInput = document.getElementById('edit-profile-location');
        const interestsInput = document.getElementById('edit-profile-interests');
        if (nameInput) nameInput.value = profile.name || '';
        if (titleInput) titleInput.value = profile.title || '';
        if (locationInput) locationInput.value = profile.location || '';
        if (interestsInput) interestsInput.value = (profile.interests || []).join(', ');
        BT.openModal('profile-edit-modal');
      });
    }

    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('nuit-dencre');
        btnSettings.setAttribute('aria-pressed', String(isDark));
        BT.store.saveSettings({ darkMode: isDark });
      });
    }

    // Apply settings on load
    const settings = BT.store.getSettings();
    if (settings && settings.darkMode) {
      document.body.classList.add('nuit-dencre');
      if (btnSettings) btnSettings.setAttribute('aria-pressed', 'true');
    }

    const btnSaveProfile = document.getElementById('edit-profile-save');
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', () => {
        const nameInput = document.getElementById('edit-profile-name');
        const titleInput = document.getElementById('edit-profile-title');
        const locationInput = document.getElementById('edit-profile-location');
        const interestsInput = document.getElementById('edit-profile-interests');
        const profile = BT.store.getProfile();
        
        if (nameInput) profile.name = nameInput.value.trim() || 'Lecteur';
        if (titleInput) profile.title = titleInput.value.trim() || 'LECTEUR EXPLORATEUR';
        if (locationInput) profile.location = locationInput.value.trim();
        if (interestsInput) {
          profile.interests = interestsInput.value
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
            .slice(0, 12);
        }
        
        BT.store.saveProfile(profile);
        
        BT.closeModal('profile-edit-modal');
        
        this.updateProfileData();
        BT.showToast('Profil mis à jour');
      });
    }
  },
  
  onEnter: function() {
    this.updateProfileData();
  },
  
  updateProfileData: function() {
    const profile = BT.store.getProfile();
    const stats = BT.store.getStats();
    
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = profile.name;
    
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl && profile.name) avatarEl.textContent = profile.name.charAt(0).toUpperCase();
    
    const titleEl = document.getElementById('profile-title-label');
    if (titleEl) titleEl.textContent = profile.title || 'LECTEUR EXPLORATEUR';
    
    const locationEl = document.getElementById('profile-location');
    if (locationEl) {
      locationEl.textContent = profile.location || 'Localisation non renseignée';
    }
    
    // Counters mapping: 1st Livres (read+transmis), 2nd Heures, 3rd Transmis
    // Or map by id if possible. Without HTML, assuming they are in this order or similar.
    // If we just have data-targets, let's look at what we can do.
    const booksCounter = document.getElementById('profile-books-count');
    const hoursCounter = document.getElementById('profile-hours-count');
    const tracesCounter = document.getElementById('profile-traces-count');
    const transmittedCounter = document.getElementById('profile-transmitted-count');
    const lexiconCount = BT.store.getLexicon().length;
    if (booksCounter) booksCounter.setAttribute('data-target', stats.totalBooks);
    if (hoursCounter) hoursCounter.setAttribute('data-target', stats.totalHours);
    if (tracesCounter) tracesCounter.setAttribute('data-target', lexiconCount);
    if (transmittedCounter) transmittedCounter.setAttribute('data-target', stats.booksTransmitted);
    
    const adnListEl = document.getElementById('profile-adn-list');
    if (adnListEl) {
      const books = BT.store.getBooks();
      const adnBooks = books.filter(b => b.isADN === true);
      adnListEl.innerHTML = '';
      if (adnBooks.length === 0) {
        adnListEl.innerHTML = '<div class="empty-state" style="padding:24px;"><p class="empty-state__desc">Vos livres marquants apparaîtront ici.</p></div>';
      }
      adnBooks.forEach(b => {
        adnListEl.insertAdjacentHTML('beforeend', `
          <div class="adn-item">
            <div class="book-cover book-cover--sm" style="background: ${b.coverColor};"></div>
            <div>
              <div style="font-weight:600; font-size:14px; font-family:var(--font-display);">${BT.escapeHTML(b.title)}</div>
              <div style="font-size:12px; color:var(--text-muted);">${BT.escapeHTML(b.adnLabel || 'Livre marquant')}</div>
            </div>
          </div>
        `);
      });
    }
    
    const interestsEl = document.getElementById('profile-interests');
    if (interestsEl && profile.interests) {
      interestsEl.innerHTML = '';
      profile.interests.forEach(interest => {
        interestsEl.insertAdjacentHTML('beforeend', `<span class="interest-tag">${BT.escapeHTML(interest)}</span>`);
      });
      const addInterest = document.createElement('button');
      addInterest.type = 'button';
      addInterest.className = 'tag tag--add';
      addInterest.setAttribute('aria-label', 'Modifier les centres d’intérêt');
      addInterest.textContent = '+';
      addInterest.addEventListener('click', () => document.getElementById('btn-edit-profile')?.click());
      interestsEl.appendChild(addInterest);
    }
    
    const objectivesEl = document.getElementById('profile-objectives');
    if (objectivesEl) {
      objectivesEl.textContent = `${stats.booksReadThisYear} / 24 livres cette année`;
    }
    const objectivesTitle = document.getElementById('profile-objectives-title');
    if (objectivesTitle) objectivesTitle.textContent = `OBJECTIFS ${new Date().getFullYear()}`;
    
    // Streak display
    const streakEl = document.getElementById('profile-streak');
    if (streakEl) {
      streakEl.textContent = `${stats.streak} Jours de série`;
    } else {
      // If it doesn't exist, we might try to add it somewhere, but it's risky without HTML.
    }
    
    this.animateCounters();
  },

  animateCounters: function() {
    this.counters = document.querySelectorAll('.counter');
    this.counters.forEach(counter => {
      const target = parseInt(counter.getAttribute('data-target')) || 0;
      const duration = 1500;
      const steps = 30;
      const stepTime = duration / steps;
      let current = 0;
      const inc = target / steps;
      
      clearInterval(counter._boopCounterTimer);
      counter._boopCounterTimer = setInterval(() => {
        current += inc;
        if (current >= target) {
          counter.textContent = target;
          clearInterval(counter._boopCounterTimer);
        } else {
          counter.textContent = Math.floor(current);
        }
      }, stepTime);
    });
  }
};

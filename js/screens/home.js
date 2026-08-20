BT.screens.home = {
  init: function() {
    this.progressRingContainer = document.getElementById('home-progress-ring');
    if (this.progressRingContainer && BT.ProgressRing) {
      this.ring = new BT.ProgressRing(this.progressRingContainer, 76, 4, '#6D8F7A');
    }

    const traceBtn = document.getElementById('btn-trace-capture');
    if (traceBtn) {
      traceBtn.addEventListener('click', () => {
        if (!BT.store.getCurrentBook()) return;
        BT.openModal('trace-modal');
      });
    }

    const startButton = document.getElementById('btn-start-session');
    const currentBookCard = document.getElementById('home-current-book-card');
    const openCurrentBook = () => {
      if (BT.store.getCurrentBook()) {
        window.location.hash = '#session';
      } else {
        window.location.hash = '#library';
        setTimeout(() => BT.scanner.openModal(), 120);
      }
    };
    if (startButton) startButton.addEventListener('click', openCurrentBook);
    if (currentBookCard) currentBookCard.addEventListener('click', openCurrentBook);

    document.querySelectorAll('.riddle-answer').forEach(answer => {
      answer.addEventListener('click', () => {
        if (answer.dataset.correct === 'true') {
          document.getElementById('riddle-card-container')?.classList.add('flipped');
        } else {
          answer.classList.add('is-wrong');
          BT.showToast('Pas tout à fait — essayez encore');
          setTimeout(() => answer.classList.remove('is-wrong'), 800);
        }
      });
    });

    document.getElementById('btn-riddle-next')?.addEventListener('click', () => {
      document.getElementById('riddle-card-container')?.classList.remove('flipped');
    });
    document.getElementById('btn-riddle-anchored')?.addEventListener('click', () => {
      BT.showToast('Cette idée est maintenant ancrée');
    });
  },
  
  onEnter: function() {
    // Load current book from store
    const currentBook = BT.store.getCurrentBook();
    const profile = BT.store.getProfile();
    const goal = BT.store.getGoal();
    const stats = BT.store.getStats();
    
    // Update greeting with real name
    const greetingEl = document.getElementById('home-greeting');
    if (greetingEl) greetingEl.textContent = 'Bonjour, ' + (profile.name || 'Lecteur');
    
    // Update current book display
    const titleEl = document.getElementById('home-book-title');
    const authorEl = document.getElementById('home-book-author');
    const coverEl = document.getElementById('home-book-cover');
    const progressEl = document.getElementById('home-book-progress');
    const percentEl = document.getElementById('home-book-percent');
    const startButton = document.getElementById('btn-start-session');
    const traceButton = document.getElementById('btn-trace-capture');

    if (currentBook) {
      
      const progress = currentBook.totalPages > 0 
        ? Math.round((currentBook.currentPage / currentBook.totalPages) * 100) 
        : 0;
      
      if (titleEl) titleEl.textContent = currentBook.title;
      if (authorEl) authorEl.textContent = currentBook.author;
      if (coverEl) {
        coverEl.style.background = currentBook.coverColor;
        coverEl.innerHTML = '';
        if (currentBook.coverUrl) {
          const image = document.createElement('img');
          image.src = currentBook.coverUrl;
          image.alt = currentBook.title;
          image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;position:absolute;inset:0;';
          image.addEventListener('error', () => image.remove());
          coverEl.appendChild(image);
        } else {
          const fallbackTitle = document.createElement('div');
          fallbackTitle.textContent = currentBook.title;
          fallbackTitle.style.cssText = "position:absolute;bottom:8px;left:8px;color:white;font-family:'Playfair Display';font-size:10px;font-weight:bold;width:80%;";
          coverEl.appendChild(fallbackTitle);
        }
      }
      if (progressEl) {
        const fill = progressEl.querySelector('.progress-bar__fill');
        if (fill) fill.style.width = progress + '%';
      }
      if (percentEl) percentEl.textContent = progress + '%';
      if (startButton) startButton.textContent = 'Démarrer une session';
      if (traceButton) traceButton.disabled = false;
    } else {
      if (titleEl) titleEl.textContent = 'Aucun livre en cours';
      if (authorEl) authorEl.textContent = 'Ajoutez un livre pour commencer votre prochaine étape.';
      if (coverEl) {
        coverEl.innerHTML = '';
        coverEl.style.background = 'linear-gradient(135deg, var(--color-bleu-nuit), var(--color-vert-sauge))';
        const mark = document.createElement('div');
        mark.textContent = '+';
        mark.setAttribute('aria-hidden', 'true');
        mark.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:white;font-size:28px;';
        coverEl.appendChild(mark);
      }
      if (progressEl) {
        const fill = progressEl.querySelector('.progress-bar__fill');
        if (fill) fill.style.width = '0%';
      }
      if (percentEl) percentEl.textContent = '—';
      if (startButton) startButton.textContent = 'Ajouter mon livre en cours';
      if (traceButton) traceButton.disabled = true;
    }
    
    // Update daily goal progress ring
    const todayMinutes = stats.todayReadingMinutes;
    const goalMinutes = goal.dailyMinutes || 15;
    const goalPercent = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
    const remaining = Math.max(0, goalMinutes - todayMinutes);
    
    // Update time remaining text
    const timeValueEl = document.getElementById('home-time-value');
    const timeUnitEl = document.getElementById('home-time-unit');
    if (timeValueEl) timeValueEl.textContent = remaining;
    if (timeUnitEl) timeUnitEl.innerHTML = 'MIN<br>RESTANTES';
    
    // Update streak dots
    const streakContainer = document.querySelector('.streak-dots');
    if (streakContainer && goal.streakDays) {
      const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
      streakContainer.innerHTML = '';
      goal.streakDays.forEach((isRead, idx) => {
        streakContainer.innerHTML += `<div class="dot ${isRead ? 'active' : ''}">${days[idx]}</div>`;
      });
    }
    const streakLabel = document.getElementById('home-streak-label');
    if (streakLabel) {
      const activeDays = (goal.streakDays || []).filter(Boolean).length;
      streakLabel.textContent = activeDays === 0
        ? 'Aucune session cette semaine'
        : `${activeDays} jour${activeDays > 1 ? 's' : ''} de présence cette semaine`;
    }

    // Animate ring
    if (this.ring) {
      this.ring.setProgress(0, false);
      setTimeout(() => {
        this.ring.setProgress(goalPercent, true);
      }, 300);
    }
  }
};

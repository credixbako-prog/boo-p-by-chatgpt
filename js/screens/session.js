BT.screens.session = {
  init: function() {
    this.timerDisplay = document.getElementById('timer-display');
    this.btnDictaphone = document.getElementById('btn-dictaphone');
    this.pageInput = document.getElementById('page-input');
    
    this.interval = null;
    this.isRecording = false;
    this.isPaused = false;
    this.activeSession = null;
    
    // Bind buttons
    if (this.btnDictaphone) {
      if (BT.speech.isSupported()) {
        this.btnDictaphone.addEventListener('click', this.toggleRecording.bind(this));
      } else {
        this.btnDictaphone.disabled = true;
        this.btnDictaphone.title = 'La dictée vocale n’est pas disponible dans ce navigateur';
        this.btnDictaphone.setAttribute('aria-label', 'Dictée vocale indisponible dans ce navigateur');
      }
    }
    
    const btnCloseSession = document.querySelector('.session-header .btn-close') || document.getElementById('btn-close-session');
    if (btnCloseSession) {
      btnCloseSession.addEventListener('click', this.closeSession.bind(this));
    }
    
    // Pause/Resume toggling on timer click
    if (this.timerDisplay) {
      this.timerDisplay.addEventListener('click', this.togglePause.bind(this));
    }

    const btnPageConfirm = document.getElementById('btn-page-confirm');
    if (btnPageConfirm) {
      btnPageConfirm.addEventListener('click', () => {
        if (this.activeSession && this.pageInput) {
          this.activeSession.endPage = this.sanitizePage(this.pageInput.value);
          this.pageInput.value = this.activeSession.endPage;
          BT.showToast(`Progression mise à jour : page ${this.activeSession.endPage}`);
        }
      });
    }

    const btnNoteSend = document.getElementById('btn-note-send');
    if (btnNoteSend) {
      btnNoteSend.addEventListener('click', () => {
        const noteInput = document.getElementById('note-input');
        if (noteInput && noteInput.value.trim() !== '') {
          if (this.activeSession) {
            BT.store.saveTrace({
              bookId: this.activeSession.bookId,
              page: this.activeSession.endPage || this.activeSession.startPage,
              text: noteInput.value.trim(),
              type: 'note'
            });
            noteInput.value = '';
            BT.showToast('Note enregistrée');
          }
        }
      });
    }

    const btnTraceSave = document.getElementById('btn-trace-save') || document.getElementById('trace-save-btn');
    if (btnTraceSave) {
      btnTraceSave.addEventListener('click', () => {
        const traceText = document.getElementById('trace-text');
        const textVal = traceText ? (traceText.value || traceText.textContent).trim() : '';
        if (textVal !== '') {
          const currentBook = BT.store.getCurrentBook();
          const bookId = this.activeSession ? this.activeSession.bookId : (currentBook ? currentBook.id : null);
          BT.store.saveTrace({
            bookId: bookId,
            page: this.activeSession ? (this.activeSession.endPage || this.activeSession.startPage) : (currentBook ? currentBook.currentPage : 0),
            text: textVal,
            type: 'dictaphone'
          });
          // Also save as Lexicon item / quote
          BT.store.addLexiconWord({
            word: textVal.length > 25 ? textVal.substring(0, 25) + '...' : textVal,
            definition: textVal,
            type: 'citation',
            bookTitle: currentBook ? currentBook.title : ''
          });
          BT.showToast('Trace sauvegardée');
          
          if (traceText) traceText.value = '';
          const explDiv = document.getElementById('trace-explanation');
          if (explDiv) explDiv.style.display = 'none';
          
          const modal = document.getElementById('trace-modal');
          if (modal) modal.classList.remove('active');
          
          if (this.isRecording) {
            this.stopRecording();
          }
        }
      });
    }

    const btnExplain = document.getElementById('trace-explain-btn');
    if (btnExplain) {
      btnExplain.addEventListener('click', async () => {
        const traceText = document.getElementById('trace-text');
        const text = traceText ? (traceText.value || traceText.textContent || '').trim() : '';
        if (!text) return;
        
        const explDiv = document.getElementById('trace-explanation');
        const explText = document.getElementById('trace-explanation-text');
        if (explDiv) explDiv.style.display = 'block';
        if (explText) explText.textContent = 'Recherche en cours...';
        
        try {
          const word = text.split(/[\s,;.!?]+/)[0];
          const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/fr/${encodeURIComponent(word)}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data && data[0] && data[0].meanings) {
              const meanings = data[0].meanings.map(m => {
                const defs = m.definitions.map(d => d.definition).slice(0, 2);
                return `${m.partOfSpeech}: ${defs.join('; ')}`;
              }).join('\n');
              if (explText) explText.textContent = meanings;
              return;
            }
          }
        } catch(e) {}
        
        try {
          const word = text.split(/[\s,;.!?]+/)[0];
          const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data && data[0] && data[0].meanings) {
              const meanings = data[0].meanings.map(m => {
                const defs = m.definitions.map(d => d.definition).slice(0, 2);
                return `${m.partOfSpeech}: ${defs.join('; ')}`;
              }).join('\n');
              if (explText) explText.textContent = meanings;
              return;
            }
          }
        } catch(e) {}
        
        if (explText) explText.textContent = `"${text}" — Expression ou citation capturée. Ajoutez votre propre explication.`;
      });
    }
    
    const ringContainer = document.getElementById('session-progress-ring');
    if (ringContainer && BT.ProgressRing) {
      this.ring = new BT.ProgressRing(ringContainer, 136, 4, '#6D8F7A');
    }
    
    const waveCanvas = document.getElementById('wave-canvas');
    if (waveCanvas && BT.WaveVisualizer) {
      this.wave = new BT.WaveVisualizer(waveCanvas);
    }
    
    const dialContainer = document.getElementById('rotary-dial-container');
    if (dialContainer && BT.RotaryDial) {
      this.dial = new BT.RotaryDial(dialContainer, (val) => {
        if(this.pageInput) {
          this.pageInput.value = val;
          if (this.activeSession) this.activeSession.endPage = val;
        }
      });
    }

    const langToggle = document.getElementById('trace-lang-toggle');
    if (langToggle) {
      langToggle.addEventListener('click', () => {
        const lang = BT.speech.toggleLang();
        const langLabel = document.getElementById('trace-speech-lang');
        if (langLabel) langLabel.textContent = lang.startsWith('fr') ? 'FR' : 'EN';
      });
    }

    document.querySelectorAll('#trace-modal .modal__close, #trace-modal .modal__overlay').forEach(element => {
      element.addEventListener('click', () => this.stopRecording());
    });
  },
  
  onEnter: function() {
    const currentBook = BT.store.getCurrentBook();
    if (!currentBook) {
      BT.showToast('Choisissez d’abord un livre en cours');
      window.location.hash = '#home';
      return;
    }
    
    // Set up active session
    this.activeSession = {
      bookId: currentBook.id,
      startedAt: new Date().toISOString(),
      startPage: currentBook.currentPage || 0,
      endPage: currentBook.currentPage || 0,
      duration: 0
    };
    BT.state.activeSession = this.activeSession;
    
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.isPaused = false;
    
    // Update UI for current book
    const titleEl = document.getElementById('session-book-title');
    const authorEl = document.getElementById('session-book-author');
    const coverEl = document.getElementById('session-book-cover');
    
    if (titleEl) titleEl.textContent = currentBook.title;
    if (authorEl) authorEl.textContent = currentBook.author;
    if (coverEl) {
      coverEl.style.background = currentBook.coverColor;
      coverEl.innerHTML = '';
      const fallbackTitle = document.createElement('div');
      fallbackTitle.textContent = currentBook.title;
      fallbackTitle.style.cssText = "position:absolute;bottom:8px;left:8px;color:white;font-family:'Playfair Display';font-size:14px;font-weight:bold;width:80%;";
      coverEl.appendChild(fallbackTitle);
      if (currentBook.coverUrl) {
        const image = document.createElement('img');
        image.src = currentBook.coverUrl;
        image.alt = currentBook.title;
        image.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;position:absolute;inset:0;';
        image.addEventListener('error', () => image.remove());
        coverEl.appendChild(image);
      }
    }
    
    if (this.pageInput) {
      this.pageInput.value = currentBook.currentPage;
      if (currentBook.totalPages > 0) this.pageInput.max = String(currentBook.totalPages);
      else this.pageInput.removeAttribute('max');
    }
    if (this.dial) {
      this.dial.setBounds(0, currentBook.totalPages > 0 ? currentBook.totalPages : Number.POSITIVE_INFINITY);
      this.dial.setValue(parseInt(currentBook.currentPage) || 0);
    }
    
    if (this.timerDisplay) this.timerDisplay.textContent = '00:00';
    const timerStatus = document.getElementById('session-timer-status');
    if (timerStatus) timerStatus.textContent = 'EN COURS';
    this.startTimer();
    
    if (this.ring) {
      this.ring.setProgress(0, false);
      const goal = BT.store.getGoal();
      const stats = BT.store.getStats();
      const goalMinutes = goal.dailyMinutes || 15;
      const todayMinutes = stats.todayReadingMinutes;
      const progress = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
      
      setTimeout(() => {
        this.ring.setProgress(progress, true);
      }, 500);
    }
  },
  
  startTimer: function() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (this.isPaused) return;
      
      const diff = Date.now() - this.startTime - this.pausedTime;
      this.activeSession.duration = Math.floor(diff / 1000);
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (this.timerDisplay) {
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      // Update ring dynamically
      if (this.ring) {
        const goal = BT.store.getGoal();
        const stats = BT.store.getStats();
        const goalMinutes = goal.dailyMinutes || 15;
        const totalMinutes = stats.todayReadingMinutes + (this.activeSession.duration / 60);
        const progress = Math.min(100, Math.round((totalMinutes / goalMinutes) * 100));
        this.ring.setProgress(progress, false);
      }
      
    }, 1000);
  },
  
  togglePause: function() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.pauseStart = Date.now();
      if (this.timerDisplay) this.timerDisplay.classList.add('paused');
      const status = document.getElementById('session-timer-status');
      if (status) status.textContent = 'EN PAUSE';
    } else {
      this.pausedTime += (Date.now() - this.pauseStart);
      if (this.timerDisplay) this.timerDisplay.classList.remove('paused');
      const status = document.getElementById('session-timer-status');
      if (status) status.textContent = 'EN COURS';
    }
  },
  
  toggleRecording: function() {
    if (!BT.speech.isSupported()) {
      alert("Dictaphone non supporté sur ce navigateur.");
      return;
    }
    
    this.isRecording = !this.isRecording;
    if (this.isRecording) {
      this.btnDictaphone.classList.add('recording');
      if (this.wave) this.wave.start();
      
      BT.openModal('trace-modal');
      const speechStatus = document.getElementById('trace-speech-status');
      if (speechStatus) speechStatus.style.display = 'block';
      
      const traceText = document.getElementById('trace-text');
      const traceInterim = document.getElementById('trace-interim');
      
      BT.speech.onResult((res) => {
        if (traceText) traceText.value = res.final;
        if (traceInterim) traceInterim.textContent = res.interim;
      });
      BT.speech.onEnd(() => this.stopRecording(false));
      
      if (!BT.speech.start()) this.stopRecording(false);
      
    } else {
      this.stopRecording();
    }
  },

  stopRecording: function(stopSpeech = true) {
    if (this.btnDictaphone) this.btnDictaphone.classList.remove('recording');
    if (this.wave) this.wave.stop();
    if (stopSpeech && BT.speech.isListening()) BT.speech.stop();
    this.isRecording = false;
    const speechStatus = document.getElementById('trace-speech-status');
    if (speechStatus) speechStatus.style.display = 'none';
    const interim = document.getElementById('trace-interim');
    if (interim) interim.textContent = '';
  },

  sanitizePage: function(value) {
    const currentBook = BT.store.getCurrentBook();
    let page = Math.max(0, parseInt(value, 10) || 0);
    if (currentBook && currentBook.totalPages > 0) page = Math.min(page, currentBook.totalPages);
    return page;
  },
  
  closeSession: function() {
    if (this.interval) clearInterval(this.interval);
    
    if (this.activeSession) {
      if (!this.isPaused) {
        this.activeSession.duration = Math.max(0, Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000));
      }
      // Ensure latest page is saved
      if (this.pageInput) {
        this.activeSession.endPage = this.sanitizePage(this.pageInput.value);
      }
      
      BT.store.saveSession(this.activeSession);
      
      BT.showToast('Session sauvegardée');
      
      this.activeSession = null;
      BT.state.activeSession = null;
    }
    this.stopRecording();
    
    window.location.hash = '#home';
  }
};

BT.screens.library = {
  init: function() {
    this.toggleCtrl = document.getElementById('library-toggle');
    this.viewGrid = document.getElementById('view-library-grid');
    this.viewSentier = document.getElementById('view-sentier');
    this.gridContainer = document.getElementById('library-grid-container');
    this.sentierContainer = document.getElementById('sentier-container');
    this.currentFilter = 'Tous';
    
    this.viewLexicon = document.getElementById('view-lexique');
    this.lexiconContainer = document.getElementById('lexicon-container') || (this.viewLexicon ? this.viewLexicon.querySelector('.flex-col') : null);
    this.lexiconSearch = document.getElementById('lexicon-search') || (this.viewLexicon ? this.viewLexicon.querySelector('input') : null);
    
    if (this.toggleCtrl) {
      const btns = this.toggleCtrl.querySelectorAll('button');
      btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = e.target.getAttribute('data-index');
          this.toggleCtrl.setAttribute('data-active', index);
          btns.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          
          if (index === '0') {
            this.viewGrid.style.display = 'block';
            if (this.viewSentier) this.viewSentier.style.display = 'none';
            if (this.viewLexicon) this.viewLexicon.style.display = 'none';
          } else if (index === '1') {
            this.viewGrid.style.display = 'none';
            if (this.viewSentier) this.viewSentier.style.display = 'block';
            if (this.viewLexicon) this.viewLexicon.style.display = 'none';
            if (BT.Timeline) BT.Timeline.init(this.sentierContainer);
          } else if (index === '2') {
            this.viewGrid.style.display = 'none';
            if (this.viewSentier) this.viewSentier.style.display = 'none';
            if (this.viewLexicon) this.viewLexicon.style.display = 'block';
            this.renderLexicon();
          }
        });
      });
    }

    if (this.lexiconSearch) {
      this.lexiconSearch.addEventListener('input', (e) => {
        this.renderLexicon(e.target.value);
      });
    }

    document.getElementById('passport-start-btn')?.addEventListener('click', () => {
      if (!this.currentPassportBookId) return;
      const book = BT.store.setCurrentBook(this.currentPassportBookId);
      if (!book) return;
      BT.closeModal('passeport-modal');
      if (BT.refreshState) BT.refreshState();
      this.renderGrid();
      this.renderSentier();
      BT.showToast(`« ${book.title} » est votre lecture en cours`);
      window.location.hash = '#home';
    });

    document.getElementById('passport-complete-btn')?.addEventListener('click', () => {
      if (!this.currentPassportBookId) return;
      const book = BT.store.completeBook(this.currentPassportBookId, 'lu');
      if (!book) return;
      BT.closeModal('passeport-modal');
      this.renderGrid();
      this.renderSentier();
      BT.showToast('Livre marqué comme lu');
    });

    document.getElementById('passport-transmit-btn')?.addEventListener('click', () => {
      if (!this.currentPassportBookId) return;
      const book = BT.store.completeBook(this.currentPassportBookId, 'transmis');
      if (!book) return;
      BT.closeModal('passeport-modal');
      this.renderGrid();
      this.renderSentier();
      BT.showToast('Livre marqué comme transmis');
    });

    // Tab filtering (assuming there's a filter element with class .library-filter-tab)
    const filterTabs = document.querySelectorAll('.library-filter-tab, .library-categories .tag');
    if (filterTabs.length > 0) {
      filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          filterTabs.forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');
          this.currentFilter = e.target.textContent.trim();
          this.renderGrid();
        });
      });
    }
    
    this.renderGrid();
    this.renderSentier();
  },
  
  renderGrid: function() {
    if (!this.gridContainer) return;
    this.gridContainer.innerHTML = '';
    
    let books = BT.store.getBooks();
    
    if (this.currentFilter === 'En cours') {
      books = books.filter(b => b.status === 'en-cours');
    } else if (this.currentFilter === 'À lire') {
      books = books.filter(b => b.status === 'a-lire');
    } else if (this.currentFilter === 'Lus') {
      books = books.filter(b => b.status === 'lu');
    } else if (this.currentFilter === 'Transmis') {
      books = books.filter(b => b.status === 'transmis');
    }

    if (books.length === 0) {
      const message = this.currentFilter === 'Tous'
        ? 'Votre bibliothèque est vide. Ajoutez votre premier livre avec le bouton de scan.'
        : `Aucun livre dans la catégorie « ${this.currentFilter} ».`;
      this.gridContainer.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p class="empty-state__desc">${BT.escapeHTML(message)}</p></div>`;
      return;
    }
    
    books.forEach((book, idx) => {
      const delay = (idx % 3) + 1;
      const progress = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
      const safeTitle = BT.escapeHTML(book.title);
      const safeId = BT.escapeHTML(book.id);
      const safeCoverUrl = BT.escapeHTML(book.coverUrl || '');
      const coverHTML = safeCoverUrl
        ? `<img src="${safeCoverUrl}" alt="${safeTitle}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;position:absolute;top:0;left:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><div style="position: absolute; bottom: 8px; left: 8px; color: white; font-family: 'Playfair Display'; font-size: 11px; font-weight: bold; width: 80%; display:none;">${safeTitle}</div>`
        : `<div style="position: absolute; bottom: 8px; left: 8px; color: white; font-family: 'Playfair Display'; font-size: 11px; font-weight: bold; width: 80%;">${safeTitle}</div>`;

      const html = `
        <button type="button" class="library-book anim-fade-up delay-${delay}" onclick="BT.screens.library.openPassport('${safeId}')" aria-label="Ouvrir le passeport de ${safeTitle}">
          <div class="library-book__cover" style="background: ${book.coverColor || '#ccc'}; position:relative;">
            ${coverHTML}
          </div>
          <div class="library-book__progress">
            <div class="library-book__progress-fill" style="width: ${progress}%;"></div>
          </div>
          <div class="library-book__title">${safeTitle}</div>
        </button>
      `;
      this.gridContainer.insertAdjacentHTML('beforeend', html);
    });
  },
  
  renderSentier: function() {
    if (!this.sentierContainer) return;
    // Keep axis
    const axis = this.sentierContainer.querySelector('.sentier__axis');
    this.sentierContainer.innerHTML = '';
    if (axis) this.sentierContainer.appendChild(axis);
    
    const timelineData = BT.store.getTimeline();

    if (timelineData.length === 0) {
      this.sentierContainer.insertAdjacentHTML('beforeend', '<div class="empty-state"><p class="empty-state__desc">Votre sentier se dessinera au fil de vos lectures.</p></div>');
      return;
    }
    
    timelineData.forEach(yearGroup => {
      const yearHtml = `
        <div class="sentier__year">
          <span class="sentier__year-label">${yearGroup.year}</span>
        </div>
      `;
      this.sentierContainer.insertAdjacentHTML('beforeend', yearHtml);
      
      yearGroup.items.forEach(item => {
        const safeTitle = BT.escapeHTML(item.title);
        const safeAuthor = BT.escapeHTML(item.author || '');
        const safeDate = BT.escapeHTML(item.date);
        const safeCoverUrl = BT.escapeHTML(item.coverUrl || '');
        const footprintHtml = item.side === 'left' ? 
          `<div class="sentier__footprint" style="top: 120px; left: calc(50% + 20px);">
             <svg viewBox="0 0 24 24"><path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" stroke-width="1" stroke="currentColor" fill="none"></path><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>
           </div>` : 
          `<div class="sentier__footprint" style="top: 120px; left: calc(50% - 20px);">
             <svg viewBox="0 0 24 24"><path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" stroke-width="1" stroke="currentColor" fill="none"></path><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>
           </div>`;
           
        const traces = BT.store.getTracesForBook(item.id);
        const lastTrace = traces.length > 0 ? traces[traces.length - 1].text : "Aucune trace pour ce livre.";

        const nodeHtml = `
          <div class="sentier__node sentier__node--${item.side}">
            <div class="sentier__node-dot"></div>
            <div class="sentier__node-content">
              <div class="sentier__node-book card-flip-container" onclick="BT.CardFlip.toggle(this)">
                <div class="card-flip-inner">
                  <div class="card-flip-front" style="display:flex; gap:12px;">
                    ${safeCoverUrl
                      ? `<img src="${safeCoverUrl}" alt="${safeTitle}" style="width:45px;height:65px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><div class="book-cover book-cover--sm" style="background: ${item.coverColor}; flex-shrink:0; display:none;"></div>`
                      : `<div class="book-cover book-cover--sm" style="background: ${item.coverColor}; flex-shrink:0;"></div>`}
                    <div class="sentier__node-book-info">
                      <div class="sentier__node-book-title">${safeTitle}</div>
                      <div class="sentier__node-book-author">${safeAuthor}</div>
                      <div class="sentier__node-date">${safeDate}</div>
                    </div>
                  </div>
                  <div class="card-flip-back">
                    <p style="font-size:12px; font-family:'Playfair Display'; font-style:italic; color:var(--color-bleu-nuit); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">« ${BT.escapeHTML(lastTrace)} »</p>
                  </div>
                </div>
              </div>
            </div>
            ${footprintHtml}
          </div>
        `;
        this.sentierContainer.insertAdjacentHTML('beforeend', nodeHtml);
      });
    });
  },
  
  onEnter: function() {
    this.renderGrid();
    this.renderSentier();
    
    if (this.toggleCtrl) {
      const activeTab = this.toggleCtrl.getAttribute('data-active');
      if (activeTab === '2') {
        this.renderLexicon();
      }
    }
    
    const fills = this.gridContainer ? this.gridContainer.querySelectorAll('.library-book__progress-fill') : [];
    fills.forEach(fill => {
      const target = fill.style.width;
      fill.style.width = '0%';
      setTimeout(() => fill.style.width = target, 100);
    });
  },
  
  renderLexicon: function(query = '') {
    if (!this.viewLexicon) this.viewLexicon = document.getElementById('view-lexique');
    const container = this.lexiconContainer || (this.viewLexicon ? this.viewLexicon.querySelector('.flex-col') : null);
    if (!container) return;
    container.innerHTML = '';
    let words = BT.store.getLexicon();
    if (query) {
      const q = query.toLowerCase();
      words = words.filter(w => w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q));
    }
    
    if (words.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--color-grey-dark);">Aucun mot ou citation trouvé.</div>';
      return;
    }
    
    words.forEach(w => {
      const border = w.type === 'citation' ? 'var(--color-vert-sauge)' : 'var(--color-ocre)';
      const html = `
        <div class="card" style="border-left: 4px solid ${border}; padding: 15px; margin-bottom: 10px; background: var(--surface-elevated); border-radius: 12px; box-shadow: 0 4px 10px rgba(15,27,45,0.03);">
          <h4 class="font-semibold text-bleu-nuit m-0 mb-1" style="font-size:15px;">${BT.escapeHTML(w.word)}</h4>
          <p class="text-serif text-bleu-nuit m-0 mb-2" style="font-style:italic; font-size:13px;">« ${BT.escapeHTML(w.definition)} »</p>
          <div class="text-label-xs text-muted">${w.bookTitle ? 'Ancré • ' + BT.escapeHTML(w.bookTitle) : 'Nouveau mot'}</div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', html);
    });
  },

  openPassport: function(bookId) {
    const book = BT.store.getBookById(bookId);
    if (!book) return;
    
    const modal = document.getElementById('passeport-modal') || document.getElementById('passport-modal');
    if (!modal) return;
    
    this.currentPassportBookId = bookId;
    const title = document.getElementById('passport-title');
    const author = document.getElementById('passport-author');
    const cover = document.getElementById('passport-cover');
    const visa = document.getElementById('passport-visa');
    
    if (title) title.textContent = book.title;
    if (author) author.textContent = book.author || 'Auteur inconnu';
    if (cover) cover.style.background = book.coverColor || 'var(--color-bleu-nuit)';
    if (visa) {
      const dateStr = book.addedAt ? new Date(book.addedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
      const pct = book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
      const statusLabels = { 'en-cours': 'EN COURS', 'a-lire': 'À LIRE', 'lu': 'LU', 'transmis': 'TRANSMIS' };
      visa.textContent = `VISA D'ENTRÉE : ${dateStr.toUpperCase()}\nSTATUT : ${statusLabels[book.status] || 'À LIRE'} (${pct}%)`;
      visa.style.whiteSpace = 'pre-line';
    }

    const startButton = document.getElementById('passport-start-btn');
    const completeButton = document.getElementById('passport-complete-btn');
    const transmitButton = document.getElementById('passport-transmit-btn');
    if (startButton) {
      startButton.disabled = book.status === 'en-cours';
      startButton.textContent = book.status === 'en-cours' ? 'Lecture en cours' : 'Commencer ce livre';
    }
    if (completeButton) completeButton.disabled = book.status === 'lu';
    if (transmitButton) transmitButton.disabled = book.status === 'transmis';
    
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
};

/**
 * BOOP — ISBN Scanner & Book Lookup
 * Module BT.scanner : Barcode Detection API + Google Books API + Open Library API
 */

BT.scanner = (function () {
  'use strict';

  let videoStream = null;
  let scanInterval = null;
  let modal = null;

  function isBarcodeSupported() {
    return 'BarcodeDetector' in window;
  }

  // ── Book API Search ──────────────────────────────────
  async function lookupBook(query) {
    try {
      // Check if query looks like an ISBN
      const cleanQuery = query.trim();
      const normalizedQuery = cleanQuery.replace(/[^0-9X]/gi, '');
      const isISBN = /^(?:\d{9}[\dX]|\d{13})$/i.test(normalizedQuery);
      const searchUrl = isISBN 
        ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${normalizedQuery}`
        : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQuery)}`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error('Google Books API failed');
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        // Map Google Books results
        return data.items.slice(0, 5).map(item => {
          const vol = item.volumeInfo;
          let coverUrl = '';
          if (vol.imageLinks && vol.imageLinks.thumbnail) {
            coverUrl = vol.imageLinks.thumbnail.replace('http:', 'https:') + '&zoom=1';
          }
          const isbnIdentifier = vol.industryIdentifiers?.find(id => id.type === 'ISBN_13' || id.type === 'ISBN_10');
          const isbn = isbnIdentifier ? isbnIdentifier.identifier : '';
          const title = vol.title || 'Titre inconnu';
          const author = vol.authors ? vol.authors.join(', ') : '';
          
          return {
            isbn: isbn,
            title: title,
            author: author,
            totalPages: vol.pageCount || 0,
            coverColor: _generateGradient(title + author),
            coverUrl: coverUrl,
            publisher: vol.publisher || '',
            publishDate: vol.publishedDate || '',
            description: vol.description || ''
          };
        });
      }
    } catch (error) {
      console.info('Google Books unavailable, using Open Library fallback', error);
    }

    // Fallback to Open Library if it looks like an ISBN
    const cleanISBN = query.replace(/[^0-9X]/gi, '');
    if (cleanISBN.length >= 10) {
      try {
        const response = await fetch(`https://openlibrary.org/isbn/${cleanISBN}.json`);
        if (!response.ok) throw new Error('Open Library Book not found');

        const data = await response.json();

        // Get author info if available
        let authorName = '';
        if (data.authors && data.authors.length > 0) {
          try {
            const authorKey = data.authors[0].key;
            const authorResp = await fetch(`https://openlibrary.org${authorKey}.json`);
            if (authorResp.ok) {
              const authorData = await authorResp.json();
              authorName = authorData.name || '';
            }
          } catch { /* ignore author lookup failure */ }
        }

        const coverColor = _generateGradient(cleanISBN);
        const coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanISBN}-M.jpg`;

        return [{
          isbn: cleanISBN,
          title: data.title || 'Titre inconnu',
          author: authorName,
          totalPages: data.number_of_pages || 0,
          coverColor: coverColor,
          coverUrl: coverUrl,
          publisher: data.publishers ? data.publishers[0] : '',
          publishDate: data.publish_date || ''
        }];
      } catch (error) {
        console.warn('Open Library lookup failed:', error);
      }
    }
    
    return null;
  }

  function _generateGradient(seed) {
    // Create a deterministic but pretty gradient from a string seed
    let hash = 0;
    if (!seed) seed = Math.random().toString();
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 40 + Math.abs((hash >> 8) % 60)) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 45%, 25%) 0%, hsl(${hue2}, 55%, 50%) 100%)`;
  }

  // ── Camera Scanner ────────────────────────────────────
  async function startCamera(videoElement) {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      videoElement.srcObject = videoStream;
      await videoElement.play();
      return true;
    } catch (error) {
      console.warn('Camera access error:', error);
      return false;
    }
  }

  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(t => t.stop());
      videoStream = null;
    }
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
  }

  async function startScanning(videoElement, onDetected) {
    if (!isBarcodeSupported()) {
      console.warn('BarcodeDetector not supported');
      return false;
    }

    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });

    scanInterval = setInterval(async () => {
      try {
        const barcodes = await detector.detect(videoElement);
        if (barcodes.length > 0) {
          const isbn = barcodes[0].rawValue;
          stopScanning();
          if (onDetected) onDetected(isbn);
        }
      } catch { /* detection cycle error, ignore */ }
    }, 500);

    return true;
  }

  function stopScanning() {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
  }

  // ── Modal UI ──────────────────────────────────────────
  function openModal() {
    modal = document.getElementById('scanner-modal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const searchView = modal.querySelector('#scanner-search-view');
    const cameraView = modal.querySelector('#scanner-camera-view');
    const resultPanel = modal.querySelector('#scanner-result');
    const resultsList = modal.querySelector('#scanner-results-list');
    const loadingEl = modal.querySelector('#scanner-loading');
    const btnOpenCamera = modal.querySelector('#btn-open-camera');
    const btnCloseCamera = modal.querySelector('#btn-close-camera');
    const btnCapturePhoto = modal.querySelector('#btn-capture-photo');
    const videoEl = modal.querySelector('#scanner-video');

    // Reset views
    if (resultPanel) resultPanel.style.display = 'none';
    if (resultsList) resultsList.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
    if (searchView) searchView.style.display = 'block';
    if (cameraView) cameraView.style.display = 'none';

    // Toggle camera visibility based on support
    const cameraToggle = modal.querySelector('#scanner-camera-toggle');
    if (cameraToggle) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        cameraToggle.style.display = 'block';
      } else {
        cameraToggle.style.display = 'none';
      }
    }

    // Camera Handlers
    if (btnOpenCamera) {
      btnOpenCamera.onclick = () => {
        if (searchView) searchView.style.display = 'none';
        if (cameraView) cameraView.style.display = 'block';
        if (videoEl) {
          startCamera(videoEl).then(ok => {
            if (ok && isBarcodeSupported()) {
              startScanning(videoEl, (isbn) => {
                _handleSearch(isbn);
              });
            }
          });
        }
      };
    }

    if (btnCloseCamera) {
      btnCloseCamera.onclick = () => {
        stopCamera();
        if (cameraView) cameraView.style.display = 'none';
        if (searchView) searchView.style.display = 'block';
      };
    }

    if (btnCapturePhoto) {
      btnCapturePhoto.onclick = () => {
        // Manual fallback when automatic barcode detection is unavailable.
        stopCamera();
        if (cameraView) cameraView.style.display = 'none';
        if (searchView) searchView.style.display = 'block';
        showManualAdd('');
      };
    }

    // Search Handlers
    const searchInput = modal.querySelector('#book-search-input');
    const searchBtn = modal.querySelector('#book-search-btn');

    if (searchInput) {
      searchInput.value = '';
      const newSearchInput = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newSearchInput, searchInput);
      newSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = newSearchInput.value.trim();
          if (query.length > 0) {
            _handleSearch(query);
          }
        }
      });
    }

    if (searchBtn) {
      const newBtn = searchBtn.cloneNode(true);
      searchBtn.parentNode.replaceChild(newBtn, searchBtn);
      newBtn.addEventListener('click', () => {
        const input = modal.querySelector('#book-search-input');
        const query = input ? input.value.trim() : '';
        if (query.length > 0) {
          _handleSearch(query);
        }
      });
    }
  }

  async function _handleSearch(query) {
    if (!modal) return;

    const resultPanel = modal.querySelector('#scanner-result');
    const resultsList = modal.querySelector('#scanner-results-list');
    const searchView = modal.querySelector('#scanner-search-view');
    const cameraView = modal.querySelector('#scanner-camera-view');
    const loadingEl = modal.querySelector('#scanner-loading');
    const resultsContent = modal.querySelector('#scanner-results-content');
    const resultContent = modal.querySelector('#scanner-result-content');

    stopCamera();
    if (cameraView) cameraView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';
    if (resultPanel) resultPanel.style.display = 'none';
    if (resultsList) resultsList.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'block';

    const books = await lookupBook(query);

    if (loadingEl) loadingEl.style.display = 'none';

    if (books && books.length > 0) {
      if (books.length === 1) {
        if (resultPanel) resultPanel.style.display = 'block';
        _renderResult(books[0]);
      } else {
        if (resultsList) resultsList.style.display = 'block';
        _renderResultsList(books);
      }
    } else {
      if (resultPanel) resultPanel.style.display = 'block';
      if (resultContent) {
        resultContent.innerHTML = `
          <p class="text-body-md" style="text-align:center; padding: 24px;">
            Livre non trouvé pour « <strong>${BT.escapeHTML(query)}</strong> ».<br>
            <button class="btn-ghost btn-ghost--ocre" id="scanner-manual-fallback" style="margin-top:16px;">Ajouter manuellement</button>
          </p>`;
        resultContent.querySelector('#scanner-manual-fallback')?.addEventListener('click', () => showManualAdd(query));
      }
    }
  }

  function _renderResultsList(books) {
    const resultsContent = modal.querySelector('#scanner-results-content');
    if (!resultsContent) return;

    let html = '<div style="display:flex;flex-direction:column;gap:12px;">';
    books.forEach((book, index) => {
      const safeTitle = BT.escapeHTML(book.title);
      const safeAuthor = BT.escapeHTML(book.author || 'Auteur inconnu');
      const safeCoverUrl = BT.escapeHTML(book.coverUrl || '');
      const coverHTML = safeCoverUrl
        ? `<img src="${safeCoverUrl}" alt="${safeTitle}" style="width:45px;height:65px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="book-cover book-cover--sm" style="background:${book.coverColor};display:none;flex-shrink:0;"><div style="position:absolute;bottom:4px;left:4px;color:white;font-family:'Playfair Display';font-size:8px;font-weight:bold;width:80%;">${safeTitle}</div></div>`
        : `<div class="book-cover book-cover--sm" style="background:${book.coverColor};flex-shrink:0;width:45px;height:65px;"><div style="position:absolute;bottom:4px;left:4px;color:white;font-family:'Playfair Display';font-size:8px;font-weight:bold;width:80%;">${safeTitle}</div></div>`;

      html += `
        <button type="button" class="hover-lift" style="display:flex;width:100%;border:0;text-align:left;gap:12px;align-items:center;padding:8px;background:var(--surface-elevated);border-radius:8px;cursor:pointer;" onclick="BT.scanner.selectBookFromResult(${index})">
          ${coverHTML}
          <div style="flex:1;overflow:hidden;">
            <h4 class="text-body-md text-serif" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeTitle}</h4>
            <p class="text-label-xs text-muted" style="margin:2px 0 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeAuthor}</p>
          </div>
        </button>
      `;
    });
    html += '</div>';

    // Store books temporarily for selection
    window._tempScannerBooks = books;
    resultsContent.innerHTML = html;
  }

  function selectBookFromResult(index) {
    if (!window._tempScannerBooks || !window._tempScannerBooks[index]) return;
    const book = window._tempScannerBooks[index];
    
    const resultsList = modal.querySelector('#scanner-results-list');
    const resultPanel = modal.querySelector('#scanner-result');
    
    if (resultsList) resultsList.style.display = 'none';
    if (resultPanel) resultPanel.style.display = 'block';
    
    _renderResult(book);
  }

  function _renderResult(bookData) {
    const resultContent = modal.querySelector('#scanner-result-content');
    if (!resultContent) return;

    const safeTitle = BT.escapeHTML(bookData.title);
    const safeAuthor = BT.escapeHTML(bookData.author || 'Auteur inconnu');
    const safePublisher = BT.escapeHTML(bookData.publisher || '');
    const safeCoverUrl = BT.escapeHTML(bookData.coverUrl || '');
    const coverHTML = safeCoverUrl
      ? `<img src="${safeCoverUrl}" alt="${safeTitle}" style="width:90px;height:130px;object-fit:cover;border-radius:8px;flex-shrink:0;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="book-cover book-cover--md" style="background:${bookData.coverColor};display:none;flex-shrink:0;"><div style="position:absolute;bottom:8px;left:8px;color:white;font-family:'Playfair Display';font-size:12px;font-weight:bold;width:80%;">${safeTitle}</div></div>`
      : `<div class="book-cover book-cover--md" style="background:${bookData.coverColor};flex-shrink:0;"><div style="position:absolute;bottom:8px;left:8px;color:white;font-family:'Playfair Display';font-size:12px;font-weight:bold;width:80%;">${safeTitle}</div></div>`;

    resultContent.innerHTML = `
      <div style="display:flex; gap:16px; align-items:flex-start; padding:8px 0;">
        ${coverHTML}
        <div style="flex:1;">
          <h3 class="text-body-lg text-serif" style="font-weight:600;margin-bottom:4px;">${safeTitle}</h3>
          <p class="text-body-sm" style="margin-bottom:4px;">${safeAuthor}</p>
          ${bookData.totalPages ? `<p class="text-label-xs text-muted">${bookData.totalPages} pages</p>` : ''}
          ${safePublisher ? `<p class="text-label-xs text-muted">${safePublisher}</p>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn-primary" style="flex:1;" id="scanner-add-btn">Ajouter à ma bibliothèque</button>
      </div>
    `;

    const addBtn = resultContent.querySelector('#scanner-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const shouldStart = !BT.store.getCurrentBook();
        const newBook = BT.store.addBook({
          title: bookData.title,
          author: bookData.author,
          totalPages: bookData.totalPages || 0,
          coverColor: bookData.coverColor,
          coverUrl: bookData.coverUrl || '',
          isbn: bookData.isbn,
          status: shouldStart ? 'en-cours' : 'a-lire'
        });
        if (shouldStart) BT.store.setCurrentBook(newBook.id);
        // Refresh state and close
        if (BT.refreshState) BT.refreshState();
        closeModal();
        BT.showToast(shouldStart ? 'Livre ajouté comme lecture en cours' : 'Livre ajouté à la bibliothèque');
        window.location.hash = shouldStart ? '#home' : '#library';
      });
    }
  }

  function showManualAdd(query) {
    const searchView = modal.querySelector('#scanner-search-view');
    const resultPanel = modal.querySelector('#scanner-result');
    const resultContent = modal.querySelector('#scanner-result-content');
    
    if (searchView) searchView.style.display = 'none';
    if (resultPanel) resultPanel.style.display = 'block';
    if (!resultContent) return;

    let defaultTitle = query;
    let defaultAuthor = '';
    
    if (query && typeof query === 'string' && query.includes(',')) {
      const parts = query.split(',');
      defaultTitle = parts[0].trim();
      defaultAuthor = parts[1].trim();
    }

    resultContent.innerHTML = `
      <div style="padding:8px 0;">
        <h3 class="text-body-lg text-serif" style="font-weight:600;margin-bottom:16px;">Ajouter un livre</h3>
        <div style="margin-bottom:12px;">
          <label class="text-label-xs text-muted" style="display:block;margin-bottom:4px;">Titre</label>
          <input type="text" id="manual-title" class="session-comment__input" style="width:100%;" placeholder="Titre du livre" value="${BT.escapeHTML(defaultTitle || '')}">
        </div>
        <div style="margin-bottom:12px;">
          <label class="text-label-xs text-muted" style="display:block;margin-bottom:4px;">Auteur</label>
          <input type="text" id="manual-author" class="session-comment__input" style="width:100%;" placeholder="Nom de l'auteur" value="${BT.escapeHTML(defaultAuthor || '')}">
        </div>
        <div style="margin-bottom:16px;">
          <label class="text-label-xs text-muted" style="display:block;margin-bottom:4px;">Nombre de pages</label>
          <input type="number" id="manual-pages" class="session-comment__input" style="width:100%;" placeholder="Ex: 250">
        </div>
        <button class="btn-primary" style="width:100%;" id="manual-add-btn">Ajouter</button>
      </div>
    `;

    const addBtn = resultContent.querySelector('#manual-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const title = document.getElementById('manual-title').value.trim();
        const author = document.getElementById('manual-author').value.trim();
        const pages = parseInt(document.getElementById('manual-pages').value) || 0;

        if (!title) return;

        const shouldStart = !BT.store.getCurrentBook();
        const newBook = BT.store.addBook({
          title, author,
          totalPages: pages,
          coverColor: _generateGradient(title + author),
          coverUrl: '',
          isbn: '',
          status: shouldStart ? 'en-cours' : 'a-lire'
        });

        if (shouldStart) BT.store.setCurrentBook(newBook.id);

        if (BT.refreshState) BT.refreshState();
        closeModal();
        BT.showToast(shouldStart ? 'Livre ajouté comme lecture en cours' : 'Livre ajouté à la bibliothèque');
        window.location.hash = shouldStart ? '#home' : '#library';
      });
    }
  }

  function closeModal() {
    stopCamera();
    stopScanning();
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    modal = null;
    window._tempScannerBooks = null;
  }

  return {
    isBarcodeSupported,
    lookupBook,
    startCamera,
    stopCamera,
    startScanning,
    stopScanning,
    openModal,
    closeModal,
    showManualAdd,
    selectBookFromResult,
    _generateGradient
  };
})();

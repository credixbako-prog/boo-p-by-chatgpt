/** BOO-P MVP v5.5 — première ouverture en quatre étapes, une seule fois par compte. */
(async () => {
  'use strict';
  window.BT = window.BT || {};
  const query = new URLSearchParams(location.search);
  const localPreview = ['localhost','127.0.0.1'].includes(location.hostname) && query.has('preview');
  let authenticatedUser = null;
  try { authenticatedUser = await BT.auth?.ready?.(); }
  catch { if (!localPreview) { location.replace('index.html?auth=login&reason=auth-error'); return; } }
  if (!authenticatedUser && !localPreview) { location.replace('index.html?auth=signup&reason=account-required'); return; }
  BT.store?.useUser?.(authenticatedUser?.id || 'onboarding-preview');
  const completedRemotely = Boolean(authenticatedUser?.profile?.onboarding_completed);
  if (completedRemotely && !BT.store?.isOnboardingComplete()) {
    BT.store?.saveOnboarding?.({ completed:true, version:5.5, restoredFromProfile:true, completedAt:new Date().toISOString() });
  }
  if (completedRemotely || BT.store?.isOnboardingComplete()) { location.replace('app.html'); return; }

  let booksData = Array.isArray(BT.ONBOARDING_BOOKS) ? [...BT.ONBOARDING_BOOKS] : [];
  const MAX_SELECTED_BOOKS = 5;
  const selectedBooks = [];
  const initialTraces = new Map();
  let currentStep = 1;
  let dailyGoal = 15;
  let finishing = false;

  const bookGrid = document.getElementById('bookGrid');
  const bookSparks = document.getElementById('bookSparks');
  const bookSearch = document.getElementById('bookSearch');
  const scanButton = document.getElementById('scanOnboardingBook');
  const scanInput = document.getElementById('onboardingBookScan');
  const scanStatus = document.getElementById('onboardingScanStatus');
  const continueButton = document.getElementById('btnContinue');
  const counter = document.getElementById('selectionCounter');
  const ring = document.getElementById('goalRingContainer');
  const ringProgress = document.getElementById('goalProgress');
  const ringKnob = document.getElementById('goalKnob');
  const goalValue = document.getElementById('goalVal');

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]);

  function renderBooks(filter = '') {
    const query = normalize(filter);
    const matching = booksData.filter(book => normalize(`${book.title} ${book.author}`).includes(query));
    bookGrid.innerHTML = matching.map(book => {
      const isSelected = selectedBooks.some(item => item.id === book.id);
      return `<button type="button" class="book-tile ${isSelected ? 'selected' : ''}" data-book-id="${book.id}" aria-pressed="${isSelected}" aria-label="${escapeHTML(book.title)}${book.author ? `, ${escapeHTML(book.author)}` : ''}, publié en ${book.year}" style="background:${book.gradient}"><img class="book-tile__cover" src="${escapeHTML(book.coverUrl)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true"><span class="book-tile__title"><strong>${escapeHTML(book.title)}</strong><small>${escapeHTML(book.author)} · ${book.year}</small></span><span class="book-tile__overlay" aria-hidden="true"><svg class="book-tile__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span></button>`;
    }).join('') || '<p class="text-body-md text-center text-muted" style="grid-column:1/-1">Aucun résultat. Essayez un titre plus court.</p>';
  }

  async function scanPhysicalBook(file,framed=false) {
    if (!file || !BT.bookLookup) return;
    scanButton.disabled = true;
    scanButton.setAttribute('aria-busy','true');
    try {
      const cropped=framed?file:await BT.photoFrame.open(file,{isbn:true});if(!cropped)return;
      const prepared = await BT.bookLookup.prepareCover(cropped, update => { scanStatus.textContent = update.message || 'Préparation de la photo…'; });
      const analysis = await BT.bookLookup.scanISBNFromImage(prepared.analysisBlob, update => { scanStatus.textContent = update.message || 'Recherche du livre…'; });
      const result = analysis.results?.[0];
      if (!result) throw new Error(analysis.isbn ? `L’ISBN ${analysis.isbn} a été détecté, mais aucun livre correspondant n’a été trouvé.` : 'Aucun ISBN lisible. Cadrez uniquement le code-barres et réessayez.');
      const known = booksData.find(book => normalize(book.isbn) === normalize(result.isbn) || normalize(book.title) === normalize(result.title));
      const scanned = known || {
        id:`origin-scan-${result.isbn || Date.now()}`,
        isbn:result.isbn || analysis.isbn || '',
        title:result.title || 'Livre scanné',
        author:(result.authors || []).join(', ') || 'Auteur inconnu',
        year:Number(String(result.publishedDate || '').slice(0,4)) || new Date().getFullYear(),
        totalPages:Number(result.totalPages) || 0,
        genres:result.genres?.length ? result.genres : [result.genre || 'À classer'],
        coverUrl:result.coverUrl || '',
        gradient:result.coverColor || 'linear-gradient(135deg,#243B55,#6D8F7A)'
      };
      if (!known) booksData = [scanned, ...booksData];
      if (!selectedBooks.some(book => book.id === scanned.id)) {
        if (selectedBooks.length >= MAX_SELECTED_BOOKS) throw new Error('Le livre a été trouvé. Retirez une sélection pour pouvoir l’ajouter aux cinq livres choisis.');
        selectedBooks.push(scanned);
      }
      bookSearch.value = '';
      renderBooks(); renderSparks(); updateControls();
      scanStatus.textContent = `« ${scanned.title} » a été trouvé et sélectionné.`;
    } catch (error) {
      scanStatus.textContent = error.message || 'Le scan n’a pas abouti. Vous pouvez réessayer.';
    } finally {
      scanButton.disabled = false;
      scanButton.removeAttribute('aria-busy');
      scanInput.value = '';
    }
  }

  function renderSparks() {
    bookSparks.innerHTML = selectedBooks.map(book => `<label class="onboarding-spark" for="spark-${book.id}"><span class="onboarding-spark__head"><strong>L’étincelle · ${escapeHTML(book.title)}</strong><span>Facultatif</span></span><span class="text-body-sm text-muted">Pourquoi ce livre vous a-t-il marqué ? Une phrase suffit.</span><textarea id="spark-${book.id}" data-spark-book-id="${book.id}" maxlength="240" placeholder="Ce que ce livre a laissé en moi…">${escapeHTML(initialTraces.get(book.id) || '')}</textarea></label>`).join('');
  }

  bookGrid.addEventListener('click', event => {
    const tile = event.target.closest('[data-book-id]'); if (!tile) return;
    const book = booksData.find(item => item.id === tile.dataset.bookId); if (!book) return;
    const index = selectedBooks.findIndex(item => item.id === book.id);
    if (index >= 0) { selectedBooks.splice(index, 1); initialTraces.delete(book.id); }
    else if (selectedBooks.length < MAX_SELECTED_BOOKS) selectedBooks.push(book);
    else { tile.animate?.([{ transform:'translateX(-4px)' },{ transform:'translateX(4px)' },{ transform:'translateX(0)' }], { duration:180 }); return; }
    renderBooks(bookSearch.value); renderSparks(); updateControls();
  });
  bookSparks.addEventListener('input', event => {
    const field = event.target.closest('[data-spark-book-id]');
    if (field) initialTraces.set(field.dataset.sparkBookId, field.value.slice(0, 240));
  });
  bookSearch.addEventListener('input', () => renderBooks(bookSearch.value));
  scanButton.addEventListener('click', async () => {const file=await BT.photoFrame.camera();if(file)await scanPhysicalBook(file,true);});
  scanInput.addEventListener('change', () => scanPhysicalBook(scanInput.files?.[0]));

  function updateControls() {
    counter.innerHTML = currentStep === 1 ? `<strong>${selectedBooks.length}/${MAX_SELECTED_BOOKS}</strong> sélectionnés · étape facultative` : currentStep === 4 ? 'Votre sentier prend forme…' : `Étape ${currentStep}/4`;
    continueButton.disabled = false;
    continueButton.hidden = currentStep === 4;
    continueButton.classList.toggle('active', !continueButton.disabled);
    continueButton.textContent = currentStep === 1 && selectedBooks.length === 0 ? 'Passer cette étape' : currentStep === 1 ? `Continuer avec ${selectedBooks.length} livre${selectedBooks.length > 1 ? 's' : ''}` : 'Continuer';
  }

  continueButton.addEventListener('click', () => {
    if (currentStep < 4) goToStep(currentStep + 1);
  });

  function goToStep(step) {
    const previous = document.getElementById(`step${currentStep}`);
    previous.classList.remove('active'); previous.classList.add('previous');
    currentStep = step;
    const next = document.getElementById(`step${currentStep}`);
    next.classList.remove('previous'); next.classList.add('active');
    document.querySelectorAll('.indicator-dot').forEach((dot,index) => dot.classList.toggle('active', index + 1 === currentStep));
    if (currentStep === 2) updateRing(dailyGoal);
    if (currentStep === 4) generateSentier();
    updateControls();
    next.querySelector('h1')?.focus?.({ preventScroll:true });
  }

  function bindThemeTag(tag) {
    tag.addEventListener('click', () => {
      if (tag.textContent.trim() === 'Autre') { document.getElementById('customTheme')?.focus(); return; }
      const active = !tag.classList.contains('active'); tag.classList.toggle('active', active); tag.setAttribute('aria-pressed', String(active));
    });
  }
  document.querySelectorAll('#themeTags .theme-tag').forEach(bindThemeTag);

  function addCustomTheme() {
    const input = document.getElementById('customTheme');
    const value = input.value.trim();
    if (!value) { input.focus(); return; }
    const duplicate = [...document.querySelectorAll('#themeTags .theme-tag')].some(tag => normalize(tag.textContent) === normalize(value));
    if (duplicate) { input.setCustomValidity('Ce thème est déjà proposé.'); input.reportValidity(); input.setCustomValidity(''); return; }
    const tag = document.createElement('button');
    tag.type = 'button'; tag.className = 'theme-tag active'; tag.dataset.customTheme = 'true';
    tag.setAttribute('aria-pressed','true'); tag.textContent = value;
    document.getElementById('themeTags').insertBefore(tag, document.getElementById('themeTags').lastElementChild);
    bindThemeTag(tag); input.value = ''; tag.focus();
  }
  document.getElementById('addCustomTheme').addEventListener('click', addCustomTheme);
  document.getElementById('customTheme').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTheme(); } });

  function updateRing(value) {
    dailyGoal = Math.max(5, Math.min(60, Math.round(value / 5) * 5));
    goalValue.textContent = dailyGoal; ring.setAttribute('aria-valuenow', String(dailyGoal));
    const progress = (dailyGoal - 5) / 55, circumference = 2 * Math.PI * 100;
    ringProgress.style.strokeDashoffset = circumference - progress * circumference;
    const angle = progress * 2 * Math.PI - Math.PI / 2;
    ringKnob.setAttribute('cx', String(110 + 100 * Math.cos(angle)));
    ringKnob.setAttribute('cy', String(110 + 100 * Math.sin(angle)));
    document.querySelectorAll('[data-goal-preset]').forEach(button => button.classList.toggle('active', Number(button.dataset.goalPreset) === dailyGoal));
  }
  document.querySelectorAll('[data-goal-preset]').forEach(button => button.addEventListener('click', () => updateRing(Number(button.dataset.goalPreset))));
  function ringValueFromPointer(event) {
    const rect = ring.getBoundingClientRect();
    const angle = (Math.atan2(event.clientY - (rect.top + rect.height/2), event.clientX - (rect.left + rect.width/2)) + Math.PI/2 + Math.PI*2) % (Math.PI*2);
    updateRing(5 + angle / (Math.PI*2) * 55);
  }
  let dragging = false;
  ring.addEventListener('pointerdown', event => { dragging = true; ring.setPointerCapture?.(event.pointerId); ringValueFromPointer(event); });
  ring.addEventListener('pointermove', event => { if (dragging) ringValueFromPointer(event); });
  ring.addEventListener('pointerup', () => { dragging = false; });
  ring.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') updateRing(5); else if (event.key === 'End') updateRing(60); else updateRing(dailyGoal + (['ArrowRight','ArrowUp'].includes(event.key) ? 5 : -5));
  });

  function generateSentier() {
    const wrapper = document.getElementById('sentierBooksWrapper'); wrapper.innerHTML = '';
    const previewBooks = selectedBooks.length ? selectedBooks : [{ title:'Votre prochain livre' }];
    previewBooks.forEach((book,index) => {
      const item = document.createElement('div'); item.className = `sentier-book ${index % 2 ? 'right' : 'left'}`;
      item.innerHTML = `<div class="sentier-book-card"><div class="sentier-book-title">${escapeHTML(book.title)}</div></div>`; wrapper.appendChild(item);
      setTimeout(() => item.classList.add('visible'), 120 + index * 180);
    });
    setTimeout(() => { document.getElementById('sentierLine').style.height = '100%'; createCelebration(); }, 80);
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 2600;
    setTimeout(finishOnboarding, delay);
  }
  function createCelebration() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = document.getElementById('step4');
    for (let index=0; index<16; index++) { const dot = document.createElement('span'); dot.className = 'confetti'; dot.style.left = `${Math.random()*100}%`; dot.style.background = index % 2 ? '#6D8F7A' : '#D28B3D'; dot.style.animationDelay = `${Math.random()}s`; host.appendChild(dot); setTimeout(() => dot.remove(), 3600); }
  }

  async function finishOnboarding() {
    if (finishing) return;
    finishing = true;
    continueButton.disabled = true;
    continueButton.textContent = 'Préparation de votre espace…';
    const themes = [...document.querySelectorAll('#themeTags .theme-tag.active')].map(tag => tag.textContent.trim()).filter(theme => theme !== 'Autre');
    const visibility = 'private';
    const currentBooks = BT.store.getBooks();
    selectedBooks.forEach((book,index) => {
      const existing = currentBooks.find(item => normalize(item.title) === normalize(book.title));
      const updates = { isADN:true, adnOrder:index, status:'lu', historicalBeforeJoin:true, completedAt:null, currentPage:book.totalPages || existing?.currentPage || 0 };
      const savedBook = existing
        ? BT.store.updateBook(existing.id, updates)
        : BT.store.addBook({ title:book.title, authors:[book.author].filter(Boolean), isbn:book.isbn || '', publishedDate:String(book.year || ''), genres:book.genres || [], totalPages:book.totalPages, currentPage:book.totalPages, coverUrl:book.coverUrl, coverColor:book.gradient, ...updates });
      const traceText = String(initialTraces.get(book.id) || '').trim();
      if (traceText) BT.store.saveTrace({ bookId:savedBook.id, text:traceText, privacy:'private', type:'onboarding', source:'onboarding' });
    });
    BT.store.saveGoal({ dailyMinutes:dailyGoal });
    const profile = BT.store.getProfile(), user = BT.auth.getCurrentUser();
    BT.store.saveProfile({ ...profile, name:user?.name || profile.name, email:user?.email || profile.email, interests:themes, visibility });
    BT.store.saveSettings({ defaultPostVisibility:'me' });
    BT.store.saveOnboarding({ completed:true, version:5.5, selectedBooks:selectedBooks.map(book => book.id), dailyGoalMinutes:dailyGoal, themes, profileVisibility:visibility, completedAt:new Date().toISOString() });
    if (authenticatedUser) {
      try {
        await BT.auth.updateProfile({
          displayName: user?.name || profile.name,
          onboardingCompleted: true,
          profileVisibility: visibility,
          dailyGoalMinutes: dailyGoal,
          interests: themes
        });
      } catch (error) {
        console.error('Synchronisation du profil BOO-P différée', error);
      }
    }
    location.href = localPreview ? 'app.html?preview=1#home' : 'app.html#home';
  }

  renderBooks(); renderSparks(); updateRing(15); updateControls();
})();

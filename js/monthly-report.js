/** BOO-P — rapport mensuel local, exporté en image sociale 4:5. */
(() => {
  'use strict';

  const WIDTH = 1080;
  const HEIGHT = 1350;
  const COVER_ZONE_HEIGHT = Math.round(HEIGHT * .75);
  const COLORS = {
    paper:'#f5efe5', paperSoft:'#ebe2d4', ink:'#17324d', muted:'#68747d',
    sage:'#6f927c', sageDark:'#456a59', ochre:'#cf873d', white:'#fffdf8', line:'#d9cebf', rose:'#b96862'
  };
  const COVER_PROXY_FUNCTION = 'cover-image-proxy';

  function localMonthKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function normalizeMonthKey(value) {
    const clean = String(value || '');
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(clean) ? clean : localMonthKey();
  }

  function monthLabel(monthKey) {
    const [year, month] = normalizeMonthKey(monthKey).split('-').map(Number);
    const label = new Intl.DateTimeFormat('fr-FR', { month:'long', year:'numeric' }).format(new Date(year, month - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function inMonth(value, monthKey) { return Boolean(value) && localMonthKey(value) === monthKey; }
  function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

  const REPORT_STATUSES = ['lu', 'en-cours', 'en-pause', 'abandonne'];
  const STATUS_LABELS = { lu:'Terminé', 'en-cours':'En cours', 'en-pause':'En pause', abandonne:'Abandonné' };

  function reportBooks(state, monthKey, monthSessions) {
    const sessionBookIds = new Set(monthSessions.map(session => session.bookId).filter(Boolean));
    (state.activeSessions || []).forEach(session => {
      if ([session.startedAt, session.resumedAt, session.pausedAt, session.lastSeenAt].some(value => inMonth(value, monthKey))) sessionBookIds.add(session.bookId);
    });
    const statusBookIds = new Set((state.timeline || [])
      .filter(event => String(event.type || '').startsWith('status-') && inMonth(event.date, monthKey))
      .map(event => event.bookId).filter(Boolean));
    const isCurrentMonth = monthKey === localMonthKey();

    return (state.books || []).filter(book => {
      if (book.libraryState !== 'library' || !REPORT_STATUSES.includes(book.status)) return false;
      const hasMonthlyActivity = sessionBookIds.has(book.id) || statusBookIds.has(book.id)
        || [book.startedAt, book.completedAt, book.lastUsedAt, book.statusUpdatedAt, book.addedAt].some(value => inMonth(value, monthKey));
      const stillOnCurrentPath = isCurrentMonth && ['en-cours', 'en-pause', 'abandonne'].includes(book.status);
      return hasMonthlyActivity || stillOnCurrentPath;
    }).sort((a, b) => {
      const activity = book => Math.max(...[book.completedAt, book.lastUsedAt, book.statusUpdatedAt, book.startedAt, book.addedAt].map(value => new Date(value || 0).getTime()));
      return activity(b) - activity(a);
    });
  }

  function buildData(state, monthKey, includePersonalNotes = false) {
    const key = normalizeMonthKey(monthKey);
    const sessions = (state.sessions || []).filter(session => inMonth(session.startedAt, key));
    const books = reportBooks(state, key, sessions);
    const entries = (state.lexicon || []).filter(entry => inMonth(entry.createdAt || entry.updatedAt, key));
    const traces = (state.traces || []).filter(trace => inMonth(trace.createdAt || trace.updatedAt, key));
    const words = entries.filter(entry => (entry.kind || 'word') === 'word');
    const expressions = entries.filter(entry => entry.kind === 'expression');
    const citations = entries.filter(entry => entry.kind === 'citation');
    const notes = includePersonalNotes
      ? [...traces.map(trace => cleanText(trace.text)), ...sessions.map(session => cleanText(session.note))].filter(Boolean).slice(0, 3)
      : [];
    const minutes = Math.round(sessions.reduce((sum, session) => sum + (Number(session.durationSeconds) || 0) / 60, 0));
    const profileName = cleanText(state.profile?.name) || 'Lecteur BOO-P';
    const handle = cleanText(state.profile?.handle);
    const statusCounts = REPORT_STATUSES.reduce((counts, status) => ({ ...counts, [status]:books.filter(book => book.status === status).length }), {});
    const statusSummary = [
      statusCounts.lu && `${statusCounts.lu} terminé${statusCounts.lu > 1 ? 's' : ''}`,
      statusCounts['en-cours'] && `${statusCounts['en-cours']} en cours`,
      statusCounts['en-pause'] && `${statusCounts['en-pause']} en pause`,
      statusCounts.abandonne && `${statusCounts.abandonne} abandonné${statusCounts.abandonne > 1 ? 's' : ''}`
    ].filter(Boolean).join(' · ');
    return {
      monthKey:key, label:monthLabel(key), profileName, handle, includePersonalNotes, statusCounts, statusSummary,
      books:books.map(book => ({
        title:cleanText(book.title), authors:(book.authors || []).map(cleanText).filter(Boolean), rating:Number(book.rating) || 0,
        coverUrl:cleanText(book.coverUrl), coverColor:cleanText(book.coverColor), status:book.status, statusLabel:STATUS_LABELS[book.status]
      })),
      minutes, sessions:sessions.length, words:words.length, expressions:expressions.length, citations:citations.length,
      discoveries:entries.slice(0, 4).map(entry => ({ kind:entry.kind || 'word', text:cleanText(entry.word), definition:cleanText(entry.definition) })),
      notes,
      summary:books.length
        ? `${books.length} lecture${books.length > 1 ? 's' : ''} suivie${books.length > 1 ? 's' : ''} ce mois${statusSummary ? ` : ${statusSummary}` : ''}.`
        : `${minutes} minutes de lecture et ${entries.length} découverte${entries.length > 1 ? 's' : ''} consignées sur le sentier.`
    };
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function truncate(value, limit) {
    const text = cleanText(value);
    return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1)).trim()}…` : text;
  }

  function wrapLines(ctx, text, maxWidth, maxLines = 3) {
    const words = cleanText(text).split(' ').filter(Boolean), lines = [];
    let current = '';
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      while (ctx.measureText(`${lines[maxLines - 1]}…`).width > maxWidth && lines[maxLines - 1].length > 1) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
      lines[maxLines - 1] = `${lines[maxLines - 1].trim()}…`;
    }
    return lines;
  }

  function drawLines(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const lines = wrapLines(ctx, text, maxWidth, maxLines);
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  function coverPalette(book, index) {
    const matches = String(book.coverColor || '').match(/#[0-9a-f]{6}/gi) || [];
    const fallback = [COLORS.sageDark, COLORS.ochre, COLORS.ink, COLORS.rose, '#466b87', '#708d75'];
    return [matches[0] || fallback[index % fallback.length], matches[1] || fallback[(index + 1) % fallback.length]];
  }

  function coverProxyUrl(url) {
    const source = cleanText(url);
    if (!/^https:\/\//i.test(source)) return source;
    const projectUrl = cleanText(window.BOOP_SUPABASE_CONFIG?.url).replace(/\/$/, '');
    if (!projectUrl || source.startsWith(`${projectUrl}/storage/`) || source.startsWith(`${projectUrl}/functions/v1/${COVER_PROXY_FUNCTION}`)) return source;
    return `${projectUrl}/functions/v1/${COVER_PROXY_FUNCTION}?url=${encodeURIComponent(source)}`;
  }

  function imageHasVisibleContent(image) {
    const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
    if (width < 32 || height < 48 || typeof document === 'undefined') return false;
    try {
      const sample = document.createElement('canvas'); sample.width = 12; sample.height = 18;
      const context = sample.getContext('2d'); context.drawImage(image, 0, 0, sample.width, sample.height);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      let visible = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 24) visible += 1;
      return visible >= sample.width * sample.height * .65;
    } catch { return true; }
  }

  function loadImageCandidate(url, timeoutMs) {
    return new Promise(resolve => {
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), timeoutMs);
      image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
      image.onload = () => { window.clearTimeout(timer); resolve(imageHasVisibleContent(image) ? image : null); };
      image.onerror = () => { window.clearTimeout(timer); resolve(null); };
      image.src = url;
    });
  }

  async function loadProxiedImage(url) {
    const token = window.BT?.auth?.getSession?.()?.access_token;
    const publishableKey = cleanText(window.BOOP_SUPABASE_CONFIG?.publishableKey);
    const proxied = coverProxyUrl(url);
    if (!token || !proxied || proxied === url || typeof fetch !== 'function') return null;
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = window.setTimeout(() => controller?.abort(), 8_000);
    try {
      const response = await fetch(proxied, {
        signal:controller?.signal,
        headers:{ Authorization:`Bearer ${token}`, ...(publishableKey ? { apikey:publishableKey } : {}) }
      });
      if (!response.ok || !String(response.headers.get('content-type') || '').startsWith('image/')) return null;
      const objectUrl = URL.createObjectURL(await response.blob());
      try { return await loadImageCandidate(objectUrl, 4_000); }
      finally { URL.revokeObjectURL(objectUrl); }
    } catch { return null; }
    finally { window.clearTimeout(timer); }
  }

  async function loadCoverImage(url) {
    if (!url || typeof Image === 'undefined') return null;
    const proxied = await loadProxiedImage(cleanText(url));
    if (proxied) return proxied;
    const candidates = [cleanText(url)].filter(Boolean);
    for (let index = 0; index < candidates.length; index += 1) {
      const image = await loadImageCandidate(candidates[index], 4_000);
      if (image) return image;
    }
    return null;
  }

  function drawContainedImage(ctx, image, x, y, width, height) {
    const sourceWidth = image.naturalWidth || image.width, sourceHeight = image.naturalHeight || image.height;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const targetWidth = sourceWidth * scale, targetHeight = sourceHeight * scale;
    ctx.drawImage(image, x + (width - targetWidth) / 2, y + (height - targetHeight) / 2, targetWidth, targetHeight);
  }

  function drawFallbackCover(ctx, book, index, x, y, width, height) {
    const [start, end] = coverPalette(book, index), gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, start); gradient.addColorStop(1, end); ctx.fillStyle = gradient; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x + Math.max(10, width * .075), y, 3, height);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = `600 ${Math.max(12, width * .065)}px Poppins, Arial, sans-serif`;
    ctx.fillText('BOO-P', x + width * .15, y + height * .15);
    ctx.fillStyle = COLORS.white; ctx.font = `600 ${Math.max(20, width * .115)}px "Playfair Display", Georgia, serif`;
    drawLines(ctx, book.title || 'Lecture BOO-P', x + width * .15, y + height * .43, width * .7, Math.max(25, width * .13), 4);
  }

  function statusColor(status) {
    return ({ lu:COLORS.sageDark, 'en-cours':COLORS.ochre, 'en-pause':COLORS.ink, abandonne:COLORS.rose })[status] || COLORS.muted;
  }

  function drawCoverCard(ctx, book, image, index, x, y, width, angle = 0) {
    const coverHeight = width * 1.5, captionHeight = Math.max(48, width * .28), cardHeight = coverHeight + captionHeight;
    ctx.save(); ctx.translate(x + width / 2, y + cardHeight / 2); ctx.rotate(angle); ctx.translate(-width / 2, -cardHeight / 2);
    ctx.shadowColor = 'rgba(23,50,77,.24)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 14;
    roundedRect(ctx, 0, 0, width, cardHeight, 10); ctx.fillStyle = COLORS.white; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.save(); roundedRect(ctx, 0, 0, width, coverHeight, 9); ctx.clip(); ctx.fillStyle = COLORS.paperSoft; ctx.fillRect(0, 0, width, coverHeight);
    if (image) drawContainedImage(ctx, image, 0, 0, width, coverHeight);
    else drawFallbackCover(ctx, book, index, 0, 0, width, coverHeight);
    ctx.restore();
    roundedRect(ctx, 12, 12, Math.min(width - 24, Math.max(80, cleanText(book.statusLabel).length * 8 + 28)), 30, 15);
    ctx.fillStyle = statusColor(book.status); ctx.fill();
    ctx.fillStyle = COLORS.white; ctx.font = '700 11px Poppins, Arial, sans-serif'; ctx.fillText(String(book.statusLabel || 'Lecture').toUpperCase(), 25, 32);
    ctx.fillStyle = COLORS.ink; ctx.font = `600 ${Math.max(12, width * .07)}px Poppins, Arial, sans-serif`;
    ctx.textAlign = 'center'; drawLines(ctx, truncate(book.title || 'Lecture BOO-P', 32), width / 2, coverHeight + 21, width - 18, Math.max(14, width * .08), 2); ctx.textAlign = 'left';
    ctx.restore();
    return cardHeight;
  }

  async function drawBookGallery(ctx, books, x, y, width, height) {
    const shown = books.slice(0, 8);
    if (!shown.length) {
      ctx.save();
      roundedRect(ctx, x, y, width, height, 34); ctx.fillStyle = COLORS.paperSoft; ctx.fill();
      const shades = [COLORS.sage, COLORS.ochre, COLORS.ink, COLORS.rose];
      shades.forEach((color, index) => {
        const bookWidth = 106 + index * 5, bookHeight = 330 + index * 28, left = x + width / 2 - 245 + index * 120;
        roundedRect(ctx, left, y + height - bookHeight - 58, bookWidth, bookHeight, 7); ctx.fillStyle = color; ctx.fill();
      });
      ctx.fillStyle = COLORS.ink; ctx.font = '600 31px "Playfair Display", Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText('Le prochain chapitre reste à écrire.', x + width / 2, y + height - 12); ctx.textAlign = 'left'; ctx.restore();
      return;
    }

    const images = await Promise.all(shown.map(book => loadCoverImage(book.coverUrl)));
    const columns = shown.length <= 3 ? shown.length : shown.length === 4 ? 2 : shown.length <= 6 ? 3 : 4;
    const cardWidth = shown.length === 1 ? 390 : shown.length === 2 ? 330 : shown.length === 3 ? 270 : shown.length === 4 ? 195 : shown.length <= 6 ? 190 : 168;
    const cardHeight = cardWidth * 1.5 + Math.max(48, cardWidth * .28), gapX = shown.length <= 3 ? 36 : 24, gapY = 18;
    const rows = Math.ceil(shown.length / columns), totalHeight = rows * cardHeight + (rows - 1) * gapY;
    const startY = y + Math.max(0, (height - totalHeight - 16) / 2);
    const angles = [-0.018, 0.014, -0.01, 0.016, -0.012, 0.01, -0.008, 0.012];
    shown.forEach((book, index) => {
      const row = Math.floor(index / columns), column = index % columns, rowCount = Math.min(columns, shown.length - row * columns);
      const rowWidth = rowCount * cardWidth + (rowCount - 1) * gapX;
      const startX = x + (width - rowWidth) / 2;
      drawCoverCard(ctx, book, images[index], index, startX + column * (cardWidth + gapX), startY + row * (cardHeight + gapY), cardWidth, shown.length === 1 ? 0 : angles[index]);
    });
    ctx.fillStyle = COLORS.sageDark; ctx.fillRect(x + 20, y + height - 10, width - 40, 5);
    ctx.fillStyle = 'rgba(69,106,89,.16)'; ctx.fillRect(x + 42, y + height - 5, width - 84, 5);
    if (books.length > shown.length) {
      roundedRect(ctx, x + width - 160, y - 6, 145, 50, 25); ctx.fillStyle = COLORS.ochre; ctx.fill();
      ctx.fillStyle = COLORS.white; ctx.font = '700 17px Poppins, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`+ ${books.length - shown.length} livre${books.length - shown.length > 1 ? 's' : ''}`, x + width - 87, y + 26); ctx.textAlign = 'left';
    }
  }

  function drawCompactMetric(ctx, x, y, value, label, accent) {
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y - 9, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ink; ctx.font = '700 29px "Playfair Display", Georgia, serif'; ctx.fillText(String(value), x + 15, y);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 11px Poppins, Arial, sans-serif'; ctx.fillText(label.toUpperCase(), x + 15, y + 25);
  }

  function drawBackground(ctx) {
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const wash = ctx.createRadialGradient(920, 120, 30, 920, 120, 440);
    wash.addColorStop(0, 'rgba(207,135,61,.2)'); wash.addColorStop(1, 'rgba(207,135,61,0)'); ctx.fillStyle = wash; ctx.fillRect(480, 0, 600, 620);
    ctx.fillStyle = 'rgba(111,146,124,.13)'; ctx.beginPath(); ctx.arc(45, 510, 220, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(23,50,77,.055)'; ctx.lineWidth = 2;
    for (let y = 30; y < HEIGHT; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y + 12); ctx.stroke(); }
  }

  let brandImages;
  function loadBrandImages() {
    brandImages ||= Promise.all(['boo-p-horizontal', 'boo-p-horizontal-reverse'].map(name => new Promise(resolve => {
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), 4000);
      image.onload = () => { window.clearTimeout(timer); resolve(image); };
      image.onerror = () => { window.clearTimeout(timer); resolve(null); };
      image.src = new URL(`assets/brand/${name}.svg`, document.baseURI).href;
    })));
    return brandImages;
  }

  async function render(data) {
    await document.fonts?.ready?.catch?.(() => {});
    const [brand, brandReverse] = await loadBrandImages();
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha:false }); drawBackground(ctx);

    roundedRect(ctx, 48, 34, 142, 48, 24); ctx.fillStyle = COLORS.ink; ctx.fill();
    if (brandReverse) ctx.drawImage(brandReverse, 59, 40, 120, 36);
    else { ctx.fillStyle = COLORS.white; ctx.font = '700 20px Poppins, Arial, sans-serif'; ctx.fillText('BOO-P', 82, 66); }
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 14px Poppins, Arial, sans-serif'; ctx.fillText('MON SENTIER · RAPPORT MENSUEL', 48, 112);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 55px "Playfair Display", Georgia, serif'; ctx.fillText(data.label, 48, 173);
    ctx.fillStyle = COLORS.muted; ctx.font = '500 17px Poppins, Arial, sans-serif'; ctx.fillText(truncate(data.handle || data.profileName, 36), 50, 207);
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 16px Poppins, Arial, sans-serif'; ctx.fillText(truncate(data.statusSummary || 'Le sentier continue', 92), 50, 242);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.ochre; ctx.font = '700 84px "Playfair Display", Georgia, serif'; ctx.fillText(String(data.books.length), 1028, 158);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 14px Poppins, Arial, sans-serif'; ctx.fillText(`LECTURE${data.books.length > 1 ? 'S' : ''} SUIVIE${data.books.length > 1 ? 'S' : ''}`, 1028, 190); ctx.textAlign = 'left';

    await drawBookGallery(ctx, data.books, 42, 270, 996, COVER_ZONE_HEIGHT - 278);

    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, COVER_ZONE_HEIGHT, WIDTH, HEIGHT - COVER_ZONE_HEIGHT);
    ctx.fillStyle = COLORS.sageDark; ctx.fillRect(0, COVER_ZONE_HEIGHT, WIDTH, 8);
    const duration = data.minutes >= 60 ? `${Math.floor(data.minutes / 60)} h ${String(data.minutes % 60).padStart(2, '0')}` : `${data.minutes} min`;
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 12px Poppins, Arial, sans-serif'; ctx.fillText('MON MOIS EN QUELQUES MOTS', 50, 1053);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.muted; ctx.fillText(truncate(data.handle || data.profileName, 30), 1028, 1053); ctx.textAlign = 'left';
    drawCompactMetric(ctx, 50, 1100, duration, 'lecture', COLORS.ochre);
    drawCompactMetric(ctx, 274, 1100, data.sessions, 'sessions', COLORS.sageDark);
    drawCompactMetric(ctx, 452, 1100, data.words, 'mots appris', COLORS.sageDark);
    drawCompactMetric(ctx, 658, 1100, data.expressions, 'expressions', COLORS.ochre);
    drawCompactMetric(ctx, 860, 1100, data.citations, 'citations', COLORS.rose);

    ctx.fillStyle = COLORS.line; ctx.fillRect(50, 1152, 978, 2);
    ctx.fillStyle = COLORS.ink; ctx.font = '500 21px "Playfair Display", Georgia, serif'; drawLines(ctx, data.summary, 50, 1191, 978, 27, 2);
    const highlight = data.includePersonalNotes && data.notes[0]
      ? `« ${truncate(data.notes[0], 110)} »`
      : data.discoveries[0] ? `${truncate(data.discoveries[0].text, 34)} · ${truncate(data.discoveries[0].definition, 88)}` : '';
    if (highlight) { ctx.fillStyle = COLORS.muted; ctx.font = 'italic 16px "Playfair Display", Georgia, serif'; drawLines(ctx, highlight, 50, 1253, 960, 21, 2); }

    if (brand) ctx.drawImage(brand, 50, 1300, 90, 27);
    else { ctx.fillStyle = COLORS.ink; ctx.font = '700 16px Poppins, Arial, sans-serif'; ctx.fillText('BOO-P', 50, 1323); }
    ctx.fillStyle = COLORS.muted; ctx.font = '500 14px Poppins, Arial, sans-serif'; ctx.fillText('Lire · garder une trace · avancer', 150, 1323);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.sageDark; ctx.font = '600 13px Poppins, Arial, sans-serif'; ctx.fillText('Quel chemin vos lectures dessinent-elles ?', 1028, 1323); ctx.textAlign = 'left';
    return canvas;
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Le rapport n’a pas pu être exporté.')), 'image/png'));
  }

  function filename(data) { return `boo-p-rapport-${data.monthKey}.png`; }

  async function download(canvas, data) {
    const blob = await canvasBlob(canvas), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename(data); document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share(canvas, data) {
    const blob = await canvasBlob(canvas), file = new File([blob], filename(data), { type:'image/png' });
    if (!navigator.share || !navigator.canShare?.({ files:[file] })) return false;
    await navigator.share({ title:`Mon mois de lecture · ${data.label}`, text:`${data.summary} Mon sentier de lecture avec BOO-P.`, files:[file] });
    return true;
  }

  window.BT = window.BT || {};
  window.BT.monthlyReport = { buildData, coverProxyUrl, download, filename, monthLabel, normalizeMonthKey, render, share, size:{ width:WIDTH, height:HEIGHT } };
})();

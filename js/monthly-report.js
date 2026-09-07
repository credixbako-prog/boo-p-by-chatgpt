/** BOO-P — rapport mensuel local, exporté en image sociale 4:5. */
(() => {
  'use strict';

  const WIDTH = 1080;
  const HEIGHT = 1350;
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

  function buildData(state, monthKey, includePersonalNotes = false) {
    const key = normalizeMonthKey(monthKey);
    const books = (state.books || [])
      .filter(book => book.libraryState === 'library' && book.status === 'lu' && book.completedAt && inMonth(book.completedAt, key))
      .sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
    const sessions = (state.sessions || []).filter(session => inMonth(session.startedAt, key));
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
    return {
      monthKey:key, label:monthLabel(key), profileName, handle, includePersonalNotes,
      books:books.map(book => ({
        title:cleanText(book.title), authors:(book.authors || []).map(cleanText).filter(Boolean), rating:Number(book.rating) || 0,
        coverUrl:cleanText(book.coverUrl), coverColor:cleanText(book.coverColor)
      })),
      minutes, sessions:sessions.length, words:words.length, expressions:expressions.length, citations:citations.length,
      discoveries:entries.slice(0, 4).map(entry => ({ kind:entry.kind || 'word', text:cleanText(entry.word), definition:cleanText(entry.definition) })),
      notes,
      summary:books.length
        ? `${books.length} livre${books.length > 1 ? 's' : ''} terminé${books.length > 1 ? 's' : ''}, ${minutes} minutes de lecture et ${entries.length} découverte${entries.length > 1 ? 's' : ''} à garder.`
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

  function loadImageCandidate(url, timeoutMs) {
    return new Promise(resolve => {
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), timeoutMs);
      image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
      image.onload = () => { window.clearTimeout(timer); resolve(image); };
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

  function drawCoverCard(ctx, book, image, index, x, y, width, angle = 0) {
    const coverHeight = width * 1.5, captionHeight = Math.max(48, width * .27), cardHeight = coverHeight + captionHeight;
    ctx.save(); ctx.translate(x + width / 2, y + cardHeight / 2); ctx.rotate(angle); ctx.translate(-width / 2, -cardHeight / 2);
    ctx.shadowColor = 'rgba(23,50,77,.24)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 14;
    roundedRect(ctx, 0, 0, width, cardHeight, 10); ctx.fillStyle = COLORS.white; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.save(); roundedRect(ctx, 0, 0, width, coverHeight, 9); ctx.clip(); ctx.fillStyle = COLORS.paperSoft; ctx.fillRect(0, 0, width, coverHeight);
    if (image) drawContainedImage(ctx, image, 0, 0, width, coverHeight);
    else drawFallbackCover(ctx, book, index, 0, 0, width, coverHeight);
    ctx.restore();
    ctx.fillStyle = COLORS.ink; ctx.font = `600 ${Math.max(13, width * .075)}px Poppins, Arial, sans-serif`;
    ctx.textAlign = 'center'; drawLines(ctx, truncate(book.title || 'Lecture BOO-P', 34), width / 2, coverHeight + 22, width - 20, Math.max(15, width * .085), 2); ctx.textAlign = 'left';
    ctx.restore();
    return cardHeight;
  }

  async function drawBookGallery(ctx, books, x, y, width, height) {
    const shown = books.slice(0, 5);
    if (!shown.length) {
      ctx.save();
      roundedRect(ctx, x, y, width, height, 34); ctx.fillStyle = COLORS.paperSoft; ctx.fill();
      const shades = [COLORS.sage, COLORS.ochre, COLORS.ink, COLORS.rose];
      shades.forEach((color, index) => {
        const bookWidth = 82 + index * 4, bookHeight = 220 + index * 22, left = x + width / 2 - 190 + index * 92;
        roundedRect(ctx, left, y + height - bookHeight - 48, bookWidth, bookHeight, 7); ctx.fillStyle = color; ctx.fill();
      });
      ctx.fillStyle = COLORS.ink; ctx.font = '600 31px "Playfair Display", Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText('Le prochain chapitre reste à écrire.', x + width / 2, y + height - 12); ctx.textAlign = 'left'; ctx.restore();
      return;
    }

    const images = await Promise.all(shown.map(book => loadCoverImage(book.coverUrl)));
    const cardWidth = shown.length === 1 ? 242 : shown.length === 2 ? 220 : shown.length === 3 ? 194 : shown.length === 4 ? 178 : 164;
    const gap = shown.length <= 2 ? 44 : 18;
    const totalWidth = cardWidth * shown.length + gap * (shown.length - 1);
    const startX = x + (width - totalWidth) / 2;
    const angles = [-0.035, 0.025, -0.018, 0.03, -0.022];
    shown.forEach((book, index) => drawCoverCard(ctx, book, images[index], index, startX + index * (cardWidth + gap), y + (index % 2 ? 8 : 0), cardWidth, shown.length === 1 ? 0 : angles[index]));
    ctx.fillStyle = COLORS.sageDark; ctx.fillRect(x + 20, y + height - 16, width - 40, 5);
    ctx.fillStyle = 'rgba(69,106,89,.16)'; ctx.fillRect(x + 42, y + height - 11, width - 84, 6);
    if (books.length > shown.length) {
      roundedRect(ctx, x + width - 160, y - 12, 145, 50, 25); ctx.fillStyle = COLORS.ochre; ctx.fill();
      ctx.fillStyle = COLORS.white; ctx.font = '700 17px Poppins, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`+ ${books.length - shown.length} livre${books.length - shown.length > 1 ? 's' : ''}`, x + width - 87, y + 20); ctx.textAlign = 'left';
    }
  }

  function drawMetricCard(ctx, x, y, width, height, value, label, accent) {
    roundedRect(ctx, x, y, width, height, 18); ctx.fillStyle = COLORS.white; ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(x, y + 16, 5, height - 32);
    ctx.fillStyle = COLORS.ink; ctx.font = '700 30px "Playfair Display", Georgia, serif'; ctx.fillText(String(value), x + 24, y + 43);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 12px Poppins, Arial, sans-serif'; ctx.fillText(label.toUpperCase(), x + 24, y + 69);
  }

  function drawBackground(ctx) {
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const wash = ctx.createRadialGradient(920, 120, 30, 920, 120, 440);
    wash.addColorStop(0, 'rgba(207,135,61,.2)'); wash.addColorStop(1, 'rgba(207,135,61,0)'); ctx.fillStyle = wash; ctx.fillRect(480, 0, 600, 620);
    ctx.fillStyle = 'rgba(111,146,124,.13)'; ctx.beginPath(); ctx.arc(45, 510, 220, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(23,50,77,.055)'; ctx.lineWidth = 2;
    for (let y = 30; y < HEIGHT; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y + 12); ctx.stroke(); }
  }

  async function render(data) {
    await document.fonts?.ready?.catch?.(() => {});
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha:false }); drawBackground(ctx);

    roundedRect(ctx, 58, 48, 142, 48, 24); ctx.fillStyle = COLORS.ink; ctx.fill();
    ctx.fillStyle = COLORS.white; ctx.font = '700 20px Poppins, Arial, sans-serif'; ctx.fillText('BOO-P', 92, 80);
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 15px Poppins, Arial, sans-serif'; ctx.fillText('MON SENTIER · RAPPORT MENSUEL', 58, 142);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 58px "Playfair Display", Georgia, serif'; ctx.fillText(data.label, 58, 207);
    ctx.fillStyle = COLORS.muted; ctx.font = '500 18px Poppins, Arial, sans-serif'; ctx.fillText(truncate(data.handle || data.profileName, 36), 60, 243);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.ochre; ctx.font = '700 92px "Playfair Display", Georgia, serif'; ctx.fillText(String(data.books.length), 1015, 194);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 15px Poppins, Arial, sans-serif'; ctx.fillText(`LIVRE${data.books.length > 1 ? 'S' : ''} TERMINÉ${data.books.length > 1 ? 'S' : ''}`, 1015, 225); ctx.textAlign = 'left';

    await drawBookGallery(ctx, data.books, 58, 294, 964, 454);

    roundedRect(ctx, 58, 786, 286, 224, 28); ctx.fillStyle = COLORS.ink; ctx.fill();
    const duration = data.minutes >= 60 ? `${Math.floor(data.minutes / 60)} h ${String(data.minutes % 60).padStart(2, '0')}` : `${data.minutes} min`;
    ctx.fillStyle = COLORS.white; ctx.font = '700 45px "Playfair Display", Georgia, serif'; drawLines(ctx, duration, 84, 850, 230, 50, 2);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '600 13px Poppins, Arial, sans-serif'; ctx.fillText('TEMPS DE LECTURE', 84, 895);
    ctx.fillStyle = COLORS.sage; ctx.font = '500 16px Poppins, Arial, sans-serif'; ctx.fillText(`${data.sessions} session${data.sessions > 1 ? 's' : ''}`, 84, 948);

    drawMetricCard(ctx, 370, 786, 308, 103, data.words, 'mots appris', COLORS.sageDark);
    drawMetricCard(ctx, 704, 786, 318, 103, data.expressions, 'expressions', COLORS.ochre);
    drawMetricCard(ctx, 370, 907, 308, 103, data.citations, 'citations', COLORS.rose);
    drawMetricCard(ctx, 704, 907, 318, 103, data.words + data.expressions + data.citations, 'découvertes', COLORS.ink);

    roundedRect(ctx, 58, 1048, 964, 190, 28); ctx.fillStyle = 'rgba(255,253,248,.86)'; ctx.fill();
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 13px Poppins, Arial, sans-serif'; ctx.fillText('CE QUE JE GARDE DE CE MOIS', 84, 1085);
    ctx.fillStyle = COLORS.ink; ctx.font = '500 23px "Playfair Display", Georgia, serif'; drawLines(ctx, data.summary, 84, 1123, 900, 30, 2);
    const highlight = data.includePersonalNotes && data.notes[0]
      ? `« ${truncate(data.notes[0], 110)} »`
      : data.discoveries[0] ? `${truncate(data.discoveries[0].text, 34)} · ${truncate(data.discoveries[0].definition, 88)}` : '';
    if (highlight) { ctx.fillStyle = COLORS.muted; ctx.font = 'italic 17px "Playfair Display", Georgia, serif'; drawLines(ctx, highlight, 84, 1186, 885, 23, 2); }

    ctx.fillStyle = COLORS.ochre; ctx.beginPath(); ctx.arc(74, 1290, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.ink; ctx.font = '700 17px Poppins, Arial, sans-serif'; ctx.fillText('BOO-P', 94, 1296);
    ctx.fillStyle = COLORS.muted; ctx.font = '500 15px Poppins, Arial, sans-serif'; ctx.fillText('Lire · garder une trace · avancer', 168, 1296);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.sageDark; ctx.font = '600 14px Poppins, Arial, sans-serif'; ctx.fillText('Quel chemin vos lectures dessinent-elles ?', 1018, 1296); ctx.textAlign = 'left';
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

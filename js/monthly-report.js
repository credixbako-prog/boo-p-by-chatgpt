/** BOO-P — rapport mensuel local, exporté en image 4:5. */
(() => {
  'use strict';

  const WIDTH = 1080;
  const HEIGHT = 1350;
  const COLORS = {
    paper:'#f5efe5', paperSoft:'#ebe2d4', ink:'#17324d', muted:'#68747d',
    sage:'#6f927c', sageDark:'#456a59', ochre:'#cf873d', white:'#fffdf8', line:'#d9cebf'
  };

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
      .filter(book => book.libraryState === 'library' && book.status === 'lu' && book.completedAt && !book.historicalBeforeJoin && inMonth(book.completedAt, key))
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
      books:books.map(book => ({ title:cleanText(book.title), authors:(book.authors || []).map(cleanText).filter(Boolean), rating:Number(book.rating) || 0, coverUrl:cleanText(book.coverUrl), coverColor:cleanText(book.coverColor) })),
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
    const fallback = [COLORS.sageDark, COLORS.ochre, COLORS.ink, '#8f3f42', '#466b87', '#708d75'];
    return [matches[0] || fallback[index % fallback.length], matches[1] || fallback[(index + 1) % fallback.length]];
  }

  function loadCoverImage(url) {
    if (!url || typeof Image === 'undefined') return Promise.resolve(null);
    return new Promise(resolve => {
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), 4500);
      image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
      image.onload = () => { window.clearTimeout(timer); resolve(image); };
      image.onerror = () => { window.clearTimeout(timer); resolve(null); };
      image.src = url;
    });
  }

  function collageLayout(count) {
    if (count <= 1) return [{ x:0, y:0, w:1, h:1 }];
    if (count === 2) return [{ x:0, y:0, w:.5, h:1 }, { x:.5, y:0, w:.5, h:1 }];
    if (count === 3) return [{ x:0, y:0, w:.58, h:1 }, { x:.58, y:0, w:.42, h:.5 }, { x:.58, y:.5, w:.42, h:.5 }];
    const columns = count > 4 ? 3 : 2, rows = Math.ceil(count / columns);
    return Array.from({ length:count }, (_, index) => ({ x:(index % columns) / columns, y:Math.floor(index / columns) / rows, w:1 / columns, h:1 / rows }));
  }

  function drawCroppedImage(ctx, image, x, y, width, height) {
    const sourceRatio = image.naturalWidth / image.naturalHeight, targetRatio = width / height;
    let sourceX = 0, sourceY = 0, sourceWidth = image.naturalWidth, sourceHeight = image.naturalHeight;
    if (sourceRatio > targetRatio) { sourceWidth = image.naturalHeight * targetRatio; sourceX = (image.naturalWidth - sourceWidth) / 2; }
    else { sourceHeight = image.naturalWidth / targetRatio; sourceY = (image.naturalHeight - sourceHeight) / 2; }
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function drawCoverTile(ctx, book, image, index, x, y, width, height) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
    if (image) drawCroppedImage(ctx, image, x, y, width, height);
    else {
      const [start, end] = coverPalette(book, index), gradient = ctx.createLinearGradient(x, y, x + width, y + height);
      gradient.addColorStop(0, start); gradient.addColorStop(1, end); ctx.fillStyle = gradient; ctx.fillRect(x, y, width, height);
      ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + Math.max(12, width * .07), y, 3, height);
      ctx.fillStyle = COLORS.white; ctx.font = `600 ${Math.max(24, Math.min(44, width * .09))}px "Playfair Display", Georgia, serif`;
      drawLines(ctx, book.title || 'Lecture BOO-P', x + width * .12, y + height * .48, width * .76, Math.max(32, width * .1), 4);
    }
    const shade = ctx.createLinearGradient(0, y + height * .62, 0, y + height);
    shade.addColorStop(0, 'rgba(7,14,24,0)'); shade.addColorStop(1, 'rgba(7,14,24,.72)'); ctx.fillStyle = shade; ctx.fillRect(x, y, width, height);
    ctx.fillStyle = COLORS.white; ctx.font = '600 18px Poppins, Arial, sans-serif';
    ctx.fillText(truncate(book.title, Math.max(18, Math.round(width / 10))), x + 20, y + height - 24);
    ctx.restore();
  }

  async function drawCoverCollage(ctx, books, x, y, width, height) {
    const shown = books.slice(0, 6);
    if (!shown.length) {
      const gradient = ctx.createLinearGradient(x, y, x + width, y + height); gradient.addColorStop(0, COLORS.ink); gradient.addColorStop(1, COLORS.sageDark);
      ctx.fillStyle = gradient; ctx.fillRect(x, y, width, height);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.font = '600 68px "Playfair Display", Georgia, serif'; drawLines(ctx, 'Le sentier continue, page après page.', 80, 430, 800, 82, 3);
      return;
    }
    const images = await Promise.all(shown.map(book => loadCoverImage(book.coverUrl)));
    const layout = collageLayout(shown.length), gutter = 7;
    shown.forEach((book, index) => {
      const cell = layout[index], left = x + cell.x * width + gutter / 2, top = y + cell.y * height + gutter / 2;
      drawCoverTile(ctx, book, images[index], index, left, top, cell.w * width - gutter, cell.h * height - gutter);
    });
  }

  function drawMetric(ctx, x, y, value, label, accent) {
    ctx.fillStyle = accent; ctx.font = '700 31px "Playfair Display", Georgia, serif'; ctx.fillText(String(value), x, y);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 13px Poppins, Arial, sans-serif'; ctx.fillText(label.toUpperCase(), x, y + 25);
  }

  async function render(data) {
    await document.fonts?.ready?.catch?.(() => {});
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha:false });
    ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    await drawCoverCollage(ctx, data.books, 0, 0, WIDTH, 1000);

    const coverShade = ctx.createLinearGradient(0, 610, 0, 1000);
    coverShade.addColorStop(0, 'rgba(7,14,24,0)'); coverShade.addColorStop(1, 'rgba(7,14,24,.88)'); ctx.fillStyle = coverShade; ctx.fillRect(0, 600, WIDTH, 400);
    roundedRect(ctx, 54, 48, 132, 46, 23); ctx.fillStyle = 'rgba(255,253,248,.9)'; ctx.fill();
    ctx.fillStyle = COLORS.ink; ctx.font = '700 20px Poppins, Arial, sans-serif'; ctx.fillText('BOO-P', 83, 79);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '600 18px Poppins, Arial, sans-serif'; ctx.fillText('MON MOIS DE LECTURE', 58, 815);
    ctx.fillStyle = COLORS.white; ctx.font = '600 68px "Playfair Display", Georgia, serif'; drawLines(ctx, data.label, 58, 890, 880, 75, 2);
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.font = '500 19px Poppins, Arial, sans-serif';
    ctx.fillText(`${data.books.length} livre${data.books.length > 1 ? 's' : ''} terminé${data.books.length > 1 ? 's' : ''}${data.books.length > 6 ? ` · +${data.books.length - 6} hors cadre` : ''}`, 60, 965);

    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 1000, WIDTH, 350);
    ctx.fillStyle = COLORS.sageDark; ctx.fillRect(0, 1000, WIDTH, 10);
    const duration = data.minutes >= 60 ? `${Math.floor(data.minutes / 60)} h ${String(data.minutes % 60).padStart(2, '0')}` : `${data.minutes} min`;
    drawMetric(ctx, 60, 1070, duration, 'lecture', COLORS.ochre);
    drawMetric(ctx, 310, 1070, data.words, 'mots appris', COLORS.sageDark);
    drawMetric(ctx, 560, 1070, data.expressions, 'expressions', COLORS.ochre);
    drawMetric(ctx, 810, 1070, data.citations, 'citations', COLORS.sageDark);

    ctx.fillStyle = COLORS.line; ctx.fillRect(60, 1124, 960, 2);
    ctx.fillStyle = COLORS.ink; ctx.font = '500 21px "Playfair Display", Georgia, serif'; drawLines(ctx, data.summary, 60, 1172, 960, 28, 2);
    const highlight = data.includePersonalNotes && data.notes[0]
      ? `« ${truncate(data.notes[0], 92)} »`
      : data.discoveries[0] ? `${truncate(data.discoveries[0].text, 32)} · ${truncate(data.discoveries[0].definition, 78)}` : '';
    if (highlight) { ctx.fillStyle = COLORS.muted; ctx.font = 'italic 16px "Playfair Display", Georgia, serif'; drawLines(ctx, highlight, 60, 1245, 830, 23, 2); }
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 15px Poppins, Arial, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(truncate(data.handle || data.profileName, 28), 1020, 1288); ctx.fillText('boo-p · mon sentier de lecture', 1020, 1318); ctx.textAlign = 'left';
    return canvas;
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Le rapport n’a pas pu être exporté.')), 'image/png'));
  }

  function filename(data) { return `boo-p-rapport-${data.monthKey}.png`; }

  async function download(canvas, data) {
    const blob = await canvasBlob(canvas), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename(data); document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share(canvas, data) {
    const blob = await canvasBlob(canvas), file = new File([blob], filename(data), { type:'image/png' });
    if (!navigator.share || !navigator.canShare?.({ files:[file] })) return false;
    await navigator.share({ title:`Mon mois de lecture · ${data.label}`, text:data.summary, files:[file] });
    return true;
  }

  window.BT = window.BT || {};
  window.BT.monthlyReport = { buildData, download, filename, monthLabel, normalizeMonthKey, render, share, size:{ width:WIDTH, height:HEIGHT } };
})();

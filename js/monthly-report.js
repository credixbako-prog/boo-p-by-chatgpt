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
      books:books.map(book => ({ title:cleanText(book.title), authors:(book.authors || []).map(cleanText).filter(Boolean), rating:Number(book.rating) || 0 })),
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

  function drawStat(ctx, x, y, width, value, label, accent) {
    roundedRect(ctx, x, y, width, 148, 28); ctx.fillStyle = COLORS.white; ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(x, y, 8, 148);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 52px "Playfair Display", Georgia, serif'; ctx.fillText(String(value), x + 34, y + 67);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 20px Poppins, Arial, sans-serif'; ctx.fillText(label.toUpperCase(), x + 34, y + 111);
  }

  async function render(data) {
    await document.fonts?.ready?.catch?.(() => {});
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d', { alpha:false });
    ctx.fillStyle = COLORS.paper; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = COLORS.sageDark; ctx.fillRect(0, 0, 24, HEIGHT);
    ctx.fillStyle = COLORS.ochre; ctx.fillRect(24, 0, 8, HEIGHT);

    ctx.fillStyle = COLORS.sageDark; ctx.font = '700 24px Poppins, Arial, sans-serif'; ctx.letterSpacing = '5px'; ctx.fillText('BOO-P', 80, 92);
    ctx.fillStyle = COLORS.muted; ctx.font = '600 18px Poppins, Arial, sans-serif'; ctx.fillText('MON MOIS DE LECTURE', 80, 132);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 70px "Playfair Display", Georgia, serif'; ctx.fillText(data.label, 80, 224);
    ctx.fillStyle = COLORS.line; ctx.fillRect(80, 260, 920, 2);

    const gap = 18, statWidth = (920 - gap) / 2;
    drawStat(ctx, 80, 304, statWidth, data.books.length, `livre${data.books.length > 1 ? 's' : ''} lu${data.books.length > 1 ? 's' : ''}`, COLORS.sage);
    const duration = data.minutes >= 60 ? `${Math.floor(data.minutes / 60)} h ${String(data.minutes % 60).padStart(2, '0')}` : `${data.minutes} min`;
    drawStat(ctx, 80 + statWidth + gap, 304, statWidth, duration, 'temps de lecture', COLORS.ochre);
    drawStat(ctx, 80, 470, statWidth, data.words, `mot${data.words > 1 ? 's' : ''} appris`, COLORS.ochre);
    drawStat(ctx, 80 + statWidth + gap, 470, statWidth, data.expressions + data.citations, 'expressions & citations', COLORS.sage);

    let y = 676;
    ctx.fillStyle = COLORS.ink; ctx.font = '600 32px "Playfair Display", Georgia, serif'; ctx.fillText('Les livres du mois', 80, y);
    y += 28;
    const shownBooks = data.books.slice(0, 3);
    if (!shownBooks.length) {
      ctx.fillStyle = COLORS.muted; ctx.font = '400 22px Poppins, Arial, sans-serif'; ctx.fillText('Le sentier continue, page après page.', 80, y + 38); y += 86;
    } else {
      shownBooks.forEach((book, index) => {
        const top = y + index * 80;
        roundedRect(ctx, 80, top, 920, 62, 18); ctx.fillStyle = index % 2 ? COLORS.paperSoft : COLORS.white; ctx.fill();
        ctx.fillStyle = index % 2 ? COLORS.ochre : COLORS.sage; roundedRect(ctx, 98, top + 13, 36, 36, 10); ctx.fill();
        ctx.fillStyle = COLORS.white; ctx.font = '700 18px Poppins, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(index + 1), 116, top + 38); ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.ink; ctx.font = '600 23px "Playfair Display", Georgia, serif'; ctx.fillText(truncate(book.title, 48), 154, top + 28);
        ctx.fillStyle = COLORS.muted; ctx.font = '400 16px Poppins, Arial, sans-serif'; ctx.fillText(truncate(book.authors.join(', ') || 'Auteur non renseigné', 62), 154, top + 51);
      });
      y += shownBooks.length * 80 + 22;
    }

    const discovery = data.discoveries[0];
    if (discovery && y < 1035) {
      ctx.fillStyle = COLORS.ink; ctx.font = '600 30px "Playfair Display", Georgia, serif'; ctx.fillText('Une trace à retenir', 80, y); y += 28;
      roundedRect(ctx, 80, y, 920, 142, 24); ctx.fillStyle = COLORS.sageDark; ctx.fill();
      ctx.fillStyle = COLORS.white; ctx.font = '600 28px "Playfair Display", Georgia, serif'; ctx.fillText(`“ ${truncate(discovery.text, 52)} ”`, 112, y + 45);
      ctx.fillStyle = '#e8f0e9'; ctx.font = '400 18px Poppins, Arial, sans-serif'; drawLines(ctx, discovery.definition || 'Une découverte ajoutée au lexique.', 112, y + 82, 850, 27, 2);
      y += 168;
    }

    if (data.includePersonalNotes && data.notes[0] && y < 1165) {
      ctx.fillStyle = COLORS.ink; ctx.font = '600 27px "Playfair Display", Georgia, serif'; ctx.fillText('Note personnelle', 80, y); y += 34;
      ctx.fillStyle = COLORS.muted; ctx.font = 'italic 18px "Playfair Display", Georgia, serif'; y = drawLines(ctx, `« ${data.notes[0]} »`, 80, y, 920, 27, 3) + 14;
    }

    ctx.fillStyle = COLORS.line; ctx.fillRect(80, 1193, 920, 2);
    ctx.fillStyle = COLORS.ink; ctx.font = '500 21px "Playfair Display", Georgia, serif'; drawLines(ctx, data.summary, 80, 1240, 720, 29, 2);
    ctx.fillStyle = COLORS.sageDark; ctx.font = '600 17px Poppins, Arial, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(truncate(data.handle || data.profileName, 28), 1000, 1280); ctx.fillText('boo-p · mon sentier de lecture', 1000, 1310); ctx.textAlign = 'left';
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

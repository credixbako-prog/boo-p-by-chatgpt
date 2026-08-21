/** BOO-P — reconnaissance locale d'une couverture et recherche de métadonnées publiques. */
(() => {
  'use strict';

  const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
  const OPEN_LIBRARY_ENDPOINT = 'https://openlibrary.org/api/books';
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
  const COVER_MAX_EDGE = 1200;
  const COVER_TARGET_BYTES = 360 * 1024;
  const FETCH_TIMEOUT_MS = 12000;
  const metadataCache = new Map();
  let tesseractPromise = null;

  function normalizeISBN(value) {
    return String(value || '').toUpperCase().replace(/[^0-9X]/g, '');
  }

  function isValidISBN10(value) {
    const isbn = normalizeISBN(value);
    if (!/^\d{9}[\dX]$/.test(isbn)) return false;
    const sum = [...isbn].reduce((total, character, index) => {
      const digit = character === 'X' ? 10 : Number(character);
      return total + digit * (10 - index);
    }, 0);
    return sum % 11 === 0;
  }

  function isValidISBN13(value) {
    const isbn = normalizeISBN(value);
    if (!/^\d{13}$/.test(isbn)) return false;
    const sum = [...isbn.slice(0, 12)].reduce((total, character, index) => total + Number(character) * (index % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(isbn[12]);
  }

  function isValidISBN(value) {
    const isbn = normalizeISBN(value);
    return isbn.length === 10 ? isValidISBN10(isbn) : isValidISBN13(isbn);
  }

  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Catalogue indisponible (${response.status})`);
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Le catalogue met trop de temps à répondre. Réessayez.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function secureCoverUrl(value) {
    return String(value || '').replace(/^http:/, 'https:').replace('&edge=curl', '');
  }

  function mapGoogleVolume(item) {
    const info = item?.volumeInfo || {};
    const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const isbn13 = identifiers.find(identifier => identifier.type === 'ISBN_13')?.identifier;
    const isbn10 = identifiers.find(identifier => identifier.type === 'ISBN_10')?.identifier;
    return {
      source: 'Google Books', sourceId: item?.id || '',
      isbn: normalizeISBN(isbn13 || isbn10 || ''),
      title: String(info.title || '').trim(),
      authors: Array.isArray(info.authors) ? info.authors.filter(Boolean) : [],
      publisher: String(info.publisher || '').trim(),
      publishedDate: String(info.publishedDate || '').trim(),
      edition: '', format: info.printType === 'MAGAZINE' ? 'Magazine' : 'Livre',
      totalPages: Math.max(0, Number(info.pageCount) || 0),
      description: String(info.description || '').trim(),
      coverUrl: secureCoverUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '')
    };
  }

  function mapOpenLibraryBook(item, isbn) {
    const authors = Array.isArray(item?.authors) ? item.authors.map(author => author?.name).filter(Boolean) : [];
    const publishers = Array.isArray(item?.publishers) ? item.publishers.map(publisher => publisher?.name).filter(Boolean) : [];
    const coverUrl = item?.cover?.large || item?.cover?.medium || item?.cover?.small || '';
    return {
      source: 'Open Library', sourceId: item?.key || '', isbn: normalizeISBN(isbn),
      workKey: item?.works?.[0]?.key || '',
      title: String(item?.title || '').trim(), authors,
      publisher: publishers[0] || '', publishedDate: String(item?.publish_date || '').trim(),
      edition: '', format: 'Livre', totalPages: Math.max(0, Number(item?.number_of_pages) || 0),
      description: '', coverUrl: secureCoverUrl(coverUrl)
    };
  }

  function deduplicate(items) {
    const seen = new Set();
    return items.filter(item => {
      if (!item?.title) return false;
      const key = `${normalizeISBN(item.isbn)}|${item.title.toLowerCase()}|${(item.authors || []).join(',').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  }

  async function searchGoogle(query, { isbn = false } = {}) {
    const q = isbn ? `isbn:${normalizeISBN(query)}` : String(query || '').trim();
    if (!q) return [];
    const url = `${GOOGLE_BOOKS_ENDPOINT}?q=${encodeURIComponent(q)}&maxResults=6&printType=books&projection=full`;
    const payload = await fetchJSON(url);
    return deduplicate((payload?.items || []).map(mapGoogleVolume));
  }

  async function searchOpenLibraryISBN(isbn) {
    const normalized = normalizeISBN(isbn);
    const key = `ISBN:${normalized}`;
    const url = `${OPEN_LIBRARY_ENDPOINT}?bibkeys=${encodeURIComponent(key)}&format=json&jscmd=data`;
    const payload = await fetchJSON(url);
    return payload?.[key] ? [mapOpenLibraryBook(payload[key], normalized)] : [];
  }

  function openLibraryDescription(value) {
    const text = typeof value === 'string' ? value : String(value?.value || '');
    return text.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  }

  async function enrichOpenLibrary(item) {
    let workKey = item.workKey || '';
    let coverUrl = item.coverUrl || '';
    try {
      if (!workKey && /^\/books\//.test(item.sourceId || '')) {
        const edition = await fetchJSON(`https://openlibrary.org${item.sourceId}.json`);
        workKey = edition?.works?.[0]?.key || '';
        const editionCover = edition?.covers?.find(value => Number(value) > 0);
        if (!coverUrl && editionCover) coverUrl = `https://covers.openlibrary.org/b/id/${editionCover}-L.jpg`;
      }
      if (!workKey) return { ...item, coverUrl };
      const work = await fetchJSON(`https://openlibrary.org${workKey}.json`);
      const workCover = work?.covers?.find(value => Number(value) > 0);
      return {
        ...item,
        workKey,
        description: openLibraryDescription(work?.description) || item.description,
        coverUrl: coverUrl || (workCover ? `https://covers.openlibrary.org/b/id/${workCover}-L.jpg` : '')
      };
    } catch { return { ...item, workKey, coverUrl }; }
  }

  async function lookupISBN(value) {
    const isbn = normalizeISBN(value);
    if (!isValidISBN(isbn)) throw new Error('Saisissez un ISBN-10 ou ISBN-13 valide.');
    if (metadataCache.has(isbn)) return metadataCache.get(isbn);
    const request = (async () => {
      const [googleResult, openLibraryResult] = await Promise.allSettled([
        searchGoogle(isbn, { isbn: true }),
        searchOpenLibraryISBN(isbn).then(items => Promise.all(items.map(enrichOpenLibrary)))
      ]);
      let google = googleResult.status === 'fulfilled' ? googleResult.value : [];
      const openLibrary = openLibraryResult.status === 'fulfilled' ? openLibraryResult.value : [];
      if (openLibrary.length && google.length) {
        const fallback = openLibrary[0];
        google = google.map(item => ({
          ...item,
          isbn: item.isbn || fallback.isbn,
          authors: item.authors.length ? item.authors : fallback.authors,
          publisher: item.publisher || fallback.publisher,
          publishedDate: item.publishedDate || fallback.publishedDate,
          totalPages: item.totalPages || fallback.totalPages,
          description: item.description || fallback.description,
          coverUrl: item.coverUrl || fallback.coverUrl
        }));
        return enrichDescriptions(google);
      }
      if (openLibrary.length) return enrichDescriptions(openLibrary);
      if (google.length) return enrichDescriptions(google);
      const failure = googleResult.status === 'rejected' ? googleResult.reason : openLibraryResult.status === 'rejected' ? openLibraryResult.reason : null;
      if (failure) throw failure;
      return [];
    })();
    metadataCache.set(isbn, request);
    try { return await request; }
    catch (error) { metadataCache.delete(isbn); throw error; }
  }

  async function enrichDescriptions(items) {
    return await Promise.all(items.map(async item => {
      if (item.description || !item.title) return item;
      const author = item.authors?.[0] || '';
      try {
        const fallbacks = await searchGoogle(`intitle:${item.title}${author ? ` inauthor:${author}` : ''}`);
        const closest = fallbacks.find(candidate => normalizeISBN(candidate.isbn) === normalizeISBN(item.isbn)) || fallbacks[0];
        return closest ? {
          ...item,
          description: closest.description || item.description,
          publisher: item.publisher || closest.publisher,
          totalPages: item.totalPages || closest.totalPages,
          coverUrl: item.coverUrl || closest.coverUrl
        } : item;
      } catch { return item; }
    }));
  }

  async function searchBooks(query) {
    const clean = String(query || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const isbn = normalizeISBN(clean);
    if ((isbn.length === 10 || isbn.length === 13) && isValidISBN(isbn)) return lookupISBN(isbn);
    return searchGoogle(clean);
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Ce format d’image ne peut pas être lu sur cet appareil. Essayez une photo JPG, PNG ou WebP.'));
      image.src = source;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('La compression de l’image a échoué.')), type, quality));
  }

  function blobDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('La lecture de l’image a échoué.'));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareCover(file, onProgress = () => {}) {
    if (!file) throw new Error('Choisissez une image de couverture.');
    const imageExtension = /\.(?:jpe?g|png|webp|gif|heic|heif)$/i.test(String(file.name || ''));
    if (!String(file.type || '').startsWith('image/') && !imageExtension) throw new Error('Choisissez un fichier image.');
    onProgress({ stage: 'compression', progress: 0.1, message: 'Préparation de la photo…' });
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) throw new Error('L’image choisie est vide ou illisible.');
      const scale = Math.min(1, COVER_MAX_EDGE / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.84;
      let blob = await canvasBlob(canvas, 'image/jpeg', quality);
      while (blob.size > COVER_TARGET_BYTES && quality > 0.48) {
        quality -= 0.08;
        blob = await canvasBlob(canvas, 'image/jpeg', quality);
      }
      onProgress({ stage: 'compression', progress: 1, message: 'Photo prête.' });
      return { blob, dataUrl: await blobDataUrl(blob), width: canvas.width, height: canvas.height, originalBytes: file.size, compressedBytes: blob.size };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function detectBarcode(imageBlob) {
    if (!('BarcodeDetector' in window) || typeof createImageBitmap !== 'function') return '';
    try {
      const desired = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
      const supported = typeof BarcodeDetector.getSupportedFormats === 'function'
        ? await BarcodeDetector.getSupportedFormats()
        : desired;
      const formats = desired.filter(format => supported.includes(format));
      if (!formats.length) return '';
      const detector = new BarcodeDetector({ formats });
      const bitmap = await createImageBitmap(imageBlob);
      try {
        const codes = await detector.detect(bitmap);
        return normalizeISBN(codes.map(code => code.rawValue).find(isValidISBN) || '');
      } finally { bitmap.close?.(); }
    } catch { return ''; }
  }

  function loadTesseract() {
    if (window.Tesseract?.recognize) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.crossOrigin = 'anonymous';
      script.onload = () => window.Tesseract?.recognize ? resolve(window.Tesseract) : reject(new Error('Le lecteur de texte ne s’est pas initialisé.'));
      script.onerror = () => reject(new Error('Le lecteur de texte n’a pas pu être chargé. Vérifiez votre connexion.'));
      document.head.appendChild(script);
    });
    return tesseractPromise;
  }

  function findISBNInText(text) {
    const candidates = String(text || '').match(/(?:97[89][\s-]*)?(?:\d[\s-]*){9}[\dX]/gi) || [];
    return candidates.map(normalizeISBN).find(isValidISBN) || '';
  }

  function queryFromOCR(text) {
    const lines = String(text || '').split(/\r?\n/)
      .map(line => line.replace(/[^\p{L}\p{N}'’:&., -]/gu, ' ').replace(/\s+/g, ' ').trim())
      .filter(line => line.length >= 3 && line.length <= 80)
      .filter(line => (line.match(/[\p{L}]/gu) || []).length >= 3)
      .filter(line => !/^(isbn|édition|editions|roman|poche|collection)$/i.test(line));
    return [...new Set(lines)].slice(0, 4).join(' ').slice(0, 220);
  }

  function ocrQueries(text) {
    const lines = String(text || '').split(/\r?\n/)
      .map(line => line.replace(/[^\p{L}\p{N}'’:&., -]/gu, ' ').replace(/\s+/g, ' ').trim())
      .filter(line => line.length >= 3 && line.length <= 80)
      .filter(line => (line.match(/[\p{L}]/gu) || []).length >= 3)
      .filter(line => !/^(isbn|édition|editions|roman|poche|collection)$/i.test(line));
    const options = [
      lines[0] ? `intitle:${lines[0]}${lines[1] ? ` inauthor:${lines[1]}` : ''}` : '',
      lines.slice(0, 2).join(' '),
      queryFromOCR(text)
    ];
    return [...new Set(options.map(item => item.trim()).filter(Boolean))];
  }

  async function analyzeCover(imageBlob, onProgress = () => {}) {
    if (!imageBlob) throw new Error('Importez d’abord une photo de la couverture.');
    onProgress({ stage: 'barcode', progress: 0.08, message: 'Recherche d’un code-barres…' });
    const barcodeISBN = await detectBarcode(imageBlob);
    if (barcodeISBN) {
      onProgress({ stage: 'catalogue', progress: 0.35, message: `ISBN ${barcodeISBN} détecté. Recherche de l’édition…` });
      const results = await lookupISBN(barcodeISBN);
      if (results.length) return { method: 'barcode', isbn: barcodeISBN, text: '', query: barcodeISBN, results };
    }

    onProgress({ stage: 'ocr', progress: 0.12, message: 'Lecture du titre et de l’auteur sur la couverture…' });
    const tesseract = await loadTesseract();
    const recognition = await tesseract.recognize(imageBlob, 'fra+eng', {
      logger: message => {
        if (message.status !== 'recognizing text') return;
        onProgress({ stage: 'ocr', progress: Number(message.progress) || 0, message: `Lecture de la couverture… ${Math.round((Number(message.progress) || 0) * 100)} %` });
      }
    });
    const text = String(recognition?.data?.text || '').trim();
    const ocrISBN = findISBNInText(text);
    if (ocrISBN) {
      onProgress({ stage: 'catalogue', progress: 0.8, message: `ISBN ${ocrISBN} lu sur l’image. Recherche de l’édition…` });
      const results = await lookupISBN(ocrISBN);
      if (results.length) return { method: 'ocr-isbn', isbn: ocrISBN, text, query: ocrISBN, results };
    }
    const queries = ocrQueries(text), query = queries[0] || '';
    if (!query) throw new Error('Aucun titre exploitable n’a été lu. Essayez une photo plus nette ou utilisez l’ISBN/la saisie manuelle.');
    let results = [];
    for (const candidate of queries) {
      onProgress({ stage: 'catalogue', progress: 0.82, message: `Recherche de « ${candidate.slice(0, 70)} »…` });
      try { results = deduplicate([...results, ...await searchBooks(candidate)]); }
      catch { /* try the next OCR interpretation */ }
      if (results.length >= 3) break;
    }
    if (!results.length) throw new Error('La couverture a été lue, mais aucun livre correspondant n’a été trouvé. Utilisez l’ISBN ou la saisie manuelle.');
    return { method: 'ocr', isbn: '', text, query, results };
  }

  window.BT = window.BT || {};
  window.BT.bookLookup = {
    analyzeCover, isValidISBN, lookupISBN, normalizeISBN, prepareCover, searchBooks,
    constants: { GOOGLE_BOOKS_ENDPOINT, OPEN_LIBRARY_ENDPOINT, TESSERACT_CDN }
  };
})();

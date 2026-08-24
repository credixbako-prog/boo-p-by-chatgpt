/** BOO-P — reconnaissance locale d'une couverture et recherche de métadonnées publiques. */
(() => {
  'use strict';

  const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
  const OPEN_LIBRARY_ENDPOINT = 'https://openlibrary.org/api/books';
  const OPEN_LIBRARY_SEARCH_ENDPOINT = 'https://openlibrary.org/search.json';
  const ISBN_FALLBACK_FUNCTION = 'isbn-fallback';
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
  const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js';
  const COVER_MAX_EDGE = 1200;
  const ANALYSIS_MAX_EDGE = 2000;
  const COVER_TARGET_BYTES = 360 * 1024;
  const FETCH_TIMEOUT_MS = 9000;
  const metadataCache = new Map();
  let tesseractPromise = null;
  let zxingPromise = null;

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

  function isbn10To13(value) {
    const isbn10 = normalizeISBN(value);
    if (!isValidISBN10(isbn10)) return '';
    const core = `978${isbn10.slice(0, 9)}`;
    const sum = [...core].reduce((total, character, index) => total + Number(character) * (index % 2 ? 3 : 1), 0);
    return `${core}${(10 - (sum % 10)) % 10}`;
  }

  function isbn13To10(value) {
    const isbn13 = normalizeISBN(value);
    if (!isValidISBN13(isbn13) || !isbn13.startsWith('978')) return '';
    const core = isbn13.slice(3, 12);
    const sum = [...core].reduce((total, character, index) => total + Number(character) * (10 - index), 0);
    const check = (11 - (sum % 11)) % 11;
    return `${core}${check === 10 ? 'X' : check}`;
  }

  function isbnVariants(value) {
    const isbn = normalizeISBN(value);
    const converted = isbn.length === 10 ? isbn10To13(isbn) : isbn13To10(isbn);
    return [...new Set([isbn, converted].filter(isValidISBN))];
  }

  function externalISBNLinks(value) {
    const isbn = normalizeISBN(value);
    if (!isValidISBN(isbn)) return [];
    const encoded = encodeURIComponent(isbn);
    return [
      { id:'chasse-aux-livres', label:'Chasse aux Livres', url:`https://www.chasse-aux-livres.fr/search?query=${encoded}&catalog=fr` },
      { id:'nicebooks', label:'NiceBooks', url:`https://nicebooks.com/fr/search/isbn?isbn=${encoded}` }
    ];
  }

  function plainText(value) {
    return String(value || '')
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
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

  function normalizeGenre(value) {
    const original = String(value?.name || value || '').replace(/\s+/g, ' ').trim();
    const clean = original.toLowerCase();
    const mappings = [
      [/science.?fiction|sci.?fi/, 'Science-fiction'], [/fantasy|fantastique/, 'Fantasy et fantastique'],
      [/mystery|detective|crime|thriller|policier/, 'Policier et thriller'], [/romance|love stories/, 'Romance'],
      [/poetry|poésie/, 'Poésie'], [/philosoph/, 'Philosophie'], [/history|histoire/, 'Histoire'],
      [/biograph|autobiograph|memoir/, 'Biographies et mémoires'], [/religion|spiritual|bible/, 'Religion et spiritualité'],
      [/comic|graphic novel|bande dessinée|manga/, 'Bande dessinée et manga'], [/juvenile|young adult|children|jeunesse/, 'Jeunesse'],
      [/social science|sociolog|psycholog/, 'Sciences humaines'], [/science|technology|computer/, 'Sciences et technologies'],
      [/travel|voyage/, 'Voyage'], [/self.help|personal growth|développement personnel/, 'Développement personnel'],
      [/business|economics|économie/, 'Économie et société'], [/fiction|roman|literature/, 'Romans']
    ];
    return mappings.find(([pattern]) => pattern.test(clean))?.[1] || original.split(/[\/;,]/)[0].trim();
  }

  function normalizeGenres(values = []) {
    return [...new Set((Array.isArray(values) ? values : [values]).map(normalizeGenre).filter(Boolean))].slice(0, 8);
  }

  function mapGoogleVolume(item) {
    const info = item?.volumeInfo || {};
    const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const isbn13 = identifiers.find(identifier => identifier.type === 'ISBN_13')?.identifier;
    const isbn10 = identifiers.find(identifier => identifier.type === 'ISBN_10')?.identifier;
    const genres = normalizeGenres(info.categories || []);
    return {
      source: 'Google Books', sourceId: item?.id || '',
      isbn: normalizeISBN(isbn13 || isbn10 || ''),
      title: String(info.title || '').trim(),
      authors: Array.isArray(info.authors) ? info.authors.filter(Boolean) : [],
      publisher: String(info.publisher || '').trim(),
      publishedDate: String(info.publishedDate || '').trim(),
      edition: '', format: info.printType === 'MAGAZINE' ? 'Magazine' : 'Livre',
      totalPages: Math.max(0, Number(info.pageCount) || 0),
      description: plainText(info.description), descriptionSource:info.description ? 'Google Books' : '', genre:genres[0] || '', genres,
      coverUrl: secureCoverUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '')
    };
  }

  function mapOpenLibraryBook(item, isbn) {
    const authors = Array.isArray(item?.authors) ? item.authors.map(author => author?.name).filter(Boolean) : [];
    const publishers = Array.isArray(item?.publishers) ? item.publishers.map(publisher => publisher?.name).filter(Boolean) : [];
    const coverUrl = item?.cover?.large || item?.cover?.medium || item?.cover?.small || '';
    const genres = normalizeGenres(item?.subjects || []);
    return {
      source: 'Open Library', sourceId: item?.key || '', isbn: normalizeISBN(isbn),
      workKey: item?.works?.[0]?.key || '',
      title: String(item?.title || '').trim(), authors,
      publisher: publishers[0] || '', publishedDate: String(item?.publish_date || '').trim(),
      edition: '', format: 'Livre', totalPages: Math.max(0, Number(item?.number_of_pages) || 0),
      description: '', descriptionSource:'', genre:genres[0] || '', genres, coverUrl: secureCoverUrl(coverUrl)
    };
  }

  function openLibraryKey(value, type = 'works') {
    const clean = String(value || '').trim();
    if (!clean) return '';
    if (clean.startsWith('/')) return clean;
    return clean.startsWith('OL') ? `/${type}/${clean}` : clean;
  }

  function mapOpenLibrarySearchDoc(doc, requestedISBN = '') {
    const edition = doc?.editions?.docs?.[0] || {};
    const knownISBNs = [...(Array.isArray(edition.isbn) ? edition.isbn : []), ...(Array.isArray(doc?.isbn) ? doc.isbn : [])].map(normalizeISBN).filter(isValidISBN);
    const requestedVariants = isbnVariants(requestedISBN);
    const matchingISBN = knownISBNs.find(value => requestedVariants.includes(value)) || knownISBNs[0] || normalizeISBN(requestedISBN);
    const publishers = Array.isArray(edition.publisher) ? edition.publisher : Array.isArray(doc?.publisher) ? doc.publisher : [];
    const publishDates = Array.isArray(edition.publish_date) ? edition.publish_date : [];
    const coverId = Number(edition.cover_i || doc?.cover_i) || 0;
    const genres = normalizeGenres(doc?.subject || []);
    return {
      source:'Open Library', sourceId:openLibraryKey(edition.key, 'books'), workKey:openLibraryKey(doc?.key, 'works'),
      isbn:matchingISBN, title:String(edition.title || doc?.title || '').trim(),
      authors:Array.isArray(doc?.author_name) ? doc.author_name.filter(Boolean) : [], publisher:String(publishers[0] || '').trim(),
      publishedDate:String(publishDates[0] || doc?.first_publish_year || '').trim(), edition:'', format:'Livre',
      totalPages:Math.max(0, Number(edition.number_of_pages || doc?.number_of_pages_median) || 0),
      description:'', descriptionSource:'', genre:genres[0] || '', genres,
      coverUrl:coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : ''
    };
  }

  function canonicalISBN(value) {
    const variants = isbnVariants(value);
    return variants.find(item => item.length === 13) || variants[0] || '';
  }

  function mergeBookData(current, incoming) {
    if (!current) return { ...incoming };
    const longestDescription = String(incoming.description || '').length > String(current.description || '').length ? incoming : current;
    const sources = [...new Set(`${current.source || ''} + ${incoming.source || ''}`.split(' + ').filter(Boolean))];
    return {
      ...incoming, ...current,
      source:sources.join(' + '), sourceId:current.sourceId || incoming.sourceId, workKey:current.workKey || incoming.workKey,
      isbn:current.isbn || incoming.isbn, title:current.title || incoming.title,
      authors:current.authors?.length ? current.authors : incoming.authors || [],
      publisher:current.publisher || incoming.publisher, publishedDate:current.publishedDate || incoming.publishedDate,
      edition:current.edition || incoming.edition, format:current.format || incoming.format,
      totalPages:current.totalPages || incoming.totalPages,
      description:longestDescription.description || '', descriptionSource:longestDescription.descriptionSource || '',
      genre:current.genre || incoming.genre, genres:current.genres?.length ? current.genres : incoming.genres || [],
      coverUrl:current.coverUrl || incoming.coverUrl
    };
  }

  function deduplicate(items, limit = 8) {
    const merged = new Map();
    items.filter(item => item?.title).forEach(item => {
      const isbnKey = canonicalISBN(item.isbn);
      const titleKey = plainText(item.title).toLowerCase();
      const authorKey = plainText(item.authors?.[0] || '').toLowerCase();
      const key = isbnKey ? `isbn:${isbnKey}` : `book:${titleKey}|${authorKey}`;
      merged.set(key, mergeBookData(merged.get(key), item));
    });
    return [...merged.values()].slice(0, limit);
  }

  async function searchGoogle(query, { isbn = false } = {}) {
    const q = isbn ? `isbn:${normalizeISBN(query)}` : String(query || '').trim();
    if (!q) return [];
    const url = `${GOOGLE_BOOKS_ENDPOINT}?q=${encodeURIComponent(q)}&maxResults=6&printType=books&projection=full`;
    const payload = await fetchJSON(url);
    return deduplicate((payload?.items || []).map(mapGoogleVolume));
  }

  async function searchOpenLibraryISBN(isbn) {
    const variants = isbnVariants(isbn), keys = variants.map(value => `ISBN:${value}`);
    const url = `${OPEN_LIBRARY_ENDPOINT}?bibkeys=${encodeURIComponent(keys.join(','))}&format=json&jscmd=data`;
    const payload = await fetchJSON(url);
    return deduplicate(keys.flatMap((key,index) => payload?.[key] ? [mapOpenLibraryBook(payload[key], variants[index])] : []));
  }

  async function searchOpenLibrary(query, { isbn = false } = {}) {
    const clean = isbn ? normalizeISBN(query) : plainText(query);
    if (!clean) return [];
    const fields = ['key','title','author_name','first_publish_year','publisher','isbn','number_of_pages_median','cover_i','subject'].join(',');
    const params = new URLSearchParams({ q:isbn ? `isbn:${clean}` : clean, fields, limit:'8', lang:'fr' });
    const payload = await fetchJSON(`${OPEN_LIBRARY_SEARCH_ENDPOINT}?${params}`);
    return deduplicate((payload?.docs || []).map(item => mapOpenLibrarySearchDoc(item, isbn ? clean : '')));
  }

  function mapFallbackBook(item, requestedISBN) {
    const source = String(item?.source || '').trim();
    const sourceId = String(item?.sourceId || item?.sourceUrl || '').trim();
    const genres = normalizeGenres(item?.genres || item?.genre || []);
    return {
      source: source || 'Catalogue partenaire', sourceId,
      isbn: normalizeISBN(item?.isbn || requestedISBN),
      title: plainText(item?.title),
      authors: Array.isArray(item?.authors) ? item.authors.map(plainText).filter(Boolean) : [],
      publisher: plainText(item?.publisher), publishedDate: plainText(item?.publishedDate),
      edition: plainText(item?.edition), format: plainText(item?.format) || 'Livre',
      totalPages: Math.max(0, Number(item?.totalPages) || 0),
      description: plainText(item?.description), descriptionSource: plainText(item?.descriptionSource),
      genre: genres[0] || '', genres, coverUrl: secureCoverUrl(item?.coverUrl)
    };
  }

  async function searchISBNFallback(value) {
    const isbn = normalizeISBN(value);
    const client = window.BT?.auth?.getClient?.();
    if (!client?.functions?.invoke) return [];
    const { data, error } = await client.functions.invoke(ISBN_FALLBACK_FUNCTION, { body:{ isbn } });
    if (error) throw new Error('Le catalogue ISBN de secours est momentanément indisponible.');
    return deduplicate((Array.isArray(data?.books) ? data.books : []).map(item => mapFallbackBook(item, isbn)));
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
      const workGenres = normalizeGenres(work?.subjects || []);
      return {
        ...item,
        workKey,
        description: openLibraryDescription(work?.description) || item.description,
        descriptionSource:openLibraryDescription(work?.description) ? 'Open Library' : item.descriptionSource,
        genre:item.genre || workGenres[0] || '', genres:item.genres?.length ? item.genres : workGenres,
        coverUrl: coverUrl || (workCover ? `https://covers.openlibrary.org/b/id/${workCover}-L.jpg` : '')
      };
    } catch { return { ...item, workKey, coverUrl }; }
  }

  async function lookupISBN(value) {
    const isbn = normalizeISBN(value);
    if (!isValidISBN(isbn)) throw new Error('Saisissez un ISBN-10 ou ISBN-13 valide.');
    if (metadataCache.has(isbn)) return metadataCache.get(isbn);
    const request = (async () => {
      const requests = [
        searchGoogle(isbn, { isbn:true }),
        searchOpenLibraryISBN(isbn).then(items => Promise.all(items.map(enrichOpenLibrary))),
        searchOpenLibrary(isbn, { isbn:true }).then(items => Promise.all(items.map(enrichOpenLibrary)))
      ];
      const outcomes = await Promise.allSettled(requests);
      let results = deduplicate(outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []));
      if (!results.length) {
        const alternate = isbnVariants(isbn).find(candidate => candidate !== isbn);
        if (alternate) {
          const fallbacks = await Promise.allSettled([searchGoogle(alternate, { isbn:true }), searchOpenLibrary(alternate, { isbn:true })]);
          results = deduplicate(fallbacks.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []));
        }
      }
      let fallbackFailure = null;
      if (!results.length) {
        try { results = await searchISBNFallback(isbn); }
        catch (error) { fallbackFailure = error; }
      }
      if (results.length) return enrichDescriptions(results);
      const failure = outcomes.find(outcome => outcome.status === 'rejected')?.reason;
      if (fallbackFailure && outcomes.every(outcome => outcome.status === 'rejected')) throw fallbackFailure;
      if (failure && outcomes.every(outcome => outcome.status === 'rejected')) throw failure;
      return [];
    })();
    metadataCache.set(isbn, request);
    try { return await request; }
    catch (error) { metadataCache.delete(isbn); throw error; }
  }

  async function enrichDescriptions(items) {
    return await Promise.all(items.map(async item => {
      let enriched = item.workKey ? await enrichOpenLibrary(item) : item;
      if (enriched.description || !enriched.title) return enriched;
      const author = item.authors?.[0] || '';
      try {
        const query = `intitle:"${enriched.title}"${author ? ` inauthor:"${author}"` : ''}`;
        const outcomes = await Promise.allSettled([searchGoogle(query), searchOpenLibrary(`${enriched.title} ${author}`)]);
        const fallbacks = deduplicate(outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []));
        let closest = fallbacks.find(candidate => canonicalISBN(candidate.isbn) && canonicalISBN(candidate.isbn) === canonicalISBN(enriched.isbn))
          || fallbacks.find(candidate => plainText(candidate.title).toLowerCase() === plainText(enriched.title).toLowerCase()) || fallbacks[0];
        if (closest?.workKey && !closest.description) closest = await enrichOpenLibrary(closest);
        return closest ? mergeBookData(enriched, closest) : enriched;
      } catch { return enriched; }
    }));
  }

  async function searchBooks(query) {
    const clean = String(query || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const isbn = normalizeISBN(clean);
    if ((isbn.length === 10 || isbn.length === 13) && isValidISBN(isbn)) return lookupISBN(isbn);
    const outcomes = await Promise.allSettled([searchGoogle(clean), searchOpenLibrary(clean)]);
    const results = deduplicate(outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []));
    if (results.length) return enrichDescriptions(results);
    const failure = outcomes.find(outcome => outcome.status === 'rejected')?.reason;
    if (failure && outcomes.every(outcome => outcome.status === 'rejected')) throw failure;
    return [];
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
      const analysisScale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(width, height));
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = Math.max(1, Math.round(width * analysisScale));
      analysisCanvas.height = Math.max(1, Math.round(height * analysisScale));
      const analysisContext = analysisCanvas.getContext('2d', { alpha:false });
      analysisContext.fillStyle = '#fff';
      analysisContext.fillRect(0, 0, analysisCanvas.width, analysisCanvas.height);
      analysisContext.drawImage(image, 0, 0, analysisCanvas.width, analysisCanvas.height);
      const analysisBlob = await canvasBlob(analysisCanvas, 'image/jpeg', 0.9);
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
      return { blob, analysisBlob, dataUrl: await blobDataUrl(blob), width: canvas.width, height: canvas.height, originalBytes: file.size, compressedBytes: blob.size };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function detectNativeBarcode(imageBlob) {
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

  function loadZXing() {
    if (window.ZXingBrowser?.BrowserMultiFormatReader) return Promise.resolve(window.ZXingBrowser);
    if (zxingPromise) return zxingPromise;
    zxingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ZXING_CDN;
      script.crossOrigin = 'anonymous';
      script.onload = () => window.ZXingBrowser?.BrowserMultiFormatReader ? resolve(window.ZXingBrowser) : reject(new Error('Le lecteur de code-barres de secours ne s’est pas initialisé.'));
      script.onerror = () => reject(new Error('Le lecteur de code-barres de secours n’a pas pu être chargé.'));
      document.head.appendChild(script);
    });
    return zxingPromise;
  }

  async function detectZXingBarcode(imageBlob) {
    const source = URL.createObjectURL(imageBlob);
    try {
      const zxing = await loadZXing();
      const image = await loadImage(source);
      const reader = new zxing.BrowserMultiFormatReader();
      const result = await reader.decodeFromImageElement(image);
      const raw = result?.getText?.() || result?.text || '';
      return isValidISBN(raw) ? normalizeISBN(raw) : '';
    } catch { return ''; }
    finally { URL.revokeObjectURL(source); }
  }

  async function detectBarcode(imageBlob) {
    return await detectNativeBarcode(imageBlob) || await detectZXingBarcode(imageBlob);
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

  function ocrLines(text) {
    const ignored = /^(isbn|édition|editions|roman|poche|collection|folio|gallimard|pocket|j'?ai lu|le livre de poche|a novel|penguin classics?)$/i;
    return String(text || '').split(/\r?\n/)
      .map(line => line.replace(/[^\p{L}\p{N}'’:&., -]/gu, ' ').replace(/\s+/g, ' ').trim())
      .filter(line => line.length >= 3 && line.length <= 80)
      .filter(line => (line.match(/[\p{L}]/gu) || []).length >= 3)
      .filter(line => !ignored.test(line));
  }

  function queryFromOCR(text) {
    return [...new Set(ocrLines(text))].slice(0, 5).join(' ').slice(0, 220);
  }

  function ocrQueries(text) {
    const lines = [...new Set(ocrLines(text))].slice(0, 7);
    const options = [];
    lines.slice(0, 5).forEach((line,index) => {
      if (!lines[index + 1]) return;
      options.push(`intitle:"${line}" inauthor:"${lines[index + 1]}"`);
      options.push(`${line} ${lines[index + 1]}`);
    });
    lines.slice(0, 5).forEach((line,index) => {
      options.push(`intitle:"${line}"`);
      options.push(line);
    });
    options.push(lines.slice(0, 3).join(' '), queryFromOCR(text));
    return [...new Set(options.map(item => item.trim()).filter(Boolean))].slice(0, 10);
  }

  function normalizedWords(value) {
    return new Set(plainText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  }

  function normalizedPhrase(value) {
    return [...normalizedWords(value)].join(' ');
  }

  function scoreOCRResult(item, text) {
    const seen = normalizedWords(text), titleWords = normalizedWords(item.title), authorWords = normalizedWords((item.authors || []).join(' '));
    const lines = ocrLines(text).map(normalizedPhrase).filter(Boolean);
    const titlePhrase = normalizedPhrase(item.title), authorPhrase = normalizedPhrase((item.authors || []).join(' '));
    let score = item.coverUrl ? 1 : 0;
    titleWords.forEach(word => { if (seen.has(word)) score += 4; });
    authorWords.forEach(word => { if (seen.has(word)) score += 2; });
    if (titlePhrase && lines.some(line => line === titlePhrase)) score += 14;
    if (authorPhrase && lines.some(line => line === authorPhrase)) score += 8;
    if (item.description) score += 1;
    return score;
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
      tessedit_pageseg_mode:'11', preserve_interword_spaces:'1',
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
    for (const [index,candidate] of queries.entries()) {
      onProgress({ stage: 'catalogue', progress: 0.82, message: `Recherche de « ${candidate.slice(0, 70)} »…` });
      try { results = deduplicate([...results, ...await searchBooks(candidate)], 12); }
      catch { /* try the next OCR interpretation */ }
      if (results.length >= 6 && index >= 1) break;
    }
    if (!results.length) throw new Error('La couverture a été lue, mais aucun livre correspondant n’a été trouvé. Utilisez l’ISBN ou la saisie manuelle.');
    results.sort((a,b) => scoreOCRResult(b, text) - scoreOCRResult(a, text));
    return { method: 'ocr', isbn: '', text, query, results:results.slice(0, 8) };
  }

  window.BT = window.BT || {};
  window.BT.bookLookup = {
    analyzeCover, externalISBNLinks, isbnVariants, isValidISBN, lookupISBN, normalizeISBN, prepareCover, searchBooks,
    constants: { GOOGLE_BOOKS_ENDPOINT, OPEN_LIBRARY_ENDPOINT, OPEN_LIBRARY_SEARCH_ENDPOINT, ISBN_FALLBACK_FUNCTION, TESSERACT_CDN, ZXING_CDN, ANALYSIS_MAX_EDGE }
  };
})();

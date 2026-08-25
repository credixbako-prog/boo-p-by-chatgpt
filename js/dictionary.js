/** BOO-P — aide lexicale ouverte, avec vérification dans les dictionnaires de référence. */
window.BT = window.BT || {};

BT.dictionary = (() => {
  'use strict';

  const cache = new Map();
  const REQUEST_TIMEOUT_MS = 9000;
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const truncate = (value, max = 1400) => {
    const text = clean(value);
    return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text;
  };
  const fold = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const dictionarySlug = value => fold(value)
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  function referenceLinks(term) {
    const slug = dictionarySlug(term);
    const larousseTerm = encodeURIComponent(clean(term).replace(/\s+/g, '_'));
    return [
      { label:'Le Robert', url:`https://dictionnaire.lerobert.com/definition/${slug}` },
      { label:'Larousse', url:`https://www.larousse.fr/dictionnaires/francais/${larousseTerm}` }
    ];
  }

  async function fetchLexicalJSON(endpoint, unavailableMessage) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, { headers:{ Accept:'application/json' }, signal:controller.signal });
      if (!response.ok) throw new Error(unavailableMessage);
      return await response.json();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('La recherche lexicale prend trop de temps. Réessayez dans un instant.');
      if (error instanceof Error && error.message === unavailableMessage) throw error;
      throw new Error('Impossible de joindre les sources lexicales. Vérifiez votre connexion puis réessayez.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function queryWiki(project, term) {
    const endpoint = new URL(`https://${project}.org/w/api.php`);
    const params = {
      action: 'query', generator: 'search', gsrsearch: term, gsrnamespace: '0', gsrlimit: '3',
      prop: 'extracts|info', explaintext: '1', exsentences: '6', inprop: 'url',
      redirects: '1', format: 'json', origin: '*'
    };
    // Sur le Wiktionnaire, l'introduction précède immédiatement les sections
    // linguistiques et peut donc être vide. L'extrait complet contient la définition.
    if (project === 'fr.wikipedia') params.exintro = '1';
    endpoint.search = new URLSearchParams(params);
    const payload = await fetchLexicalJSON(endpoint, 'La source lexicale ne répond pas pour le moment.');
    return Object.values(payload.query?.pages || {})
      .sort((a, b) => Number(a.index ?? 99) - Number(b.index ?? 99))
      .map(page => ({ title: clean(page.title), extract: truncate(page.extract), url: page.fullurl || '' }))
      .filter(item => item.extract);
  }

  function frenchDefinitions(document) {
    const frenchTitle = document.getElementById('Français');
    const frenchHeading = frenchTitle?.closest('.mw-heading2') || frenchTitle?.closest('h2');
    if (!frenchHeading) return [];
    const sectionNodes = [];
    for (let node = frenchHeading.nextElementSibling; node; node = node.nextElementSibling) {
      if (node.matches?.('.mw-heading2, h2')) break;
      sectionNodes.push(node);
    }
    const items = sectionNodes.flatMap(node => {
      const found = node.matches?.('ol > li') ? [node] : [];
      return found.concat([...(node.querySelectorAll?.('ol > li') || [])]);
    });
    const unique = new Set();
    return items.filter(item => !item.parentElement.closest('li')).map(item => {
      const copy = item.cloneNode(true);
      copy.querySelectorAll('ul, ol, dl, sup, table, figure, .reference, .mw-editsection, .example, .citation').forEach(node => node.remove());
      return clean(copy.textContent)
        .replace(/^\([^)]*(?:orthographe|désuet|rare|familier|figuré)[^)]*\)\s*/i, '')
        .replace(/\s*\[[^\]]+\]\s*$/g, '');
    }).filter(text => {
      const key = fold(text);
      if (text.length < 8 || unique.has(key)) return false;
      unique.add(key);
      return true;
    }).slice(0, 8);
  }

  async function queryWiktionary(term) {
    const endpoint = new URL('https://fr.wiktionary.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'parse', page: term, prop: 'text|displaytitle', redirects: '1',
      format: 'json', formatversion: '2', origin: '*'
    });
    const payload = await fetchLexicalJSON(endpoint, 'Le Wiktionnaire ne répond pas pour le moment.');
    if (!payload.parse?.text) return [];

    const document = new DOMParser().parseFromString(payload.parse.text, 'text/html');
    const definitions = frenchDefinitions(document);
    if (!definitions.length) return [];
    const title = clean(payload.parse.title || term);
    return [{
      title,
      extract: truncate(definitions[0]),
      definitions:definitions.map(definition => truncate(definition, 700)),
      url: `https://fr.wiktionary.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`
    }];
  }

  async function searchWiktionary(term) {
    const endpoint = new URL('https://fr.wiktionary.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action:'query', generator:'search', gsrsearch:term, gsrnamespace:'0', gsrlimit:'5',
      prop:'info', inprop:'url', redirects:'1', format:'json', formatversion:'2', origin:'*'
    });
    const payload = await fetchLexicalJSON(endpoint, 'Le Wiktionnaire ne répond pas pour le moment.');
    const exact = term.toLocaleLowerCase('fr');
    const titles = Object.values(payload.query?.pages || {})
      .sort((a, b) => Number(a.index ?? 99) - Number(b.index ?? 99))
      .map(page => clean(page.title))
      .filter(title => title && title.toLocaleLowerCase('fr') !== exact)
      .slice(0, 4);
    const outcomes = await Promise.allSettled(titles.map(queryWiktionary));
    const results = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []);
    return results.filter((item, index, all) => all.findIndex(candidate => candidate.url === item.url) === index);
  }

  async function lookup(term, kind = 'word') {
    const query = clean(term);
    if (query.length < 2) throw new Error('Saisissez au moins deux caractères.');
    const cacheKey = `${kind}:${query.toLocaleLowerCase('fr')}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const sources = kind === 'word'
      ? [['wiktionary-parse', 'Wiktionnaire'], ['wiktionary-search', 'Wiktionnaire']]
      : [['wiktionary-parse', 'Wiktionnaire'], ['wiktionary-search', 'Wiktionnaire'], ['fr.wikipedia', 'Wikipédia']];
    let lastError = null;
    for (const [project, label] of sources) {
      try {
        const results = project === 'wiktionary-parse' ? await queryWiktionary(query)
          : project === 'wiktionary-search' ? await searchWiktionary(query)
          : await queryWiki(project, query);
        if (results.length) {
          const best = results.find(item => fold(item.title) === fold(query)) || results[0];
          const candidates = [];
          const addCandidate = (definition, title, url) => {
            const text = truncate(definition, 700), key = fold(text);
            if (!text || candidates.some(item => fold(item.definition) === key)) return;
            candidates.push({ definition:text, title, sourceLabel:label, sourceUrl:url });
          };
          (best.definitions || [best.extract]).forEach(definition => addCandidate(definition, best.title, best.url));
          results.filter(item => item !== best).forEach(item => (item.definitions || [item.extract]).slice(0, 2)
            .forEach(definition => addCandidate(definition, item.title, item.url)));
          const selected = candidates[0] || { definition:best.extract, sourceLabel:label, sourceUrl:best.url, title:best.title };
          const value = {
            term:query, kind, definition:selected.definition,
            sourceLabel:selected.sourceLabel, sourceUrl:selected.sourceUrl,
            candidates:candidates.slice(0, 6), externalSources:referenceLinks(query)
          };
          cache.set(cacheKey, value);
          return value;
        }
      } catch (error) { lastError = error; }
    }
    if (lastError) throw lastError;
    throw new Error('Aucune explication fiable trouvée. Vous pouvez saisir votre propre définition.');
  }

  return { lookup, referenceLinks };
})();

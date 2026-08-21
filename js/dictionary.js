/** BOO-P — aide lexicale intégrée, fondée sur les API publiques Wikimedia. */
window.BT = window.BT || {};

BT.dictionary = (() => {
  'use strict';

  const cache = new Map();
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const truncate = (value, max = 1400) => {
    const text = clean(value);
    return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text;
  };

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
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('La source lexicale ne répond pas pour le moment.');
    const payload = await response.json();
    return Object.values(payload.query?.pages || {})
      .sort((a, b) => Number(a.index ?? 99) - Number(b.index ?? 99))
      .map(page => ({ title: clean(page.title), extract: truncate(page.extract), url: page.fullurl || '' }))
      .filter(item => item.extract);
  }

  async function queryWiktionary(term) {
    const endpoint = new URL('https://fr.wiktionary.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action: 'parse', page: term, prop: 'text|displaytitle', redirects: '1',
      format: 'json', formatversion: '2', origin: '*'
    });
    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Le Wiktionnaire ne répond pas pour le moment.');
    const payload = await response.json();
    if (!payload.parse?.text) return [];

    const document = new DOMParser().parseFromString(payload.parse.text, 'text/html');
    const definitions = [...document.querySelectorAll('ol > li')].filter(item => !item.parentElement.closest('li')).map(item => {
      const copy = item.cloneNode(true);
      copy.querySelectorAll('ul, ol, dl, sup, .reference, .mw-editsection').forEach(node => node.remove());
      return clean(copy.textContent);
    }).filter(text => text.length >= 8).slice(0, 4);
    if (!definitions.length) return [];
    const title = clean(payload.parse.title || term);
    return [{
      title,
      extract: truncate(definitions.join(' ')),
      url: `https://fr.wiktionary.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`
    }];
  }

  async function lookup(term, kind = 'word') {
    const query = clean(term);
    if (query.length < 2) throw new Error('Saisissez au moins deux caractères.');
    const cacheKey = `${kind}:${query.toLocaleLowerCase('fr')}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const sources = kind === 'word'
      ? [['wiktionary-parse', 'Wiktionnaire']]
      : [['wiktionary-parse', 'Wiktionnaire'], ['fr.wikipedia', 'Wikipédia']];
    let lastError = null;
    for (const [project, label] of sources) {
      try {
        const results = project === 'wiktionary-parse' ? await queryWiktionary(query) : await queryWiki(project, query);
        if (results.length) {
          const best = results.find(item => item.title.toLocaleLowerCase('fr') === query.toLocaleLowerCase('fr')) || results[0];
          const value = { term: query, kind, definition: best.extract, sourceLabel: label, sourceUrl: best.url, alternatives: results.slice(1) };
          cache.set(cacheKey, value);
          return value;
        }
      } catch (error) { lastError = error; }
    }
    if (lastError) throw lastError;
    throw new Error('Aucune explication fiable trouvée. Vous pouvez saisir votre propre définition.');
  }

  return { lookup };
})();

/** BOO-P — aide lexicale française, ouverte, attribuée et vérifiable. */
window.BT = window.BT || {};

BT.dictionary = (() => {
  'use strict';

  const cache = new Map();
  const REQUEST_TIMEOUT_MS = 9000;
  const DDF_TIMEOUT_MS = 5500;
  const DDF_ENDPOINT = 'https://www.dictionnairedesfrancophones.org/graphql';
  const WIKTIONARY_LICENSE_URL = 'https://fr.wiktionary.org/wiki/Wiktionnaire:Citation_et_r%C3%A9utilisation_du_contenu_du_Wiktionnaire';
  const DDF_QUERY = `query BooPLexicon($term:String!){
    words(qs:$term,first:12){edges{node{canonicalFormWrittenRep partOfSpeechLabels senses(first:12){edges{node{definition lexicographicResourceShortName}}}}}}
    expressions:multiWordExpressions(qs:$term,first:12){edges{node{canonicalFormWrittenRep multiWordTypeLabels senses(first:12){edges{node{definition lexicographicResourceShortName}}}}}}
  }`;

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const truncate = (value, max = 1400) => {
    const text = clean(value);
    return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text;
  };
  const fold = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const headwordKey = value => fold(value).replace(/[’'\-\s]/g, '');
  const sameHeadword = (left, right) => Boolean(headwordKey(left)) && headwordKey(left) === headwordKey(right);
  const dictionarySlug = value => fold(value)
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const wiktionaryUrl = term => `https://fr.wiktionary.org/wiki/${encodeURIComponent(clean(term).replace(/\s+/g, '_'))}`;
  const ddfUrl = term => `https://www.dictionnairedesfrancophones.org/form/${encodeURIComponent(clean(term))}`;

  function referenceLinks(term) {
    const query = clean(term);
    const slug = dictionarySlug(query);
    const larousseTerm = encodeURIComponent(query.replace(/\s+/g, '_'));
    return [
      { label:'Le Robert', url:`https://dictionnaire.lerobert.com/definition/${slug}` },
      { label:'Larousse', url:`https://www.larousse.fr/dictionnaires/francais/${larousseTerm}` }
    ];
  }

  async function fetchLexicalJSON(endpoint, unavailableMessage, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        ...init,
        headers:{ Accept:'application/json', ...(init.headers || {}) },
        signal:controller.signal
      });
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

  function htmlToText(value) {
    const input = String(value || '');
    if (!/[<&]/.test(input)) return clean(input);
    try {
      const document = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html');
      return clean(document.body?.textContent || document.documentElement?.textContent || input);
    } catch (_) {
      return clean(input.replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'"));
    }
  }

  function isInflectedDefinition(value) {
    return /^(?:\([^)]*\)\s*)*(?:forme\s+(?:fléchie|conjuguée|de\b|du\b)|participe\b|(?:première|deuxième|troisième|[123](?:re|er|e)?)\s+personne\b)/i.test(clean(value));
  }

  function lexicalEntryScore(entry, query) {
    const title = clean(entry?.canonicalFormWrittenRep);
    const definitions = entry?.definitions || [];
    let score = sameHeadword(title, query) ? 100 : 0;
    if (title.toLocaleLowerCase('fr') === clean(query).toLocaleLowerCase('fr')) score += 20;
    score += definitions.some(definition => !isInflectedDefinition(definition)) ? 30 : -30;
    if ((entry?.grammar || []).some(label => /nom|adjectif|adverbe|locution|expression/i.test(label))) score += 5;
    return score;
  }

  async function queryDDF(term) {
    const payload = await fetchLexicalJSON(DDF_ENDPOINT, 'Le Dictionnaire des francophones ne répond pas pour le moment.', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ query:DDF_QUERY, variables:{ term } })
    }, DDF_TIMEOUT_MS);
    if (payload.errors?.length) throw new Error('Le Dictionnaire des francophones ne répond pas pour le moment.');

    const nodes = [
      ...(payload.data?.words?.edges || []),
      ...(payload.data?.expressions?.edges || [])
    ].map(edge => edge?.node).filter(Boolean);

    return nodes.map(node => {
      const definitions = (node.senses?.edges || []).map(edge => edge?.node).filter(sense => {
        const source = fold(sense?.lexicographicResourceShortName);
        // Seules les données du Wiktionnaire sont reprises : leur licence autorise
        // explicitement cette réutilisation. Larousse et Le Robert restent des liens
        // de vérification, leurs contenus n'étant pas aspirés ni recopiés.
        return source.includes('wiktionnaire') || source === 'wikt';
      }).map(sense => truncate(htmlToText(sense.definition), 700)).filter(definition => definition.length >= 5)
        .sort((left, right) => Number(isInflectedDefinition(left)) - Number(isInflectedDefinition(right)));
      return {
        canonicalFormWrittenRep:clean(node.canonicalFormWrittenRep),
        grammar:node.partOfSpeechLabels || node.multiWordTypeLabels || [],
        definitions
      };
    }).filter(entry => sameHeadword(entry.canonicalFormWrittenRep, term) && entry.definitions.length)
      .sort((left, right) => lexicalEntryScore(right, term) - lexicalEntryScore(left, term))
      .map(entry => ({
        title:entry.canonicalFormWrittenRep,
        extract:entry.definitions[0],
        definitions:entry.definitions,
        url:wiktionaryUrl(entry.canonicalFormWrittenRep),
        sourceLabel:'Wiktionnaire (via DDF) · licence CC BY-SA',
        licenseLabel:'CC BY-SA',
        licenseUrl:WIKTIONARY_LICENSE_URL,
        viaLabel:'Dictionnaire des francophones',
        viaUrl:ddfUrl(entry.canonicalFormWrittenRep)
      }));
  }

  async function queryWiki(project, term) {
    const endpoint = new URL(`https://${project}.org/w/api.php`);
    const params = {
      action: 'query', generator: 'search', gsrsearch: term, gsrnamespace: '0', gsrlimit: '3',
      prop: 'extracts|info', explaintext: '1', exsentences: '6', inprop: 'url',
      redirects: '1', format: 'json', origin: '*'
    };
    if (project === 'fr.wikipedia') params.exintro = '1';
    endpoint.search = new URLSearchParams(params);
    const payload = await fetchLexicalJSON(endpoint, 'La source lexicale ne répond pas pour le moment.');
    return Object.values(payload.query?.pages || {})
      .sort((a, b) => Number(a.index ?? 99) - Number(b.index ?? 99))
      .map(page => ({ title: clean(page.title), extract: truncate(page.extract), url: page.fullurl || '' }))
      // Une page seulement voisine n'est jamais présentée comme la définition du terme.
      .filter(item => item.extract && sameHeadword(item.title, term));
  }

  function definitionText(item) {
    const copy = item.cloneNode(true);
    copy.querySelectorAll('ul, ol, dl, sup, table, figure, .reference, .mw-editsection, .example, .citation').forEach(node => node.remove());
    return clean(copy.textContent)
      .replace(/^\([^)]*(?:orthographe|désuet|rare|familier|figuré)[^)]*\)\s*/i, '')
      .replace(/\s*\[[^\]]+\]\s*$/g, '');
  }

  function topLevelDefinitionItems(node) {
    const found = node.matches?.('ol > li') ? [node] : [];
    return found.concat([...(node.querySelectorAll?.('ol > li') || [])])
      .filter(item => !item.parentElement?.closest?.('li'));
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

    const hasLexicalHeadings = sectionNodes.some(node => node.matches?.('.mw-heading3, h3') && node.querySelector?.('.titredef'));
    const entries = [];
    if (hasLexicalHeadings) {
      let section = null;
      sectionNodes.forEach(node => {
        if (node.matches?.('.mw-heading3, h3')) {
          const title = clean(node.querySelector?.('.titredef')?.textContent);
          section = title ? { inflected:/forme|flexion/i.test(title) } : null;
          return;
        }
        if (node.matches?.('.mw-heading4, h4')) {
          section = null;
          return;
        }
        if (section) topLevelDefinitionItems(node).forEach(item => entries.push({ text:definitionText(item), inflected:section.inflected }));
      });
    } else {
      // Compatibilité avec les rendus MediaWiki simplifiés et anciens : le parcours
      // reste strictement limité à la section « Français ».
      sectionNodes.forEach(node => topLevelDefinitionItems(node).forEach(item => entries.push({ text:definitionText(item), inflected:false })));
    }

    const unique = new Set();
    return entries.sort((left, right) => Number(left.inflected || isInflectedDefinition(left.text)) - Number(right.inflected || isInflectedDefinition(right.text)))
      .map(entry => entry.text).filter(text => {
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
      extract:truncate(definitions[0]),
      definitions:definitions.map(definition => truncate(definition, 700)),
      url:wiktionaryUrl(title),
      licenseLabel:'CC BY-SA',
      licenseUrl:WIKTIONARY_LICENSE_URL
    }];
  }

  async function searchWiktionary(term) {
    const endpoint = new URL('https://fr.wiktionary.org/w/api.php');
    endpoint.search = new URLSearchParams({
      action:'query', generator:'search', gsrsearch:term, gsrnamespace:'0', gsrlimit:'5',
      prop:'info', inprop:'url', redirects:'1', format:'json', formatversion:'2', origin:'*'
    });
    const payload = await fetchLexicalJSON(endpoint, 'Le Wiktionnaire ne répond pas pour le moment.');
    const exact = clean(term).toLocaleLowerCase('fr');
    const titles = Object.values(payload.query?.pages || {})
      .sort((a, b) => Number(a.index ?? 99) - Number(b.index ?? 99))
      .map(page => clean(page.title))
      .filter(title => title && title.toLocaleLowerCase('fr') !== exact && sameHeadword(title, term))
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
      ? [['ddf', 'Wiktionnaire (via DDF) · licence CC BY-SA'], ['wiktionary-parse', 'Wiktionnaire'], ['wiktionary-search', 'Wiktionnaire']]
      : [['ddf', 'Wiktionnaire (via DDF) · licence CC BY-SA'], ['wiktionary-parse', 'Wiktionnaire'], ['wiktionary-search', 'Wiktionnaire'], ['fr.wikipedia', 'Wikipédia']];
    let lastError = null;
    let hadSuccessfulSource = false;
    for (const [project, label] of sources) {
      try {
        const results = project === 'ddf' ? await queryDDF(query)
          : project === 'wiktionary-parse' ? await queryWiktionary(query)
            : project === 'wiktionary-search' ? await searchWiktionary(query)
              : await queryWiki(project, query);
        hadSuccessfulSource = true;
        if (results.length) {
          const best = results.find(item => sameHeadword(item.title, query)) || results[0];
          const candidates = [];
          const addCandidate = (definition, item, fallbackLabel) => {
            const text = truncate(definition, 700), key = fold(text);
            if (!text || candidates.some(candidate => fold(candidate.definition) === key)) return;
            candidates.push({
              definition:text,
              title:item.title,
              sourceLabel:item.sourceLabel || fallbackLabel,
              sourceUrl:item.url,
              licenseLabel:item.licenseLabel || '',
              licenseUrl:item.licenseUrl || '',
              viaLabel:item.viaLabel || '',
              viaUrl:item.viaUrl || ''
            });
          };
          (best.definitions || [best.extract]).forEach(definition => addCandidate(definition, best, label));
          results.filter(item => item !== best).forEach(item => (item.definitions || [item.extract]).slice(0, 2)
            .forEach(definition => addCandidate(definition, item, label)));
          const selected = candidates[0];
          if (!selected) continue;
          const value = {
            term:query,
            kind,
            definition:selected.definition,
            sourceLabel:selected.sourceLabel,
            sourceUrl:selected.sourceUrl,
            candidates:candidates.slice(0, 6),
            externalSources:referenceLinks(query),
            attribution:{
              sourceLabel:selected.sourceLabel,
              sourceUrl:selected.sourceUrl,
              licenseLabel:selected.licenseLabel,
              licenseUrl:selected.licenseUrl,
              viaLabel:selected.viaLabel,
              viaUrl:selected.viaUrl
            }
          };
          cache.set(cacheKey, value);
          return value;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (!hadSuccessfulSource && lastError) throw lastError;
    throw new Error('Aucune définition exacte et fiable trouvée. Vérifiez l’orthographe ou saisissez votre propre explication.');
  }

  return { lookup, referenceLinks };
})();

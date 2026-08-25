import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../js/dictionary.js', import.meta.url), 'utf8');

function makeContext(fetch) {
  class DOMParser {
    parseFromString(input) {
      const text = String(input)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
      return { body:{ textContent:text }, documentElement:{ textContent:text }, getElementById:() => null };
    }
  }
  const BT = {};
  const context = {
    window:{ BT }, BT, fetch, DOMParser, URL, URLSearchParams, AbortController,
    setTimeout, clearTimeout, console
  };
  vm.runInNewContext(source, context);
  return context;
}

const response = payload => ({ ok:true, json:async () => payload });

test('le DDF structuré privilégie le sens lexical avant une flexion homographe', async () => {
  const fetch = async (endpoint, init) => {
    assert.equal(endpoint, 'https://www.dictionnairedesfrancophones.org/graphql');
    assert.equal(init.method, 'POST');
    assert.equal(JSON.parse(init.body).variables.term, 'sérendipité');
    return response({ data:{ words:{ edges:[
      { node:{ canonicalFormWrittenRep:'sérendipité', partOfSpeechLabels:['verbe'], senses:{ edges:[
        { node:{ definition:'<i>Participe passé masculin singulier de</i> sérendipiter.', lexicographicResourceShortName:'Wiktionnaire' } }
      ] } } },
      { node:{ canonicalFormWrittenRep:'sérendipité', partOfSpeechLabels:['nom'], senses:{ edges:[
        { node:{ definition:'Fait de faire une <a href="/form/découverte">découverte</a> par hasard et sagacité alors que l’on cherchait autre chose.', lexicographicResourceShortName:'Wiktionnaire' } },
        { node:{ definition:'Expérience d’heureuses coïncidences.', lexicographicResourceShortName:'Wiktionnaire' } }
      ] } } }
    ] }, expressions:{ edges:[] } } });
  };
  const context = makeContext(fetch);

  const found = await context.window.BT.dictionary.lookup('sérendipité', 'word');

  assert.equal(found.definition, 'Fait de faire une découverte par hasard et sagacité alors que l’on cherchait autre chose.');
  assert.match(found.sourceLabel, /Wiktionnaire \(via DDF\).*CC BY-SA/);
  assert.equal(found.sourceUrl, 'https://fr.wiktionary.org/wiki/s%C3%A9rendipit%C3%A9');
  assert.equal(found.attribution.viaLabel, 'Dictionnaire des francophones');
  assert.match(found.attribution.licenseUrl, /Citation_et_r%C3%A9utilisation/);
  assert.match(found.candidates.at(-1).definition, /^Participe passé/);
});

test('une entrée voisine ou une source protégée ne devient jamais une fausse définition', async () => {
  const parsedPages = [];
  const fetch = async endpoint => {
    if (typeof endpoint === 'string') return response({ data:{ words:{ edges:[
      { node:{ canonicalFormWrittenRep:'sérendipité heureuse', partOfSpeechLabels:['nom'], senses:{ edges:[
        { node:{ definition:'Définition voisine.', lexicographicResourceShortName:'Wiktionnaire' } }
      ] } } },
      { node:{ canonicalFormWrittenRep:'sérendipité', partOfSpeechLabels:['nom'], senses:{ edges:[
        { node:{ definition:'Contenu propriétaire à ne pas recopier.', lexicographicResourceShortName:'Larousse' } }
      ] } } }
    ] }, expressions:{ edges:[] } } });
    const action = endpoint.searchParams.get('action');
    if (action === 'parse') {
      parsedPages.push(endpoint.searchParams.get('page'));
      return response({ parse:{} });
    }
    return response({ query:{ pages:[{ index:0, title:'sérendipité heureuse' }] } });
  };
  const context = makeContext(fetch);

  await assert.rejects(
    context.window.BT.dictionary.lookup('sérendipité', 'word'),
    /Aucune définition exacte et fiable trouvée/
  );
  assert.deepEqual(parsedPages, ['sérendipité']);
});

test('les liens de contrôle Robert et Larousse conservent le terme exact', () => {
  const context = makeContext(async () => response({}));
  const links = context.window.BT.dictionary.referenceLinks('Épée à double tranchant');

  assert.equal(links[0].url, 'https://dictionnaire.lerobert.com/definition/epee-a-double-tranchant');
  assert.equal(links[1].url, 'https://www.larousse.fr/dictionnaires/francais/%C3%89p%C3%A9e_%C3%A0_double_tranchant');
});

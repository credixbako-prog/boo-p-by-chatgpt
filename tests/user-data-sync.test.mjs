import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const syncSource = await readFile(path.join(root, 'js/user-data-sync-api.js'), 'utf8');
const USER_ID = '11111111-1111-1111-1111-111111111111';

const plain = value => JSON.parse(JSON.stringify(value));

class MemoryQuery {
  constructor(database, table) {
    this.database = database;
    this.table = table;
    this.operation = null;
    this.filters = [];
    this.ordering = null;
    this.rows = null;
    this.options = null;
  }

  select() {
    if (!this.operation) this.operation = 'select';
    return this;
  }

  upsert(rows, options) {
    this.operation = 'upsert';
    this.rows = plain(rows);
    this.options = options;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push(row => row[column] === value);
    return this;
  }

  gt(column, value) {
    this.filters.push(row => new Date(row[column]).getTime() > new Date(value).getTime());
    return this;
  }

  in(column, values) {
    const accepted = new Set(values);
    this.filters.push(row => accepted.has(row[column]));
    return this;
  }

  order(column, options = {}) {
    this.ordering = { column, ascending:options.ascending !== false };
    return this;
  }

  matches(row) {
    return this.filters.every(filter => filter(row));
  }

  async execute() {
    const tableRows = this.database.tables.get(this.table) || [];

    if (this.operation === 'upsert') {
      const conflictColumns = String(this.options?.onConflict || '').split(',').filter(Boolean);
      const saved = this.rows.map(incoming => {
        const index = tableRows.findIndex(existing => conflictColumns.every(column => existing[column] === incoming[column]));
        const timestamp = new Date().toISOString();
        if (index < 0) {
          const inserted = { ...incoming, created_at:timestamp, updated_at:timestamp };
          tableRows.push(inserted);
          return inserted;
        }
        const existing = tableRows[index];
        if (new Date(incoming.client_updated_at) < new Date(existing.client_updated_at)) return existing;
        const updated = { ...existing, ...incoming, updated_at:timestamp };
        tableRows[index] = updated;
        return updated;
      });
      this.database.tables.set(this.table, tableRows);
      return { data:plain(saved), error:null };
    }

    if (this.operation === 'delete') {
      const deleted = tableRows.filter(row => this.matches(row));
      const kept = tableRows.filter(row => !this.matches(row));
      this.database.tables.set(this.table, kept);
      return { data:plain(deleted), error:null };
    }

    let selected = tableRows.filter(row => this.matches(row));
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      selected = selected.slice().sort((left, right) => {
        const result = String(left[column]).localeCompare(String(right[column]));
        return ascending ? result : -result;
      });
    }
    return { data:plain(selected), error:null };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

class MemorySupabase {
  constructor() {
    this.tables = new Map();
    this.queryCount = 0;
  }

  from(table) {
    this.queryCount += 1;
    return new MemoryQuery(this, table);
  }
}

function loadSync({ api = new MemorySupabase(), guest = false, authenticated = true } = {}) {
  let readyCount = 0;
  const storage = { getItem:() => null, setItem() {}, removeItem() {} };
  const auth = {
    async ready() { readyCount += 1; },
    getCurrentUser:() => guest ? { id:'guest', isGuest:true } : authenticated ? { id:USER_ID } : null,
    getSession:() => authenticated && !guest ? { user:{ id:USER_ID } } : null,
    getClient:() => api
  };
  const context = vm.createContext({
    window:{ BT:{ auth } },
    BT:null,
    document:{ documentElement:{ dataset:{} } },
    localStorage:storage,
    sessionStorage:storage,
    console:{ error() {} }
  });
  context.BT = context.window.BT;
  vm.runInContext(syncSource, context, { filename:'js/user-data-sync-api.js' });
  return {
    api,
    sync:context.window.BT.userDataSync,
    getReadyCount:() => readyCount
  };
}

test('le mode invité ne contacte jamais Supabase, même pour pull, push, upsert et delete', async () => {
  const api = new MemorySupabase();
  const { sync, getReadyCount } = loadSync({ api, guest:true, authenticated:false });

  const pulled = plain(await sync.pullAll());
  const pushed = await sync.pushAll({ books:[{ id:'guest-book', title:'Local uniquement' }] });
  const upserted = await sync.upsertBooks({ id:'guest-book', title:'Local uniquement' });
  const deleted = await sync.deleteBooks('guest-book');

  assert.equal(pulled._sync.skipped, true);
  assert.equal(pulled._sync.reason, 'guest');
  assert.equal(pushed.skipped, true);
  assert.equal(upserted.skipped, true);
  assert.equal(deleted.skipped, true);
  assert.equal(api.queryCount, 0);
  assert.equal(getReadyCount(), 0);
});

test('un utilisateur local simulé sans session réelle ne peut pas écrire à distance', async () => {
  const api = new MemorySupabase();
  const { sync } = loadSync({ api, guest:false, authenticated:false });
  const result = await sync.upsertBooks({ id:'local-user-book', title:'Sans session' });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'unauthenticated');
  assert.equal(api.queryCount, 0);
});

test('la synchronisation utilise un RPC unique avec la base et la copie envoyée', async () => {
  const { api, sync } = loadSync();
  const calls = [];
  const base = { books:[], sessions:[], traces:[], lexicon:[], goals:{} };
  const desired = { ...base, books:[{ id:'a',title:'A' }] };
  api.rpc = async (name,args) => { calls.push({ name,args }); return { data:desired,error:null }; };
  assert.deepEqual(plain(await sync.mergeSnapshot(base,desired)), desired);
  assert.deepEqual(plain(calls), [{ name:'merge_personal_snapshot',args:{ baseline:base,desired } }]);
  assert.equal(api.queryCount,0);
});

test('la lecture complète passe par un résultat JSON sans limite de lignes de collection', async () => {
  const { api,sync } = loadSync();
  const data = { books:Array.from({length:1205},(_,id) => ({id:String(id)})),sessions:[],traces:[],lexicon:[],goals:{} };
  api.rpc = async name => { assert.equal(name,'read_personal_snapshot'); return {data,error:null}; };
  assert.equal((await sync.readSnapshot()).books.length,1205);
});

test('un conflit est explicite et ne déclenche aucune écriture de secours', async () => {
  const { api,sync } = loadSync();
  let calls = 0;
  api.rpc = async () => { calls++; return {data:null,error:{message:'BOOP_SYNC_CONFLICT'}}; };
  await assert.rejects(sync.mergeSnapshot({},{}),error => error.code === 'BOOP_SYNC_CONFLICT');
  assert.equal(calls,1);
  assert.equal(api.queryCount,0);
});

test('les anciennes méthodes d’écriture échouent avant toute requête destructive', async () => {
  const { api,sync } = loadSync();
  await assert.rejects(sync.pushAll({books:[]},{replaceRemote:true}),/désactivé/);
  await assert.rejects(sync.upsertBooks({id:'a'}),/désactivée/);
  await assert.rejects(sync.deleteBooks('a'),/désactivée/);
  assert.equal(api.queryCount,0);
});

test('invités et sessions absentes ne peuvent pas utiliser les nouveaux RPC', async () => {
  for (const options of [{guest:true,authenticated:false},{guest:false,authenticated:false}]) {
    const { api,sync } = loadSync(options);
    api.rpc = () => { throw new Error('Unexpected RPC'); };
    assert.equal((await sync.mergeSnapshot(null,{}))._sync.skipped,true);
    assert.equal((await sync.readSnapshot())._sync.skipped,true);
  }
});

test('une réponse RPC incomplète ne devient jamais un carnet vide', async () => {
  const {api,sync} = loadSync();
  api.rpc=async () => ({data:{books:[]},error:null});
  await assert.rejects(sync.readSnapshot(),/incomplète/);
  await assert.rejects(sync.mergeSnapshot(null,{}),/incomplète/);
});

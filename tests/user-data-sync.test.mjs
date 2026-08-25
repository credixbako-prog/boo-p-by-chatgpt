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

test('pushAll puis pullAll synchronisent toutes les données privées', async () => {
  const { api, sync } = loadSync();
  const snapshot = {
    books:[{
      id:'book-1', title:'Le livre test', status:'lu',
      startedAt:'2026-01-02T10:00:00.000Z',
      completedAt:'2026-01-10T18:30:00.000Z', rating:4
    }],
    sessions:[{
      id:'session-1', bookId:'book-1', startedAt:'2026-01-10T17:30:00.000Z',
      endedAt:'2026-01-10T18:30:00.000Z', durationSeconds:3600
    }],
    traces:[{
      id:'trace-1', bookId:'book-1', text:'Une Trace personnelle.',
      createdAt:'2026-01-10T18:31:00.000Z', updatedAt:'2026-01-10T18:31:00.000Z'
    }],
    lexicon:[{
      id:'lex-1', bookId:'book-1', word:'Sérendipité', kind:'word',
      definition:'Découverte heureuse faite par hasard.', updatedAt:'2026-01-10T18:32:00.000Z'
    }],
    goals:{
      week:{ dailyMinutes:20, daysTarget:4 },
      month:{ targetBooks:2, bookIds:['book-1'] },
      year:{ targetBooks:12, bookIds:['book-1'] },
      celebrated:{ 'year:2026':true }
    }
  };

  const pushed = await sync.pushAll(snapshot, { touch:true });
  assert.equal(pushed.skipped, false);
  assert.equal(pushed.count, 8);
  assert.equal(api.tables.get('user_books')[0].user_id, USER_ID);

  const pulled = plain(await sync.pullAll());
  assert.equal(pulled._sync.skipped, false);
  assert.equal(pulled.books.length, 1);
  assert.equal(pulled.books[0].startedAt, snapshot.books[0].startedAt);
  assert.equal(pulled.books[0].completedAt, snapshot.books[0].completedAt);
  assert.equal(pulled.books[0].rating, 4);
  assert.deepEqual(pulled.sessions, snapshot.sessions);
  assert.deepEqual(pulled.traces, snapshot.traces);
  assert.deepEqual(pulled.lexicon, snapshot.lexicon);
  assert.deepEqual(pulled.goals, snapshot.goals);
  assert.ok(pulled._sync.versions.books['book-1'].serverUpdatedAt);
});

test('upsert et delete ciblés modifient uniquement les enregistrements demandés', async () => {
  const { api, sync } = loadSync();
  await sync.upsertBooks([
    { id:'book-1', title:'Premier', rating:2 },
    { id:'book-2', title:'Second', rating:3 }
  ]);
  await sync.upsertBooks({ id:'book-1', title:'Premier', rating:5 });
  await sync.upsertSessions({ id:'session-1', bookId:'book-1', durationSeconds:900 });
  await sync.upsertTraces({ id:'trace-1', bookId:'book-1', text:'À supprimer' });
  await sync.upsertLexicon({ id:'lex-1', word:'Épure', definition:'Forme essentielle.' });
  await sync.upsertGoals({ month:{ targetBooks:3 }, year:{ targetBooks:20 } });

  const books = plain(await sync.pullBooks());
  assert.equal(books.find(book => book.id === 'book-1').rating, 5);
  assert.equal(books.find(book => book.id === 'book-2').rating, 3);

  const deletedBook = await sync.deleteBooks('book-2');
  const deletedTrace = await sync.deleteTraces('trace-1');
  const deletedGoal = await sync.deleteGoals('month');
  assert.equal(deletedBook.count, 1);
  assert.equal(deletedTrace.count, 1);
  assert.equal(deletedGoal.count, 1);
  assert.equal(api.tables.get('user_books').length, 1);

  const pulled = plain(await sync.pullAll());
  assert.deepEqual(pulled.books.map(book => book.id), ['book-1']);
  assert.equal(pulled.traces.length, 0);
  assert.deepEqual(Object.keys(pulled.goals), ['year']);
  assert.equal(pulled.sessions.length, 1);
  assert.equal(pulled.lexicon.length, 1);
});

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

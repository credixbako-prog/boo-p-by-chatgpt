import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/components/trail-mindmap.js', import.meta.url), 'utf8');

function api() {
  const context = { window:{ BT:{} } };
  context.BT = context.window.BT;
  vm.runInNewContext(source, context);
  return context.window.BT.trailMindmap;
}

test('la carte relie la personne aux genres puis aux livres', () => {
  const groups = [
    { id:'romans', name:'Romans', books:Array.from({ length:4 }, (_, index) => ({ id:`roman-${index + 1}` })) },
    { id:'essais', name:'Essais', books:Array.from({ length:3 }, (_, index) => ({ id:`essai-${index + 1}` })) }
  ];
  const layout = api().layout(groups, new Set());
  assert.equal(layout.genres.length, 2);
  assert.equal(layout.nodes.length, 7);
  assert.ok(layout.width >= 2000);
  assert.ok(layout.height >= 900);
  assert.ok(layout.genres.every(genre => genre.path.startsWith('M ') && genre.books.length));
  assert.ok(layout.nodes.every(node => node.path.startsWith('M ') && node.branches.length === 0));
  assert.equal(new Set(layout.nodes.map(node => `${node.x}:${node.y}`)).size, 7);
  assert.equal(layout.root.x, layout.width / 2);
  assert.equal(layout.root.y, layout.height / 2);
});

test('un livre déployé fait apparaître les trois ramifications demandées sans déplacer les autres', () => {
  const groups = [{ id:'romans', name:'Romans', books:[{ id:'a' }, { id:'b' }, { id:'c' }] }];
  const collapsed = api().layout(groups, []);
  const expanded = api().layout(groups, ['b']);
  assert.equal(
    JSON.stringify(expanded.nodes.map(node => [node.id, node.x, node.y])),
    JSON.stringify(collapsed.nodes.map(node => [node.id, node.x, node.y]))
  );
  assert.equal(expanded.nodes.find(node => node.id === 'b').branches.length, 3);
  assert.equal(expanded.nodes.find(node => node.id === 'a').branches.length, 0);
});

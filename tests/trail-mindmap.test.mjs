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

test('la carte place chaque livre dans une zone libre et reliée à la racine', () => {
  const items = Array.from({ length:7 }, (_, index) => ({ id:`book-${index + 1}` }));
  const layout = api().layout(items, new Set());
  assert.equal(layout.nodes.length, items.length);
  assert.ok(layout.width >= 900);
  assert.ok(layout.height >= 660);
  assert.ok(layout.nodes.every(node => node.path.startsWith('M ') && node.branches.length === 0));
  assert.equal(new Set(layout.nodes.map(node => `${node.x}:${node.y}`)).size, items.length);
});

test('un livre déployé fait apparaître quatre ramifications sans déplacer les autres', () => {
  const items = [{ id:'a' }, { id:'b' }, { id:'c' }];
  const collapsed = api().layout(items, []);
  const expanded = api().layout(items, ['b']);
  assert.deepEqual(
    expanded.nodes.map(node => [node.id, node.x, node.y]),
    collapsed.nodes.map(node => [node.id, node.x, node.y])
  );
  assert.equal(expanded.nodes.find(node => node.id === 'b').branches.length, 4);
  assert.equal(expanded.nodes.find(node => node.id === 'a').branches.length, 0);
});

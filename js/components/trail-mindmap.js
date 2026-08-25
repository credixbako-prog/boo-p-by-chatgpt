/** BOO-P — calcul déterministe de la carte libre du Sentier. */
window.BT = window.BT || {};

BT.trailMindmap = (() => {
  'use strict';

  const BRANCH_OFFSETS = [
    { x:-145, y:-125 },
    { x:155, y:-120 },
    { x:-145, y:125 },
    { x:155, y:120 }
  ];

  function curve(from, to) {
    const direction = to.x >= from.x ? 1 : -1;
    const bend = Math.max(54, Math.abs(to.x - from.x) * .42) * direction;
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }

  function layout(items = [], expandedIds = []) {
    const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds || []);
    const columns = items.length < 3 ? Math.max(1, items.length) : 3;
    const rows = Math.max(1, Math.ceil(items.length / Math.max(1, columns)));
    const width = Math.max(900, 400 + columns * 480);
    const height = Math.max(660, 260 + rows * 390);
    const root = { x:105, y:95 };
    const nodes = items.map((item, index) => {
      const column = index % Math.max(1, columns);
      const row = Math.floor(index / Math.max(1, columns));
      const x = 380 + column * 480;
      const y = 170 + row * 390 + (column % 2 ? 72 : 0);
      const branches = expanded.has(item.id)
        ? BRANCH_OFFSETS.map((offset, branchIndex) => ({
            index:branchIndex,
            x:x + offset.x,
            y:y + offset.y,
            path:curve({ x, y }, { x:x + offset.x, y:y + offset.y })
          }))
        : [];
      return { id:item.id, x, y, path:curve(root, { x, y }), branches };
    });
    return { width, height, root, nodes };
  }

  return { layout, curve };
})();

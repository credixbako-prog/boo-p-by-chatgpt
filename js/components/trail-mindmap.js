/** BOO-P — calcul déterministe de la carte radiale du Sentier. */
window.BT = window.BT || {};

BT.trailMindmap = (() => {
  'use strict';

  const COLORS = ['#d45a94', '#12a9cf', '#ef7a2d', '#4455b8', '#27a26d', '#d9a116', '#8a69b8', '#c6574f', '#4886a8', '#758d42', '#ae6b3d', '#6e7b91'];
  const DETAIL_OFFSETS = [-62, 0, 62];

  function curve(from, to) {
    const middle = from.x + (to.x - from.x) * .54;
    return `M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`;
  }

  function normalizedGroups(groups = []) {
    return groups.map((group, index) => ({
      id:String(group.id || `genre-${index}`),
      name:String(group.name || 'À classer'),
      color:group.color || COLORS[index % COLORS.length],
      books:Array.isArray(group.books) ? group.books : []
    })).filter(group => group.books.length);
  }

  function layout(groups = [], expandedIds = []) {
    const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds || []);
    const prepared = normalizedGroups(groups).map(group => ({ ...group, laneHeight:Math.max(280, group.books.length * 138 + 110) }));
    const sides = { left:[], right:[] };
    prepared.forEach((group, index) => sides[index % 2 ? 'left' : 'right'].push(group));
    const sideHeight = side => side.reduce((sum, group) => sum + group.laneHeight, 0);
    const height = Math.max(920, Math.max(sideHeight(sides.left), sideHeight(sides.right)) + 240);
    const width = 2360;
    const root = { x:width / 2, y:height / 2 };
    const genres = [];

    ['left','right'].forEach(sideName => {
      const sign = sideName === 'left' ? -1 : 1;
      const side = sides[sideName];
      const occupied = sideHeight(side);
      let cursor = (height - occupied) / 2;
      side.forEach(group => {
        const genreY = cursor + group.laneHeight / 2;
        const genre = { id:group.id, name:group.name, color:group.color, side:sideName, x:root.x + sign * 300, y:genreY, path:'', books:[] };
        genre.path = curve(root, genre);
        const bookCount = group.books.length;
        group.books.forEach((book, bookIndex) => {
          const y = genreY + (bookIndex - (bookCount - 1) / 2) * 138;
          const node = { id:book.id, genreId:genre.id, color:genre.color, side:sideName, x:root.x + sign * 660, y, path:'', branches:[] };
          node.path = curve(genre, node);
          if (expanded.has(book.id)) {
            node.branches = DETAIL_OFFSETS.map((offset, detailIndex) => {
              const detail = { index:detailIndex, x:root.x + sign * 1000, y:y + offset };
              return { ...detail, path:curve(node, detail) };
            });
          }
          genre.books.push(node);
        });
        genres.push(genre);
        cursor += group.laneHeight;
      });
    });
    genres.sort((a, b) => prepared.findIndex(group => group.id === a.id) - prepared.findIndex(group => group.id === b.id));
    return { width, height, root, genres, nodes:genres.flatMap(genre => genre.books) };
  }

  return { layout, curve, colors:COLORS.slice() };
})();

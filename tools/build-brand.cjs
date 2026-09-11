/* Regenerate the brand exports from the two approved vector masters.
 * Install sharp locally, or set SHARP_MODULE to an existing sharp module path. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ink = '#0F1B2D', paper = '#F2EDE3';
const symbol = read('assets/brand/boo-p-symbol.svg');
const wordmark = read('assets/brand/boo-p-wordmark.svg');
function svg(width, height, content, title = 'BOO-P') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${title}</title>${content}</svg>\n`;
}
function nest(source, x, y, width, height) {
  const viewBox = source.match(/viewBox="([^"]+)"/)[1];
  const content = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title[^>]*>[\s\S]*?<\/title>/g, '').replace(/[\t ]+$/gm, '').trim();
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}">${content}</svg>`;
}
function reverse(source) {
  return source.replace(/#0F1B2D|#F2EDE3|#6D8F7A/g, color => ({[ink]:paper,[paper]:ink,'#6D8F7A':'#A9C2B2'})[color]);
}
const horizontal = svg(600, 180, nest(symbol, 6, 6, 140, 164) + nest(wordmark, 172, 47, 414, 89));
const vertical = svg(800, 935, nest(symbol, 100, 20, 600, 703) + nest(wordmark, 100, 766, 600, 129));
const icon = svg(1024, 1024, `<path fill="${paper}" d="M0 0H1024V1024H0Z"/>` + nest(symbol, 182, 125, 660, 774));
const maskable = svg(1024, 1024, `<path fill="${paper}" d="M0 0H1024V1024H0Z"/>` + nest(symbol, 262, 219, 500, 586));
const share = svg(1200, 630, `<path fill="${paper}" d="M0 0H1200V630H0Z"/>` + nest(horizontal, 230, 126, 740, 222) + `<path stroke="#6D8F7A" stroke-width="2" d="M440 402H760"/><text x="600" y="470" text-anchor="middle" font-family="Georgia,serif" font-size="36" fill="${ink}">Chaque lecture laisse une trace.</text>`);
async function save(file, source, size) {
  const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive:true });
  if (file.endsWith('.svg')) fs.writeFileSync(target, source);
  else await sharp(Buffer.from(source)).resize(size).png().toFile(target);
}
async function main() {
  const variants = {
    'boo-p-horizontal':horizontal, 'boo-p-vertical':vertical,
    'boo-p-horizontal-reverse':reverse(horizontal), 'boo-p-symbol-reverse':reverse(symbol),
    'boo-p-monochrome':horizontal.replace(/#6D8F7A|#D28B3D/g, ink),
    'boo-p-logo':vertical, 'boo-p-app-icon':icon, 'boo-p-brand-board':share,
    'boo-p-share':share
  };
  for (const [name, source] of Object.entries(variants)) await save(`assets/brand/${name}.svg`, source);
  for (const name of ['boo-p-logo','boo-p-app-icon','boo-p-brand-board','boo-p-share']) await save(`assets/brand/${name}.png`, variants[name]);
  for (const size of [192,512,1024]) await save(`assets/icons/boo-p-icon-${size}.png`, icon, size);
  await save('assets/icons/boo-p-maskable-512.png', maskable, 512);
  await save('assets/icons/boo-p-apple-touch-icon.png', icon, 180);
  await save('assets/icons/boo-p-favicon.svg', icon);
  for (const size of [16,32]) await save(`assets/icons/boo-p-favicon-${size}.png`, icon, size);
  console.log('BOO-P: vector variants and raster exports regenerated.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

import { cp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist-mobile');
// Never clean a path provided by environment, command line or configuration.
if (path.dirname(output) !== root || path.basename(output) !== 'dist-mobile') throw new Error('Unsafe output path');
try { if (await realpath(output) !== output) throw new Error('Output must not be a symlink'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const directory of ['assets', 'css', 'js']) {
  await cp(path.join(root, directory), path.join(output, directory), { recursive: true, dereference: false });
}
const screen = 'stitch_designs/stitch_booktrail_app_design_system/la_clairi_re_accueil/screen.png';
await mkdir(path.dirname(path.join(output, screen)), { recursive: true });
await cp(path.join(root, screen), path.join(output, screen));
await cp(path.join(root, 'manifest.webmanifest'), path.join(output, 'manifest.webmanifest'));
await build({ entryPoints:[path.join(root, 'native/entry.mjs')], outfile:path.join(output, 'js/native-bundle.js'), bundle:true, format:'iife', platform:'browser', target:['chrome109', 'safari15'], minify:true, sourcemap:false, legalComments:'eof' });

const fontImports = [
  ...[300,400,500,600,700].map(weight => `@fontsource/poppins/latin-${weight}.css`),
  ...[400,500,600,700].flatMap(weight => [`@fontsource/playfair-display/latin-${weight}.css`, `@fontsource/playfair-display/latin-${weight}-italic.css`]),
  ...[400,500,600].map(weight => `@fontsource/ibm-plex-mono/latin-${weight}.css`)
];
await build({ stdin:{ contents:fontImports.map(font => `@import "${font}";`).join('\n'), resolveDir:root, loader:'css' }, outfile:path.join(output, 'css/native-fonts.css'), bundle:true, loader:{'.woff2':'file', '.woff':'file'}, assetNames:'../assets/fonts/[name]-[hash]', minify:true });

const cdnScript = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"\s]+"[^>]*><\/script>/;
for (const page of ['index.html','app.html','onboarding.html']) {
  let html = await readFile(path.join(root, page), 'utf8');
  if (!cdnScript.test(html)) throw new Error(`Supabase boot script missing in ${page}`);
  html = html.replace(cdnScript, '<script src="js/native-bundle.js"></script>');
  html = html.replace(/<link[^>]+href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
  html = html.replace('</head>', '<link rel="stylesheet" href="css/native-fonts.css">\n</head>');
  html = html.replace(/(<meta name="viewport" content=")([^"]+)(")/, '$1$2, viewport-fit=cover$3');
  await writeFile(path.join(output, page), html);
}
await mkdir(path.join(output, 'licenses'), { recursive: true });
for (const font of ['poppins','playfair-display','ibm-plex-mono']) {
  await cp(path.join(root,'node_modules/@fontsource',font,'LICENSE'), path.join(output,'licenses',`${font}.txt`));
}
console.log('BOO-P mobile: local pages, Supabase runtime, native bridge and fonts prepared in dist-mobile.');

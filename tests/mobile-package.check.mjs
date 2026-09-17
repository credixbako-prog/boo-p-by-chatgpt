import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root,'dist-mobile');

test('paquet mobile : uniquement les fichiers publics autorisés, sans serveur, dépendances ni secrets', async () => {
  assert.deepEqual((await readdir(output)).sort(), ['app.html','assets','css','index.html','js','licenses','manifest.webmanifest','onboarding.html','stitch_designs'].sort());
  const config = JSON.parse(await readFile(path.join(root,'capacitor.config.json'),'utf8'));
  assert.equal(config.webDir,'dist-mobile');
  assert.equal(config.server?.url,undefined);
  assert.equal(config.server?.allowNavigation,undefined);
  assert.equal(config.android.allowMixedContent,false);
  assert.equal(config.loggingBehavior,'debug');
});
test('paquet mobile : démarrage local, pont avant auth, polices et références embarquées présentes', async () => {
  for (const page of ['index.html','app.html','onboarding.html']) {
    const html = await readFile(path.join(output,page),'utf8');
    assert.ok(html.indexOf('js/native-bundle.js') < html.indexOf('js/auth.js'));
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net.*supabase|fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.match(html, /viewport-fit=cover/);
    for (const [,relative] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(?:https?:|mailto:|data:)/.test(relative)) continue;
      const file = path.join(output,relative.split(/[?#]/)[0]);
      assert.ok((await stat(file)).isFile(),`${page}: missing ${relative}`);
    }
  }
  const fontCSS = await readFile(path.join(output,'css/native-fonts.css'),'utf8');
  for (const [,ref] of fontCSS.matchAll(/url\(([^)]+)\)/g)) {
    assert.ok((await stat(path.resolve(output,'css',ref.replace(/["']/g,'')))).isFile());
  }
});
test('projets mobiles : identité cohérente, permissions caméra/micro explicites et icône Apple opaque', async () => {
  const android = await readFile(path.join(root,'android/app/build.gradle'),'utf8');
  assert.match(android,/applicationId "fr\.boop\.app"/);
  assert.match(android,/versionName "0\.1\.0"/);
  const manifest = await readFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.match(manifest,/android:allowBackup="false"/);
  assert.match(manifest,/android\.permission\.CAMERA/);
  assert.match(manifest,/android\.permission\.RECORD_AUDIO/);
  const plist = await readFile(path.join(root,'ios/App/App/Info.plist'),'utf8');
  assert.match(plist,/NSCameraUsageDescription/);
  assert.match(plist,/NSMicrophoneUsageDescription/);
  const icon = await readFile(path.join(root,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
  assert.equal(icon.readUInt32BE(16),1024); assert.equal(icon.readUInt32BE(20),1024);
  assert.equal(icon[25],2,'Apple icon must use RGB, without an alpha channel');
});

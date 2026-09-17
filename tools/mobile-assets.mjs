import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icon = path.join(root, 'assets/icons/boo-p-icon-1024.png');
const maskable = path.join(root, 'assets/icons/boo-p-maskable-512.png');
const cream = '#F2EDE3';
const android = path.join(root, 'android/app/src/main/res');
for (const [density, size] of Object.entries({ mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192 })) {
  const folder = path.join(android, `mipmap-${density}`);
  await mkdir(folder, { recursive:true });
  for (const name of ['ic_launcher.png','ic_launcher_round.png']) await sharp(icon).resize(size,size).flatten({background:cream}).png().toFile(path.join(folder,name));
  await sharp(maskable).resize(Math.round(size*2.25),Math.round(size*2.25)).png().toFile(path.join(folder,'ic_launcher_foreground.png'));
}
await writeFile(path.join(android,'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#F2EDE3</color></resources>\n');
await sharp(icon).resize(1024,1024).flatten({background:cream}).png().toFile(path.join(root,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
const mark = await sharp(icon).resize(420,420).png().toBuffer();
const splash = await sharp({create:{width:2732,height:2732,channels:3,background:cream}}).composite([{input:mark,gravity:'centre'}]).png().toBuffer();
for (const name of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png']) {
  await writeFile(path.join(root,'ios/App/App/Assets.xcassets/Splash.imageset',name),splash);
}
// Android's modern splash screen uses the application icon on the brand colour.
await writeFile(path.join(android,'drawable/splash.xml'), '<?xml version="1.0" encoding="utf-8"?><layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:drawable="@color/ic_launcher_background"/></layer-list>\n');
console.log('BOO-P native icons and launch screens generated from the existing brand assets.');

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import * as supabase from '@supabase/supabase-js';

// Loaded synchronously before auth.js on all three packaged pages.
window.supabase = supabase;
window.BT = window.BT || {};
window.BT.native = Object.freeze({
  isNative: Capacitor.isNativePlatform(),
  publicAppUrl: 'https://credixbako-prog.github.io/boo-p-by-chatgpt/'
});

if (BT.native.isNative) {
  document.documentElement.classList.add('boop-native');
  App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new Event(isActive ? 'boop:native-resumed' : 'boop:native-paused'));
  }).catch(() => {});
  App.addListener('backButton', ({ canGoBack }) => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (dialog) {
      if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
      return;
    }
    const isHome = location.pathname.endsWith('/app.html') && ['', '#home'].includes(location.hash);
    if (canGoBack && !isHome) history.back();
    else void App.minimizeApp();
  }).catch(() => {});
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.hasAttribute('download') || event.defaultPrevented) return;
    const url = new URL(anchor.href, location.href);
    if (['https:', 'http:'].includes(url.protocol) && url.origin !== location.origin) {
      event.preventDefault();
      void Browser.open({ url: url.href }).catch(() => {
        const notice = document.querySelector('[role="status"]');
        if (notice) notice.textContent = 'Ce lien ne peut pas être ouvert pour le moment.';
      });
    }
  });
}

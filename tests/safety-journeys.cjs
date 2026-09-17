/** Isolated UI journeys: every Supabase request is intercepted; no real account or report. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : {}) });
  try {
    fs.mkdirSync('.tmp/safety-review', { recursive:true });
    const context = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, serviceWorkers:'block' });
    let resumedSession = false;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['127.0.0.1','localhost'].includes(url.hostname)) return route.continue();
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('supabase')) return route.fulfill({ contentType:'application/javascript', body:`window.safetyRpcCalls=[];window.supabase={createClient:()=>({auth:{onAuthStateChange(fn){window.safetyAuthHandler=fn;},getSession:async()=>({data:{session:${resumedSession ? JSON.stringify({ user:{ id:'33333333-3333-4333-8333-333333333333', email:'resume@example.test' } }) : 'null'}}}),signOut:async()=>{window.safetyAuthHandler('SIGNED_OUT',null);return{};}},rpc:async name=>{safetyRpcCalls.push(name);return{data:name==='get_boop_account_deletion_status'?${resumedSession}:[]};},functions:{invoke:async()=>({data:{deleted:true}})},from(){const q=new Proxy({},{get:(t,k)=>k==='then'?(resolve)=>resolve({data:[],error:null}):()=>q});return q;}})};` });
      if (url.hostname.endsWith('.supabase.co')) return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
      return route.abort();
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', dialog => dialog.accept());
    page.setDefaultTimeout(8000);
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.goto((process.env.BOOP_TEST_URL || 'http://127.0.0.1:8766') + '/app.html?guest=1#profile');
    await page.locator('[data-action=erase-local-data]').waitFor();
    assert.equal(await page.locator('[data-action=delete-account]').count(), 0, 'Guest cannot delete an account');
    await page.locator('[data-action=erase-local-data]').click();
    await page.locator('#app-dialog').getByText(/Cette action ne supprime pas le compte distant/).waitFor();
    await page.locator('#app-dialog [data-action=close-dialog]').first().click();

    await page.evaluate(() => {
      const owner = '11111111-1111-4111-8111-111111111111', reader = '22222222-2222-4222-8222-222222222222';
      const friend = { id:reader, name:'Camille Martin', handle:'@camille', initials:'CM', isRemote:true, profileVisibility:'public', friendState:'friend' };
      window.safetyTest = { owner, reader, friend, blocked:new Set(), report:'error', block:'error', unblock:'error', deletion:'error', calls:[], finishDelete:null };
      document.body.dataset.authMode = document.documentElement.dataset.authMode = 'account';
      document.getElementById('guest-banner').hidden = true;
      BT.auth.isGuest = () => false; BT.auth.isAuthenticated = () => !!safetyTest.owner;
      BT.auth.getCurrentUser = () => safetyTest.owner ? { id:safetyTest.owner, name:'Alex', email:'alex@example.test' } : null;
      BT.auth.ready = async () => BT.auth.getCurrentUser();
      BT.auth.deleteAccount = async payload => {
        safetyTest.calls.push({ action:'delete', confirmation:payload.confirmation, hasPassword:!!payload.password });
        if (safetyTest.deletion === 'error') throw Error('Mot de passe actuel incorrect.');
        return new Promise(resolve => { safetyTest.finishDelete = () => { safetyTest.owner = null; resolve({ deleted:true, userId:owner }); }; });
      };
      BT.userDataSync = null;
      BT.community.listPosts = BT.community.listClubs = BT.community.listSalons = async () => [];
      BT.community.searchReaders = async () => safetyTest.blocked.has(reader) ? [] : [friend];
      BT.notifications.list = async () => [];
      BT.communitySafety = {
        loadBlockedUsers:async () => [...safetyTest.blocked],
        reportUser:async (id, payload) => { safetyTest.calls.push({ action:'report', id, payload }); if (safetyTest.report === 'error') throw Error('Signalement non enregistré. Réessayez.'); },
        blockUser:async id => { safetyTest.calls.push({ action:'block', id }); if (safetyTest.block === 'error') throw Error('Blocage non enregistré. Réessayez.'); safetyTest.blocked.add(id); friend.friendState = 'none'; },
        unblockUser:async id => { safetyTest.calls.push({ action:'unblock', id }); if (safetyTest.unblock === 'error') throw Error('Déblocage non enregistré. Réessayez.'); safetyTest.blocked.delete(id); }
      };
      BT.store.useUser(owner);
      BT.store.saveProfile({ name:'Alex', email:'alex@example.test' });
      BT.store.mergeRemoteUsers([friend]);
      BT.store.consumeBadgeCelebrations();
      location.hash = '#community?tab=friends';
    });
    const target = page.locator('.friend-card').filter({ hasText:'Camille Martin' });
    await target.waitFor();
    await target.locator('.safety-menu > summary').click();
    await target.getByRole('button', { name:'Signaler', exact:true }).click();
    const report = page.locator('#app-dialog form[data-form=report]');
    await report.locator('[name=reason]').selectOption({ label:'Spam ou publicité' });
    await report.locator('[name=details]').fill('Exemple réservé au test local.');
    await report.getByRole('button', { name:'Envoyer le signalement' }).click();
    await report.getByText('Signalement non enregistré. Réessayez.', { exact:true }).waitFor();
    await page.screenshot({ path:'.tmp/safety-review/report-error-mobile.png' });
    await page.evaluate(() => safetyTest.report = 'success');
    await report.getByRole('button', { name:'Envoyer le signalement' }).click();
    await report.getByText(/Votre signalement a été enregistré pour examen/).waitFor();
    await report.getByRole('button', { name:'Fermer', exact:true }).click();
    if (!await target.locator('.safety-menu').evaluate(details => details.open)) await target.locator('.safety-menu > summary').click();
    await target.getByRole('button', { name:'Bloquer', exact:true }).click();
    await page.locator('#toast').getByText('Blocage non enregistré. Réessayez.', { exact:true }).waitFor();
    assert.equal(await page.evaluate(() => BT.store.getSettings().blockedUsers.length), 0);
    await page.evaluate(() => safetyTest.block = 'success');
    await target.getByRole('button', { name:'Bloquer', exact:true }).click();
    await page.waitForFunction(() => BT.store.getSettings().blockedUsers.includes(safetyTest.reader));
    assert.equal(await page.locator('.friend-card').filter({ hasText:'Camille Martin' }).count(), 0);
    await page.evaluate(() => location.hash = '#profile');
    let blocked = page.locator('.setting-card').filter({ has:page.locator('summary').filter({ hasText:'Utilisateurs bloqués' }) });
    await blocked.locator('summary').click();
    await blocked.getByRole('button', { name:'Débloquer', exact:true }).click();
    await page.locator('#toast').getByText('Déblocage non enregistré. Réessayez.', { exact:true }).waitFor();
    assert.equal(await page.evaluate(() => BT.store.getSettings().blockedUsers.length), 1);
    await page.screenshot({ path:'.tmp/safety-review/blocked-mobile.png' });
    await page.evaluate(() => safetyTest.unblock = 'success');
    await blocked.getByRole('button', { name:'Débloquer', exact:true }).click();
    await page.waitForFunction(() => BT.store.getSettings().blockedUsers.length === 0);
    assert.equal(await page.evaluate(() => BT.store.getCommunity().users.find(u => u.id === safetyTest.reader).friendState), 'none');
    await page.evaluate(() => { safetyTest.blocked.add(safetyTest.reader); window.dispatchEvent(new Event('online')); });
    await page.waitForFunction(() => BT.store.getSettings().blockedUsers.includes(safetyTest.reader));

    await page.locator('[data-action=delete-account]').click();
    const deletion = page.locator('#app-dialog form[data-form=delete-account]');
    await deletion.locator('[name=confirmation]').fill('SUPPRIMER');
    await deletion.getByRole('button', { name:'Supprimer définitivement mon compte' }).click();
    assert.equal(await page.evaluate(() => safetyTest.calls.filter(c => c.action === 'delete').length), 0, 'Password is required');
    await deletion.locator('[name=password]').fill('fake-current-password');
    await deletion.getByRole('button', { name:'Supprimer définitivement mon compte' }).click();
    await deletion.getByText('Mot de passe actuel incorrect.', { exact:true }).waitFor();
    assert.ok(await page.evaluate(() => localStorage.getItem('boop_mvp_v5:' + safetyTest.owner)), 'Local data survives failure');
    await page.screenshot({ path:'.tmp/safety-review/deletion-error-mobile.png' });
    await page.setViewportSize({ width:1365, height:950 });
    await page.screenshot({ path:'.tmp/safety-review/deletion-desktop.png' });
    await page.setViewportSize({ width:320, height:844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at 320px');
    await page.evaluate(() => safetyTest.deletion = 'pending');
    await deletion.getByRole('button', { name:'Supprimer définitivement mon compte' }).click();
    await page.waitForFunction(() => typeof safetyTest.finishDelete === 'function');
    assert.equal(await deletion.locator('[type=submit]').isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#app-dialog').evaluate(dialog => dialog.open), true, 'Deletion stays visible while pending');
    await page.screenshot({ path:'.tmp/safety-review/deletion-pending-mobile.png' });
    await page.evaluate(() => safetyTest.finishDelete());
    await page.waitForURL('**/index.html?reason=account-deleted');
    assert.equal(await page.evaluate(() => localStorage.getItem('boop_mvp_v5:11111111-1111-4111-8111-111111111111')), null);
    resumedSession = true;
    await page.evaluate(() => sessionStorage.removeItem('boop_guest_mode_v1'));
    await page.goto((process.env.BOOP_TEST_URL || 'http://127.0.0.1:8766') + '/app.html#profile');
    await deletion.getByText(/La suppression de votre compte a déjà commencé/).waitFor();
    assert.equal(await page.evaluate(() => BT.auth.getDeletionState()), true);
    assert.equal(await page.evaluate(() => safetyRpcCalls.some(name => ['read_personal_snapshot','merge_personal_snapshot'].includes(name))), false, 'No personal sync for pending deletion');
    await page.screenshot({ path:'.tmp/safety-review/deletion-resume-mobile.png' });
    await deletion.locator('[name=password]').fill('fake-current-password');
    await deletion.locator('[name=confirmation]').fill('SUPPRIMER');
    await deletion.getByRole('button', { name:'Supprimer définitivement mon compte' }).click();
    await page.waitForURL('**/index.html?reason=account-deleted');
    assert.deepEqual(errors, []);
    console.log('PASS: guest isolation, local erasure wording, report retry, block/unblock failure and success, server block hydration, password validation, deletion pending/failure/success and resume after reload without sync, mobile and desktop layouts; no real Supabase requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

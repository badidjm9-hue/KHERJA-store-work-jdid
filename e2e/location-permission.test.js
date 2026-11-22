// Location permission flows (rider + driver). Run: node --require ./e2e/_kj-loc-seen.js --test e2e/location-permission.test.js
// SCOPE: these run in desktop Chromium. The native iOS/Android permission dialogs are NOT exercised here: the Capacitor
// bridge is replaced by a stub (window.Capacitor) that reports the same permission states the real plugin does, so what is
// verified is KHERJA's own flow logic (sheet, no re-prompt, manual fallback, settings button). Real-device checks remain separate.
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function account(base, phone, role, name, driver) {
  const post = (p, b, ck) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: JSON.stringify(b) });
  await post('/api/auth/otp', { phone }); const v = await post('/api/auth/verify', { phone, code: '123456', role });
  const sid = /sid=([^;]+)/.exec(v.headers.get('set-cookie'))[1], ck = 'sid=' + sid;
  await post('/api/me', { name }, ck); if (driver) await post('/api/driver/profile', { name, car: 'Dacia Logan', plate: 'LP-' + phone.slice(-4) }, ck);
  return sid;
}
async function withApp(fn) {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port, ctxs = [];
  const open = async (route, sid, { geo, native, lang } = {}) => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); ctxs.push(c);
    await c.addInitScript(() => { try { if (!sessionStorage.getItem('__fresh')) { localStorage.removeItem('kj.loc.rationale'); sessionStorage.setItem('__fresh', '1'); } } catch (e) {} }); // fresh install, once per tab (runs after the suite preload)
    if (lang) await c.addInitScript(l => { try { localStorage.setItem('kj.lang', l); } catch (e) {} }, lang);
    if (geo) { await c.grantPermissions(['geolocation']); await c.setGeolocation({ latitude: 36.7538, longitude: 3.0588 }); }
    if (native) await c.addInitScript(stub, native);
    await c.addCookies([{ name: 'sid', value: sid, url: base }]);
    const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(base + route); return { c, p };
  };
  try { await fn({ srv, base, open }); } finally { for (const c of ctxs) await c.close(); await new Promise(r => srv.close(r)); }
}
// Capacitor stub: cfg = { platform, perm: 'prompt'|'granted'|'denied'|'coarse', grantOnRequest, positionError, lat, lng }
function stub(cfg) {
  const st = { perm: cfg.perm, requests: 0, positions: 0, settingsOpened: [], cfg };
  window.__loc = st;
  const map = () => st.perm === 'granted' ? { location: 'granted', coarseLocation: 'granted' } : st.perm === 'coarse' ? { location: 'denied', coarseLocation: 'granted' }
    : st.perm === 'denied' ? { location: 'denied', coarseLocation: 'denied' } : { location: 'prompt', coarseLocation: 'prompt' };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => cfg.platform || 'android', Plugins: {
    Geolocation: {
      checkPermissions: async () => map(),
      requestPermissions: async () => { st.requests++; if (cfg.grantOnRequest) st.perm = cfg.grantOnRequest; else st.perm = 'denied'; return map(); },
      getCurrentPosition: async () => { st.positions++; if (st.perm === 'denied' || st.perm === 'prompt') throw new Error('Location permission was denied');
        if (cfg.positionError) throw new Error(cfg.positionError); return { coords: { latitude: cfg.lat || 36.7538, longitude: cfg.lng || 3.0588, accuracy: st.perm === 'coarse' ? 3500 : 12 } }; } },
    NativeSettings: { open: async o => { st.settingsOpened.push(o); } } } };
}
const sheetTitle = p => p.locator('.kjl-ov .kjl-h');

test('fresh install (rider): explanation sheet first, no OS prompt; "choose manually" keeps pickup usable and is not shown again', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010001', 'rider', 'Amine');
    const { p } = await open('/app', sid, { native: { platform: 'android', perm: 'prompt' } });
    await sheetTitle(p).waitFor({ timeout: 6000 });
    assert.equal(await sheetTitle(p).innerText(), 'نحددو موقعك');
    assert.match(await p.locator('.kjl-p').innerText(), /باش نحددو موقعك بدقة ونلقاو لك السائقين القريبين/);
    assert.equal(await p.evaluate(() => window.__loc.requests), 0, 'OS permission is not requested before the user agrees');
    await p.getByRole('button', { name: 'نختار يدوياً' }).click();
    assert.equal(await p.locator('.kjl-ov').count(), 0);
    assert.equal(await p.evaluate(() => window.__loc.requests), 0, 'declining the explanation never triggers the OS dialog');
    await p.locator('#kj-area').selectOption({ index: 1 });
    assert.match(await p.locator('#map-from').inputValue(), /الجزائر الوسطى/, 'manual pickup works without permission');
    await p.reload(); await p.waitForTimeout(1200);
    assert.equal(await p.locator('.kjl-ov').count(), 0, 'the explanation is not repeated on the next launch');
    assert.deepEqual(p.errs, []);
  });
});

test('fresh install (rider) French wording', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010002', 'rider', 'Amine'); await fetch(base + '/api/me', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'sid=' + sid }, body: JSON.stringify({ lang: 'fr' }) });
    const { p } = await open('/app', sid, { native: { platform: 'ios', perm: 'prompt' } });
    await p.waitForFunction(() => document.documentElement.lang === 'fr'); await sheetTitle(p).waitFor({ timeout: 6000 });
    assert.equal(await sheetTitle(p).innerText(), 'Utiliser votre position');
    assert.match(await p.locator('.kjl-p').innerText(), /choisir votre point de départ manuellement/);
  });
});

test('allow: OS permission requested only after the sheet, current position becomes the pickup', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010003', 'rider', 'Amine');
    const { p } = await open('/app', sid, { native: { platform: 'ios', perm: 'prompt', grantOnRequest: 'granted', lat: 36.7408, lng: 3.1006 } });
    await sheetTitle(p).waitFor({ timeout: 6000 });
    await p.getByRole('button', { name: 'السماح بالموقع' }).click();
    await p.waitForFunction(() => window.__loc.positions > 0);
    assert.equal(await p.evaluate(() => window.__loc.requests), 1);
    await p.waitForFunction(() => document.querySelector('#map-from').value === 'موقعي الحالي');
    assert.equal(await p.evaluate(() => JSON.stringify([routePoints.pickup.lat, routePoints.pickup.lng])), '[36.7408,3.1006]');
  });
});

test('approximate-only grant (Android 12+): works and tells the user the position is approximate', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010004', 'rider', 'Amine');
    const { p } = await open('/app', sid, { native: { platform: 'android', perm: 'coarse' } });
    await p.waitForFunction(() => document.querySelector('#map-from').value === 'موقعي الحالي', null, { timeout: 8000 });
    await p.locator('.toast, #toast').first().waitFor({ timeout: 3000 }).catch(() => {});
    assert.equal(await p.locator('.kjl-ov').count(), 0, 'no sheet when approximate permission is already granted');
    assert.ok(await p.evaluate(() => /تقريبي/.test(document.body.innerText)), 'approximate-location notice is shown');
  });
});

test('denied: no automatic re-prompt, denied sheet only on tap, settings button opens app settings, manual pickup still works', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010005', 'rider', 'Amine');
    const { p } = await open('/app', sid, { native: { platform: 'android', perm: 'denied' } });
    await p.waitForTimeout(1500);
    assert.equal(await p.locator('.kjl-ov').count(), 0, 'no sheet and no prompt at start-up after a denial');
    assert.equal(await p.evaluate(() => window.__loc.requests), 0);
    await p.locator('#my-location').click();
    await sheetTitle(p).waitFor(); assert.equal(await sheetTitle(p).innerText(), 'الموقع غير مفعّل');
    await p.getByRole('button', { name: 'فتح الإعدادات' }).click();
    assert.deepEqual(await p.evaluate(() => window.__loc.settingsOpened), [{ optionAndroid: 'application_details', optionIOS: 'app' }]);
    assert.equal(await p.evaluate(() => window.__loc.requests), 0, 'tapping never re-requests a permission the OS will not show again');
    await p.locator('#my-location').click(); await p.getByRole('button', { name: 'نختار يدوياً' }).click();
    await p.locator('#kj-area').selectOption({ index: 2 }); assert.match(await p.locator('#map-from').inputValue(), /باب الوادي/);
  });
});

test('revoked from Settings while the app is used: next read reports denied, no crash, manual pickup remains', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010006', 'rider', 'Amine');
    const { p } = await open('/app', sid, { native: { platform: 'ios', perm: 'granted' } });
    await p.waitForFunction(() => document.querySelector('#map-from').value === 'موقعي الحالي');
    await p.evaluate(() => { window.__loc.perm = 'denied'; });
    await p.locator('#my-location').click(); await sheetTitle(p).waitFor();
    assert.equal(await sheetTitle(p).innerText(), 'الموقع غير مفعّل');
    assert.match(await p.locator('.kjl-f').innerText(), /الإعدادات/, 'iOS path hint is shown');
    assert.deepEqual(p.errs, []);
  });
});

test('GPS / location services off and location unavailable: explained, retry offered, manual fallback offered', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010007', 'rider', 'Amine');
    const off = await open('/app', sid, { native: { platform: 'android', perm: 'granted', positionError: 'Location services are not enabled' } });
    await off.p.locator('#my-location').click(); await sheetTitle(off.p).waitFor(); assert.equal(await sheetTitle(off.p).innerText(), 'خدمة الموقع (GPS) مطفية');
    await off.p.getByRole('button', { name: 'فتح الإعدادات' }).click();
    assert.deepEqual(await off.p.evaluate(() => window.__loc.settingsOpened), [{ optionAndroid: 'location', optionIOS: 'app' }], 'opens the system location switch');
    const un = await open('/app', await account(base, '0555010008', 'rider', 'Amine'), { native: { platform: 'android', perm: 'granted', positionError: 'Location unavailable' } });
    await un.p.locator('#my-location').click(); await sheetTitle(un.p).waitFor(); assert.equal(await sheetTitle(un.p).innerText(), 'تعذّر تحديد موقعك');
    await un.p.getByRole('button', { name: 'إعادة المحاولة' }).waitFor(); await un.p.getByRole('button', { name: 'نختار يدوياً' }).waitFor();
  });
});

test('web (Chromium geolocation granted): current location detected and used as pickup with no sheet', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0555010009', 'rider', 'Amine');
    const { p } = await open('/app', sid, { geo: true });
    await p.waitForFunction(() => document.querySelector('#map-from').value === 'موقعي الحالي', null, { timeout: 8000 });
    assert.equal(await p.locator('.kjl-ov').count(), 0);
  });
});

test('driver: going online shows the online-only explanation and without permission the driver stays offline (no manual option)', async () => {
  await withApp(async ({ base, open }) => {
    const sid = await account(base, '0666010010', 'driver', 'Karim', true);
    const { p } = await open('/app/driver', sid, { native: { platform: 'android', perm: 'prompt' } });
    await p.getByRole('button', { name: 'الرئيسية' }).click(); await p.getByRole('switch').click(); await sheetTitle(p).waitFor();
    assert.match(await p.locator('.kjl-p').innerText(), /موقعك ما يتشاركش كي تولي غير متصل/);
    assert.equal(await p.evaluate(() => window.__loc.requests), 0);
    await p.getByRole('button', { name: 'إغلاق' }).click();
    assert.equal(await p.getByRole('switch').getAttribute('aria-checked'), 'false');
  });
});

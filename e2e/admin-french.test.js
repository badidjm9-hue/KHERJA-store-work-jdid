// Admin legacy views (drivers, driver detail, rides, ride detail, reports) in French: no Arabic UI text left, real API actions still work.
// Run: node --test e2e/admin-french.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright'); const { createApp } = require('../backend/server');
const AR = /[؀-ۿ]/;
test('admin in French: legacy views fully translated, report status change and driver suspension hit the real API', async () => {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port; const browser = await chromium.launch(); const errs = [];
  const call = async (ck, m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { r, j }; };
  const acct = async (ph, role, name) => { await call(null, 'POST', '/api/auth/otp', { phone: ph }); const v = await call(null, 'POST', '/api/auth/verify', { phone: ph, code: '123456', role }); const ck = 'sid=' + /sid=([^;]+)/.exec(v.r.headers.get('set-cookie'))[1]; await call(ck, 'POST', '/api/me', { name }); return ck; };
  try {
    const rider = await acct('0555000401', 'rider', 'Karim'), drv = await acct('0555000402', 'driver', 'Ethan');
    await call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '1234-111-16' }); await call(drv, 'POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
    const rq = await call(rider, 'POST', '/api/requests', { pickup: { lat: 36.75, lng: 3.05, label: 'Bab Ezzouar' }, dropoff: { lat: 36.69, lng: 3.21, label: 'Aeroport' }, price: 450 });
    const of = await call(drv, 'POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); const ac = await call(rider, 'POST', `/api/offers/${of.j.id}/accept`);
    for (const s of ['arrived', 'in_progress', 'completed']) await call(drv, 'POST', `/api/rides/${ac.j.ride_id}/status`, { status: s });
    await call(rider, 'POST', `/api/rides/${ac.j.ride_id}/report`, { kind: 'safety', body: 'test body' });
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await c.addInitScript(() => { try { localStorage.setItem('kherja-admin-lang', 'fr'); } catch {} });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); await p.goto(base + '/admin');
    await p.fill('#l-phone', '0550000000'); await p.fill('#l-pass', 'admin-dev-pass'); await p.click('#l-go'); await p.locator('[data-nav]').first().waitFor();
    const chk = async (hash, must) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForFunction(m => document.querySelector('#main').innerText.includes(m), must); const txt = await p.locator('#main').innerText(); assert.equal(AR.test(txt), false, hash + ' still has Arabic: ' + txt.match(/.{0,20}[؀-ۿ]+.{0,20}/)); return txt; };
    await chk('#/drivers/all', 'Ethan');
    await p.locator('#main [data-open]').first().click(); await p.waitForSelector('#susp'); assert.equal(AR.test(await p.locator('#main').innerText()), false, 'driver detail has Arabic');
    p.once('dialog', d => d.accept()); await p.click('#susp'); await p.waitForFunction(() => /Lever la suspension/.test(document.querySelector('#main').innerText));
    assert.equal(srv.db.prepare('select suspended s from drivers').get().s, 1);
    await chk('#/rides', 'Bab Ezzouar'); await p.locator('#main [data-open]').first().click(); await p.waitForFunction(() => /Prix convenu/.test(document.querySelector('#main').innerText)); assert.equal(AR.test(await p.locator('#main').innerText()), false, 'ride detail has Arabic');
    await chk('#/reports', 'test body'); await p.selectOption('[data-rep]', 'closed'); await p.waitForTimeout(600); assert.equal(srv.db.prepare('select status from reports').get().status, 'closed');
    assert.equal((await call(rider, 'GET', '/api/notifications')).j.notifications[0].kind, 'report_status');
    assert.deepEqual(errs, []);
  } finally { await browser.close(); await new Promise(r => srv.close(r)); }
});

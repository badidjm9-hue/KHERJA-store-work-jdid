// Driver extra screens: activity+earnings, notifications, contacts, settings, report. Real API behavior is asserted for each.
// Run: node --test e2e/driver-screens.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');
let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });
async function withApp(fn) {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port; const errs = []; const ctxs = [];
  const call = async (ck, m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { r, j }; };
  const account = async (phone, role, name) => { await call(null, 'POST', '/api/auth/otp', { phone }); const v = await call(null, 'POST', '/api/auth/verify', { phone, code: '123456', role }); const ck = 'sid=' + /sid=([^;]+)/.exec(v.r.headers.get('set-cookie'))[1]; await call(ck, 'POST', '/api/me', { name }); return ck; };
  const page = async (ck, { width = 390 } = {}) => { const c = await browser.newContext({ viewport: { width, height: 844 } }); ctxs.push(c); await c.addCookies([{ name: 'sid', value: ck.slice(4), url: base }]);
    const pg = await c.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); await pg.goto(base + '/app/driver'); await pg.waitForSelector('.tabbar [data-tab=account]'); await pg.locator('.tabbar [data-tab=account]').click(); return pg; };
  try { await fn({ call, account, page, errs }); assert.deepEqual(errs, [], 'no page or console errors'); } finally { for (const c of ctxs) await c.close(); await new Promise(r => srv.close(r)); }
}
async function ride({ call, account }, done) {
  const rider = await account('0555000201', 'rider', 'Karim'), drv = await account('0555000202', 'driver', 'Ethan');
  await call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '1234-111-16' }); await call(drv, 'POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
  const rq = await call(rider, 'POST', '/api/requests', { pickup: { lat: 36.75, lng: 3.05, label: 'Bab Ezzouar' }, dropoff: { lat: 36.69, lng: 3.21, label: 'Aéroport' }, price: 450 });
  const of = await call(drv, 'POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); const ac = await call(rider, 'POST', `/api/offers/${of.j.id}/accept`);
  if (done) for (const s of ['arrived', 'in_progress', 'completed']) await call(drv, 'POST', `/api/rides/${ac.j.ride_id}/status`, { status: s });
  return { rider, drv, rideId: ac.j.ride_id };
}
test('activity: earnings come from /api/driver/earnings and the ride list from /api/rides', async () => {
  await withApp(async ctx => { const { drv } = await ride(ctx, true); const p = await ctx.page(drv);
    await p.locator('#dm-menu [data-dm=dm-act]').click(); await p.waitForSelector('#dm-hist .dm-row'); assert.match(await p.locator('#dm-earn').innerText(), /500/);
    assert.match(await p.locator('#dm-hist').innerText(), /Bab Ezzouar/); assert.equal((await ctx.call(drv, 'GET', '/api/driver/earnings')).j.all.total, 500);
    await p.locator('#dm-act [data-dmback]').click(); await p.waitForSelector('#s-account.on'); });
});
test('activity: honest empty state for a driver with no rides', async () => {
  await withApp(async ctx => { const drv = await ctx.account('0555000211', 'driver', 'Neo'); await ctx.call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '2-111-16' }); const p = await ctx.page(drv);
    await p.locator('#dm-menu [data-dm=dm-act]').click(); await p.waitForSelector('#dm-hist .dm-st'); assert.equal(await p.locator('#dm-hist .dm-row').count(), 0); assert.match(await p.locator('#dm-earn').innerText(), /0/); });
});
test('notifications: real event shown, mark-all-read persists server side', async () => {
  await withApp(async ctx => { const { drv } = await ride(ctx, false); const p = await ctx.page(drv);
    await p.locator('#dm-menu [data-dm=dm-notif]').click(); await p.waitForSelector('#dm-n-list .dm-row.unread'); assert.equal(await p.locator('#dm-n-list .dm-row').count(), 1);
    await p.locator('#dm-n-all').click(); await p.waitForFunction(() => !document.querySelector('#dm-n-list .unread')); assert.equal((await ctx.call(drv, 'GET', '/api/notifications')).j.unread, 0); });
});
test('contacts: API rejects bad phone, valid contact persists with tel:/sms: links only', async () => {
  await withApp(async ctx => { const drv = await ctx.account('0555000221', 'driver', 'Neo'); await ctx.call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '3-111-16' }); const p = await ctx.page(drv);
    await p.locator('#dm-menu [data-dm=dm-cont]').click(); await p.waitForSelector('#dm-c-list .dm-st');
    await p.locator('#dm-c-name').fill('Frère'); await p.locator('#dm-c-phone').fill('123'); await p.locator('#dm-c-form [type=submit]').click(); await p.waitForFunction(() => document.querySelector('#dm-c-err').textContent.length > 0);
    await p.locator('#dm-c-phone').fill('0787654321'); await p.locator('#dm-c-form [type=submit]').click(); await p.waitForSelector('#dm-c-list .dm-row');
    assert.equal((await ctx.call(drv, 'GET', '/api/safety/contacts')).j.contacts.length, 1); assert.match(await p.locator('#dm-c-list a').first().getAttribute('href'), /^tel:/); assert.match(await p.locator('#dm-c-list a').nth(1).getAttribute('href'), /^sms:/); });
});
test('settings: language is saved on the account via POST /api/me', async () => {
  await withApp(async ctx => { const drv = await ctx.account('0555000231', 'driver', 'Neo'); await ctx.call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '4-111-16' }); const p = await ctx.page(drv);
    await p.locator('#dm-menu [data-dm=dm-set]').click(); await p.locator('#dm-lang [data-lg=fr]').click(); await p.waitForFunction(() => document.documentElement.lang === 'fr'); assert.equal((await ctx.call(drv, 'GET', '/api/me')).j.lang, 'fr'); });
});
test('report: needs a kind, then POST /api/rides/:id/report', async () => {
  await withApp(async ctx => { const { drv, rideId } = await ride(ctx, true); const p = await ctx.page(drv);
    await p.locator('#dm-menu [data-dm=dm-rep]').click(); await p.locator('#dm-r-form [type=submit]').click(); assert.ok((await p.locator('#dm-r-err').innerText()).length > 0);
    await p.locator('#dm-r-kinds [data-k=safety]').click(); const [resp] = await Promise.all([p.waitForResponse(r => r.url().includes(`/api/rides/${rideId}/report`)), p.locator('#dm-r-form [type=submit]').click()]);
    assert.equal(resp.status(), 200); await p.waitForSelector('#dm-r-done:not([hidden])'); });
});
test('320px: no horizontal scroll on any driver extra screen', async () => {
  await withApp(async ctx => { const { drv } = await ride(ctx, true); const p = await ctx.page(drv, { width: 320 });
    for (const id of ['dm-act', 'dm-notif', 'dm-cont', 'dm-set', 'dm-rep']) { await p.locator(`#dm-menu [data-dm=${id}]`).click(); await p.waitForTimeout(400);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.screen.on').scrollWidth <= innerWidth), true, id); await p.locator(`#${id} [data-dmback]`).click(); await p.waitForSelector('#s-account.on'); } });
});

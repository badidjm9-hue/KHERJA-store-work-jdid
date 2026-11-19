// Passenger extra screens: history, details, profile, settings, help, trusted contacts, SOS, report. Real API data only.
// Run: node --test e2e/passenger-screens.test.js
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
  const page = async (ck, { width = 390, lang } = {}) => { const c = await browser.newContext({ viewport: { width, height: 844 } }); ctxs.push(c); await c.addCookies([{ name: 'sid', value: ck.slice(4), url: base }]);
    const pg = await c.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); await pg.goto(base + '/app'); await pg.waitForSelector('#sh-home.on'); return pg; };
  try { await fn({ base, call, account, page, errs }); assert.deepEqual(errs, [], 'no page or console errors'); } finally { for (const c of ctxs) await c.close(); await new Promise(r => srv.close(r)); }
}
async function completedRide({ call, account }) {
  const rider = await account('0555000101', 'rider', 'Karim'), drv = await account('0555000102', 'driver', 'Ethan');
  await call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '1234-111-16' }); await call(drv, 'POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
  const rq = await call(rider, 'POST', '/api/requests', { pickup: { lat: 36.75, lng: 3.05, label: 'Bab Ezzouar' }, dropoff: { lat: 36.69, lng: 3.21, label: 'Aéroport' }, price: 450 });
  const of = await call(drv, 'POST', `/api/requests/${rq.j.id}/offers`, { price: 500, eta_min: 3 }); const ac = await call(rider, 'POST', `/api/offers/${of.j.id}/accept`);
  const ride = (await call(rider, 'GET', '/api/rides/active')).j.ride; for (const s of ['arrived', 'in_progress', 'completed']) await call(drv, 'POST', `/api/rides/${ride.id}/status`, { status: s });
  return { rider, drv, rideId: ride.id };
}

test('history lists the real ride with route labels, details open, filters work, empty state is honest', async () => {
  await withApp(async ctx => {
    const { rider, rideId } = await completedRide(ctx); const p = await ctx.page(rider);
    await p.locator('#sh-home [data-tab=hist]').click(); await p.waitForSelector('#hist-list .hrow');
    const row = p.locator('#hist-list .hrow'); assert.equal(await row.count(), 1); assert.match(await row.first().innerText(), /Bab Ezzouar/); assert.match(await row.first().innerText(), /500/);
    await p.locator('#s-hist .chips button').nth(2).click(); assert.match(await p.locator('#hist-list').innerText(), /./); assert.equal(await p.locator('#hist-list .hrow').count(), 0);
    await p.locator('#s-hist .chips button').nth(1).click(); assert.equal(await p.locator('#hist-list .hrow').count(), 1);
    await row.first().click(); await p.waitForSelector('#s-hdet.on #hd-report'); assert.match(await p.locator('#hdet-body').innerText(), /Aéroport/); assert.match(await p.locator('#hdet-body').innerText(), /500/);
    assert.ok(rideId > 0);
  });
});

test('offline history shows the offline state with a working retry', async () => {
  await withApp(async ctx => {
    const rider = await ctx.account('0555000111', 'rider', 'Karim'); const p = await ctx.page(rider);
    await p.context().setOffline(true); await p.locator('#sh-home [data-tab=hist]').click(); await p.waitForSelector('#hist-list [data-retry]');
    assert.equal(await p.locator('#hist-list [role=alert]').count(), 1); await p.context().setOffline(false);
    await p.locator('#hist-list [data-retry]').click(); await p.waitForSelector('#hist-list .st-box:not([role=alert])');
  });
});

test('trusted contacts: invalid phone rejected by the API, valid ones persist across reload; SOS shows them with tel:/sms: links only', async () => {
  await withApp(async ctx => {
    const rider = await ctx.account('0555000121', 'rider', 'Karim'); const p = await ctx.page(rider);
    await p.locator('#sh-home [data-tab=prof]').click(); await p.locator('#pf-menu [data-go=s-contacts]').click(); await p.waitForSelector('#ct-list .st-box');
    await p.locator('#ct-add').click(); await p.locator('#ct-name').fill('Mère'); await p.locator('#ct-phone').fill('abc'); await p.locator('#ct-save').click();
    await p.waitForSelector('#ct-err:not([hidden])'); assert.equal(await p.locator('#ct-list .ct-row').count(), 0);
    await p.locator('#ct-phone').fill('0798765432'); await p.locator('#ct-save').click(); await p.waitForSelector('#ct-list .ct-row');
    await p.reload(); await p.waitForSelector('#sh-home.on'); const api = await ctx.call(rider, 'GET', '/api/safety/contacts'); assert.equal(api.j.contacts.length, 1);
    await p.locator('#sh-home [data-tab=prof]').click(); await p.locator('#pf-menu [data-go=s-contacts]').click(); await p.waitForSelector('#ct-list .ct-row');
    assert.match(await p.locator('#ct-list a.round').first().getAttribute('href'), /^tel:\+?\d+$/);
  });
});

test('SOS chip opens the SOS screen (call/SMS links) and never claims contacts were notified', async () => {
  await withApp(async ctx => {
    const rider = await ctx.account('0555000131', 'rider', 'Karim'); const drv = await ctx.account('0555000132', 'driver', 'Ethan');
    await ctx.call(drv, 'POST', '/api/driver/profile', { car: 'Dacia Logan', plate: '1-111-16' }); await ctx.call(drv, 'POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
    await ctx.call(rider, 'POST', '/api/safety/contacts', { name: 'Frère', phone: '0787654321' });
    const p = await ctx.page(rider); assert.equal(await p.locator('#sos').isHidden(), true, 'SOS chip only during/after a ride');
    await p.locator('#to-request').click(); await p.locator('#order').click(); await p.waitForSelector('#sh-wait.on');
    const rid = (await ctx.call(drv, 'GET', '/api/driver/requests')).j; const id = (rid.requests || rid)[0].id; await ctx.call(drv, 'POST', `/api/requests/${id}/offers`, { price: 500, eta_min: 3 });
    await p.waitForSelector('#offers .offer'); await p.locator('#offers .offer [data-ok]').first().click(); await p.waitForSelector('#sh-way.on');
    await p.locator('#sos').click(); await p.waitForSelector('#s-sos.on #sos-list .ct-row'); assert.equal(await p.locator('.toast.on').count(), 0, 'no fake success toast');
    assert.match(await p.locator('#sos-list a.btn.primary').getAttribute('href'), /^tel:\+?\d+$/); assert.match(await p.locator('#sos-list a.btn.ghost').getAttribute('href'), /^sms:\+?\d+$/);
    assert.equal(await p.locator('#share').isHidden(), true, 'share button hidden (no real share backend)');
    await p.locator('#s-sos [data-back]').click(); await p.waitForSelector('#sh-way.on');
  });
});

test('settings: language persists on the account (POST /api/me) and theme is stored; help FAQ opens', async () => {
  await withApp(async ctx => {
    const rider = await ctx.account('0555000141', 'rider', 'Karim'); const p = await ctx.page(rider);
    await p.locator('#sh-home [data-tab=prof]').click(); await p.locator('#pf-menu [data-go=s-set]').click();
    await p.locator('#set-theme [data-th=dark]').click(); assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark'); assert.equal(await p.evaluate(() => localStorage.getItem('kherja-theme')), 'dark');
    await p.locator('#set-lang [data-lg=fr]').click(); await p.waitForFunction(() => document.documentElement.lang === 'fr'); assert.equal((await ctx.call(rider, 'GET', '/api/me')).j.lang, 'fr');
    await p.waitForSelector('#sh-home.on'); await p.locator('#sh-home [data-tab=prof]').click(); await p.locator('#pf-menu [data-go=s-help]').click(); await p.locator('#faq summary').first().click();
    assert.equal(await p.locator('#faq details[open]').count(), 1);
  });
});

test('report: needs a kind, then posts to /api/rides/:id/report and shows success', async () => {
  await withApp(async ctx => {
    const { rider, rideId } = await completedRide(ctx); const p = await ctx.page(rider);
    await p.locator('#sh-home [data-tab=hist]').click(); await p.waitForSelector('#hist-list .hrow'); await p.locator('#hist-list .hrow').first().click(); await p.locator('#hd-report').click();
    await p.locator('#rp-send').click(); await p.waitForSelector('#rp-err:not([hidden])');
    await p.locator('#s-report .rp-kinds button').nth(0).click(); await p.locator('#rp-body').fill('Prix différent');
    const [resp] = await Promise.all([p.waitForResponse(r => r.url().includes(`/api/rides/${rideId}/report`)), p.locator('#rp-send').click()]);
    assert.equal(resp.status(), 200); assert.deepEqual(JSON.parse(resp.request().postData()), { kind: 'price_dispute', body: 'Prix différent' }); await p.waitForSelector('#rp-done:not([hidden])');
  });
});

test('320px: home sheet chips wrap, no horizontal page scroll on any extra screen', async () => {
  await withApp(async ctx => {
    const rider = await ctx.account('0555000151', 'rider', 'Karim'); const p = await ctx.page(rider, { width: 320 });
    const over = () => p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(await over(), false);
    const chipsFit = await p.evaluate(() => [...document.querySelectorAll('#recents button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })); assert.ok(chipsFit, 'every suggestion chip fully visible');
    for (const go of [['#sh-home [data-tab=hist]'], ['#s-hist [data-tab=prof]'], ['#pf-menu [data-go=s-set]'], ['#s-set [data-back]', '#pf-menu [data-go=s-help]'], ['#s-help [data-back]', '#pf-menu [data-go=s-contacts]']]) { for (const s of go) await p.locator(s).click(); assert.equal(await over(), false, go.join('>')); }
  });
});

test('notifications: shows real server events, mark-all-read hits the API; empty state honest', async () => {
  await withApp(async ctx => {
    const { rider } = await completedRide(ctx); const p = await ctx.page(rider);
    await p.locator('#sh-home [data-tab=prof]').click(); await p.locator('#pf-menu [data-go=s-notif]').click(); await p.waitForSelector('#nt-list .hrow');
    assert.equal(await p.locator('#nt-list .hrow').count(), 4); assert.equal(await p.locator('#nt-list .hrow.unread').count(), 4);
    assert.equal((await ctx.call(rider, 'GET', '/api/notifications')).j.unread, 4);
    await p.locator('#nt-all').click(); await p.waitForFunction(() => !document.querySelector('#nt-list .hrow.unread'));
    assert.equal((await ctx.call(rider, 'GET', '/api/notifications')).j.unread, 0);
    const fresh = await ctx.account('0555000111', 'rider', 'Nour'); const p2 = await ctx.page(fresh);
    await p2.locator('#sh-home [data-tab=prof]').click(); await p2.locator('#pf-menu [data-go=s-notif]').click(); await p2.waitForSelector('#nt-list .st-box');
    assert.equal(await p2.locator('#nt-list .hrow').count(), 0);
  });
});
test('account deletion: needs explicit confirmation, then DELETE /api/me removes the account', async () => {
  await withApp(async ctx => {
    const rider = await ctx.account('0555000121', 'rider', 'Sara'); const p = await ctx.page(rider);
    await p.locator('#sh-home [data-tab=prof]').click(); await p.locator('#pf-menu [data-go=s-set]').click();
    await p.locator('#del-start').click(); await p.locator('#del-no').click(); assert.equal((await ctx.call(rider, 'GET', '/api/me')).r.status, 200);
    await p.locator('#del-start').click(); await Promise.all([p.waitForResponse(r => r.url().endsWith('/api/me') && r.request().method() === 'DELETE'), p.locator('#del-yes').click()]);
    assert.equal((await ctx.call(rider, 'GET', '/api/me')).r.status, 401);
  });
});

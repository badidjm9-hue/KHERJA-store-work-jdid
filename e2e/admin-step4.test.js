// Step 4 admin UI: vehicle-change review, concurrency, RTL/LTR, themes, bottom sheet, screenshots. Run: node --test e2e/admin-step4.test.js
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright'); const { createApp } = require('../backend/server');
const SHOTS = '/tmp/shots-admin'; fs.mkdirSync(SHOTS, { recursive: true });
async function env() { const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port; const browser = await chromium.launch(); const errs = [], logs = [];
  const mk = async (path, opts = {}) => { const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts }); const p = await c.newPage(); p.on('pageerror', e => { errs.push(e.message); logs.push('pageerror ' + e.message); }); p.on('console', m => { logs.push('console.' + m.type() + ' ' + m.text()); if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); }); p.on('response', r => { if (r.status() >= 400) logs.push(`HTTP ${r.status()} ${r.url().replace(base, '')}`); }); await p.goto(base + path); return p; };
  const guard = async (fn) => { try { await fn(); } catch (e) { console.log('--- LOGS ---\n' + logs.join('\n') + '\n--- DB changes: ' + JSON.stringify(srv.db.prepare('select id,status,plate,reason from driver_change_requests').all())); throw e; } };
  return { srv, base, browser, errs, mk, guard, done: async () => { await browser.close(); await new Promise(r => srv.close(r)); } }; }
const post = (base, u, b, ck) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: JSON.stringify(b) });
let n = 0;
async function lockedDriverWithChange(e, name, plate, np) { const phone = '0666' + String(500000 + n++); await post(e.base, '/api/auth/otp', { phone }); const v = await post(e.base, '/api/auth/verify', { phone, code: '123456', role: 'driver' }); const ck = 'sid=' + /sid=([^;]+)/.exec(v.headers.get('set-cookie'))[1];
  await post(e.base, '/api/me', { name }, ck); await post(e.base, '/api/driver/profile', { car: 'Symbol', plate }, ck); e.srv.db.prepare('update drivers set vehicle_locked=1 where plate=?').run(plate);
  const r = await (await post(e.base, '/api/driver/profile', { car: 'Golf 8', plate: np, vehicle_type: 'car' }, ck)).json(); assert.equal(r.change, 'pending'); return { ck, id: r.request_id }; }
const adminLogin = async p => { await p.getByLabel('رقم الهاتف').fill('0550000000'); await p.getByLabel('كلمة السر').fill('admin-dev-pass'); await p.getByRole('button', { name: 'دخول' }).click(); await p.locator('[data-nav=overview]').waitFor(); };
const live = (e, plate) => e.srv.db.prepare('select plate,car from drivers where plate=?').get(plate);

test('vehicle-change review: shows current vs requested, approve confirms, reject needs a reason, concurrent duplicate decision is refused, live vehicle changes only on approval', async () => {
  const e = await env(); try { await e.guard(async () => {
    const a = await lockedDriverWithChange(e, 'Karim', 'RV-1', 'RV-2'), b = await lockedDriverWithChange(e, 'Sofiane', 'RW-1', 'RW-2'); const adm = await e.mk('/admin'); await adminLogin(adm);
    await adm.locator('.stat.hot', { hasText: '2' }).first().waitFor(); await adm.locator('[data-nav=changes]').click(); await adm.locator('[data-ch-card]').first().waitFor(); assert.equal(await adm.locator('[data-ch-card]').count(), 2);
    const card = adm.locator(`[data-ch-card="${a.id}"]`); const txt = await card.innerText(); for (const must of ['Karim', 'RV-1', 'RV-2', 'Symbol', 'Golf 8']) assert.ok(txt.includes(must), 'card shows ' + must); assert.match(await card.locator('.meta').innerText(), /20\d\d-\d\d-\d\d/, 'submission date shown');
    assert.deepEqual(live(e, 'RV-1') && Object.keys(live(e, 'RV-1')).length, 2); // nothing applied yet
    // reject: empty reason is refused client-side AND nothing is sent; with a reason it is stored
    await card.locator('[data-act=rejected]').click(); await adm.locator('#ch-ok').click(); await adm.locator('#ch-err').filter({ hasText: 'السبب مطلوب' }).waitFor(); assert.equal(e.srv.db.prepare("select status from driver_change_requests where id=?").get(a.id).status, 'pending');
    await adm.fill('#ch-reason', 'صورة اللوحة غير واضحة'); await adm.locator('#ch-ok').click(); await adm.locator(`[data-ch-card="${a.id}"]`).waitFor({ state: 'detached' });
    assert.deepEqual({ ...e.srv.db.prepare('select status,reason from driver_change_requests where id=?').get(a.id) }, { status: 'rejected', reason: 'صورة اللوحة غير واضحة' }); assert.ok(live(e, 'RV-1') && !live(e, 'RV-2'), 'rejected: live vehicle unchanged');
    // concurrency: a second admin tab holds a stale list; tab 1 approves first; tab 2's approve must be refused cleanly
    const adm2 = await e.mk('/admin'); await adminLogin(adm2); await adm2.locator('[data-nav=changes]').click(); await adm2.locator(`[data-ch-card="${b.id}"]`).waitFor();
    await adm.locator(`[data-ch-card="${b.id}"] [data-act=approved]`).click(); await adm.locator('#ch-ok').click(); await adm.locator(`[data-ch-card="${b.id}"]`).waitFor({ state: 'detached' }); assert.ok(live(e, 'RW-2') && !live(e, 'RW-1'), 'approved: live vehicle replaced');
    await adm2.locator(`[data-ch-card="${b.id}"] [data-act=rejected]`).click(); await adm2.fill('#ch-reason', 'late'); await adm2.locator('#ch-ok').click(); await adm2.locator('#toast.on').filter({ hasText: 'سبق اتخاذ قرار' }).waitFor();
    assert.equal(e.srv.db.prepare('select status from driver_change_requests where id=?').get(b.id).status, 'approved', 'first decision stands'); assert.equal(e.srv.db.prepare("select count(*) c from driver_change_events where request_id=? and action in('approved','rejected')").get(b.id).c, 1);
    assert.equal(e.srv.db.prepare("select count(*) c from audit where action like 'driver_change_%'").get().c, 2);
    await adm.locator('[data-chst=all]').click(); await adm.locator(`[data-ch-card="${a.id}"] a`, { hasText: 'السجل' }).click(); await adm.locator('.tl li').first().waitFor(); assert.ok((await adm.locator('.tl li').count()) >= 2, 'history shows request + decision');
    await adm.goto(e.base + '/admin#/changes/pending'); await adm.locator('.card.empty').waitFor(); assert.match(await adm.locator('.card.empty').innerText(), /لا توجد طلبات/, 'empty state');
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

test('security in the browser: rider and driver sessions only get the login screen; no secrets on the page', async () => {
  const e = await env(); try { await e.guard(async () => {
    const phone = '0555' + String(600000 + n++); await post(e.base, '/api/auth/otp', { phone }); const v = await post(e.base, '/api/auth/verify', { phone, code: '123456', role: 'rider' }); const sid = /sid=([^;]+)/.exec(v.headers.get('set-cookie'))[1];
    const ctx = await e.browser.newContext(); await ctx.addCookies([{ name: 'sid', value: sid, url: e.base }, { name: 'asid', value: sid, url: e.base }]); const p = await ctx.newPage(); await p.goto(e.base + '/admin#/changes'); await p.getByRole('button', { name: 'دخول' }).waitFor(); assert.equal(await p.locator('#shell').isHidden(), true, 'user cookie replayed as admin cookie gets nothing');
    const html = await p.content(); assert.ok(!/admin-dev-pass|password_hash|BEGIN (RSA )?PRIVATE/i.test(html), 'no credentials in the served page');
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

for (const [lang, scheme] of [['ar', 'light'], ['ar', 'dark'], ['fr', 'light'], ['fr', 'dark']]) test(`layout ${lang}/${scheme}: direction, language, no horizontal overflow desktop+mobile, bottom sheet on mobile; screenshots saved`, async () => {
  const e = await env(); try { await e.guard(async () => {
    await lockedDriverWithChange(e, 'Karim', 'SH-1', 'SH-2'); const adm = await e.mk('/admin', { colorScheme: scheme }); await adminLogin(adm);
    if (lang === 'fr') { await adm.locator('#lang2').click(); await adm.waitForFunction(() => document.documentElement.lang === 'fr'); }
    assert.equal(await adm.evaluate(() => document.documentElement.dir), lang === 'ar' ? 'rtl' : 'ltr'); if (lang === 'fr') assert.equal((await adm.locator('[data-nav=changes] span').innerText()).trim(), 'Changements de véhicule');
    await adm.locator('[data-nav=overview]').click(); await adm.locator('.stat').first().waitFor(); await adm.waitForTimeout(350); await adm.screenshot({ path: `${SHOTS}/${lang}-${scheme}-overview.png` });
    await adm.locator('[data-nav=changes]').click(); await adm.locator('[data-ch-card]').waitFor(); await adm.waitForTimeout(350); await adm.screenshot({ path: `${SHOTS}/${lang}-${scheme}-changes.png` });
    assert.equal(await adm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no horizontal overflow (desktop)');
    await adm.setViewportSize({ width: 390, height: 844 }); await adm.waitForTimeout(200); assert.equal(await adm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no horizontal overflow (390px)');
    await adm.locator('[data-act=rejected]').click(); await adm.locator('#dlg-change[open]').waitFor(); await adm.waitForTimeout(450); const box = await adm.locator('#dlg-change').boundingBox(); assert.ok(Math.abs(box.y + box.height - 844) <= 2, 'dialog is a bottom sheet on mobile: ' + JSON.stringify(box));
    await adm.screenshot({ path: `${SHOTS}/${lang}-${scheme}-sheet-mobile.png` });
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

test('settings: only real controls; theme and language persist; sound/haptics default off; reduced motion disables animations', async () => {
  const e = await env(); try { await e.guard(async () => {
    const adm = await e.mk('/admin', { reducedMotion: 'reduce' }); await adminLogin(adm); await adm.locator('[data-nav=settings]').click(); await adm.locator('#se-theme').waitFor();
    assert.equal(await adm.locator('#se-sound').isChecked(), false); assert.equal(await adm.locator('#se-hap').isChecked(), false); const kv = await adm.locator('.kv').innerText(); assert.match(kv, /15/); assert.ok(!/pass|secret|token/i.test(await adm.locator('main').innerText()));
    await adm.selectOption('#se-theme', 'dark'); assert.equal(await adm.evaluate(() => document.documentElement.dataset.theme), 'dark'); await adm.check('#se-sound'); assert.equal(await adm.evaluate(() => localStorage.getItem('kherja-sound')), '1');
    await adm.selectOption('#se-lang', 'fr'); await adm.waitForFunction(() => document.documentElement.dir === 'ltr'); await adm.reload(); await adm.locator('#se-lang').waitFor(); assert.equal(await adm.evaluate(() => document.documentElement.lang), 'fr', 'language persists');
    assert.equal(await adm.evaluate(() => { const m = document.querySelector('main'); return getComputedStyle(m).animationName; }), 'none', 'reduced motion: page transition disabled');
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

// Phase 2.1: OTP messaging per mode (F-3) and passenger logout (F-4), through the one-app shell. Run: node --test e2e/shell-phase21.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function withApp(opts, fn) {
  const sent = {}; const o = { ...opts }; if (o.dev === false && o.sms) { o.sendSms = (p, c) => { sent[p] = c; }; } delete o.sms;
  const srv = createApp(o); await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + srv.address().port; const errs = [], ctxs = [];
  const ctx = async (vp = { width: 390, height: 844 }) => { const c = await browser.newContext({ viewport: vp }); ctxs.push(c); return c; };
  const page = async (c, route) => { const p = await c.newPage(); p.logoutCalls = 0; p.on('request', r => { if (r.method() === 'POST' && /\/api\/auth\/logout/.test(r.url())) p.logoutCalls++; });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); if (route) await p.goto(base + route); return p; };
  const account = async (phone, role, { name = 'Amine', lang = 'ar' } = {}) => { const post = (u, b, ck) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: JSON.stringify(b) });
    await post('/api/auth/otp', { phone }); const code = o.dev === false ? sent['+213' + phone.slice(1)] : '123456'; const v = await post('/api/auth/verify', { phone, code, role }); const sid = /sid=([^;]+)/.exec(v.headers.get('set-cookie'))[1];
    await post('/api/me', { name, lang }, 'sid=' + sid); if (role === 'driver') await post('/api/driver/profile', { name, car: 'Dacia Logan', plate: 'T-' + phone.slice(-4) }, 'sid=' + sid); return sid; };
  const withSid = (c, sid) => c.addCookies([{ name: 'sid', value: sid, url: base }]);
  try { await fn({ srv, base, sent, ctx, page, account, withSid, errs }); assert.deepEqual(errs, [], 'no page or console errors'); } finally { for (const c of ctxs) await c.close(); await new Promise(r => srv.close(r)); }
}
const toPhone = async (p, fr) => { await p.waitForSelector('#s-lang.on'); if (fr) await p.click('#s-lang [data-lang=fr]'); await p.click('#go-phone'); await p.waitForSelector('#s-phone.on'); };
const sendOtp = async (p, phone) => { await p.fill('#phone', phone); await p.click('#send-otp'); };
const bodyText = p => p.evaluate(() => document.body.innerText);

/* ---------- F-3: OTP messaging ---------- */
for (const [lang, fr, expect] of [['Arabic RTL', false, /غير مفعّلة/], ['French LTR', true, /pas encore configuré/]]) {
  test(`secure mode, no SMS sender (${lang}): clear localized unavailability message, no test code anywhere, OTP screen never reached`, async () => withApp({ dev: false }, async ({ ctx, page }) => {
    const p = await page(await ctx(), '/app'); await toPhone(p, fr); await sendOtp(p, '0555840001'); await p.waitForFunction(() => document.querySelector('#phone-err').textContent.trim().length > 0);
    const msg = await p.textContent('#phone-err'); assert.match(msg, expect); assert.equal(await p.evaluate(() => document.documentElement.dir), fr ? 'ltr' : 'rtl');
    assert.ok(await p.isVisible('#s-phone.on') && !(await p.isVisible('#s-otp.on')), 'stays on the phone screen');
    assert.ok(!(await bodyText(p)).includes('123456'), 'no 123456 visible'); assert.ok(!(await p.locator('#demo-hint').isVisible()));
    assert.ok(!/sms_unavailable|503/.test(msg), 'raw error code not shown'); }));
}
test('secure mode with an injected sender: OTP screen has no test code; the real code logs in', async () => withApp({ dev: false, sms: true }, async ({ ctx, page, sent }) => {
  const p = await page(await ctx(), '/app'); await toPhone(p, false); await sendOtp(p, '0555840002'); await p.waitForSelector('#s-otp.on');
  assert.ok(!(await p.locator('#demo-hint').isVisible()), 'demo hint hidden'); assert.ok(!(await bodyText(p)).includes('رمز التجربة'), 'no "demo code" label');
  const code = sent['+213555840002']; assert.match(code, /^\d{6}$/); const ins = p.locator('#otp input'); for (let i = 0; i < 6; i++) await ins.nth(i).fill(code[i]); await p.click('#verify');
  await p.waitForSelector('#s-profile.on'); }));
test('development mode keeps the explicit demo code, shown only after the server says dev', async () => withApp({ dev: true }, async ({ ctx, page }) => {
  const p = await page(await ctx(), '/app'); await toPhone(p, false); assert.ok(!(await p.locator('#demo-hint').isVisible()), 'hidden before the server answers');
  await sendOtp(p, '0555840003'); await p.waitForSelector('#s-otp.on'); assert.ok(await p.locator('#demo-hint').isVisible()); assert.match(await p.textContent('#demo-hint'), /123456/);
  const ins = p.locator('#otp input'); for (let i = 0; i < 6; i++) await ins.nth(i).fill('123456'[i]); await p.click('#verify'); await p.waitForSelector('#s-profile.on'); }));

/* ---------- F-4: passenger logout ---------- */
for (const [lang, fr, name, vp] of [['Arabic RTL 390', false, 'تسجيل الخروج', { width: 390, height: 844 }], ['French LTR 360', true, 'Se déconnecter', { width: 360, height: 740 }]]) {
  test(`passenger logout (${lang}): visible, ≥44px, one POST /api/auth/logout, session gone, shared gate shown, stays logged out after reload`, async () => withApp({ dev: true }, async ({ ctx, page, account, withSid, base }) => {
    const sid = await account('055584' + (fr ? '0011' : '0010'), 'rider', { lang: fr ? 'fr' : 'ar' }); const c = await ctx(vp); await withSid(c, sid); const p = await page(c, '/app'); await p.waitForSelector('#s-map.on');
    assert.equal(await p.evaluate(() => [document.documentElement.dir, window.Kherja.role]).then(a => a.join()), (fr ? 'ltr' : 'rtl') + ',rider');
    const btn = p.getByRole('button', { name }); assert.ok(await btn.isVisible(), 'logout is visible without scrolling'); const bb = await btn.boundingBox(); assert.ok(bb.width >= 44 && bb.height >= 44, 'target ' + bb.width + 'x' + bb.height);
    assert.ok(bb.x >= 0 && bb.x + bb.width <= vp.width && bb.y >= 0, 'inside the viewport'); const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); assert.ok(!over, 'no horizontal overflow');
    await p.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/p21-passenger-${fr ? 'fr' : 'ar'}.png` : undefined, type: 'png' }).catch(() => {});
    await btn.click(); await p.waitForSelector('#s-lang.on'); assert.equal(p.logoutCalls, 1, 'exactly one logout request');
    assert.equal((await p.request.get(base + '/api/me')).status(), 401, 'server session revoked'); assert.ok(!(await p.evaluate(() => !!window.Kherja)), 'no leftover role object');
    const keys = await p.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage))); assert.deepEqual(keys.filter(k => k !== 'kherja-theme'), [], 'no session state kept client-side');
    assert.equal((await c.cookies()).filter(k => k.name === 'sid' && k.value).length, 0, 'sid cookie cleared'); await p.reload(); await p.waitForSelector('#s-lang.on'); assert.equal(p.logoutCalls, 1); }));
}
test('passenger logout failure (network): stays signed in, tells the user, never reloads into the gate; retry then succeeds', async () => withApp({ dev: true }, async ({ ctx, page, account, withSid, base }) => {
  const c = await ctx(); await withSid(c, await account('0555840020', 'rider')); const p = await page(c, '/app'); await p.waitForSelector('#s-map.on');
  let block = true; await p.route('**/api/auth/logout', r => block ? r.abort() : r.continue()); await p.click('#p-logout'); await p.waitForFunction(() => document.querySelector('#toast').classList.contains('on'));
  assert.ok(await p.isVisible('#s-map.on'), 'still on the map'); assert.equal((await p.request.get(base + '/api/me')).status(), 200, 'session intact');
  block = false; await p.waitForTimeout(300); await p.click('#p-logout'); await p.waitForSelector('#s-lang.on'); assert.equal((await p.request.get(base + '/api/me')).status(), 401); }));
test('no accidental logout: /api/me failures, 403, wrong-role navigation and reload never call /api/auth/logout', async () => withApp({ dev: true }, async ({ ctx, page, account, withSid, base }) => {
  const sidR = await account('0555840030', 'rider'), sidD = await account('0555840031', 'driver');
  const c = await ctx(); await withSid(c, sidR); const p = await page(c, null); let mode = 'abort';
  await p.route('**/api/me', r => mode === 'abort' ? r.abort() : mode === '403' ? r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"forbidden"}' }) : mode === '500' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : r.continue());
  await p.goto(base + '/app'); await p.waitForSelector('#s-notice.on'); for (const m of ['403', '500']) { mode = m; await p.click('#notice-retry'); await p.waitForSelector('#s-notice.on'); }
  mode = 'pass'; await p.click('#notice-retry'); await p.waitForSelector('#s-map.on'); await p.goto(base + '/app/driver'); await p.waitForSelector('#s-map.on'); await p.reload(); await p.waitForSelector('#s-map.on');
  assert.equal(p.logoutCalls, 0, 'rider: zero logout calls'); assert.equal((await p.request.get(base + '/api/me')).status(), 200);
  const c2 = await ctx(); await withSid(c2, sidD); const q = await page(c2, '/app'); await q.waitForSelector('#s-docs.on, #s-vehicle.on, .screen.on'); assert.equal(await q.evaluate(() => window.Kherja.role), 'driver'); assert.equal(q.logoutCalls, 0); assert.equal((await q.request.get(base + '/api/me')).status(), 200); }));

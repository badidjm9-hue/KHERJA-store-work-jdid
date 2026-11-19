// Phase 2: ONE Kherja app, two role-based interfaces, served at /app and /app/driver (preview routes).
// The backend decides the role; the URL, the picker and localStorage never do. Run: node --test e2e/shell.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

/* fresh server per test: OTP rate limits are per app instance */
async function withApp(fn, opts = {}) {
  const srv = createApp({ dev: true, devAdmin: true, ...opts }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port; const errs = []; const ctxs = [];
  const ctx = async (o = {}) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, ...o }); ctxs.push(c); return c; };
  const page = async (p, route, o) => { const pg = await p.newPage(); pg.requests = []; pg.on('request', r => pg.requests.push(r.method() + ' ' + new URL(r.url()).pathname)); pg.on('pageerror', e => errs.push(e.message));
    pg.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); if (route !== null) await pg.goto(base + route); return pg; };
  try { await fn({ srv, base, errs, ctx, page }); assert.deepEqual(errs, [], 'no page or console errors'); } finally { for (const c of ctxs) await c.close(); await new Promise(r => srv.close(r)); }
}
/* create an account straight through the API; returns the session cookie value */
async function account(base, phone, role, { name, driver } = {}) {
  const post = async (p, b, cookie) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(b) }); return r; };
  await post('/api/auth/otp', { phone }); const v = await post('/api/auth/verify', { phone, code: '123456', role }); const sid = /sid=([^;]+)/.exec(v.headers.get('set-cookie'))[1]; const ck = 'sid=' + sid;
  if (name) await post('/api/me', { name }, ck);
  if (driver) { await post('/api/driver/profile', { name, car: 'Dacia Logan', plate: 'T-' + phone.slice(-4) }, ck); }
  return sid;
}
const asSession = async (c, base, sid) => c.addCookies([{ name: 'sid', value: sid, url: base }]);
const otp = async (p, code = '123456') => { const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill(code[i]); await p.getByRole('button', { name: 'تأكيد' }).click(); };
const gatePhone = async (p, phone) => { await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click(); await otp(p); };
const viewOf = p => p.evaluate(() => ({ map: !!document.querySelector('#s-map'), drv: !!document.querySelector('#s-home') && !!document.querySelector('.tabbar'), gate: !!document.querySelector('[data-gate]'), role: window.Kherja && window.Kherja.role }));

test('passenger: / style entry (/app) → language → phone → OTP → profile → map', async () => withApp(async ({ ctx, page, srv, base }) => {
  const p = await page(await ctx(), '/app');
  await p.getByRole('button', { name: 'متابعة' }).click(); await gatePhone(p, '0555100001');
  await p.getByLabel('الاسم').fill('Amine'); await p.getByRole('button', { name: 'ابدأ' }).click();
  await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
  assert.deepEqual(await viewOf(p), { map: true, drv: false, gate: false, role: 'rider' });
  assert.equal(srv.db.prepare("select role from users where phone='+213555100001'").get().role, 'rider');
}));

test('driver: /app/driver entry → phone (no language screen) → OTP → vehicle profile → driver interface', async () => withApp(async ({ ctx, page, srv }) => {
  const p = await page(await ctx(), '/app/driver');
  await gatePhone(p, '0666100002');
  await p.getByLabel('الاسم').fill('Karim'); await p.getByLabel('الطراز').fill('Dacia Logan'); await p.getByLabel('رقم اللوحة').fill('12345-117-16'); await p.getByRole('button', { name: 'التالي' }).click();
  await p.getByRole('heading', { name: 'الوثائق' }).waitFor();
  assert.deepEqual(await viewOf(p), { map: false, drv: true, gate: false, role: 'driver' });
  assert.equal(srv.db.prepare("select role from users where phone='+213666100002'").get().role, 'driver');
}));

test('new accounts: the picker decides the role only at creation, on either entry URL', async () => withApp(async ({ ctx, page, srv }) => {
  const a = await page(await ctx(), '/app'); await a.getByRole('button', { name: 'متابعة' }).click(); await a.getByRole('radio', { name: 'سائق' }).click(); await gatePhone(a, '0666100003');
  await a.locator('#s-profile.on').waitFor(); assert.equal((await viewOf(a)).role, 'driver'); assert.equal(await a.locator('#s-map').count(), 0);
  const b = await page(await ctx(), '/app/driver'); await b.getByRole('radio', { name: 'راكب' }).click(); await gatePhone(b, '0555100004');
  await b.locator('#s-profile.on').waitFor(); assert.equal((await viewOf(b)).role, 'rider'); assert.equal(await b.locator('#s-home').count(), 0);
  const rows = srv.db.prepare('select phone,role from users where phone in (?,?) order by phone').all('+213666100003', '+213555100004'); assert.deepEqual(rows.map(r => ({ ...r })), [{ phone: '+213555100004', role: 'rider' }, { phone: '+213666100003', role: 'driver' }]);
}));

test('existing accounts always use the backend role, whatever the URL or picker says (both directions)', async () => withApp(async ({ ctx, page, srv, base }) => {
  await account(base, '0666100005', 'driver', { name: 'Drv', driver: true }); await account(base, '0555100006', 'rider', { name: 'Rdr' });
  // driver account, passenger entry URL, default Passenger picker
  const d = await page(await ctx(), '/app'); await d.getByRole('button', { name: 'متابعة' }).click(); await gatePhone(d, '0666100005');
  await d.getByRole('button', { name: 'الرئيسية' }).waitFor(); assert.deepEqual(await viewOf(d), { map: false, drv: true, gate: false, role: 'driver' });
  await d.getByText('هذا الرقم مسجّل كسائق').waitFor();
  // rider account, driver entry URL, Driver picker preselected
  const r = await page(await ctx(), '/app/driver'); assert.equal(await r.getByRole('radio', { name: 'سائق' }).getAttribute('aria-checked'), 'true'); await gatePhone(r, '0555100006');
  await r.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); assert.deepEqual(await viewOf(r), { map: true, drv: false, gate: false, role: 'rider' });
  await r.getByText('هذا الرقم مسجّل كراكب').waitFor();
  assert.equal(srv.db.prepare("select role from users where phone='+213666100005'").get().role, 'driver'); assert.equal(srv.db.prepare("select role from users where phone='+213555100006'").get().role, 'rider');
}));

test('wrong entry route never logs a valid user out: passenger opens /app/driver, driver opens /app', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100007', 'rider', { name: 'Rdr' }), ds = await account(base, '0666100008', 'driver', { name: 'Drv', driver: true });
  const rc = await ctx(); await asSession(rc, base, rs); const r = await page(rc, '/app/driver');
  await r.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); assert.equal((await viewOf(r)).role, 'rider');
  assert.ok(!r.requests.includes('POST /api/auth/logout'), 'no logout request'); assert.equal((await r.evaluate(() => fetch('/api/me').then(x => x.status))), 200);
  const dc = await ctx(); await asSession(dc, base, ds); const d = await page(dc, '/app');
  await d.getByRole('button', { name: 'الرئيسية' }).waitFor(); assert.equal((await viewOf(d)).role, 'driver');
  assert.ok(!d.requests.includes('POST /api/auth/logout')); assert.equal((await d.evaluate(() => fetch('/api/me').then(x => x.status))), 200);
}));

test('session resume: reload returns to the right interface without logging in again', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100009', 'rider', { name: 'Rdr' }), ds = await account(base, '0666100010', 'driver', { name: 'Drv', driver: true });
  const rc = await ctx(); await asSession(rc, base, rs); const r = await page(rc, '/app'); await r.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); await r.reload(); await r.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
  const dc = await ctx(); await asSession(dc, base, ds); const d = await page(dc, '/app'); await d.getByRole('button', { name: 'الرئيسية' }).waitFor(); await d.reload(); await d.getByRole('button', { name: 'الرئيسية' }).waitFor();
  assert.equal(await d.locator('[data-gate]').count(), 0);
}));

test('localStorage, URL and window.Kherja tampering cannot change the interface or the role', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100011', 'rider', { name: 'Rdr' }); const c = await ctx(); await asSession(c, base, rs);
  const p = await page(c, null); await p.addInitScript(() => { try { for (const k of ['role', 'kherja-role', 'mode', 'kherja-mode', 'user']) localStorage.setItem(k, 'driver'); sessionStorage.setItem('role', 'driver'); } catch {} });
  await p.goto(base + '/app/driver?role=driver&as=driver#driver'); await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
  assert.equal((await viewOf(p)).role, 'rider'); assert.equal(await p.locator('.tabbar').count(), 0);
  const tried = await p.evaluate(() => { try { window.Kherja.role = 'driver'; window.Kherja.user.role = 'driver'; } catch {} return [window.Kherja.role, window.Kherja.user.role]; }); assert.deepEqual(tried, ['rider', 'rider']);
  assert.equal(await p.evaluate(() => fetch('/api/driver/me').then(x => x.status)), 403);
}));

test('backend is the authority: a mounted passenger/driver page cannot reach the other role\'s API', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100012', 'rider', { name: 'Rdr' }), ds = await account(base, '0666100013', 'driver', { name: 'Drv', driver: true });
  const rc = await ctx(); await asSession(rc, base, rs); const r = await page(rc, '/app'); await r.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
  const call = (pg, m, u) => pg.evaluate(([m, u]) => fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: m === 'GET' ? undefined : '{}' }).then(x => x.status), [m, u]);
  for (const [m, u] of [['GET', '/api/driver/requests'], ['GET', '/api/driver/me'], ['POST', '/api/driver/online'], ['POST', '/api/requests/1/offers']]) assert.equal(await call(r, m, u), 403, u);
  const dc = await ctx(); await asSession(dc, base, ds); const d = await page(dc, '/app'); await d.getByRole('button', { name: 'الرئيسية' }).waitFor();
  for (const [m, u] of [['POST', '/api/requests'], ['POST', '/api/offers/1/accept']]) assert.equal(await call(d, m, u), 403, u);
}));

test('no role switching: no switcher in either interface, and /api/dev/role is never called', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100014', 'rider', { name: 'Rdr' }), ds = await account(base, '0666100015', 'driver', { name: 'Drv', driver: true });
  for (const [sid, ready] of [[rs, 'حدّد سعرك'], [ds, 'الرئيسية']]) { const c = await ctx(); await asSession(c, base, sid); const p = await page(c, '/app'); await p.getByRole('button', { name: ready }).waitFor();
    assert.equal(await p.locator('[data-role],#roles').count(), 0); assert.equal(await p.getByText(/تبديل|switch|basculer/i).count(), 0); assert.ok(!p.requests.some(r => /dev\/role/.test(r))); }
}));

test('admin-role account gets no mobile interface; the separate Admin console still works with its own login', async () => withApp(async ({ ctx, page, base }) => {
  const c = await ctx(); const p = await page(c, '/app'); await p.getByRole('button', { name: 'متابعة' }).click(); await gatePhone(p, '0550000000');
  await p.getByRole('heading', { name: 'هذا حساب إدارة' }).waitFor(); assert.deepEqual(await viewOf(p), { map: false, drv: false, gate: false, role: undefined });
  assert.equal(await p.locator('#s-profile, #s-home, #s-map').count(), 0);
  const a = await page(await ctx(), '/admin'); await a.getByRole('button', { name: 'دخول' }).waitFor(); assert.equal(await a.getByRole('heading', { name: 'نظرة عامة' }).count(), 0);
  await a.getByLabel('رقم الهاتف').fill('0550000000'); await a.getByLabel('كلمة السر').fill('admin-dev-pass'); await a.getByRole('button', { name: 'دخول' }).click(); await a.getByRole('heading', { name: 'نظرة عامة' }).waitFor();
  assert.equal(await p.evaluate(() => fetch('/api/admin/stats').then(x => x.status)), 401, 'the mobile session does not open the admin API');
}));

test('same browser, two roles in turn: clean hand-over, no leaked driver location pings, no errors', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100016', 'rider', { name: 'Rdr' }), ds = await account(base, '0666100017', 'driver', { name: 'Drv', driver: true });
  const c = await ctx({ permissions: ['geolocation'], geolocation: { latitude: 36.75, longitude: 3.05 } }); await asSession(c, base, ds); const p = await page(c, '/app');
  await p.getByRole('button', { name: 'الرئيسية' }).waitFor(); await p.locator('.tabbar').getByRole('button', { name: 'حسابي' }).click(); await p.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await p.getByRole('button', { name: 'متابعة' }).waitFor(); assert.ok(p.requests.includes('POST /api/auth/logout'));
  await asSession(c, base, rs); await p.goto(base + '/app'); await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor(); assert.equal((await viewOf(p)).role, 'rider');
  const before = p.requests.length; await p.waitForTimeout(1800); assert.equal(p.requests.slice(before).filter(r => /driver/.test(r)).length, 0, 'no driver polling in the rider interface');
}));

test('connection failure and blocked role show a notice and never call logout', async () => withApp(async ({ ctx, page, base }) => {
  const ds = await account(base, '0666100018', 'driver', { name: 'Drv', driver: true });
  const c1 = await ctx(); const p1 = await page(c1, null); await p1.route('**/api/me', r => r.abort()); await p1.goto(base + '/app');
  await p1.getByRole('heading', { name: 'تعذّر الاتصال' }).waitFor(); assert.ok(!p1.requests.includes('POST /api/auth/logout'));
  const c2 = await ctx(); await asSession(c2, base, ds); const p2 = await page(c2, null); await p2.route('**/api/driver/me', r => r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"forbidden"}' }));
  await p2.goto(base + '/app'); await p2.getByRole('heading', { name: 'تعذّر فتح الواجهة' }).waitFor(); assert.ok(!p2.requests.includes('POST /api/auth/logout'), 'a 403 must not destroy the session');
  assert.equal(await p2.evaluate(() => fetch('/api/me').then(x => x.status)), 200);
}));

test('negotiated fare through the one app: rider and driver complete a ride, accepted fare stays locked', async () => withApp(async ({ ctx, page, srv }) => {
  const rider = await page(await ctx(), '/app'); const dc = await ctx({ permissions: ['geolocation'], geolocation: { latitude: 36.7538, longitude: 3.0588 } }); const driver = await page(dc, '/app/driver');
  await rider.getByRole('button', { name: 'متابعة' }).click(); await gatePhone(rider, '0555100019'); await rider.getByLabel('الاسم').fill('Amine'); await rider.getByRole('button', { name: 'ابدأ' }).click();
  await gatePhone(driver, '0666100020'); await driver.getByLabel('الاسم').fill('Karim <b>X</b>'); await driver.getByLabel('الطراز').fill('Renault Symbol'); await driver.getByLabel('رقم اللوحة').fill('12345-116-20'); await driver.getByRole('button', { name: 'التالي' }).click();
  await driver.getByRole('button', { name: 'الرئيسية' }).click(); await driver.getByRole('switch').click();
  await rider.getByRole('button', { name: 'حدّد سعرك' }).click(); await rider.getByRole('button', { name: 'ابحث عن سائق' }).click();
  await driver.getByRole('button', { name: 'اقبل بسعره' }).click({ timeout: 8000 });
  await rider.locator('.offer').first().waitFor({ timeout: 8000 }); assert.equal(await rider.locator('.offer .nm').first().innerText(), 'Karim <b>X</b>');
  await rider.locator('.offer [data-ok]').first().click(); await rider.getByText('السعر مثبّت').waitFor();
  for (const label of ['وصلت', 'ابدأ الرحلة', 'أنهِ الرحلة']) await driver.getByRole('button', { name: label }).click({ timeout: 8000 });
  await rider.locator('#sh-done.on').waitFor({ timeout: 8000 });
  assert.deepEqual({ ...srv.db.prepare('select status,locked_price from rides').get() }, { status: 'completed', locked_price: 450 });
}));

test('language and layout: French flips to LTR across the gate; no horizontal scroll at 360 and 390; gate targets ≥ 44px', async () => withApp(async ({ ctx, page }) => {
  for (const w of [360, 390]) { const p = await page(await ctx({ viewport: { width: w, height: 740 } }), '/app');
    await p.getByRole('button', { name: 'Français' }).click(); assert.equal(await p.evaluate(() => document.documentElement.dir), 'ltr'); await p.getByRole('button', { name: 'Continuer' }).click();
    for (const s of ['s-phone', 's-otp']) { await p.evaluate(id => document.querySelectorAll('.screen').forEach(x => x.classList.toggle('on', x.id === id)), s);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, s + ' @' + w);
      const small = await p.evaluate(id => [...document.querySelectorAll('#' + id + ' button, #' + id + ' input')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.textContent.trim() || e.id), s); assert.deepEqual(small, [], s + ' @' + w); } }
}));

test('routes: legacy pages are byte-identical, /app has the same security headers as /, admin untouched', async () => withApp(async ({ base }) => {
  const get = async p => { const r = await fetch(base + p); return { r, b: Buffer.from(await r.arrayBuffer()) }; };
  const A = path.join(__dirname, '..', 'app');
  for (const [route, file] of [['/', 'index.html'], ['/driver', 'driver.html'], ['/admin', 'admin.html']]) assert.ok((await get(route)).b.equals(fs.readFileSync(path.join(A, file))), route + ' serves the unchanged legacy file');
  const root = (await get('/')).r.headers, app = (await get('/app')).r.headers, app2 = (await get('/app/driver')).r.headers;
  for (const h of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'cache-control', 'content-type']) { assert.equal(app.get(h), root.get(h), h); assert.equal(app2.get(h), root.get(h), h); }
  assert.ok((await get('/app')).b.equals(fs.readFileSync(path.join(A, 'kherja.html'))));
  assert.equal(/<script[^>]+src=|<link[^>]+href="https?:\/\/(?!fonts\.g)/.test(fs.readFileSync(path.join(A, 'kherja.html'), 'utf8')), false, 'no new external origins');
}));

test('both interfaces inside the shell at 360px: no horizontal overflow, passenger delivery form targets ≥ 44px, driver tabs fit', async () => withApp(async ({ ctx, page, base }) => {
  const rs = await account(base, '0555100021', 'rider', { name: 'Rdr' }), ds = await account(base, '0666100022', 'driver', { name: 'Drv', driver: true });
  const rc = await ctx({ viewport: { width: 360, height: 700 } }); await asSession(rc, base, rs); const p = await page(rc, '/app'); await p.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
  await p.getByRole('button', { name: /توصيل/ }).first().click(); await p.getByRole('button', { name: 'حدّد سعر التوصيل' }).click(); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const small = await p.evaluate(() => [...document.querySelectorAll('#sh-request button,#sh-request input:not([type=checkbox])')].filter(e => e.offsetParent).map(e => [e.id || e.textContent.trim().slice(0, 10), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
  assert.deepEqual(small, []);
  const dc = await ctx({ viewport: { width: 360, height: 700 } }); await asSession(dc, base, ds); const d = await page(dc, '/app'); await d.getByRole('button', { name: 'الرئيسية' }).waitFor();
  for (const tab of ['الرئيسية', 'الوثائق', 'حسابي']) { await d.locator('.tabbar').getByRole('button', { name: tab }).click(); await d.waitForTimeout(350); assert.equal(await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, tab); }
  const tiny = await d.evaluate(() => [...document.querySelectorAll('.tabbar button')].filter(e => e.getBoundingClientRect().height < 44).length); assert.equal(tiny, 0);
}));

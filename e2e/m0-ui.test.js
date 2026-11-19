// Step 3 UI: 15 s countdown cards (passenger), offer outcomes (driver), vehicle-change sheet, dark-theme vehicle cards. Run: node --test e2e/m0-ui.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');
const driverLogin = async (p, phone, name) => { await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click();
  await p.getByLabel('الاسم').fill(name); await p.getByLabel('الطراز').fill('Renault Symbol'); await p.getByLabel('رقم اللوحة').fill('12345-116-' + phone.slice(-2)); await p.getByRole('button', { name: 'التالي' }).click(); };
const riderLogin = async (p, phone, name) => { await p.getByRole('button', { name: 'متابعة' }).click(); await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.getByLabel('الاسم').fill(name); await p.getByRole('button', { name: 'ابدأ' }).click(); };
async function env() { const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port; const browser = await chromium.launch(); const errs = [];
  const pages = [], logs = []; const mk = async (path, { sid, geo, ...opts } = {}) => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts }); if (sid) await c.addCookies([{ name: 'sid', value: sid, url: base }]); if (geo) { await c.grantPermissions(['geolocation']); await c.setGeolocation({ latitude: 36.7538, longitude: 3.0588 }); } const p = await c.newPage(); pages.push([path, p]); p.on('pageerror', e => { errs.push(e.message); logs.push(`[${path}] pageerror: ${e.message}`); }); p.on('console', m => { logs.push(`[${path}] console.${m.type()}: ${m.text()}`); if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('response', r => { if (r.status() >= 400) logs.push(`[${path}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(base, '')}`); }); await p.goto(base + path); return p; };
  // on failure: print console + HTTP errors + server rows, save a screenshot of every page
  const guard = async (name, fn) => { try { await fn(); } catch (err) { const dir = '/tmp/e2e-fail'; require('node:fs').mkdirSync(dir, { recursive: true }); const shots = [];
      for (const [i, [path, p]] of pages.entries()) { const f = `${dir}/${name}-${i}-${path.replace(/\W+/g, '_')}.png`; try { await p.screenshot({ path: f }); shots.push(f); } catch {} }
      console.log(`\n--- DIAGNOSTICS (${name}) ---\nconsole/pageerror/HTTP:\n${logs.join('\n') || '(none)'}\nscreenshots: ${shots.join(', ')}\nserver driver_change_requests: ${JSON.stringify(srv.db.prepare('select id,status,plate,reason from driver_change_requests').all())}\nserver drivers: ${JSON.stringify(srv.db.prepare('select plate,car,vehicle_type,vehicle_locked from drivers').all())}\n--- END ---`); throw err; } };
  return { srv, base, browser, errs, mk, guard, done: async () => { await browser.close(); await new Promise(r => srv.close(r)); } }; }

test('passenger offer cards show a server-driven 15 s countdown and the expired driver disappears; driver sees the outcome', async () => {
  const e = await env(); try { await e.guard('countdown', async () => {
    const rider = await e.mk('/app'), driver = await e.mk('/app/driver'); await riderLogin(rider, '0555000701', 'Amine'); await driverLogin(driver, '0666000702', 'Karim');
    // regression (#oempty): record any DOM state in which an offer card exists while the empty-state text is visible, or a fresh card still shows the 00:15 placeholder with <15 s left
    await rider.evaluate(() => { window.__bad = []; new MutationObserver(() => { const cards = document.querySelectorAll('#offers .offer'), em = document.querySelector('#oempty'); if (cards.length && em && !em.hidden) window.__bad.push('empty-state visible with ' + cards.length + ' card(s)');
      cards.forEach(c => { const rem = +c.dataset.exp - Date.now(); if (c.querySelector('.cdn').textContent === '00:15' && rem < 13000 && rem > 0 && !c.dataset.seen) window.__bad.push('stale placeholder, ' + Math.round(rem) + ' ms left'); c.dataset.seen = 1; }); }).observe(document.querySelector('#offers'), { childList: true, subtree: true }); }); await driver.getByRole('button', { name: 'الرئيسية' }).click();
    await driver.context().grantPermissions(['geolocation']); await driver.context().setGeolocation({ latitude: 36.7538, longitude: 3.0588 }); await driver.getByRole('switch').click();
    await rider.getByRole('button', { name: 'حدّد سعرك' }).click(); await rider.getByRole('button', { name: 'ابحث عن سائق' }).click();
    await driver.getByRole('button', { name: 'اقبل بسعره' }).click({ timeout: 8000 }); const card = rider.locator('.offer').first(); await card.waitFor({ timeout: 8000 });
    assert.deepEqual(await rider.evaluate(() => window.__bad), [], 'no inconsistent offer/empty-state frame was ever observed'); assert.equal(await rider.locator('#oempty').isHidden(), true);
    const first = await card.locator('.cdn').innerText(); assert.match(first, /^00:(1[0-5]|0\d)$/); const bar0 = await card.locator('.timer i').evaluate(el => parseFloat(el.style.width));
    assert.ok(bar0 <= 100 && bar0 > 0, 'progress bar width % right after the card appears: ' + bar0 + ' (inline style=' + (await card.locator('.timer i').getAttribute('style')) + ', text=' + first + ')'); const below = await card.evaluate(el => { const nm = el.querySelector('.nm').getBoundingClientRect(), cd = el.querySelector('.cd').getBoundingClientRect(); return cd.top > nm.bottom; }); assert.ok(below, 'countdown sits below the driver info');
    await rider.waitForTimeout(1500); const later = parseInt((await card.locator('.cdn').innerText()).slice(3)); assert.ok(later < parseInt(first.slice(3)), 'it counts down');
    await rider.locator('.offer').first().waitFor({ state: 'detached', timeout: 17000 }); assert.equal(await rider.locator('.offer').count(), 0); await rider.locator('#oempty').waitFor({ state: 'visible' });
    await rider.reload(); await rider.waitForTimeout(1500); assert.equal(await rider.locator('.offer').count(), 0, 'reload does not restore an expired offer');
    await driver.locator('.of-st.expired').waitFor({ timeout: 6000 }); assert.match(await driver.locator('.of-st.expired').innerText(), /انتهى/);
    const rows = e.srv.db.prepare('select status from offers').all().map(r => r.status); assert.deepEqual(rows, ['expired']); assert.equal(e.srv.db.prepare('select count(*) c from rides').get().c, 0);
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

test('driver vehicle-change sheet: unlocked applies at once; locked → pending status, edit, inline cancel confirm; rejection reason shown', async () => {
  const e = await env(); try { await e.guard('vehicle-sheet', async () => {
    const driver = await e.mk('/app/driver'); await driverLogin(driver, '0666000711', 'Karim'); await driver.locator('.tabbar [data-tab=account]').click();
    await driver.locator('#vc-open').waitFor(); await driver.locator('#vc-open').click(); await driver.locator('#vsheet').waitFor({ state: 'visible' }); assert.match(await driver.locator('#vnote').innerText(), /فورًا/);
    await driver.fill('#vmodel', 'Clio 5'); await driver.getByRole('button', { name: 'إرسال' }).click(); await driver.locator('#veh-card b', { hasText: 'Clio 5' }).waitFor();
    e.srv.db.prepare('update drivers set vehicle_locked=1').run(); await driver.reload(); await driver.locator('.tabbar [data-tab=account]').click();
    await driver.locator('#vc-open').click(); assert.match(await driver.locator('#vnote').innerText(), /موافقة الإدارة/); await driver.fill('#vmodel', 'Golf 8'); await driver.fill('#vplate', 'NEW-0001'); await driver.getByRole('button', { name: 'إرسال' }).click();
    await driver.locator('.st.pending').waitFor(); assert.equal((await driver.locator('#veh-card b').first().innerText()), 'Clio 5', 'active vehicle unchanged while pending'); assert.match(await driver.locator('.vpend').innerText(), /NEW-0001/);
    await driver.locator('#vc-edit').click(); assert.equal(await driver.inputValue('#vplate'), 'NEW-0001', 'edit pre-fills the pending values'); await driver.fill('#vplate', 'NEW-0002'); await driver.getByRole('button', { name: 'إرسال' }).click(); await driver.locator('.vpend', { hasText: 'NEW-0002' }).waitFor();
    await driver.locator('#vc-cancel').click(); await driver.locator('#vc-yes').waitFor(); await driver.locator('#vc-no').click(); await driver.locator('.st.pending').waitFor(); assert.equal(e.srv.db.prepare("select count(*) c from driver_change_requests where status='pending'").get().c, 1, 'keep it: nothing cancelled');
    await driver.locator('#vc-cancel').click(); await driver.locator('#vc-yes').click(); await driver.locator('#vc-open').waitFor(); assert.equal(e.srv.db.prepare("select count(*) c from driver_change_requests where status='pending'").get().c, 0);
    await driver.locator('#vc-open').click(); await driver.fill('#vplate', 'NEW-0003'); await driver.getByRole('button', { name: 'إرسال' }).click(); await driver.locator('.st.pending').waitFor();
    const id = e.srv.db.prepare("select id from driver_change_requests where status='pending'").get().id; e.srv.db.prepare("update driver_change_requests set status='rejected',reason='صورة غير واضحة' where id=?").run(id);
    await driver.reload(); await driver.locator('.tabbar [data-tab=account]').click(); await driver.locator('.st.rejected').waitFor(); assert.match(await driver.locator('.vpend .reason').innerText(), /صورة غير واضحة/);
    // plate collision (normalized) is rejected inside the sheet; Escape closes it deterministically and returns focus
    e.srv.db.exec("insert into users(id,phone,role) values(9001,'+213555990001','driver'); insert into drivers(user_id,car,plate,vehicle_locked) values(9001,'x','TAKEN-1',1)");
    await driver.locator('#vc-open').click(); await driver.fill('#vplate', 'taken 1'); await driver.getByRole('button', { name: 'إرسال' }).click();
    await driver.locator('#verr').filter({ hasText: 'مسجّل' }).waitFor(); assert.equal(await driver.locator('#vsheet').isVisible(), true, 'sheet stays open on error'); assert.equal(await driver.locator('#vsubmit').isDisabled(), false, 'submit usable again');
    await driver.keyboard.press('Escape'); assert.equal(await driver.locator('#vsheet').isHidden(), true); assert.equal(await driver.evaluate(() => document.activeElement && document.activeElement.id), 'vc-open', 'focus returns to the opener');
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

const CONTRAST = {
  rgba: c => { const m = c.replace(/^color\(srgb/, '').match(/-?[\d.]+(?:e-?\d+)?/g).map(Number); const k = c.startsWith('color(') ? 255 : 1; return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m.length > 3 ? m[3] : 1 }; }, // handles rgb()/rgba() (0-255) and color(srgb r g b / a) (0-1)
  over: (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 }),
  lum: c => { const [r, g, b] = [c.r, c.g, c.b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; },
  ratio(a, b) { const [x, y] = [this.lum(a), this.lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); } };
for (const scheme of ['dark', 'light']) test(`${scheme} theme: BOTH selected and unselected passenger vehicle cards meet contrast (text 4.5:1, icon and check 3:1, description 12px, visible border)`, async () => {
  const e = await env(); try { await e.guard('contrast-' + scheme, async () => {
    const rider = await e.mk('/app', { colorScheme: scheme }); await riderLogin(rider, '0555000' + (scheme === 'dark' ? '731' : '732'), 'Amine'); await rider.locator('#vehicle-choice').waitFor({ state: 'attached' });
    assert.equal(await rider.locator('#vehicle-choice').getAttribute('aria-label'), 'نوع المركبة');
    const cards = await rider.evaluate(() => { const page = getComputedStyle(document.body).backgroundColor; const g = (el, p) => getComputedStyle(el)[p];
      return { page, items: [...document.querySelectorAll('.vehicle-option')].map(o => ({ pressed: o.getAttribute('aria-pressed'), bg: g(o, 'backgroundColor'), border: g(o, 'borderTopColor'), borderW: g(o, 'borderTopWidth'), label: g(o.querySelector('b'), 'color'), small: g(o.querySelector('small'), 'color'), smallPx: g(o.querySelector('small'), 'fontSize'),
        art: g(o.querySelector('.vehicle-art'), 'color'), artBg: g(o.querySelector('.vehicle-art'), 'backgroundColor'), check: g(o.querySelector('.vehicle-check'), 'color'), checkBg: g(o.querySelector('.vehicle-check'), 'backgroundColor') })) }; });
    const C = CONTRAST, page = C.rgba(cards.page); assert.equal(cards.items.length, 2); assert.deepEqual(cards.items.map(i => i.pressed).sort(), ['false', 'true'], 'one selected, one unselected card measured');
    for (const i of cards.items) { const bg = C.over(C.rgba(i.bg), page), tag = `${scheme}/${i.pressed === 'true' ? 'selected' : 'unselected'}`;
      assert.ok(C.ratio(C.rgba(i.label), bg) >= 4.5, tag + ' label ' + C.ratio(C.rgba(i.label), bg).toFixed(2)); assert.ok(C.ratio(C.rgba(i.small), bg) >= 4.5, tag + ' description ' + C.ratio(C.rgba(i.small), bg).toFixed(2)); assert.equal(i.smallPx, '12px');
      const artBg = C.over(C.rgba(i.artBg), bg); assert.ok(C.ratio(C.rgba(i.art), artBg) >= 3, tag + ' icon ' + C.ratio(C.rgba(i.art), artBg).toFixed(2));
      assert.ok(parseFloat(i.borderW) >= 1 && C.rgba(i.border).a > 0, tag + ' has a visible border'); assert.ok(C.ratio(C.over(C.rgba(i.border), bg), bg) >= 1.15, tag + ' border distinguishable from card ' + C.ratio(C.over(C.rgba(i.border), bg), bg).toFixed(2));
      if (i.pressed === 'true') assert.ok(C.ratio(C.rgba(i.check), C.over(C.rgba(i.checkBg), bg)) >= 3, tag + ' check mark ' + C.ratio(C.rgba(i.check), C.over(C.rgba(i.checkBg), bg)).toFixed(2)); }
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

/* ---------- French LTR end to end (real user language fr from the server, not a stub) ---------- */
async function acct(base, phone, role, lang) { const post = (u, b, ck) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json', ...(ck ? { cookie: ck } : {}) }, body: JSON.stringify(b) });
  await post('/api/auth/otp', { phone }); const v = await post('/api/auth/verify', { phone, code: '123456', role }); const sid = /sid=([^;]+)/.exec(v.headers.get('set-cookie'))[1]; await post('/api/me', { name: role === 'driver' ? 'Karim' : 'Amine', lang }, 'sid=' + sid);
  if (role === 'driver') await post('/api/driver/profile', { car: 'Dacia Logan', plate: 'FR-' + phone.slice(-4) }, 'sid=' + sid); return sid; }
test('French LTR: passenger countdown/expiry, driver outcome and vehicle-change sheet are localized and dir=ltr; Arabic stays rtl', async () => {
  const e = await env(); try { await e.guard('french', async () => {
    const sr = await acct(e.base, '0555000801', 'rider', 'fr'), sd = await acct(e.base, '0666000802', 'driver', 'fr');
    const rider = await e.mk('/app', { sid: sr }), driver = await e.mk('/app/driver', { sid: sd, geo: true });
    for (const p of [rider, driver]) { await p.waitForFunction(() => document.documentElement.lang === 'fr'); assert.equal(await p.evaluate(() => document.documentElement.dir), 'ltr'); }
    assert.equal(await rider.locator('#vehicle-choice').getAttribute('aria-label'), 'Type de véhicule');
    await driver.getByRole('button', { name: 'Accueil' }).click(); await driver.getByRole('switch').click();
    await rider.getByRole('button', { name: 'Fixer mon prix' }).click(); await rider.getByRole('button', { name: 'Trouver un chauffeur' }).click();
    await driver.getByRole('button', { name: 'Accepter son prix' }).click({ timeout: 8000 }); const card = rider.locator('.offer').first(); await card.waitFor({ timeout: 8000 });
    assert.match(await card.locator('.cdn').innerText(), /^00:\d\d$/); assert.equal(await card.locator('.cd').getAttribute('role'), 'timer');
    await card.waitFor({ state: 'detached', timeout: 17000 }); assert.equal((await rider.locator('#oempty').innerText()).trim(), 'Aucune offre pour le moment…');
    await driver.locator('.of-st.expired').waitFor({ timeout: 6000 }); assert.equal((await driver.locator('.of-st.expired').innerText()).trim(), 'Votre offre a expiré');
    await driver.locator('.tabbar [data-tab=account]').click(); await driver.locator('#vc-open').click(); assert.equal(await driver.locator('#vtitle').innerText(), 'Votre véhicule');
    assert.match(await driver.locator('#vsheet').innerText(), /Modèle[\s\S]*Immatriculation/); assert.match(await driver.locator('#vnote').innerText(), /s'applique immédiatement/);
    await driver.keyboard.press('Escape'); e.srv.db.prepare('update drivers set vehicle_locked=1').run(); await driver.reload(); await driver.locator('.tabbar [data-tab=account]').click(); await driver.locator('#vc-open').click();
    assert.match(await driver.locator('#vnote').innerText(), /accord de l'administration/); await driver.fill('#vplate', 'FR-NEW-1'); await driver.getByRole('button', { name: 'Envoyer' }).click();
    assert.equal((await driver.locator('.st.pending').innerText()).trim(), "En attente d'approbation"); await driver.locator('#vc-cancel').click(); assert.equal((await driver.locator('#vact .sub').innerText()).trim(), 'Annuler la demande ?');
    await driver.locator('#vc-yes').click(); await driver.locator('#vc-open').waitFor(); assert.equal(e.srv.db.prepare("select count(*) c from driver_change_requests where status='pending'").get().c, 0);
    const ar = await e.mk('/app'); assert.equal(await ar.evaluate(() => document.documentElement.dir), 'rtl'); assert.equal(await ar.evaluate(() => document.documentElement.lang), 'ar');
  }); } finally { await e.done(); } assert.deepEqual(e.errs, []); });

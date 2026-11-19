// UI screenshot harness (dev only): drives the REAL passenger flow through the UI; the driver acts through the API.
// Usage: node validation/ui-shots.js <outDir> [ar|fr] [light|dark] [width]
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');
const out = process.argv[2] || '/tmp/ui-shots', LANG = process.argv[3] || 'ar', THEME = process.argv[4] || 'light', W = +(process.argv[5] || 390);
fs.mkdirSync(out, { recursive: true });
const P = { lat: 36.7538, lng: 3.0588, label: 'Bab Ezzouar' }, D = { lat: 36.691, lng: 3.2154, label: 'Aéroport' };
(async () => {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(); let n = 0; const issues = [];
  const client = () => { const jar = {}; const call = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') }, body: b ? JSON.stringify(b) : undefined });
      for (const sc of r.headers.getSetCookie()) { const [kv] = sc.split(';'); const [k, ...v] = kv.split('='); jar[k] = v.join('='); } let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
    return { call, jar, login: async (role, name) => { const phone = '0555' + String(300000 + n++); await call('POST', '/api/auth/otp', { phone }); await call('POST', '/api/auth/verify', { phone, code: '123456', role, name }); if (name) await call('POST', '/api/me', { name, lang: LANG }); } }; };
  const ctx = async cl => { const c = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, colorScheme: THEME });
    if (cl) await c.addCookies(Object.entries(cl.jar).map(([name, value]) => ({ name, value, url: base }))); await c.addInitScript(t => { try { localStorage.setItem('kherja-theme', t); } catch {} }, THEME); return c; };
  const check = async (page, name) => { const r = await page.evaluate(() => { const o = []; const de = document.documentElement; if (de.scrollWidth > de.clientWidth + 1) o.push('h-scroll'); const app = document.querySelector('.app'); document.querySelectorAll('.screen.on button, .screen.on .input').forEach(e => { if (e.closest('.sheet:not(.on)')) return; const b = e.getBoundingClientRect(); if (b.width && (b.right > innerWidth + 1 || b.left < -1)) o.push('clipped:' + (e.id || e.className || e.textContent.slice(0, 20))); }); return o; }); if (r.length) issues.push(name + ': ' + r.join(', ')); };
  const shot = async (page, name) => { await page.waitForTimeout(650); await page.screenshot({ path: path.join(out, `${LANG}-${THEME}-${name}.png`) }); await check(page, name); console.log('shot', name); };
  const setLang = async page => { await page.evaluate(l => document.querySelector(`[data-lang="${l}"]`)?.click(), LANG); };
  const rider = client(), driver = client(); await rider.login('rider', 'Karim B.'); await driver.login('driver', 'Ethan Parker');
  await driver.call('POST', '/api/driver/profile', { car: 'Toyota Corolla', plate: '04721-116-16' }); await driver.call('POST', '/api/driver/online', { online: true, lat: 36.76, lng: 3.06 });
  // gate through the UI
  let c = await ctx(null), p = await c.newPage(); await p.goto(base + '/app'); await setLang(p); await shot(p, '01-gate-lang');
  await p.locator('#s-lang .btn.primary').click(); await shot(p, '02-gate-phone');
  await p.locator('#s-phone input[type=tel], #s-phone input.input').first().fill('0555999001'); await p.locator('#s-phone .btn.primary').click(); await p.waitForSelector('#s-otp.on'); await shot(p, '03-gate-otp'); await c.close();
  // profile onboarding (new rider, no name)
  const fresh = client(); await fresh.login('rider', null); c = await ctx(fresh); p = await c.newPage(); await p.goto(base + '/app'); await setLang(p); await shot(p, '04-profile-onboarding'); await c.close();
  // real flow
  c = await ctx(rider); p = await c.newPage(); await p.goto(base + '/app'); await setLang(p); await p.waitForSelector('#sh-home.on');
  await shot(p, '10-home'); await p.locator('[data-ride-vehicle=moto]').click(); await shot(p, '11-home-moto'); await p.locator('[data-ride-vehicle=car]').click();
  await p.locator('#to-request').click(); await p.waitForSelector('#sh-request.on'); await shot(p, '12-request'); await p.locator('#minus').click(); await p.locator('#minus').click(); await p.locator('#minus').click(); await p.locator('#minus').click(); await p.locator('#minus').click(); await shot(p, '13-request-low-fare');
  for (let i = 0; i < 5; i++) await p.locator('#plus').click();
  await p.locator('#order').click(); await p.waitForSelector('#sh-wait.on'); await shot(p, '14-waiting');
  const reqs = await driver.call('GET', '/api/driver/requests'); const rid = (reqs.j.requests || reqs.j)[0].id;
  const of = await driver.call('POST', `/api/requests/${rid}/offers`, { price: 500, eta_min: 4 });
  await p.waitForSelector('#offers .offer', { timeout: 8000 }); await shot(p, '15-offers');
  await p.locator('#offers .offer [data-ok]').first().click(); await p.waitForSelector('#sh-way.on'); await shot(p, '16-ride-en-route');
  await p.locator('#sos').click(); await p.waitForSelector('#s-sos.on #sos-add:not([hidden])'); await shot(p, '16b-sos-no-contacts');
  await rider.call('POST', '/api/safety/contacts', { name: 'Ma Mère', phone: '0798765432' }); await rider.call('POST', '/api/safety/contacts', { name: 'Mon Frère', phone: '0787654321' });
  await p.locator('#s-sos [data-back]').click(); await p.locator('#sos').click(); await p.waitForSelector('#sos-list .ct-row'); await shot(p, '16c-sos'); await p.locator('#s-sos [data-back]').click(); await p.waitForSelector('#sh-way.on');
  const ride = await rider.call('GET', '/api/rides/active'); const ridId = ride.j.id || ride.j.ride?.id;
  await driver.call('POST', `/api/rides/${ridId}/status`, { status: 'arrived' }); await p.waitForTimeout(1600); await shot(p, '17-ride-arrived');
  await driver.call('POST', `/api/rides/${ridId}/status`, { status: 'in_progress' }); await p.waitForTimeout(1600); await shot(p, '18-ride-in-progress');
  await driver.call('POST', `/api/rides/${ridId}/status`, { status: 'completed' }); await p.waitForSelector('#sh-done.on', { timeout: 6000 }); await shot(p, '19-done');
  await p.locator('#stars button').nth(4).click(); await shot(p, '20-done-rated');
  await p.locator('#submit-rate').click(); await p.waitForSelector('#sh-home.on'); await p.waitForTimeout(2800); await shot(p, '30-home-tabbar');
  await p.locator('#sh-home [data-tab=hist]').click(); await p.waitForSelector('#s-hist.on #hist-list .hrow'); await p.waitForTimeout(600); await shot(p, '31-history');
  await p.locator('#s-hist .chips button').nth(2).click(); await shot(p, '32-history-empty-filter'); await p.locator('#s-hist .chips button').nth(0).click();
  await p.locator('#hist-list .hrow').first().click(); await p.waitForSelector('#s-hdet.on #hd-report',{state:'attached'}); await shot(p, '33-ride-details');
  await p.evaluate(() => document.querySelector('#s-hdet [data-back]').click()); await p.waitForSelector('#s-hist.on');
  await p.context().setOffline(true); await p.locator('#s-hist [data-tab=home]').click(); await p.locator('#sh-home [data-tab=hist]').click(); await p.waitForSelector('#hist-list [data-retry]'); await shot(p, '34-history-offline'); await p.context().setOffline(false);
  await p.locator('#s-hist [data-tab=prof]').click(); await p.waitForSelector('#s-prof.on #pf-phone:not(:empty)'); await shot(p, '40-profile');
  await p.locator('#pf-menu [data-go=s-set]').click(); await shot(p, '41-settings');
  await p.evaluate(() => document.querySelector('#s-set [data-back]').click()); await p.locator('#pf-menu [data-go=s-help]').click(); await p.locator('#faq summary').first().click(); await shot(p, '42-help');
  await p.evaluate(() => document.querySelector('#s-help [data-back]').click()); await p.locator('#pf-menu [data-go=s-contacts]').click(); await p.waitForSelector('#ct-list .ct-row'); await shot(p, '50-contacts');
  await p.locator('#ct-add').click(); await p.locator('#ct-name').fill('Test'); await p.locator('#ct-phone').fill('x'); await p.locator('#ct-save').click(); await shot(p, '51-contacts-form-error');
  await p.locator('#s-contacts [data-back]').click(); await p.locator('#s-prof [data-tab=hist]').click(); await p.waitForSelector('#hist-list .hrow'); await p.locator('#hist-list .hrow').first().click(); await p.locator('#hd-report').click(); await shot(p, '60-report');
  await p.locator('#s-report .rp-kinds button').nth(2).click(); await p.locator('#rp-body').fill('Test'); await shot(p, '61-report-filled');
  await p.locator('#rp-send').click(); await p.waitForSelector('#rp-done:not([hidden])'); await shot(p, '62-report-sent');
  fs.writeFileSync(path.join(out, `${LANG}-${THEME}-issues.txt`), issues.join('\n') || 'none'); console.log('ISSUES', issues.length ? issues : 'none');
  await browser.close(); await new Promise(r => srv.close(r));
})().catch(e => { console.error(e); process.exit(1); });

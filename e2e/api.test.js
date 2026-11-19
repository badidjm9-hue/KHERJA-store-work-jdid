// Two real browsers (rider + driver) against the real backend. Run: node --test e2e/api.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createApp } = require('../backend/server');

const driverLogin = async (p, phone, name) => { await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
  const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click();
  await p.getByLabel('الاسم').fill(name); await p.getByLabel('الطراز').fill('Renault Symbol'); await p.getByLabel('رقم اللوحة').fill('12345-116-' + phone.slice(-2)); await p.getByRole('button', { name: 'التالي' }).click(); };

test('rider and driver complete a ride through the real API', async () => {
  const srv = createApp({ dev: true, devAdmin: true }); await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch(); const errs = [];
  const mk = async (path = '') => { const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); await p.goto(base + path); return p; };
  const login = async (p, phone, name) => { await p.getByRole('button', { name: 'متابعة' }).click(); await p.getByLabel('رقم الهاتف').fill(phone); await p.getByRole('button', { name: 'إرسال الرمز' }).click();
    const b = p.locator('#otp input'); for (let i = 0; i < 6; i++) await b.nth(i).fill('123456'[i]); await p.getByRole('button', { name: 'تأكيد' }).click(); await p.getByLabel('الاسم').fill(name); await p.getByRole('button', { name: 'ابدأ' }).click(); };
  try {
    const rider = await mk(), driver = await mk('/driver');
    await login(rider, '0555000001', 'Amine'); await driverLogin(driver, '0666000002', 'Karim <b>X</b>'); await driver.getByRole('button', { name: 'الرئيسية' }).click();
    await driver.context().grantPermissions(['geolocation']); await driver.context().setGeolocation({ latitude: 36.7538, longitude: 3.0588 }); await driver.getByRole('switch').click();
    await rider.getByRole('button', { name: 'حدّد سعرك' }).click(); await rider.getByRole('button', { name: 'ابحث عن سائق' }).click();
    await driver.getByRole('button', { name: 'اقبل بسعره' }).click({ timeout: 8000 });
    await rider.locator('.offer').first().waitFor({ timeout: 8000 });
    assert.equal(await rider.locator('.offer .nm').first().innerText(), 'Karim <b>X</b>', 'name escaped, not rendered as HTML');
    await rider.locator('.offer [data-ok]').first().click(); await rider.getByText('السعر مثبّت').waitFor();
    for (const label of ['وصلت', 'ابدأ الرحلة', 'أنهِ الرحلة']) await driver.getByRole('button', { name: label }).click({ timeout: 8000 });
    await rider.locator('#sh-done.on').waitFor({ timeout: 8000 }); await rider.waitForTimeout(600);
    await rider.getByRole('radio', { name: '5' }).click(); await rider.locator('#stars [data-n="5"][aria-checked=true]').waitFor(); await rider.getByRole('button', { name: 'إرسال التقييم' }).click();
    await rider.getByRole('button', { name: 'حدّد سعرك' }).waitFor();
    const ride = srv.db.prepare('select status,locked_price from rides').get(); assert.deepEqual({ ...ride }, { status: 'completed', locked_price: 450 });
    for (let i = 0; i < 30 && !srv.db.prepare('select 1 from ratings').get(); i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(srv.db.prepare('select stars from ratings').get().stars, 5);
    assert.equal(srv.db.prepare('select name from users where phone=?').get('+213555000001').name, 'Amine');
    assert.deepEqual(errs, []);
  } finally { await browser.close(); srv.close(); }
});
